// Couple runsheet writes that answer with a toast and an Undo.
//  K7: a delete commits at once (the row leaves the list before the server
//      answers); Undo restores the same block, same id, through
//      POST /couple/runsheet/{id}/restore when the DELETE answered
//      restorable: true, and records it again on an older portal. A refused
//      delete puts the row back and says what failed.
//  #2: a change request (edit, add, remove) is sent once per tap of Send (an
//      Idempotency-Key per draft); a removal request offers Undo (withdraw);
//      withdrawing offers Undo (reopen).

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure, del, post } from "@/lib/api";
import { failedText } from "@/features/shared/requests";
import { toast, toastError } from "@/ui";
import { COPY } from "./copy";
import { requestBody, undoKind, type ChangeRequest } from "./core";
import { RUNSHEET_KEY, formFromBlock, toBody, type RunsheetBlock, type RunsheetSurface } from "./hooks";

export const isLocked = (err: unknown) => err instanceof ApiFailure && err.code === "runsheet_locked";

function without(cur: RunsheetSurface | undefined, id: string): RunsheetSurface | undefined {
  if (!cur) return cur;
  let removed = 0;
  const days = cur.days
    .map((d) => {
      const blocks = d.blocks.filter((b) => b.id !== id);
      removed += d.blocks.length - blocks.length;
      return { ...d, blocks };
    })
    .filter((d) => d.blocks.length);
  return { ...cur, days, blocks_total: Math.max(0, cur.blocks_total - removed) };
}

function withBlock(cur: RunsheetSurface | undefined, b: RunsheetBlock): RunsheetSurface | undefined {
  if (!cur || cur.days.some((d) => d.blocks.some((x) => x.id === b.id))) return cur;
  const has = cur.days.some((d) => d.day === b.day);
  const days = has ? cur.days.map((d) => (d.day === b.day ? { ...d, blocks: [...d.blocks, b] } : d)) : [...cur.days, { day: b.day, blocks: [b] }].sort((x, y) => x.day.localeCompare(y.day));
  return { ...cur, days, blocks_total: cur.blocks_total + 1 };
}

function withoutRequest(cur: RunsheetSurface | undefined, id: string): RunsheetSurface | undefined {
  return cur && cur.requests ? { ...cur, requests: cur.requests.filter((r) => r.id !== id) } : cur;
}

const refresh = (qc: QueryClient) => void qc.invalidateQueries({ queryKey: RUNSHEET_KEY });

export function useBlockActions() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const qc = useQueryClient();

  /** Deletes now, Undo for a few seconds. Call after leaving the block's screen. */
  function deleteBlock(b: RunsheetBlock, withPlace: boolean) {
    const prev = qc.getQueryData<RunsheetSurface>(RUNSHEET_KEY);
    qc.setQueryData<RunsheetSurface | undefined>(RUNSHEET_KEY, (cur) => without(cur, b.id));
    const done = del<{ deleted: boolean; restorable?: boolean }>(`/couple/runsheet/${b.id}`);
    const dismiss = toast(fmt(c.deleted, { title: b.title }), { undo: () => void undo(done) });
    done.then(
      () => refresh(qc),
      (err) => {
        dismiss();
        qc.setQueryData<RunsheetSurface | undefined>(RUNSHEET_KEY, (cur) => withBlock(cur ?? prev, b));
        toastError(isLocked(err) ? c.lockedContent : failedText(fmt(c.deleteFailed, { title: b.title }), err, lang));
        refresh(qc);
      },
    );

    async function undo(pending: Promise<unknown>) {
      let answer: unknown;
      try {
        answer = await pending;
      } catch {
        return; // the delete itself failed: the row is already back
      }
      qc.setQueryData<RunsheetSurface | undefined>(RUNSHEET_KEY, (cur) => withBlock(cur, b));
      try {
        if (undoKind(answer) === "restore") await post(`/couple/runsheet/${b.id}/restore`);
        else await post("/couple/runsheet", toBody(formFromBlock(b), withPlace));
      } catch (err) {
        qc.setQueryData<RunsheetSurface | undefined>(RUNSHEET_KEY, (cur) => without(cur, b.id));
        toastError(isLocked(err) ? c.lockedContent : failedText(fmt(c.restoreFailed, { title: b.title }), err, lang));
      } finally {
        refresh(qc);
      }
    }
  }

  /** Sends a change request. Resolves to the request, or throws ApiFailure. */
  async function sendRequest(kind: "edit" | "add" | "remove", blockId: string | null, block: Record<string, unknown> | null, note: string, key: string): Promise<ChangeRequest> {
    const res = await post<{ request: ChangeRequest }>("/couple/runsheet/requests", requestBody(kind, blockId, block, note), { headers: { "Idempotency-Key": key } });
    refresh(qc);
    return res.request;
  }

  /** Withdraws an open request now; Undo reopens it. */
  function withdraw(r: ChangeRequest) {
    const prev = qc.getQueryData<RunsheetSurface>(RUNSHEET_KEY);
    qc.setQueryData<RunsheetSurface | undefined>(RUNSHEET_KEY, (cur) => withoutRequest(cur, r.id));
    del(`/couple/runsheet/requests/${r.id}`).then(
      () => {
        refresh(qc);
        toast(c.requestWithdrawn, {
          undo: () => {
            void post(`/couple/runsheet/requests/${r.id}/reopen`)
              .catch((err) => toastError(failedText(c.fail.sendRequest, err, lang)))
              .finally(() => refresh(qc));
          },
        });
      },
      (err) => {
        if (prev) qc.setQueryData(RUNSHEET_KEY, prev);
        toastError(failedText(c.fail.withdraw, err, lang));
        refresh(qc);
      },
    );
  }

  return { deleteBlock, sendRequest, withdraw };
}

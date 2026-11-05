// Couple runsheet writes that answer with a toast and an Undo.
//  K7: the row leaves the list at once. On a portal that restores, the
//      DELETE goes now and Undo restores the same block, same id, through
//      POST /couple/runsheet/{id}/restore; on a portal not known to restore,
//      the DELETE waits until the Undo toast leaves, so Undo sends nothing.
//      A block is never re-created by Undo. A refused delete puts the row back
//      and says what failed.
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
import { requestBody, runDelete, type ChangeRequest } from "./core";
import { RUNSHEET_KEY, type RunsheetBlock, type RunsheetSurface } from "./hooks";

export const isLocked = (err: unknown) => err instanceof ApiFailure && err.code === "runsheet_locked";

// This portal restores deleted blocks: a DELETE answered restorable: true
// once in this run of the app. A payload carrying a wave key (lock, requests,
// places) comes from a portal with K7 too (the same lane shipped it first).
let portalRestores = false;
const wavePortal = (s: RunsheetSurface | undefined) => !!s && (s.lock !== undefined || s.requests !== undefined || s.places !== undefined);

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

  /** Deletes with Undo for a few seconds (runDelete in core.ts: commit now and
   *  restore the same id on a portal that restores; otherwise the DELETE waits
   *  for the toast to leave). Call after leaving the block's screen. */
  function deleteBlock(b: RunsheetBlock) {
    const surface = qc.getQueryData<RunsheetSurface>(RUNSHEET_KEY);
    void runDelete({
      hide: () => qc.setQueryData<RunsheetSurface | undefined>(RUNSHEET_KEY, (cur) => without(cur, b.id)),
      show: () => qc.setQueryData<RunsheetSurface | undefined>(RUNSHEET_KEY, (cur) => withBlock(cur ?? surface, b)),
      send: () => del<{ deleted: boolean; restorable?: boolean }>(`/couple/runsheet/${b.id}`),
      restore: () => post(`/couple/runsheet/${b.id}/restore`),
      toast: (undo, onLeave) => toast(fmt(c.deleted, { title: b.title }), { undo, onLeave }),
      failed: (what, err) =>
        toastError(
          isLocked(err)
            ? c.lockedContent
            : what === "delete"
              ? failedText(fmt(c.deleteFailed, { title: b.title }), err, lang)
              : failedText(fmt(c.restoreFailed, { title: b.title }), err, lang),
        ),
      settled: () => refresh(qc),
      knowsRestore: () => portalRestores || wavePortal(surface),
      learnRestore: (v) => {
        if (v) portalRestores = true;
      },
    });
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

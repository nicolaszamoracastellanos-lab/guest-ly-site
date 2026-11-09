// What the watch can ask the phone to do. The phone owns the session and the
// API; the watch only sends { id, type, payload } and waits for one reply:
// { ok, data?, error? } where `error` is already localized display text.
//
// Pure module: every effect comes in through `deps`, so
// scripts/tests/watch-actions.test.ts runs it under node with a mocked API.

import type { WatchLang } from "./types";
import { minutesOfClock } from "./time";

export type WatchRoleName = "couple" | "planner" | "guest" | "none";
export type ActionReply = { ok: boolean; data?: Record<string, unknown>; error?: string };

export type CardLike = { id: string; title: { en: string; es: string }; requiresTypedConfirm: boolean };
export type StreamEventLike =
  | { t: "session"; sessionId: string }
  | { t: "reply"; text: string }
  | { t: "card"; card: CardLike }
  | { t: "error"; message: string }
  | { t: "done" }
  | { t: "open" | "tool" | "executed" | "card_status" | "plan_step" };

export type CheckinItem = { kind: "checkin"; client_event_id: string; guest_id: string; seats: number; scanned_at: string; name: string; path?: string; tenant?: string };

export type WatchDeps = {
  role: () => WatchRoleName;
  can: (tool: string, level: "view" | "edit") => boolean;
  lang: () => WatchLang;
  slug: () => string | null;
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  checkIn: (item: CheckinItem) => Promise<{ already: boolean; guest: { name: string; table: string | null } | null } | null>;
  newEventId: () => string;
  now: () => number;
  stream: (path: string, body: Record<string, unknown>, onEvent: (e: StreamEventLike) => void) => Promise<{ ok: boolean }>;
  refresh: () => Promise<void>;
  onArrival: (a: { name: string; table: string | null }) => void;
  errText: (e: unknown) => string;
};

const TEXT = {
  en: { notAllowed: "Not available for this account", viewOnly: "View only", openPhone: "Open Guest-ly on your iPhone to confirm.", confirm: "Confirm", unknown: "That did not work", noSession: "Open Guest-ly on your iPhone" },
  es: { notAllowed: "No disponible para esta cuenta", viewOnly: "Solo lectura", openPhone: "Abre Guest-ly en tu iPhone para confirmar.", confirm: "Confirmar", unknown: "No funcionó", noSession: "Abre Guest-ly en tu iPhone" },
};

const MAX_ANSWER = 600;

/** Cuts at a sentence end inside the limit (or at a word), never mid word. */
export function clipAnswer(text: string, max = MAX_ANSWER): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "), cut.lastIndexOf(".\n"));
  if (stop > max * 0.4) return cut.slice(0, stop + 1).trim();
  const sp = cut.lastIndexOf(" ");
  return `${cut.slice(0, sp > 0 ? sp : max).trim()}…`;
}

function addMinutes(t: string, add: number): string {
  const m = minutesOfClock(t);
  const total = (((m + add) % 1440) + 1440) % 1440;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(total / 60))}:${p(total % 60)}`;
}

type RunsheetBlockLike = { id: string; day: string; starts_at: string; ends_at: string | null };

export function createWatchActions(deps: WatchDeps) {
  const sessions = new Map<string, string>(); // coordinator session per role + wedding
  const guestParty = new Map<string, { name: string; seats: number }>(); // from the last search
  const T = () => TEXT[deps.lang()];
  const fail = (error: string): ActionReply => ({ ok: false, error });
  const ok = (data?: Record<string, unknown>): ActionReply => ({ ok: true, ...(data ? { data } : {}) });
  const staff = () => (deps.role() === "couple" || deps.role() === "planner" ? (deps.role() as "couple" | "planner") : null);

  async function ask(body: Record<string, unknown>): Promise<ActionReply> {
    const role = staff();
    if (!role) return fail(T().notAllowed);
    const key = `${role}:${deps.slug() ?? ""}`;
    let text = "";
    const got: { card: CardLike | null; error: string } = { card: null, error: "" };
    const out = await deps.stream(`/${role}/coordinator`, { sessionId: sessions.get(key) ?? null, ...body }, (e) => {
      if (e.t === "session") sessions.set(key, e.sessionId);
      else if (e.t === "reply") text += (text ? " " : "") + e.text;
      else if (e.t === "card" && !got.card) got.card = e.card;
      else if (e.t === "error") got.error = e.message;
    });
    if (!out.ok && !text) return fail(got.error || T().unknown);
    let answer = clipAnswer(text);
    let offer: { actionId: string; confirmLabel: string } | null = null;
    if (got.card) {
      const c = got.card;
      if (c.requiresTypedConfirm) answer = `${answer} ${T().openPhone}`.trim();
      else offer = { actionId: c.id, confirmLabel: (c.title[deps.lang()] || T().confirm).slice(0, 28) };
    }
    return ok({ text: answer, card: offer });
  }

  const handlers: Record<string, (p: Record<string, unknown>) => Promise<ActionReply>> = {
    async ping() {
      return ok();
    },

    async refresh() {
      await deps.refresh();
      return ok();
    },

    async "task.toggle"(p) {
      const role = staff();
      if (!role) return fail(T().notAllowed);
      const id = String(p.id ?? "");
      const done = p.done === true;
      if (role === "planner") {
        if (!deps.can("tasks", "edit")) return fail(T().viewOnly);
        await deps.post(`/planner/tasks/${id}/status`, { status: done ? "done" : "open" });
      } else {
        await deps.post(`/couple/tasks/${id}/status`, { status: done ? "done" : "todo" });
      }
      void deps.refresh();
      return ok();
    },

    async "checkin.search"(p) {
      const role = staff();
      if (!role) return fail(T().notAllowed);
      const q = String(p.q ?? "").trim();
      if (q.length < 2) return ok({ results: [] });
      const r = await deps.get<{ items: { id: string; name: string; party_size: number; checked_in_at: string | null }[] }>(
        `${role === "planner" ? "/planner/checkin/search" : "/couple/guests"}?q=${encodeURIComponent(q)}`
      );
      const items = (r.items ?? []).slice(0, 5);
      guestParty.clear();
      for (const g of items) guestParty.set(g.id, { name: g.name, seats: g.party_size || 1 });
      return ok({ results: items.map((g) => ({ guestId: g.id, name: g.name, line: deps.lang() === "es" ? `Grupo de ${g.party_size}` : `Party of ${g.party_size}`, already: !!g.checked_in_at })) });
    },

    async "checkin.commit"(p) {
      const role = staff();
      if (!role) return fail(T().notAllowed);
      if (role === "planner" && !deps.can("checkin", "edit")) return fail(T().viewOnly);
      const guestId = String(p.guestId ?? "");
      const known = guestParty.get(guestId);
      const result = await deps.checkIn({
        kind: "checkin",
        client_event_id: deps.newEventId(),
        guest_id: guestId,
        seats: known?.seats ?? 1,
        scanned_at: new Date(deps.now()).toISOString(),
        name: known?.name ?? "",
        path: role === "planner" ? "/planner/checkin" : undefined,
        tenant: deps.slug() ?? undefined,
      });
      const name = result?.guest?.name ?? known?.name ?? "";
      if (name) deps.onArrival({ name, table: result?.guest?.table ?? null });
      void deps.refresh();
      return ok({ already: result?.already ?? false, queued: result === null, name });
    },

    async "vendor.onsite"(p) {
      const role = staff();
      if (!role) return fail(T().notAllowed);
      if (role === "planner" && !deps.can("runsheet", "edit")) return fail(T().viewOnly);
      await deps.post(`/${role}/runsheet/${String(p.blockId ?? "")}/status`, { status: "done" });
      void deps.refresh();
      return ok();
    },

    async "runsheet.push15"(p) {
      if (deps.role() !== "couple") return fail(T().notAllowed);
      const blockId = String(p.blockId ?? "");
      const sheet = await deps.get<{ days: { day: string; blocks: RunsheetBlockLike[] }[] }>("/couple/runsheet");
      const dayOf = sheet.days.find((d) => d.blocks.some((b) => b.id === blockId));
      const target = dayOf?.blocks.find((b) => b.id === blockId);
      if (!dayOf || !target) return fail(T().unknown);
      const later = dayOf.blocks.filter((b) => minutesOfClock(b.starts_at) >= minutesOfClock(target.starts_at)).sort((a, b) => minutesOfClock(a.starts_at) - minutesOfClock(b.starts_at));
      let moved = 0;
      for (const b of later) {
        // In order, stopping at the first block the portal refuses (a locked timeline answers for the rest).
        await deps.post(`/couple/runsheet/${b.id}`, { starts_at: addMinutes(b.starts_at.slice(0, 5), 15), ...(b.ends_at ? { ends_at: addMinutes(b.ends_at.slice(0, 5), 15) } : {}) });
        moved += 1;
      }
      void deps.refresh();
      return ok({ moved });
    },

    async "coordinator.ask"(p) {
      const text = String(p.text ?? "").trim();
      if (!text) return fail(T().unknown);
      return ask({ message: text });
    },

    async "coordinator.confirm"(p) {
      const actionId = String(p.actionId ?? "");
      if (!actionId) return fail(T().unknown);
      const r = await ask({ confirmActionId: actionId });
      void deps.refresh();
      return r;
    },

    async "needsYou.reply"(p) {
      if (deps.role() !== "couple") return fail(T().notAllowed);
      const id = String(p.id ?? "");
      const text = String(p.text ?? "").trim();
      if (!id || !text) return fail(T().unknown);
      await deps.post(`/couple/messages/${id}/reply`, { text });
      await deps.post(`/couple/messages/${id}/handled`, {}).catch(() => undefined);
      void deps.refresh();
      return ok();
    },
  };

  /** Runs one action and returns the single reply for the watch. Never throws. */
  async function handle(type: string, payloadJson: string): Promise<ActionReply> {
    const fn = handlers[type];
    if (!fn) return fail("unknown");
    let payload: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(payloadJson || "{}");
      if (parsed && typeof parsed === "object") payload = parsed as Record<string, unknown>;
    } catch {
      return fail(T().unknown);
    }
    if (deps.role() === "none" && type !== "ping") return fail(T().noSession);
    try {
      return await fn(payload);
    } catch (e) {
      return fail(deps.errText(e) || T().unknown);
    }
  }

  return { handle };
}

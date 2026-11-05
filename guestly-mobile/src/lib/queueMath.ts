// Pure rules of the offline outbox (HH, Oct 30 2026; #30 Nov 2026): door
// check-ins and runsheet block status taps. No React Native imports, so
// scripts/tests/queue.test.ts and outbox.test.ts run them under plain node.

/** What the door chip says. `hidden` when online with nothing waiting. */
export type ChipState = "hidden" | "offline" | "offlinePending" | "pending" | "syncing";

export function chipState(pending: number, online: boolean, syncing: boolean): ChipState {
  const n = Math.max(0, pending | 0);
  if (!online) return n > 0 ? "offlinePending" : "offline";
  if (n === 0) return "hidden";
  return syncing ? "syncing" : "pending";
}

/** How one queued check-in ended when the drain sent it. */
export type Outcome =
  | { kind: "sent"; already: boolean } // delivered; `already` = another door got there first
  | { kind: "refused"; reason?: "locked" | "gone" } // a final 4xx: the server will never take it (guest removed, wrong wedding, timeline locked, block deleted)
  | { kind: "retry" }; // offline, timeout, 5xx, 401, 408, 429: keep it

/** What kind of entry the outbox holds. Entries stored before #30 have no kind: check-ins. */
export type OutboxKind = "checkin" | "block_status";

/** What became of one send that failed. `null` failure: not an API answer at all (keep it). */
export type FailureClass = "retry" | "refused" | "locked" | "gone";

/**
 * Sorts a failed send. Offline, a timeout, an expired session (401: the
 * entry waits for the next sign-in refresh, reads keep working), 408, 429
 * and 5xx keep the entry. For a block status tap, `runsheet_locked` (D28,
 * 423) is final: the planner marks the timeline on the day, so the tap is
 * dropped and the phone says so once. A block deleted on the web (`gone`,
 * `not_found` or 410) is dropped and named. Any other 4xx is a final refusal.
 */
export function classifyFailure(kind: OutboxKind, f: { status: number; code: string } | null): FailureClass {
  if (!f) return "retry";
  const s = f.status;
  if (s === 0 || s === 401 || s === 408 || s === 429 || s >= 500 || f.code === "offline" || f.code === "timeout") return "retry";
  if (kind === "block_status") {
    if (f.code === "runsheet_locked") return "locked";
    // The route's own "no such block" (not the host's 404 page, http_404,
    // which means the route itself is missing: a refusal, not a deleted block).
    if (f.code === "gone" || f.code === "not_found" || s === 410) return "gone";
  }
  return "refused";
}

/** The drain outcome for a failure class (retry stays retry). */
export function outcomeFor(c: FailureClass): Outcome {
  if (c === "retry") return { kind: "retry" };
  if (c === "refused") return { kind: "refused" };
  return { kind: "refused", reason: c };
}

/** What a drain settled: ids to remove from storage, and the names to tell
 *  the door about. Stops at the first `retry` (order matters: a later scan of
 *  the same party must not overtake an earlier one). */
export function settle<T extends { client_event_id: string; name: string }>(items: readonly T[], outcomes: readonly Outcome[]): { done: Set<string>; sent: number; already: string[]; refused: string[]; locked: string[]; gone: string[] } {
  const done = new Set<string>();
  const already: string[] = [];
  const refused: string[] = [];
  const locked: string[] = [];
  const gone: string[] = [];
  let sent = 0;
  for (let i = 0; i < items.length && i < outcomes.length; i++) {
    const o = outcomes[i];
    const item = items[i];
    if (o.kind === "retry") break;
    done.add(item.client_event_id);
    if (o.kind === "refused") {
      if (o.reason === "locked") locked.push(item.name);
      else if (o.reason === "gone") gone.push(item.name);
      else refused.push(item.name);
    } else {
      sent += 1;
      if (o.already) already.push(item.name);
    }
  }
  return { done, sent, already, refused, locked, gone };
}

/** True when the server's answer says the party was already in before this
 *  scan (checked in at another door or on another phone). A replay of this
 *  very scan (`replayed`) is not a conflict. */
export function isConflict(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const r = result as { already?: unknown; replayed?: unknown };
  return r.already === true && r.replayed !== true;
}

/**
 * Sends the entries in order and says how each ended. Stops at the first
 * failure that can be retried (a later tap or scan must never overtake an
 * earlier one); a final refusal is recorded and the replay goes on. `send`
 * and `failureOf` are injected so tests run the real loop under node.
 */
export async function replay<T extends { kind?: OutboxKind }>(items: readonly T[], send: (item: T) => Promise<unknown>, failureOf: (err: unknown) => { status: number; code: string } | null): Promise<Outcome[]> {
  const outcomes: Outcome[] = [];
  for (const item of items) {
    const kind: OutboxKind = item.kind === "block_status" ? "block_status" : "checkin";
    try {
      const result = await send(item);
      outcomes.push({ kind: "sent", already: kind === "checkin" && isConflict(result) });
    } catch (err) {
      const o = outcomeFor(classifyFailure(kind, failureOf(err)));
      outcomes.push(o);
      if (o.kind === "retry") break;
    }
  }
  return outcomes;
}

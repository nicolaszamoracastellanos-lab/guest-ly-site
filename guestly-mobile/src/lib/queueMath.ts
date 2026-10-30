// Pure rules of the door check-in queue (HH, Oct 30 2026). No React Native
// imports, so scripts/tests/queue.test.ts runs them under plain node.

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
  | { kind: "refused" } // a final 4xx: the server will never take it (guest removed, wrong wedding)
  | { kind: "retry" }; // offline, timeout, 5xx, 401, 408, 429: keep it

/** What a drain settled: ids to remove from storage, and the names to tell
 *  the door about. Stops at the first `retry` (order matters: a later scan of
 *  the same party must not overtake an earlier one). */
export function settle<T extends { client_event_id: string; name: string }>(items: readonly T[], outcomes: readonly Outcome[]): { done: Set<string>; sent: number; already: string[]; refused: string[] } {
  const done = new Set<string>();
  const already: string[] = [];
  const refused: string[] = [];
  let sent = 0;
  for (let i = 0; i < items.length && i < outcomes.length; i++) {
    const o = outcomes[i];
    const item = items[i];
    if (o.kind === "retry") break;
    done.add(item.client_event_id);
    if (o.kind === "refused") refused.push(item.name);
    else {
      sent += 1;
      if (o.already) already.push(item.name);
    }
  }
  return { done, sent, already, refused };
}

/** True when the server's answer says the party was already in before this
 *  scan (checked in at another door or on another phone). A replay of this
 *  very scan (`replayed`) is not a conflict. */
export function isConflict(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const r = result as { already?: unknown; replayed?: unknown };
  return r.already === true && r.replayed !== true;
}

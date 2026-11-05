// #1 final guest count, the couple's half in the app (1.4.0). Pure, no
// imports, so scripts/tests/finalcount.test.ts runs it under node.
//
// GET /couple/rsvps carries `final_count` only for 1.4.0 with MW_FINAL_COUNT
// on for the wedding; a missing key means "not here" and the card hides.
// The state (locked, overdue, today, soon, upcoming, none) is computed by the
// server in the wedding's zone (K10), never on the phone. Lock and unlock are
// reversible, so they commit at once with Undo (quality bar 5.3), the screen
// first and the previous state back on a refusal (5.2).

export type FinalCountState = "locked" | "none" | "upcoming" | "soon" | "today" | "overdue";

export type MealTotals = { id: string; label: string; options: { id: string; label: string; count: number }[]; no_choice: number };

export type FinalCount = {
  due: string | null;
  state: FinalCountState;
  days: number | null;
  locked_at: string | null;
  locked_by: string | null;
  can_lock: boolean;
  attending: number;
  pending: number;
  meals: MealTotals[];
};

const STATES: FinalCountState[] = ["locked", "none", "upcoming", "soon", "today", "overdue"];
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** The `final_count` of a /couple/rsvps answer, read tolerantly. Null: hide. */
export function readFinalCount(data: unknown): FinalCount | null {
  if (!data || typeof data !== "object") return null;
  const fc = (data as { final_count?: unknown }).final_count;
  if (!fc || typeof fc !== "object") return null;
  const o = fc as Record<string, unknown>;
  const state = STATES.includes(o.state as FinalCountState) ? (o.state as FinalCountState) : o.locked_at ? "locked" : "none";
  const meals = Array.isArray(o.meals)
    ? (o.meals as Record<string, unknown>[])
        .filter((m) => m && typeof m.id === "string")
        .map((m) => ({
          id: m.id as string,
          label: typeof m.label === "string" ? m.label : "",
          options: Array.isArray(m.options) ? (m.options as Record<string, unknown>[]).map((x) => ({ id: String(x.id ?? ""), label: String(x.label ?? ""), count: num(x.count) })) : [],
          no_choice: num(m.no_choice),
        }))
    : [];
  return {
    due: strOrNull(o.due),
    state,
    days: typeof o.days === "number" ? o.days : null,
    locked_at: strOrNull(o.locked_at),
    locked_by: strOrNull(o.locked_by),
    can_lock: o.can_lock === true,
    attending: num(o.attending),
    pending: num(o.pending),
    meals,
  };
}

export type CountBadge = { key: FinalCountState; tone: "green" | "red" | "amber" | "mute"; icon: "lock" | "warning" | "clock" | "calendar"; days: number | null };

/** The badge: always an icon and a word, never color alone. */
export function countBadge(fc: Pick<FinalCount, "state" | "days">): CountBadge {
  switch (fc.state) {
    case "locked":
      return { key: "locked", tone: "green", icon: "lock", days: null };
    case "overdue":
      return { key: "overdue", tone: "red", icon: "warning", days: fc.days };
    case "today":
      return { key: "today", tone: "amber", icon: "clock", days: 0 };
    case "soon":
      return { key: "soon", tone: "amber", icon: "clock", days: fc.days };
    case "upcoming":
      return { key: "upcoming", tone: "mute", icon: "calendar", days: fc.days };
    default:
      return { key: "none", tone: "mute", icon: "calendar", days: null };
  }
}

/** The menu line of one per-person question: "Beef 40, Fish 12, No choice yet 3". */
export function mealLine(m: MealTotals, noChoice: string): string {
  const parts = m.options.filter((o) => o.count > 0).map((o) => `${o.label} ${o.count}`);
  if (m.no_choice > 0) parts.push(`${noChoice} ${m.no_choice}`);
  return parts.join(", ");
}

/** The count as it shows the moment the person taps Lock or Unlock. Unlocking
 *  cannot know the due state the server will compute, so it keeps the one
 *  from before the lock when there is one. */
export function optimisticCount(fc: FinalCount, locked: boolean, nowIso: string, beforeLock?: FinalCount | null): FinalCount {
  if (locked) return { ...fc, state: "locked", days: null, locked_at: fc.locked_at ?? nowIso };
  const prev = beforeLock && beforeLock.state !== "locked" ? beforeLock : null;
  return { ...fc, state: prev ? prev.state : fc.due ? "upcoming" : "none", days: prev ? prev.days : null, locked_at: null, locked_by: null };
}

/** Lock or unlock: the screen first, the server's answer next, the previous
 *  count back on any refusal. The caller refetches afterwards for the
 *  server's own state (who locked, the due state). */
export async function runCountLock(
  before: FinalCount,
  locked: boolean,
  nowIso: string,
  fx: { apply(fc: FinalCount): void; send(): Promise<{ locked?: boolean; locked_at?: string | null } | null> },
  beforeLock?: FinalCount | null,
): Promise<{ ok: true } | { ok: false; err: unknown }> {
  fx.apply(optimisticCount(before, locked, nowIso, beforeLock));
  try {
    const res = await fx.send();
    if (locked && res && typeof res.locked_at === "string") fx.apply({ ...optimisticCount(before, true, nowIso), locked_at: res.locked_at });
    return { ok: true };
  } catch (err) {
    fx.apply(before);
    return { ok: false, err };
  }
}

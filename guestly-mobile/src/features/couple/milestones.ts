// Road to the wedding (#6, Master Wave Nov 2026): the milestone line's pure core.
//
// One line per wedding, the same on the couple's Home, the planner's wedding
// home, the planner's portfolio (its "Stage") and the app. Every milestone is
// DERIVED from what exists (a venue booked, a broadcast sent, the RSVP
// deadline, a lock, the wedding date), never from what was clicked; the one
// exception is "We sent them another way" for paper save the dates and
// invitations, which the caller passes in as a mark.
//
// This file is copied VERBATIM into the app
// (guestly-mobile/src/features/couple/milestones.ts) with the same tests, so it
// imports nothing, touches no runtime API and uses only erasable TypeScript.
// Dates are YYYY-MM-DD strings; "today" is the wedding's day, computed by the
// caller in the wedding's time zone. No Date object is built from a date-only
// string here.

export const MILESTONE_IDS = ["venue", "save_the_dates", "invitations", "replies", "final_count", "timeline", "wedding_day"] as const;
export type MilestoneId = (typeof MILESTONE_IDS)[number];
export type MilestoneState = "done" | "now" | "upcoming";
export type RoadSurface = "couple" | "planner";

/** The milestones a person may mark done by hand ("We sent them another way"). */
export const MARKABLE_IDS = ["save_the_dates", "invitations"] as const;
export type MarkableId = (typeof MARKABLE_IDS)[number];

export function isMarkableId(v: unknown): v is MarkableId {
  return v === "save_the_dates" || v === "invitations";
}

export type RoadInput = {
  /** The wedding date (YYYY-MM-DD), or null. */
  weddingDate: string | null;
  /** Today in the wedding's time zone (YYYY-MM-DD). */
  today: string;
  venueBooked: boolean;
  /** The first save the date / invitation broadcast (an ISO instant or a date), or null. */
  saveTheDatesSentAt: string | null;
  invitationsSentAt: string | null;
  /** "We sent them another way" marks (instant or date), or null. */
  saveTheDatesMarkedAt: string | null;
  invitationsMarkedAt: string | null;
  /** The RSVP deadline guests see (YYYY-MM-DD; free text is ignored), or null. */
  rsvpDeadline: string | null;
  /** Parties on the list and parties still to answer; null when unknown. */
  partiesInvited: number | null;
  partiesPending: number | null;
  /** #1 final count. Null hides the milestone (not available for this wedding). */
  finalCount: { dueDate: string | null; lockedAt: string | null } | null;
  /** #2 timeline lock. Null hides the milestone (not available for this wedding). */
  timeline: { lockedAt: string | null } | null;
};

export type Milestone = {
  id: MilestoneId;
  state: MilestoneState;
  /** A hard date passed and it is not done (replies and final count only). */
  overdue: boolean;
  /** A hard date ("date") or the usual time before the wedding ("usual"); null without a date to show. */
  due: { kind: "date" | "usual"; date: string } | null;
  /** The day it was done (YYYY-MM-DD), when known. */
  doneAt: string | null;
  /** Done only by a hand mark. */
  marked: boolean;
  /** May be marked or unmarked by hand: save the dates and invitations not sent through Guest-ly. */
  markable: boolean;
  /** The screen that moves it forward, for the surface asked for. */
  path: string;
};

export type Road = {
  items: Milestone[];
  /** The first milestone not done after the last one done; null when every one is done or the day has passed. */
  nowId: MilestoneId | null;
  /** The milestone after Now that is not done, or null. */
  nextId: MilestoneId | null;
  done: number;
  total: number;
};

/** Usual timing before the wedding, in months (venue, save the dates, invitations) or days. */
export const USUAL_TIMING = {
  venueMonths: 12,
  saveTheDatesMonths: 8,
  invitationsMonths: 3,
  repliesDays: 30,
  finalCountDays: 10,
  timelineDays: 14,
} as const;

/** Which planner capability a milestone's link needs (the caller checks it). */
export const MILESTONE_CAPABILITY: Record<MilestoneId, "vendors" | "broadcasts" | "guests" | "brain" | "runsheet"> = {
  venue: "vendors",
  save_the_dates: "broadcasts",
  invitations: "broadcasts",
  replies: "guests",
  final_count: "guests",
  timeline: "runsheet",
  wedding_day: "runsheet",
};

const TAB: Record<MilestoneId, string> = {
  venue: "/vendors",
  save_the_dates: "/broadcasts",
  invitations: "/broadcasts",
  replies: "/guests",
  final_count: "/guests",
  timeline: "/runsheet",
  wedding_day: "/runsheet",
};

/** The path for a milestone: the couple tab, or the planner tab scoped to the wedding. */
export function milestonePath(id: MilestoneId, surface: RoadSurface, slug: string, noDeadline = false): string {
  const tab = id === "replies" && noDeadline ? "/brain" : TAB[id];
  return surface === "couple" ? tab : `/planner/w/${encodeURIComponent(slug)}${tab}`;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** The YYYY-MM-DD part of a date or an ISO instant, or null. */
export function dayOf(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const m = DATE_RE.exec(v.trim());
  if (!m) return null;
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function daysInMonth(y: number, m: number): number {
  return [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/** `date` moved by `months` (negative goes back), the day clamped to the month's last day. */
export function addMonths(date: string, months: number): string {
  const m = DATE_RE.exec(date);
  if (!m) return date;
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + months;
  const y = Math.floor(total / 12);
  const mo = (total % 12) + 1;
  const d = Math.min(Number(m[3]), daysInMonth(y, mo));
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/** Days since 1970-01-01 for a YYYY-MM-DD date (calendar arithmetic, no time zone). */
function dayNumber(date: string): number {
  const m = DATE_RE.exec(date);
  if (!m) return 0;
  let y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  y -= mo <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (mo + (mo > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** `date` moved by `days` (negative goes back). */
export function addDays(date: string, days: number): string {
  const z0 = dayNumber(date) + days + 719468;
  const era = Math.floor(z0 / 146097);
  const doe = z0 - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const mo = mp + (mp < 10 ? 3 : -9);
  const y = yoe + era * 400 + (mo <= 2 ? 1 : 0);
  return `${y}-${pad(mo)}-${pad(d)}`;
}

function earliest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

type Draft = Omit<Milestone, "state"> & { done: boolean };

/**
 * Now and Next: the open milestones AFTER the last one done, in line order. A
 * milestone left open before a later one is done (save the dates never sent, the
 * invitations out) has been passed: it is neither Now nor Next (it can still be
 * marked by hand). Once the wedding
 * day has come, nothing is Now. Shared by deriveRoad and the optimistic marks.
 */
export function pickNow<T extends { id: MilestoneId; done: boolean }>(
  line: readonly T[],
  dayCame: boolean
): { nowId: MilestoneId | null; nextId: MilestoneId | null; passed: Set<MilestoneId> } {
  if (dayCame) return { nowId: null, nextId: null, passed: new Set() };
  // Replies count as done once every listed party answered, even with no
  // invitation out (an early website RSVP, an import). That alone never passes
  // the earlier steps: replies anchor the line only after the invitations.
  const invitationsDone = line.some((m) => m.id === "invitations" && m.done);
  let last = -1;
  line.forEach((m, i) => {
    if (!m.done || m.id === "wedding_day") return;
    if (m.id === "replies" && !invitationsDone) return;
    last = i;
  });
  const open = line.filter((m, i) => i > last && !m.done);
  const passed = new Set(line.filter((m, i) => i < last && !m.done).map((m) => m.id));
  return { nowId: open[0]?.id ?? null, nextId: open[1]?.id ?? null, passed };
}

/**
 * The road for one wedding. The first milestone not done after the last one
 * done is Now, the one after it Next (pickNow). Soft milestones never go overdue; only the replies (a deadline
 * passed with parties still to answer) and the final count (its due date
 * passed, not locked) can. Once the wedding day has come, nothing is Now.
 */
export function deriveRoad(input: RoadInput, surface: RoadSurface, slug: string): Road {
  const today = dayOf(input.today) ?? input.today;
  const wedding = dayOf(input.weddingDate);
  const usualMonths = (n: number) => (wedding ? { kind: "usual" as const, date: addMonths(wedding, -n) } : null);
  const usualDays = (n: number) => (wedding ? { kind: "usual" as const, date: addDays(wedding, -n) } : null);
  const out: Draft[] = [];

  out.push({
    id: "venue",
    done: input.venueBooked === true,
    overdue: false,
    due: usualMonths(USUAL_TIMING.venueMonths),
    doneAt: null,
    marked: false,
    markable: false,
    path: milestonePath("venue", surface, slug),
  });

  const sent = (id: MarkableId, sentAt: string | null, markedAt: string | null, months: number) => {
    const s = dayOf(sentAt);
    const k = dayOf(markedAt);
    out.push({
      id,
      done: !!(s || k),
      overdue: false,
      due: usualMonths(months),
      doneAt: earliest(s, k),
      marked: !s && !!k,
      markable: !s,
      path: milestonePath(id, surface, slug),
    });
  };
  sent("save_the_dates", input.saveTheDatesSentAt, input.saveTheDatesMarkedAt, USUAL_TIMING.saveTheDatesMonths);
  sent("invitations", input.invitationsSentAt, input.invitationsMarkedAt, USUAL_TIMING.invitationsMonths);

  const deadline = dayOf(input.rsvpDeadline);
  const pending = input.partiesPending;
  const invited = input.partiesInvited;
  const allAnswered = invited !== null && invited > 0 && pending === 0;
  const closed = !!deadline && today > deadline;
  const repliesDone = allAnswered || (closed && (pending === null || pending === 0));
  out.push({
    id: "replies",
    done: repliesDone,
    overdue: !repliesDone && closed && pending !== null && pending > 0,
    due: deadline ? { kind: "date", date: deadline } : usualDays(USUAL_TIMING.repliesDays),
    doneAt: repliesDone && closed ? deadline : null,
    marked: false,
    markable: false,
    path: milestonePath("replies", surface, slug, !deadline),
  });

  if (input.finalCount) {
    const fcDue = dayOf(input.finalCount.dueDate);
    const locked = dayOf(input.finalCount.lockedAt);
    out.push({
      id: "final_count",
      done: !!locked,
      overdue: !locked && !!fcDue && today > fcDue,
      due: fcDue ? { kind: "date", date: fcDue } : usualDays(USUAL_TIMING.finalCountDays),
      doneAt: locked,
      marked: false,
      markable: false,
      path: milestonePath("final_count", surface, slug),
    });
  }

  if (input.timeline) {
    const locked = dayOf(input.timeline.lockedAt);
    out.push({
      id: "timeline",
      done: !!locked,
      overdue: false,
      due: usualDays(USUAL_TIMING.timelineDays),
      doneAt: locked,
      marked: false,
      markable: false,
      path: milestonePath("timeline", surface, slug),
    });
  }

  const dayCame = !!wedding && today >= wedding;
  out.push({
    id: "wedding_day",
    done: dayCame,
    overdue: false,
    due: wedding ? { kind: "date", date: wedding } : null,
    doneAt: dayCame ? wedding : null,
    marked: false,
    markable: false,
    path: milestonePath("wedding_day", surface, slug),
  });

  const { nowId, nextId, passed } = pickNow(out, dayCame);
  // A step the couple moved past (invitations went out, save the dates never marked)
  // keeps no timing hint and is never overdue: it is not the step to take now.
  const items: Milestone[] = out.map(({ done, ...m }) => ({
    ...m,
    ...(passed.has(m.id) ? { due: null, overdue: false } : {}),
    state: done ? "done" : m.id === nowId ? "now" : "upcoming",
  }));
  return { items, nowId, nextId, done: out.filter((m) => m.done).length, total: out.length };
}

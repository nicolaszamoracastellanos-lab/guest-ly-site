// The wedding-day Now engine (Master Wave, Lane 0). Pure, and it imports
// NOTHING: the app carries this file byte for byte as
// guestly-mobile/src/features/dayof/live.ts, and scripts/check-verbatim-copies.mjs
// fails on a one-character difference. Change it here, then copy it there.
// Only erasable TypeScript (no enums, no namespaces): the app's tests run it
// with node --experimental-strip-types, and Hermes runs it on the phone.
//
// Rules (master prompt, section 8, Phase 1):
// 1. Service day. A wedding night runs until 05:00. A block stored on day D at
//    01:30 happens at 01:30 on the calendar day after D, and a clock that reads
//    01:30 on D+1 is still inside service day D.
// 2. A block without ends_at ends at the next later start on the same service
//    day, capped at 60 minutes. The last block of the night gets 60 minutes.
// 3. Status "done" ends a block, whatever the clock says.
// 4. Overlaps: every block running now is current; the latest start is primary.
// 5. Any day with blocks can be live (rehearsal, brunch), not only the wedding date.
//
// Times stay wall clock in the wedding's own zone (a day plus "HH:MM"). They
// become instants only through Intl with that zone, never through a Date built
// from day + time in the viewer's zone, so a planner abroad sees the venue's
// Now and a daylight saving night keeps true durations. `now` and `timeZone`
// are always passed in: nothing here reads the device clock or the device zone.

/** 05:00: before it, a clock time belongs to the previous evening. */
export const SERVICE_DAY_CUTOFF_MINUTES = 5 * 60;
/** Longest a block without ends_at runs when the next block starts later than this. */
export const OPEN_END_CAP_MINUTES = 60;
/** What the last block of a night gets when it has no ends_at. */
export const LAST_BLOCK_MINUTES = 60;
/** Longest block whose ends_at reads earlier on the clock than its start (20:00 to 08:00). */
export const OVERNIGHT_MAX_MINUTES = 12 * 60;
/** Used when a zone name is unknown to the runtime (the product's default wedding zone). */
export const FALLBACK_TIME_ZONE = "America/La_Paz";

const DAY_MINUTES = 24 * 60;
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export type LiveBlockInput = {
  id: string;
  /** YYYY-MM-DD, the service day the block belongs to (the runsheet's `day`). */
  day: string;
  /** "HH:MM" or "HH:MM:SS", wedding wall clock. */
  starts_at: string;
  ends_at?: string | null;
  /** "planned" | "confirmed" | "done"; only "done" changes the engine's answer. */
  status?: string | null;
  sort_order?: number | null;
};

export type LiveBlockState = "done" | "now" | "next" | "later";
export type LivePhase = "off" | "before" | "live" | "between" | "after";

export type LiveTiming<B extends LiveBlockInput = LiveBlockInput> = {
  block: B;
  /** The block's service day. */
  serviceDay: string;
  /** Minutes into the service day: 17:00 is 1020, 01:30 is 1530. */
  start: number;
  startMs: number;
  endMs: number;
  /** Real minutes from start to end (true on a daylight saving night). */
  minutes: number;
  /** True when the end comes from rule 2 (no usable ends_at). */
  endEstimated: boolean;
};

export type LiveItem<B extends LiveBlockInput = LiveBlockInput> = LiveTiming<B> & { state: LiveBlockState };

/** A "Between: N min" row: the time from one block's end to the next start. */
export type LiveGap = { afterId: string; beforeId: string; startMs: number; endMs: number; minutes: number };

export type LiveState<B extends LiveBlockInput = LiveBlockInput> = {
  timeZone: string;
  now: number;
  /** The wall clock in the wedding's zone. */
  clock: { day: string; minutes: number };
  serviceDay: string;
  phase: LivePhase;
  /** Every block running now, latest start first: current[0] is the primary. */
  current: B[];
  primary: B | null;
  next: B | null;
  /** Whole minutes left in the primary block, rounded up. */
  minutesLeft: number | null;
  /** Whole minutes until the next block starts, rounded up. */
  minutesToNext: number | null;
  /** 0 to 1 through the primary block. */
  progress: number | null;
  /** In a gap: its full length and what is left of it, in whole minutes. */
  gap: { minutes: number; remaining: number } | null;
  /** Today's gaps, for the "Between: N min" rows. */
  gaps: LiveGap[];
  /** Today's blocks in service order (plus any block from another day still running), with their state. */
  items: LiveItem<B>[];
  /** Every block passed in, by id. Days before today read done, days after read later. */
  states: Record<string, LiveBlockState>;
  /** Every service day that has blocks, ascending. */
  days: string[];
  /** The first service day after today that has blocks, or null. */
  nextDay: string | null;
};

// ---------------------------------------------------------------------------
// Wall clock and service day
// ---------------------------------------------------------------------------

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function dayParts(day: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(typeof day === "string" ? day : "");
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return [y, mo, d];
}

/** True for a YYYY-MM-DD string. */
export function isServiceDay(day: unknown): day is string {
  return typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) && dayParts(day) !== null;
}

/** YYYY-MM-DD moved by n calendar days (pure calendar arithmetic, no zone). */
export function addDays(day: string, n: number): string {
  const p = dayParts(day);
  if (!p) return day;
  const t = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}

/** "17:05" or "17:05:00" to minutes after midnight; null when it is not a clock time. */
export function clockMinutes(hhmm: string | null | undefined): number | null {
  if (typeof hhmm !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minutes into the service day: a time before 05:00 counts after the evening (01:30 is 1530). */
export function serviceMinutes(hhmm: string | null | undefined): number | null {
  const m = clockMinutes(hhmm);
  if (m === null) return null;
  return m < SERVICE_DAY_CUTOFF_MINUTES ? m + DAY_MINUTES : m;
}

/** The service day a wall clock belongs to: 01:30 on the 28th is still the 27th. */
export function serviceDayOf(day: string, minutes: number): string {
  return minutes < SERVICE_DAY_CUTOFF_MINUTES ? addDays(day, -1) : day;
}

type Sortable = { day: string; starts_at: string; sort_order?: number | null; id?: string };

/** Service order: day, then service minutes (01:30 after 23:45), then sort_order, then id. */
export function compareServiceOrder(a: Sortable, b: Sortable): number {
  if (a.day !== b.day) return a.day < b.day ? -1 : 1;
  const sa = serviceMinutes(a.starts_at);
  const sb = serviceMinutes(b.starts_at);
  if (sa !== sb) {
    if (sa === null) return 1;
    if (sb === null) return -1;
    return sa - sb;
  }
  const oa = a.sort_order ?? 0;
  const ob = b.sort_order ?? 0;
  if (oa !== ob) return oa - ob;
  const ia = a.id ?? "";
  const ib = b.id ?? "";
  return ia < ib ? -1 : ia > ib ? 1 : 0;
}

/** A sorted copy in service order (the input is left as it is). */
export function sortByServiceOrder<B extends Sortable>(blocks: readonly B[]): B[] {
  return [...blocks].sort(compareServiceOrder);
}

// ---------------------------------------------------------------------------
// Zones (Intl only)
// ---------------------------------------------------------------------------

const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = FORMATTERS.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    FORMATTERS.set(timeZone, f);
  }
  return f;
}

/** The zone itself when the runtime knows it, else FALLBACK_TIME_ZONE. */
export function usableTimeZone(timeZone: string | null | undefined): string {
  if (typeof timeZone === "string" && timeZone.length > 0 && timeZone.length <= 64) {
    try {
      formatter(timeZone);
      return timeZone;
    } catch {
      // Unknown zone name: fall through to the default.
    }
  }
  return FALLBACK_TIME_ZONE;
}

type Fields = { y: number; mo: number; d: number; h: number; mi: number; s: number };

function fieldsAt(timeZone: string, ms: number): Fields {
  const f = formatter(timeZone);
  const date = new Date(ms);
  if (typeof f.formatToParts === "function") {
    const v: Record<string, number> = {};
    for (const p of f.formatToParts(date)) {
      if (p.type !== "literal") v[p.type] = Number(p.value);
    }
    return { y: v.year ?? 0, mo: v.month ?? 1, d: v.day ?? 1, h: (v.hour ?? 0) % 24, mi: v.minute ?? 0, s: v.second ?? 0 };
  }
  // Engines without formatToParts: en-US numeric reads "11/27/2026, 17:05:09".
  const m = /(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+):(\d+)/.exec(f.format(date));
  if (!m) return { y: 1970, mo: 1, d: 1, h: 0, mi: 0, s: 0 };
  return { y: Number(m[3]), mo: Number(m[1]), d: Number(m[2]), h: Number(m[4]) % 24, mi: Number(m[5]), s: Number(m[6]) };
}

/** UTC offset of a zone at an instant, in minutes (east positive). */
export function zoneOffsetMinutes(timeZone: string, ms: number): number {
  const x = fieldsAt(usableTimeZone(timeZone), ms);
  const asUtc = Date.UTC(x.y, x.mo - 1, x.d, x.h, x.mi, x.s);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / MINUTE_MS);
}

/** The wall clock of an instant in a zone: the calendar day and whole minutes after midnight. */
export function wallClockAt(ms: number, timeZone: string): { day: string; minutes: number } {
  const x = fieldsAt(usableTimeZone(timeZone), ms);
  return { day: `${x.y}-${pad2(x.mo)}-${pad2(x.d)}`, minutes: x.h * 60 + x.mi };
}

/**
 * The instant of a wall clock in a zone. `minutes` may run past 24:00 (service
 * minutes: 1530 on day D is 01:30 on D+1). A time the clocks skip (spring
 * forward) is read as the instant just after the jump; a time that happens
 * twice (fall back) is its first occurrence. Null for a malformed day.
 */
export function instantOf(day: string, minutes: number, timeZone: string): number | null {
  const p = dayParts(day);
  if (!p || !Number.isFinite(minutes)) return null;
  const tz = usableTimeZone(timeZone);
  const local = Date.UTC(p[0], p[1] - 1, p[2]) + Math.round(minutes * MINUTE_MS);
  const before = local - zoneOffsetMinutes(tz, local - DAY_MS) * MINUTE_MS;
  const after = local - zoneOffsetMinutes(tz, local + DAY_MS) * MINUTE_MS;
  const fits = (t: number) => t + zoneOffsetMinutes(tz, t) * MINUTE_MS === local;
  const okBefore = fits(before);
  const okAfter = fits(after);
  if (okBefore && okAfter) return Math.min(before, after);
  if (okBefore) return before;
  if (okAfter) return after;
  return before;
}

// ---------------------------------------------------------------------------
// Timings
// ---------------------------------------------------------------------------

function isDone(b: LiveBlockInput): boolean {
  return typeof b.status === "string" && b.status.toLowerCase() === "done";
}

/**
 * ends_at as minutes into the start's service day, always after `start`. A
 * clock time at or before the start is read on the next calendar day (22:00
 * to 06:00 ends at 1800; 04:30 to 06:00 also ends at 1800), as long as that
 * makes the block at most OVERNIGHT_MAX_MINUTES long. A longer wrap (18:00 to
 * 17:00, or the same clock time as the start) is a typing slip: null, and
 * rule 2 gives the block its end.
 */
function endMinutes(start: number, endsAt: string | null): number | null {
  const clock = clockMinutes(endsAt);
  if (clock === null) return null;
  const sameDay = clock < SERVICE_DAY_CUTOFF_MINUTES ? clock + DAY_MINUTES : clock;
  if (sameDay > start) return sameDay;
  let end = clock;
  while (end <= start) end += DAY_MINUTES;
  return end - start <= OVERNIGHT_MAX_MINUTES ? end : null;
}

/**
 * Start and end of every block that has a readable day and start, in service
 * order. An ends_at at or before the start on the clock is read on the next
 * calendar day (a 22:00 to 06:00 party runs all night, see endMinutes).
 * Rule 2 lives here: no usable ends_at (missing, malformed, or a wrap longer
 * than OVERNIGHT_MAX_MINUTES) means the next later start on the same service
 * day, capped at 60 real minutes, and 60 minutes for the last block of the
 * night.
 */
export function timingsFor<B extends LiveBlockInput>(blocks: readonly B[], timeZone: string): LiveTiming<B>[] {
  const tz = usableTimeZone(timeZone);
  const rows: { block: B; day: string; start: number; end: number | null; startMs: number }[] = [];
  for (const block of sortByServiceOrder(blocks)) {
    if (!isServiceDay(block.day)) continue;
    const start = serviceMinutes(block.starts_at);
    if (start === null) continue;
    const startMs = instantOf(block.day, start, tz);
    if (startMs === null) continue;
    rows.push({ block, day: block.day, start, end: endMinutes(start, block.ends_at ?? null), startMs });
  }
  const out: LiveTiming<B>[] = [];
  rows.forEach((r, i) => {
    let endMs: number | null = null;
    let estimated = false;
    if (r.end !== null) endMs = instantOf(r.day, r.end, tz);
    if (endMs === null || endMs <= r.startMs) {
      estimated = true;
      let nextStart: number | null = null;
      for (const later of rows.slice(i + 1)) {
        if (later.day !== r.day) break;
        if (later.start > r.start) {
          nextStart = later.startMs;
          break;
        }
      }
      const capped = r.startMs + (nextStart === null ? LAST_BLOCK_MINUTES : OPEN_END_CAP_MINUTES) * MINUTE_MS;
      endMs = nextStart === null ? capped : Math.min(nextStart, capped);
    }
    out.push({
      block: r.block,
      serviceDay: r.day,
      start: r.start,
      startMs: r.startMs,
      endMs,
      minutes: Math.round((endMs - r.startMs) / MINUTE_MS),
      endEstimated: estimated,
    });
  });
  return out;
}

/** Gaps between one block's end and the next start on the same service day (overlaps leave none). */
export function gapsFor<B extends LiveBlockInput>(timings: readonly LiveTiming<B>[]): LiveGap[] {
  const out: LiveGap[] = [];
  let day: string | null = null;
  let coveredUntil = 0;
  let coveredBy = "";
  for (const t of timings) {
    if (t.serviceDay !== day) {
      day = t.serviceDay;
      coveredUntil = t.endMs;
      coveredBy = t.block.id;
      continue;
    }
    const minutes = Math.round((t.startMs - coveredUntil) / MINUTE_MS);
    if (minutes >= 1) out.push({ afterId: coveredBy, beforeId: t.block.id, startMs: coveredUntil, endMs: t.startMs, minutes });
    if (t.endMs > coveredUntil) {
      coveredUntil = t.endMs;
      coveredBy = t.block.id;
    }
  }
  return out;
}

function ceilMinutes(ms: number): number {
  return Math.max(0, Math.ceil(ms / MINUTE_MS - 1e-9));
}

// ---------------------------------------------------------------------------
// Now and Next
// ---------------------------------------------------------------------------

/**
 * Now and Next for a runsheet at an instant, in the wedding's zone.
 * `now` is epoch milliseconds (the server's clock, or the device clock
 * corrected by the server offset); `timeZone` is the wedding's zone.
 */
export function liveState<B extends LiveBlockInput>(
  blocks: readonly B[],
  at: { now: number; timeZone: string }
): LiveState<B> {
  const timeZone = usableTimeZone(at.timeZone);
  const now = at.now;
  const clock = wallClockAt(now, timeZone);
  const serviceDay = serviceDayOf(clock.day, clock.minutes);
  const timings = timingsFor(blocks, timeZone);

  const running = timings
    .filter((t) => !isDone(t.block) && t.startMs <= now && now < t.endMs)
    .sort((a, b) => b.startMs - a.startMs || compareServiceOrder(b.block, a.block));
  const today = timings.filter((t) => t.serviceDay === serviceDay);
  const upcoming = today.filter((t) => !isDone(t.block) && t.startMs > now);
  const nextT = upcoming.length ? upcoming.reduce((a, b) => (b.startMs < a.startMs ? b : a)) : null;
  const primaryT = running.length ? running[0] : null;

  let phase: LivePhase;
  if (primaryT) phase = "live";
  else if (nextT) phase = today.some((t) => t.startMs <= now) ? "between" : "before";
  else phase = today.length ? "after" : "off";

  const runningIds = new Set(running.map((t) => t.block.id));
  const stateOf = (t: LiveTiming<B>): LiveBlockState => {
    if (isDone(t.block)) return "done";
    if (runningIds.has(t.block.id)) return "now";
    if (nextT && t.block.id === nextT.block.id) return "next";
    return t.endMs <= now ? "done" : "later";
  };

  const states: Record<string, LiveBlockState> = {};
  for (const b of blocks) states[b.id] = isDone(b) ? "done" : "later";
  for (const t of timings) states[t.block.id] = stateOf(t);

  const items: LiveItem<B>[] = [];
  for (const t of running) if (t.serviceDay !== serviceDay) items.push({ ...t, state: "now" });
  for (const t of today) items.push({ ...t, state: stateOf(t) });

  let gap: LiveState<B>["gap"] = null;
  if (phase === "between" && nextT) {
    let lastEnd = 0;
    for (const t of today) if (t.startMs <= now && t.endMs > lastEnd) lastEnd = t.endMs;
    const from = Math.min(lastEnd, now);
    gap = { minutes: ceilMinutes(nextT.startMs - from), remaining: ceilMinutes(nextT.startMs - now) };
  }

  const days: string[] = [];
  for (const t of timings) if (days[days.length - 1] !== t.serviceDay && !days.includes(t.serviceDay)) days.push(t.serviceDay);
  days.sort();
  const nextDay = days.find((d) => d > serviceDay) ?? null;

  return {
    timeZone,
    now,
    clock,
    serviceDay,
    phase,
    current: running.map((t) => t.block),
    primary: primaryT ? primaryT.block : null,
    next: nextT ? nextT.block : null,
    minutesLeft: primaryT ? ceilMinutes(primaryT.endMs - now) : null,
    minutesToNext: nextT ? ceilMinutes(nextT.startMs - now) : null,
    progress: primaryT ? Math.min(1, Math.max(0, (now - primaryT.startMs) / (primaryT.endMs - primaryT.startMs))) : null,
    gap,
    gaps: gapsFor(today),
    items,
    states,
    days,
    nextDay,
  };
}

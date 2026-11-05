// #3 Live wedding-day mode, the app's side (Master Wave, 1.4.0, MW_LIVE_DAY).
// The portal sends `live` (src/lib/mobile/live-day.ts) on GET /couple/dayof and
// one per wedding in GET /planner/agenda `live[]`, only to app 1.4.0 and up
// and only for weddings with the flag on. Each answer is the server's Now and
// Next at `server_now`; the app keeps them moving with the verbatim engine
// (./live.ts), the device clock corrected by the server offset, so a phone set
// to the wrong time or zone still shows the venue's Now.
//
// D2: alexnico2026 never shows the live mode in this build, whatever the
// server sends (LIVE_DAY_NEVER).
//
// Pure: no React, no network. scripts/tests/live-day-app.test.ts runs it.

import { liveState, usableTimeZone, zoneOffsetMinutes, type LiveBlockInput, type LivePhase } from "./live";

export const LIVE_DAY_FLAG = "MW_LIVE_DAY";

/** Weddings that never get the live mode in this build (D2: Nicolas's own wedding, Nov 27). */
export const LIVE_DAY_NEVER: readonly string[] = ["alexnico2026"];

export function liveDayAllowed(slug: string | null | undefined): boolean {
  return typeof slug === "string" && !!slug && !LIVE_DAY_NEVER.includes(slug);
}

export type LiveBlock = { id: string; title: string; startsAt: string; endsAt: string | null; location: string | null };

export type ServerLive = {
  /** Epoch ms of the server's answer. */
  serverNow: number;
  timeZone: string;
  serviceDay: string;
  phase: LivePhase;
  current: (LiveBlock & { minutesLeft: number; progress: number })[];
  next: (LiveBlock & { minutesToNext: number }) | null;
  gap: { minutes: number; remaining: number } | null;
};

export type WeddingLive = { slug: string; names: string; live: ServerLive };

const PHASES: readonly LivePhase[] = ["off", "before", "live", "between", "after"];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK_RE = /^\d{1,2}:\d{2}/;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function readBlock(raw: unknown): LiveBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  const title = str(r.title);
  const startsAt = str(r.starts_at);
  if (!id || !title || !startsAt || !CLOCK_RE.test(startsAt)) return null;
  const endsAt = str(r.ends_at);
  return { id, title, startsAt, endsAt: endsAt && CLOCK_RE.test(endsAt) ? endsAt : null, location: str(r.location) };
}

/** The `live` object of a day-of answer, or null (no key: flag off, a build below 1.4.0, or garbage). */
export function readLive(raw: unknown): ServerLive | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const serverNow = typeof r.server_now === "string" ? Date.parse(r.server_now) : NaN;
  const serviceDay = str(r.service_day);
  if (!Number.isFinite(serverNow) || !serviceDay || !DAY_RE.test(serviceDay)) return null;
  const current: ServerLive["current"] = [];
  if (Array.isArray(r.current)) {
    for (const c of r.current) {
      const b = readBlock(c);
      if (!b || current.some((x) => x.id === b.id)) continue;
      const o = c as Record<string, unknown>;
      current.push({ ...b, minutesLeft: Math.max(0, num(o.minutes_left) ?? 0), progress: Math.min(1, Math.max(0, num(o.progress) ?? 0)) });
    }
  }
  const nb = readBlock(r.next);
  const next = nb ? { ...nb, minutesToNext: Math.max(0, num((r.next as Record<string, unknown>).minutes_to_next) ?? 0) } : null;
  const g = r.gap && typeof r.gap === "object" ? (r.gap as Record<string, unknown>) : null;
  const gap = g && num(g.minutes) !== null && num(g.remaining) !== null ? { minutes: num(g.minutes)!, remaining: num(g.remaining)! } : null;
  return {
    serverNow,
    timeZone: usableTimeZone(str(r.time_zone)),
    serviceDay,
    phase: PHASES.includes(r.phase as LivePhase) ? (r.phase as LivePhase) : "off",
    current,
    next,
    gap,
  };
}

/** GET /planner/agenda `live[]`: the weddings live today this build may show, or null (no key). */
export function readLiveList(raw: unknown): WeddingLive[] | null {
  if (!Array.isArray(raw)) return null;
  const out: WeddingLive[] = [];
  for (const it of raw) {
    if (!it || typeof it !== "object") continue;
    const r = it as Record<string, unknown>;
    const slug = str(r.wedding_slug);
    const live = readLive(it);
    if (!slug || !live || !liveDayAllowed(slug) || out.some((x) => x.slug === slug)) continue;
    out.push({ slug, names: str(r.couple_names) ?? slug, live });
  }
  return out;
}

/** Server clock minus device clock, from the answer's server_now and when the phone received it. */
export function clockOffset(serverNow: number, receivedAt: number): number {
  return Number.isFinite(serverNow) && Number.isFinite(receivedAt) && receivedAt > 0 ? serverNow - receivedAt : 0;
}

/** The blocks the answer names (running and next), as engine input on its service day. */
export function liveBlocks(live: ServerLive): LiveBlockInput[] {
  const out: LiveBlockInput[] = [];
  for (const b of [...live.current, ...(live.next ? [live.next] : [])]) {
    if (out.some((x) => x.id === b.id)) continue;
    out.push({ id: b.id, day: live.serviceDay, starts_at: b.startsAt, ends_at: b.endsAt });
  }
  return out;
}

export type LiveLine =
  | { kind: "now"; title: string; minutes: number; more: number; next: LiveBlock | null; nextAt: number | null }
  | { kind: "between"; minutes: number; next: LiveBlock; nextAt: number | null }
  | { kind: "before"; next: LiveBlock; nextAt: number | null }
  | { kind: "wrap" }
  /** The answer's moments are over but the day is not: wait for the next refresh. */
  | { kind: "stale" };

/**
 * One wedding's Now line at `now` (server-corrected epoch ms): recomputed
 * with the engine from the blocks the answer names, so minutes tick and the
 * next moment takes over at its start without a request. Past what the
 * answer knows (its next moment has ended too) the line says it waits for
 * the next refresh, never a wrong Now or a wrong "That's a wrap".
 */
export function liveLine(live: ServerLive, now: number): LiveLine {
  const blocks = liveBlocks(live);
  const titles = new Map([...live.current, ...(live.next ? [live.next] : [])].map((b) => [b.id, b] as const));
  if (!blocks.length) return { kind: "wrap" };
  const s = liveState(blocks, { now, timeZone: live.timeZone });
  const nextT = s.next ? s.items.find((i) => i.block.id === s.next!.id) : null;
  const nextAt = nextT ? nextT.startMs : null;
  const nextBlock = s.next ? titles.get(s.next.id) ?? null : null;
  if (s.primary) {
    const p = titles.get(s.primary.id);
    if (p) return { kind: "now", title: p.title, minutes: s.minutesLeft ?? 0, more: s.current.length - 1, next: nextBlock, nextAt };
  }
  if (nextBlock && s.phase === "between") return { kind: "between", minutes: s.gap?.remaining ?? s.minutesToNext ?? 0, next: nextBlock, nextAt };
  if (nextBlock && s.phase === "before") return { kind: "before", next: nextBlock, nextAt };
  if (live.phase === "after" || live.phase === "off") return { kind: "wrap" };
  return { kind: "stale" };
}

/** Rows sorted by the next start (soonest first), wrapped weddings last, then by names. */
export function sortLive<R extends { names: string; line: LiveLine }>(rows: readonly R[]): R[] {
  const key = (r: R) => (r.line.kind === "wrap" ? Number.POSITIVE_INFINITY : r.line.kind === "stale" ? Number.MAX_SAFE_INTEGER : r.line.nextAt ?? Number.MAX_SAFE_INTEGER);
  return [...rows].sort((a, b) => key(a) - key(b) || a.names.localeCompare(b.names));
}

/**
 * Minutes the venue is ahead (+) or behind (-) the phone at `now`; 0 when
 * they match. `deviceOffset` is the phone's UTC offset in minutes (east
 * positive, the opposite sign of Date#getTimezoneOffset).
 */
export function venueDiffMinutes(timeZone: string, now: number, deviceOffset: number): number {
  try {
    return zoneOffsetMinutes(usableTimeZone(timeZone), now) - deviceOffset;
  } catch {
    return 0;
  }
}

/** "1 h", "1 h 30 min", "45 min" pieces for a zone difference (absolute). */
export function diffParts(minutes: number): { h: number; m: number } {
  const a = Math.abs(Math.round(minutes));
  return { h: Math.floor(a / 60), m: a % 60 };
}

/** A row of GET /couple/dayof `runsheet` (one service day, server states at fetch time). */
export type DayofRow = { id: string; title: string; starts_at: string; ends_at: string | null; location: string | null; owner: string | null; state: string };

export type DayofBlock = LiveBlockInput & { title: string; location: string | null; owner: string | null };

/**
 * The couple day-of list as engine input on `day`: a row the server already
 * read as done stays done; `overlay` holds taps not answered yet (block id to
 * status), last tap wins. Rows without a usable time are left out.
 */
export function dayofBlocks(rows: readonly DayofRow[], day: string, overlay: Readonly<Record<string, string>> = {}): DayofBlock[] {
  const out: DayofBlock[] = [];
  rows.forEach((r, i) => {
    if (!r || typeof r.id !== "string" || typeof r.starts_at !== "string" || !CLOCK_RE.test(r.starts_at)) return;
    const status = overlay[r.id] ?? (r.state === "done" ? "done" : null);
    out.push({ id: r.id, day, starts_at: r.starts_at, ends_at: r.ends_at && CLOCK_RE.test(r.ends_at) ? r.ends_at : null, status, sort_order: i, title: r.title, location: r.location, owner: r.owner });
  });
  return out;
}

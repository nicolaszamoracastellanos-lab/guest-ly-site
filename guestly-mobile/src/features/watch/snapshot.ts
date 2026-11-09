// Pure builders: view objects in, WatchSnapshot out. No hooks, no fetch, no
// React Native, so scripts/tests/watch-snapshot.test.ts runs them under node.
//
// Privacy: nothing here reads a phone number or e-mail except a vendor's phone
// for the COUPLE role (their own vendors, for tap-to-call). Planner and guest
// snapshots carry names and counts only.

import qrcode from "qrcode-generator";
import { WATCH_COPY, type WatchCopy } from "./copy";
import type { BlockIn, CoupleIn, DayOfBlockIn, GuestIn, PlannerIn, VendorIn, WatchLang, WatchSnapshot } from "./types";

const OVERRUN_GRACE_MIN = 5;

/** Wedding slugs the watch is never on for (rule D2, same list as live day). */
export const WATCH_NEVER = ["alexnico2026"];

export function emptySnapshot(lang: WatchLang, nowMs: number, enabled = true): WatchSnapshot {
  return { v: 1, at: nowMs, lang, enabled, role: "none", wedding: null, replies: null, tasks: null, budget: null, team: null, dayOf: null, door: null, vendorsToday: null, weddings: null, needsYou: null, pass: null, myDay: null };
}

// ---------------------------------------------------------------- helpers

function parseDay(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

const locale = (lang: WatchLang) => (lang === "es" ? "es-BO" : "en-GB");

/** "21 Mar 2027" / "21 mar 2027", never shifted by a timezone. */
export function dateText(iso: string | null | undefined, lang: WatchLang): string {
  const d = parseDay(iso);
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat(locale(lang), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d).replace(/\./g, "");
  } catch {
    return iso!.slice(0, 10);
  }
}

function shortDate(iso: string, lang: WatchLang): string {
  const d = parseDay(iso);
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat(locale(lang), { day: "numeric", month: "short", timeZone: "UTC" }).format(d).replace(/\./g, "");
  } catch {
    return iso;
  }
}

function weekday(iso: string, lang: WatchLang): string {
  const d = parseDay(iso);
  if (!d) return "";
  try {
    const s = new Intl.DateTimeFormat(locale(lang), { weekday: "long", timeZone: "UTC" }).format(d);
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return iso;
  }
}

/** Minutes since local midnight of an instant (device time zone). */
function localMinutes(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

function localIso(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function hm(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** "HH:MM" or "HH:MM:SS" to minutes; NaN when malformed. */
export function minutesOf(t: string | null | undefined): number {
  const m = (t ?? "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

function addMinutes(t: string, add: number): string {
  const total = minutesOf(t) + add;
  const w = ((total % 1440) + 1440) % 1440;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(w / 60))}:${p(w % 60)}`;
}

/** Due text from the days left: Due today, Due tomorrow, Due Friday, Due 4 Dec, Overdue. */
function dueText(daysLeft: number | null, dueIso: string | null, c: WatchCopy, lang: WatchLang): string {
  if (daysLeft === null || !dueIso) return "";
  if (daysLeft < 0) return c.overdue;
  if (daysLeft === 0) return c.due(c.today.toLowerCase());
  if (daysLeft === 1) return c.due(c.tomorrow.toLowerCase());
  if (daysLeft <= 6) return c.due(weekday(dueIso, lang));
  return c.due(shortDate(dueIso, lang));
}

function money(amount: number, currency: string, lang: WatchLang): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(lang === "es" ? "es-BO" : "en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(safe);
  } catch {
    return `${currency} ${Math.round(safe)}`;
  }
}

/** E.164-ish: keep a leading "+" and the digits, nothing else. */
export function telOf(phone: string | null | undefined): string {
  const raw = (phone ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 6) return "";
  return raw.startsWith("+") ? `+${digits}` : digits;
}

/** The QR matrix of a string as rows of "0" and "1" (square). */
export function qrRows(content: string): string[] {
  const qr = qrcode(0, "M");
  qr.addData(content);
  qr.make();
  const n = qr.getModuleCount();
  const rows: string[] = [];
  for (let y = 0; y < n; y++) {
    let r = "";
    for (let x = 0; x < n; x++) r += qr.isDark(y, x) ? "1" : "0";
    rows.push(r);
  }
  return rows;
}

function weddingBlock(names: string, iso: string | null, countdown: { days: number; passed: boolean } | null, isDayOf: boolean, lang: WatchLang) {
  return { names, dateText: dateText(iso, lang), days: countdown ? (countdown.passed ? 0 : Math.max(0, countdown.days)) : 0, passed: countdown?.passed ?? false, isDayOf };
}

// ---------------------------------------------------------------- day of

function leftMinutes(b: DayOfBlockIn, nowMs: number): number | null {
  const end = minutesOf(b.ends_at);
  if (Number.isNaN(end)) return null;
  return Math.max(0, end - localMinutes(nowMs));
}

function nowFraction(b: DayOfBlockIn, nowMs: number): number | null {
  const s = minutesOf(b.starts_at), e = minutesOf(b.ends_at);
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return null;
  return Math.min(1, Math.max(0, (localMinutes(nowMs) - s) / (e - s)));
}

function buildDayOf(runsheet: DayOfBlockIn[], nowMs: number, c: WatchCopy, overrun: NonNullable<WatchSnapshot["dayOf"]>["overrun"]) {
  const now = runsheet.find((b) => b.state === "now") ?? null;
  const upcoming = runsheet.filter((b) => b.state === "next" || b.state === "later");
  const left = now ? leftMinutes(now, nowMs) : null;
  return {
    now: now
      ? { title: now.title, line: [now.starts_at.slice(0, 5), now.location].filter(Boolean).join(" · "), leftText: left === null ? "" : c.minLeft(left), fraction: nowFraction(now, nowMs) }
      : null,
    next: upcoming.slice(0, 3).map((b) => ({ time: b.starts_at.slice(0, 5), title: b.title })),
    overrun,
  };
}

/** The block still in progress past its end (not marked done) while a later one waits today. */
export function findOverrun(blocks: BlockIn[], nowMs: number): { over: BlockIn; next: BlockIn } | null {
  const today = localIso(nowMs);
  const day = blocks.filter((b) => b.day.slice(0, 10) === today).sort((a, b) => minutesOf(a.starts_at) - minutesOf(b.starts_at));
  const nowMin = localMinutes(nowMs);
  for (const b of day) {
    const end = minutesOf(b.ends_at);
    if (b.status === "done" || Number.isNaN(end) || end + OVERRUN_GRACE_MIN > nowMin) continue;
    // The next block is the first one that starts after this one ends and is still to come.
    const next = day.find((x) => x.id !== b.id && x.status !== "done" && minutesOf(x.starts_at) >= end);
    if (next) return { over: b, next };
  }
  return null;
}

function buildVendorsToday(blocks: BlockIn[], vendors: VendorIn[], nowMs: number, c: WatchCopy, withTel: boolean): NonNullable<WatchSnapshot["vendorsToday"]> | null {
  const today = localIso(nowMs);
  const nowMin = localMinutes(nowMs);
  const rows = blocks.filter((b) => b.vendor_id && b.day.slice(0, 10) === today).sort((a, b) => minutesOf(a.starts_at) - minutesOf(b.starts_at));
  if (!rows.length) return null;
  const byId = new Map(vendors.map((v) => [v.id, v]));
  const items = rows.map((b) => {
    const start = minutesOf(b.starts_at);
    const onsite = b.status === "done";
    const late = !onsite && !Number.isNaN(start) && nowMin > start;
    const state: "onsite" | "due" | "late" = onsite ? "onsite" : late ? "late" : "due";
    const note = onsite ? c.onSite : late ? c.late(nowMin - start) : c.dueAt(b.starts_at.slice(0, 5));
    const tel = withTel ? telOf(byId.get(b.vendor_id as string)?.phone) : "";
    return { blockId: b.id, name: b.vendor_name || byId.get(b.vendor_id as string)?.name || b.title, note, state, ...(tel ? { tel } : {}) };
  });
  const order = { late: 0, due: 1, onsite: 2 } as const;
  items.sort((a, b) => order[a.state] - order[b.state]);
  const inCount = items.filter((i) => i.state === "onsite").length;
  return { summary: c.onSiteSummary(inCount, items.length), items: items.slice(0, 6) };
}

// ---------------------------------------------------------------- couple

export function buildCoupleSnapshot(i: CoupleIn, lang: WatchLang): WatchSnapshot {
  const c = WATCH_COPY[lang];
  const s = emptySnapshot(lang, i.nowMs);
  s.role = "couple";
  const home = i.home;
  const isDayOf = !!(home?.day_of || i.dayof?.day_of);
  if (home) {
    s.wedding = weddingBlock(home.couple_names, home.wedding_date, home.countdown, isDayOf, lang);
    const t = home.totals;
    const going = t.attending_seats, declined = t.declined_seats;
    s.replies = { going, declined, pending: Math.max(0, t.people_expected - going - declined), total: t.people_expected };
  }

  if (i.tasks) {
    const open = i.tasks.tasks
      .filter((t) => t.status !== "done")
      .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
    const doneLatest = i.tasks.tasks.filter((t) => t.status === "done").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))[0];
    const items = open.slice(0, 3).map((t) => {
      const note = dueText(t.days_left, t.due_date, c, lang);
      return { id: t.id, title: t.title, note, urgent: t.days_left !== null && t.days_left <= 0, done: false };
    });
    if (items.length < 3 && doneLatest) {
      const at = doneLatest.completed_at ? new Date(doneLatest.completed_at) : null;
      const sameDay = at && !Number.isNaN(at.getTime()) && localIso(at.getTime()) === localIso(i.nowMs);
      items.push({ id: doneLatest.id, title: doneLatest.title, note: sameDay ? c.doneAt(hm(at.getTime())) : c.done, urgent: false, done: true });
    }
    s.tasks = { done: i.tasks.progress.done, total: i.tasks.progress.total, items };
  }

  if (i.budget && i.budget.total > 0) {
    let next: NonNullable<WatchSnapshot["budget"]>["next"] = null;
    const pays = (i.vendors?.items ?? []).filter((it) => it.next_payment).map((it) => ({ it, p: it.next_payment! })).sort((a, b) => a.p.on.localeCompare(b.p.on));
    if (pays.length) {
      const { it, p } = pays[0];
      const vendor = i.vendors?.vendors.find((v) => v.id === it.vendor_id);
      const days = Math.round(((parseDay(p.on)?.getTime() ?? 0) - (parseDay(localIso(i.nowMs))?.getTime() ?? 0)) / 86_400_000);
      next = { name: vendor?.name ?? it.title, amountText: money(p.amount, p.currency ?? i.budget.currency, lang), dueText: dueText(days, p.on, c, lang) };
    }
    s.budget = { paidText: money(i.budget.paid, i.budget.currency, lang), totalText: money(i.budget.total, i.budget.currency, lang), fraction: Math.min(1, Math.max(0, i.budget.fraction)), next };
  }

  if (i.vendors) {
    const rank = (v: VendorIn) => (v.status === "booked" ? 0 : v.status === "done" ? 1 : 2);
    const withPhone = i.vendors.vendors.filter((v) => telOf(v.phone) && v.status !== "cancelled" && v.status !== "shortlist").sort((a, b) => rank(a) - rank(b));
    s.team = withPhone.slice(0, 6).map((v) => ({ name: c.categories[v.category] ?? c.categories.other, note: v.contact_name || v.name, tel: telOf(v.phone) }));
  }

  if (isDayOf) {
    const blocks = i.blocks ?? [];
    const ov = findOverrun(blocks, i.nowMs);
    let overrun: NonNullable<WatchSnapshot["dayOf"]>["overrun"] = null;
    if (ov) {
      const moved = addMinutes(ov.next.starts_at.slice(0, 5), 15);
      overrun = { blockId: ov.next.id, question: c.overrunQuestion(ov.next.title), body: c.overrunBody(ov.over.title, ov.next.title, moved), pushLabel: c.pushLabel, keepLabel: c.keepLabel(ov.next.starts_at.slice(0, 5)) };
    }
    if (i.dayof) s.dayOf = buildDayOf(i.dayof.runsheet, i.nowMs, c, overrun);
    if (i.dayof) {
      const last = i.lastArrival;
      s.door = { inCount: i.dayof.seats_in, total: i.dayof.seats_total, lastText: last ? [c.lastIn(last.name), last.table ? c.table(last.table) : ""].filter(Boolean).join(" · ") : null };
    }
    s.vendorsToday = buildVendorsToday(blocks, i.vendors?.vendors ?? [], i.nowMs, c, true);
  }

  const needs = (i.inbox ?? []).filter((m) => m.needs_you).slice(0, 3);
  s.needsYou = needs.length ? needs.map((m) => ({ id: m.id, from: c.asks(m.name), question: m.preview, canReply: m.channel !== "whatsapp" })) : null;
  return s;
}

// ---------------------------------------------------------------- planner

export function buildPlannerSnapshot(i: PlannerIn, lang: WatchLang): WatchSnapshot {
  const c = WATCH_COPY[lang];
  const s = emptySnapshot(lang, i.nowMs);
  s.role = "planner";
  // The portal reports a wedding already held as 0 days (passed: true), so a
  // zero alone does not mean today: the date decides, `passed` rules a held one out.
  const todayIso = localIso(i.nowMs);
  const isToday = (w: { wedding_date: string | null; days_to_go: number | null; passed?: boolean }) =>
    (w.wedding_date ?? "").slice(0, 10) === todayIso || (w.days_to_go === 0 && !w.passed);
  const weds = (i.weddings ?? []).filter((w) => !w.passed || isToday(w));
  const live = weds.find(isToday);
  const next = live ?? weds.find((w) => w.days_to_go !== null && w.days_to_go > 0) ?? weds[0];
  const isDayOf = !!live;

  if (next) s.wedding = weddingBlock(next.couple_names, next.wedding_date, next.days_to_go === null ? null : { days: next.days_to_go, passed: !!next.passed }, isDayOf, lang);

  s.weddings = weds.slice(0, 5).map((w) => {
    const label = isToday(w) ? c.today : w.days_to_go !== null && w.days_to_go <= 6 && w.wedding_date ? weekday(w.wedding_date, lang) : w.wedding_date ? shortDate(w.wedding_date, lang) : "";
    const seatsLine = w.seats && w.seats.invited ? `${w.seats.attending + w.seats.declined} / ${w.seats.invited}` : "";
    const line = isToday(w) && w.seats ? "" : [seatsLine, w.open_requests ? (lang === "es" ? (w.open_requests === 1 ? "1 solicitud abierta" : `${w.open_requests} solicitudes abiertas`) : (w.open_requests === 1 ? "1 open request" : `${w.open_requests} open requests`)) : ""].filter(Boolean).join(" · ");
    return { label, names: w.couple_names, line, today: isToday(w) };
  });
  if (!s.weddings.length) s.weddings = null;

  if (i.tasks) {
    const open = i.tasks.filter((t) => t.status !== "done");
    const done = i.tasks.filter((t) => t.status === "done");
    const items = open.slice(0, 3).map((t) => ({ id: t.id, title: t.title, note: "", urgent: false, done: false }));
    if (items.length < 3 && done[0]) items.push({ id: done[0].id, title: done[0].title, note: c.done, urgent: false, done: true });
    s.tasks = { done: done.length, total: i.tasks.length, items };
  }

  if (isDayOf) {
    const nowMin = localMinutes(i.nowMs);
    const items = (i.agenda ?? []).filter((a) => a.kind === "runsheet" && a.time && !Number.isNaN(minutesOf(a.time))).sort((a, b) => minutesOf(a.time) - minutesOf(b.time));
    const idx = items.reduce((acc, a, n) => (minutesOf(a.time) <= nowMin ? n : acc), -1);
    const nowItem = idx >= 0 ? items[idx] : null;
    const upcoming = items.slice(idx + 1, idx + 4);
    const left = nowItem && upcoming[0] ? Math.max(0, minutesOf(upcoming[0].time) - nowMin) : null;
    s.dayOf = {
      now: nowItem ? { title: nowItem.title, line: [(nowItem.time ?? "").slice(0, 5), nowItem.location].filter(Boolean).join(" · "), leftText: left === null ? "" : c.minLeft(left), fraction: null } : null,
      next: upcoming.map((a) => ({ time: (a.time ?? "").slice(0, 5), title: a.title })),
      overrun: null,
    };
    if (i.checkin) {
      const last = i.lastArrival;
      s.door = { inCount: i.checkin.seats_in, total: i.checkin.seats_total, lastText: last ? [c.lastIn(last.name), last.table ? c.table(last.table) : ""].filter(Boolean).join(" · ") : null };
    }
  }
  return s;
}

// ---------------------------------------------------------------- guest

export function buildGuestSnapshot(i: GuestIn, lang: WatchLang): WatchSnapshot {
  const c = WATCH_COPY[lang];
  const s = emptySnapshot(lang, i.nowMs);
  s.role = "guest";
  const home = i.home;
  if (home) s.wedding = weddingBlock(home.couple_names, home.wedding_date, home.countdown, home.day_of, lang);
  const party = Math.max(1, home?.rsvp.party_size ?? 1);
  s.pass = { name: i.guestName, line: [c.partyOf(party), i.table ? c.table(i.table) : ""].filter(Boolean).join(" · "), qr: qrRows(`GL1:${i.guestId}`) };

  const today = localIso(i.nowMs);
  const nowMin = localMinutes(i.nowMs);
  const all = (i.events ?? []).filter((e) => e.time && !Number.isNaN(minutesOf(e.time)));
  const live = all.some((e) => e.state);
  const pool = live ? all.filter((e) => e.state !== "done") : all.filter((e) => !e.date || e.date.slice(0, 10) >= today);
  const rows = (pool.length ? pool : all).sort((a, b) => `${a.date ?? ""}${a.time}`.localeCompare(`${b.date ?? ""}${b.time}`)).slice(0, 4);
  s.myDay = rows.length
    ? rows.map((e) => {
        const sameDay = !e.date || e.date.slice(0, 10) === today;
        const mins = minutesOf(e.time) - nowMin;
        const soon = sameDay && mins >= 0 && mins <= 60;
        const note = [e.location ?? "", soon ? c.inMin(mins) : ""].filter(Boolean).join(" · ");
        return { time: (e.time ?? "").slice(0, 5), title: e.title, note, soon };
      })
    : null;
  return s;
}

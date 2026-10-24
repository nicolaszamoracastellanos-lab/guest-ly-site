// Pushes what the app already knows into the home screen widgets. Widgets run
// in their own extension and never touch the network: the app writes a TIMELINE
// (a snapshot per day for the countdown, so the number changes at midnight
// without the app open) every time the data changes.
//
// Everything is best effort and optional: no widgets module (an older native
// build, Android before enableAndroid, Expo Go) means nothing happens.

import { Platform } from "react-native";
import type { CoupleHome, GuestHome, PlannerAgenda, PlannerPortfolioWedding } from "@/lib/hooks";
import { COPY, type WidgetCopy } from "./copy";

type Lang = "en" | "es";
const DAY = 86_400_000;
const DAYS_AHEAD = 14;

// Loaded lazily so a build without expo-widgets never fails at import time.
function load() {
  if (Platform.OS !== "ios") return null;
  try {
    return {
      Countdown: require("@/widgets/GuestlyCountdown").default,
      Replies: require("@/widgets/GuestlyReplies").default,
      Today: require("@/widgets/GuestlyToday").default,
      Weddings: require("@/widgets/GuestlyWeddings").default,
      DayOf: require("@/widgets/GuestlyDayOf").default,
    } as {
      Countdown: { updateTimeline: (e: { date: Date; props: object }[]) => void };
      Replies: { updateTimeline: (e: { date: Date; props: object }[]) => void };
      Today: { updateTimeline: (e: { date: Date; props: object }[]) => void };
      Weddings: { updateTimeline: (e: { date: Date; props: object }[]) => void };
      DayOf: { updateTimeline: (e: { date: Date; props: object }[]) => void };
    };
  } catch {
    return null;
  }
}

function attempt(fn: () => void) {
  try {
    fn();
  } catch {
    // A widget that cannot update must never break the app.
  }
}

/** Probe build only: what each widget's timeline holds right now, as text. */
export async function dumpWidgetTimelines(): Promise<string> {
  const w = load();
  if (!w) return "widgets: module not available";
  const out: string[] = [];
  for (const [name, widget] of Object.entries(w)) {
    try {
      const t = await (widget as unknown as { getTimeline: () => Promise<{ date: Date; props: object }[]> }).getTimeline();
      out.push(`${name.replace("Guestly", "")}: ${t.length} · ${JSON.stringify(t[0]?.props ?? null).slice(0, 70)}`);
    } catch (e) {
      out.push(`${name}: ERR ${String(e).slice(0, 80)}`);
    }
  }
  return out.join("\n");
}

/** The next `n` local midnights, the moments the day count changes. */
function midnights(n: number): Date[] {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Array.from({ length: n }, (_, i) => new Date(d.getTime() + (i + 1) * DAY));
}

function dayText(n: number | null, c: WidgetCopy): { days: string; unit: string } {
  if (n === null) return { days: "·", unit: "" };
  return { days: String(n), unit: n === 1 ? c.day : c.days };
}

function shortDay(iso: string | null, lang: Lang): string {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(lang === "es" ? "es-BO" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** The countdown timeline: the first entry is "now", the rest start at each midnight. */
function countdownTimeline(daysNow: number | null, build: (days: number | null) => object) {
  const first = { date: new Date(), props: build(daysNow) };
  if (daysNow === null) return [first];
  return [first, ...midnights(DAYS_AHEAD).map((date, i) => ({ date, props: build(Math.max(0, daysNow - (i + 1))) }))];
}

const url = (path: string) => `guestly://${path}`;

export function syncCoupleWidgets(home: CoupleHome, lang: Lang) {
  const w = load();
  if (!w) return;
  const c = COPY[lang];
  const names = home.couple_names;
  const days = home.countdown ? (home.countdown.passed ? 0 : home.countdown.days) : null;
  const t = home.totals;
  const replied = t.attending_parties + t.declined_parties;
  attempt(() =>
    w.Countdown.updateTimeline(
      countdownTimeline(days, (d) => ({ names, ...dayText(d, c), dateText: shortDay(home.wedding_date, lang), line: home.needs_you ? c.needYou(home.needs_you) : "", url: url("couple") }))
    )
  );
  attempt(() =>
    w.Replies.updateTimeline([
      {
        date: new Date(),
        props: { names, replied: t.attending_seats + t.declined_seats, total: t.people_expected, going: t.attending_seats, declined: t.declined_seats, pending: Math.max(0, t.people_expected - t.attending_seats - t.declined_seats), repliedLabel: c.replied, goingLabel: c.going, declinedLabel: c.notGoing, pendingLabel: c.noReply, deadline: replied >= t.parties ? "" : "", url: url("couple/guests") },
      },
    ])
  );
  const lines = home.briefing.slice(0, 6).map((b) => ({ text: b.text, note: "", urgent: b.tone === "risk" }));
  attempt(() => w.Today.updateTimeline([{ date: new Date(), props: { title: c.today, headline: home.needs_you ? c.needYou(home.needs_you) : c.nothing, empty: c.nothing, lines, url: url("couple") } }]));
}

export function syncGuestWidgets(home: GuestHome, lang: Lang) {
  const w = load();
  if (!w) return;
  const c = COPY[lang];
  const days = home.countdown ? (home.countdown.passed ? 0 : home.countdown.days) : null;
  const rsvp = home.rsvp;
  const line = rsvp.status === "attending" ? c.replied_going : rsvp.status === "declined" ? c.replied_declined : rsvp.deadline && !rsvp.deadline_passed ? c.reply : "";
  attempt(() =>
    w.Countdown.updateTimeline(countdownTimeline(days, (d) => ({ names: home.couple_names, ...dayText(d, c), dateText: shortDay(home.wedding_date, lang), line, url: url("guest") })))
  );
}

export function syncPlannerWidgets(portfolio: PlannerPortfolioWedding[], agenda: PlannerAgenda | undefined, lang: Lang) {
  const w = load();
  if (!w) return;
  const c = COPY[lang];
  const next = portfolio.find((x) => x.days_to_go !== null) ?? portfolio[0];
  if (next) {
    attempt(() =>
      w.Countdown.updateTimeline(
        countdownTimeline(next.days_to_go, (d) => ({ names: next.couple_names, ...dayText(d, c), dateText: shortDay(next.wedding_date, lang), line: next.open_requests ? c.openRequests(next.open_requests) : "", url: url("planner/weddings") }))
      )
    );
  }
  const rows = portfolio.slice(0, 6).map((x) => ({
    names: x.couple_names,
    days: x.days_to_go === null ? "" : x.days_to_go === 0 ? c.today : `${x.days_to_go} ${x.days_to_go === 1 ? c.day : c.days}`,
    ratio: x.seats && x.seats.invited ? (x.seats.attending + x.seats.declined) / x.seats.invited : -1,
    line: [x.seats ? `${x.seats.attending + x.seats.declined} / ${x.seats.invited}` : "", x.open_requests ? c.openRequests(x.open_requests) : ""].filter(Boolean).join(" · "),
    health: x.health,
    url: url("planner/weddings"),
  }));
  attempt(() => w.Weddings.updateTimeline([{ date: new Date(), props: { title: c.weddings, rows, empty: c.empty, url: url("planner/weddings") } }]));
  if (agenda) {
    const lines = [
      ...agenda.needs_you.slice(0, 6).map((n) => ({ text: n.title, note: n.couple_names, urgent: n.urgent })),
      ...agenda.agenda.slice(0, 4).map((a) => ({ text: `${a.time ?? ""} ${a.title}`.trim(), note: a.couple_names, urgent: false })),
    ].slice(0, 6);
    attempt(() => w.Today.updateTimeline([{ date: new Date(), props: { title: c.today, headline: agenda.needs_you.length ? c.needYou(agenda.needs_you.length) : c.nothing, empty: c.nothing, lines, url: url("planner") } }]));
  }
}

export type DayOfBlock = { id: string; title: string; starts_at: string; location: string | null; state: "done" | "now" | "next" | "later" };

/** Wedding-day widget: the block in progress and the one after it. */
export function syncDayOfWidget(blocks: DayOfBlock[], live: boolean, lang: Lang, path: string) {
  const w = load();
  if (!w) return;
  const c = COPY[lang];
  const now = live ? blocks.find((b) => b.state === "now") : undefined;
  const next = live ? blocks.find((b) => b.state === "next") ?? blocks.find((b) => b.state === "later") : undefined;
  attempt(() =>
    w.DayOf.updateTimeline([
      { date: new Date(), props: { nowLabel: c.now, nextLabel: c.next, now: now?.title ?? "", nowTime: now?.starts_at.slice(0, 5) ?? "", nowPlace: now?.location ?? "", next: next?.title ?? "", nextTime: next?.starts_at.slice(0, 5) ?? "", idle: c.idle, url: url(path) } },
    ])
  );
}

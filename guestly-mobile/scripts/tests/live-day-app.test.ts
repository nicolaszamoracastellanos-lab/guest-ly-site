// Run: node --experimental-strip-types scripts/tests/live-day-app.test.ts
// #3 Live wedding-day mode, the app's side (src/features/dayof/liveDayCore.ts):
// reading `live` from GET /couple/dayof and `live[]` from GET /planner/agenda
// (the portal's src/lib/mobile/live-day.ts shape), keeping Now and Next moving
// on the phone with the verbatim engine and the server offset, the planner's
// list order and zone labels, D2 (alexnico2026 never), copy and static checks.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./lib/ts-resolve.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (p: string) => readFileSync(path.join(here, "../..", p), "utf8");
const L = await import("../../src/features/dayof/liveDayCore.ts");
const { instantOf } = await import("../../src/features/dayof/live.ts");
const { DAYOF_COPY } = await import("../../src/features/dayof/copy.ts");
const { COPY: PLANNER } = await import("../../src/features/planner/copy.ts");

let n = 0;
const t = (name: string, fn: () => void) => {
  try {
    fn();
    n++;
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
};

const TZ = "America/La_Paz";
const DAY = "2026-12-12";
const at = (hhmm: string, day = DAY, tz = TZ) => {
  const [h, m] = hhmm.split(":").map(Number);
  return instantOf(day, h * 60 + m, tz)!;
};
const iso = (ms: number) => new Date(ms).toISOString();

// The portal's answer at 16:12 La Paz (mobileLive): ceremony 16:00 to 16:30 running, cocktail at 16:45.
const answer = (patch: Record<string, unknown> = {}) => ({
  server_now: iso(at("16:12")),
  time_zone: TZ,
  service_day: DAY,
  phase: "live",
  current: [{ id: "b-cer", title: "Ceremony", starts_at: "16:00", ends_at: "16:30", location: "Jardín", minutes_left: 18, progress: 0.4 }],
  next: { id: "b-coc", title: "Cocktail hour", starts_at: "16:45", ends_at: "18:00", location: null, minutes_to_next: 33 },
  gap: null,
  ...patch,
});

t("readLive: the portal's shape; anything else is no live mode", () => {
  const l = L.readLive(answer())!;
  assert.equal(l.serverNow, at("16:12"));
  assert.equal(l.timeZone, TZ);
  assert.equal(l.current[0].minutesLeft, 18);
  assert.equal(l.next?.minutesToNext, 33);
  for (const raw of [undefined, null, [], {}, { server_now: "x", service_day: DAY }, { server_now: iso(0), service_day: "Dec 12" }]) assert.equal(L.readLive(raw), null);
  const odd = L.readLive(answer({ time_zone: "Mars/Olympus", phase: "party", current: [{ id: "x" }, null], next: { id: "n", title: "Late", starts_at: "soon" } }))!;
  assert.equal(odd.timeZone, "America/La_Paz", "an unknown zone falls back like the engine");
  assert.equal(odd.phase, "off");
  assert.deepEqual(odd.current, []);
  assert.equal(odd.next, null, "a block without a clock time is dropped");
});

t("liveLine: minutes tick on the phone with no request", () => {
  const l = L.readLive(answer())!;
  assert.deepEqual(L.liveLine(l, at("16:12")), { kind: "now", title: "Ceremony", minutes: 18, more: 0, next: l.next, nextAt: at("16:45") });
  assert.equal((L.liveLine(l, at("16:20")) as { minutes: number }).minutes, 10);
  // Ceremony over, cocktail not yet: the gap, counting down to 16:45.
  const gap = L.liveLine(l, at("16:35"));
  assert.equal(gap.kind, "between");
  assert.equal((gap as { minutes: number }).minutes, 10);
  // The next moment takes over at its start.
  const coc = L.liveLine(l, at("16:46"));
  assert.equal(coc.kind, "now");
  assert.equal((coc as { title: string }).title, "Cocktail hour");
});

t("liveLine: past what the answer knows, it waits for the next refresh (never a wrong Now or wrap)", () => {
  const l = L.readLive(answer())!;
  assert.deepEqual(L.liveLine(l, at("18:30")), { kind: "stale" });
  assert.equal(L.liveLine(L.readLive(answer({ phase: "after", current: [], next: null }))!, at("23:00")).kind, "wrap");
});

t("liveLine: before the first moment, two moments at once, after midnight", () => {
  const before = L.readLive(answer({ server_now: iso(at("09:00")), phase: "before", current: [], next: { id: "b1", title: "Hair and makeup", starts_at: "10:00", ends_at: null, location: null, minutes_to_next: 60 } }))!;
  const b = L.liveLine(before, at("09:30"));
  assert.equal(b.kind, "before");
  const two = L.readLive(answer({ current: [
    { id: "a", title: "Photos", starts_at: "16:05", ends_at: "16:40", location: null, minutes_left: 28, progress: 0.2 },
    { id: "b-cer", title: "Ceremony", starts_at: "16:00", ends_at: "16:30", location: null, minutes_left: 18, progress: 0.4 },
  ] }))!;
  const both = L.liveLine(two, at("16:12")) as { kind: string; title: string; more: number };
  assert.equal(both.title, "Photos", "the latest start is the primary, as on the server");
  assert.equal(both.more, 1);
  // 23:30 to 00:30 on the same service day, read at 00:10 the next calendar day.
  const night = L.readLive(answer({ server_now: iso(at("23:40")), current: [{ id: "d", title: "Last dance", starts_at: "23:30", ends_at: "00:30", location: null, minutes_left: 50, progress: 0.2 }], next: null }))!;
  const midnight = L.liveLine(night, at("00:10", "2026-12-13")) as { kind: string; minutes: number };
  assert.equal(midnight.kind, "now");
  assert.equal(midnight.minutes, 20);
});

t("clock offset: a phone 3 hours wrong still shows the venue's Now", () => {
  const l = L.readLive(answer())!;
  const deviceAtReceipt = at("16:12") - 3 * 3_600_000;
  const offset = L.clockOffset(l.serverNow, deviceAtReceipt);
  assert.equal(offset, 3 * 3_600_000);
  const deviceLater = deviceAtReceipt + 5 * 60_000;
  assert.equal((L.liveLine(l, deviceLater + offset) as { minutes: number }).minutes, 13);
  assert.equal(L.clockOffset(Number.NaN, 5), 0);
  assert.equal(L.clockOffset(5, 0), 0, "no receipt time (nothing fetched yet): no offset");
});

t("D2: alexnico2026 never shows the live mode", () => {
  assert.deepEqual(L.LIVE_DAY_NEVER, ["alexnico2026"]);
  assert.equal(L.liveDayAllowed("alexnico2026"), false);
  assert.equal(L.liveDayAllowed("valentina-y-mateo"), true);
  assert.equal(L.liveDayAllowed(null), false);
  const list = L.readLiveList([
    { ...answer(), wedding_slug: "alexnico2026", couple_names: "Alexandra & Nicolás" },
    { ...answer(), wedding_slug: "valentina-y-mateo", couple_names: "Valentina & Mateo" },
    { ...answer(), wedding_slug: "valentina-y-mateo", couple_names: "dup" },
    { wedding_slug: "broken" },
  ])!;
  assert.deepEqual(list.map((w) => w.slug), ["valentina-y-mateo"]);
  assert.equal(L.readLiveList(undefined), null, "no key: the card stays away");
  assert.deepEqual(L.readLiveList([]), []);
});

t("planner Today: soonest next start first, wraps last, three zones", () => {
  const cancun = L.readLive(answer({ time_zone: "America/Cancun", server_now: iso(at("16:12")), next: { id: "n1", title: "Dinner", starts_at: "19:00", ends_at: null, location: null, minutes_to_next: 60 } }))!;
  const lapaz = L.readLive(answer())!;
  const done = L.readLive(answer({ phase: "after", current: [], next: null }))!;
  const now = at("16:12");
  const rows = L.sortLive([
    { names: "Zoe & Ana", line: L.liveLine(done, now) },
    { names: "Bea & Luis", line: L.liveLine(cancun, now) },
    { names: "Valentina & Mateo", line: L.liveLine(lapaz, now) },
  ]);
  assert.deepEqual(rows.map((r) => r.names), ["Valentina & Mateo", "Bea & Luis", "Zoe & Ana"]);
});

t("venue time: behind, ahead, the same", () => {
  const now = at("16:12");
  // La Paz is UTC-4; a phone in Madrid in December is UTC+1: the venue is 5 h behind.
  assert.equal(L.venueDiffMinutes(TZ, now, 60), -300);
  assert.equal(L.venueDiffMinutes("Asia/Kathmandu", now, -240), 585);
  assert.equal(L.venueDiffMinutes(TZ, now, -240), 0);
  assert.deepEqual(L.diffParts(-300), { h: 5, m: 0 });
  assert.deepEqual(L.diffParts(585), { h: 9, m: 45 });
});

t("dayofBlocks: the couple list on its service day, done kept, taps overlaid", () => {
  const rows = [
    { id: "a", title: "Ceremony", starts_at: "16:00", ends_at: "16:30", location: null, owner: null, state: "done" },
    { id: "b", title: "Cocktail", starts_at: "16:45", ends_at: null, location: null, owner: "Ana", state: "later" },
    { id: "c", title: "No time", starts_at: "", ends_at: null, location: null, owner: null, state: "later" },
  ];
  const blocks = L.dayofBlocks(rows, DAY, { b: "done" });
  assert.deepEqual(blocks.map((b) => [b.id, b.status, b.day]), [["a", "done", DAY], ["b", "done", DAY]]);
  assert.equal(L.dayofBlocks(rows, DAY)[1].status, null);
});

const DASH = /[\u2013\u2014]/;
const fill = (s: string) => s.replace(/\{(\w+)\}/g, "1");
t("copy: planner live lines and the day-of addition, EN and ES", () => {
  const keys = ["liveToday", "liveNow", "liveNowMore", "liveBetween", "liveBefore", "liveWrap", "liveStale", "liveBehind", "liveAhead", "liveHours", "liveHoursMin", "liveMin", "liveOpenHint"] as const;
  for (const lang of ["en", "es"] as const) {
    const p = PLANNER[lang];
    for (const k of keys) {
      assert.ok(p[k], `${lang}.${k}`);
      assert.ok(!DASH.test(p[k]) && !p[k].includes("!"), `${lang}.${k}`);
      const enPh = (PLANNER.en[k].match(/\{\w+\}/g) ?? []).sort();
      assert.deepEqual((p[k].match(/\{\w+\}/g) ?? []).sort(), enPh, `${lang}.${k} placeholders`);
      assert.ok(!/\{/.test(fill(p[k])));
    }
    assert.ok(DAYOF_COPY[lang].notStarted.includes("{time}"));
  }
  assert.equal(DAYOF_COPY.en.notStarted, "Not started yet. First at {time}.", "the portal's sentence");
  assert.equal(DAYOF_COPY.es.notStarted, "Aún no empieza. Primero a las {time}.");
  assert.equal(PLANNER.en.liveWrap, "That's a wrap for today.");
  assert.equal(PLANNER.es.liveWrap, "Terminó el día.");
});

t("static: screens read live through the core and hide without it", () => {
  const panel = src("src/features/dayof/ServerLive.tsx");
  assert.ok(/liveDayAllowed\(slug\) \? readLive\(data\?\.live\)/.test(panel), "couple: D2 and the key decide");
  assert.ok(/runsheet_locked/.test(panel), "D28: a locked timeline says the sentence");
  assert.ok(/undo:/.test(panel), "Mark done has Undo");
  assert.ok(!/Alert\./.test(panel));
  const day = src("src/app/couple/(tools)/dayof.tsx");
  assert.ok(/liveView \? <ServerLivePanel/.test(day), "no live: the screen as before");
  const today = src("src/features/planner/LiveToday.tsx");
  assert.ok(/if \(!list \|\| !list\.length\) return null/.test(today), "no key or none live: nothing");
  assert.ok(!/<Gem/.test(today), "no diamond on the multi-wedding list");
  assert.ok(/router\.push\("\/planner\/dayof"/.test(today));
  assert.ok(/refetchInterval: \(q\) =>/.test(src("src/lib/hooks.ts")), "agenda refreshes while a wedding is live");
});

console.log(`live-day-app (#3): ${n} groups ok`);

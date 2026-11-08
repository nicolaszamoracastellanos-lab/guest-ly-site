// Run: node --experimental-strip-types scripts/tests/dayof-live.test.ts
// The wedding-day Now engine (src/features/dayof/live.ts), a verbatim copy of
// the portal's src/lib/runsheet-live.ts (scripts/check-verbatim-copies.mjs
// keeps them equal). These are the portal's cases (scripts/test-runsheet-live.mjs)
// unchanged in substance, so both copies answer to the same assertions: before
// the start, mid-block with minutes left, a gap with "next in N", overlaps,
// done, midnight, a 01:30 block, a multi-day weekend, a viewer in another
// zone, both daylight saving nights, 40 blocks, six months before.
//
// Hermes: the engine reads the wedding's wall clock with Intl.DateTimeFormat
// formatToParts and a timeZone, and falls back to parsing format() when an
// engine has no formatToParts. This file runs every case twice: once as node
// is, and once in a child process where formatToParts is deleted before the
// engine loads (GL_LIVE_NO_FORMAT_TO_PARTS=1), plus a year-long sweep in five
// zones that must read the same wall clocks on both paths. A device check on
// Hermes is still needed (its Intl is not node's ICU).

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const NO_PARTS = process.env.GL_LIVE_NO_FORMAT_TO_PARTS === "1";
if (NO_PARTS) delete (Intl.DateTimeFormat.prototype as { formatToParts?: unknown }).formatToParts;

const enginePath = fileURLToPath(new URL("../../src/features/dayof/live.ts", import.meta.url));
const L = await import(pathToFileURL(enginePath).href);
const mode = NO_PARTS ? "format() fallback" : "formatToParts";

let n = 0;
const failures = [];
const t = (name, fn) => {
  try {
    fn();
    n++;
  } catch (e) {
    failures.push(name);
    console.log(`FAIL  [${mode}] ${name}\n      ${e && e.message ? e.message.split("\n").join("\n      ") : e}`);
  }
};

const LPZ = "America/La_Paz"; // UTC-4, no daylight saving
const NY = "America/New_York";
/** The instant of a wall clock in a zone ("2026-11-27", "17:52" or "17:52:30"). */
const at = (day, hhmm, tz = LPZ) => {
  const [h, m, s] = hhmm.split(":").map(Number);
  return L.instantOf(day, h * 60 + m, tz) + (s ?? 0) * 1000;
};
const live = (blocks, day, hhmm, tz = LPZ) => L.liveState(blocks, { now: at(day, hhmm, tz), timeZone: tz });
const ids = (list) => list.map((b) => b.id);
const DAY = "2026-11-27";
const NEXT = "2026-11-28";

// The starter template of src/lib/runsheet.ts (17:00 ceremony), as stored.
const TEMPLATE = [
  ["gettingReady", "12:00", "15:30"],
  ["vendorSetup", "13:00", "16:00"],
  ["photographerArrives", "14:30", null],
  ["firstLook", "15:45", "16:15"],
  ["guestsArrive", "16:30", "17:00"],
  ["ceremony", "17:00", "17:45"],
  ["cocktailHour", "17:45", "19:00"],
  ["familyPhotos", "17:50", "18:30"],
  ["receptionEntrance", "19:00", "19:15"],
  ["dinner", "19:15", "20:30"],
  ["toasts", "20:30", "21:00"],
  ["firstDance", "21:00", "21:15"],
  ["cakeCutting", "21:30", "21:45"],
  ["openDancing", "21:45", "23:45"],
  ["lastDance", "23:45", null],
].map(([id, s, e], i) => ({ id, day: DAY, starts_at: `${s}:00`, ends_at: e ? `${e}:00` : null, status: "planned", sort_order: i, title: id }));

// --- service day primitives -------------------------------------------------

t("service minutes: 05:00 opens the day, 04:59 and 01:30 belong to the night before", () => {
  assert.equal(L.serviceMinutes("05:00"), 300);
  assert.equal(L.serviceMinutes("04:59"), 24 * 60 + 299);
  assert.equal(L.serviceMinutes("01:30:00"), 1530);
  assert.equal(L.serviceMinutes("23:45"), 1425);
  assert.equal(L.serviceMinutes("00:00"), 1440);
  assert.equal(L.serviceMinutes("24:00"), null);
  assert.equal(L.serviceMinutes("soon"), null);
  assert.equal(L.serviceMinutes(null), null);
});

t("service day of a wall clock: 01:30 on the 28th is still the 27th", () => {
  assert.equal(L.serviceDayOf(NEXT, 90), DAY);
  assert.equal(L.serviceDayOf(NEXT, 299), DAY);
  assert.equal(L.serviceDayOf(NEXT, 300), NEXT);
  assert.equal(L.serviceDayOf("2027-01-01", 60), "2026-12-31");
  assert.equal(L.serviceDayOf("2028-03-01", 0), "2028-02-29");
});

t("calendar arithmetic across month and year ends", () => {
  assert.equal(L.addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(L.addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(L.addDays("2026-11-27", 0), "2026-11-27");
});

t("service order: 01:30 after 23:45 on the same day, then sort_order, then id", () => {
  const sorted = L.sortByServiceOrder([
    { id: "b", day: DAY, starts_at: "01:30" },
    { id: "a", day: DAY, starts_at: "23:45" },
    { id: "z", day: DAY, starts_at: "17:00", sort_order: 2 },
    { id: "y", day: DAY, starts_at: "17:00", sort_order: 1 },
    { id: "n", day: NEXT, starts_at: "10:00" },
    { id: "x", day: DAY, starts_at: "bad" },
  ]);
  assert.deepEqual(ids(sorted), ["y", "z", "a", "b", "x", "n"]);
});

t("wall clock and instants: La Paz is UTC-4 all year", () => {
  assert.equal(at(DAY, "17:00"), Date.UTC(2026, 10, 27, 21, 0));
  assert.deepEqual(L.wallClockAt(Date.UTC(2026, 10, 28, 5, 30), LPZ), { day: NEXT, minutes: 90 });
  assert.equal(L.instantOf(DAY, 1530, LPZ), Date.UTC(2026, 10, 28, 5, 30));
  assert.equal(L.zoneOffsetMinutes(LPZ, Date.UTC(2026, 6, 1)), -240);
});

// --- the wedding day ---------------------------------------------------------

t("six months before: nothing is live, nothing reads done", () => {
  const s = live(TEMPLATE, "2026-05-27", "17:52");
  assert.equal(s.phase, "off");
  assert.equal(s.primary, null);
  assert.equal(s.next, null);
  assert.ok(Object.values(s.states).every((v) => v === "later"), JSON.stringify(s.states));
  assert.equal(s.items.length, 0);
  assert.equal(s.nextDay, DAY);
});

t("before the first block: phase before, next in N minutes", () => {
  const s = live(TEMPLATE, DAY, "09:00");
  assert.equal(s.phase, "before");
  assert.equal(s.next.id, "gettingReady");
  assert.equal(s.minutesToNext, 180);
  assert.equal(s.states.gettingReady, "next");
  assert.equal(s.states.ceremony, "later");
});

t("mid-block with minutes left and overlaps: 17:52, family photos inside cocktail hour", () => {
  const s = live(TEMPLATE, DAY, "17:52");
  assert.equal(s.phase, "live");
  assert.deepEqual(ids(s.current), ["familyPhotos", "cocktailHour"]);
  assert.equal(s.primary.id, "familyPhotos", "the latest start is primary");
  assert.equal(s.minutesLeft, 38);
  assert.equal(s.next.id, "receptionEntrance");
  assert.equal(s.minutesToNext, 68);
  assert.equal(s.states.ceremony, "done");
  assert.equal(s.states.cocktailHour, "now");
  assert.equal(s.states.receptionEntrance, "next");
  assert.equal(s.states.dinner, "later");
  assert.equal(s.progress, 2 / 40);
});

t("seconds round the countdown up: 17:52:30 still reads 38 min left", () => {
  const s = live(TEMPLATE, DAY, "17:52:30");
  assert.equal(s.minutesLeft, 38);
  assert.equal(s.minutesToNext, 68);
  const edge = live(TEMPLATE, DAY, "18:29:59");
  assert.equal(edge.minutesLeft, 1);
  const over = live(TEMPLATE, DAY, "18:30");
  assert.deepEqual(ids(over.current), ["cocktailHour"]);
});

t("a block without an end runs to the next later start, capped at 60 minutes", () => {
  const timings = L.timingsFor(TEMPLATE, LPZ);
  const photographer = timings.find((x) => x.block.id === "photographerArrives");
  assert.equal(photographer.minutes, 60, "next start 15:45 is 75 min away: capped");
  assert.equal(photographer.endEstimated, true);
  const short = L.timingsFor(
    [
      { id: "a", day: DAY, starts_at: "10:00", ends_at: null },
      { id: "b", day: DAY, starts_at: "10:00", ends_at: "10:05" },
      { id: "c", day: DAY, starts_at: "10:20", ends_at: null },
    ],
    LPZ
  );
  assert.equal(short.find((x) => x.block.id === "a").minutes, 20, "a block at the same minute is not the next start");
});

t("the last block of the night gets 60 minutes, past midnight", () => {
  const timings = L.timingsFor(TEMPLATE, LPZ);
  const last = timings.find((x) => x.block.id === "lastDance");
  assert.equal(last.minutes, 60);
  const s = live(TEMPLATE, NEXT, "00:30");
  assert.equal(s.serviceDay, DAY);
  assert.equal(s.clock.day, NEXT);
  assert.equal(s.primary.id, "lastDance");
  assert.equal(s.minutesLeft, 15);
  const after = live(TEMPLATE, NEXT, "00:50");
  assert.equal(after.phase, "after");
  assert.ok(Object.values(after.states).every((v) => v === "done"));
});

t("midnight: a 23:30 to 00:30 block is live at 00:10, in the evening's service day", () => {
  const blocks = [
    { id: "dance", day: DAY, starts_at: "21:00", ends_at: "23:30" },
    { id: "late", day: DAY, starts_at: "23:30", ends_at: "00:30" },
  ];
  const s = live(blocks, NEXT, "00:10");
  assert.equal(s.serviceDay, DAY);
  assert.equal(s.primary.id, "late");
  assert.equal(s.minutesLeft, 20);
  assert.deepEqual(ids(s.items.map((i) => i.block)), ["dance", "late"]);
});

t("a 01:30 block is later at 22:00 (not done all evening), now at 01:40, done after", () => {
  const blocks = [
    { id: "dinner", day: DAY, starts_at: "20:00", ends_at: "21:30" },
    { id: "lastSong", day: DAY, starts_at: "01:30", ends_at: null },
  ];
  const evening = live(blocks, DAY, "22:00");
  assert.equal(evening.states.lastSong, "next");
  assert.equal(evening.phase, "between");
  assert.equal(evening.minutesToNext, 210);
  const late = live(blocks, NEXT, "01:40");
  assert.equal(late.phase, "live");
  assert.equal(late.primary.id, "lastSong");
  assert.equal(late.minutesLeft, 50);
  assert.equal(live(blocks, NEXT, "02:31").phase, "after");
  assert.equal(live(blocks, NEXT, "05:00").phase, "off");
});

t("done ends a block early: the gap to the next block shows", () => {
  const blocks = TEMPLATE.map((b) => (b.id === "ceremony" ? { ...b, status: "done" } : b));
  const s = live(blocks, DAY, "17:20");
  assert.equal(s.phase, "between");
  assert.equal(s.primary, null);
  assert.equal(s.states.ceremony, "done");
  assert.equal(s.next.id, "cocktailHour");
  assert.equal(s.minutesToNext, 25);
  assert.deepEqual(s.gap, { minutes: 25, remaining: 25 });
});

t("a block marked done before its time is skipped as next", () => {
  const blocks = TEMPLATE.map((b) => (b.id === "toasts" ? { ...b, status: "done" } : b));
  const s = live(blocks, DAY, "20:31");
  assert.equal(s.states.toasts, "done");
  assert.equal(s.primary, null);
  assert.equal(s.next.id, "firstDance");
  assert.equal(s.phase, "between");
});

t("gaps: Between rows and a live gap with next in N", () => {
  const blocks = [
    { id: "a", day: DAY, starts_at: "10:00", ends_at: "10:30" },
    { id: "b", day: DAY, starts_at: "10:45", ends_at: "11:00" },
    { id: "c", day: DAY, starts_at: "11:00", ends_at: null },
    { id: "d", day: DAY, starts_at: "14:30", ends_at: null },
    { id: "e", day: DAY, starts_at: "15:45", ends_at: "16:00" },
  ];
  const s = live(blocks, DAY, "10:37");
  assert.equal(s.phase, "between");
  assert.deepEqual(s.gap, { minutes: 15, remaining: 8 });
  assert.equal(s.minutesToNext, 8);
  assert.deepEqual(
    s.gaps.map((g) => [g.afterId, g.beforeId, g.minutes]),
    [
      ["a", "b", 15],
      ["c", "d", 150],
      ["d", "e", 15],
    ]
  );
  const overlap = L.gapsFor(L.timingsFor(TEMPLATE, LPZ));
  assert.ok(!overlap.some((g) => g.beforeId === "familyPhotos" || g.beforeId === "receptionEntrance"), "overlaps leave no gap");
});

t("two blocks starting together: one primary, both current, stable choice", () => {
  const blocks = [
    { id: "x", day: DAY, starts_at: "18:00", ends_at: "19:00", sort_order: 1 },
    { id: "y", day: DAY, starts_at: "18:00", ends_at: "18:30", sort_order: 2 },
  ];
  const s = live(blocks, DAY, "18:10");
  assert.deepEqual(ids(s.current), ["y", "x"]);
  assert.equal(s.primary.id, "y");
  assert.equal(s.minutesLeft, 20);
});

// --- several days --------------------------------------------------------------

const WEEKEND = [
  { id: "welcome", day: "2026-11-26", starts_at: "20:00", ends_at: "23:00" },
  { id: "ceremony", day: DAY, starts_at: "17:00", ends_at: "18:00" },
  { id: "party", day: DAY, starts_at: "22:00", ends_at: "02:00" },
  { id: "brunch", day: NEXT, starts_at: "11:00", ends_at: "13:00" },
];

t("multi-day weekend: each day has its own Now and Next", () => {
  const sat = live(WEEKEND, DAY, "12:00");
  assert.equal(sat.serviceDay, DAY);
  assert.equal(sat.phase, "before");
  assert.equal(sat.next.id, "ceremony");
  assert.deepEqual(ids(sat.items.map((i) => i.block)), ["ceremony", "party"]);
  assert.deepEqual(sat.states, { welcome: "done", ceremony: "next", party: "later", brunch: "later" });
  assert.deepEqual(sat.days, ["2026-11-26", DAY, NEXT]);
  assert.equal(sat.nextDay, NEXT);

  const friNight = live(WEEKEND, DAY, "02:00");
  assert.equal(friNight.serviceDay, "2026-11-26");
  assert.equal(friNight.phase, "after");
  assert.equal(friNight.states.ceremony, "later");

  const party = live(WEEKEND, NEXT, "01:00");
  assert.equal(party.serviceDay, DAY);
  assert.equal(party.primary.id, "party");
  assert.equal(party.minutesLeft, 60);
  assert.equal(party.states.brunch, "later", "Sunday's brunch never reads done on Saturday night");

  const sun = live(WEEKEND, NEXT, "11:30");
  assert.equal(sun.primary.id, "brunch");
  assert.equal(sun.nextDay, null);
});

t("a block still running past 05:00 stays current on the new service day", () => {
  const blocks = [
    { id: "afterParty", day: DAY, starts_at: "04:30", ends_at: null },
    { id: "brunch", day: NEXT, starts_at: "11:00", ends_at: "12:00" },
  ];
  const s = live(blocks, NEXT, "05:10");
  assert.equal(s.serviceDay, NEXT);
  assert.equal(s.primary.id, "afterParty");
  assert.equal(s.minutesLeft, 20, "04:30 on the 27th's night plus 60 minutes ends at 05:30 on the 28th");
  assert.deepEqual(ids(s.items.map((i) => i.block)), ["afterParty", "brunch"]);
  assert.equal(s.next.id, "brunch");
});

t("an ends_at past 05:00 on the next morning keeps an all-night party live", () => {
  const blocks = [
    { id: "dinner", day: DAY, starts_at: "20:00", ends_at: "22:00" },
    { id: "party", day: DAY, starts_at: "22:00", ends_at: "06:00" },
  ];
  const party = L.timingsFor(blocks, LPZ).find((x) => x.block.id === "party");
  assert.equal(party.minutes, 480, "22:00 to 06:00 is eight hours");
  assert.equal(party.endEstimated, false);
  for (const [day, hhmm, left] of [[DAY, "23:30", 390], [NEXT, "02:00", 240], [NEXT, "05:30", 30]]) {
    const s = live(blocks, day, hhmm);
    assert.equal(s.phase, "live", `${day} ${hhmm}`);
    assert.equal(s.primary.id, "party", `${day} ${hhmm}`);
    assert.equal(s.states.party, "now", `${day} ${hhmm}`);
    assert.equal(s.minutesLeft, left, `${day} ${hhmm}`);
  }
  const done = live(blocks, NEXT, "06:10");
  assert.equal(done.primary, null);
  assert.equal(done.states.party, "done");
});

t("23:00 to 05:30 and 04:30 to 06:00 end on the next calendar morning", () => {
  const blocks = [
    { id: "late", day: DAY, starts_at: "23:00", ends_at: "05:30" },
    { id: "dawn", day: DAY, starts_at: "04:30", ends_at: "06:00" },
  ];
  const timings = L.timingsFor(blocks, LPZ);
  assert.equal(timings.find((x) => x.block.id === "late").minutes, 390);
  assert.equal(timings.find((x) => x.block.id === "dawn").minutes, 90);
  assert.ok(timings.every((x) => !x.endEstimated));
  const s = live(blocks, NEXT, "05:10");
  assert.equal(s.serviceDay, NEXT);
  assert.deepEqual(ids(s.current), ["dawn", "late"], "both still run past the cutoff, latest start first");
  assert.equal(s.minutesLeft, 50);
});

t("a wrap longer than 12 hours or the same clock time as the start is a slip: rule 2", () => {
  const blocks = [
    { id: "slip", day: DAY, starts_at: "18:00", ends_at: "17:00" },
    { id: "same", day: DAY, starts_at: "20:00", ends_at: "20:00" },
    { id: "breakfast", day: DAY, starts_at: "21:00", ends_at: "09:00" },
  ];
  const timings = L.timingsFor(blocks, LPZ);
  const by = (id) => timings.find((x) => x.block.id === id);
  assert.equal(by("slip").endEstimated, true);
  assert.equal(by("slip").minutes, 60);
  assert.equal(by("same").endEstimated, true);
  assert.equal(by("breakfast").minutes, 12 * 60, "exactly 12 hours is still read as overnight");
  assert.equal(L.OVERNIGHT_MAX_MINUTES, 720);
});

// --- zones ---------------------------------------------------------------------

t("viewer in another zone: same answer whatever the device zone is", () => {
  const now = at(DAY, "17:52", "America/Cancun");
  const script = `
    if (process.env.GL_LIVE_NO_FORMAT_TO_PARTS === "1") delete Intl.DateTimeFormat.prototype.formatToParts;
    const L = await import(${JSON.stringify(pathToFileURL(enginePath).href)});
    const blocks = ${JSON.stringify(TEMPLATE)};
    const s = L.liveState(blocks, { now: ${now}, timeZone: "America/Cancun" });
    console.log(JSON.stringify({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, s }));`;
  const outs = ["Asia/Tokyo", "America/Los_Angeles", "Europe/Madrid"].map((tz) => {
    const r = spawnSync(process.execPath, ["--no-warnings", "--experimental-strip-types", "--input-type=module", "-e", script], { env: { ...process.env, TZ: tz }, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout);
  });
  assert.deepEqual(outs.map((o) => o.tz), ["Asia/Tokyo", "America/Los_Angeles", "Europe/Madrid"]);
  const here = L.liveState(TEMPLATE, { now, timeZone: "America/Cancun" });
  for (const o of outs) assert.deepEqual(o.s, JSON.parse(JSON.stringify(here)));
  assert.equal(here.primary.id, "familyPhotos");
  assert.equal(here.minutesLeft, 38);
  // The same instant in La Paz is an hour later on the wall: the zone is the wedding's, not the viewer's.
  assert.equal(L.liveState(TEMPLATE, { now, timeZone: LPZ }).primary.id, "cocktailHour");
});

t("daylight saving, fall back (New York, Nov 1 2026): true durations across the repeated hour", () => {
  const blocks = [
    { id: "party", day: "2026-10-31", starts_at: "23:00", ends_at: "03:00" },
    { id: "late", day: "2026-10-31", starts_at: "01:30", ends_at: null },
  ];
  const timings = L.timingsFor(blocks, NY);
  assert.equal(timings.find((x) => x.block.id === "party").minutes, 300, "23:00 EDT to 03:00 EST is five real hours");
  assert.equal(L.instantOf("2026-10-31", 1530, NY), Date.UTC(2026, 10, 1, 5, 30), "01:30 that happens twice is the first one (EDT)");
  const late = timings.find((x) => x.block.id === "late");
  assert.equal(late.minutes, 60, "the last block gets 60 real minutes");
  // 01:30 EST, the second time the clock reads 01:30.
  const s = L.liveState(blocks, { now: Date.UTC(2026, 10, 1, 6, 30), timeZone: NY });
  assert.equal(s.serviceDay, "2026-10-31");
  assert.deepEqual(ids(s.current), ["party"], "late (01:30 EDT plus 60) is over by the second 01:30");
  assert.equal(s.minutesLeft, 90);
});

t("daylight saving, spring forward (New York, Mar 8 2026): the skipped hour", () => {
  assert.equal(L.instantOf("2026-03-07", 24 * 60 + 150, NY), Date.UTC(2026, 2, 8, 7, 30), "02:30 does not exist: read as 03:30 EDT");
  const blocks = [{ id: "late", day: "2026-03-07", starts_at: "01:00", ends_at: "03:00" }];
  assert.equal(L.timingsFor(blocks, NY)[0].minutes, 60, "01:00 EST to 03:00 EDT is one real hour");
  const s = L.liveState(blocks, { now: Date.UTC(2026, 2, 8, 6, 30), timeZone: NY });
  assert.equal(s.minutesLeft, 30);
  const madrid = L.timingsFor([{ id: "m", day: "2026-10-24", starts_at: "22:00", ends_at: "04:00" }], "Europe/Madrid");
  assert.equal(madrid[0].minutes, 7 * 60, "Madrid falls back Oct 25: 22:00 to 04:00 is seven real hours");
});

t("an unknown zone falls back to La Paz instead of throwing", () => {
  const s = L.liveState(TEMPLATE, { now: at(DAY, "17:52"), timeZone: "Mars/Olympus" });
  assert.equal(s.timeZone, LPZ);
  assert.equal(s.primary.id, "familyPhotos");
  assert.equal(L.usableTimeZone(""), LPZ);
});

// --- scale and odd data -----------------------------------------------------------

t("40 blocks every 15 minutes: one current, the right counts, fast", () => {
  const blocks = Array.from({ length: 40 }, (_, i) => {
    const m = 12 * 60 + i * 15;
    return { id: `b${i}`, day: DAY, starts_at: `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`, ends_at: null, sort_order: i };
  });
  const s = live(blocks, DAY, "15:07");
  assert.deepEqual(ids(s.current), ["b12"]);
  assert.equal(s.minutesLeft, 8);
  const counts = Object.values(s.states).reduce((acc, v) => ((acc[v] = (acc[v] ?? 0) + 1), acc), {});
  assert.deepEqual(counts, { done: 12, now: 1, next: 1, later: 26 });
  const timings = L.timingsFor(blocks, LPZ);
  assert.ok(timings.slice(0, 39).every((x) => x.minutes === 15));
  assert.equal(timings[39].minutes, 60);
  assert.equal(s.gaps.length, 0);
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) L.liveState(blocks, { now: at(DAY, "15:07") + i * 60_000, timeZone: LPZ });
  const ms = performance.now() - t0;
  assert.ok(ms < 2000, `200 runs took ${Math.round(ms)} ms`);
});

t("odd data: bad times are left out, a bad end is ignored, empty lists are off", () => {
  const blocks = [
    { id: "ok", day: DAY, starts_at: "18:00", ends_at: "17:00" },
    { id: "noStart", day: DAY, starts_at: "", ends_at: null },
    { id: "noDay", day: "someday", starts_at: "18:00", ends_at: null },
  ];
  const s = live(blocks, DAY, "18:10");
  assert.equal(s.primary.id, "ok");
  assert.equal(s.minutesLeft, 50, "an end before the start is ignored: last block, 60 minutes");
  assert.equal(s.states.noStart, "later");
  assert.equal(s.states.noDay, "later");
  assert.deepEqual(ids(s.items.map((i) => i.block)), ["ok"]);
  const empty = L.liveState([], { now: at(DAY, "18:00"), timeZone: LPZ });
  assert.equal(empty.phase, "off");
  assert.deepEqual(empty.days, []);
});

t("the engine file imports nothing (it is a verbatim copy of the portal file)", () => {
  const src = readFileSync(enginePath, "utf8");
  assert.ok(!/^\s*import\s/m.test(src) && !/\brequire\(/.test(src) && !/^\s*export\s+[^;]*\bfrom\s/m.test(src));
  assert.ok(!/[\u2013\u2014]/.test(src), "no en or em dashes");
});

// --- Hermes: the format() fallback ------------------------------------------------

t("the run uses the path it claims", () => {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/La_Paz" });
  assert.equal(typeof f.formatToParts === "function", !NO_PARTS);
});

/** Wall clocks and offsets every 61 minutes through 2026 in five zones (DST both ways, a :45 zone, a south zone). */
function sweep(): string {
  const zones = ["America/La_Paz", "America/New_York", "Europe/Madrid", "Asia/Kathmandu", "America/Santiago"];
  const rows: string[] = [];
  const from = Date.UTC(2026, 0, 1);
  const to = Date.UTC(2027, 0, 1);
  for (const tz of zones) {
    for (let ms = from; ms < to; ms += 61 * 60_000) {
      const c = L.wallClockAt(ms, tz);
      rows.push(`${tz} ${ms} ${c.day} ${c.minutes} ${L.zoneOffsetMinutes(tz, ms)}`);
    }
  }
  return createHash("sha256").update(rows.join("\n")).digest("hex");
}

if (NO_PARTS) {
  // Child: report and let the parent compare.
  console.log(JSON.stringify({ passed: n, failures, sweep: sweep() }));
  process.exit(failures.length ? 1 : 0);
}

t("without formatToParts every case still passes and the wall clocks match for a whole year", () => {
  const r = spawnSync(process.execPath, ["--no-warnings", "--experimental-strip-types", fileURLToPath(import.meta.url)], {
    env: { ...process.env, GL_LIVE_NO_FORMAT_TO_PARTS: "1" },
    encoding: "utf8",
  });
  const last = r.stdout.trim().split("\n").pop() ?? "";
  let child: { passed: number; failures: string[]; sweep: string } | null = null;
  try {
    child = JSON.parse(last);
  } catch {
    assert.fail(`the fallback run printed no report (exit ${r.status})\n${r.stdout}${r.stderr}`);
  }
  assert.deepEqual(child.failures, [], r.stdout);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(child.passed, n, "the same cases ran and passed on the fallback path");
  assert.equal(child.sweep, sweep(), "format() and formatToParts read the same wall clock at every instant");
});

if (failures.length) {
  console.log(`\ndayof-live: ${failures.length} failure(s): ${failures.join("; ")}`);
  process.exit(1);
}
console.log(`dayof-live: all ${n} passed (formatToParts and the format() fallback)`);

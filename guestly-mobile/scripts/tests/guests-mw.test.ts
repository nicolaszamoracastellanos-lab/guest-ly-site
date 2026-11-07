// App halves for guests and the couple (1.4.0): #1 final count lock, #26
// arrival and departure windows, #45 know-before card, #37 Seen, K21 opens.
// Pure checks of the cores against the portal's payload shapes (L2-LOG
// "Lane 8 (1.4.0)"), copy rules, fault-injected lock rollback, and static
// checks that every new piece hides when its flag is off or its route 404s.
// Run: node --no-warnings --experimental-strip-types scripts/tests/guests-mw.test.ts

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { countBadge, lockedDay, mealLine, optimisticCount, readFinalCount, runCountLock, type FinalCount } from "../../src/features/finalcount/core.ts";
import { FINAL_COUNT_COPY } from "../../src/features/finalcount/copy.ts";
import { attendsFor, missingPerPerson, perPersonOn, personAnswersToSend, type Question } from "../../src/features/guest/rsvp.ts";
import { guestSeenAt, listNames, readGuestSeen, readRunsheetSeen, seenWhen, shouldStamp, viewerLabel, whenText } from "../../src/features/seen/core.ts";
import { SEEN_COPY } from "../../src/features/seen/copy.ts";
import { createOpenGate } from "../../src/lib/appOpenCore.ts";
import { hasKnowBefore, readKnowBefore } from "../../src/features/site/knowbeforeCore.ts";
import { KNOW_BEFORE_COPY } from "../../src/features/site/knowbeforeCopy.ts";
import { boardEmpty, isKnownPoint, legProblem, pointLabel, readGuestTravel, travelBody, EMPTY_LEG } from "../../src/features/travel/core.ts";
import { TRAVEL_COPY } from "../../src/features/travel/copy.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..", "..");
const src = (p: string) => readFileSync(join(APP, p), "utf8");

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
}

// ------------------------------------------------------------------ #1

// The shape of GET /couple/rsvps final_count (portal couple/rsvps/route.ts).
const FC_WIRE = {
  due: "2026-11-20",
  state: "soon",
  days: 3,
  locked_at: null,
  locked_by: null,
  can_lock: true,
  attending: 112,
  pending: 9,
  meals: [{ id: "q-menu", label: "Menu", options: [{ id: "beef", label: "Beef", count: 40 }, { id: "fish", label: "Fish", count: 12 }, { id: "veg", label: "Vegetarian", count: 0 }], no_choice: 3 }],
};

await test("#1 final_count reads; absent key hides the card", () => {
  const fc = readFinalCount({ items: [], final_count: FC_WIRE })!;
  assert.equal(fc.state, "soon");
  assert.equal(fc.days, 3);
  assert.equal(fc.meals[0].options.length, 3);
  assert.equal(readFinalCount({ items: [] }), null, "1.3.0 or flag off: nothing");
  assert.equal(readFinalCount(null), null);
  assert.equal(readFinalCount({ final_count: { state: "weird", locked_at: "2026-11-21T10:00:00Z" } })!.state, "locked");
});

await test("#1 the badge is an icon and a word for every state (never color alone)", () => {
  for (const state of ["locked", "overdue", "today", "soon", "upcoming", "none"] as const) {
    const b = countBadge({ state, days: 3 });
    assert.ok(b.icon, state);
    assert.equal(b.key, state);
  }
  assert.equal(countBadge({ state: "locked", days: null }).icon, "lock");
  assert.equal(countBadge({ state: "overdue", days: 2 }).tone, "red");
  for (const lang of ["en", "es"] as const) for (const k of ["locked", "overdue", "today", "upcoming", "none"] as const) assert.ok(FINAL_COUNT_COPY[lang].badges[k]);
});

await test("#1 menu line: counts above zero, then no choice yet", () => {
  assert.equal(mealLine(readFinalCount({ final_count: FC_WIRE })!.meals[0], "No choice yet"), "Beef 40, Fish 12, No choice yet 3");
});

await test("#1 'Locked {date}' is the day of the instant in the viewer's zone, not the UTC date", () => {
  // Locked at 20:30 in La Paz on Nov 5 = 00:30 UTC on Nov 6 (what the portal sends).
  const at = "2026-11-06T00:30:00+00:00";
  assert.equal(lockedDay(at, "en", "America/La_Paz"), "5 November");
  assert.equal(lockedDay(at, "es", "America/La_Paz"), "5 de noviembre");
  assert.equal(lockedDay(at, "en", "UTC"), "6 November");
  assert.equal(lockedDay("2026-11-05T13:00:00Z", "es", "America/La_Paz"), "5 de noviembre");
  assert.equal(lockedDay(null, "en"), "");
  assert.equal(lockedDay("not a date", "en"), "");
  // The card formats locked_at through it, never by slicing the ISO string.
  const card = src("src/features/finalcount/FinalCountCard.tsx");
  assert.match(card, /lockedDayOf\(fc\.locked_at, lang\)/);
  assert.doesNotMatch(card, /locked_at\.slice\(/);
});

await test("#1 optimistic lock and unlock", () => {
  const fc = readFinalCount({ final_count: FC_WIRE })!;
  const locked = optimisticCount(fc, true, "2026-11-17T12:00:00Z");
  assert.equal(locked.state, "locked");
  assert.equal(locked.locked_at, "2026-11-17T12:00:00Z");
  const back = optimisticCount(locked, false, "2026-11-17T12:00:05Z", fc);
  assert.equal(back.state, "soon", "Undo shows the state from before the lock");
  assert.equal(back.days, 3);
  assert.equal(back.locked_at, null);
});

await test("#1 lock under a network fault rolls back to exactly the previous count", async () => {
  const fc = readFinalCount({ final_count: FC_WIRE })!;
  const applied: FinalCount[] = [];
  const res = await runCountLock(fc, true, "2026-11-17T12:00:00Z", {
    apply: (x) => applied.push(x),
    send: async () => {
      assert.equal(applied.at(-1)?.state, "locked", "optimistic before the answer");
      throw Object.assign(new Error("offline"), { status: 0, code: "offline" });
    },
  });
  assert.equal(res.ok, false);
  assert.deepEqual(applied.at(-1), fc);
  // Success keeps the server's stamp.
  const ok: FinalCount[] = [];
  const r2 = await runCountLock(fc, true, "2026-11-17T12:00:00Z", { apply: (x) => ok.push(x), send: async () => ({ locked: true, locked_at: "2026-11-17T12:00:01Z" }) });
  assert.equal(r2.ok, true);
  assert.equal(ok.at(-1)?.locked_at, "2026-11-17T12:00:01Z");
});

const MENU: Question = { id: "q-menu", label: { en: "Menu" }, kind: "select", required: true, per_person: true, event_id: null, options: [{ id: "beef", label: { en: "Beef" } }, { id: "fish", label: { en: "Fish" } }] };
const KIDS: Question = { id: "q-kids", label: { en: "Kids menu" }, kind: "select", required: false, per_person: true, event_id: "ev-dinner", options: [{ id: "k1", label: { en: "Pasta" } }] };

await test("#1 per-person questions: only for a party of 2+, only people coming", () => {
  assert.equal(perPersonOn(MENU, 1), false, "single seat answers once");
  assert.equal(perPersonOn(MENU, 3), true);
  assert.equal(perPersonOn({ ...MENU, per_person: undefined }, 3), false, "1.3 payloads have no per_person");
  const seats = [{ cer: "attending" as const }, { cer: "declined" as const }, { cer: "attending" as const, "ev-dinner": "attending" as const }];
  assert.equal(attendsFor(seats[1], MENU), false);
  assert.equal(attendsFor(seats[2], KIDS), true);
  assert.equal(attendsFor(seats[0], KIDS), false);
  const missing = missingPerPerson([MENU, KIDS], seats, [{ "q-menu": "beef" }, {}, {}], 3);
  assert.deepEqual(missing, [{ person: 2, qid: "q-menu" }], "required, attending, unanswered only");
  const sent = personAnswersToSend([MENU, KIDS], seats, [{ "q-menu": "beef", "q-kids": "k1" }, { "q-menu": "fish" }, { "q-menu": "fish", "q-kids": "k1", "x": "y" }], 3);
  assert.deepEqual(sent, [{ "q-menu": "beef" }, undefined, { "q-menu": "fish", "q-kids": "k1" }], "not attending drops, unknown ids drop, event questions only for that event");
  assert.deepEqual(personAnswersToSend([MENU], seats, [{ "q-menu": "lobster" }], 3)[0], undefined, "an option the question lacks is never sent");
});

// ------------------------------------------------------------------ #37 + K21

await test("#37 seenWhen: the portal's wording rules (now, minutes, today, yesterday, weekday, date)", () => {
  const now = Date.parse("2026-11-05T18:00:00Z");
  const z = "UTC";
  assert.deepEqual(seenWhen("2026-11-05T17:59:30Z", "en", now, z), { kind: "now" });
  assert.deepEqual(seenWhen("2026-11-05T17:48:00Z", "en", now, z), { kind: "minutes", n: 12 });
  const today = seenWhen("2026-11-05T09:12:00Z", "es", now, z)!;
  assert.equal(today.kind, "today");
  assert.match((today as { time: string }).time, /^09:12$/, "Spanish 24-hour");
  assert.match((seenWhen("2026-11-05T09:12:00Z", "en", now, z) as { time: string }).time, /9:12\s?AM/);
  assert.equal(seenWhen("2026-11-04T20:00:00Z", "en", now, z)!.kind, "yesterday");
  assert.equal(seenWhen("2026-11-01T20:00:00Z", "en", now, z)!.kind, "weekday");
  const old = seenWhen("2025-12-24T20:00:00Z", "en", now, z)!;
  assert.equal(old.kind, "date");
  assert.match((old as { date: string }).date, /2025/, "another year shows the year");
  assert.equal(seenWhen("garbage", "en"), null);
  assert.equal(seenWhen(null, "en"), null);
  assert.equal(whenText({ kind: "minutes", n: 5 }, SEEN_COPY.es.when), "hace 5 min");
  assert.equal(whenText({ kind: "today", time: "18:04" }, SEEN_COPY.es.when), "hoy 18:04");
});

await test("#37 payload readers: missing key = feature off, null = never seen", () => {
  assert.deepEqual(guestSeenAt({}), { on: false, at: null }, "1.3.0 item");
  assert.deepEqual(guestSeenAt({ seen_at: null }), { on: true, at: null });
  assert.deepEqual(guestSeenAt({ seen_at: "2026-11-05T09:12:00Z" }), { on: true, at: "2026-11-05T09:12:00Z" });
  assert.equal(readGuestSeen({ detail: {} }), undefined);
  assert.equal(readGuestSeen({ detail: {}, seen: null }), null);
  assert.deepEqual(readGuestSeen({ seen: { first_seen_at: "2026-11-01T12:00:00Z", last_seen_at: "2026-11-04T18:04:00Z", views: 3 } }), { first_seen_at: "2026-11-01T12:00:00Z", last_seen_at: "2026-11-04T18:04:00Z", views: 3 });
  assert.equal(readRunsheetSeen({ days: [] }), null);
  assert.deepEqual(readRunsheetSeen({ seen: { state: "none" } }), { state: "none" });
  const cur = readRunsheetSeen({ seen: { state: "current", at: "2026-11-05T09:12:00Z", viewers: [{ name: "Ana", role: "owner", seen_at: "2026-11-05T09:12:00Z", current: true }, { name: "Rosa", role: "viewer", seen_at: "2026-11-04T09:00:00Z", current: false }] } })!;
  assert.equal(cur.state, "current");
});

await test("#37 a parent with view access is never read as the couple", () => {
  assert.equal(viewerLabel({ name: "Ana", role: "owner" }, SEEN_COPY.en.roles), "Ana");
  assert.equal(viewerLabel({ name: "Rosa", role: "viewer" }, SEEN_COPY.es.roles), "Rosa (solo lectura)");
  assert.equal(viewerLabel({ name: null, role: "admin" }, SEEN_COPY.en.roles), "an editor");
  assert.equal(listNames(["Ana", "Luis", "Rosa"], "and"), "Ana, Luis and Rosa");
  assert.equal(listNames(["Ana", "Luis"], "y"), "Ana y Luis");
});

await test("#37 the runsheet stamps once per focus and version, never without a version", () => {
  assert.equal(shouldStamp(undefined, null), false, "flag off or 1.3 payload: no version, no stamp");
  assert.equal(shouldStamp("", null), false);
  assert.equal(shouldStamp("abc123", null), true);
  assert.equal(shouldStamp("abc123", "abc123"), false, "a refetch with the same version is not an open");
  assert.equal(shouldStamp("def456", "abc123"), true, "a new version while open stamps again (as on the web)");
});

await test("K21: one open per launch or foreground; every refetch sends ?seen=0", () => {
  const g = createOpenGate();
  assert.equal(g.homePath(), "/guest/home", "cold start is an open");
  assert.equal(g.homePath(), "/guest/home?seen=0", "a refetch is not");
  assert.equal(g.homePath(), "/guest/home?seen=0");
  g.markOpen();
  assert.equal(g.homePath(), "/guest/home", "back to the foreground");
  g.restore();
  assert.equal(g.pending(), true, "a failed open fetch hands the open to the next one");
  assert.equal(g.homePath(), "/guest/home");
});

// ------------------------------------------------------------------ #45

const KB_WIRE = {
  type: "knowbefore",
  heading: "Know before you go",
  weather: "Warm days, cool nights (12 to 26 C).",
  packing: [{ key: "k1", text: "Sunscreen" }, { key: "k2", text: "A light jacket" }, { key: "", text: "no key" }],
  dress_note: "Comfortable shoes for the garden.",
  dress_all: null,
  dress_events: [{ id: "ev1", title: "Ceremony", code: "Formal" }, { id: "ev2", title: "Party", code: "Cocktail" }],
  entry: "Most visitors get a visa on arrival.",
  entry_link: "https://www.migracion.gob.bo",
  currency: ["Boliviano (BOB)", "Exchange at the airport"],
  tipping: "10% at restaurants.",
};

await test("#45 knowbefore reads cleanly; empty card hides; only https official links", () => {
  const kb = readKnowBefore(KB_WIRE)!;
  assert.equal(kb.packing.length, 2, "an item without a key cannot keep a tick: dropped");
  assert.equal(kb.dress_events.length, 2);
  assert.equal(hasKnowBefore(kb), true);
  assert.equal(readKnowBefore({ ...KB_WIRE, entry_link: "javascript:alert(1)" })!.entry_link, null);
  assert.equal(readKnowBefore({ ...KB_WIRE, entry_link: "http://x.gob" })!.entry_link, null);
  assert.equal(hasKnowBefore(readKnowBefore({ type: "knowbefore", heading: "x", packing: [], dress_events: [], currency: [] })), false, "a heading alone is not a card");
  assert.equal(readKnowBefore({ type: "custom", id: "knowbefore", body: "..." }), null, "1.3.0 gets a custom section, not this");
});

// ------------------------------------------------------------------ #26

const TRAVEL_WIRE = {
  enabled: true,
  required: true,
  wedding_date: "2026-11-27",
  points: [{ id: "vvi", label: "Viru Viru airport" }, { id: "hotel", label: "Hotel Los Tajibos" }],
  travel: { arrival: { date: "2026-11-26", time: "14:20", point: "vvi", ref: "AA 922" }, departure: { date: null, time: null, point: "My aunt's house", ref: null } },
};

await test("#26 guest travel reads; typed places stay typed; the body is clean", () => {
  const t = readGuestTravel(TRAVEL_WIRE)!;
  assert.equal(t.required, true);
  assert.equal(pointLabel(t.travel.arrival.point, t.points), "Viru Viru airport");
  assert.equal(pointLabel(t.travel.departure.point, t.points), "My aunt's house");
  assert.equal(isKnownPoint("vvi", t.points), true);
  assert.equal(isKnownPoint("My aunt's house", t.points), false);
  const b = travelBody({ ...t.travel.arrival, ref: "aa-922 <script>" }, EMPTY_LEG);
  assert.equal(b.travel.arrival.ref, "aa-922 script".slice(0, 12), "the server's alphabet, 12 characters");
  assert.deepEqual(b.travel.departure, { date: null, time: null, point: null, ref: null });
  assert.equal(legProblem({ date: null, time: "10:00", point: null, ref: null }), "time_needs_date");
  assert.equal(legProblem(t.travel.arrival), null);
  assert.equal(boardEmpty({ direction: "arrival", window_minutes: 60, totals: { parties: 0, people: 0 }, missing: 4, days: [], undated: [] }), true);
});

// ------------------------------------------------------------------ copy

const flat = (o: unknown, pre = ""): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (typeof v === "string") out[pre + k] = v;
    else if (v && typeof v === "object") Object.assign(out, flat(v, `${pre}${k}.`));
  }
  return out;
};

await test("copy: EN and ES keys and placeholders match; no dashes, no exclamation, no 'successfully'", () => {
  for (const [name, copy] of Object.entries({ FINAL_COUNT_COPY, SEEN_COPY, TRAVEL_COPY, KNOW_BEFORE_COPY })) {
    const en = flat(copy.en);
    const es = flat(copy.es);
    assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort(), name);
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const k of Object.keys(en)) {
      assert.equal(ph(en[k]), ph(es[k]), `${name}.${k} placeholders`);
      for (const v of [en[k], es[k]]) {
        assert.ok(!/[–—]/.test(v), `dash in ${name}.${k}`);
        assert.ok(!/[!¡]/.test(v), `exclamation in ${name}.${k}`);
        assert.ok(!/successfully|exitosamente|con éxito/i.test(v), `successfully in ${name}.${k}`);
        assert.ok(!/Guestly|Guest ly/.test(v), `brand in ${name}.${k}`);
      }
    }
  }
  // The portal's words, so the couple reads the same thing everywhere.
  assert.equal(FINAL_COUNT_COPY.en.lock, "Lock final count");
  assert.equal(FINAL_COUNT_COPY.es.lock, "Cerrar conteo final");
  assert.equal(FINAL_COUNT_COPY.en.closedTitle, "Responses are closed");
  assert.equal(SEEN_COPY.es.notSeen, "Sin ver todavía");
  assert.equal(TRAVEL_COPY.es.title, "Tu viaje");
  assert.equal(KNOW_BEFORE_COPY.es.heading, "Antes de ir");
  assert.equal(KNOW_BEFORE_COPY.en.checkPassport, "Check the official requirements for your passport.");
});

// ------------------------------------------------------------------ static: hide when off

await test("screens hide when the flag is off or the route answers 404", () => {
  const hooks = src("src/features/travel/hooks.ts");
  assert.match(hooks, /isMissingEndpoint\(err\)\) return null/, "travel routes: 404 reads as not here");
  const list = src("src/features/guests/GuestsList.tsx");
  assert.match(list, /useCoupleArrivals\(featureOn\(user\?\.me, "MW_TRAVEL_WINDOWS"\)\)/);
  assert.match(list, /arrivals\.data \? <MenuRow/);
  assert.match(src("src/features/finalcount/FinalCountCard.tsx"), /if \(!fc\) return null/);
  assert.match(src("src/features/seen/useRunsheetStamp.ts"), /isMissingEndpoint\(err\)\) missing = true/);
  assert.match(src("src/features/seen/Seen.tsx"), /if \(seen === undefined\) return null/);
  assert.match(src("src/features/site/knowbefore.tsx"), /if \(!hasKnowBefore\(s\)\) return null/);
  assert.match(src("src/features/planner/Weddings.tsx"), /arrivals\.data \?/);
  // K21: Home goes through the open gate.
  assert.match(src("src/lib/hooks.ts"), /queryFn: \(\) => fetchGuestHome<GuestHome>\(\)/);
  // count_locked turns the RSVP into the closed card (every build gets the 423).
  assert.match(src("src/app/guest/(index)/rsvp/index.tsx"), /err\.code === "count_locked"/);
  // Lock is Undo, not a confirm.
  assert.doesNotMatch(src("src/features/finalcount/FinalCountCard.tsx"), /Alert\.alert/);
  // The website editor lists only types it knows (K9: unknown types are kept, not listed).
  assert.match(src("src/app/couple/(tools)/website/index.tsx"), /KNOWN_SECTION_TYPES\.includes\(s\.type\)/);
});

console.log(`guests-mw: ${passed} checks passed`);

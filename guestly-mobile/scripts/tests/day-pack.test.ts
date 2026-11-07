// Run: node --experimental-strip-types scripts/tests/day-pack.test.ts
// The Day pack rules (#30, STUDY-app-offline Part D) on recorded fixtures of
// the D1 contract, plus the 300 ms open budget on the stress pack.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parsePack,
  parseGuestPack,
  utf8Bytes,
  formatSize,
  daysBetween,
  refreshDue,
  inPackWindow,
  packExpired,
  isPackDay,
  dayBeforePrompt,
  clockOffset,
  packBanner,
  timelineChanges,
  withPendingStatus,
  fold,
  rosterIndex,
  searchRoster,
  doorCounts,
  PACK_REFRESH_MS,
  STALE_AFTER_MS,
  nextMiss,
  lastCheckAt,
  keepOnMissing,
  type PackMiss,
} from "../../src/features/dayof/packCore.ts";
import { liveState, wallClockAt, serviceDayOf } from "../../src/features/dayof/live.ts";
import { DAYOF_COPY } from "../../src/features/dayof/copy.ts";
import { bigPack } from "./fixtures/dayof/big-pack.ts";
import { classifyFailure } from "../../src/lib/queueMath.ts";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/dayof");
const rec = (name: string) => JSON.parse(fs.readFileSync(path.join(DIR, name), "utf8")) as { status: number; headers: Record<string, string>; body: { ok: boolean; data?: unknown } | null };

// ---------------------------------------------------------------- parsing (D1)

const couple = parsePack(rec("couple-pack-200.json").body!.data);
assert.ok(couple, "couple pack parses");
assert.equal(couple.meta.version, "v-3f9a1c");
assert.equal(couple.meta.tz, "America/La_Paz");
assert.equal(couple.meta.valid_until, "2027-05-23");
assert.equal(couple.meta.can_mark_status, true);
assert.equal(couple.runsheet.length, 8);
assert.equal(couple.roster?.length, 3);
assert.equal(couple.vendors[0].phone, "+59170000001", "vendor phones are in the pack (dialer offline)");
assert.equal(couple.places[0].name, "Villa Arenisca");
assert.equal(couple.seating?.tables.length, 2);
assert.deepEqual(Object.keys(couple.reserved).sort(), ["ceremony", "know_before_you_go", "slots"], "D1 reserved fields kept as sent");

// The planner answer wraps it as { pack }, no roster without the guests view, D28 says no marking.
const planner = parsePack(rec("planner-pack-200.json").body!.data);
assert.ok(planner);
assert.equal(planner.roster, null);
assert.equal(planner.meta.can_mark_status, false);

// Guest pack: the schedule keeps the /guest/schedule event shape.
const guest = parseGuestPack(rec("guest-pack-200.json").body!.data);
assert.ok(guest);
assert.equal(guest.schedule.length, 1);
assert.equal(guest.schedule[0].title, "Ceremony");
assert.equal(guest.table, "Table 1");
assert.equal(guest.couple_names, "Valentina & Mateo");

// Tolerant: odd rows dropped, missing lists read empty, no meta.version = no pack.
assert.equal(parsePack(null), null);
assert.equal(parsePack({}), null);
assert.equal(parsePack({ meta: { tz: "UTC" } }), null);
const thin = parsePack({ meta: { version: "x" }, runsheet: [{ id: "a", starts_at: "10:00", day: "2027-05-22" }, { id: "", starts_at: "11:00" }, null, 4], roster: [{ id: "g", name: "  " }, { id: "h", name: "Ana", party_size: 0 }] });
assert.ok(thin);
assert.equal(thin.runsheet.length, 1);
assert.equal(thin.runsheet[0].status, "planned");
assert.equal(thin.roster?.length, 1);
assert.equal(thin.roster?.[0].party_size, 1, "a party is never 0 people");
assert.equal(thin.meta.tz, "America/La_Paz", "missing zone falls back to the product default");
assert.deepEqual(thin.vendors, []);
assert.equal(thin.seating, null);

// 304 and the dark 404 carry no pack.
assert.equal(rec("couple-pack-304.json").status, 304);
assert.equal(rec("couple-pack-304.json").body, null);
assert.equal(rec("pack-404-dark.json").status, 404);

// Answers recorded from Lane 1's routes on the local stack (Nov 7 2026,
// day-pack-contract.test.ts with GL_RECORD=1): the real shapes parse.
{
  const local = (name: string) => (fs.existsSync(path.join(DIR, `local-${name}.json`)) ? rec(`local-${name}.json`) : null);
  const lc = local("couple-pack-200");
  assert.ok(lc, "recorded couple pack present");
  const lcp = parsePack(lc!.body!.data)!;
  assert.ok(lcp && lcp.runsheet.length > 0 && Array.isArray(lcp.roster), "recorded couple pack parses, with moments and a roster");
  assert.equal(lc!.headers.etag, `"${lcp.meta.version}"`, "recorded ETag is the quoted version");
  assert.equal(typeof lcp.meta.can_mark_status, "boolean");
  const lp = parsePack(local("planner-pack-200")!.body!.data);
  assert.ok(lp && !("pack" in (local("planner-pack-200")!.body!.data as object)), "recorded planner pack is bare and parses");
  const lg = parseGuestPack(local("guest-pack-200")!.body!.data);
  assert.ok(lg && lg.pass_qr, "recorded guest pack parses");
  const l304 = local("couple-pack-304")!;
  assert.equal(l304.status, 304);
  assert.equal(l304.body, null, "304 has no body");
  const gone = local("status-404-gone")!;
  assert.equal(classifyFailure("block_status", { status: gone.status, code: String((gone.body as { error?: { code?: string } }).error?.code) }), "gone");
}

// ---------------------------------------------------------------- Now and Next from the pack, offline

const meta = couple.meta;
const offset = clockOffset(meta.server_now, Date.parse("2027-05-22T20:11:59.000Z"), Date.parse("2027-05-22T20:12:01.000Z"));
assert.equal(offset, 0, "under 2 s of skew reads as none");
assert.equal(clockOffset("2027-05-22T20:12:00.000Z", Date.parse("2027-05-22T20:02:00.000Z"), Date.parse("2027-05-22T20:02:00.000Z")), 600_000, "a phone 10 min slow is corrected");
assert.equal(clockOffset(null, 0, 0), 0);

const at = Date.parse("2027-05-22T20:12:00.000Z"); // 16:12 in La Paz, the mockup's frozen clock
const live = liveState(couple.runsheet, { now: at, timeZone: meta.tz });
assert.deepEqual(live.current.map((b) => b.id), ["b-arrive", "b-shuttle"], "two blocks under Now, latest start first");
assert.equal(live.minutesLeft, 18, "Guests arrive: 18 min left");
assert.equal(live.next?.id, "b-ceremony");
assert.equal(live.minutesToNext, 18);
assert.equal(live.items[live.items.length - 1].block.id, "b-last", "00:30 sorts last");
assert.equal(live.states["b-last"], "later", "the 00:30 block is later at 16:12, not done");
assert.equal(live.states["b-hair"], "done");
assert.ok(isPackDay(couple, live.serviceDay));
// Gap before the first dance: dinner ends 20:15, dance at 20:30.
assert.ok(live.gaps.some((g) => g.beforeId === "b-dance" && g.minutes === 15), "Between: 15 min before the first dance");
// Minutes tick with no network: the same pack a minute later.
assert.equal(liveState(couple.runsheet, { now: at + 60_000, timeZone: meta.tz }).minutesLeft, 17);

// The outbox overlay: a queued tap shows at once and is marked waiting.
const { blocks: overlaid, waiting } = withPendingStatus(couple.runsheet, [{ block_id: "b-arrive", status: "done" }, { block_id: "b-x", status: "done" }]);
assert.equal(overlaid.find((b) => b.id === "b-arrive")?.status, "done");
assert.ok(waiting.has("b-arrive"));
assert.ok(!waiting.has("b-x"), "a tap for a block the pack no longer has is not shown");
assert.deepEqual(liveState(overlaid, { now: at, timeZone: meta.tz }).current.map((b) => b.id), ["b-shuttle"], "marked done leaves Now");
// The last tap per block wins (done, then Undo).
assert.equal(withPendingStatus(couple.runsheet, [{ block_id: "b-arrive", status: "done" }, { block_id: "b-arrive", status: "planned" }]).blocks.find((b) => b.id === "b-arrive")?.status, "planned");

// ---------------------------------------------------------------- download rules (D2)

assert.equal(daysBetween("2027-05-15", "2027-05-22"), 7);
assert.equal(daysBetween("2027-05-22", "2027-05-15"), -7);
assert.equal(daysBetween("bad", "2027-05-22"), null);
const now = Date.parse("2027-05-15T12:00:00Z");
assert.equal(refreshDue({ today: "2027-05-14", weddingDate: "2027-05-22", lastCheckedAt: null, now }), false, "8 days out: no automatic fetch");
assert.equal(refreshDue({ today: "2027-05-15", weddingDate: "2027-05-22", lastCheckedAt: null, now }), true, "7 days out: fetch");
assert.equal(refreshDue({ today: "2027-05-22", weddingDate: "2027-05-22", lastCheckedAt: now - 5 * 60_000, now }), false, "checked 5 min ago");
assert.equal(refreshDue({ today: "2027-05-22", weddingDate: "2027-05-22", lastCheckedAt: now - PACK_REFRESH_MS, now }), true, "every 15 min on the day");
assert.equal(refreshDue({ today: "2027-05-10", weddingDate: "2027-05-22", lastCheckedAt: null, now, force: true }), true, "pull to refresh always fetches");
assert.equal(refreshDue({ today: "2027-05-24", weddingDate: "2027-05-22", lastUseful: "2027-05-23", lastCheckedAt: null, now }), false, "after the last useful day");
assert.equal(refreshDue({ today: "2027-05-23", weddingDate: "2027-05-22", lastUseful: "2027-05-23", lastCheckedAt: null, now }), true, "the morning after still refreshes");
assert.equal(refreshDue({ today: "2027-05-20", weddingDate: null, lastCheckedAt: null, now }), false, "no date, no automatic fetch");
assert.equal(inPackWindow("2027-05-23", "2027-05-22", null), true, "default last day is the wedding day plus one");
assert.equal(inPackWindow("2027-05-24", "2027-05-22", null), false);

// K24: a pack lives to its last useful day, not 24 hours. Saved three days before, still there on the day.
assert.equal(packExpired(meta, "2027-05-19"), false);
assert.equal(packExpired(meta, "2027-05-22"), false);
assert.equal(packExpired(meta, "2027-05-23"), false);
assert.equal(packExpired(meta, "2027-05-24"), true, "deleted the day after valid_until");
assert.equal(packExpired({ valid_until: null, wedding_date: "2027-05-22" }, "2027-05-24"), true);
assert.equal(packExpired({ valid_until: null, wedding_date: null }, "2030-01-01"), false);

assert.equal(isPackDay(couple, "2027-05-21"), false);
assert.equal(isPackDay({ meta: { ...meta, valid_until: "2027-05-25" }, runsheet: [] }, "2027-05-24"), true, "a 3-day weekend counts every day before valid_until");
assert.equal(isPackDay({ meta: { ...meta, valid_until: null }, runsheet: [] }, "2027-05-22"), true);

assert.deepEqual(dayBeforePrompt("2027-05-22"), { day: "2027-05-21", minutes: 19 * 60 }, "the evening before, 19:00 venue time");
assert.deepEqual(dayBeforePrompt("2027-03-01"), { day: "2027-02-28", minutes: 19 * 60 });
assert.equal(dayBeforePrompt(null), null);

// ---------------------------------------------------------------- staleness banner (D5)

const saved = Date.parse("2027-05-22T18:10:00Z");
assert.deepEqual(packBanner({ online: false, savedAt: saved, now: saved + 60_000, packDay: true }), { kind: "offline", savedAt: saved });
assert.deepEqual(packBanner({ online: true, savedAt: saved, now: saved + STALE_AFTER_MS - 1, packDay: true }), { kind: "none" });
assert.deepEqual(packBanner({ online: true, savedAt: saved, now: saved + STALE_AFTER_MS + 1, packDay: true }), { kind: "stale", savedAt: saved }, "on the day, refresh failing past 30 min");
assert.deepEqual(packBanner({ online: true, savedAt: saved, now: saved + 5 * STALE_AFTER_MS, packDay: false }), { kind: "none" }, "a week before, an old pack is fine");
assert.deepEqual(packBanner({ online: false, savedAt: null, now: saved, packDay: true }), { kind: "missing" }, "not saved, offline on the day: red");
assert.deepEqual(packBanner({ online: true, savedAt: null, now: saved, packDay: true }), { kind: "none" }, "online and downloading: no red flash");
assert.deepEqual(packBanner({ online: true, savedAt: null, now: saved, packDay: true, refreshFailed: true }), { kind: "missing" });

// "Updated. 2 timeline changes."
const moved = couple.runsheet.map((b) => (b.id === "b-ceremony" ? { ...b, starts_at: "16:40" } : b)).filter((b) => b.id !== "b-dance");
assert.equal(timelineChanges(couple.runsheet, moved), 2);
assert.equal(timelineChanges(couple.runsheet, couple.runsheet.map((b) => ({ ...b }))), 0, "nothing changed: no toast");
assert.equal(timelineChanges(couple.runsheet, couple.runsheet.map((b) => ({ ...b, updated_at: "2027-05-22T21:00:00Z" }))), 0, "a touch with no visible change is not a change");

// ---------------------------------------------------------------- door search (D3, K24)

assert.equal(fold("Sofía"), "sofia");
assert.equal(fold("SOFÍA"), "sofia");
assert.equal(fold("Sofía"), "sofia", "a combining accent folds too");
assert.equal(fold("Núñez Ibáñez"), "nunez ibanez");
const idx = rosterIndex(couple.roster!);
const names = (q: string) => searchRoster(idx, q).map((g) => g.name);
assert.deepEqual(names("sofia"), ["Sofía Ríos"], "Sofía typed sofia, offline");
assert.deepEqual(names("SOFIA"), ["Sofía Ríos"]);
assert.deepEqual(names("rios"), ["Sofía Ríos"]);
assert.deepEqual(names("andres"), ["Sofía Ríos"], "a member's name finds the party");
assert.deepEqual(names("jose maria"), ["José María Peña y Lillo"]);
assert.deepEqual(names("pena"), ["José María Peña y Lillo"]);
assert.deepEqual(names("nun"), ["Mateo Núñez"]);
assert.deepEqual(names("s"), [], "one letter: no search (the hint shows, not 'no results')");
assert.deepEqual(names("zz"), [], "a real empty answer");
assert.equal(idx.byId.get("11111111-1111-4111-8111-111111111111")?.table, "Table 1", "an offline scan finds name, party and table");

// "142 in, 3 waiting to sync": a queued party already in on the server is not counted twice.
const counts = doorCounts({ serverIn: 1, total: 3, roster: couple.roster, queuedGuestIds: ["11111111-1111-4111-8111-111111111111", "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"] });
assert.deepEqual(counts, { in: 1, total: 3, waiting: 1 });
assert.deepEqual(doorCounts({ serverIn: null, total: null, roster: couple.roster, queuedGuestIds: [] }), { in: 1, total: 3, waiting: 0 }, "offline: the pack's own count");
assert.deepEqual(doorCounts({ serverIn: null, total: null, roster: null, queuedGuestIds: ["a"] }), { in: 0, total: null, waiting: 1 });

// ---------------------------------------------------------------- size

assert.equal(utf8Bytes("abc"), 3);
assert.equal(utf8Bytes("ñ"), 2);
assert.equal(utf8Bytes("€"), 3);
assert.equal(utf8Bytes("😀"), 4);
assert.equal(formatSize(10, "en"), "1 KB");
assert.equal(formatSize(186_000, "en"), "182 KB");
assert.equal(formatSize(1_300_000, "en"), "1.2 MB");
assert.equal(formatSize(1_300_000, "es"), "1,2 MB");

// ---------------------------------------------------------------- copy

const en = DAYOF_COPY.en;
const es = DAYOF_COPY.es;
assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort(), "EN and ES have the same keys");
assert.equal(en.locked, "Your planner marks the timeline on the day.", "D28 sentence, word for word");
assert.equal(es.locked, "Tu planner marca el cronograma el día de la boda.");
for (const [lang, dict] of [["en", en], ["es", es]] as const) {
  for (const [k, v] of Object.entries(dict)) {
    assert.ok(!/[\u2013\u2014]/.test(v), `${lang}.${k}: no em or en dash`);
    assert.ok(!/!/.test(v), `${lang}.${k}: no exclamation mark`);
    assert.ok(!/\bGuestly\b|Guest ly/.test(v), `${lang}.${k}: brand with the hyphen`);
    assert.ok(!/successfully|exitosamente|con éxito|Oops/i.test(v), `${lang}.${k}: no banned words`);
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    assert.equal(vars(v), vars((lang === "en" ? es : en)[k as keyof typeof en]), `${lang}.${k}: same placeholders in both languages`);
  }
}

// ---------------------------------------------------------------- 404 answers (review round 1)

// The portal answers 404 when MW_DAY_PACK is off, and also when it cannot read
// its flags for a moment (flagSnapshot returns null on a read error). This is
// packStore.fetchPack's 404/200/304 path over the pure rules, on one pack.
{
  type Disk = { pack: typeof couple | null; checkedAt: number | null; miss: PackMiss | null };
  const answer = (d: Disk, status: 200 | 304 | 404, at: number, today: string): Disk => {
    if (status !== 404) return { pack: status === 200 ? couple : d.pack, checkedAt: at, miss: null };
    const miss = nextMiss(d.miss, at);
    if (d.pack && keepOnMissing({ saved: d.pack, today, miss, now: at })) return { ...d, miss };
    return { pack: null, checkedAt: null, miss };
  };
  const due = (d: Disk, at: number, today: string) => refreshDue({ today, weddingDate: "2027-05-22", lastCheckedAt: lastCheckAt(d.checkedAt, d.miss), now: at });
  const t0 = Date.parse("2027-05-22T18:00:00Z");
  const MIN = 60_000;

  // On the wedding day: one 404 keeps the saved pack, the next 200 restores the normal state.
  let d: Disk = { pack: couple, checkedAt: t0 - 20 * MIN, miss: null };
  d = answer(d, 404, t0, "2027-05-22");
  assert.ok(d.pack, "a 404 on the wedding day keeps the saved pack");
  assert.equal(due(d, t0 + MIN, "2027-05-22"), false, "after a 404 the one-minute check does not ask again");
  assert.equal(due(d, t0 + PACK_REFRESH_MS, "2027-05-22"), true, "15 minutes later it asks again");
  d = answer(d, 404, t0 + PACK_REFRESH_MS, "2027-05-22");
  d = answer(d, 404, t0 + 2 * PACK_REFRESH_MS, "2027-05-22");
  assert.ok(d.pack, "on the wedding day repeated 404s never delete it (only expiry does)");
  d = answer(d, 200, t0 + 3 * PACK_REFRESH_MS, "2027-05-22");
  assert.ok(d.pack && d.miss === null, "a 200 clears the 404 record");
  assert.equal(packExpired(couple.meta, "2027-05-24"), true, "expiry still removes it");

  // In the week before: one blip keeps it; 404s for 15 minutes mean the flag is really off.
  let w: Disk = { pack: couple, checkedAt: t0, miss: null };
  w = answer(w, 404, t0, "2027-05-18");
  assert.ok(w.pack, "one 404 the week before keeps the pack");
  w = answer(w, 404, t0 + 5 * MIN, "2027-05-18");
  assert.ok(w.pack, "a forced retry 5 minutes later keeps it too");
  w = answer(w, 304, t0 + 6 * MIN, "2027-05-18");
  assert.ok(w.pack && w.miss === null, "a 304 clears the 404 record");
  w = answer(w, 404, t0 + 20 * MIN, "2027-05-18");
  w = answer(w, 404, t0 + 20 * MIN + PACK_REFRESH_MS, "2027-05-18");
  assert.equal(w.pack, null, "404s 15 minutes apart the week before: deleted");

  // Nothing saved (a guest, or a planner's other wedding with the flag off): once per 15 minutes, not every minute.
  let g: Disk = { pack: null, checkedAt: null, miss: null };
  let asked = 0;
  for (let m = 0; m < 60; m++) {
    const at = t0 + m * MIN;
    if (due(g, at, "2027-05-18")) {
      asked++;
      g = answer(g, 404, at, "2027-05-18");
    }
  }
  assert.equal(asked, 4, "a dark route is asked 4 times in an hour of one-minute checks");
  assert.equal(lastCheckAt(null, null), null);
  assert.equal(lastCheckAt(5, { firstAt: 1, lastAt: 9 }), 9);
  assert.equal(lastCheckAt(9, { firstAt: 1, lastAt: 5 }), 9);
  assert.equal(keepOnMissing({ saved: null, today: "2027-05-22", miss: nextMiss(null, t0), now: t0 }), false);
  // The guest pack (no runsheet) is kept on the wedding day too.
  assert.equal(keepOnMissing({ saved: { meta: couple.meta }, today: "2027-05-22", miss: { firstAt: t0 - 3_600_000, lastAt: t0 }, now: t0 }), true);
}

// ---------------------------------------------------------------- sign out removes the packs (D4.8)

// The store needs React Native, so this reads its source: the pack and the
// evening-before reminder keys must sit under a prefix lib/scope.ts deletes.
const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../src");
const storeSrc = fs.readFileSync(path.join(SRC, "features/dayof/packStore.ts"), "utf8");
const syncSrc = fs.readFileSync(path.join(SRC, "features/dayof/PackSync.tsx"), "utf8");
const scopeSrc = fs.readFileSync(path.join(SRC, "lib/scope.ts"), "utf8");
assert.match(storeSrc, /const PREFIX = "gl\.scoped\.daypack\.v1:"/);
assert.match(storeSrc, /const MISS_PREFIX = "gl\.scoped\.daypack\.miss\.v1:"/, "the 404 record goes on sign out too");
// The store wires the pure rules: a 404 drops the pack only when keepOnMissing says so; 200 and 304 clear the 404 record; the 15 minute rule counts 404s.
assert.match(storeSrc, /if \(saved && keepOnMissing\(\{[^}]*\}\)\) \{[\s\S]{0,160}?return \{ kind: "failed"[\s\S]{0,80}?await dropPack\(key\)/);
assert.equal((storeSrc.match(/await clearMiss\(owner, slug\)/g) ?? []).length, 2, "200 and 304 clear the 404 record");
assert.match(storeSrc, /return lastCheckAt\(checkedAt, await readMiss\(owner, slug\)\)/);
assert.match(syncSrc, /`gl\.scoped\.dayprompt:/);
assert.match(scopeSrc, /PREFIXES = \[[^\]]*"gl\.scoped\."/, "resetUserScopedState removes gl.scoped.* on sign out");

// ---------------------------------------------------------------- the 300 ms open (STUDY-quality-bar 7.5)

// What a cold open of the day-of or the door does with a saved pack: read the
// stored text, parse it, normalize it, build the door index, compute Now and
// Next, run one search. 500 parties, 40 blocks.
const big = bigPack(500, 40);
const stored = JSON.stringify({ v: 1, kind: "couple", slug: "big-wedding", savedAt: 0, checkedAt: 0, etag: '"v-big"', bytes: 0, offsetMs: 0, raw: big });
const bytes = utf8Bytes(stored);
assert.ok(bytes < 5 * 1024 * 1024, "under 5 MB without photos");
function openOnce(): number {
  const t0 = performance.now();
  const rec = JSON.parse(stored) as { raw: unknown };
  const pack = parsePack(rec.raw)!;
  const index = rosterIndex(pack.roster!);
  const state = liveState(pack.runsheet, { now: at, timeZone: pack.meta.tz });
  const hits = searchRoster(index, "sofia");
  const t1 = performance.now();
  assert.equal(pack.roster!.length, 500);
  assert.equal(pack.runsheet.length, 40);
  assert.ok(state.items.length > 0);
  assert.ok(hits.length > 0);
  return t1 - t0;
}
openOnce(); // warm the code paths once, as a second open on the phone would be
const runs = Array.from({ length: 9 }, openOnce).sort((a, b) => a - b);
const median = runs[4];
const worst = runs[runs.length - 1];
assert.ok(median < 300, `pack opens in ${median.toFixed(1)} ms (budget 300 ms)`);
// Node is faster than Hermes on a phone: hold a 4x margin so the device budget stays met.
assert.ok(median < 75, `pack opens in ${median.toFixed(1)} ms; keep under 75 ms in node for a 4x device margin`);

// The wall clock helpers the screens use agree with the pack's zone.
const wc = wallClockAt(at, "America/La_Paz");
assert.equal(serviceDayOf(wc.day, wc.minutes), "2027-05-22");

console.log(`day-pack: ok (stress pack ${formatSize(bytes, "en")}, open median ${median.toFixed(1)} ms, worst ${worst.toFixed(1)} ms over 9 runs)`);

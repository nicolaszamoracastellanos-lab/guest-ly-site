// Run: node --experimental-strip-types scripts/tests/outbox.test.ts
// The #30 outbox (check-ins and block status taps) on recorded answers of the
// D1/D4 contract: the real replay loop and settle rules from lib/queueMath,
// against a fake portal that is idempotent on client_event_id like
// checkin-core.ts and the block status route.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyFailure, HELD_TTL_MS, heldExpired, outcomeFor, replay, settle, timedDrainDue, type Outcome } from "../../src/lib/queueMath.ts";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/dayof");
type Rec = { status: number; body: { ok: boolean; data?: unknown; error?: { code: string; message_en?: string; reason?: string } } | null };
const rec = (name: string) => JSON.parse(fs.readFileSync(path.join(DIR, name), "utf8")) as Rec;
const failure = (r: Rec) => ({ status: r.status, code: r.body?.error?.code ?? `http_${r.status}`, reason: r.body?.error?.reason ?? null, message_en: r.body?.error?.message_en ?? null });

// ---------------------------------------------------------------- classification

const locked = failure(rec("status-423-locked.json"));
const gone = failure(rec("status-404-gone.json"));
const workspace = failure(rec("workspace-423.json"));
assert.equal(classifyFailure("block_status", locked), "locked", "runsheet_locked is final for a status tap (D28)");
assert.equal(classifyFailure("checkin", locked), "refused");
assert.equal(classifyFailure("block_status", gone), "gone", "a block deleted on the web");
// The status route's dark 404 (MW_DAY_PACK off, or the portal's flag read
// failed for a moment) has the same code: the tap is held, never named as deleted.
const dark = { status: 404, code: "not_found", message_en: "Not found." };
assert.equal(classifyFailure("block_status", dark), "held", "a dark status route keeps the tap");
assert.equal(classifyFailure("block_status", { status: 404, code: "not_found" }), "held", "a bare not_found is not a deleted moment");
assert.equal(classifyFailure("block_status", { status: 404, code: "not_found", reason: "block_gone", message_en: "Anything." }), "gone", "the reason code asked of Lane 1, once it lands");
assert.deepEqual(outcomeFor("held"), { kind: "held" });
assert.equal(classifyFailure("block_status", { status: 410, code: "gone" }), "gone");
assert.equal(classifyFailure("block_status", { status: 404, code: "http_404" }), "refused", "the host's 404 page is a missing route, not a deleted block");
assert.equal(classifyFailure("block_status", workspace), "refused", "an unpaid workspace is a refusal, not the D28 sentence");
assert.equal(classifyFailure("checkin", { status: 404, code: "not_found" }), "refused", "a removed guest at the door");
for (const f of [{ status: 0, code: "offline" }, { status: 0, code: "timeout" }, { status: 401, code: "unauthorized" }, { status: 408, code: "http_408" }, { status: 429, code: "rate_limited" }, { status: 500, code: "server_error" }, { status: 503, code: "http_503" }]) {
  assert.equal(classifyFailure("checkin", f), "retry", `${f.status} keeps a check-in`);
  assert.equal(classifyFailure("block_status", f), "retry", `${f.status} keeps a status tap`);
}
assert.equal(classifyFailure("block_status", null), "retry", "not an API answer: keep it");
assert.deepEqual(outcomeFor("locked"), { kind: "refused", reason: "locked" });
assert.deepEqual(outcomeFor("refused"), { kind: "refused" });

// ---------------------------------------------------------------- a fake portal

class Fail extends Error {
  status: number;
  code: string;
  message_en: string | null;
  constructor(status: number, code: string, messageEn: string | null = null) {
    super(code);
    this.status = status;
    this.code = code;
    this.message_en = messageEn;
  }
}
const failureOf = (err: unknown) => (err instanceof Fail ? { status: err.status, code: err.code, message_en: err.message_en } : null);

type Checkin = { kind?: "checkin"; client_event_id: string; guest_id: string; seats: number; scanned_at: string; name: string };
type Status = { kind: "block_status"; client_event_id: string; block_id: string; status: string; tapped_at: string; base_updated_at: string | null; name: string };
type Item = Checkin | Status;

function portal(opts: { locked?: boolean; deleted?: Set<string>; down?: boolean; dark?: boolean } = {}) {
  const checkins = new Map<string, { guest_id: string; scanned_at: string }>(); // by client_event_id
  const stamped = new Map<string, string>(); // guests.checked_in_at, from scanned_at (D4.6)
  const statuses = new Map<string, { status: string; tapped_at: string }>();
  const seen = new Set<string>();
  const log: string[] = [];
  const send = async (item: Item): Promise<unknown> => {
    if (opts.down) throw new Fail(0, "offline");
    log.push(item.client_event_id);
    if (item.kind === "block_status") {
      if (opts.dark) throw new Fail(404, "not_found", "Not found.");
      if (opts.deleted?.has(item.block_id)) throw new Fail(404, "not_found", "That moment was deleted.");
      if (opts.locked) throw new Fail(423, "runsheet_locked");
      if (seen.has(item.client_event_id)) return { replayed: true };
      seen.add(item.client_event_id);
      const prev = statuses.get(item.block_id);
      // Last tap wins on status (D4.4).
      if (!prev || prev.tapped_at <= item.tapped_at) statuses.set(item.block_id, { status: item.status, tapped_at: item.tapped_at });
      return { replayed: false };
    }
    const dup = checkins.get(item.client_event_id);
    if (dup) return { already: true, replayed: true, checked_in_at: dup.scanned_at };
    const already = stamped.has(item.guest_id);
    checkins.set(item.client_event_id, { guest_id: item.guest_id, scanned_at: item.scanned_at });
    if (!already) stamped.set(item.guest_id, item.scanned_at);
    return { already, replayed: false, checked_in_at: stamped.get(item.guest_id) };
  };
  return { send, checkins, stamped, statuses, log, opts };
}

// ---------------------------------------------------------------- 20 offline scans (D6)

const base = Date.parse("2027-05-22T19:00:00.000Z");
const scans: Checkin[] = Array.from({ length: 20 }, (_, i) => ({
  client_event_id: `scan-${String(i).padStart(2, "0")}`,
  guest_id: `g-${i}`,
  seats: 2,
  scanned_at: new Date(base + i * 45_000).toISOString(),
  name: `Guest ${i}`,
}));

// Airplane mode: the drain stops at the first entry and settles nothing.
const p = portal({ down: true });
let outcomes = await replay(scans, p.send, failureOf);
assert.deepEqual(outcomes, [{ kind: "retry" }]);
let s = settle(scans, outcomes);
assert.equal(s.done.size, 0, "nothing dropped while offline");

// The network returns: every scan goes once, in order, with its own scan time.
p.opts.down = false;
outcomes = await replay(scans, p.send, failureOf);
s = settle(scans, outcomes);
assert.equal(s.sent, 20);
assert.equal(s.done.size, 20);
assert.deepEqual(p.log, scans.map((x) => x.client_event_id), "sent in scan order");
assert.equal(p.checkins.size, 20, "0 duplicates");
for (const x of scans) assert.equal(p.stamped.get(x.guest_id), x.scanned_at, `${x.name}: arrival time is the scan time, not the sync time`);
assert.deepEqual(s.already, [], "a replay of this very scan is not a conflict");

// The answers were lost on the way back: the same drain runs again. Still 20 rows, no conflicts reported.
outcomes = await replay(scans, p.send, failureOf);
s = settle(scans, outcomes);
assert.equal(p.checkins.size, 20, "replay is a no-op on the portal");
assert.deepEqual(s.already, []);

// Another phone scanned Guest 3 first: reported by name, not an error.
const other = portal();
await other.send({ client_event_id: "other-phone", guest_id: "g-3", seats: 2, scanned_at: new Date(base).toISOString(), name: "Guest 3" });
outcomes = await replay(scans.slice(0, 5), other.send, failureOf);
s = settle(scans.slice(0, 5), outcomes);
assert.deepEqual(s.already, ["Guest 3"]);
assert.equal(other.stamped.get("g-3"), new Date(base).toISOString(), "the first door's time stays");

// The recorded replay answer reads as a replay, not a conflict.
const replayed = rec("checkin-200-replayed.json").body!.data as { already: boolean; replayed: boolean };
outcomes = await replay([scans[0]], async () => replayed, failureOf);
assert.deepEqual(outcomes, [{ kind: "sent", already: false }]);

// ---------------------------------------------------------------- block status taps (D4)

const tap = (id: string, block: string, status: string, minute: number, name: string): Status => ({
  kind: "block_status",
  client_event_id: id,
  block_id: block,
  status,
  tapped_at: new Date(base + minute * 60_000).toISOString(),
  base_updated_at: "2027-05-20T14:00:00.000Z",
  name,
});

// Locked on the day (D28): dropped, named once in the result, and the replay goes on to the next entry.
const lockedPortal = portal({ locked: true });
const mixed: Item[] = [tap("t1", "b-arrive", "done", 1, "Guests arrive"), tap("t2", "b-ceremony", "done", 2, "Ceremony"), scans[0]];
outcomes = await replay(mixed, lockedPortal.send, failureOf);
s = settle(mixed, outcomes);
assert.deepEqual(s.locked, ["Guests arrive", "Ceremony"], "both taps dropped; the screen says the one sentence once");
assert.deepEqual(s.refused, []);
assert.equal(s.done.size, 3, "dropped taps leave the outbox; the check-in behind them was sent");
assert.equal(s.sent, 1);
assert.equal(lockedPortal.checkins.size, 1);

// A block deleted on the web while the phone was offline: dropped and named.
const deleted = portal({ deleted: new Set(["b-dance"]) });
const withGone: Item[] = [tap("t3", "b-dance", "done", 3, "First dance"), tap("t4", "b-arrive", "done", 4, "Guests arrive")];
outcomes = await replay(withGone, deleted.send, failureOf);
s = settle(withGone, outcomes);
assert.deepEqual(s.gone, ["First dance"]);
assert.equal(s.sent, 1);
assert.equal(deleted.statuses.get("b-arrive")?.status, "done");

// A planner marked 4 moments offline; on reconnect the status route is dark
// (flag off, or a failed flag read). Nothing is dropped, nothing is named as
// deleted, and a door check-in queued behind the taps still goes.
const darkPortal = portal({ dark: true });
const fourTaps: Item[] = [tap("d1", "b-ceremony", "done", 10, "Ceremony"), tap("d2", "b-toast", "done", 11, "Toast"), tap("d3", "b-dinner", "done", 12, "Dinner"), tap("d4", "b-cake", "done", 13, "Cake"), scans[1]];
outcomes = await replay(fourTaps, darkPortal.send, failureOf);
s = settle(fourTaps, outcomes);
assert.deepEqual(s.gone, [], "no moment is named as removed");
assert.deepEqual(s.refused, []);
assert.deepEqual([...s.done], [scans[1].client_event_id], "only the check-in leaves the outbox; the 4 taps stay");
assert.equal(darkPortal.checkins.size, 1, "the check-in behind the held taps was sent");
// The route is back: the same 4 taps go and land.
darkPortal.opts.dark = false;
const kept = fourTaps.filter((x) => !s.done.has(x.client_event_id));
outcomes = await replay(kept, darkPortal.send, failureOf);
s = settle(kept, outcomes);
assert.equal(s.sent, 4);
assert.equal(darkPortal.statuses.get("b-cake")?.status, "done");

// The route stays dark (MW_DAY_PACK rolled back for the day): a held tap
// lives 12 hours from its tap, then it is dropped and named once, never
// replayed days later over a newer status.
const stillDark = portal({ dark: true });
const lateTaps: Item[] = [tap("e1", "b-ceremony", "done", 10, "Ceremony"), tap("e2", "b-toast", "done", 11, "Toast")];
const tapAt = Date.parse(lateTaps[0].tapped_at);
outcomes = await replay(lateTaps, stillDark.send, failureOf);
s = settle(lateTaps, outcomes, tapAt + 60 * 60 * 1000);
assert.equal(s.done.size, 0, "an hour later both taps are still held");
assert.deepEqual(s.expired, []);
s = settle(lateTaps, outcomes, tapAt + HELD_TTL_MS + 60_000);
assert.deepEqual(s.expired, ["Ceremony"], "Ceremony (tapped first) is past 12 hours");
assert.ok(s.done.has("e1") && !s.done.has("e2"), "the expired tap leaves the outbox, the newer one stays");
assert.deepEqual(s.gone, [], "an expired tap is not named as deleted");
assert.equal(settle(lateTaps, outcomes).expired.length, 0, "without a clock nothing expires");
assert.equal(heldExpired({}, Date.now()), false, "no tapped_at: never expires here");
// A retry (offline) never expires: only a held answer does.
s = settle([lateTaps[0]], [{ kind: "retry" }], tapAt + 3 * HELD_TTL_MS);
assert.deepEqual(s.expired, []);
assert.equal(s.done.size, 0);

// The one-minute foreground check drains only when status taps wait, online and active.
assert.equal(timedDrainDue(lateTaps, true, true), true);
assert.equal(timedDrainDue(lateTaps, false, true), false, "offline: the reconnect drains");
assert.equal(timedDrainDue(lateTaps, true, false), false, "in the background: the foreground drains");
assert.equal(timedDrainDue([scans[0]], true, true), false, "check-ins alone: the door has its own drain");
assert.equal(timedDrainDue([], true, true), false);

// Two phones: this one marks Ceremony done offline at 16:31, the other online at 16:33 sets it back. Last tap wins.
const two = portal();
await two.send(tap("online", "b-ceremony", "planned", 33, "Ceremony"));
outcomes = await replay([tap("offline", "b-ceremony", "done", 31, "Ceremony")], two.send, failureOf);
assert.deepEqual(outcomes, [{ kind: "sent", already: false }]);
assert.equal(two.statuses.get("b-ceremony")?.status, "planned", "the later tap stays");
// A replayed tap is idempotent.
await two.send(tap("online", "b-ceremony", "planned", 33, "Ceremony"));
assert.equal(two.statuses.size, 1);

// A 5xx in the middle stops the drain; nothing after it overtakes it.
let calls = 0;
const flaky = async (item: Item) => {
  calls++;
  if (item.client_event_id === "t6") throw new Fail(503, "http_503");
  return {};
};
const order: Item[] = [tap("t5", "b-a", "done", 5, "A"), tap("t6", "b-b", "done", 6, "B"), tap("t7", "b-c", "done", 7, "C")];
outcomes = await replay(order, flaky, failureOf);
s = settle(order, outcomes);
assert.deepEqual([...s.done], ["t5"]);
assert.equal(calls, 2, "C was not sent before B");

// Older stored entries without a kind are check-ins.
const legacy = [{ client_event_id: "old", guest_id: "g-old", seats: 1, scanned_at: new Date(base).toISOString(), name: "Old" }];
outcomes = await replay(legacy, async () => ({ already: true, replayed: false }), failureOf);
assert.deepEqual(outcomes, [{ kind: "sent", already: true }] as Outcome[]);

console.log("outbox: ok (20 offline scans replayed in order, 0 duplicates, scan times kept; locked and deleted taps dropped and named, dark-route taps held, expired after 12 hours and named)");

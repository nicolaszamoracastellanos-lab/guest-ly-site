// Run: node --experimental-strip-types scripts/tests/queue.test.ts
import assert from "node:assert/strict";
import { chipState, settle, isConflict, type Outcome } from "../../src/lib/queueMath.ts";

// The chip: hidden only when online with nothing waiting.
assert.equal(chipState(0, true, false), "hidden");
assert.equal(chipState(0, false, false), "offline");
assert.equal(chipState(3, false, false), "offlinePending");
assert.equal(chipState(3, false, true), "offlinePending");
assert.equal(chipState(3, true, false), "pending");
assert.equal(chipState(3, true, true), "syncing");
assert.equal(chipState(-2, true, false), "hidden");

const q = [
  { client_event_id: "1", name: "Ana" },
  { client_event_id: "2", name: "Luis" },
  { client_event_id: "3", name: "Sofía" },
  { client_event_id: "4", name: "Mateo" },
];

// All delivered, one already in at another door.
let r = settle(q, [{ kind: "sent", already: false }, { kind: "sent", already: true }, { kind: "sent", already: false }, { kind: "sent", already: false }] as Outcome[]);
assert.deepEqual([...r.done], ["1", "2", "3", "4"]);
assert.equal(r.sent, 4);
assert.deepEqual(r.already, ["Luis"]);
assert.deepEqual(r.refused, []);

// A final refusal is settled (dropped) and named; a retry stops the drain.
r = settle(q, [{ kind: "sent", already: false }, { kind: "refused" }, { kind: "retry" }, { kind: "sent", already: false }] as Outcome[]);
assert.deepEqual([...r.done], ["1", "2"]);
assert.equal(r.sent, 1);
assert.deepEqual(r.refused, ["Luis"]);

// Offline from the first item: nothing settled, order kept for next time.
r = settle(q, [{ kind: "retry" }] as Outcome[]);
assert.equal(r.done.size, 0);
assert.equal(r.sent, 0);

// Conflicts: already in, but not a replay of this same scan.
assert.equal(isConflict({ already: true, replayed: false }), true);
assert.equal(isConflict({ already: true, replayed: true }), false);
assert.equal(isConflict({ already: false }), false);
assert.equal(isConflict(null), false);

console.log("queue.test.ts: ok");

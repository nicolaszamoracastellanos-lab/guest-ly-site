// Run: node --experimental-strip-types scripts/tests/home.test.ts
import assert from "node:assert/strict";
import { recentReplies, funnelFrom, share } from "../../src/features/couple/home.ts";

// Funnel: people, invited = going + not going + pending.
assert.deepEqual(funnelFrom({ people_expected: 120, attending_seats: 70, declined_seats: 16 }), { invited: 120, replied: 86, going: 70, notGoing: 16, pending: 34 });
// Nothing loaded yet: zeros, never NaN or negatives.
assert.deepEqual(funnelFrom(undefined), { invited: 0, replied: 0, going: 0, notGoing: 0, pending: 0 });
// More answers than expected people (party grew): pending floors at 0.
assert.equal(funnelFrom({ people_expected: 10, attending_seats: 9, declined_seats: 3 }).pending, 0);

assert.equal(share(30, 120), 0.25);
assert.equal(share(5, 0), 0);
assert.equal(share(200, 100), 1);

// Recent replies: answered only, with a valid time, newest first, capped.
const rows = [
  { id: "a", status: "attending" as const, updated_at: "2026-10-01T10:00:00Z" },
  { id: "b", status: "pending" as const, updated_at: "2026-10-05T10:00:00Z" },
  { id: "c", status: "declined" as const, updated_at: "2026-10-03T10:00:00Z" },
  { id: "d", status: "attending" as const, updated_at: null },
  { id: "e", status: "attending" as const, updated_at: "not a date" },
  { id: "f", status: "attending" as const, updated_at: "2026-10-04T09:00:00Z" },
];
assert.deepEqual(recentReplies(rows).map((r) => r.id), ["f", "c", "a"]);
assert.deepEqual(recentReplies(rows, 2).map((r) => r.id), ["f", "c"]);
assert.deepEqual(recentReplies(undefined), []);

console.log("home.test.ts: ok");

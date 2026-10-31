// Run: node --experimental-strip-types scripts/tests/home.test.ts
import assert from "node:assert/strict";
import { recentReplies, funnelFrom, share, todayBriefing } from "../../src/features/couple/home.ts";

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

// Today: the briefing never repeats a breakdown row.
const brief = [
  { kind: "requests_open", text: "2 requests need your answer" },
  { kind: "escalation_open", text: "Escalated questions are still waiting" },
  { kind: "rsvp_pace", text: "Replies are slow" },
  { text: "A row from a portal before v1.2" },
];
const kinds = (rows: { kind?: unknown; text: string }[]) => rows.map((r) => (typeof r.kind === "string" ? r.kind : "none"));
// Both breakdown rows on screen: both briefing twins go, the rest stays in order.
assert.deepEqual(kinds(todayBriefing(brief, { requests: 2, conversations: 1 })), ["rsvp_pace", "none"]);
// Only requests on screen: the escalation row stays (nothing else says it).
assert.deepEqual(kinds(todayBriefing(brief, { requests: 1, conversations: 0 })), ["escalation_open", "rsvp_pace", "none"]);
// Only messages on screen: the requests row stays.
assert.deepEqual(kinds(todayBriefing(brief, { requests: 0, conversations: 3 })), ["requests_open", "rsvp_pace", "none"]);
// No breakdown (older payload): the briefing is shown whole.
assert.equal(todayBriefing(brief, undefined).length, 4);
assert.deepEqual(todayBriefing(undefined, { requests: 1 }), []);

console.log("home.test.ts: ok");

// HH wave F: step routes, activity icons, deadline shape.
import { setupRoute, activityIcon, isIsoDay } from "../../src/features/couple/home.ts";
assert.equal(setupRoute("date_city"), "/couple/settings/general");
assert.equal(setupRoute("reminders_on"), "/couple/settings/reminders");
assert.equal(setupRoute("toString"), null);
assert.equal(setupRoute("unknown_step"), null);
assert.equal(activityIcon("rsvp_submitted"), "check");
assert.equal(activityIcon("link_opened"), "eye");
assert.equal(activityIcon("something_new"), "info");
assert.equal(isIsoDay("2027-03-20"), true);
assert.equal(isIsoDay("end of March"), false);
assert.equal(isIsoDay(null), false);
console.log("home (HH wave F): ok");

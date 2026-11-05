// Run: node --experimental-strip-types scripts/tests/milestones.test.ts
// #6 Road to the wedding: the core cases of the portal's
// scripts/test-milestones.mjs (the part above "words"), run against the app's
// verbatim copy src/features/couple/milestones.ts. The portal's route-table
// case is replaced by the app's own: every path the line links to opens an
// app screen (roadRoute in features/couple/road.ts).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./lib/ts-resolve.ts";
import * as m from "../../src/features/couple/milestones.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (p: string) => path.join(here, "../..", p);
const { deriveRoad, addMonths, addDays, dayOf, milestonePath, MILESTONE_IDS, MILESTONE_CAPABILITY, isMarkableId } = m;

let n = 0;
const t = (name, fn) => {
  try {
    fn();
    n++;
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
};

const base = {
  weddingDate: "2027-06-12",
  today: "2026-11-05",
  venueBooked: false,
  saveTheDatesSentAt: null,
  invitationsSentAt: null,
  saveTheDatesMarkedAt: null,
  invitationsMarkedAt: null,
  rsvpDeadline: null,
  partiesInvited: null,
  partiesPending: null,
  finalCount: null,
  timeline: null,
};
const road = (patch = {}, surface = "couple", slug = "ana-y-luis") => deriveRoad({ ...base, ...patch }, surface, slug);
const states = (r) => Object.fromEntries(r.items.map((i) => [i.id, i.state]));
const item = (r, id) => r.items.find((i) => i.id === id);

// ---- the module stays copyable ------------------------------------------------------
t("milestones.ts imports nothing and has no runtime API", () => {
  const text = readFileSync(src("src/features/couple/milestones.ts"), "utf8");
  assert.ok(!/^\s*import\s/m.test(text), "no import");
  assert.ok(!/\b(require|process|window|document|fetch|Date\.now|new Date)\b/.test(text), "no runtime API");
  assert.ok(!/\benum\b|\bnamespace\b/.test(text), "erasable TypeScript only");
  assert.ok(!/[–—]/.test(text), "no em or en dash");
});

// ---- dates -----------------------------------------------------------------------------
t("calendar arithmetic", () => {
  assert.equal(addMonths("2027-06-12", -12), "2026-06-12");
  assert.equal(addMonths("2027-03-31", -1), "2027-02-28");
  assert.equal(addMonths("2028-03-31", -1), "2028-02-29");
  assert.equal(addMonths("2027-01-15", -3), "2026-10-15");
  assert.equal(addDays("2027-06-12", -14), "2027-05-29");
  assert.equal(addDays("2027-03-01", -1), "2027-02-28");
  assert.equal(addDays("2028-03-01", -1), "2028-02-29");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  for (let i = -800; i <= 800; i += 37) assert.equal(addDays(addDays("2027-06-12", i), -i), "2027-06-12");
  assert.equal(dayOf("2026-11-02T23:59:00.000Z"), "2026-11-02");
  assert.equal(dayOf("15 de mayo"), null);
  assert.equal(dayOf("2026-13-01"), null);
  assert.equal(dayOf(null), null);
});

// ---- Done when 1 ------------------------------------------------------------------------
t("Done when 1: venue booked + a save the date send -> Invitations is Now, linked to Broadcasts", () => {
  const r = road({ venueBooked: true, saveTheDatesSentAt: "2026-10-01T15:00:00Z" });
  assert.deepEqual(states(r), { venue: "done", save_the_dates: "done", invitations: "now", replies: "upcoming", wedding_day: "upcoming" });
  assert.equal(r.nowId, "invitations");
  assert.equal(r.nextId, "replies");
  assert.equal(item(r, "invitations").path, "/broadcasts");
  assert.equal(item(r, "save_the_dates").doneAt, "2026-10-01");
  assert.equal(r.done, 2);
  assert.equal(r.total, 5, "final count and timeline are hidden until #1 and #2");
  const p = road({ venueBooked: true, saveTheDatesSentAt: "2026-10-01T15:00:00Z" }, "planner", "ana-y-luis");
  assert.equal(item(p, "invitations").path, "/planner/w/ana-y-luis/broadcasts");
  assert.equal(p.nowId, r.nowId, "same Now on every surface");
});

t("Now is the first open milestone after the last one done; earlier open ones are passed", () => {
  // Invitations out, save the dates never sent or marked: the couple is not sent back.
  const r = road({ venueBooked: true, invitationsSentAt: "2026-09-26", today: "2026-11-05" });
  assert.equal(r.nowId, "replies");
  assert.equal(r.nextId, "wedding_day");
  assert.equal(item(r, "save_the_dates").state, "upcoming", "passed, never Now");
  assert.equal(item(r, "save_the_dates").due, null, "a passed step keeps no timing hint");
  assert.equal(item(r, "save_the_dates").overdue, false);
  assert.equal(item(r, "invitations").state, "done");
  assert.equal(r.done, 2);
  // The venue does not drive Now once invitations are out either.
  const v = road({ invitationsSentAt: "2026-11-01" });
  assert.equal(v.nowId, "replies");
  assert.equal(item(v, "venue").due, null);
  // With nothing done, the first milestone is Now as before.
  const fresh = road();
  assert.equal(fresh.nowId, "venue");
  assert.equal(fresh.nextId, "save_the_dates");
  assert.deepEqual(item(fresh, "save_the_dates").due, { kind: "usual", date: "2026-10-12" });
  // A passed overdue step (final count locked, replies still open) is not overdue.
  const fc = road({
    venueBooked: true,
    invitationsSentAt: "2027-03-01",
    rsvpDeadline: "2027-05-01",
    partiesInvited: 100,
    partiesPending: 4,
    finalCount: { dueDate: "2027-05-20", lockedAt: "2027-05-21" },
    today: "2027-05-25",
  });
  assert.equal(item(fc, "replies").overdue, false);
  assert.equal(fc.nowId, "wedding_day");
});

t("replies all answered before any invitation went out do not pass the earlier steps", () => {
  // Ten months out, three parties listed, all answered early (website RSVP, an import).
  const r = road({ weddingDate: "2027-09-01", today: "2026-11-05", partiesInvited: 3, partiesPending: 0 });
  assert.equal(item(r, "replies").state, "done");
  assert.equal(r.nowId, "venue", "the venue is still the step to take");
  assert.equal(r.nextId, "save_the_dates");
  assert.ok(item(r, "save_the_dates").due, "the earlier steps keep their timing hint");
  // Once the invitations are out (sent or marked), replies anchor as before.
  const m = road({ weddingDate: "2027-09-01", today: "2026-11-05", partiesInvited: 3, partiesPending: 0, invitationsMarkedAt: "2026-11-01" });
  assert.equal(m.nowId, "wedding_day");
  assert.equal(item(m, "venue").due, null);
});

t("save the dates and invitations: a hand mark counts, a send wins", () => {
  const r = road({ venueBooked: true, saveTheDatesMarkedAt: "2026-09-10T12:00:00Z" });
  const std = item(r, "save_the_dates");
  assert.equal(std.state, "done");
  assert.equal(std.marked, true);
  assert.equal(std.markable, true, "a hand mark can be removed");
  assert.equal(std.doneAt, "2026-09-10");
  const both = road({ saveTheDatesMarkedAt: "2026-09-10", saveTheDatesSentAt: "2026-10-01" });
  assert.equal(item(both, "save_the_dates").marked, false);
  assert.equal(item(both, "save_the_dates").markable, false, "sent through Guest-ly: nothing to mark");
  assert.equal(item(both, "save_the_dates").doneAt, "2026-09-10", "the earliest day");
  for (const id of MILESTONE_IDS) assert.equal(isMarkableId(id), id === "save_the_dates" || id === "invitations");
});

t("usual timing is 'usually by', never a hard date, and never overdue", () => {
  const r = road({ today: "2027-05-01" });
  assert.deepEqual(item(r, "venue").due, { kind: "usual", date: "2026-06-12" });
  assert.deepEqual(item(r, "save_the_dates").due, { kind: "usual", date: "2026-10-12" });
  assert.deepEqual(item(r, "invitations").due, { kind: "usual", date: "2027-03-12" });
  assert.deepEqual(item(r, "replies").due, { kind: "usual", date: "2027-05-13" });
  assert.deepEqual(item(r, "wedding_day").due, { kind: "date", date: "2027-06-12" });
  assert.ok(r.items.every((i) => !i.overdue), "soft milestones never go overdue");
  const none = road({ weddingDate: null });
  assert.ok(none.items.every((i) => i.due === null), "no date, no timing");
  assert.equal(none.nowId, "venue");
});

t("replies: deadline, everyone answered, overdue", () => {
  const open = road({ rsvpDeadline: "2027-05-01", partiesInvited: 120, partiesPending: 30, today: "2027-04-20" });
  assert.deepEqual(item(open, "replies").due, { kind: "date", date: "2027-05-01" });
  assert.equal(item(open, "replies").state === "done", false);
  assert.equal(item(open, "replies").overdue, false);
  assert.equal(item(open, "replies").path, "/guests");
  const late = road({ rsvpDeadline: "2027-05-01", partiesInvited: 120, partiesPending: 30, today: "2027-05-02" });
  assert.equal(item(late, "replies").overdue, true, "the deadline passed with parties still to answer");
  const lastDay = road({ rsvpDeadline: "2027-05-01", partiesInvited: 120, partiesPending: 30, today: "2027-05-01" });
  assert.equal(item(lastDay, "replies").overdue, false, "the deadline day itself is not late");
  const closed = road({ rsvpDeadline: "2027-05-01", partiesInvited: 120, partiesPending: 0, today: "2027-05-02" });
  assert.equal(item(closed, "replies").state, "done");
  assert.equal(item(closed, "replies").doneAt, "2027-05-01");
  const early = road({ partiesInvited: 40, partiesPending: 0 });
  assert.equal(item(early, "replies").state, "done", "everyone answered before the deadline");
  const empty = road({ partiesInvited: 0, partiesPending: 0 });
  assert.notEqual(item(empty, "replies").state, "done", "no guests is not everyone answered");
  const unknown = road({ rsvpDeadline: "2027-05-01", today: "2027-05-02" });
  assert.equal(item(unknown, "replies").state, "done", "closed and unknown counts: done, never a guess at overdue");
  const noDeadline = road({ venueBooked: true, saveTheDatesSentAt: "x", invitationsSentAt: "2027-01-01" });
  assert.equal(item(noDeadline, "replies").path, "/brain", "no deadline yet: the Brain sets it");
  assert.equal(milestonePath("replies", "planner", "a b", true), "/planner/w/a%20b/brain");
});

t("final count and timeline appear only when their features are there", () => {
  const r = road({ finalCount: { dueDate: "2027-06-01", lockedAt: null }, timeline: { lockedAt: null }, today: "2027-06-02" });
  assert.equal(r.total, 7);
  assert.deepEqual(r.items.map((i) => i.id), MILESTONE_IDS);
  assert.equal(item(r, "final_count").overdue, true);
  assert.deepEqual(item(r, "timeline").due, { kind: "usual", date: "2027-05-29" });
  assert.equal(item(r, "timeline").overdue, false);
  const locked = road({ finalCount: { dueDate: "2027-06-01", lockedAt: "2027-05-30T10:00:00Z" }, timeline: { lockedAt: "2027-05-20T10:00:00Z" } });
  assert.equal(item(locked, "final_count").state, "done");
  assert.equal(item(locked, "final_count").overdue, false);
  assert.equal(item(locked, "timeline").doneAt, "2027-05-20");
  assert.equal(road({ timeline: { lockedAt: null } }).total, 6);
});

t("the wedding day: done on the day, nothing is Now afterwards", () => {
  const all = { venueBooked: true, saveTheDatesSentAt: "2026-10-01", invitationsSentAt: "2027-02-01", partiesInvited: 10, partiesPending: 0 };
  const before = road({ ...all, today: "2027-06-11" });
  assert.equal(before.nowId, "wedding_day");
  assert.equal(before.nextId, null);
  const day = road({ ...all, today: "2027-06-12" });
  assert.equal(day.nowId, null);
  assert.equal(day.done, day.total);
  const after = road({ today: "2027-07-01" });
  assert.equal(after.nowId, null, "after the day nothing is Now, even with steps left");
  assert.equal(item(after, "venue").state, "upcoming");
});


// ---- the app's own case (replaces the portal's route-table case) -----------------------
const { roadRoute, ROAD_ROUTES } = await import("../../src/features/couple/road.ts");
t("paths and capabilities: each milestone's couple path maps onto an app route", () => {
  for (const id of MILESTONE_IDS) {
    const p = milestonePath(id, "couple", "x");
    const route = roadRoute(p);
    assert.ok(route, `${p} has an app screen`);
    assert.ok(route.startsWith("/couple/"), `${p} opens a couple screen`);
    assert.ok(["vendors", "broadcasts", "guests", "brain", "runsheet"].includes(MILESTONE_CAPABILITY[id]));
    assert.equal(milestonePath(id, "planner", "x"), `/planner/w/x${p}`);
  }
  assert.equal(roadRoute(milestonePath("replies", "couple", "x", true)), "/couple/brain", "no deadline yet: the Brain");
  assert.equal(Object.keys(ROAD_ROUTES).length, 5);
});

console.log(`milestones (app copy): ${n} groups ok`);

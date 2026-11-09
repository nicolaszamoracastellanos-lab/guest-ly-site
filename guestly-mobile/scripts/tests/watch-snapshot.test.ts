// Run: node --experimental-strip-types scripts/tests/watch-snapshot.test.ts
// The Apple Watch snapshot (src/features/watch): each role, the flag rules,
// the overrun rule, privacy (no phone or e-mail outside the couple's own vendor
// phones), a square QR matrix, and the payload size.

import assert from "node:assert/strict";
import "./lib/ts-resolve.ts";

const S = await import("../../src/features/watch/snapshot.ts");
const F = await import("../../src/features/watch/flag.ts");

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

// A local afternoon on the wedding day: 17:20.
const NOW = new Date(2027, 2, 21, 17, 20, 0).getTime();
const TODAY = "2027-03-21";

const home = { couple_names: "Camila & Andrés", wedding_date: TODAY, countdown: { days: 0, passed: false }, day_of: true, totals: { people_expected: 158, attending_seats: 118, declined_seats: 9 } };
const runsheet = [
  { id: "b1", title: "Ceremony", starts_at: "17:00:00", ends_at: "17:30:00", location: "Courtyard", state: "now" as const },
  { id: "b2", title: "Cocktail hour", starts_at: "18:00:00", ends_at: "19:30:00", location: null, state: "next" as const },
  { id: "b3", title: "Dinner", starts_at: "19:30:00", ends_at: null, location: null, state: "later" as const },
];
const blocks = [
  { id: "b1", day: TODAY, starts_at: "17:00", ends_at: "17:10", title: "Ceremony", vendor_id: null, vendor_name: null, status: "planned" },
  { id: "b2", day: TODAY, starts_at: "18:00", ends_at: "19:30", title: "Cocktail hour", vendor_id: "v2", vendor_name: "Catering", status: "planned" },
  { id: "b3", day: TODAY, starts_at: "14:10", ends_at: null, title: "Florist setup", vendor_id: "v1", vendor_name: "Florist", status: "done" },
  { id: "b4", day: TODAY, starts_at: "17:00", ends_at: null, title: "Band soundcheck", vendor_id: "v3", vendor_name: "Band", status: "planned" },
];
const vendors = [
  { id: "v1", name: "Flores Lila", category: "flowers", status: "booked", contact_name: "Rosa", phone: "+59171000001" },
  { id: "v2", name: "Casa Sabor", category: "catering", status: "booked", contact_name: "", phone: "+59171000002" },
  { id: "v3", name: "Los Andes", category: "music", status: "booked", contact_name: "Beto", phone: "71000003" },
  { id: "v4", name: "Nobody", category: "photo", status: "shortlist", contact_name: "", phone: "+59171000004" },
  { id: "v5", name: "No phone", category: "cake", status: "booked", contact_name: "", phone: "" },
];
const couple = {
  nowMs: NOW,
  home,
  tasks: {
    progress: { done: 1, total: 3 },
    tasks: [
      { id: "t1", title: "Approve menu cards", status: "done", due_date: null, days_left: null, completed_at: new Date(2027, 2, 21, 9, 40).toISOString() },
      { id: "t2", title: "Confirm florist delivery", status: "todo", due_date: TODAY, days_left: 0, completed_at: null },
      { id: "t3", title: "Send seating to venue", status: "todo", due_date: "2027-03-26", days_left: 5, completed_at: null },
    ],
  },
  budget: { paid: 18400, total: 31000, fraction: 0.5935, currency: "USD" },
  vendors: { vendors, items: [{ vendor_id: "v1", title: "Flowers", next_payment: { on: "2027-03-26", amount: 1200, currency: "USD" } }, { vendor_id: "v2", title: "Food", next_payment: { on: "2027-04-02", amount: 3000, currency: "USD" } }] },
  dayof: { day_of: true, seats_in: 96, seats_total: 158, runsheet },
  blocks,
  inbox: [
    { id: "c1", channel: "app", name: "Tomás Vega", preview: "Can I bring a plus one?", needs_you: true },
    { id: "c2", channel: "whatsapp", name: "Ana Paz", preview: "Is there parking?", needs_you: true },
    { id: "c3", channel: "app", name: "Quiet", preview: "thanks", needs_you: false },
  ],
  lastArrival: { name: "Mateo Rojas", table: "4" },
};

t("couple: wedding, replies and flags", () => {
  const s = S.buildCoupleSnapshot(couple, "en");
  assert.equal(s.role, "couple");
  assert.equal(s.enabled, true);
  assert.deepEqual(s.replies, { going: 118, declined: 9, pending: 31, total: 158 });
  assert.equal(s.wedding?.names, "Camila & Andrés");
  assert.equal(s.wedding?.dateText, "21 Mar 2027");
  assert.equal(s.wedding?.isDayOf, true);
});

t("couple: tasks list open by due date, then one done, capped at 3", () => {
  const s = S.buildCoupleSnapshot(couple, "en");
  assert.equal(s.tasks?.done, 1);
  assert.equal(s.tasks?.total, 3);
  const items = s.tasks!.items;
  assert.deepEqual(items.map((x) => x.id), ["t2", "t3", "t1"]);
  assert.equal(items[0].note, "Due today");
  assert.equal(items[0].urgent, true);
  assert.equal(items[1].note, "Due Friday");
  assert.equal(items[2].done, true);
  assert.equal(items[2].note, "Done 09:40");
  assert.ok(items.length <= 3);
});

t("couple: budget and the earliest next payment", () => {
  const s = S.buildCoupleSnapshot(couple, "en");
  assert.equal(s.budget?.paidText, "$18,400");
  assert.equal(s.budget?.totalText, "$31,000");
  assert.equal(s.budget?.next?.name, "Flores Lila");
  assert.equal(s.budget?.next?.amountText, "$1,200");
  assert.equal(s.budget?.next?.dueText, "Due Friday");
  const none = S.buildCoupleSnapshot({ ...couple, vendors: { vendors, items: [] } }, "en");
  assert.equal(none.budget?.next, null);
});

t("couple: team has phones only, booked first, max 6, E.164", () => {
  const s = S.buildCoupleSnapshot(couple, "en");
  const names = s.team!.map((x) => x.name);
  assert.deepEqual(names, ["Florist", "Catering", "Music"]);
  assert.equal(s.team![0].tel, "+59171000001");
  assert.equal(s.team![2].tel, "71000003");
  assert.equal(s.team![0].note, "Rosa");
  assert.equal(s.team![1].note, "Casa Sabor");
});

t("couple: day of, now and next, door and last arrival", () => {
  const s = S.buildCoupleSnapshot(couple, "en");
  assert.equal(s.dayOf?.now?.title, "Ceremony");
  assert.equal(s.dayOf?.now?.line, "17:00 · Courtyard");
  assert.equal(s.dayOf?.now?.leftText, "10 min left");
  assert.equal(Math.round((s.dayOf?.now?.fraction ?? 0) * 100), 67);
  assert.deepEqual(s.dayOf?.next.map((x) => x.time), ["18:00", "19:30"]);
  assert.deepEqual(s.door, { inCount: 96, total: 158, lastText: "Last in: Mateo Rojas · Table 4" });
});

t("overrun: a block past its end by 5+ minutes with a later block today", () => {
  const s = S.buildCoupleSnapshot(couple, "en");
  const o = s.dayOf?.overrun;
  assert.ok(o, "overrun present (ceremony ended 17:10, it is 17:20)");
  assert.equal(o!.blockId, "b2");
  assert.equal(o!.question, "Push Cocktail hour?");
  assert.match(o!.body, /Cocktail hour moves to 18:15\./);
  assert.equal(o!.pushLabel, "Push 15 min");
  assert.match(o!.body, /Ceremony is running over\./);
  // under the grace period: no overrun
  const early = S.buildCoupleSnapshot({ ...couple, nowMs: new Date(2027, 2, 21, 17, 13).getTime() }, "en");
  assert.equal(early.dayOf?.overrun, null);
  // a block marked done is not running over
  const done = S.buildCoupleSnapshot({ ...couple, blocks: blocks.map((b) => (b.id === "b1" ? { ...b, status: "done" } : b)) }, "en");
  assert.equal(done.dayOf?.overrun, null);
  // the last block of the day has nothing to push
  assert.equal(S.findOverrun([{ ...blocks[0], ends_at: "17:00" }], NOW), null);
});

t("vendors today: late, due, on site; call number only for the couple", () => {
  const s = S.buildCoupleSnapshot(couple, "en");
  const v = s.vendorsToday!;
  assert.equal(v.summary, "1 of 3 on site");
  assert.deepEqual(v.items.map((x) => [x.name, x.state]), [["Band", "late"], ["Catering", "due"], ["Florist", "onsite"]]);
  assert.equal(v.items[0].note, "Late 20 min");
  assert.equal(v.items[0].tel, "71000003");
  assert.equal(v.items[1].note, "Due 18:00");
});

t("needs you: only threads waiting on the couple; WhatsApp cannot be answered from the watch", () => {
  const s = S.buildCoupleSnapshot(couple, "en");
  assert.deepEqual(s.needsYou!.map((x) => [x.id, x.canReply]), [["c1", true], ["c2", false]]);
  assert.equal(s.needsYou![0].from, "Tomás Vega asks");
  const none = S.buildCoupleSnapshot({ ...couple, inbox: [] }, "en");
  assert.equal(none.needsYou, null);
});

t("couple: not the wedding day hides the day-of sections", () => {
  const s = S.buildCoupleSnapshot({ ...couple, home: { ...home, day_of: false, countdown: { days: 132, passed: false } }, dayof: { day_of: false, seats_in: 0, seats_total: 158, runsheet: [] } }, "en");
  assert.equal(s.wedding?.isDayOf, false);
  assert.equal(s.wedding?.days, 132);
  assert.equal(s.dayOf, null);
  assert.equal(s.door, null);
  assert.equal(s.vendorsToday, null);
});

t("couple: spanish copy", () => {
  const s = S.buildCoupleSnapshot(couple, "es");
  assert.equal(s.lang, "es");
  assert.equal(s.tasks!.items[0].note, "Vence hoy");
  assert.match(s.dayOf!.overrun!.question, /^¿Atrasar /);
  assert.equal(s.team![0].name, "Florista");
  assert.equal(s.vendorsToday!.summary, "1 de 3 en el lugar");
  assert.equal(s.wedding?.dateText, "21 mar 2027");
});

const planner = {
  nowMs: NOW,
  weddings: [
    { slug: "a", couple_names: "Camila & Andrés", wedding_date: TODAY, days_to_go: 0, seats: { invited: 158, attending: 96, declined: 9, pending: 53 }, open_requests: 0 },
    { slug: "b", couple_names: "Sofía & Martín", wedding_date: "2027-03-27", days_to_go: 6, seats: { invited: 100, attending: 60, declined: 5, pending: 35 }, open_requests: 3 },
    { slug: "c", couple_names: "Elena & Diego", wedding_date: "2027-12-12", days_to_go: 266, seats: null, open_requests: 1 },
    { slug: "old", couple_names: "Past Couple", wedding_date: "2026-01-01", days_to_go: 0, passed: true, seats: null, open_requests: null },
  ],
  tasks: [{ id: "p1", title: "Call the venue", status: "open" }, { id: "p2", title: "Send run sheet", status: "done" }],
  agenda: [
    { time: "17:00", title: "Ceremony", location: "Courtyard", kind: "runsheet" },
    { time: "18:00", title: "Cocktail hour", location: null, kind: "runsheet" },
    { time: null, title: "Wedding day", location: null, kind: "wedding_day" },
  ],
  checkin: { day_of: true, seats_in: 96, seats_total: 158 },
  lastArrival: null,
};

t("planner: weddings list, today first, labels and health line", () => {
  const s = S.buildPlannerSnapshot(planner, "en");
  assert.equal(s.role, "planner");
  assert.equal(s.weddings!.length, 3, "a past wedding is not listed");
  assert.equal(s.weddings![0].label, "Today");
  assert.equal(s.weddings![0].today, true);
  assert.equal(s.weddings![1].label, "Saturday");
  assert.equal(s.weddings![1].line, "65 / 100 · 3 open requests");
  assert.equal(s.weddings![2].label, "12 Dec");
  assert.equal(s.wedding?.isDayOf, true);
});

t("planner: day of now and next from the agenda, door counts, no vendor phones", () => {
  const s = S.buildPlannerSnapshot(planner, "en");
  assert.equal(s.dayOf?.now?.title, "Ceremony");
  assert.equal(s.dayOf?.next[0].title, "Cocktail hour");
  assert.equal(s.dayOf?.overrun, null, "planners cannot edit times");
  assert.deepEqual(s.door, { inCount: 96, total: 158, lastText: null });
  assert.equal(s.vendorsToday, null);
  assert.equal(s.tasks?.items[0].id, "p1");
  assert.equal(s.needsYou, null);
  assert.equal(s.team, null);
});

t("planner: not a wedding day", () => {
  const s = S.buildPlannerSnapshot({ ...planner, weddings: planner.weddings.slice(1) }, "en");
  assert.equal(s.wedding?.isDayOf, false);
  assert.equal(s.wedding?.names, "Sofía & Martín");
  assert.equal(s.dayOf, null);
  assert.equal(s.door, null);
});

const guest = {
  nowMs: new Date(2027, 2, 21, 16, 0).getTime(),
  guestId: "0b1c2d3e-aaaa-bbbb-cccc-1234567890ab",
  guestName: "Valentina Cruz",
  home: { couple_names: "Camila & Andrés", wedding_date: TODAY, countdown: { days: 0, passed: false }, day_of: true, rsvp: { party_size: 2, status: "attending" } },
  table: "7",
  events: [
    { id: "e1", title: "Shuttle leaves", date: TODAY, time: "16:15", location: "Hotel lobby" },
    { id: "e2", title: "Ceremony", date: TODAY, time: "17:00", location: "Courtyard" },
    { id: "e3", title: "Dinner", date: TODAY, time: "19:30", location: "Table 7" },
    { id: "e4", title: "Brunch", date: "2027-03-22", time: "10:00", location: null },
    { id: "e5", title: "Rehearsal", date: "2027-03-20", time: "18:00", location: null },
  ],
};

t("guest: pass, party line with the table, myDay soon flag", () => {
  const s = S.buildGuestSnapshot(guest, "en");
  assert.equal(s.role, "guest");
  assert.equal(s.pass?.name, "Valentina Cruz");
  assert.equal(s.pass?.line, "Party of 2 · Table 7");
  assert.deepEqual(s.myDay!.map((x) => x.title), ["Shuttle leaves", "Ceremony", "Dinner", "Brunch"], "past events are dropped");
  assert.equal(s.myDay![0].soon, true);
  assert.equal(s.myDay![0].note, "Hotel lobby · in 15 min");
  assert.equal(s.myDay![1].soon, true, "exactly 60 minutes away still counts as soon");
  assert.equal(s.myDay![2].soon, false);
  const noTable = S.buildGuestSnapshot({ ...guest, table: null }, "en");
  assert.equal(noTable.pass?.line, "Party of 2");
});

t("guest: the QR matrix is square, only 0 and 1, and has three finder squares", () => {
  const rows = S.buildGuestSnapshot(guest, "en").pass!.qr;
  assert.ok(rows.length >= 21);
  assert.ok(rows.every((r) => r.length === rows.length && /^[01]+$/.test(r)));
  assert.equal(rows[0].slice(0, 7), "1111111");
  assert.equal(rows[0].slice(-7), "1111111");
  assert.equal(rows[rows.length - 1].slice(0, 7), "1111111");
});

t("privacy: planner and guest snapshots carry no phone number or e-mail", () => {
  for (const s of [S.buildPlannerSnapshot(planner, "en"), S.buildGuestSnapshot(guest, "en")]) {
    const json = JSON.stringify({ ...s, pass: s.pass ? { ...s.pass, qr: [] } : null });
    assert.ok(!/@/.test(json), "no e-mail");
    assert.ok(!/\d{7,}/.test(json.replace(/"at":\d+/, "")), "no long digit run");
    assert.ok(!/"tel"/.test(json), "no tel field");
  }
});

t("size: every snapshot stays under 50 KB", () => {
  for (const s of [S.buildCoupleSnapshot(couple, "en"), S.buildPlannerSnapshot(planner, "es"), S.buildGuestSnapshot(guest, "en")]) {
    assert.ok(JSON.stringify(s).length < 50_000);
  }
});

t("empty snapshot: nothing but the envelope", () => {
  const e = S.emptySnapshot("es", NOW, false);
  assert.equal(e.enabled, false);
  assert.equal(e.role, "none");
  for (const k of ["wedding", "replies", "tasks", "budget", "team", "dayOf", "door", "vendorsToday", "weddings", "needsYou", "pass", "myDay"]) assert.equal((e as Record<string, unknown>)[k], null, k);
});

t("flag: off unless the release flag or the dev override is set; alexnico2026 never", () => {
  assert.equal(F.watchEnabled({ flagOn: false, slug: "demo", force: false }), false);
  assert.equal(F.watchEnabled({ flagOn: true, slug: "demo", force: false }), true);
  assert.equal(F.watchEnabled({ flagOn: false, slug: "demo", force: true }), true);
  assert.equal(F.watchEnabled({ flagOn: true, slug: "alexnico2026", force: false }), false);
  assert.equal(F.watchEnabled({ flagOn: false, slug: "alexnico2026", force: true }), false);
  assert.equal(F.watchEnabled({ flagOn: true, slug: null, force: false }), true);
});

console.log(`watch-snapshot: ${n} checks passed`);

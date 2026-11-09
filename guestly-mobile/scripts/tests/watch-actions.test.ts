// Run: node --experimental-strip-types scripts/tests/watch-actions.test.ts
// The watch's actions (src/features/watch/actions.ts) against a mocked API:
// right path and body per action, role and permission refusals, one reply that
// never throws, the Coordinator stream, the push-15 order.

import assert from "node:assert/strict";
import "./lib/ts-resolve.ts";

const { createWatchActions, clipAnswer } = await import("../../src/features/watch/actions.ts");

let n = 0;
const t = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
    n++;
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
};

type Call = { m: "get" | "post"; path: string; body?: unknown };
function rig(over: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const arrivals: unknown[] = [];
  const streams: { path: string; body: Record<string, unknown> }[] = [];
  const state = { role: "couple" as "couple" | "planner" | "guest" | "none", caps: new Set(["tasks:edit", "checkin:edit", "runsheet:edit"]), refreshed: 0, lang: "en" as "en" | "es" };
  const responses: Record<string, unknown> = {};
  const deps = {
    role: () => state.role,
    can: (tool: string, level: string) => state.caps.has(`${tool}:${level}`) || (level === "view" && state.caps.has(`${tool}:edit`)),
    lang: () => state.lang,
    slug: () => "demo-wedding",
    get: async (path: string) => {
      calls.push({ m: "get", path });
      return responses[path] ?? {};
    },
    post: async (path: string, body?: unknown) => {
      calls.push({ m: "post", path, body });
      if (path in responses && responses[path] instanceof Error) throw responses[path];
      return {};
    },
    checkIn: async (item: unknown) => {
      calls.push({ m: "post", path: "checkIn", body: item });
      return { already: false, guest: { name: "Lucía Fernández", table: "5" } };
    },
    newEventId: () => "evt-1",
    now: () => Date.UTC(2027, 2, 21, 12, 0, 0),
    stream: async (path: string, body: Record<string, unknown>, onEvent: (e: never) => void) => {
      streams.push({ path, body });
      const script = (over.script as unknown[]) ?? [{ t: "session", sessionId: "s1" }, { t: "reply", text: "31 guests are pending." }, { t: "done" }];
      for (const e of script) onEvent(e as never);
      return { ok: over.outcomeOk !== false };
    },
    refresh: async () => {
      state.refreshed += 1;
    },
    onArrival: (a: unknown) => arrivals.push(a),
    errText: (e: unknown) => (e instanceof Error ? e.message : "boom"),
  };
  return { actions: createWatchActions(deps as never), calls, state, responses, arrivals, streams };
}

await t("ping answers ok for any role, even signed out", async () => {
  const r = rig();
  r.state.role = "none";
  assert.deepEqual(await r.actions.handle("ping", "{}"), { ok: true });
});

await t("signed out: every other action says to open the phone", async () => {
  const r = rig();
  r.state.role = "none";
  const a = await r.actions.handle("task.toggle", JSON.stringify({ id: "t1", done: true }));
  assert.equal(a.ok, false);
  assert.match(a.error!, /Open Guest-ly on your iPhone/);
  assert.equal(r.calls.length, 0);
});

await t("unknown type, bad JSON, and a thrown error each give one failed reply", async () => {
  const r = rig();
  assert.deepEqual(await r.actions.handle("nope", "{}"), { ok: false, error: "unknown" });
  assert.equal((await r.actions.handle("task.toggle", "{not json")).ok, false);
  r.responses["/couple/tasks/t1/status"] = new Error("Timeline locked");
  const e = await r.actions.handle("task.toggle", JSON.stringify({ id: "t1", done: true }));
  assert.deepEqual(e, { ok: false, error: "Timeline locked" });
});

await t("task.toggle: couple todo/done, planner open/done, planner needs edit", async () => {
  const r = rig();
  await r.actions.handle("task.toggle", JSON.stringify({ id: "t1", done: true }));
  await r.actions.handle("task.toggle", JSON.stringify({ id: "t1", done: false }));
  assert.deepEqual(r.calls.map((c) => [c.path, c.body]), [["/couple/tasks/t1/status", { status: "done" }], ["/couple/tasks/t1/status", { status: "todo" }]]);
  const p = rig();
  p.state.role = "planner";
  await p.actions.handle("task.toggle", JSON.stringify({ id: "p1", done: true }));
  assert.deepEqual(p.calls[0], { m: "post", path: "/planner/tasks/p1/status", body: { status: "done" } });
  p.calls.length = 0;
  p.state.caps.delete("tasks:edit");
  const v = await p.actions.handle("task.toggle", JSON.stringify({ id: "p1", done: true }));
  assert.equal(v.ok, false);
  assert.equal(v.error, "View only");
  assert.equal(p.calls.length, 0);
});

await t("task.toggle: a guest cannot", async () => {
  const r = rig();
  r.state.role = "guest";
  assert.equal((await r.actions.handle("task.toggle", JSON.stringify({ id: "t1", done: true }))).ok, false);
  assert.equal(r.calls.length, 0);
});

await t("checkin.search: couple uses guests, planner uses checkin/search, max 5, short query is empty", async () => {
  const r = rig();
  r.responses["/couple/guests?q=luc"] = { items: Array.from({ length: 8 }, (_, i) => ({ id: `g${i}`, name: `Lucía ${i}`, party_size: 2, checked_in_at: i === 0 ? "2027-03-21T10:00:00Z" : null })) };
  const a = await r.actions.handle("checkin.search", JSON.stringify({ q: "luc" }));
  const rows = a.data!.results as { guestId: string; line: string; already: boolean }[];
  assert.equal(rows.length, 5);
  assert.equal(rows[0].already, true);
  assert.equal(rows[1].line, "Party of 2");
  assert.equal(r.calls[0].path, "/couple/guests?q=luc");
  const short = await r.actions.handle("checkin.search", JSON.stringify({ q: "l" }));
  assert.deepEqual(short.data, { results: [] });
  const p = rig();
  p.state.role = "planner";
  p.responses["/planner/checkin/search?q=m%C3%A1"] = { items: [] };
  await p.actions.handle("checkin.search", JSON.stringify({ q: "má" }));
  assert.equal(p.calls[0].path, "/planner/checkin/search?q=m%C3%A1");
});

await t("checkin.commit: queue item with the party size from the search, last arrival updated", async () => {
  const r = rig();
  r.responses["/couple/guests?q=luc"] = { items: [{ id: "g1", name: "Lucía Fernández", party_size: 3, checked_in_at: null }] };
  await r.actions.handle("checkin.search", JSON.stringify({ q: "luc" }));
  r.calls.length = 0;
  const a = await r.actions.handle("checkin.commit", JSON.stringify({ guestId: "g1" }));
  assert.equal(a.ok, true);
  assert.deepEqual(r.calls[0].body, { kind: "checkin", client_event_id: "evt-1", guest_id: "g1", seats: 3, scanned_at: "2027-03-21T12:00:00.000Z", name: "Lucía Fernández", path: undefined, tenant: "demo-wedding" });
  assert.deepEqual(r.arrivals, [{ name: "Lucía Fernández", table: "5" }]);
  assert.equal(a.data!.already, false);
});

await t("checkin.commit: planner path, and view-only planners are refused", async () => {
  const p = rig();
  p.state.role = "planner";
  await p.actions.handle("checkin.commit", JSON.stringify({ guestId: "g9" }));
  assert.equal((p.calls[0].body as { path: string }).path, "/planner/checkin");
  assert.equal((p.calls[0].body as { seats: number }).seats, 1, "unknown party size falls back to one seat");
  const v = rig();
  v.state.role = "planner";
  v.state.caps.delete("checkin:edit");
  const a = await v.actions.handle("checkin.commit", JSON.stringify({ guestId: "g9" }));
  assert.equal(a.ok, false);
  assert.equal(v.calls.length, 0);
});

await t("vendor.onsite marks the block done on the right surface", async () => {
  const r = rig();
  await r.actions.handle("vendor.onsite", JSON.stringify({ blockId: "b4" }));
  assert.deepEqual(r.calls[0], { m: "post", path: "/couple/runsheet/b4/status", body: { status: "done" } });
  const p = rig();
  p.state.role = "planner";
  await p.actions.handle("vendor.onsite", JSON.stringify({ blockId: "b4" }));
  assert.equal(p.calls[0].path, "/planner/runsheet/b4/status");
  p.state.caps.delete("runsheet:edit");
  assert.equal((await p.actions.handle("vendor.onsite", JSON.stringify({ blockId: "b4" }))).ok, false);
});

await t("runsheet.push15: moves the block and every later block of that day, in order, +15 min", async () => {
  const r = rig();
  r.responses["/couple/runsheet"] = {
    days: [
      { day: "2027-03-20", blocks: [{ id: "x1", day: "2027-03-20", starts_at: "19:30", ends_at: null }] },
      { day: "2027-03-21", blocks: [
        { id: "b3", day: "2027-03-21", starts_at: "19:30:00", ends_at: "21:00:00" },
        { id: "b2", day: "2027-03-21", starts_at: "18:00", ends_at: "19:30" },
        { id: "b1", day: "2027-03-21", starts_at: "17:00", ends_at: "17:30" },
        { id: "b5", day: "2027-03-21", starts_at: "23:50", ends_at: null },
      ] },
    ],
  };
  const a = await r.actions.handle("runsheet.push15", JSON.stringify({ blockId: "b2" }));
  assert.deepEqual(a, { ok: true, data: { moved: 3 } });
  assert.deepEqual(r.calls.filter((c) => c.m === "post").map((c) => [c.path, c.body]), [
    ["/couple/runsheet/b2", { starts_at: "18:15", ends_at: "19:45" }],
    ["/couple/runsheet/b3", { starts_at: "19:45", ends_at: "21:15" }],
    ["/couple/runsheet/b5", { starts_at: "00:05" }],
  ]);
});

await t("runsheet.push15: stops at the first refusal; planners and guests cannot", async () => {
  const r = rig();
  r.responses["/couple/runsheet"] = { days: [{ day: "d", blocks: [{ id: "b2", day: "d", starts_at: "18:00", ends_at: null }, { id: "b3", day: "d", starts_at: "19:30", ends_at: null }] }] };
  r.responses["/couple/runsheet/b2"] = new Error("The planner locked the timeline");
  const a = await r.actions.handle("runsheet.push15", JSON.stringify({ blockId: "b2" }));
  assert.deepEqual(a, { ok: false, error: "The planner locked the timeline" });
  assert.equal(r.calls.filter((c) => c.m === "post").length, 1, "nothing after the refused block is sent");
  const p = rig();
  p.state.role = "planner";
  assert.equal((await p.actions.handle("runsheet.push15", JSON.stringify({ blockId: "b2" }))).ok, false);
  assert.equal(p.calls.length, 0);
});

await t("coordinator.ask: streams to the role's route, joins replies, remembers the session", async () => {
  const r = rig();
  const a = await r.actions.handle("coordinator.ask", JSON.stringify({ text: "Who hasn't replied?" }));
  assert.deepEqual(a, { ok: true, data: { text: "31 guests are pending.", card: null } });
  assert.deepEqual(r.streams[0], { path: "/couple/coordinator", body: { sessionId: null, message: "Who hasn't replied?" } });
  await r.actions.handle("coordinator.ask", JSON.stringify({ text: "And Andrés's side?" }));
  assert.equal(r.streams[1].body.sessionId, "s1");
  const p = rig();
  p.state.role = "planner";
  await p.actions.handle("coordinator.ask", JSON.stringify({ text: "What needs me today?" }));
  assert.equal(p.streams[0].path, "/planner/coordinator");
  assert.equal((await r.actions.handle("coordinator.ask", JSON.stringify({ text: "  " }))).ok, false);
});

await t("coordinator: a card with a one-tap confirm is offered; a typed-confirm card sends you to the phone", async () => {
  const card = (typed: boolean) => ({ t: "card", card: { id: "act-9", title: { en: "Remind all 31", es: "Recordar a los 31" }, requiresTypedConfirm: typed } });
  const r = rig({ script: [{ t: "reply", text: "I can remind them." }, card(false), { t: "done" }] });
  const a = await r.actions.handle("coordinator.ask", JSON.stringify({ text: "remind" }));
  assert.deepEqual(a.data!.card, { actionId: "act-9", confirmLabel: "Remind all 31" });
  const es = rig({ script: [{ t: "reply", text: "Puedo recordarles." }, card(false), { t: "done" }] });
  es.state.lang = "es";
  assert.equal(((await es.actions.handle("coordinator.ask", JSON.stringify({ text: "x" }))).data!.card as { confirmLabel: string }).confirmLabel, "Recordar a los 31");
  const typed = rig({ script: [{ t: "reply", text: "That sends a broadcast." }, card(true), { t: "done" }] });
  const b = await typed.actions.handle("coordinator.ask", JSON.stringify({ text: "broadcast" }));
  assert.equal(b.data!.card, null);
  assert.match(b.data!.text as string, /Open Guest-ly on your iPhone to confirm\./);
});

await t("coordinator.confirm sends the confirm id in the same session", async () => {
  const r = rig({ script: [{ t: "session", sessionId: "s7" }, { t: "reply", text: "Done. Reminders sent." }, { t: "done" }] });
  const a = await r.actions.handle("coordinator.confirm", JSON.stringify({ actionId: "act-9" }));
  assert.equal(a.ok, true);
  assert.deepEqual(r.streams[0].body, { sessionId: null, confirmActionId: "act-9" });
  assert.equal((await r.actions.handle("coordinator.confirm", "{}")).ok, false);
});

await t("coordinator: a failed stream with no text is a failed reply; with partial text it still answers", async () => {
  const bad = rig({ script: [{ t: "error", message: "Rate limited" }], outcomeOk: false });
  assert.deepEqual(await bad.actions.handle("coordinator.ask", JSON.stringify({ text: "hi" })), { ok: false, error: "Rate limited" });
  const part = rig({ script: [{ t: "reply", text: "Half an answer." }, { t: "error", message: "cut" }], outcomeOk: false });
  assert.equal((await part.actions.handle("coordinator.ask", JSON.stringify({ text: "hi" }))).ok, true);
});

await t("clipAnswer: cuts at a sentence end inside 600 characters", async () => {
  const long = Array.from({ length: 80 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
  const c = clipAnswer(long);
  assert.ok(c.length <= 600);
  assert.ok(c.endsWith("."), c.slice(-20));
  assert.equal(clipAnswer("short"), "short");
});

await t("needsYou.reply: couple only; reply then handled", async () => {
  const r = rig();
  const a = await r.actions.handle("needsYou.reply", JSON.stringify({ id: "c1", text: "Yes, of course." }));
  assert.equal(a.ok, true);
  assert.deepEqual(r.calls.map((c) => [c.path, c.body]), [["/couple/messages/c1/reply", { text: "Yes, of course." }], ["/couple/messages/c1/handled", {}]]);
  const p = rig();
  p.state.role = "planner";
  assert.equal((await p.actions.handle("needsYou.reply", JSON.stringify({ id: "c1", text: "hi" }))).ok, false);
  assert.equal(p.calls.length, 0);
});

await t("refresh asks the app to refetch and resend", async () => {
  const r = rig();
  await r.actions.handle("refresh", "{}");
  assert.equal(r.state.refreshed, 1);
});

console.log(`watch-actions: ${n} checks passed`);

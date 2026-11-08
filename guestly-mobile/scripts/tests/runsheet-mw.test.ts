// Runsheet 1.4.0 app half: #2 locked timeline and change requests, #9 places
// with map buttons, #40 hair and makeup, K7 Undo restore. Pure checks of
// src/features/runsheet/core.ts against payloads recorded from the local
// integration portal (scripts/tests/fixtures/runsheet/, x-gl-app-version
// 1.3.0 and 1.4.0, MW_PLACES, MW_RUNSHEET_LOCK and MW_HMU on locally), plus
// copy parity and a few static checks of the screens.
// Run: node --no-warnings --experimental-strip-types scripts/tests/runsheet-mw.test.ts

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  approveKey,
  approveOutcome,
  glamSummary,
  glamWarningParts,
  lockDate,
  lockView,
  mapLinks,
  newRequestKey,
  openRequests,
  placeById,
  placesOn,
  proposalChanges,
  requestBody,
  requestsByBlock,
  sortedSlots,
  undoKind,
  warnedSlotIds,
  type GlamSlot,
} from "../../src/features/runsheet/core.ts";
import { COPY } from "../../src/features/runsheet/copy.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..", "..");
const fx = (name: string) => JSON.parse(readFileSync(join(HERE, "fixtures", "runsheet", `${name}.json`), "utf8")).data;
const src = (p: string) => readFileSync(join(APP, p), "utf8");

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
}

const OLD_KEYS = ["blocks_total", "can_edit", "days", "ics_url", "pending", "statuses", "vendors", "wedding_date"];
const OLD_BLOCK = ["day", "detail", "ends_at", "id", "location", "owner", "sort_order", "starts_at", "status", "title", "vendor_id", "vendor_name"];

const couple13 = fx("couple-runsheet-1.3.0");
const couple14 = fx("couple-runsheet-1.4.0");
const planner13 = fx("planner-runsheet-1.3.0");
const planner14 = fx("planner-runsheet-1.4.0");
const big = fx("big-runsheet-1.4.0");
const long = fx("long-runsheet-1.4.0");
const blocks = (s: { days: { blocks: unknown[] }[] }) => s.days.flatMap((d) => d.blocks) as Record<string, unknown>[];

test("1.3.0 payloads carry no new payload kind (flags on)", () => {
  for (const s of [couple13, planner13]) {
    assert.deepEqual(Object.keys(s).sort(), OLD_KEYS);
    for (const b of blocks(s)) assert.deepEqual(Object.keys(b).sort(), OLD_BLOCK);
  }
});

test("1.3.0 payload reads as today: no lock, no places, no glam", () => {
  const v = lockView(couple13);
  assert.equal(v.locked, false);
  assert.equal(v.canRequest, false);
  assert.equal(placesOn(couple13), false);
  assert.ok(blocks(couple13).every((b) => b.kind === undefined));
  // The planner list keeps plain badges, as before #2.
  assert.equal(lockView(planner13, { planner: true }).canMark, false);
});

test("#2 couple on a locked timeline with a planner who marks: requests, no status control, D28 sentence", () => {
  const v = lockView(couple14);
  assert.equal(couple14.can_edit, false);
  assert.deepEqual(v, { locked: true, canEdit: false, canMark: false, canRequest: true, canResolve: false, showMarkSentence: true });
});

test("#2 couple on a locked timeline without a planner who marks keeps the status control", () => {
  const v = lockView(big);
  assert.equal(v.locked, true);
  assert.equal(v.canMark, true);
  assert.equal(v.canRequest, true);
  assert.equal(v.showMarkSentence, false);
});

test("#2 planner resolves, never marks from the runsheet list", () => {
  const v = lockView(planner14, { planner: true });
  assert.equal(v.canResolve, true);
  assert.equal(v.canMark, false);
  assert.equal(v.canEdit, false);
});

test("#2 unlocked lock payload keeps today's editor rules", () => {
  const s = { ...couple14, can_edit: true, lock: { ...couple14.lock, locked: false, can_mark: true, can_request: true } };
  // Requests only while locked, whatever else the payload says.
  const v = lockView(s);
  assert.equal(v.canEdit, true);
  assert.equal(v.canMark, true);
  assert.equal(v.canRequest, false);
  assert.equal(v.showMarkSentence, false);
});

test("#2 a viewer on a locked timeline gets no sentence and no requests", () => {
  const s = { ...couple14, can_edit: false, lock: { ...couple14.lock, can_request: false, can_mark: false } };
  const v = lockView(s);
  assert.equal(v.canRequest, false);
  assert.equal(v.showMarkSentence, false);
});

test("#2 requests: open ones, by block (edit and remove), adds have no block", () => {
  const open = openRequests(couple14.requests);
  assert.equal(open.length, 3);
  const by = requestsByBlock(open);
  const kinds = [...by.values()].flat().map((r) => r.kind).sort();
  assert.deepEqual(kinds, ["edit", "remove"]);
  assert.ok(open.some((r) => r.kind === "add" && r.target_id === null));
  assert.equal(openRequests([{ ...open[0], status: "withdrawn" }]).length, 0);
});

test("#2 what changes: only changed fields, times by HH:MM, text trimmed, place only with places on", () => {
  const b = blocks(couple14).find((x) => x.title === "Ceremony") as never as Parameters<typeof proposalChanges>[0] & Record<string, string>;
  const form = { day: b.day, starts_at: b.starts_at, ends_at: b.ends_at ?? "", title: ` ${b.title} `, detail: b.detail, location: b.location, owner: b.owner, vendor_id: b.vendor_id ?? "", status: b.status, place_id: (b.place_id as string | null) ?? "" };
  assert.deepEqual(proposalChanges(b, form, true), []);
  assert.deepEqual(proposalChanges(b, { ...form, starts_at: "17:00" }, true), [{ field: "starts_at", before: b.starts_at, after: "17:00" }]);
  assert.deepEqual(proposalChanges({ ...b, starts_at: "16:45:00" }, form, true), []);
  const other = (couple14.places as { id: string }[]).find((p) => p.id !== b.place_id)!.id;
  assert.equal(proposalChanges(b, { ...form, place_id: other }, true).length, 1);
  assert.equal(proposalChanges(b, { ...form, place_id: other }, false).length, 0);
  // A new block (no base): every filled field is a change.
  assert.ok(proposalChanges(null, form, false).some((ch) => ch.field === "title"));
});

test("#2 request body: remove sends no block, note trimmed and capped", () => {
  assert.deepEqual(requestBody("remove", "b1", { title: "x" }, "  "), { kind: "remove", block_id: "b1" });
  const add = requestBody("add", null, { title: "Mariachi" }, ` ${"n".repeat(600)} `);
  assert.equal(add.block_id, undefined);
  assert.deepEqual(add.block, { title: "Mariachi" });
  assert.equal(add.note?.length, 500);
  const k1 = newRequestKey();
  assert.match(k1, /^rq-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.notEqual(k1, newRequestKey());
});

test("#2 approve answers", () => {
  assert.equal(approveOutcome({ status: 409, code: "stale", reason: null }), "stale");
  assert.equal(approveOutcome({ status: 409, code: "stale", reason: "target_gone" }), "target_gone");
  assert.equal(approveOutcome({ status: 409, code: "already_resolved", reason: null }), "already_resolved");
  assert.equal(approveOutcome({ status: 423, code: "runsheet_locked", reason: null }), "locked");
  assert.equal(approveOutcome({ status: 0, code: "offline", reason: null }), "other");
  assert.equal(approveOutcome(null), "other");
});

test("#2 lock date as people say it", () => {
  assert.equal(lockDate("2026-11-05T15:20:00+00:00", "en"), "Nov 5");
  assert.match(lockDate("2026-11-05T15:20:00+00:00", "es") ?? "", /^5 nov$/);
  assert.equal(lockDate(null, "en"), null);
  assert.equal(lockDate("garbage", "en"), null);
});

test("K7 Undo: restore the same id only when the delete said restorable, never re-create", () => {
  assert.equal(undoKind({ deleted: true, restorable: true }), "restore");
  assert.equal(undoKind({ deleted: true, restorable: false }), "none");
  assert.equal(undoKind({ deleted: true }), "none");
  assert.equal(undoKind(null), "none");
});

test("#2 a request never carries a status the person may not mark (D28)", () => {
  const b = blocks(couple14)[0] as never as Parameters<typeof proposalChanges>[0] & { status: string };
  const form = { ...(b as object), ends_at: (b as { ends_at: string | null }).ends_at ?? "", vendor_id: (b as { vendor_id: string | null }).vendor_id ?? "", place_id: "", status: b!.status === "done" ? "planned" : "done" } as never;
  assert.ok(proposalChanges(b, form, false, true).some((ch) => ch.field === "status"));
  assert.ok(!proposalChanges(b, form, false, false).some((ch) => ch.field === "status"));
});

test("#2 approve: one Idempotency-Key per request, choice and block version", () => {
  const r = { id: "4f1c2a3b-0000-4000-8000-1234567890ab", base: { updated_at: "2026-11-05T15:20:00.123+00:00" } } as never;
  const k = approveKey(r);
  assert.equal(k, approveKey(r), "a retry after a timeout reuses the key");
  assert.match(k, /^[A-Za-z0-9_-]{8,100}$/, "the server's key alphabet");
  assert.notEqual(k, approveKey(r, { applyAnyway: true }));
  assert.notEqual(k, approveKey(r, { asNew: true }));
  assert.notEqual(k, approveKey({ id: (r as { id: string }).id, base: { updated_at: "2026-11-05T15:21:00+00:00" } } as never), "a newer block version is a new approval");
  assert.match(approveKey({ id: "x", base: null } as never), /^[A-Za-z0-9_-]{8,100}$/);
});

test("#9 places: on with the key, server links kept, block place resolves", () => {
  assert.equal(placesOn(couple14), true);
  for (const p of couple14.places) {
    const l = mapLinks(p);
    assert.equal(l.apple, p.apple_maps_url);
    assert.equal(l.google, p.google_maps_url);
    assert.match(l.apple!, /^https:\/\/maps\.apple\.com\//);
    assert.match(l.google!, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
  }
  const linked = blocks(couple14).find((b) => b.place_id);
  assert.ok(placeById(couple14.places, linked!.place_id as string));
  assert.equal(placeById(couple14.places, null), null);
  assert.ok(big.places.length >= 6);
});

test("#9 map links built when the server sent none: accents, # and & encoded; coordinates win; https only", () => {
  const base = { name: "Iglesia San José & Cía", address: "Calle Ñandú #12, Santa Cruz", lat: null, lng: null, apple_maps_url: null, google_maps_url: null };
  const l = mapLinks(base);
  assert.equal(l.apple, "https://maps.apple.com/?q=Iglesia%20San%20Jos%C3%A9%20%26%20C%C3%ADa&address=Calle%20%C3%91and%C3%BA%20%2312%2C%20Santa%20Cruz");
  assert.equal(l.google, "https://www.google.com/maps/search/?api=1&query=Iglesia%20San%20Jos%C3%A9%20%26%20C%C3%ADa%2C%20Calle%20%C3%91and%C3%BA%20%2312%2C%20Santa%20Cruz");
  const c = mapLinks({ ...base, lat: -17.78, lng: -63.18 });
  assert.match(c.apple!, /^https:\/\/maps\.apple\.com\/\?ll=-17\.78,-63\.18&q=/);
  assert.equal(c.google, "https://www.google.com/maps/search/?api=1&query=-17.78,-63.18");
  const hostile = mapLinks({ ...base, apple_maps_url: "javascript:alert(1)", google_maps_url: "http://evil.example" });
  assert.match(hostile.apple!, /^https:\/\/maps\.apple\.com\//);
  assert.match(hostile.google!, /^https:\/\/www\.google\.com\//);
  assert.deepEqual(mapLinks({ ...base, name: "", address: "" }), { apple: null, google: null });
});

test("#40 typical: 6 people, 2 stylists, 12:00 to 14:45, no warnings", () => {
  const g = blocks(couple14).find((b) => b.kind === "glam")!;
  const slots = g.glam as GlamSlot[];
  assert.deepEqual(glamSummary(slots), { people: 6, stylists: 2, start: "12:00", end: "14:45" });
  assert.deepEqual(g.glam_warnings, []);
  const order = sortedSlots(slots).map((s) => s.starts_at);
  assert.deepEqual(order, [...order].sort());
});

test("#40 stress: the past-the-end warning names the person; the empty glam block reads empty", () => {
  const glams = blocks(big).filter((b) => b.kind === "glam");
  const damas = glams.find((b) => (b.glam as unknown[]).length === 12)!;
  const w = (damas.glam_warnings as { kind: string; ids: string[]; at: string }[])[0];
  const parts = glamWarningParts(w, damas.glam as GlamSlot[]);
  assert.equal(parts?.kind, "after_end");
  assert.ok(parts!.who.length > 0);
  assert.equal(warnedSlotIds(damas.glam_warnings as never).size, 1);
  assert.ok(glams.some((b) => (b.glam as unknown[]).length === 0));
  assert.deepEqual(glamSummary([]), { people: 0, stylists: 0, start: null, end: null });
});

test("#40 people: same name with another note is another person; after midnight sorts last", () => {
  const s = (id: string, person: string, notes: string, start: string, end: string, stylist: string | null): GlamSlot => ({ id, person, service: "hair", stylist_name: stylist, stylist_vendor_id: null, starts_at: start, ends_at: end, offset_min: 0, duration_min: 30, notes });
  const slots = [s("a", "María", "tía", "23:30", "00:15", "Ana"), s("b", "maria", "prima", "22:00", "22:30", "ana"), s("c", "María", "tía", "21:00", "21:30", null)];
  assert.deepEqual(glamSummary(slots), { people: 2, stylists: 1, start: "21:00", end: "00:15" });
  assert.deepEqual(sortedSlots(slots).map((x) => x.id), ["c", "b", "a"]);
  assert.equal(glamWarningParts({ kind: "overlap", ids: ["c"], at: "21:00" }, slots), null, "no stylist, no overlap line");
  assert.equal(glamWarningParts({ kind: "twice", ids: ["zz"], at: "21:00" }, slots), null);
});

test("long names payload parses", () => {
  assert.ok(lockView(long).locked);
  assert.ok(long.places.every((p: { name: string }) => mapLinks(p as never).apple));
});

test("copy: EN and ES keys and placeholders match; no dashes, no exclamation, no 'successfully'; brand-free", () => {
  const flat = (o: unknown, pre = ""): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof v === "string") out[pre + k] = v;
      else Object.assign(out, flat(v, `${pre}${k}.`));
    }
    return out;
  };
  const en = flat(COPY.en);
  const es = flat(COPY.es);
  assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort());
  const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
  for (const k of Object.keys(en)) {
    assert.equal(ph(en[k]), ph(es[k]), `placeholders of ${k}`);
    for (const v of [en[k], es[k]]) {
      assert.ok(!/[–—]/.test(v), `dash in ${k}`);
      assert.ok(!/[!¡]/.test(v), `exclamation in ${k}`);
      assert.ok(!/successfully|exitosamente|con éxito/i.test(v), `successfully in ${k}`);
    }
  }
  // D28's sentence, word for word (the server and the day-of view say the same).
  assert.equal(COPY.en.lockedStatus, "Your planner marks the timeline on the day.");
  assert.equal(COPY.es.lockedStatus, "Tu planner marca el cronograma el día de la boda.");
  // Glossary: Request a change / Solicitar un cambio; Lugares; Peinado y maquillaje; Estilista.
  assert.equal(COPY.es.requestChange, "Solicitar un cambio");
  assert.equal(COPY.es.places, "Lugares");
  assert.equal(COPY.es.hmu, "Peinado y maquillaje");
  assert.ok(!/glam|HMU/i.test(Object.values(en).concat(Object.values(es)).join("\n")));
  assert.ok(!/bloquear/i.test(Object.values(es).join("\n")));
  // One name for one thing, as the portal and the glossary: cronograma and
  // momento, moment in English (never guion, bloque, block).
  assert.equal(COPY.es.title, "Cronograma del día");
  assert.equal(COPY.es.addBlock, "Agregar momento");
  assert.ok(!/guion|bloque/i.test(Object.values(es).join("\n")), "no guion or bloque");
  assert.ok(!/\bblocks?\b/i.test(Object.values(en).join("\n")), "no block in English");
});

test("screens: flags hide places, delete has no confirm, Undo uses restore, locked refusals use the one sentence", () => {
  const couple = src("src/app/couple/(tools)/runsheet/index.tsx");
  const planner = src("src/app/planner/(tools)/runsheet/index.tsx");
  const detail = src("src/app/couple/(tools)/runsheet/[id].tsx");
  const actions = src("src/features/runsheet/actions.ts");
  for (const s of [couple, planner]) assert.match(s, /featureOn\(me, "MW_PLACES"\)/);
  assert.doesNotMatch(detail, /Alert\.alert/);
  assert.match(actions, /\/couple\/runsheet\/\$\{b\.id\}\/restore/);
  assert.match(actions, /runDelete\(/);
  // Undo never records the block again (a new id): no POST of the block body.
  assert.doesNotMatch(actions, /post\("\/couple\/runsheet",/);
  // Request and read modes show the status as a badge (D28).
  assert.match(detail, /statusEditable=\{mode === "edit"\}/);
  assert.match(src("src/app/couple/(tools)/runsheet/new.tsx"), /statusEditable=\{!request\}/);
  // The Apple logo is for Sign in with Apple only, never a Maps button.
  assert.doesNotMatch(src("src/features/runsheet/mw.tsx"), /name="apple"/);
  assert.doesNotMatch(src("src/app/guest/schedule.tsx"), /icon="apple"/);
  // Unlock shows the open lock.
  assert.match(src("src/features/runsheet/mw.tsx"), /lock\.locked \? "unlock" : "lock"/);
  // The draft refusal is a line in the lock card, not a passing toast.
  assert.doesNotMatch(planner, /c\.draftLock/);
  assert.match(planner, /approveKey\(r, opts\)/);
  assert.match(couple, /isLocked\(err\) \? c\.lockedStatus/);
  assert.match(actions, /"Idempotency-Key": key/);
  // Maps open by deep link (https universal links), no map SDK or key.
  const mw = src("src/features/runsheet/mw.tsx");
  assert.doesNotMatch(mw, /react-native-maps|MapView|apiKey/);
  assert.match(mw, /openUrlSafe\(links\.apple/);
});

console.log(`runsheet-mw: ${passed} checks passed`);

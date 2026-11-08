// Contract of the runsheet routes the 1.4.0 app reads and writes (#2, #9, #40,
// K7), against a LOCAL portal only. Skips (exit 0) unless GL_CONTRACT_BASE is
// set, so `npm test` never needs a server.
//
//   GL_CONTRACT_BASE=http://localhost:3200 GL_PORTAL_DIR=/Users/nicolas_z/gl-mw/integration \
//     node --no-warnings --experimental-strip-types scripts/tests/runsheet-contract.test.ts
//
// Logs in as couple@hh.local and planner@hh.local on the portal's local
// Supabase (read from GL_PORTAL_DIR/.env.local; refuses any URL that is not
// 127.0.0.1 or localhost). Writes only to the local demo wedding, and puts
// back what it changes: a throwaway block (deleted again), a request
// (withdrawn), the lock (set back as found).
// Checks: 1.3.0 answers carry no new key with every flag on; 1.4.0 carries the
// shapes core.ts reads; a locked timeline answers 423 runsheet_locked with
// both sentences (D28's for a status); a request is idempotent on its key;
// DELETE answers restorable and restore brings back the same id; places carry
// https map links; a flag that is off answers 404 (the app hides the screen).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lockView, mapLinks, undoKind } from "../../src/features/runsheet/core.ts";
import { COPY } from "../../src/features/runsheet/copy.ts";

const BASE = process.env.GL_CONTRACT_BASE;
if (!BASE) {
  console.log("runsheet-contract: SKIP (set GL_CONTRACT_BASE to a local portal)");
  process.exit(0);
}
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) {
  console.error("refused: GL_CONTRACT_BASE must be a local portal");
  process.exit(2);
}
const PORTAL = process.env.GL_PORTAL_DIR ?? "/Users/nicolas_z/gl-mw/integration";
const env = Object.fromEntries(
  readFileSync(join(PORTAL, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(String(SUPA))) {
  console.error("refused: not a local Supabase URL");
  process.exit(2);
}
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SLUG = process.env.GL_CONTRACT_SLUG ?? "valentina-y-mateo";

async function login(email: string): Promise<string> {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: process.env.GL_CONTRACT_PASSWORD ?? "Local-hh-2026!" }) });
  const j = (await r.json()) as { access_token?: string };
  assert.ok(j.access_token, `login ${email}`);
  return j.access_token!;
}

type Env = { status: number; ok: boolean; data: Record<string, unknown> | null; error: Record<string, unknown> | null };
async function call(token: string, version: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Env> {
  const r = await fetch(`${BASE}/api/mobile/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "x-gl-app-version": version, "x-gl-platform": "ios", "x-gl-tenant": SLUG, "x-gl-lang": "en", ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = (await r.json().catch(() => null)) as { ok: boolean; data?: Record<string, unknown>; error?: Record<string, unknown> } | null;
  return { status: r.status, ok: !!j?.ok, data: j?.data ?? null, error: j?.error ?? null };
}

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
}

const OLD_KEYS = ["blocks_total", "can_edit", "days", "ics_url", "pending", "statuses", "vendors", "wedding_date"];
const OLD_BLOCK = ["day", "detail", "ends_at", "id", "location", "owner", "sort_order", "starts_at", "status", "title", "vendor_id", "vendor_name"];
const blocksOf = (d: Record<string, unknown>) => (d.days as { blocks: Record<string, unknown>[] }[]).flatMap((x) => x.blocks);

const couple = await login("couple@hh.local");
const planner = await login("planner@hh.local");
const me = await call(couple, "1.4.0", "GET", "/auth/me");
const features = (me.data?.features ?? {}) as Record<string, boolean>;
console.log(`flags: places ${features.MW_PLACES}, lock ${features.MW_RUNSHEET_LOCK}, hmu ${features.MW_HMU}`);

await test("1.3.0 couple and planner runsheet: today's keys only", async () => {
  for (const [tok, path] of [[couple, "/couple/runsheet"], [planner, "/planner/runsheet"]] as const) {
    const r = await call(tok, "1.3.0", "GET", path);
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.data!).sort(), OLD_KEYS, path);
    for (const b of blocksOf(r.data!)) assert.deepEqual(Object.keys(b).sort(), OLD_BLOCK, `${path} block`);
  }
});

const c14 = (await call(couple, "1.4.0", "GET", "/couple/runsheet")).data!;
const p14 = (await call(planner, "1.4.0", "GET", "/planner/runsheet")).data!;

await test("1.4.0 keys follow the flags", async () => {
  assert.equal("places" in c14, features.MW_PLACES === true);
  assert.equal("lock" in c14, features.MW_RUNSHEET_LOCK === true);
  assert.equal("lock" in p14, features.MW_RUNSHEET_LOCK === true);
  const bl = blocksOf(c14);
  if (features.MW_HMU) assert.ok(bl.every((b) => b.kind === "block" || b.kind === "glam"));
  else assert.ok(bl.every((b) => !("kind" in b)));
});

if (features.MW_PLACES) {
  await test("#9 places: https map links, block place ids resolve, /couple/places has the form fields", async () => {
    const places = c14.places as Record<string, unknown>[];
    for (const p of places) {
      const l = mapLinks(p as never);
      assert.ok(l.apple?.startsWith("https://") && l.google?.startsWith("https://"));
    }
    const ids = new Set(places.map((p) => p.id));
    for (const b of blocksOf(c14)) if (b.place_id) assert.ok(ids.has(b.place_id), "place_id resolves");
    const list = await call(couple, "1.4.0", "GET", "/couple/places");
    if (c14.prep_hidden) return;
    assert.equal(list.status, 200);
    for (const p of list.data!.places as Record<string, unknown>[]) {
      assert.ok("maps_link" in p && typeof p.show_on_site === "boolean");
    }
  });
} else {
  await test("#9 off: /couple/places answers 404 not_found (the app hides it)", async () => {
    const r = await call(couple, "1.4.0", "GET", "/couple/places");
    assert.equal(r.status, 404);
    assert.equal(r.error?.code, "not_found");
  });
}

if (!features.MW_RUNSHEET_LOCK) {
  await test("#2 off: request routes answer 404 not_found", async () => {
    const r = await call(couple, "1.4.0", "POST", "/couple/runsheet/requests", { kind: "add", block: { day: "2027-05-22", starts_at: "22:00", title: "x" } });
    assert.equal(r.status, 404);
    assert.equal(r.error?.code, "not_found");
  });
}

const lock = c14.lock as { locked: boolean; can_mark: boolean; can_request: boolean } | undefined;
if (lock?.locked) {
  await test("#2 locked: couple writes answer 423 runsheet_locked with both sentences (1.3.0 and 1.4.0)", async () => {
    for (const v of ["1.3.0", "1.4.0"]) {
      const r = await call(couple, v, "POST", "/couple/runsheet", { day: "2027-05-22", starts_at: "22:00", title: "Contract probe" });
      assert.equal(r.status, 423, v);
      assert.equal(r.error?.code, "runsheet_locked");
      assert.equal(r.error?.message_en, COPY.en.lockedContent);
      assert.equal(r.error?.message_es, COPY.es.lockedContent);
    }
    if (!lock.can_mark) {
      const b = blocksOf(c14)[0];
      const r = await call(couple, "1.4.0", "POST", `/couple/runsheet/${b.id}/status`, { status: b.status });
      assert.equal(r.status, 423);
      assert.equal(r.error?.message_en, COPY.en.lockedStatus, "D28 sentence word for word");
      assert.equal(r.error?.message_es, COPY.es.lockedStatus);
    }
    assert.equal(lockView(c14 as never).canRequest, lock.can_request);
  });

  await test("#2 a request is sent once per key; withdraw and reopen; cleaned up", async () => {
    const key = `rq-contract-${Date.now()}`;
    const body = { kind: "add", block: { day: "2027-05-22", starts_at: "23:15", ends_at: "23:30", title: "Contract probe" }, note: "contract test" };
    const a = await call(couple, "1.4.0", "POST", "/couple/runsheet/requests", body, { "Idempotency-Key": key });
    assert.equal(a.status, 200, JSON.stringify(a.error));
    const b = await call(couple, "1.4.0", "POST", "/couple/runsheet/requests", body, { "Idempotency-Key": key });
    const ra = a.data!.request as { id: string; kind: string; status: string };
    assert.equal((b.data!.request as { id: string }).id, ra.id, "same key, same request");
    assert.equal(ra.kind, "add");
    assert.equal(ra.status, "open");
    const w = await call(couple, "1.4.0", "DELETE", `/couple/runsheet/requests/${ra.id}`);
    assert.equal(w.status, 200);
    const o = await call(couple, "1.4.0", "POST", `/couple/runsheet/requests/${ra.id}/reopen`);
    assert.equal(o.status, 200);
    const w2 = await call(couple, "1.4.0", "DELETE", `/couple/runsheet/requests/${ra.id}`);
    assert.equal(w2.status, 200);
  });

  await test("#2 planner unlock then lock (the app's Undo), state put back", async () => {
    const pl = p14.lock as { can_resolve: boolean };
    assert.equal(pl.can_resolve, true);
    const u = await call(planner, "1.4.0", "POST", "/planner/runsheet/lock", { locked: false });
    assert.equal(u.status, 200, JSON.stringify(u.error));
    assert.equal((u.data!.lock as { locked: boolean }).locked, false);
    const opened = (await call(couple, "1.4.0", "GET", "/couple/runsheet")).data!;
    assert.equal(lockView(opened as never).canEdit, true, "couple edits again");
    const l = await call(planner, "1.4.0", "POST", "/planner/runsheet/lock", { locked: true });
    assert.equal(l.status, 200);
    assert.equal((l.data!.lock as { locked: boolean }).locked, true);
  });
} else {
  await test("K7: delete answers restorable, restore brings back the same id (throwaway block)", async () => {
    const made = await call(couple, "1.4.0", "POST", "/couple/runsheet", { day: "2027-05-22", starts_at: "23:40", title: "Contract probe" });
    assert.equal(made.status, 200, JSON.stringify(made.error));
    const id = (made.data!.block as { id: string }).id;
    const d = await call(couple, "1.4.0", "DELETE", `/couple/runsheet/${id}`);
    assert.equal(d.status, 200);
    assert.equal(undoKind(d.data), "restore");
    const gone = (await call(couple, "1.4.0", "GET", "/couple/runsheet")).data!;
    assert.ok(!blocksOf(gone).some((b) => b.id === id));
    const r = await call(couple, "1.4.0", "POST", `/couple/runsheet/${id}/restore`);
    assert.equal(r.status, 200);
    assert.equal((r.data!.block as { id: string }).id, id, "same id");
    const back = (await call(couple, "1.4.0", "GET", "/couple/runsheet")).data!;
    assert.ok(blocksOf(back).some((b) => b.id === id));
    const again = await call(couple, "1.4.0", "DELETE", `/couple/runsheet/${id}`);
    assert.equal(again.status, 200);
  });

  await test("K7 1.3.0: delete still answers deleted (restorable additive)", async () => {
    const made = await call(couple, "1.3.0", "POST", "/couple/runsheet", { day: "2027-05-22", starts_at: "23:45", title: "Contract probe" });
    assert.equal(made.status, 200);
    const id = (made.data!.block as { id: string }).id;
    const d = await call(couple, "1.3.0", "DELETE", `/couple/runsheet/${id}`);
    assert.equal(d.data!.deleted, true);
  });
}

console.log(`runsheet-contract: ${passed} checks passed`);

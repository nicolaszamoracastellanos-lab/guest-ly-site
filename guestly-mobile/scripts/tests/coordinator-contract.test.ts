// Contract of the routes the 1.4.0 Coordinator reads for #5 (plan card), the
// D5 mic and #32 (brief consent), against a LOCAL portal only. Skips (exit 0)
// unless GL_CONTRACT_BASE is set, so `npm test` needs no server.
//
//   GL_CONTRACT_BASE=http://localhost:3200 GL_PORTAL_DIR=/Users/nicolas_z/gl-mw/integration \
//     node --no-warnings --experimental-strip-types scripts/tests/coordinator-contract.test.ts
//
// Never sends a chat message (no model call) and writes nothing: GETs, and one
// POST that the 1.3.0 route must refuse before any work (an Undo from a build
// that does not draw plans). Checks: /auth/me carries MW_PLAN_CARD and MW_MIC
// as booleans for 1.4.0; the sessions list keeps its shape on 1.3.0 and 1.4.0;
// 1.3.0 cannot reach the plan Undo; the voice route is absent or dark (the app
// hides the mic on 404) or answers the contract; the brief route is dark (404)
// while MW_BRIEF is off.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import "./lib/ts-resolve.ts";

const BASE = process.env.GL_CONTRACT_BASE;
if (!BASE) {
  console.log("coordinator-contract: SKIP (set GL_CONTRACT_BASE to a local portal)");
  process.exit(0);
}
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) {
  console.error("refused: GL_CONTRACT_BASE must be a local portal");
  process.exit(2);
}
const { readAvailability, micVisible } = await import("../../src/features/assistant/voiceCore.ts");

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
const SLUG = process.env.GL_CONTRACT_SLUG ?? "valentina-y-mateo";

async function login(email: string): Promise<string> {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: process.env.GL_CONTRACT_PASSWORD ?? "Local-hh-2026!" }) });
  const j = (await r.json()) as { access_token?: string };
  assert.ok(j.access_token, `login ${email}`);
  return j.access_token!;
}

type Env = { status: number; ok: boolean | null; data: Record<string, unknown> | null; code: string | null };
async function call(auth: string, version: string, method: string, p: string, body?: unknown): Promise<Env> {
  const r = await fetch(`${BASE}/api/mobile/v1${p}`, {
    method,
    headers: { Authorization: auth, "x-gl-app-version": version, "x-gl-platform": "ios", "x-gl-tenant": SLUG, "x-gl-lang": "en", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: Record<string, unknown>; error?: { code?: string } } | null;
  return { status: r.status, ok: j?.ok ?? null, data: j?.data ?? null, code: j?.error?.code ?? null };
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

const couple = `Bearer ${await login("couple@hh.local")}`;
const planner = `Bearer ${await login("planner@hh.local")}`;

await test("1.4.0 /auth/me: MW_PLAN_CARD, MW_MIC and MW_BRIEF are booleans", async () => {
  const me = await call(couple, "1.4.0", "GET", "/auth/me");
  const F = (me.data?.features ?? {}) as Record<string, unknown>;
  for (const k of ["MW_PLAN_CARD", "MW_MIC", "MW_BRIEF"]) assert.equal(typeof F[k], "boolean", k);
  console.log(`     flags (${SLUG}): plan card ${F.MW_PLAN_CARD}, mic ${F.MW_MIC}`);
});

await test("sessions list: same shape on 1.3.0 and 1.4.0", async () => {
  for (const v of ["1.3.0", "1.4.0"]) {
    const r = await call(couple, v, "GET", "/couple/coordinator/sessions");
    assert.equal(r.status, 200, v);
    assert.deepEqual(Object.keys(r.data ?? {}).sort(), ["enabled", "sessions"], v);
    for (const s of (r.data!.sessions as Record<string, unknown>[]) ?? []) assert.deepEqual(Object.keys(s).sort(), ["created_at", "id", "last_active_at", "title"]);
  }
});

await test("1.3.0 cannot reach a plan Undo (refused before any work, no new payload kind)", async () => {
  const r = await call(couple, "1.3.0", "POST", "/couple/coordinator", { undoActionId: "00000000-0000-4000-8000-000000000000", undoStepId: "s1" });
  assert.equal(r.status, 400);
  assert.equal(r.ok, false);
  assert.equal(r.code, "bad_request");
});

await test("voice route: absent or dark answers 404 (mic hidden); a live one answers the contract", async () => {
  const r = await call(couple, "1.4.0", "GET", "/couple/coordinator/voice");
  if (r.status === 404) {
    assert.equal(micVisible(true, null, true), false);
    console.log("     voice route: 404 (not built or MW_MIC off): mic hidden");
    return;
  }
  assert.equal(r.status, 200);
  assert.equal(typeof r.data?.enabled, "boolean");
  readAvailability(r.data);
});

await test("brief route is dark (404 not_found) while MW_BRIEF is off", async () => {
  const me = await call(planner, "1.4.0", "GET", "/auth/me");
  const on = ((me.data?.features ?? {}) as Record<string, boolean>).MW_BRIEF === true;
  const r = await call(planner, "1.4.0", "GET", `/planner/weddings/${encodeURIComponent(SLUG)}/brief`);
  if (on) assert.equal(r.status, 200);
  else {
    assert.equal(r.status, 404);
    assert.equal(r.code, "not_found");
  }
});

console.log(`coordinator-contract: ${passed}/5 passed against ${BASE}`);

// Contract of the routes the 1.4.0 app reads for #1 final count, #26 travel,
// #45 know-before, #37 Seen and K21, against a LOCAL portal only. Skips
// (exit 0) unless GL_CONTRACT_BASE is set, so `npm test` needs no server.
//
//   GL_CONTRACT_BASE=http://localhost:3200 GL_PORTAL_DIR=/Users/nicolas_z/gl-mw/integration \
//     node --no-warnings --experimental-strip-types scripts/tests/guests-contract.test.ts
//
// Reads only: logs in as couple@hh.local and planner@hh.local, and as one
// guest of the local demo wedding with a token signed by the local secret
// (GL_PORTAL_DIR/.env.local; refuses any URL that is not localhost). The only
// row it can cause is the portal's own K21 open record for that local guest.
// Checks: 1.3.0 answers carry no new key or section type whatever the flags;
// 1.4.0 keys follow /auth/me features; a flag that is off answers 404
// not_found on the new routes (the app hides the screen); ?seen=0 records
// no open.

import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readFinalCount } from "../../src/features/finalcount/core.ts";
import { readKnowBefore } from "../../src/features/site/knowbeforeCore.ts";
import { readGuestTravel } from "../../src/features/travel/core.ts";
import { readRunsheetSeen } from "../../src/features/seen/core.ts";

const BASE = process.env.GL_CONTRACT_BASE;
if (!BASE) {
  console.log("guests-contract: SKIP (set GL_CONTRACT_BASE to a local portal)");
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
const SLUG = process.env.GL_CONTRACT_SLUG ?? "valentina-y-mateo";
const SR = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };

async function login(email: string): Promise<string> {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: process.env.GL_CONTRACT_PASSWORD ?? "Local-hh-2026!" }) });
  const j = (await r.json()) as { access_token?: string };
  assert.ok(j.access_token, `login ${email}`);
  return j.access_token!;
}

/** A guest token as the portal mints it (lib/mobile/guest-token.ts), local secret only. */
function guestToken(tenantId: string, guestId: string, inviteCode: string | null, v: number): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = { tenant_id: tenantId, guest_id: guestId, iat: now, exp: now + 3600, since: now, c: inviteCode ? createHash("sha256").update(inviteCode).digest("hex").slice(0, 12) : undefined, v, jti: randomUUID() };
  const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const s = createHmac("sha256", env.MOBILE_GUEST_TOKEN_SECRET).update(p).digest().toString("base64url");
  return `${p}.${s}`;
}

type Env = { status: number; ok: boolean; data: Record<string, unknown> | null; error: Record<string, unknown> | null };
async function call(auth: string, version: string, method: string, path: string, body?: unknown): Promise<Env> {
  const r = await fetch(`${BASE}/api/mobile/v1${path}`, {
    method,
    headers: { Authorization: auth, "x-gl-app-version": version, "x-gl-platform": "ios", "x-gl-tenant": SLUG, "x-gl-lang": "en", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
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

const couple = `Bearer ${await login("couple@hh.local")}`;
const planner = `Bearer ${await login("planner@hh.local")}`;
const tenant = ((await (await fetch(`${SUPA}/rest/v1/tenants?slug=eq.${SLUG}&select=id,invite_code`, { headers: SR })).json()) as { id: string; invite_code: string | null }[])[0];
const guestRow = ((await (await fetch(`${SUPA}/rest/v1/guests?tenant_id=eq.${tenant.id}&select=id,token_version&order=created_at.asc&limit=1`, { headers: SR })).json()) as { id: string; token_version: number | null }[])[0];
const guest = `Guest ${guestToken(tenant.id, guestRow.id, tenant.invite_code, guestRow.token_version ?? 0)}`;
const me = await call(couple, "1.4.0", "GET", "/auth/me");
const F = (me.data?.features ?? {}) as Record<string, boolean>;
console.log(`flags: final ${F.MW_FINAL_COUNT}, travel ${F.MW_TRAVEL_WINDOWS}, know ${F.MW_KNOW_BEFORE}, seen ${F.MW_SEEN}`);

const OLD_SITE_TYPES = ["hero", "countdown", "story", "party", "schedule", "travel", "registry", "faq", "gallery", "video", "chat", "custom", "rsvp"];

await test("1.3.0: no new payload kind or key on any route this step reads", async () => {
  const rs = await call(couple, "1.3.0", "GET", "/couple/rsvps?filter=pending");
  assert.equal(rs.status, 200);
  assert.ok(!("final_count" in rs.data!), "no final_count");
  const gl = await call(couple, "1.3.0", "GET", "/couple/guests?limit=5");
  assert.equal(gl.status, 200);
  for (const it of gl.data!.items as Record<string, unknown>[]) assert.ok(!("seen_at" in it), "no seen_at");
  const first = (gl.data!.items as { id: string }[])[0];
  if (first) {
    const gd = await call(couple, "1.3.0", "GET", `/couple/guests/${first.id}`);
    assert.ok(!("seen" in gd.data!), "no seen on the card");
  }
  const crs = await call(couple, "1.3.0", "GET", "/couple/runsheet");
  assert.ok(!("version" in crs.data!), "no runsheet version");
  const prs = await call(planner, "1.3.0", "GET", "/planner/runsheet");
  assert.ok(!("seen" in prs.data!), "no planner seen");
  const gr = await call(guest, "1.3.0", "GET", "/guest/rsvp");
  assert.equal(gr.status, 200, JSON.stringify(gr.error));
  assert.ok(!("locked" in (gr.data!.payload as object)) && !("locked" in (gr.data!.summary as object)), "no locked");
  for (const q of (gr.data!.payload as { questions: Record<string, unknown>[] }).questions) assert.ok(!("per_person" in q), "no per_person");
  const site = await call(guest, "1.3.0", "GET", "/guest/site");
  if (site.status === 200) for (const s of site.data!.sections as { type: string }[]) assert.ok(OLD_SITE_TYPES.includes(s.type), `1.3 knows ${s.type}`);
  else assert.equal(site.status, 404);
  const home = await call(guest, "1.3.0", "GET", "/guest/home");
  assert.equal(home.status, 200);
  assert.ok(!("locked" in (home.data!.rsvp as object)));
});

await test("1.4.0 keys follow the flags", async () => {
  const rs = await call(couple, "1.4.0", "GET", "/couple/rsvps?filter=pending");
  assert.equal("final_count" in rs.data!, F.MW_FINAL_COUNT === true);
  if (F.MW_FINAL_COUNT) assert.ok(readFinalCount(rs.data));
  const gl = await call(couple, "1.4.0", "GET", "/couple/guests?limit=5");
  for (const it of gl.data!.items as Record<string, unknown>[]) assert.equal("seen_at" in it, F.MW_SEEN === true);
  const crs = await call(couple, "1.4.0", "GET", "/couple/runsheet");
  assert.equal("version" in crs.data!, F.MW_SEEN === true);
  const prs = await call(planner, "1.4.0", "GET", "/planner/runsheet");
  if (F.MW_SEEN) assert.ok(readRunsheetSeen(prs.data));
  else assert.ok(!("seen" in prs.data!));
  const site = await call(guest, "1.4.0", "GET", "/guest/site");
  if (site.status === 200) {
    const kb = (site.data!.sections as { type: string }[]).find((s) => s.type === "knowbefore");
    if (!F.MW_KNOW_BEFORE) assert.equal(kb, undefined);
    else if (kb) assert.ok(readKnowBefore(kb));
  }
});

await test("routes of a flag that is off answer 404 not_found (the app hides the screen)", async () => {
  const checks: [boolean, string, Env][] = [
    [F.MW_FINAL_COUNT, "POST /couple/rsvps/lock", await (F.MW_FINAL_COUNT ? Promise.resolve({ status: 0 } as Env) : call(couple, "1.4.0", "POST", "/couple/rsvps/lock", {}))],
    [F.MW_TRAVEL_WINDOWS, "GET /couple/arrivals", await call(couple, "1.4.0", "GET", "/couple/arrivals")],
    [F.MW_TRAVEL_WINDOWS, "GET /planner/weddings/{slug}/arrivals", await call(planner, "1.4.0", "GET", `/planner/weddings/${SLUG}/arrivals`)],
    [F.MW_SEEN, "POST /couple/runsheet/seen", await (F.MW_SEEN ? Promise.resolve({ status: 0 } as Env) : call(couple, "1.4.0", "POST", "/couple/runsheet/seen", { version: "x" }))],
  ];
  for (const [on, name, r] of checks) {
    if (on) continue;
    assert.equal(r.status, 404, name);
    assert.equal(r.error?.code, "not_found", name);
  }
  // /guest/travel is 404 while off OR while the couple does not ask.
  const tr = await call(guest, "1.4.0", "GET", "/guest/travel");
  if (tr.status === 200) assert.ok(readGuestTravel(tr.data));
  else {
    assert.equal(tr.status, 404);
    assert.equal(tr.error?.code, "not_found");
  }
});

await test("K21: ?seen=0 records no open; a plain GET still answers the same payload", async () => {
  const count = async () => {
    const r = await fetch(`${SUPA}/rest/v1/guest_events?tenant_id=eq.${tenant.id}&guest_id=eq.${guestRow.id}&name=eq.link_opened&select=id`, { headers: { ...SR, Prefer: "count=exact", Range: "0-0" } });
    return Number((r.headers.get("content-range") ?? "*/0").split("/")[1]);
  };
  const before = await count();
  const a = await call(guest, "1.4.0", "GET", "/guest/home?seen=0");
  assert.equal(a.status, 200);
  await new Promise((r) => setTimeout(r, 800));
  assert.equal(await count(), before, "a background refetch is not an open");
  const b = await call(guest, "1.4.0", "GET", "/guest/home");
  assert.deepEqual(Object.keys(b.data!).sort(), Object.keys(a.data!).sort());
});

console.log(`guests-contract: ${passed} checks passed`);

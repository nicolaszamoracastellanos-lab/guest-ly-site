// Contract of the #30 routes the 1.4.0 app reads and writes, against a LOCAL
// portal only (Lane 1's routes: couple/planner/guest pack, block status with
// client_event_id). Skips (exit 0) unless GL_CONTRACT_BASE is set, so
// `npm test` never needs a server.
//
//   GL_CONTRACT_BASE=http://localhost:3200 GL_PORTAL_DIR=/Users/nicolas_z/gl-mw/integration \
//     node --no-warnings --experimental-strip-types scripts/tests/day-pack-contract.test.ts
//
// It follows MW_DAY_PACK as /auth/me reports it for the local demo wedding:
// off, every route answers 404 not_found (the app hides #30, and a planner's
// queued tap is not reported as a deleted moment by mistake: see the note at
// the planner status check); on, each pack parses with the app's own
// parsePack / parseGuestPack, the ETag is strong and If-None-Match gives 304
// with no body, a status tap replayed with the same client_event_id is applied
// once, a deleted moment answers 404 "That moment was deleted.", and under the
// lock (MW_RUNSHEET_LOCK on, locked) the couple's tap answers 423
// runsheet_locked. 1.3.0 answers keep their keys either way.
//
// GL_WAIT_FLAG=on|off: poll /auth/me (up to 75 s, the portal caches flags for
// 60 s) until MW_DAY_PACK reads that way. GL_RECORD=1: write what the portal
// answered to fixtures/dayof/local-*.json (day-pack.test.ts parses them).
// Writes only to the local demo wedding and puts back what it changes: block
// statuses (set back as found), a throwaway block (deleted), the lock.

import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseGuestPack, parsePack } from "../../src/features/dayof/packCore.ts";
import { classifyFailure } from "../../src/lib/queueMath.ts";

const BASE = process.env.GL_CONTRACT_BASE;
if (!BASE) {
  console.log("day-pack-contract: SKIP (set GL_CONTRACT_BASE to a local portal)");
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
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures/dayof");

async function login(email: string): Promise<string> {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: process.env.GL_CONTRACT_PASSWORD ?? "Local-hh-2026!" }) });
  const j = (await r.json()) as { access_token?: string };
  assert.ok(j.access_token, `login ${email}`);
  return `Bearer ${j.access_token!}`;
}

/** A guest token as the portal mints it (lib/mobile/guest-token.ts), local secret only. */
function guestToken(tenantId: string, guestId: string, inviteCode: string | null, v: number): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = { tenant_id: tenantId, guest_id: guestId, iat: now, exp: now + 3600, since: now, c: inviteCode ? createHash("sha256").update(inviteCode).digest("hex").slice(0, 12) : undefined, v, jti: randomUUID() };
  const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const s = createHmac("sha256", env.MOBILE_GUEST_TOKEN_SECRET).update(p).digest().toString("base64url");
  return `Guest ${p}.${s}`;
}

type Res = { status: number; ok: boolean; data: Record<string, unknown> | null; error: Record<string, unknown> | null; headers: Headers; text: string };
async function call(auth: string, version: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> {
  const r = await fetch(`${BASE}/api/mobile/v1${path}`, {
    method,
    headers: { Authorization: auth, "x-gl-app-version": version, "x-gl-platform": "ios", "x-gl-tenant": SLUG, "x-gl-lang": "en", ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let j: { ok: boolean; data?: Record<string, unknown>; error?: Record<string, unknown> } | null = null;
  try {
    j = text ? JSON.parse(text) : null;
  } catch {
    j = null;
  }
  return { status: r.status, ok: !!j?.ok, data: j?.data ?? null, error: j?.error ?? null, headers: r.headers, text };
}

function record(name: string, r: Res) {
  if (process.env.GL_RECORD !== "1") return;
  const keep = ["etag", "cache-control", "vary", "content-type"];
  const headers = Object.fromEntries([...r.headers.entries()].filter(([k]) => keep.includes(k)));
  writeFileSync(join(FIXTURES, `local-${name}.json`), `${JSON.stringify({ status: r.status, headers, body: r.text ? JSON.parse(r.text) : null }, null, 2)}\n`);
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

const couple = await login("couple@hh.local");
const planner = await login("planner@hh.local");
const tenant = ((await (await fetch(`${SUPA}/rest/v1/tenants?slug=eq.${SLUG}&select=id,invite_code`, { headers: SR })).json()) as { id: string; invite_code: string | null }[])[0];
const guestRow = ((await (await fetch(`${SUPA}/rest/v1/guests?tenant_id=eq.${tenant.id}&select=id,token_version&order=created_at.asc&limit=1`, { headers: SR })).json()) as { id: string; token_version: number | null }[])[0];
const guest = guestToken(tenant.id, guestRow.id, tenant.invite_code, guestRow.token_version ?? 0);

async function features(): Promise<Record<string, boolean>> {
  const me = await call(couple, "1.4.0", "GET", "/auth/me");
  return (me.data?.features ?? {}) as Record<string, boolean>;
}
let F = await features();
const want = process.env.GL_WAIT_FLAG;
if (want === "on" || want === "off") {
  const deadline = Date.now() + 75_000;
  while ((F.MW_DAY_PACK === true) !== (want === "on") && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    F = await features();
  }
  assert.equal(F.MW_DAY_PACK === true, want === "on", `MW_DAY_PACK did not turn ${want} within 75 s`);
}
const ON = F.MW_DAY_PACK === true;
console.log(`flags: day pack ${ON}, lock ${F.MW_RUNSHEET_LOCK}`);

const OLD_KEYS = ["blocks_total", "can_edit", "days", "ics_url", "pending", "statuses", "vendors", "wedding_date"];
const OLD_BLOCK = ["day", "detail", "ends_at", "id", "location", "owner", "sort_order", "starts_at", "status", "title", "vendor_id", "vendor_name"];
const blocksOf = (d: Record<string, unknown>) => (d.days as { blocks: Record<string, unknown>[] }[]).flatMap((x) => x.blocks);
const firstBlock = async () => blocksOf((await call(couple, "1.3.0", "GET", "/couple/runsheet")).data!)[0] as { id: string; status: string; title: string };

await test("1.3.0 runsheet keeps today's keys (couple and planner)", async () => {
  for (const [tok, path] of [[couple, "/couple/runsheet"], [planner, "/planner/runsheet"]] as const) {
    const r = await call(tok, "1.3.0", "GET", path);
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.data!).sort(), OLD_KEYS, path);
    for (const b of blocksOf(r.data!)) assert.deepEqual(Object.keys(b).sort(), OLD_BLOCK, `${path} block`);
  }
});

if (!ON) {
  await test("off: every pack route answers 404 not_found (the app hides #30)", async () => {
    for (const [tok, path, v] of [
      [couple, "/couple/dayof/pack", "1.4.0"],
      [couple, "/couple/dayof/pack", "1.3.0"],
      [planner, `/planner/dayof/pack?slug=${SLUG}`, "1.4.0"],
      [guest, "/guest/pack", "1.4.0"],
    ] as const) {
      const r = await call(tok, v, "GET", path);
      assert.equal(r.status, 404, `${path} ${v}`);
      assert.equal(r.error?.code, "not_found", path);
    }
    record("pack-404-dark", await call(couple, "1.4.0", "GET", "/couple/dayof/pack"));
  });

  await test("off: the planner status route answers 404 not_found", async () => {
    const b = await firstBlock();
    const r = await call(planner, "1.4.0", "POST", `/planner/runsheet/${b.id}/status`, { status: b.status, client_event_id: randomUUID(), tapped_at: new Date().toISOString(), base_updated_at: null });
    assert.equal(r.status, 404);
    assert.equal(r.error?.code, "not_found");
    // The outbox reads this as "gone" (the moment was deleted). Planner taps
    // are only queued from a saved pack, which needs the flag on; noted in the
    // lane log as a portal follow-up (a reason code on the dark 404).
    assert.equal(classifyFailure("block_status", { status: r.status, code: String(r.error?.code) }), "gone");
  });
} else {
  let coupleEtag = "";
  let plannerMarks = false;
  await test("on: the couple pack parses with the app's parser; strong ETag; private no-cache", async () => {
    const r = await call(couple, "1.4.0", "GET", "/couple/dayof/pack");
    assert.equal(r.status, 200, JSON.stringify(r.error));
    record("couple-pack-200", r);
    const raw = r.data!;
    const p = parsePack(raw);
    assert.ok(p, "parsePack");
    const etag = r.headers.get("etag") ?? "";
    assert.equal(etag, `"${p!.meta.version}"`, "strong ETag of the content version (the app's fallback is the same)");
    assert.match(r.headers.get("cache-control") ?? "", /private/);
    assert.match(r.headers.get("cache-control") ?? "", /no-cache/);
    coupleEtag = etag;
    for (const k of ["version", "generated_at", "tz", "wedding_date", "valid_until", "server_now", "slug", "couple_names", "can_mark_status"]) assert.ok(k in (raw.meta as object), `meta.${k}`);
    assert.equal(typeof p!.meta.can_mark_status, "boolean");
    assert.ok(p!.meta.server_now && Number.isFinite(Date.parse(p!.meta.server_now)), "server_now is an instant");
    assert.equal(p!.meta.slug, SLUG);
    // Nothing the server sends is dropped by the parser.
    assert.equal(p!.runsheet.length, (raw.runsheet as unknown[]).length, "every moment parses");
    assert.equal(p!.places.length, (raw.places as unknown[]).length, "every place parses");
    assert.equal(p!.vendors.length, (raw.vendors as unknown[]).length, "every vendor parses");
    if (Array.isArray(raw.roster)) assert.equal(p!.roster?.length, raw.roster.length, "every party parses");
    for (const b of raw.runsheet as Record<string, unknown>[]) for (const k of ["id", "day", "starts_at", "status", "updated_at", "sort_order"]) assert.ok(k in b, `block.${k}`);
    for (const g of (raw.roster ?? []) as Record<string, unknown>[]) for (const k of ["id", "name", "members", "party_size", "table", "checked_in_at"]) assert.ok(k in g, `roster.${k}`);
  });

  await test("on: If-None-Match with that ETag answers 304 with no body", async () => {
    const r = await call(couple, "1.4.0", "GET", "/couple/dayof/pack", undefined, { "If-None-Match": coupleEtag });
    assert.equal(r.status, 304);
    assert.equal(r.text, "", "no body (api() skips it)");
    assert.equal(r.headers.get("etag"), coupleEtag);
    record("couple-pack-304", r);
  });

  await test("on: the planner pack (?slug=) is the bare pack and parses; a wedding not theirs is 404", async () => {
    const r = await call(planner, "1.4.0", "GET", `/planner/dayof/pack?slug=${SLUG}`);
    assert.equal(r.status, 200, JSON.stringify(r.error));
    record("planner-pack-200", r);
    assert.ok("meta" in r.data! && !("pack" in r.data!), "bare pack, no { pack } wrapper");
    const p = parsePack(r.data);
    assert.ok(p, "parsePack");
    assert.equal(p!.meta.slug, SLUG);
    plannerMarks = p!.meta.can_mark_status === true;
    const other = await call(planner, "1.4.0", "GET", "/planner/dayof/pack?slug=not-a-wedding-of-theirs");
    assert.equal(other.status, 404);
    assert.equal(other.error?.code, "not_found");
  });

  await test("on: the guest pack parses with parseGuestPack", async () => {
    const r = await call(guest, "1.4.0", "GET", "/guest/pack");
    assert.equal(r.status, 200, JSON.stringify(r.error));
    record("guest-pack-200", r);
    const p = parseGuestPack(r.data);
    assert.ok(p, "parseGuestPack");
    assert.equal(p!.schedule.length, ((r.data!.schedule ?? []) as unknown[]).length, "every schedule item parses");
    assert.ok(p!.pass_qr, "pass_qr");
  });

  await test("on: a status tap replayed with the same client_event_id is applied once; the pack moves on", async () => {
    const b = await firstBlock();
    const other = b.status === "done" ? "confirmed" : "done";
    const routes: [string, string][] = [[couple, `/couple/runsheet/${b.id}/status`]];
    if (plannerMarks) routes.push([planner, `/planner/runsheet/${b.id}/status`]);
    else {
      // can_mark_status false in the planner's pack (runsheet not at edit): the
      // app shows no Mark done, and a tap that got queued anyway is refused (403).
      const r = await call(planner, "1.4.0", "POST", `/planner/runsheet/${b.id}/status`, { status: b.status, client_event_id: randomUUID(), tapped_at: new Date().toISOString(), base_updated_at: null });
      assert.equal(r.status, 403, JSON.stringify(r.error));
      assert.equal(classifyFailure("block_status", { status: r.status, code: String(r.error?.code) }), "refused");
      console.log("     (planner runsheet not at edit locally: can_mark_status false, 403 checked)");
    }
    for (const [tok, path] of routes) {
      const id = randomUUID();
      assert.match(id, /^[A-Za-z0-9_-]{8,80}$/, "the app's newEventId fits the server's alphabet");
      const body = { status: other, client_event_id: id, tapped_at: new Date().toISOString(), base_updated_at: null };
      const a = await call(tok, "1.4.0", "POST", path, body);
      assert.equal(a.status, 200, `${path} ${JSON.stringify(a.error)}`);
      assert.equal(a.data!.replayed, false);
      const again = await call(tok, "1.4.0", "POST", path, body);
      assert.equal(again.status, 200);
      assert.equal(again.data!.replayed, true, "same id: the first outcome again");
      assert.equal((again.data!.block as { status: string }).status, other);
      // Put it back as found (a newer tap wins).
      await new Promise((r) => setTimeout(r, 20));
      const back = await call(tok, "1.4.0", "POST", path, { status: b.status, client_event_id: randomUUID(), tapped_at: new Date().toISOString(), base_updated_at: null });
      assert.equal(back.status, 200);
      assert.equal((back.data!.block as { status: string }).status, b.status);
    }
    const bad = await call(couple, "1.4.0", "POST", `/couple/runsheet/${b.id}/status`, { status: b.status, client_event_id: "short", tapped_at: new Date().toISOString() });
    assert.equal(bad.status, 400, "an id outside the alphabet is refused");
    const fresh = await call(couple, "1.4.0", "GET", "/couple/dayof/pack", undefined, { "If-None-Match": coupleEtag });
    assert.equal(fresh.status, 200, "after a status change the old ETag no longer matches");
    record("status-200", await call(couple, "1.4.0", "POST", `/couple/runsheet/${b.id}/status`, { status: b.status, client_event_id: randomUUID(), tapped_at: new Date().toISOString(), base_updated_at: null }));
  });

  await test("on: a deleted moment answers 404 'That moment was deleted.'; the outbox drops it as gone", async () => {
    const made = await call(couple, "1.4.0", "POST", "/couple/runsheet", { day: "2027-05-22", starts_at: "23:50", title: "Contract probe" });
    if (made.status === 423) return console.log("     (timeline locked: skipped, nothing to delete)");
    assert.equal(made.status, 200, JSON.stringify(made.error));
    const id = (made.data!.block as { id: string }).id;
    const d = await call(couple, "1.4.0", "DELETE", `/couple/runsheet/${id}`);
    assert.equal(d.status, 200);
    const r = await call(couple, "1.4.0", "POST", `/couple/runsheet/${id}/status`, { status: "done", client_event_id: randomUUID(), tapped_at: new Date().toISOString(), base_updated_at: null });
    record("status-404-gone", r);
    assert.equal(r.status, 404);
    assert.equal(r.error?.code, "not_found");
    assert.equal(r.error?.message_en, "That moment was deleted.");
    assert.equal(r.error?.message_es, "Ese momento fue eliminado.");
    assert.equal(classifyFailure("block_status", { status: r.status, code: String(r.error?.code) }), "gone");
  });

  if (F.MW_RUNSHEET_LOCK) {
    await test("on, locked: the couple's queued tap answers 423 runsheet_locked (dropped as locked); lock put back", async () => {
      const before = (await call(planner, "1.4.0", "GET", "/planner/runsheet")).data!.lock as { locked: boolean } | undefined;
      const wasLocked = !!before?.locked;
      if (!wasLocked) {
        const l = await call(planner, "1.4.0", "POST", "/planner/runsheet/lock", { locked: true, release: true });
        if (l.status === 403 && !plannerMarks) {
          // The planner cannot lock without the runsheet at edit, and a planner
          // who does not mark leaves the couple marking under a lock (D28), so
          // 423 is not reachable on this data.
          console.log("     (planner runsheet not at edit locally: cannot lock, couple would still mark; 423 not reachable)");
          return;
        }
        assert.equal(l.status, 200, JSON.stringify(l.error));
      }
      try {
        const c14 = (await call(couple, "1.4.0", "GET", "/couple/runsheet")).data!;
        const lock = c14.lock as { locked: boolean; can_mark: boolean };
        assert.equal(lock.locked, true);
        const b = await firstBlock();
        const r = await call(couple, "1.4.0", "POST", `/couple/runsheet/${b.id}/status`, { status: b.status, client_event_id: randomUUID(), tapped_at: new Date().toISOString(), base_updated_at: null });
        if (lock.can_mark) {
          assert.equal(r.status, 200, "the couple still marks (D28: the planner does not)");
        } else {
          record("status-423-locked", r);
          assert.equal(r.status, 423);
          assert.equal(r.error?.code, "runsheet_locked");
          assert.equal(classifyFailure("block_status", { status: r.status, code: String(r.error?.code) }), "locked");
        }
      } finally {
        if (!wasLocked) {
          const u = await call(planner, "1.4.0", "POST", "/planner/runsheet/lock", { locked: false });
          assert.equal(u.status, 200, JSON.stringify(u.error));
        }
      }
    });
  }
}

console.log(`day-pack-contract: ${passed} checks passed (MW_DAY_PACK ${ON ? "on" : "off"})`);

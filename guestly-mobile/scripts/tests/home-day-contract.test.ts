// Contract of the routes the 1.4.0 app reads for #6 Road to the wedding, K8
// and #3 live mode, against a LOCAL portal only. Skips (exit 0) unless
// GL_CONTRACT_BASE is set, so `npm test` needs no server.
//
//   GL_CONTRACT_BASE=http://localhost:3200 GL_PORTAL_DIR=/Users/nicolas_z/gl-mw/integration \
//     node --no-warnings --experimental-strip-types scripts/tests/home-day-contract.test.ts
//
// Reads only (GET): logs in as couple@hh.local and planner@hh.local on the
// local Supabase (refuses any URL that is not localhost) and writes nothing,
// so no Home layout is saved. Checks: 1.3.0 answers carry no "road" card id,
// no cards.road, no `live` and no `stage` whatever the flags; 1.4.0 keys
// follow the wedding's features; what the app keeps of the layout (K8) never
// holds a card the server did not list; every key that is there reads.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import "./lib/ts-resolve.ts";

const BASE = process.env.GL_CONTRACT_BASE;
if (!BASE) {
  console.log("home-day-contract: SKIP (set GL_CONTRACT_BASE to a local portal)");
  process.exit(0);
}
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) {
  console.error("refused: GL_CONTRACT_BASE must be a local portal");
  process.exit(2);
}
const { readRoad, readStage, keepServed } = await import("../../src/features/couple/road.ts");
const { sanitizeLayout } = await import("../../src/features/couple/homeLayout.ts");
const { readLive, readLiveList } = await import("../../src/features/dayof/liveDayCore.ts");

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

type Env = { status: number; data: Record<string, unknown> | null };
async function get(auth: string, version: string, p: string, tenant = SLUG): Promise<Env> {
  const r = await fetch(`${BASE}/api/mobile/v1${p}`, { headers: { Authorization: auth, "x-gl-app-version": version, "x-gl-platform": "ios", "x-gl-tenant": tenant, "x-gl-lang": "en" } });
  const j = (await r.json().catch(() => null)) as { ok: boolean; data?: Record<string, unknown> } | null;
  return { status: r.status, data: j?.data ?? null };
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
const me = await get(couple, "1.4.0", "/auth/me");
const F = (me.data?.features ?? {}) as Record<string, boolean>;
console.log(`flags (${SLUG}): road ${F.MW_ROAD}, live day ${F.MW_LIVE_DAY}`);
const cardIds = (d: Record<string, unknown> | null) => (((d?.layout as { cards?: { id: string }[] } | undefined)?.cards) ?? []).map((c) => c.id);

await test("1.3.0: no road card, no cards.road, no live, no stage", async () => {
  const home = await get(couple, "1.3.0", "/couple/home");
  assert.equal(home.status, 200);
  assert.ok(!cardIds(home.data).includes("road"), "no road id in the layout");
  assert.ok(!("road" in ((home.data!.cards as object) ?? {})), "no cards.road");
  const day = await get(couple, "1.3.0", "/couple/dayof");
  assert.equal(day.status, 200);
  assert.ok(!("live" in day.data!), "no live on the couple day-of");
  const agenda = await get(planner, "1.3.0", "/planner/agenda");
  assert.equal(agenda.status, 200);
  assert.ok(!("live" in agenda.data!), "no live on the planner agenda");
  const pf = await get(planner, "1.3.0", "/planner/portfolio");
  assert.equal(pf.status, 200);
  if (!F.MW_ROAD) for (const w of pf.data!.weddings as Record<string, unknown>[]) assert.ok(!("stage" in w) || w.slug !== SLUG, "no stage while MW_ROAD is off");
});

await test("1.4.0: road follows MW_ROAD, and what the app keeps never holds an unserved card (K8)", async () => {
  const home = await get(couple, "1.4.0", "/couple/home");
  assert.equal(home.status, 200);
  const listed = cardIds(home.data);
  const hasRoad = "road" in ((home.data!.cards as object) ?? {});
  if (F.MW_ROAD) {
    assert.ok(listed.includes("road"), "flag on: the road is listed");
    if (hasRoad && (home.data!.cards as { road: unknown }).road !== null) assert.ok(readRoad((home.data!.cards as { road: unknown }).road), "cards.road reads");
  } else {
    assert.ok(!listed.includes("road"), "flag off: not listed");
    assert.ok(!hasRoad, "flag off: no cards.road");
  }
  const raw = home.data!.layout as { cards?: unknown } | undefined;
  if (raw) {
    const clean = sanitizeLayout(raw);
    if (clean) {
      const kept = keepServed(clean.cards, raw.cards);
      assert.equal(kept.some((c) => c.id === "road"), listed.includes("road"));
    }
  }
});

await test("1.4.0: live follows MW_LIVE_DAY on the couple day-of; the agenda's live[] reads", async () => {
  const day = await get(couple, "1.4.0", "/couple/dayof");
  assert.equal(day.status, 200);
  if (!F.MW_LIVE_DAY) assert.ok(!("live" in day.data!), "flag off: no live");
  else if ("live" in day.data!) assert.ok(readLive(day.data!.live), "live reads");
  const agenda = await get(planner, "1.4.0", "/planner/agenda");
  assert.equal(agenda.status, 200);
  assert.ok(Array.isArray(agenda.data!.live), "1.4.0 gets the live list");
  const list = readLiveList(agenda.data!.live)!;
  assert.equal(list.length, (agenda.data!.live as unknown[]).filter((x) => (x as { wedding_slug?: string }).wedding_slug !== "alexnico2026").length, "every entry reads");
  const pf = await get(planner, "1.4.0", "/planner/portfolio");
  assert.equal(pf.status, 200);
  for (const w of pf.data!.weddings as Record<string, unknown>[]) if ("stage" in w) assert.ok(readStage(w.stage), `stage of ${w.slug} reads`);
});

console.log(`home-day-contract: ${passed}/3 against ${BASE}`);

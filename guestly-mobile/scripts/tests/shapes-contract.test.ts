// Contract of the #55 table shapes payload the app draws, against a LOCAL
// portal only. Skips (exit 0) unless GL_CONTRACT_BASE is set.
//
//   GL_CONTRACT_BASE=http://localhost:3295 GL_SHAPES_APP_VERSION=1.4.0 \
//     node --no-warnings --experimental-strip-types scripts/tests/shapes-contract.test.ts
//
// GL_SHAPES_APP_VERSION is the portal's SHAPES_APP_VERSION (default 1.5.0, the
// merged value; a scratch copy with 1.4.0 proves the 1.4.0 build's path).
// Reads only (GET) as couple@hh.local and planner@hh.local on the local
// Supabase; writes nothing. Checks: below the gate every table is round or
// rect with no new field (1.3 and, until the gate moves, 1.4); from the gate
// every table carries a known shape and shape_fallback = its legacy shape;
// every answer reads and lays out with the app's own code; the day pack's
// tables (when MW_DAY_PACK is on) carry shape and shape_fallback for any build.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import "./lib/ts-resolve.ts";

const BASE = process.env.GL_CONTRACT_BASE;
if (!BASE) {
  console.log("shapes-contract: SKIP (set GL_CONTRACT_BASE to a local portal)");
  process.exit(0);
}
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) {
  console.error("refused: GL_CONTRACT_BASE must be a local portal");
  process.exit(2);
}
const sv = await import("../../src/features/seating/shapeView.ts");
const geo = await import("../../src/features/seating/tableShapes.ts");
const { parsePack, packPlanTables } = await import("../../src/features/dayof/packCore.ts");

const PORTAL = process.env.GL_PORTAL_DIR ?? "/Users/nicolas_z/gl-mw/integration";
const GATE = process.env.GL_SHAPES_APP_VERSION ?? "1.5.0";
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
  return `Bearer ${j.access_token!}`;
}
async function get(auth: string, version: string, p: string): Promise<{ status: number; data: Record<string, unknown> | null }> {
  const r = await fetch(`${BASE}/api/mobile/v1${p}`, { headers: { Authorization: auth, "x-gl-app-version": version, "x-gl-platform": "ios", "x-gl-tenant": SLUG, "x-gl-lang": "es" } });
  const j = (await r.json().catch(() => null)) as { data?: Record<string, unknown> } | null;
  return { status: r.status, data: j?.data ?? null };
}
const atLeast = (a: string, b: string) => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return true;
};

let checks = 0;
const couple = await login("couple@hh.local");
const planner = await login("planner@hh.local");
for (const [who, auth, path] of [["couple", couple, "/couple/seating"], ["planner", planner, "/planner/seating"]] as const) {
  for (const version of ["1.3.0", "1.4.0", "1.5.0"]) {
    const r = await get(auth, version, path);
    if (r.status === 403 || r.status === 404) {
      console.log(`  ${who} ${version} ${path}: ${r.status} (no seating view), skipped`);
      continue;
    }
    assert.equal(r.status, 200, `${who} ${version} ${path}`);
    const tables = (r.data?.tables ?? []) as Record<string, unknown>[];
    const modern = atLeast(version, GATE);
    for (const t of tables) {
      if (modern) {
        assert.ok(geo.isTableShape(t.shape), `${version}: known shape ${String(t.shape)}`);
        assert.equal(t.shape_fallback, geo.legacyShape(t.shape as string), `${version}: shape_fallback`);
      } else {
        assert.ok(t.shape === "round" || t.shape === "rect", `${version}: round or rect only`);
        for (const k of ["shape_fallback", "rotation", "ends", "one_side", "segments"]) assert.equal(k in t, false, `${version}: no ${k}`);
      }
      assert.equal(sv.readShape(t).known, true);
    }
    const laid = sv.planLayout(tables.map((t) => ({ ...t, id: String(t.id), label: String(t.label), capacity: Number(t.capacity) })), 350, 262);
    for (const p of laid) assert.ok(p.left >= -0.01 && p.left + p.art.w <= 350.01 && p.top + p.art.h <= 262.01);
    console.log(`  ${who} ${version} ${path}: ${tables.length} tables, ${modern ? "every shape + shape_fallback" : "round/rect only"}, laid out`);
    checks++;
  }
}
const pack = await get(couple, "1.4.0", "/couple/dayof/pack");
if (pack.status === 200) {
  const p = parsePack((pack.data as { pack?: unknown })?.pack ?? pack.data);
  assert.ok(p, "the pack parses");
  for (const t of p!.seating?.tables ?? []) {
    assert.ok(typeof t.shape === "string" && (t.shape_fallback === "round" || t.shape_fallback === "rect"), "pack tables carry shape and shape_fallback for every build");
  }
  console.log(`  couple 1.4.0 day pack: ${packPlanTables(p!.seating).length} tables drawn`);
  checks++;
} else {
  console.log(`  couple day pack: ${pack.status} (MW_DAY_PACK off), skipped`);
}
console.log(`shapes-contract: ${checks} checks passed (gate ${GATE}, ${BASE})`);

// Run: node --experimental-strip-types scripts/tests/token-parity.test.ts
// Token parity (K17, Master Wave L8, Nov 5 2026; STUDY-quality-bar 10.4 item 7).
// src/ui/tokens.ts says its colours are the portal's globals.css verbatim; two had
// drifted (goldDim and muted). Every colour in PORTAL_TOKENS must equal the
// portal's value. The portal checkout is read from GL_PORTAL_DIR (default the
// Master Wave integration worktree); when it is not there the test warns and skips,
// so a machine without the portal still runs the rest of `npm test`.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// tokens.ts imports react-native for Platform; this test only needs the colour
// tables, so it reads them from the file without loading React Native.
const tokensSrc = readFileSync(new URL("../../src/ui/tokens.ts", import.meta.url), "utf8");

function objectBody(src: string, name: string): string {
  const start = src.indexOf(`export const ${name} = {`);
  assert.ok(start >= 0, `tokens.ts exports ${name}`);
  const end = src.indexOf("\n}", start);
  return src.slice(start, end);
}
function pairs(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/^\s*([A-Za-z0-9]+):\s*"([^"]+)",/gm)) out[m[1]] = m[2];
  return out;
}

const colors = pairs(objectBody(tokensSrc, "colors"));
const portalNames = pairs(objectBody(tokensSrc, "PORTAL_TOKENS"));

// The map covers the brand colours and names real app tokens.
for (const key of ["night", "navy", "ivory", "cream", "gold", "goldLight", "goldDim", "ink", "muted", "border"]) {
  assert.ok(portalNames[key], `PORTAL_TOKENS maps ${key}`);
}
for (const key of Object.keys(portalNames)) assert.ok(colors[key], `colors.${key} exists`);

// The K17 values, pinned even when the portal checkout is absent.
assert.equal(colors.goldDim, "#7f6337", "goldDim is the portal's gold-text");
assert.equal(colors.muted, "#6a6253", "muted is the portal's muted");

const portalDir = process.env.GL_PORTAL_DIR || "/Users/nicolas_z/gl-mw/integration";
const css = path.join(portalDir, "src", "app", "globals.css");
if (!existsSync(css)) {
  console.warn(`token-parity: SKIPPED the portal comparison, ${css} not found (set GL_PORTAL_DIR to a portal checkout)`);
} else {
  const portal: Record<string, string> = {};
  // The first declaration wins: the @theme block, before any scoped override.
  for (const m of readFileSync(css, "utf8").matchAll(/(--color-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    if (!(m[1] in portal)) portal[m[1]] = m[2].toLowerCase();
  }
  const drift: string[] = [];
  for (const [key, cssVar] of Object.entries(portalNames)) {
    const want = portal[cssVar];
    assert.ok(want, `${cssVar} exists in ${css}`);
    if (colors[key].toLowerCase() !== want) drift.push(`colors.${key} ${colors[key]} vs ${cssVar} ${want}`);
  }
  assert.deepEqual(drift, [], `app tokens drifted from the portal:\n  ${drift.join("\n  ")}`);
  console.log(`token-parity: ${Object.keys(portalNames).length} shared colours equal ${css}`);
}

console.log("token-parity: all checks passed");

#!/usr/bin/env node
// Verbatim copies between the iOS app and the portal (Master Wave, Lane 8; the
// portal carries the same script, Lane 0 gate 4).
//
// Four pure modules live in both repos and must stay byte for byte equal, so
// the web, the app and the app offline compute the same answer:
//
//   portal src/lib/runsheet-live.ts     = app src/features/dayof/live.ts        (#3 Now engine, #30 offline)
//   portal src/lib/home-layout-core.ts  = app src/features/couple/homeLayout.ts (customizable Home, K8)
//   portal src/lib/milestones.ts        = app src/features/couple/milestones.ts (#6 milestone line)
//   portal src/lib/table-shapes.ts      = app src/features/seating/tableShapes.ts (#55 table shapes)
//
// The portal file is the reviewed source: change it there, then copy it here.
// A one-character difference fails (exit 1) and prints the first differing line.
// Paths: GL_APP_DIR (default: this app, the folder above scripts/) and
// GL_PORTAL_DIR (default /Users/nicolas_z/gl-mw/integration, the reviewed and
// merged portal; the same default as scripts/tests/token-parity.test.ts, a test
// keeps the two equal). When the portal folder is missing (a
// machine or CI without a portal checkout) every pair is skipped with a
// warning; when one side of a pair is missing (a module not written yet) that
// pair is skipped with a warning. Skips exit 0. `npm test` runs this first.
//
//   node scripts/check-verbatim-copies.mjs
//   GL_PORTAL_DIR="/path/to/guestly-portal" node scripts/check-verbatim-copies.mjs

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PAIRS = [
  { portal: "src/lib/runsheet-live.ts", app: "src/features/dayof/live.ts" },
  { portal: "src/lib/home-layout-core.ts", app: "src/features/couple/homeLayout.ts" },
  { portal: "src/lib/milestones.ts", app: "src/features/couple/milestones.ts" },
  { portal: "src/lib/table-shapes.ts", app: "src/features/seating/tableShapes.ts" },
];

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(process.env.GL_APP_DIR || path.join(here, ".."));
const portalDir = path.resolve(process.env.GL_PORTAL_DIR || "/Users/nicolas_z/gl-mw/integration");

const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const isFile = (p) => existsSync(p) && statSync(p).isFile();

/** First difference between two buffers as { line, column, a, b } (1-based), or null when equal. */
function firstDifference(a, b) {
  if (a.equals(b)) return null;
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  const before = a.subarray(0, i).toString("utf8");
  const line = before.split("\n").length;
  const column = i - (before.lastIndexOf("\n") + 1) + 1;
  const lineOf = (buf) => (buf.toString("utf8").split("\n")[line - 1] ?? "(end of file)");
  return { line, column, a: lineOf(a), b: lineOf(b) };
}

const clip = (s) => (s.length > 160 ? `${s.slice(0, 157)}...` : s);

let failed = 0;
let compared = 0;
let skipped = 0;

console.log(`portal: ${portalDir}`);
console.log(`app:    ${appDir}`);

if (!isDir(portalDir)) {
  console.warn(`WARN  portal checkout not found, ${PAIRS.length} pair(s) skipped (set GL_PORTAL_DIR to check them)`);
  console.log("\nverbatim copies: 0 compared, all skipped");
  process.exit(0);
}

for (const pair of PAIRS) {
  const p = path.join(portalDir, pair.portal);
  const a = path.join(appDir, pair.app);
  const label = `${pair.portal} = app ${pair.app}`;
  if (!isFile(p) || !isFile(a)) {
    const missing = [!isFile(p) ? `portal ${pair.portal}` : null, !isFile(a) ? `app ${pair.app}` : null].filter(Boolean).join(" and ");
    console.warn(`SKIP  ${label} (missing: ${missing})`);
    skipped++;
    continue;
  }
  compared++;
  const diff = firstDifference(readFileSync(p), readFileSync(a));
  if (!diff) {
    console.log(`OK    ${label}`);
    continue;
  }
  failed++;
  console.log(`FAIL  ${label}: first difference at line ${diff.line}, column ${diff.column}`);
  console.log(`        portal: ${clip(diff.a)}`);
  console.log(`        app:    ${clip(diff.b)}`);
}

console.log(`\nverbatim copies: ${compared} compared, ${failed} different, ${skipped} skipped`);
if (failed) {
  console.log("Copy the portal file over the app file (or the other way, whichever holds the reviewed change) so both are identical.");
  process.exit(1);
}

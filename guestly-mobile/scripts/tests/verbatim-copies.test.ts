// Run: node --experimental-strip-types scripts/tests/verbatim-copies.test.ts
// scripts/check-verbatim-copies.mjs on fixture folders (temp dirs, no repo file
// is read or written): identical pairs pass, a one-character difference fails
// with its line, a missing side or a missing portal checkout skips with a
// warning and exits 0. The portal's scripts/test-check-verbatim-copies.mjs
// cases, with the roles of the two repos swapped (Master Wave L8).

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const checker = fileURLToPath(new URL("../check-verbatim-copies.mjs", import.meta.url));

const PAIRS = [
  ["src/lib/runsheet-live.ts", "src/features/dayof/live.ts"],
  ["src/lib/home-layout-core.ts", "src/features/couple/homeLayout.ts"],
  ["src/lib/milestones.ts", "src/features/couple/milestones.ts"],
];

const tmp = mkdtempSync(path.join(os.tmpdir(), "gl verbatim app "));
const write = (root: string, rel: string, text: string) => {
  const p = path.join(root, rel);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, text);
};
const run = (env: Record<string, string>) =>
  spawnSync(process.execPath, [checker], { env: { ...process.env, ...env }, encoding: "utf8" });
const okCount = (out: string) => (out.match(/^OK /gm) ?? []).length;

try {
  const body = "export const A = 1;\nexport function f(x: number): number {\n  return x + 1;\n}\n";

  // 1. All three pairs identical (paths with spaces on purpose).
  const portal = path.join(tmp, "portal dir");
  const app = path.join(tmp, "app dir");
  for (const [p, a] of PAIRS) {
    write(portal, p, body);
    write(app, a, body);
  }
  let r = run({ GL_PORTAL_DIR: portal, GL_APP_DIR: app });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(okCount(r.stdout), 3, r.stdout);

  // 2. One character differs in one pair: exit 1, first differing line and column.
  write(app, PAIRS[0][1], body.replace("x + 1", "x + 2"));
  r = run({ GL_PORTAL_DIR: portal, GL_APP_DIR: app });
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /line 3, column 14/);
  assert.match(r.stdout, /portal:\s+return x \+ 1;/);
  assert.match(r.stdout, /app:\s+return x \+ 2;/);
  write(app, PAIRS[0][1], body);

  // 3. A missing final newline and CRLF line endings are differences too.
  write(app, PAIRS[1][1], body.trimEnd());
  assert.equal(run({ GL_PORTAL_DIR: portal, GL_APP_DIR: app }).status, 1);
  write(app, PAIRS[1][1], body.replace(/\n/g, "\r\n"));
  assert.equal(run({ GL_PORTAL_DIR: portal, GL_APP_DIR: app }).status, 1);
  write(app, PAIRS[1][1], body);

  // 4. One side of a pair missing (a module not written yet): that pair skipped, exit 0.
  rmSync(path.join(app, PAIRS[2][1]));
  r = run({ GL_PORTAL_DIR: portal, GL_APP_DIR: app });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stderr + r.stdout, /SKIP\s+src\/lib\/milestones\.ts .*missing: app src\/features\/couple\/milestones\.ts/);
  assert.equal(okCount(r.stdout), 2, r.stdout);
  write(app, PAIRS[2][1], body);
  rmSync(path.join(portal, PAIRS[2][0]));
  r = run({ GL_PORTAL_DIR: portal, GL_APP_DIR: app });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stderr + r.stdout, /missing: portal src\/lib\/milestones\.ts/);

  // 5. No portal checkout at all: every pair skipped with a warning, exit 0.
  r = run({ GL_PORTAL_DIR: path.join(tmp, "nowhere"), GL_APP_DIR: app });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stderr + r.stdout, /portal checkout not found, 3 pair\(s\) skipped/);
  assert.equal(okCount(r.stdout), 0);

  // 6. Defaults: the app is the folder above scripts/ (this app), never another checkout.
  r = run({ GL_PORTAL_DIR: path.join(tmp, "nowhere"), GL_APP_DIR: "" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const appLine = /^app:\s+(.+)$/m.exec(r.stdout);
  assert.ok(appLine, r.stdout);
  assert.equal(appLine[1], path.resolve(fileURLToPath(new URL("../..", import.meta.url))));

  // 7. Default portal: the integration worktree, the same one token-parity reads.
  // A drift check against a lane worktree would compare with unmerged work.
  const env = { ...process.env, GL_APP_DIR: app };
  delete env.GL_PORTAL_DIR;
  r = spawnSync(process.execPath, [checker], { env, encoding: "utf8" });
  const portalLine = /^portal:\s+(.+)$/m.exec(r.stdout);
  assert.ok(portalLine, r.stdout);
  const paritySrc = readFileSync(fileURLToPath(new URL("./token-parity.test.ts", import.meta.url)), "utf8");
  const parityDefault = /process\.env\.GL_PORTAL_DIR \|\| "([^"]+)"/.exec(paritySrc);
  assert.ok(parityDefault, "token-parity.test.ts has a GL_PORTAL_DIR default");
  assert.equal(portalLine[1], path.resolve(parityDefault[1]), "verbatim check and token parity use the same portal");
  assert.equal(portalLine[1], "/Users/nicolas_z/gl-mw/integration");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log("verbatim-copies: checker fixtures passed");

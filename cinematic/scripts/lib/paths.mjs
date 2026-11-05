/* Paths for the landing's scripts, resolved from this file, never from a
   hard-coded home folder. The Desktop moved on Nov 4 2026 (everything now
   sits under "Desktop - Unknown"), which broke every script that spelled
   out a home folder path; use these helpers instead.

   fileURLToPath (not new URL().pathname) so a folder with a space in its
   name resolves to a real path, not "%20". */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/* cinematic/ and the guest-ly repo root. */
export const CINEMATIC = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REPO_ROOT = resolve(CINEMATIC, '..');

const DESKTOP = join(homedir(), 'Desktop');
const MOVED = join(DESKTOP, 'Desktop - Unknown');

/* JS twin of desk_path in ~/deploy/lib.sh: given a path under the Desktop,
   return it if it exists, else the same path on the other side of the move
   (Desktop/x <-> Desktop/Desktop - Unknown/x) if that exists, else the
   input unchanged. */
export function deskPath(p) {
  const abs = resolve(p);
  if (existsSync(abs)) return abs;
  let alt = '';
  if (abs.startsWith(MOVED + sep)) alt = join(DESKTOP, abs.slice(MOVED.length + 1));
  else if (abs.startsWith(DESKTOP + sep)) alt = join(MOVED, abs.slice(DESKTOP.length + 1));
  return alt && existsSync(alt) ? alt : abs;
}

/* A portal checkout to borrow tools from (playwright, sharp) or drive for
   screenshots: GL_PORTAL_DIR when set, else the first existing default.
   Returns null when none exists; callers say what to set. */
export function findPortal(candidates = ['guest-ly/guestly-portal', 'guest-ly/guestly-portal-deploy']) {
  const list = process.env.GL_PORTAL_DIR ? [process.env.GL_PORTAL_DIR] : candidates.map((c) => join(MOVED, c));
  for (const c of list) {
    const p = deskPath(c);
    if (existsSync(join(p, 'package.json'))) return p;
  }
  return null;
}

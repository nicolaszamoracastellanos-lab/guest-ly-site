/* #24 Post-build check for the live app screens (runs inside `npm run build`).
   Fails when src/live-screens.data.ts is malformed (manifestProblems), names
   a pane the tour does not have, or when dist/screens is not exactly the
   files the manifest implies (a missing image would show a broken box; a
   stale one would ship dead weight). With an empty manifest, dist/screens
   must not exist. Usage: node scripts/check-live-screens.mjs [distDir] */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copy } from '../src/copy.ts';
import { LIVE_SCREENS } from '../src/live-screens.data.ts';
import { manifestFiles, manifestProblems } from '../src/ui/live-screens.ts';
import { CINEMATIC } from './lib/paths.mjs';

export function liveScreensDistProblems(manifest, dist, paneIds) {
  const problems = manifestProblems(manifest, paneIds);
  const dir = join(dist, 'screens');
  const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
  const shipped = existsSync(dir) ? walk(dir).map((f) => f.slice(dist.length).split('\\').join('/')).filter((f) => !f.endsWith('/.DS_Store')) : [];
  const wanted = manifestFiles(manifest);
  for (const f of wanted) if (!shipped.includes(f)) problems.push(`${f} is in the manifest but not in dist`);
  for (const f of shipped) if (!wanted.includes(f)) problems.push(`dist${f} is not in the manifest (stale or stray)`);
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] || join(CINEMATIC, 'dist'));
  const problems = liveScreensDistProblems(LIVE_SCREENS, dist, copy.en.platform.items.map((i) => i.id));
  if (problems.length) {
    for (const p of problems) console.error(`check-live-screens: ${p}`);
    process.exit(1);
  }
  const n = Object.keys(LIVE_SCREENS.screens).length;
  console.log(
    n
      ? `check-live-screens clean: version ${LIVE_SCREENS.version}, ${n} panes, ${manifestFiles(LIVE_SCREENS).length} images`
      : 'check-live-screens clean: no live screens yet, every tour pane keeps its placeholder',
  );
}

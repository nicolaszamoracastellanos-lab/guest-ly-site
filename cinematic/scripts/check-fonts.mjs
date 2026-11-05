/* Post-build check for the self-hosted fonts (decision D4; runs inside
   `npm run build`, after prerender). Fails the build when:
   - any built file (HTML, CSS, JS) names a Google Fonts host, or any
     @font-face loads from another origin;
   - an @font-face url has no file in dist/fonts;
   - a woff2 in public/fonts is used by no @font-face (dead weight);
   - a family's license file (OFL-*.txt) is missing;
   - a page preloads anything but exactly one font, or the preload points
     at a file no @font-face uses or without crossorigin (a double download).
   Usage: node scripts/check-fonts.mjs [distDir]   (default: cinematic/dist) */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CINEMATIC } from './lib/paths.mjs';

const dist = resolve(process.argv[2] || join(CINEMATIC, 'dist'));
const errors = [];
const fail = (msg) => errors.push(msg);

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
const built = walk(dist).filter((f) => /\.(html|css|js)$/.test(f));
const rel = (f) => f.slice(dist.length + 1);

/* 1. No Google font host anywhere in what we ship. */
for (const f of built) {
  const text = readFileSync(f, 'utf8');
  for (const host of ['fonts.googleapis.com', 'fonts.gstatic.com']) if (text.includes(host)) fail(`${rel(f)} names ${host}`);
}

/* 2. Every @font-face src resolves to a file in dist/fonts. */
const css = built.filter((f) => f.endsWith('.css')).map((f) => readFileSync(f, 'utf8')).join('\n');
const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1]);
if (faces.length === 0) fail('no @font-face in the built CSS');
const used = new Set();
for (const face of faces) {
  for (const [, url] of face.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    if (!url.startsWith('/fonts/')) {
      fail(`@font-face loads ${url}; fonts are served from /fonts/ only`);
      continue;
    }
    used.add(url.slice('/fonts/'.length));
    if (!existsSync(join(dist, url))) fail(`@font-face url ${url} has no file in dist${url}`);
  }
  if (/url\(/.test(face) && !/font-display\s*:\s*swap/.test(face)) fail(`an @font-face without font-display: swap (${face.match(/url\(([^)]*)/)[1]})`);
}

/* 3. Every shipped woff2 is used, and each family carries its license. */
const fontsDir = join(CINEMATIC, 'public', 'fonts');
const shipped = existsSync(fontsDir) ? readdirSync(fontsDir) : [];
for (const f of shipped.filter((f) => f.endsWith('.woff2'))) if (!used.has(f)) fail(`public/fonts/${f} is used by no @font-face`);
const LICENSES = { 'playfair-display': 'OFL-PlayfairDisplay.txt', 'eb-garamond': 'OFL-EBGaramond.txt', inter: 'OFL-Inter.txt' };
for (const f of used) {
  const family = Object.keys(LICENSES).find((k) => f.startsWith(`${k}-`));
  if (!family) fail(`fonts/${f}: unknown family, add its license to check-fonts.mjs`);
  else if (!shipped.includes(LICENSES[family])) fail(`fonts/${f}: license ${LICENSES[family]} missing from public/fonts`);
}

/* 4. One font preload per page, on a face in use, fetched in CORS mode
   like the @font-face request (or the browser downloads it twice). */
for (const f of built.filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(f, 'utf8');
  const preloads = [...html.matchAll(/<link\b[^>]*rel="preload"[^>]*>/g)].map((m) => m[0]).filter((l) => /as="font"/.test(l));
  if (preloads.length !== 1) fail(`${rel(f)}: ${preloads.length} font preloads, want exactly 1 (the LCP face)`);
  for (const l of preloads) {
    const href = l.match(/href="([^"]+)"/)?.[1] ?? '';
    if (!href.startsWith('/fonts/') || !used.has(href.slice('/fonts/'.length))) fail(`${rel(f)}: preload ${href} is not a face in use`);
    if (!/\bcrossorigin\b/.test(l)) fail(`${rel(f)}: font preload without crossorigin`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(`check-fonts: ${e}`);
  process.exit(1);
}
console.log(`check-fonts clean: ${used.size} self-hosted files in ${faces.length} @font-face rules, licenses present, no Google host, one font preload per page`);

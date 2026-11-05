/* #24 Live app screens test. Never touches a real portal, production or
   cinematic/public: the pipeline shoots a fixture app on localhost into a
   temp folder, and the page is built with those fixture shots into another
   temp folder (GL_LIVE_SCREENS_MODULE).

   A. Pure: the committed manifest is valid and matches cinematic/public
      (today: empty, no public/screens, every pane keeps its placeholder);
      resolveScreen (srcset, width/height, null keeps the placeholder);
      manifestProblems; the production refusal; the scrubber; the --out
      guard; the truth gate on a fixture and on the real features.json;
      the release gate on temp git repos; check-live-screens on a dist.
   B. Pipeline on a fixture app (login form, 8 routes, a demo banner):
      held pane skipped, 7 panes x EN/ES x desktop/phone x 2 widths of WebP
      at the declared sizes and under budget; manifest module valid; a
      planted token=abc fails the run and writes nothing; production base,
      --out inside public, --publish of an unreleased checkout and an
      all-held run are refused.
   C. The page built with the fixture shots, 1440 and 390: no /screens/
      request before the tour nears the screen; then exactly one image for
      the active pane, the right form and language; width, height, lazy,
      decoding async; no layout shift inside the tour; the demo banner is
      not in the image; ES swaps the image without a reload; a held pane
      shows the placeholder; no console error.
   Usage: node scripts/test-live-screens.mjs */

import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { copy } from '../src/copy.ts';
import { LIVE_SCREENS } from '../src/live-screens.data.ts';
import { manifestFiles, manifestProblems, resolveScreen } from '../src/ui/live-screens.ts';
import { liveScreensDistProblems } from './check-live-screens.mjs';
import {
  LiveScreensError,
  MAX_BYTES,
  SCREENS,
  baseProblems,
  outProblems,
  releaseProblems,
  run,
  scrubProblems,
  truthGate,
  versionFor,
} from './live-screens.mjs';
import { findFeaturesJson } from './llms.mjs';
import { CINEMATIC } from './lib/paths.mjs';

const errors = [];
const check = (ok, msg) => {
  if (!ok) errors.push(msg);
};
const throwsLike = async (fn, re, msg) => {
  try {
    await fn();
    errors.push(`${msg}: did not throw`);
  } catch (e) {
    if (!(e instanceof LiveScreensError) || !re.test(e.message)) errors.push(`${msg}: threw ${e.message.split('\n')[0]}`);
  }
};
const tmp = mkdtempSync(join(tmpdir(), 'gl-live-screens-'));
const paneIds = copy.en.platform.items.map((i) => i.id);

/* ---------- A. pure ---------- */

check(manifestProblems(LIVE_SCREENS, paneIds).length === 0, `committed manifest: ${manifestProblems(LIVE_SCREENS, paneIds).join('; ')}`);
const publicScreens = join(CINEMATIC, 'public', 'screens');
if (!LIVE_SCREENS.version) {
  check(!existsSync(publicScreens), 'manifest is empty but cinematic/public/screens exists');
  check(paneIds.every((id) => resolveScreen(LIVE_SCREENS, id, 'en') === null), 'empty manifest must keep every placeholder');
} else {
  for (const f of manifestFiles(LIVE_SCREENS)) check(existsSync(join(CINEMATIC, 'public', f)), `manifest names ${f}, missing in public`);
}
check(
  JSON.stringify([...SCREENS.map((s) => s.id)].sort()) === JSON.stringify([...paneIds].sort()),
  `SCREENS (${SCREENS.map((s) => s.id)}) must cover exactly the tour panes (${paneIds})`,
);

const fixtureManifest = {
  version: '20261120-abcdef12',
  widths: { desktop: [440, 880], phone: [260, 520] },
  screens: {
    seating: { en: { desktop: [880, 597], phone: [520, 853] }, es: { desktop: [880, 597], phone: [520, 853] } },
  },
};
check(manifestProblems(fixtureManifest, paneIds).length === 0, `fixture manifest: ${manifestProblems(fixtureManifest, paneIds)}`);
const r = resolveScreen(fixtureManifest, 'seating', 'es');
check(
  r?.desktop.srcSet === '/screens/20261120-abcdef12/seating.es.desktop.440.webp 440w, /screens/20261120-abcdef12/seating.es.desktop.880.webp 880w',
  `desktop srcset: ${r?.desktop.srcSet}`,
);
check(r?.phone.src === '/screens/20261120-abcdef12/seating.es.phone.260.webp' && r.phone.width === 260 && r.phone.height === 427, 'phone src and size');
check(r?.desktop.width === 440 && r?.desktop.height === 299, `desktop size ${r?.desktop.width}x${r?.desktop.height}`);
check(resolveScreen(fixtureManifest, 'budget', 'en') === null, 'a pane without shots keeps its placeholder');
check(resolveScreen({ ...fixtureManifest, version: '' }, 'seating', 'en') === null, 'no version keeps every placeholder');
check(manifestFiles(fixtureManifest).length === 8, 'manifestFiles: 2 langs x 2 forms x 2 widths');

const bad = (patch, re, label) => {
  const p = manifestProblems({ ...fixtureManifest, ...patch }, paneIds);
  check(p.some((x) => re.test(x)), `manifestProblems misses ${label}: ${p}`);
};
bad({ version: 'latest' }, /not YYYYMMDD/, 'a bad version');
bad({ screens: { ...fixtureManifest.screens, pricing: fixtureManifest.screens.seating } }, /not a tour pane/, 'an unknown pane');
bad({ screens: { seating: { en: fixtureManifest.screens.seating.en, es: { desktop: [880, 597] } } } }, /no es phone size/, 'a missing size');
bad({ screens: { seating: { ...fixtureManifest.screens.seating, en: { desktop: [440, 299], phone: [520, 853] } } } }, /not the largest width/, 'a size off the widths');
bad({ widths: { desktop: [880, 440], phone: [260, 520] } }, /ascending/, 'descending widths');
bad({ version: '' }, /version is empty/, 'screens without a version');

for (const base of ['https://app.guest-ly.com', 'https://guest-ly.com', 'http://demo.guest-ly.com', 'https://deploy-preview-12--guestly.netlify.app', 'ftp://localhost', 'nope'])
  check(baseProblems(base).length === 1, `base ${base} must be refused`);
for (const base of ['http://localhost:3000', 'http://127.0.0.1:3101', 'http://192.168.1.20:3000']) check(baseProblems(base).length === 0, `base ${base} must be allowed`);

for (const [text, re] of [
  ['Open https://x.test/r?token=abc', /token=/],
  ['Server at localhost:54321', /local address/],
  ['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U', /JWT/],
  ['Contact maria.real@gmail.com', /outside the demo domains/],
  ['supabase storage', /supabase/],
  ['TypeError: x\n    at render (/app/src/page.tsx:12:5)', /stack trace/],
])
  check(scrubProblems(text).some((p) => re.test(p)), `scrubber misses: ${text.slice(0, 40)}`);
check(scrubProblems('Ana y Luis, ana@hh.local, mesa 7, error en la lista de invitados at 4:30 pm').length === 0, 'scrubber flags a clean screen');
check(scrubProblems('x@demo.example', { demoDomains: ['demo.example'] }).length === 0, 'scrubber: --demo-domains allows that domain');

for (const sub of ['public', 'public/screens', 'src', 'dist']) check(outProblems(join(CINEMATIC, sub)).length === 1, `--out ${sub} must be refused`);
check(outProblems(join(tmp, 'trial')).length === 0, '--out in a temp folder is allowed');
check(versionFor(new Date('2026-11-20T15:00:00Z'), 'abcdef1234567890') === '20261120-abcdef12', 'versionFor');

const feature = (id, status = 'live', marketing = 'ok', rollout) => ({ id, status, marketing, ...(rollout ? { rollout } : {}) });
const fixtureFacts = {
  features: [...new Set(SCREENS.flatMap((s) => s.features))].map((id) => (id === 'F36' ? feature(id, 'live', 'hold') : feature(id))),
};
{
  const g = truthGate(fixtureFacts);
  check(g.shoot.length === 7 && Object.keys(g.held).join() === 'broadcasts', `truth gate fixture: shoot ${g.shoot.length}, held ${Object.keys(g.held)}`);
  const rolled = { features: fixtureFacts.features.map((f) => (f.id === 'F28' ? feature('F28', 'live', 'ok', { mode: 'allowlist' }) : f)) };
  check('seating' in truthGate(rolled).held, 'truth gate must hold a feature with a rollout limit');
  const building = { features: fixtureFacts.features.map((f) => (f.id === 'F27' ? feature('F27', 'building') : f)) };
  check('budget' in truthGate(building).held, 'truth gate must hold a building feature');
  await throwsLike(() => truthGate({ features: fixtureFacts.features.filter((f) => f.id !== 'F20') }), /F20 is not in features.json/, 'truth gate unknown id');
}
let realFacts = null;
try {
  realFacts = JSON.parse(readFileSync(findFeaturesJson().file, 'utf8'));
} catch {
  console.log('test-live-screens: no portal checkout found (GL_PORTAL_DIR), real truth gate skipped');
}
if (realFacts) {
  const g = truthGate(realFacts);
  console.log(`test-live-screens: real features.json: would shoot ${g.shoot.map((s) => s.id).join(', ')}; held ${JSON.stringify(g.held)}`);
}

/* Release gate on temp repos: origin (bare), deploy (clone), portal (clone). */
{
  const g = (cwd, ...a) => execFileSync('git', a, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();
  const root = join(tmp, 'git');
  mkdirSync(join(root, 'seed'), { recursive: true });
  g(join(root, 'seed'), 'init', '-q', '-b', 'main');
  writeFileSync(join(root, 'seed', 'a.txt'), 'one\n');
  g(join(root, 'seed'), 'add', '.');
  g(join(root, 'seed'), '-c', 'user.email=t@hh.local', '-c', 'user.name=t', 'commit', '-q', '-m', 'one');
  g(root, 'clone', '-q', '--bare', 'seed', 'origin.git');
  g(root, 'clone', '-q', 'origin.git', 'deploy');
  g(root, 'clone', '-q', 'origin.git', 'portal');
  const portal = join(root, 'portal');
  const deploy = join(root, 'deploy');
  check(releaseProblems(portal, deploy).length === 0, `release gate, released HEAD: ${releaseProblems(portal, deploy)}`);
  writeFileSync(join(portal, 'a.txt'), 'dirty\n');
  check(releaseProblems(portal, deploy).some((p) => /uncommitted/.test(p)), 'release gate must refuse a dirty checkout');
  g(portal, '-c', 'user.email=t@hh.local', '-c', 'user.name=t', 'commit', '-q', '-am', 'local only');
  check(releaseProblems(portal, deploy).some((p) => /not released/.test(p)), 'release gate must refuse a commit not on origin/main');
  check(releaseProblems(join(root, 'seed', 'nope'), deploy).length === 1, 'release gate must refuse a non-git folder');
}

/* check-live-screens on a fixture dist. */
{
  const dist = join(tmp, 'dist-check');
  for (const f of manifestFiles(fixtureManifest)) {
    mkdirSync(join(dist, f, '..'), { recursive: true });
    writeFileSync(join(dist, f), 'x');
  }
  check(liveScreensDistProblems(fixtureManifest, dist, paneIds).length === 0, 'check-live-screens: complete dist');
  rmSync(join(dist, 'screens', fixtureManifest.version, 'seating.es.phone.520.webp'));
  writeFileSync(join(dist, 'screens', 'old.webp'), 'x');
  const p = liveScreensDistProblems(fixtureManifest, dist, paneIds);
  check(p.some((x) => /phone\.520\.webp is in the manifest but not in dist/.test(x)) && p.some((x) => /old\.webp is not in the manifest/.test(x)), `check-live-screens misses: ${p}`);
  check(liveScreensDistProblems(LIVE_SCREENS, join(tmp, 'no-dist'), paneIds).length === 0 || LIVE_SCREENS.version, 'empty manifest with no screens dir is clean');
}

/* ---------- B. the pipeline on a fixture app ---------- */

const PASS = 'fixture-pass';
let plant = '';
const cookies = (req) => Object.fromEntries((req.headers.cookie ?? '').split(/;\s*/).filter(Boolean).map((c) => c.split('=')));
const appPage = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{margin:0;font:16px system-ui;background:#f7f3ec;color:#0d1117}[data-demo-banner]{background:#ff0000;height:60px}main{padding:24px}
.row{height:44px;margin:8px 0;background:#e7dcc8;border-radius:8px}</style></head>
<body><div data-demo-banner>DEMO</div><main><h1>${title}</h1>${body}</main></body></html>`;
const app = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const lang = cookies(req).gl_lang_ui === 'es' ? 'es' : 'en';
  if (url.pathname === '/login' && req.method === 'POST') {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      const f = new URLSearchParams(data);
      const ok = ['couple@hh.local', 'planner@hh.local'].includes(f.get('email')) && f.get('password') === PASS;
      res.writeHead(303, ok ? { 'set-cookie': `sid=${f.get('email').split('@')[0]}; Path=/`, location: '/dashboard' } : { location: '/login' });
      res.end();
    });
    return;
  }
  if (url.pathname === '/login') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(appPage('Login', '<form method="post"><input name="email" type="email"><input name="password" type="password"><button>Sign in</button></form>'));
    return;
  }
  const sid = cookies(req).sid;
  if (!sid) {
    res.writeHead(302, { location: '/login' });
    res.end();
    return;
  }
  if (url.pathname.startsWith('/planner') && sid !== 'planner') {
    res.writeHead(403);
    res.end();
    return;
  }
  const title = `${lang === 'es' ? 'Pantalla' : 'Screen'} ${url.pathname}`;
  const rows = Array.from({ length: 12 }, (_, i) => `<div class="row">${lang === 'es' ? 'Invitado' : 'Guest'} ${i + 1}, ana${i}@hh.local</div>`).join('');
  const leak = plant && url.pathname === plant ? '<p>https://app.test/rsvp?token=abc</p>' : '';
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(appPage(title, rows + leak));
});
await new Promise((ok) => app.listen(0, '127.0.0.1', ok));
const appBase = `http://127.0.0.1:${app.address().port}`;
const portalDir = join(tmp, 'portal');
mkdirSync(join(portalDir, 'docs', 'product'), { recursive: true });
writeFileSync(join(portalDir, 'docs', 'product', 'features.json'), JSON.stringify({ commit: 'abcdef1234567890', ...fixtureFacts }));
const baseOpts = {
  base: appBase,
  couple: 'couple@hh.local',
  planner: 'planner@hh.local',
  passwords: { couple: PASS, planner: PASS },
  portalDir,
  deployDir: join(tmp, 'git', 'deploy'),
  now: new Date('2026-11-20T15:00:00Z'),
  log: () => {},
};

const trial = join(tmp, 'trial');
const t0 = Date.now();
const result = await run({ ...baseOpts, out: trial });
check(Object.keys(result.held).join() === 'broadcasts', `pipeline held: ${Object.keys(result.held)}`);
check(result.version === '20261120-abcdef12', `pipeline version ${result.version}`);
check(result.files.length === 7 * 2 * 2 * 2, `pipeline wrote ${result.files.length} images, expected 56`);
const webpSize = (buf) => {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  if (chunk === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (chunk === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)];
  }
  return null;
};
let biggest = 0;
for (const name of result.files) {
  const buf = readFileSync(join(result.imgDir, name));
  biggest = Math.max(biggest, buf.length);
  const [, lang, form, w] = name.match(/^[a-z-]+\.(en|es)\.(desktop|phone)\.(\d+)\.webp$/) ?? [];
  const size = webpSize(buf);
  const want = form === 'desktop' ? [Number(w), Math.round((800 * w) / 1180)] : [Number(w), Math.round((640 * w) / 390)];
  check(lang && size && size[0] === want[0] && size[1] === want[1], `${name}: ${size} is not a ${want.join('x')} WebP`);
  check(buf.length <= MAX_BYTES, `${name} over budget`);
}
const trialModule = await import(pathToFileURL(result.moduleFile).href);
check(manifestProblems(trialModule.LIVE_SCREENS, paneIds).length === 0, `trial manifest: ${manifestProblems(trialModule.LIVE_SCREENS, paneIds)}`);
check(trialModule.LIVE_SCREENS_SOURCE.held.broadcasts === 'F36 live/hold', 'trial source records the held pane');
check(!existsSync(publicScreens) || LIVE_SCREENS.version, 'a trial run must not touch cinematic/public/screens');
console.log(`test-live-screens: fixture pipeline ${result.files.length} images in ${((Date.now() - t0) / 1000).toFixed(0)} s, largest ${(biggest / 1024).toFixed(1)} KB`);

plant = '/seating';
const leakOut = join(tmp, 'leak');
await throwsLike(() => run({ ...baseOpts, out: leakOut, only: ['seating', 'budget'] }), /scrubber.*\n.*seating .*token=/s, 'a planted token=abc');
check(!existsSync(join(leakOut, 'screens', '20261120-abcdef12')) && !existsSync(join(leakOut, 'live-screens.data.ts')), 'a scrubber failure must write nothing');
plant = '';
await throwsLike(() => run({ ...baseOpts, base: 'https://app.guest-ly.com', out: join(tmp, 'prod') }), /production/, 'production base');
await throwsLike(() => run({ ...baseOpts, out: join(CINEMATIC, 'public', 'screens') }), /use --publish/, '--out inside public');
await throwsLike(() => run({ ...baseOpts }), /--out <dir>/, 'neither --out nor --publish');
await throwsLike(() => run({ ...baseOpts, publish: true }), /not a git checkout/, '--publish of a non-git portal folder');
{
  const portal = join(tmp, 'git', 'portal');
  mkdirSync(join(portal, 'docs', 'product'), { recursive: true });
  writeFileSync(join(portal, 'docs', 'product', 'features.json'), JSON.stringify(fixtureFacts));
  await throwsLike(() => run({ ...baseOpts, portalDir: portal, publish: true }), /not released/, '--publish of an unreleased commit');
}
await throwsLike(() => run({ ...baseOpts, out: join(tmp, 'held'), only: ['broadcasts'] }), /nothing to shoot/, 'an all-held run');
check(!existsSync(publicScreens) || LIVE_SCREENS.version, 'refused runs must not touch cinematic/public/screens');
app.close();

/* ---------- C. the page with the fixture shots ---------- */

const site = join(tmp, 'site');
execFileSync('npx', ['vite', 'build', '--outDir', site, '--emptyOutDir', '--logLevel', 'error'], {
  cwd: CINEMATIC,
  env: { ...process.env, GL_LIVE_SCREENS_MODULE: result.moduleFile },
  stdio: ['ignore', 'pipe', 'pipe'],
});
cpSync(join(trial, 'screens'), join(site, 'screens'), { recursive: true });
check(liveScreensDistProblems(trialModule.LIVE_SCREENS, site, paneIds).length === 0, 'built site holds exactly the trial shots');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
const web = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(site, p.endsWith('/') ? `${p}index.html` : p);
  if (!file.startsWith(site) || !existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    const body = readFileSync(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((ok) => web.listen(0, '127.0.0.1', ok));
const siteUrl = `http://127.0.0.1:${web.address().port}/`;
const browser = await chromium.launch();

const visit = async ({ width, height, dpr = 1 }, label, steps) => {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const shots = [];
  const consoleErrors = [];
  page.on('request', (q) => q.url().includes('/screens/') && shots.push(new URL(q.url()).pathname));
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  await page.addInitScript(() => {
    window.__tourShift = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        if (e.sources?.some((s) => s.node && s.node.closest?.('.tour'))) window.__tourShift += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(siteUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  check(shots.length === 0, `${label}: ${shots.length} /screens/ requests before the tour is near (${shots})`);
  const early = await page.evaluate(() => {
    const box = document.querySelector('.tour__pane:not([hidden]) .live-screen');
    return box && { img: !!box.querySelector('img'), h: box.getBoundingClientRect().height };
  });
  check(early && !early.img && early.h > 100, `${label}: before the tour is near, the sized box must be there without an image (${JSON.stringify(early)})`);
  await page.locator('#platform .tour').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const img = document.querySelector('.tour__pane:not([hidden]) .live-screen__img');
    return img && img.complete && img.naturalWidth > 0;
  });
  await steps(page, shots);
  check(consoleErrors.length === 0, `${label}: console errors ${consoleErrors.join(' | ')}`);
  await ctx.close();
};
const imgState = (page) =>
  page.evaluate(() => {
    const img = document.querySelector('.tour__pane:not([hidden]) .live-screen__img');
    if (!img) return null;
    const box = img.closest('.live-screen').getBoundingClientRect();
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 4;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight * 0.02, 0, 0, 4, 4);
    const [rr, gg, bb] = g.getImageData(1, 1, 1, 1).data;
    return {
      src: new URL(img.currentSrc).pathname,
      width: img.getAttribute('width'),
      height: img.getAttribute('height'),
      loading: img.loading,
      decoding: img.decoding,
      alt: img.alt,
      sourceSize: [img.previousElementSibling?.getAttribute('width'), img.previousElementSibling?.getAttribute('height')],
      box: [Math.round(box.width), Math.round(box.height)],
      bannerRed: rr > 200 && gg < 60 && bb < 60,
      shift: window.__tourShift,
    };
  });

await visit({ width: 1440, height: 900 }, '1440', async (page, shots) => {
  const s = await imgState(page);
  check(/\/dashboard\.en\.desktop\.(440|880)\.webp$/.test(s.src), `1440: active image ${s.src}`);
  check(s.width === '260' && s.height === '427' && s.sourceSize.join() === '440,299', `1440: width/height ${s.width}x${s.height}, source ${s.sourceSize}`);
  check(s.loading === 'lazy' && s.decoding === 'async', `1440: loading ${s.loading}, decoding ${s.decoding}`);
  check(s.alt === copy.en.platform.items[0].title, `1440: alt "${s.alt}"`);
  check(Math.abs(s.box[0] / s.box[1] - 1180 / 800) < 0.02, `1440: box ${s.box} is not the desktop ratio`);
  check(!s.bannerRed, '1440: the demo banner is in the shot');
  check(s.shift === 0, `1440: layout shift in the tour ${s.shift}`);
  check(shots.length === 1, `1440: ${shots.length} image requests for one pane (${shots})`);
  /* the nav bar hides while scrolled down; its toggle still works */
  await page.locator('.lang-toggle--bar button', { hasText: 'ES' }).dispatchEvent('click');
  await page.waitForFunction(() => document.querySelector('.tour__pane:not([hidden]) .live-screen__img')?.currentSrc.includes('.es.desktop.'));
  const es = await imgState(page);
  check(es.alt === copy.es.platform.items[0].title, `1440 ES: alt "${es.alt}"`);
  await page.locator('[data-tab="seating"]').click();
  await page.waitForFunction(() => document.querySelector('#tour-pane-seating .live-screen__img')?.complete);
  check(/\/seating\.es\.desktop\./.test((await imgState(page)).src), '1440 ES: seating pane image');
  await page.locator('[data-tab="broadcasts"]').click();
  const placeholder = await page.evaluate(() => ({
    mock: !!document.querySelector('#tour-pane-broadcasts .mock'),
    img: !!document.querySelector('#tour-pane-broadcasts .live-screen'),
  }));
  check(placeholder.mock && !placeholder.img, `1440: held pane must show the placeholder (${JSON.stringify(placeholder)})`);
});

await visit({ width: 390, height: 844, dpr: 2 }, '390', async (page, shots) => {
  const s = await imgState(page);
  check(/\/dashboard\.en\.phone\.520\.webp$/.test(s.src), `390: active image ${s.src} (2x phone expected)`);
  check(s.box[0] === 260 && Math.abs(s.box[1] - 427) <= 1, `390: phone frame ${s.box}`);
  check(!s.bannerRed, '390: the demo banner is in the shot');
  check(s.shift === 0, `390: layout shift in the tour ${s.shift}`);
  check(shots.length === 1 && shots[0].includes('.phone.'), `390: requests ${shots}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  check(!overflow, '390: horizontal overflow');
});

await browser.close();
web.close();
rmSync(tmp, { recursive: true, force: true });

if (errors.length) {
  for (const e of errors) console.error(`test-live-screens: ${e}`);
  process.exit(1);
}
console.log(
  'test-live-screens clean: manifest, resolver, refusals, scrubber, truth and release gates; fixture pipeline (held pane skipped, WebP sizes, budget, planted token fails); page lazy, sized, no shift, EN to ES swap, placeholder kept',
);

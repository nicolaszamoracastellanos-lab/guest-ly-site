/* #24 Live app screens: shoot real portal screens for the platform tour.

   Logs in to a running portal build (couple and planner demo logins), opens
   one route per tour pane, in EN and ES, at a desktop and a phone size,
   removes the demo banner and dev overlays, checks the visible text for
   anything that must not reach a public page, and writes optimized WebP
   images (two widths per form, 1x and 2x of the slot) plus a manifest.

   WHEN AND FROM WHERE (master prompt, Lane 7): the shots that go on
   guest-ly.com come from the merged mw/integration production build AFTER
   the train is live, with the seeded demo wedding, showing only features
   released in production. So:
   - never point it at app.guest-ly.com or any guest-ly.com host (refused);
     run `next build && next start` of the released portal commit against
     the local stack seeded with the demo wedding;
   - --out <dir> writes a trial set anywhere outside the landing source
     (cinematic/public, cinematic/src and cinematic/dist are refused);
     nothing on the page changes;
   - --publish writes cinematic/public/screens/<version>/ and
     src/live-screens.data.ts (the page then shows the shots). It refuses
     unless the portal checkout is clean and its HEAD is already on the
     deploy checkout's origin/main, i.e. released to production (read-only
     git commands there, nothing else);
   - truth gate: a pane whose features (docs/product/features.json of the
     portal checkout shot) are not live with marketing "ok" and no rollout
     limit is not shot and keeps its placeholder; it is listed as held.

   Usage:
     LIVE_SCREENS_PASSWORD=... node scripts/live-screens.mjs \
       --base=http://localhost:3000 --couple=couple@hh.local --planner=planner@hh.local \
       --portal=/path/to/portal-checkout (--out=/tmp/live-trial | --publish) \
       [--only=seating,budget] [--deploy-checkout=/path/to/guestly-portal-deploy] \
       [--demo-domains=hh.local,example.com]
   LIVE_SCREENS_COUPLE_PASSWORD / LIVE_SCREENS_PLANNER_PASSWORD override the
   shared one. The portal checkout may also come from GL_PORTAL_DIR. */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copy } from '../src/copy.ts';
import { SAFE_VERSION, SCREEN_FORMS, SCREEN_LANGS, heightFor, manifestProblems, screenPath } from '../src/ui/live-screens.ts';
import { LIVE_SCREENS } from '../src/live-screens.data.ts';
import { isPrintable } from './llms.mjs';
import { CINEMATIC, deskPath } from './lib/paths.mjs';

/* One route per tour pane (copy.ts platform.items), the login that sees it,
   and the features it shows (truth gate). `focus` scrolls an element into
   view before the shot. */
export const SCREENS = [
  { id: 'dashboard', role: 'couple', path: '/dashboard', features: ['F20'] },
  { id: 'guests', role: 'couple', path: '/guests', features: ['F23', 'F25'] },
  { id: 'broadcasts', role: 'couple', path: '/broadcasts', features: ['F36'] },
  { id: 'seating', role: 'couple', path: '/seating', features: ['F28'] },
  { id: 'budget', role: 'couple', path: '/budget', features: ['F27'] },
  { id: 'brain', role: 'couple', path: '/brain', features: ['F21'] },
  { id: 'planner', role: 'planner', path: '/planner/weddings', features: ['F40'] },
  { id: 'checkin', role: 'couple', path: '/checkin', features: ['F30', 'F11'] },
];

/* Capture sizes. Desktop: the whole 1180x800 viewport (aspect 1.475, the
   tour column is 278 to 435px wide). Phone: the top 390x640 of a 390x844
   screen, the primary object first, shown in a 260px frame. Both at 2x so
   the 2x image is a downscale, never an upscale. */
export const CAPTURE = {
  desktop: { viewport: { width: 1180, height: 800 }, clip: { x: 0, y: 0, width: 1180, height: 800 } },
  phone: { viewport: { width: 390, height: 844 }, clip: { x: 0, y: 0, width: 390, height: 640 } },
};
export const SCALE = 2;
export const WEBP_QUALITY = 0.82;
/* Weight budget per image (STUDY-quality-bar 7.4: lightweight screens). */
export const MAX_BYTES = 150 * 1024;

export class LiveScreensError extends Error {}

/* ---------- pure checks (tested in scripts/test-live-screens.mjs) ---------- */

/* Hosts the pipeline must never shoot: production, its previews, and the
   demo tenant there (real invite tokens, live AI). */
export function baseProblems(base) {
  let u;
  try {
    u = new URL(base);
  } catch {
    return [`--base "${base}" is not a URL`];
  }
  const host = u.hostname.toLowerCase();
  if (!/^https?:$/.test(u.protocol)) return [`--base must be http or https, not ${u.protocol}`];
  if (host === 'guest-ly.com' || host.endsWith('.guest-ly.com') || host.endsWith('.netlify.app'))
    return [`--base ${u.origin} is production; shoot a local production build of the released portal commit with the seeded demo wedding`];
  return [];
}

export function versionFor(date, commit) {
  const d = date.toISOString().slice(0, 10).replaceAll('-', '');
  const v = `${d}-${String(commit).slice(0, 8)}`;
  if (!SAFE_VERSION.test(v)) throw new LiveScreensError(`cannot make a version from commit "${commit}"`);
  return v;
}

/* Which panes may be shot, by the truth gate. Unknown feature ids fail. */
export function truthGate(facts, screens = SCREENS) {
  const byId = new Map(facts.features.map((f) => [f.id, f]));
  const shoot = [];
  const held = {};
  const unknown = [];
  for (const s of screens) {
    const notOk = [];
    for (const id of s.features) {
      const f = byId.get(id);
      if (!f) unknown.push(`${s.id}: ${id} is not in features.json`);
      else if (!isPrintable(f)) notOk.push(`${id} ${f.status}/${f.marketing}${f.rollout?.mode ? `/${f.rollout.mode}` : ''}`);
    }
    if (notOk.length) held[s.id] = notOk.join(', ');
    else shoot.push(s);
  }
  if (unknown.length) throw new LiveScreensError(`truth gate: ${unknown.join('; ')}`);
  return { shoot, held };
}

const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g;
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;
const LEAKS = [
  [/\blocalhost\b|\b127\.0\.0\.1\b|\b0\.0\.0\.0\b/i, 'a local address'],
  [/\bsupabase\b/i, 'the word supabase'],
  [/token=/i, 'a token= parameter'],
  [/\bservice[_-]?role\b|\bsk_(live|test)_|\bpk_(live|test)_/i, 'a key-shaped string'],
  [/\bat [\w$.<>]+ \([^)\s]*:\d+:\d+\)/, 'a stack trace frame'],
];

/* Problems in what a shot would show: visible text and form values. Emails
   are allowed only on the fictional demo domains. */
export function scrubProblems(text, { demoDomains = ['hh.local'] } = {}) {
  const problems = [];
  for (const [re, what] of LEAKS) {
    const m = text.match(re);
    if (m) problems.push(`shows ${what} ("${m[0].slice(0, 40)}")`);
  }
  if (JWT.test(text)) problems.push('shows a JWT-shaped string');
  for (const m of text.matchAll(EMAIL)) {
    const domain = m[0].split('@')[1].toLowerCase();
    if (!demoDomains.some((d) => domain === d || domain.endsWith(`.${d}`))) problems.push(`shows an email outside the demo domains (${m[0]})`);
  }
  return problems;
}

/* --out may not write into the landing's source, public or build files;
   only --publish changes the page. */
export function outProblems(out) {
  const abs = resolve(out);
  for (const dir of [join(CINEMATIC, 'public'), join(CINEMATIC, 'src'), join(CINEMATIC, 'dist')]) {
    if (abs === dir || abs.startsWith(dir + sep)) return [`--out ${abs} is inside ${relative(CINEMATIC, dir)}/; use --publish to change the page`];
  }
  return [];
}

/* The manifest module the page imports (src/live-screens.data.ts). */
export function manifestModule(manifest, source) {
  return `/* #24 Live app screens: which real portal screenshots the platform tour shows.

   Written only by \`node scripts/live-screens.mjs --publish\` (never by hand):
   the shots come from the released portal build with the seeded demo
   wedding, after the train that ships the features shown is live. A pane
   not listed keeps its placeholder vignette. See the header of
   scripts/live-screens.mjs. */

import type { LiveScreensManifest } from './ui/live-screens.ts';

export const LIVE_SCREENS: LiveScreensManifest = ${JSON.stringify(manifest, null, 2)};

/* Where the shots came from (not used by the page, so not in the bundle). */
export const LIVE_SCREENS_SOURCE = ${JSON.stringify(source, null, 2)};
`;
}

/* ---------- git (read only) ---------- */

const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/* --publish only: the portal checkout shot is clean and released. */
export function releaseProblems(portalDir, deployDir) {
  const problems = [];
  let head;
  try {
    head = git(portalDir, 'rev-parse', 'HEAD');
  } catch {
    return [`${portalDir} is not a git checkout; --publish needs the released portal commit`];
  }
  if (git(portalDir, 'status', '--porcelain', '--untracked-files=no'))
    problems.push(`${portalDir} has uncommitted changes; shoot a clean checkout of the released commit`);
  let released;
  try {
    released = git(deployDir, 'rev-parse', '--verify', 'origin/main');
  } catch {
    return [...problems, `${deployDir} has no origin/main (pass --deploy-checkout or GL_DEPLOY_CHECKOUT)`];
  }
  try {
    git(portalDir, 'cat-file', '-e', `${released}^{commit}`);
  } catch {
    return [...problems, `${portalDir} does not have production's commit ${released.slice(0, 8)}; fetch it first`];
  }
  try {
    git(portalDir, 'merge-base', '--is-ancestor', head, released);
  } catch {
    problems.push(
      `portal HEAD ${head.slice(0, 8)} is not released (not on the deploy checkout's origin/main ${released.slice(0, 8)}); ` +
        'shoot only after the train is live',
    );
  }
  return problems;
}

/* ---------- browser ---------- */

/* Same clean step as the guide pipeline (shoot2.mjs): the demo banner and
   the Next dev overlay never appear in a shot. */
const CLEAN = () => {
  for (const el of document.querySelectorAll('[data-demo-banner], nextjs-portal, [data-nextjs-toast], [data-nextjs-dev-tools-button]')) el.remove();
};
const VISIBLE_TEXT = () => {
  const values = [...document.querySelectorAll('input, textarea, select')]
    .filter((el) => el.type !== 'hidden' && el.type !== 'password')
    .map((el) => `${el.value ?? ''} ${el.placeholder ?? ''}`);
  return `${document.title}\n${document.body.innerText}\n${values.join('\n')}`;
};

async function login(browser, base, { email, password, lang, form }) {
  const ctx = await browser.newContext({
    viewport: CAPTURE[form].viewport,
    deviceScaleFactor: SCALE,
    locale: lang === 'es' ? 'es-MX' : 'en-US',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    isMobile: form === 'phone',
    hasTouch: form === 'phone',
  });
  await ctx.addCookies([{ name: 'gl_lang_ui', value: lang, url: base }]);
  const page = await ctx.newPage();
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('gl_last_method', 'password'));
  await page.reload({ waitUntil: 'networkidle' });
  const formEl = page.locator('form:has(input[name="password"])');
  await formEl.locator('input[name="email"]').fill(email);
  await formEl.locator('input[name="password"]').fill(password);
  await formEl.locator('button:not([type="button"])').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 });
  return { ctx, page };
}

/* Encode a PNG into WebP at the given widths with the browser's own
   encoder (no native image library in the landing). */
async function encodeWebp(encoder, png, widths) {
  return encoder.evaluate(
    async ({ b64, widths, q }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const out = [];
      for (const w of widths) {
        const h = Math.round((img.naturalHeight * w) / img.naturalWidth);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, w, h);
        const blob = await new Promise((ok) => c.toBlob(ok, 'image/webp', q));
        if (!blob || blob.type !== 'image/webp') throw new Error('this browser cannot encode WebP');
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        out.push({ w, h, b64: btoa(s) });
      }
      return out;
    },
    { b64: png.toString('base64'), widths, q: WEBP_QUALITY },
  );
}

/* ---------- run ---------- */

export async function run(opts) {
  const {
    base,
    couple,
    planner,
    passwords,
    portalDir,
    out,
    publish = false,
    only = null,
    deployDir,
    demoDomains = ['hh.local'],
    now = new Date(),
    log = console.log,
  } = opts;
  const problems = [...baseProblems(base)];
  if (!publish && !out) problems.push('pass --out <dir> for a trial set, or --publish to put the shots on the page');
  if (publish && out) problems.push('--out and --publish are exclusive');
  if (out) problems.push(...outProblems(out));
  const factsFile = join(portalDir, 'docs', 'product', 'features.json');
  if (!existsSync(factsFile)) problems.push(`${factsFile} not found (--portal or GL_PORTAL_DIR must be the portal checkout you shoot)`);
  if (problems.length) throw new LiveScreensError(problems.join('\n'));
  if (publish) {
    const rel = releaseProblems(portalDir, deployDir);
    if (rel.length) throw new LiveScreensError(rel.join('\n'));
  }

  const paneIds = copy.en.platform.items.map((i) => i.id);
  const unknownPane = SCREENS.filter((s) => !paneIds.includes(s.id)).map((s) => s.id);
  if (unknownPane.length) throw new LiveScreensError(`SCREENS lists ${unknownPane.join(', ')}, which copy.ts has no tour pane for`);
  const wanted = only ? SCREENS.filter((s) => only.includes(s.id)) : SCREENS;
  if (only && wanted.length !== only.length) throw new LiveScreensError(`--only names an unknown pane (${only.join(',')})`);

  const facts = JSON.parse(readFileSync(factsFile, 'utf8'));
  const { shoot, held } = truthGate(facts, wanted);
  for (const [id, why] of Object.entries(held)) log(`live-screens: ${id} held (keeps its placeholder): ${why}`);
  if (shoot.length === 0) throw new LiveScreensError('nothing to shoot: every pane asked for is held by the truth gate');
  for (const role of new Set(shoot.map((s) => s.role))) {
    const email = role === 'couple' ? couple : planner;
    if (!email) throw new LiveScreensError(`--${role} <email> is needed for ${shoot.filter((s) => s.role === role).map((s) => s.id).join(', ')}`);
    if (!passwords[role]) throw new LiveScreensError(`set LIVE_SCREENS_PASSWORD (or LIVE_SCREENS_${role.toUpperCase()}_PASSWORD)`);
  }

  let commit = facts.commit ?? '';
  try {
    commit = git(portalDir, 'rev-parse', 'HEAD');
  } catch {
    /* a non-git portal folder (tests): the facts file's commit */
  }
  const version = versionFor(now, commit || '0000000');
  const imgRoot = publish ? join(CINEMATIC, 'public', 'screens') : resolve(out, 'screens');
  const tmpDir = join(imgRoot, `.${version}.partial`);
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });

  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const screens = {};
  const files = [];
  const leaks = [];
  try {
    const encoder = await (await browser.newContext()).newPage();
    for (const lang of SCREEN_LANGS) {
      for (const form of SCREEN_FORMS) {
        for (const role of new Set(shoot.map((s) => s.role))) {
          const { ctx, page } = await login(browser, base, {
            email: role === 'couple' ? couple : planner,
            password: passwords[role],
            lang,
            form,
          });
          for (const s of shoot.filter((x) => x.role === role)) {
            const res = await page.goto(`${base}${s.path}`, { waitUntil: 'networkidle', timeout: 90000 });
            if (!res || res.status() >= 400) throw new LiveScreensError(`${s.id}: ${s.path} answered ${res?.status() ?? 'nothing'}`);
            if (new URL(page.url()).pathname.startsWith('/login')) throw new LiveScreensError(`${s.id}: ${s.path} sent the ${role} back to /login`);
            await page.evaluate(() => document.fonts.ready);
            await page.evaluate(CLEAN);
            if (s.focus) await page.locator(s.focus).first().scrollIntoViewIfNeeded();
            await page.waitForTimeout(400);
            await page.evaluate(CLEAN);
            const found = scrubProblems(await page.evaluate(VISIBLE_TEXT), { demoDomains });
            if (found.length) {
              leaks.push(...found.map((p) => `${s.id} ${lang} ${form}: ${p}`));
              continue;
            }
            const png = await page.screenshot({ clip: CAPTURE[form].clip, animations: 'disabled', caret: 'hide' });
            const widths = LIVE_SCREENS.widths[form];
            for (const img of await encodeWebp(encoder, png, widths)) {
              const name = screenPath(version, s.id, lang, form, img.w).split('/').pop();
              const buf = Buffer.from(img.b64, 'base64');
              if (buf.length > MAX_BYTES) throw new LiveScreensError(`${name} is ${Math.round(buf.length / 1024)} KB, over the ${MAX_BYTES / 1024} KB budget`);
              writeFileSync(join(tmpDir, name), buf);
              files.push(name);
            }
            const big = widths[widths.length - 1];
            const clip = CAPTURE[form].clip;
            screens[s.id] ??= {};
            screens[s.id][lang] ??= {};
            screens[s.id][lang][form] = [big, heightFor([clip.width, clip.height], big)];
            log(`live-screens: ${s.id} ${lang} ${form} (${s.path})`);
          }
          await ctx.close();
        }
      }
    }
  } catch (e) {
    rmSync(tmpDir, { recursive: true, force: true });
    throw e;
  } finally {
    await browser.close();
  }
  if (leaks.length) {
    rmSync(tmpDir, { recursive: true, force: true });
    throw new LiveScreensError(`scrubber: nothing written, these screens show what a public page must not:\n${leaks.join('\n')}`);
  }

  const manifest = { version, widths: LIVE_SCREENS.widths, screens };
  const shapeProblems = manifestProblems(manifest, paneIds);
  if (shapeProblems.length) {
    rmSync(tmpDir, { recursive: true, force: true });
    throw new LiveScreensError(`manifest: ${shapeProblems.join('; ')}`);
  }
  const source = {
    portalCommit: commit,
    shotAt: now.toISOString(),
    features: Object.fromEntries(shoot.map((s) => [s.id, s.features])),
    held,
  };

  /* Swap in the new version folder; older versions go (one set on the site). */
  const finalDir = join(imgRoot, version);
  rmSync(finalDir, { recursive: true, force: true });
  renameSync(tmpDir, finalDir);
  for (const d of readdirSync(imgRoot)) {
    if (d !== version && statSync(join(imgRoot, d)).isDirectory()) rmSync(join(imgRoot, d), { recursive: true, force: true });
  }
  const moduleFile = publish ? join(CINEMATIC, 'src', 'live-screens.data.ts') : resolve(out, 'live-screens.data.ts');
  writeFileSync(moduleFile, manifestModule(manifest, source));
  log(`live-screens: wrote ${files.length} images in ${finalDir} and ${moduleFile}`);
  return { version, manifest, source, held, files, imgDir: finalDir, moduleFile };
}

/* ---------- CLI ---------- */

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flags = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...v] = a.replace(/^--/, '').split('=');
      return [k, v.length ? v.join('=') : true];
    }),
  );
  const shared = process.env.LIVE_SCREENS_PASSWORD;
  try {
    await run({
      base: String(flags.base ?? '').replace(/\/$/, ''),
      couple: flags.couple,
      planner: flags.planner,
      passwords: {
        couple: process.env.LIVE_SCREENS_COUPLE_PASSWORD || shared,
        planner: process.env.LIVE_SCREENS_PLANNER_PASSWORD || shared,
      },
      portalDir: resolve(flags.portal || process.env.GL_PORTAL_DIR || '.'),
      out: typeof flags.out === 'string' ? flags.out : undefined,
      publish: flags.publish === true,
      only: typeof flags.only === 'string' ? flags.only.split(',') : null,
      deployDir: resolve(
        flags['deploy-checkout'] ||
          process.env.GL_DEPLOY_CHECKOUT ||
          deskPath(join(homedir(), 'Desktop', 'Desktop - Unknown', 'guest-ly', 'guestly-portal-deploy')),
      ),
      demoDomains: typeof flags['demo-domains'] === 'string' ? flags['demo-domains'].split(',') : undefined,
    });
  } catch (e) {
    console.error(e instanceof LiveScreensError ? `live-screens: ${e.message}` : e);
    process.exit(1);
  }
}

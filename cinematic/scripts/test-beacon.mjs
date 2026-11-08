/* #23 landing beacon test (Playwright). Proves the beacon sends the agreed
   payload (L7P-LOG "Beacon payload v1") to a local stub, and that nothing
   about a visit is kept on the device.

   It builds the site twice into a temporary folder (never cinematic/dist):
   once with VITE_SITE_BEACON_URL pointing at a stub on another port of
   localhost (same site, other origin: the shape of guest-ly.com posting to
   app.guest-ly.com), prerendered like the real build, and once with the URL
   empty (today's build). Then:
   A. desktop visit, automation flag off: every batch valid; one view id;
      the periodic flush; sections in page order once each; depth 25, 50,
      75, 100; the pricing plan CTA; wizard steps 1 and 2; the demo chat
      count; a FAQ question and an in-page link named by what they open
      or where they go; the nav login link with its outbound host; one
      leave, last;
      text/plain body, no preflight, no Referer, no Cookie header even with
      a same-site cookie planted; a Set-Cookie in the answer is not kept;
      nothing typed into the wizard or the chat appears in any body; the
      chunk is 2 KB gzip or less and is fetched after the first paint.
   B. phone visit in a clean browser: device "phone"; no cookie, no
      localStorage or sessionStorage key, no IndexedDB database, no
      Set-Cookie on any response; the privacy page shows the visit-counts
      paragraph in EN and ES while the beacon is on, and events carry the
      language of the moment.
   C. nothing at all is sent with Do Not Track, Global Privacy Control, or
      when navigator.webdriver is true.
   D. the URL-empty build has no beacon chunk, requests none and sends
      nothing.
   No scenario may log a console error or throw (hydration included).
   Every batch is also checked with the portal's own parser
   (src/lib/site-analytics/schema.ts) when one is found: GL_PORTAL_DIR, else
   the usual portal checkouts. Usage: node scripts/test-beacon.mjs */

import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';
import { CINEMATIC, deskPath } from './lib/paths.mjs';

const failures = [];
const check = (ok, msg) => {
  if (!ok) failures.push(msg);
};

/* ---------- the stub ingest (records every request) ---------- */
const hits = [];
let stubSetsCookie = true;
const stub = createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    hits.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString('utf8') });
    const headers = { 'Access-Control-Allow-Origin': req.headers.origin || '*', Vary: 'Origin' };
    if (stubSetsCookie) headers['Set-Cookie'] = 'gl_stub=1; Path=/; SameSite=Lax';
    res.writeHead(204, headers);
    res.end();
  });
});
await new Promise((r) => stub.listen(0, '127.0.0.1', r));
const stubPort = stub.address().port;
const BEACON_URL = `http://localhost:${stubPort}/api/site/t`;

/* ---------- builds ---------- */
const work = mkdtempSync(join(tmpdir(), 'gl-beacon-'));
const onDir = join(work, 'on');
const offDir = join(work, 'off');
/* The beacon test is about the beacon: the feature switches stay off so the
   shipped guides and Reviews reads (and the guides section's funnel block)
   are not part of what it counts or refuses. */
const SWITCHES_OFF = { GL_BOOKING_ENABLED: '0', GL_GUIDES_ENABLED: '0', GL_REVIEWS_ENABLED: '0' };
const run = (args, env) =>
  execFileSync(args[0], args.slice(1), { cwd: CINEMATIC, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
console.log('test-beacon: building with the beacon on (stub) and off');
run(['npx', 'vite', 'build', '--outDir', onDir, '--emptyOutDir', '--logLevel', 'error'], { ...SWITCHES_OFF, VITE_SITE_BEACON_URL: BEACON_URL });
run(['node', 'scripts/prerender.mjs'], { ...SWITCHES_OFF, GL_DIST: onDir });
run(['npx', 'vite', 'build', '--outDir', offDir, '--emptyOutDir', '--logLevel', 'error'], { ...SWITCHES_OFF, VITE_SITE_BEACON_URL: '' });

const beaconFiles = (dir) => readdirSync(join(dir, 'assets')).filter((f) => /^beacon-.*\.js$/.test(f));
const onChunks = beaconFiles(onDir);
check(onChunks.length === 1, `beacon-on build should have one beacon chunk, has ${onChunks.length}`);
const chunkGzip = onChunks.length ? gzipSync(readFileSync(join(onDir, 'assets', onChunks[0])), { level: 9 }).length : 0;
check(chunkGzip > 0 && chunkGzip <= 2048, `beacon chunk is ${chunkGzip} bytes gzip (budget 2048)`);
check(beaconFiles(offDir).length === 0, 'URL-empty build still contains a beacon chunk');
const offIndexJs = readdirSync(join(offDir, 'assets')).filter((f) => /^index-.*\.js$/.test(f));
for (const f of offIndexJs) {
  const js = readFileSync(join(offDir, 'assets', f), 'utf8');
  check(!js.includes('__glt') && !js.includes('keepalive'), `URL-empty build ${f} still carries beacon code`);
}

/* ---------- static servers ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml' };
function serve(dir) {
  const server = createServer((req, res) => {
    let file = join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    try {
      if (statSync(file, { throwIfNoEntry: false })?.isDirectory()) file = join(file, 'index.html');
      /* The URL-empty build is not prerendered: a page path falls back to the
         app shell, as in prerender.mjs. */
      if (!existsSync(file) && !extname(file)) file = join(dir, 'index.html');
      const body = readFileSync(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}
const onServer = await serve(onDir);
const offServer = await serve(offDir);
const ON = `http://localhost:${onServer.address().port}`;
const OFF = `http://localhost:${offServer.address().port}`;

/* ---------- the portal's parser, when a portal tree has it ---------- */
let parseBeacon = null;
const schemaCandidates = [
  process.env.GL_PORTAL_DIR,
  deskPath(join(process.env.HOME || '', 'Desktop', 'Desktop - Unknown', 'guest-ly', 'guestly-portal-deploy')),
  deskPath(join(process.env.HOME || '', 'Desktop', 'Desktop - Unknown', 'guest-ly', 'guestly-portal')),
].filter(Boolean);
for (const dir of schemaCandidates) {
  const f = join(dir, 'src', 'lib', 'site-analytics', 'schema.ts');
  if (existsSync(f)) {
    parseBeacon = (await import(pathToFileURL(f).href)).parseBeacon;
    console.log(`test-beacon: checking every batch with the portal parser in ${dir}`);
    break;
  }
}
if (!parseBeacon) console.log('test-beacon: no portal parser found (set GL_PORTAL_DIR); using the local allowlist only');

/* Local copy of the v1 allowlists, so the test stands without a portal tree. */
const SECTIONS = ['hero', 'scenarios', 'pillars', 'channels', 'platform', 'coordinator', 'how', 'compare', 'pricing', 'founding', 'guides', 'faq', 'final', 'footer'];
const AREAS = ['nav', 'wizard', 'booking', 'chat', 'legal'];
const KINDS = ['view', 'section', 'depth', 'click', 'wizard_step', 'demo_chat', 'booking', 'guide', 'leave'];
const ELS = ['cta', 'link', 'button', 'tab', 'faq', 'nav'];

function validateBatch(b, where) {
  check(b.v === 1, `${where}: v is ${b.v}`);
  check(typeof b.view === 'string' && /^[A-Za-z0-9_-]{8,40}$/.test(b.view), `${where}: bad view id ${b.view}`);
  check(typeof b.path === 'string' && b.path.startsWith('/') && !/[?#]/.test(b.path), `${where}: bad path ${b.path}`);
  check(['en', 'es'].includes(b.lang), `${where}: bad lang ${b.lang}`);
  check(['phone', 'tablet', 'desktop'].includes(b.device), `${where}: bad device ${b.device}`);
  check(['night', 'day'].includes(b.theme), `${where}: bad theme ${b.theme}`);
  check(Array.isArray(b.events) && b.events.length >= 1 && b.events.length <= 25, `${where}: ${b.events?.length} events`);
  for (const e of b.events ?? []) {
    check(KINDS.includes(e.k), `${where}: unknown kind ${e.k}`);
    check(['en', 'es'].includes(e.lang), `${where}: event without lang ${JSON.stringify(e)}`);
    if (e.k === 'section') check(SECTIONS.includes(e.s), `${where}: unknown section ${e.s}`);
    if (e.k === 'click') {
      check(SECTIONS.includes(e.s) || AREAS.includes(e.s), `${where}: click from unknown area ${JSON.stringify(e)}`);
      check(ELS.includes(e.el), `${where}: click el ${e.el}`);
      check(typeof e.id === 'string' && e.id.length > 0 && e.id.length <= 60, `${where}: click id ${e.id}`);
    }
  }
  if (parseBeacon) {
    const { rows, dropped } = parseBeacon(b, { visitorDay: '0'.repeat(32), day: '2026-11-05' });
    check(dropped === 0 && rows.length === b.events.length, `${where}: portal parser kept ${rows.length} of ${b.events.length} (dropped ${dropped})`);
  }
}

/* ---------- browser helpers ---------- */
const browser = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled'] });
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 };

/* Console errors and uncaught page errors (hydration mismatches included)
   fail the test in every scenario. */
const consoleErrors = [];
async function newContext(opts, { webdriver = false, dnt = false, gpc = false } = {}) {
  const ctx = await browser.newContext({ ...opts, colorScheme: 'dark' });
  ctx.on('page', (page) => {
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(`${page.url()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => consoleErrors.push(`${page.url()}: ${e.message}`));
  });
  await ctx.addInitScript(
    ([wd, dntOn, gpcOn]) => {
      Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => wd, configurable: true });
      if (dntOn) Object.defineProperty(Navigator.prototype, 'doNotTrack', { get: () => '1', configurable: true });
      if (gpcOn) Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true, configurable: true });
    },
    [webdriver, dnt, gpc],
  );
  /* The hero chat posts to the demo concierge on another host: answered
     locally so the test never leaves this machine. */
  await ctx.route('https://alexnico.guest-ly.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"reply":"Here is the answer."}' }),
  );
  await ctx.route('https://app.guest-ly.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>app</title>' }));
  return ctx;
}

async function scrollToEnd(page) {
  await page.evaluate(async () => {
    for (let y = 0; y <= document.documentElement.scrollHeight; y += 250) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 70));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 300));
  });
}

const beaconHits = () => hits.filter((h) => h.url.startsWith('/api/site/t'));
const batchesOf = (list) => list.filter((h) => h.method === 'POST').map((h) => JSON.parse(h.body));
async function waitFor(fn, ms, what) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  failures.push(`timed out waiting for ${what}`);
  return false;
}

/* ---------- A. desktop visit ---------- */
{
  hits.length = 0;
  stubSetsCookie = true;
  const ctx = await newContext(DESKTOP);
  /* A same-site cookie, like a signed-in couple's portal session: it must
     not travel with the beacon. */
  await ctx.addCookies([{ name: 'portal_session', value: 'planted', domain: 'localhost', path: '/', sameSite: 'Lax' }]);
  const page = await ctx.newPage();
  const scriptRequests = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'script') scriptRequests.push(r.url());
  });
  await page.goto(`${ON}/`, { waitUntil: 'load' });
  /* Periodic flush: the first batch (the view) arrives without any hide. */
  await waitFor(() => beaconHits().length > 0, 9000, 'the first periodic flush');

  const timing = await page.evaluate(() => {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
    const chunk = performance.getEntriesByType('resource').find((r) => /\/beacon-[^/]*\.js$/.test(r.name));
    return { fcp, chunkStart: chunk ? chunk.startTime : -1 };
  });
  check(timing.chunkStart > 0 && timing.chunkStart >= timing.fcp, `beacon chunk fetched at ${timing.chunkStart} ms, first paint at ${timing.fcp} ms`);

  const expectedSections = await page.evaluate(() =>
    [...document.querySelectorAll('main section[id],[data-sec]')].map((el) => el.dataset.sec || el.id),
  );
  await scrollToEnd(page);

  /* A FAQ question (named by what it opens) and an in-page link (named by
     where it goes). */
  await page.locator('#faq .faq-q').first().click();
  await page.locator('.coord-caps__link').click();
  await page.waitForTimeout(300);

  /* Named CTA: the Signature plan button under Pricing opens the wizard. */
  await page.locator('[data-track="plan-signature-start"]').scrollIntoViewIfNeeded();
  await page.locator('[data-track="plan-signature-start"]').click();
  await page.locator('.wiz').waitFor();
  await page.locator('.wiz-range').first().click();
  await page.locator('.wiz input[type="date"]').fill('2027-06-12');
  await page.locator('.wiz input:not([type])').fill('Secret Ville 123');
  await page.locator('.wiz__continue').click();
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');

  /* Hero chat: the count goes out, the text never does. */
  await page.evaluate(() => window.scrollTo(0, 0));
  const chatInput = page.locator('.chat-card__input--live input');
  await chatInput.fill('my secret question 42');
  await chatInput.press('Enter');
  await page.waitForTimeout(400);

  /* Leave through an outbound link: pagehide sends the last batch. */
  await page.locator('.nav__login').click();
  await page.waitForURL('https://app.guest-ly.com/**');
  await waitFor(() => batchesOf(beaconHits()).some((b) => b.events.some((e) => e.k === 'leave')), 5000, 'the leave event');
  await new Promise((r) => setTimeout(r, 300));

  const list = beaconHits();
  check(list.every((h) => h.method === 'POST'), `preflight or other method seen: ${list.map((h) => h.method).join(',')}`);
  for (const h of list) {
    check(/^text\/plain/.test(h.headers['content-type'] || ''), `content-type ${h.headers['content-type']}`);
    check(!h.headers.cookie, `a beacon carried a cookie: ${h.headers.cookie}`);
    check(!h.headers.referer, `a beacon carried a Referer: ${h.headers.referer}`);
    check(h.headers.origin === ON, `origin ${h.headers.origin}, expected ${ON}`);
    check(!/Secret Ville|secret question/i.test(h.body), 'typed text reached a beacon body');
  }
  const batches = batchesOf(list);
  batches.forEach((b, i) => validateBatch(b, `A batch ${i}`));
  check(new Set(batches.map((b) => b.view)).size === 1, 'more than one view id in one page view');
  check(batches.every((b) => b.path === '/' && b.device === 'desktop'), 'path or device wrong on desktop');
  const events = batches.flatMap((b) => b.events);
  const kinds = events.map((e) => e.k);
  check(kinds[0] === 'view' && kinds.filter((k) => k === 'view').length === 1, `view events: ${kinds.filter((k) => k === 'view').length}, first ${kinds[0]}`);
  const sections = events.filter((e) => e.k === 'section').map((e) => e.s);
  check(JSON.stringify(sections) === JSON.stringify(expectedSections), `sections ${sections.join(',')} vs page ${expectedSections.join(',')}`);
  check(expectedSections.length === 13, `page has ${expectedSections.length} funnel blocks, expected 13`);
  const depths = events.filter((e) => e.k === 'depth').map((e) => e.n);
  check(JSON.stringify(depths) === '[25,50,75,100]', `depth ${depths.join(',')}`);
  const clicks = events.filter((e) => e.k === 'click');
  check(clicks.some((e) => e.id === 'plan-signature-start' && e.s === 'pricing' && e.el === 'cta' && !e.host), `pricing CTA click missing: ${JSON.stringify(clicks)}`);
  check(clicks.some((e) => /^app\.guest-ly\.com\//.test(e.id) && e.s === 'nav' && e.el === 'link' && e.host === 'app.guest-ly.com'), `nav login click missing: ${JSON.stringify(clicks)}`);
  check(clicks.some((e) => e.id === 'faq-a-0' && e.s === 'faq' && e.el === 'button'), `FAQ question click missing: ${JSON.stringify(clicks)}`);
  check(clicks.some((e) => e.id === '/#pricing' && e.s === 'coordinator' && e.el === 'link' && !e.host), `coordinator pricing link missing: ${JSON.stringify(clicks)}`);
  const steps = events.filter((e) => e.k === 'wizard_step').map((e) => e.n);
  check(JSON.stringify(steps) === '[1,2]', `wizard steps ${steps.join(',')}`);
  const chats = events.filter((e) => e.k === 'demo_chat').map((e) => e.n);
  check(JSON.stringify(chats) === '[1]', `demo_chat ${chats.join(',')}`);
  const leaves = events.filter((e) => e.k === 'leave');
  check(leaves.length === 1 && kinds.at(-1) === 'leave', `leave events ${leaves.length}, last kind ${kinds.at(-1)}`);
  check(leaves[0]?.d === 100 && leaves[0]?.n > 0, `leave ${JSON.stringify(leaves[0])}`);

  const jar = await ctx.cookies();
  check(jar.length === 1 && jar[0].name === 'portal_session', `cookie jar after visit: ${jar.map((c) => c.name).join(',')}`);
  console.log(`test-beacon A: ${batches.length} batches, ${events.length} events, ${sections.length} sections, chunk ${chunkGzip} B gzip`);
  await ctx.close();
}

/* ---------- B. phone visit, clean browser: nothing kept ---------- */
{
  hits.length = 0;
  stubSetsCookie = false;
  const ctx = await newContext(PHONE);
  const page = await ctx.newPage();
  const setCookies = [];
  page.on('response', async (res) => {
    const h = await res.allHeaders().catch(() => ({}));
    if (h['set-cookie']) setCookies.push(res.url());
  });
  await page.goto(`${ON}/`, { waitUntil: 'load' });
  await waitFor(() => beaconHits().length > 0, 9000, 'the phone view');
  await scrollToEnd(page);
  const storage = async () =>
    page.evaluate(async () => ({
      local: localStorage.length,
      session: sessionStorage.length,
      idb: indexedDB.databases ? (await indexedDB.databases()).length : 0,
      cookie: document.cookie,
    }));
  const home = await storage();
  check(home.local === 0 && home.session === 0 && home.idb === 0 && home.cookie === '', `storage after the home visit: ${JSON.stringify(home)}`);

  await page.goto(`${ON}/privacy/`, { waitUntil: 'load' });
  await waitFor(() => batchesOf(beaconHits()).some((b) => b.path === '/privacy/'), 9000, 'the privacy view');
  const privacy = await storage();
  check(privacy.local === 0 && privacy.session === 0 && privacy.idb === 0 && privacy.cookie === '', `storage on privacy: ${JSON.stringify(privacy)}`);
  check((await page.locator('h2', { hasText: 'Visit counts' }).count()) === 1, 'privacy page lacks the visit-counts paragraph while the beacon is on');
  check((await ctx.cookies()).length === 0, 'cookie jar not empty after a phone visit');
  check(setCookies.length === 0, `Set-Cookie on: ${setCookies.join(', ')}`);

  /* Language of the moment: switch to ES (this stores the visitor's own
     language choice, a preference the site had before #23), then a click. */
  await page.locator('.legal-page__toggles .lang-toggle button', { hasText: 'ES' }).click();
  check((await page.locator('h2', { hasText: 'Conteo de visitas' }).count()) === 1, 'privacy page lacks the ES visit-counts paragraph');
  await page.locator('.legal-page__back').click();
  await page.waitForURL(`${ON}/`);
  await waitFor(() => batchesOf(beaconHits()).some((b) => b.path === '/privacy/' && b.events.some((e) => e.k === 'click' && e.s === 'legal')), 5000, 'the back-home click');

  const batches = batchesOf(beaconHits());
  batches.forEach((b, i) => validateBatch(b, `B batch ${i}`));
  check(batches.every((b) => b.device === 'phone'), 'device is not phone at 390');
  const homeClick = batches.flatMap((b) => b.events).find((e) => e.k === 'click' && e.s === 'legal');
  check(homeClick?.lang === 'es' && homeClick?.id === '/' && homeClick?.el === 'link', `back-home click ${JSON.stringify(homeClick)}`);
  console.log(`test-beacon B: ${batches.length} batches on the phone, storage and cookies empty`);
  await ctx.close();
}

/* ---------- C. Do Not Track, Global Privacy Control, automation ---------- */
for (const [label, flags] of [
  ['Do Not Track', { dnt: true }],
  ['Global Privacy Control', { gpc: true }],
  ['navigator.webdriver', { webdriver: true }],
]) {
  hits.length = 0;
  const ctx = await newContext(DESKTOP, flags);
  const page = await ctx.newPage();
  await page.goto(`${ON}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await scrollToEnd(page);
  await page.locator('[data-track="nav-start"]').click();
  await page.waitForTimeout(5800);
  await page.goto(`${ON}/privacy/`, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  check(hits.length === 0, `${label}: ${hits.length} requests reached the stub`);
  await ctx.close();
}
console.log('test-beacon C: nothing sent with Do Not Track, Global Privacy Control or webdriver');

/* ---------- D. URL-empty build (today) ---------- */
{
  hits.length = 0;
  const ctx = await newContext(DESKTOP);
  const page = await ctx.newPage();
  const requested = [];
  page.on('request', (r) => requested.push(r.url()));
  await page.goto(`${OFF}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await scrollToEnd(page);
  await page.locator('[data-track="nav-start"]').click();
  await page.waitForTimeout(5800);
  await page.goto(`${OFF}/privacy/`, { waitUntil: 'load' });
  check(hits.length === 0, `URL-empty build: ${hits.length} requests reached the stub`);
  check(!requested.some((u) => /beacon-/.test(u)), 'URL-empty build requested a beacon chunk');
  check(requested.every((u) => u.startsWith(OFF) || u.startsWith('data:')), `URL-empty build left the site: ${requested.filter((u) => !u.startsWith(OFF)).join(', ')}`);
  check((await page.locator('h2', { hasText: 'Visit counts' }).count()) === 0, 'URL-empty build shows the visit-counts paragraph');
  await ctx.close();
  console.log('test-beacon D: the URL-empty build has no beacon, requests none, sends nothing');
}

check(consoleErrors.length === 0, `console or page errors: ${consoleErrors.slice(0, 5).join(' | ')}`);

await browser.close();
stub.close();
onServer.close();
offServer.close();
rmSync(work, { recursive: true, force: true });

if (failures.length) {
  for (const f of failures) console.error(`test-beacon: ${f}`);
  process.exit(1);
}
console.log('test-beacon clean');

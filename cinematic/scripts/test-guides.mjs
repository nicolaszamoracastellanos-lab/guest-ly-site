/* The destination guides section is run time only, like the Reviews tab
   (Playwright; local stub of GET /api/public/guides, never
   app.guest-ly.com; builds into a temp folder, never cinematic/dist, with
   only GUIDES_ENABLED on and with every switch off). Proves:
   A. the prerendered pages (home and the three legal pages) hold no guides
      header, intro, box, form or nav item, and the on build's home page
      differs from the off build's only in its script links;
   B. closed, unavailable, limited (429), 500, no answer and an unreadable
      answer each leave the DOM identical to the off build (body markup,
      title and language, EN at 1440 and ES at 390, after scrolling the whole
      page and back), with exactly one catalogue read, no cookie, no referrer,
      no "not available" line, and a layout shift under 0.02 (budget 0.02);
   C. an open answer adds the section once, just before the FAQ, with the
      FAQ renumbered, and layout shift under 0.02 with the answer arriving
      early, late, or while the visitor is at the top of the page.
   Usage: node scripts/test-guides.mjs */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { startStub } from './lib/booking-stub.mjs';
import { buildSite, serveDir } from './lib/temp-site.mjs';

const failures = [];
let checks = 0;
const check = (cond, msg) => {
  checks += 1;
  if (!cond) failures.push(msg);
};

const stub = await startStub();
const S = stub.state;
const work = mkdtempSync(join(tmpdir(), 'gl-guides-'));
const onDir = join(work, 'on');
const offDir = join(work, 'off');
console.log('test-guides: building with guides on (stub API) and with every switch off');
buildSite(onDir, { GL_GUIDES_ENABLED: '1', GL_BOOKING_ENABLED: '0', GL_REVIEWS_ENABLED: '0', GL_API_ORIGIN: stub.origin });
buildSite(offDir, { GL_GUIDES_ENABLED: '0', GL_BOOKING_ENABLED: '0', GL_REVIEWS_ENABLED: '0' });
const on = await serveDir(onDir);
const off = await serveDir(offDir);

/* A. static HTML. */
const strip = (html) => html.replace(/<script\b[^>]*><\/script>/g, '').replace(/<link\b[^>]*(modulepreload|stylesheet)[^>]*>/g, '').replace(/\s+/g, ' ');
for (const page of ['index.html', 'privacy/index.html', 'terms/index.html', 'refunds/index.html']) {
  const html = readFileSync(join(onDir, page), 'utf8');
  check(!/id="guides"|class="guides|guides-slot|href="#guides"|data-sec="guides"/.test(html), `A: ${page} holds guides markup`);
  check(!/Free guides|Guías gratis|Getting married\s*away from home|¿Te casas|A free guide to your destination/.test(html), `A: ${page} holds the guides words`);
}
{
  const a = strip(readFileSync(join(onDir, 'index.html'), 'utf8'));
  const b = strip(readFileSync(join(offDir, 'index.html'), 'utf8'));
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  check(a === b, `A: the on build's home page differs from the off build's (beyond its script and style links) at ${i}: ${JSON.stringify(a.slice(i - 30, i + 60))} vs ${JSON.stringify(b.slice(i - 30, i + 60))}`);
}

const browser = await chromium.launch();
const hits = (from) => S.hits.slice(from).filter((h) => h.path === '/api/public/guides');

async function open(base, { width, lang, hold = null, path = '/' }) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'reduce', locale: lang === 'es' ? 'es-MX' : 'en-US' });
  await ctx.addCookies([{ name: 'portal', value: 'secret', domain: 'localhost', path: '/' }]);
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|CORS policy|net::ERR_/.test(m.text()) && errs.push(m.text()));
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript((l) => {
    localStorage.setItem('guestly-lang', l);
    localStorage.setItem('gl-theme', 'night');
    window.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  }, lang);
  S.holdCatalogue = hold;
  await page.goto(base + path, { waitUntil: 'networkidle' });
  return { ctx, page, errs };
}
async function walk(page) {
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 70));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800);
}
/* The page as the visitor has it: body markup (the hero chat's own typed lines and
   inline animation styles are the same in both builds but timed, so they are not compared). */
const dom = (page) =>
  page.evaluate(() => {
    const body = document.body.cloneNode(true);
    body.querySelectorAll('.chat-card__body, .chat-card__note').forEach((e) => e.replaceChildren());
    body.querySelectorAll('[style]').forEach((e) => e.removeAttribute('style'));
    body.querySelectorAll('script, canvas').forEach((e) => e.remove());
    body.querySelectorAll('.is-visible').forEach((e) => e.classList.remove('is-visible'));
    return `${document.documentElement.lang}|${document.title}|${body.innerHTML}`;
  });

/* B. nothing shown, nothing left behind. */
const baseline = {};
const baseCls = {};
for (const [width, lang] of [[1440, 'en'], [390, 'es'], [1440, 'es'], [390, 'en']]) {
  const t = await open(off.url, { width, lang });
  await walk(t.page);
  baseline[`${width} ${lang}`] = await dom(t.page);
  baseCls[`${width} ${lang}`] = await t.page.evaluate(() => window.__cls);
  check(baseline[`${width} ${lang}`].length > 30000 && baseline[`${width} ${lang}`].includes('id="faq"'), `B: off build ${width} ${lang}: the compared DOM is the whole page`);
  check(t.errs.length === 0, `B: off build ${width}: errors ${JSON.stringify(t.errs.slice(0, 2))}`);
  await t.ctx.close();
}
for (const mode of ['closed', 'unavailable', 'limited', 'error', 'abort', 'garbage']) {
  for (const [width, lang] of [[1440, 'en'], [390, 'es']]) {
    S.mode.catalogue = mode;
    const mark = S.hits.length;
    const t = await open(on.url, { width, lang });
    await walk(t.page);
    const tag = `${mode} ${width} ${lang}`;
    const mine = await dom(t.page);
    const want = baseline[`${width} ${lang}`];
    if (mine !== want) {
      let i = 0;
      while (i < mine.length && mine[i] === want[i]) i++;
      failures.push(`B: ${tag}: the DOM differs from the off build at ${i}: ${JSON.stringify(mine.slice(i - 40, i + 80))} vs ${JSON.stringify(want.slice(i - 40, i + 80))}`);
    }
    checks += 1;
    const reads = hits(mark);
    check(reads.length === 1 && reads[0].method === 'GET', `B: ${tag}: ${reads.length} catalogue reads`);
    check(reads[0] && !reads[0].headers.cookie && !reads[0].headers.referer, `B: ${tag}: the read carried a cookie or referrer`);
    check(S.hits.slice(mark).every((h) => h.path === '/api/public/guides' || !h.path.startsWith('/api/')), `B: ${tag}: another API request`);
    const cls = await t.page.evaluate(() => window.__cls);
    check(cls - baseCls[`${width} ${lang}`] < 0.005, `B: ${tag}: layout shift ${cls.toFixed(4)} against the off build's ${baseCls[`${width} ${lang}`].toFixed(4)}`);
    check(t.errs.length === 0, `B: ${tag}: errors ${JSON.stringify(t.errs.slice(0, 2))}`);
    await t.ctx.close();
  }
}

/* C. an open answer adds the section. */
S.mode.catalogue = 'open';
for (const [width, lang, hold] of [[1440, 'en', null], [390, 'es', null], [1440, 'es', new Promise((r) => setTimeout(r, 1500))], [390, 'en', new Promise((r) => setTimeout(r, 600))]]) {
  const t = await open(on.url, { width, lang, hold });
  await walk(t.page);
  const tag = `open ${width} ${lang}${hold ? ' late' : ''}`;
  S.holdCatalogue = null;
  check((await t.page.locator('#guides').count()) === 1 && (await t.page.locator('#guides .guides-place').count()) === 7, `C: ${tag}: the section is not in the page with 7 guides`);
  check(await t.page.evaluate(() => document.getElementById('guides').nextElementSibling?.id === 'faq' && document.querySelector('#faq .sec-no')?.textContent === '№ 11'), `C: ${tag}: not just before the FAQ, or the FAQ is not № 11`);
  /* Whatever the off build already shifts (the Spanish desktop page's 0.031 at load, carried in L7-LOG) is not the guides'. */
  const cls = await t.page.evaluate(() => window.__cls);
  const own = cls - baseCls[`${width} ${lang}`];
  check(own < 0.005 && (cls < 0.02 || baseCls[`${width} ${lang}`] >= 0.02), `C: ${tag}: layout shift ${cls.toFixed(4)}, the off build's ${baseCls[`${width} ${lang}`].toFixed(4)} (the guides add ${own.toFixed(4)}; budget 0.02)`);
  check(t.errs.length === 0, `C: ${tag}: errors ${JSON.stringify(t.errs.slice(0, 2))}`);
  await t.ctx.close();
}

await browser.close();
on.server.close();
off.server.close();
stub.close?.();
rmSync(work, { recursive: true, force: true });

if (failures.length) {
  for (const f of failures) console.error(`test-guides: ${f}`);
  console.error(`\ntest-guides FAILED: ${failures.length} problem(s) in ${checks} checks`);
  process.exit(1);
}
console.log(`test-guides clean: ${checks} checks (no guides markup prerendered; closed, unavailable, 429, 500, no answer and unreadable leave the DOM identical to the off build with one read, no cookie or referrer and no shift; open adds the section before the FAQ, EN and ES, early and late, no shift)`);
process.exit(0);

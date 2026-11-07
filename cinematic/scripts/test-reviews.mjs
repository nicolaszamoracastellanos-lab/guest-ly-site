/* The Reviews tab on the landing (Playwright), against a local stub of
   GET /api/public/reviews (scripts/lib/reviews-stub.mjs), never
   app.guest-ly.com. Builds the page twice into a temp folder (never
   cinematic/dist): REVIEWS_ENABLED on (API pointed at the stub on
   127.0.0.1, another origin than the page on localhost, like guest-ly.com
   and app.guest-ly.com) and off (today's build). Proves:
   ON
   A. prerendered page: no section, nav item, review or rating JSON-LD;
      after load exactly one read (GET ?limit=6, no cookie although one is
      planted for the API host, no Referer, an Origin); the section shows
      the API's average and count as given, the six reviews in the API's
      order (low rating included), names translate="no", months through
      Intl, no month line for a review without one, the "most recent" note;
      stars carry a role="img" label and differ in shape (filled vs outline);
      the nav item is last in the phone menu, right after "FAQ", and the
      desktop row has none; the Product JSON-LD gains
      aggregateRating and the six Reviews; the stub's Set-Cookie is not kept;
      layout shift 0.
   B. ES at 390 (touch): ES words and months, the menu's last link
      "Reseñas", 44 px tall, takes the visitor to the section; no sideways
      scroll; switching language in place swaps every label. Short phones
      (review round 2): with the seventh link the open menu at 390x664,
      375x667, 360x640 and 375x548, EN and ES, has no item under the bar and
      the order button on screen or reachable by scrolling the menu.
   C. one review: "based on 1 review", no note; two reviews: no note.
   D. zero, closed, unavailable, wrong version, 401 without CORS (today's
      proxy answer), 429, 500, unreadable: no section, no nav item, the
      JSON-LD as built, one read only.
   E. visitor already at the end when the answer arrives: the section goes in
      once scrolling stops, the final call to action stays where it was on
      screen, layout shift under 0.001.
   F. the section's place on screen when the answer arrives: nothing goes in
      while it is in view; it goes in once the place is below the screen,
      with no shift.
   G. menu open at 390 when the answer arrives: nothing until it closes.
   H. keyboard at 1000 (burger): Enter opens the menu, Tab reaches "Reviews"
      right after "FAQ", Enter moves to #reviews.
   J. desktop row (review round 1): at 1440 and 1200, EN and ES, the row
      with reviews shown and with today's 401 equals the off build's row
      (every link and the login link at the same x and size).
   K. deep link (review round 1): /#reviews opened at 390 ES and 1440 EN and
      ES puts the section header at the top of the screen; a reload after
      the menu link (390) or right after the deep link (1440) does too; a
      change of the hash to #reviews before the answer does too; a wheel
      before the answer cancels the jump (no script scroll, no shift).
      Review round 2: the address keeps #reviews after the visitor moved
      on, so a reload after wheeling up to Pricing (390, 1440) leaves the
      page where the browser put it back (within 1 px, Pricing on screen),
      and Back from /privacy after the footer (1440) keeps the footer where
      it was on screen, with a 1.5 s answer.
   OFF
   I. no section, nav item, chunk, CSS or read after scrolling the page.
   Layout shift: every shift but the hero demo chat's own bubbles (the same
   in the off build) counts.
   No console error or page error anywhere (the browser's own "Failed to
   load resource" and CORS lines for the refused answers excluded).
   Usage: node scripts/test-reviews.mjs */

import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';
import { startReviewsStub, REVIEWS } from './lib/reviews-stub.mjs';
import { buildSite, serveDir } from './lib/temp-site.mjs';
import { INITIAL_JS_BUDGET, initialJs } from './lib/initial-js.mjs';
import { FOCUS_VIEWS, MENU_VIEWS, menuFocusProblems, menuProblems } from './lib/menu-fit.mjs';

const failures = [];
let checks = 0;
const check = (cond, msg) => {
  checks += 1;
  if (!cond) failures.push(msg);
};

const stub = await startReviewsStub();
const S = stub.state;
const work = mkdtempSync(join(tmpdir(), 'gl-reviews-'));
const onDir = join(work, 'on');
const offDir = join(work, 'off');
console.log('test-reviews: building with the Reviews tab on (stub API) and off');
buildSite(onDir, { GL_REVIEWS_ENABLED: '1', GL_BOOKING_ENABLED: '0', GL_GUIDES_ENABLED: '0', GL_API_ORIGIN: stub.origin });
buildSite(offDir, { GL_REVIEWS_ENABLED: '0', GL_BOOKING_ENABLED: '0', GL_GUIDES_ENABLED: '0' });
const on = await serveDir(onDir);
const off = await serveDir(offDir);

/* Build contents. */
const files = (dir) => readdirSync(join(dir, 'assets'));
const chunk = files(onDir).filter((f) => /^ReviewsTab-.*\.js$/.test(f));
check(chunk.length === 1, `on: expected one ReviewsTab chunk, found ${chunk.length}`);
const chunkGz = chunk.reduce((n, f) => n + gzipSync(readFileSync(join(onDir, 'assets', f)), { level: 9 }).length, 0);
check(chunkGz > 0 && chunkGz <= 5000, `reviews chunk ${chunkGz} B gzip (budget 5 KB)`);
check(files(offDir).every((f) => !/^ReviewsTab-/.test(f)), 'off: a ReviewsTab chunk or stylesheet is in the build');
const offText = files(offDir).map((f) => readFileSync(join(offDir, 'assets', f), 'utf8')).join('\n');
check(!offText.includes('/api/public/reviews') && !offText.includes('Reseñas') && !offText.includes('reviews-score'), 'off: reviews code, words or CSS in the build');
const allOn = files(onDir).map((f) => readFileSync(join(onDir, 'assets', f), 'utf8')).join('\n') + readFileSync(join(onDir, 'index.html'), 'utf8');
for (const r of REVIEWS) check(!allOn.includes(r.text) && !allOn.includes(r.name), `on: the build carries fixture text of ${r.id}`);
const initial = { off: initialJs(offDir).bytes, on: initialJs(onDir).bytes };
check(initial.on <= INITIAL_JS_BUDGET, `on: initial JS ${initial.on} B gzip over ${INITIAL_JS_BUDGET}`);
const onHtml = readFileSync(join(onDir, 'index.html'), 'utf8');
check(!/id="reviews"|href="#reviews"|AggregateRating|"Review"/.test(onHtml), 'on: the prerendered page holds the Reviews tab or a rating');

const browser = await chromium.launch();
const consoleErrors = [];
const NOISE = /Failed to load resource|CORS policy|net::ERR_/;

async function open(url, { width = 1440, height = 900, lang = 'en', touch = false, mode = 'open', hold = 0, path = '/', before } = {}) {
  stub.reset();
  S.mode = mode;
  S.hold = hold;
  const ctx = await browser.newContext({ viewport: { width, height }, ...(touch ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.addCookies([{ name: 'portal', value: 'secret', domain: '127.0.0.1', path: '/' }]);
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' && !NOISE.test(m.text())) consoleErrors.push(`${mode} ${width}: ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleErrors.push(`${mode} ${width}: page error ${e.message}`));
  await page.addInitScript((l) => {
    localStorage.setItem('guestly-lang', l);
    window.__cls = 0;
    new PerformanceObserver((list) => {
      /* The hero's demo chat moves its own bubbles (ambience, the same in
         the off build); every other shift counts. */
      for (const e of list.getEntries())
        if (!e.hadRecentInput && !e.sources.every((s) => s.node?.closest?.('.chat-card'))) window.__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  }, lang);
  if (before) await before(page);
  await page.goto(url + path, { waitUntil: 'load' });
  return { ctx, page };
}
const hits = () => S.hits.filter((h) => h.path === '/api/public/reviews' && h.method === 'GET');
const waitHit = async (page, n = 1) => {
  for (let i = 0; i < 100 && hits().length < n; i++) await page.waitForTimeout(50);
};
const shown = (page) => page.locator('#reviews').count();
const cls = (page) => page.evaluate(() => window.__cls);
const productLd = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent)).find((b) => b['@type'] === 'Product'),
  );

/* A. */
{
  const { ctx, page } = await open(on.url);
  await page.waitForSelector('#reviews', { timeout: 8000 }).catch(() => {});
  check((await shown(page)) === 1, 'A: the section did not appear');
  check(hits().length === 1, `A: expected one read, saw ${hits().length}`);
  const h = hits()[0];
  check(h?.query === '?limit=6', `A: query ${h?.query}`);
  check(h && !h.headers.cookie, `A: the read carried a cookie: ${h?.headers.cookie}`);
  check(h && !h.headers.referer, 'A: the read carried a Referer');
  check(h?.headers.origin === on.url, `A: Origin ${h?.headers.origin}`);
  const r = await page.evaluate(() => {
    const sec = document.querySelector('#reviews');
    const cards = [...sec.querySelectorAll('.review')];
    return {
      no: sec.querySelector('.sec-no')?.textContent,
      h2: sec.querySelectorAll('h2').length,
      score: sec.querySelector('.reviews-score')?.textContent,
      names: cards.map((c) => c.querySelector('.proof__names').textContent),
      translate: cards.every((c) => c.querySelector('.proof__names').getAttribute('translate') === 'no'),
      months: cards.map((c) => c.querySelector('.proof__place')?.textContent ?? null),
      labels: cards.map((c) => c.querySelector('[role="img"]').getAttribute('aria-label')),
      fills: cards.map((c) => c.querySelectorAll('.reviews-star__fill').length),
      lines: cards.map((c) => c.querySelectorAll('.reviews-star__line').length),
      hidden: [...sec.querySelectorAll('.reviews-stars')].every((s) => s.getAttribute('aria-hidden') === 'true'),
      note: sec.querySelector('.reviews-note')?.textContent,
      nav: [...document.querySelectorAll('.nav__links a')].map((a) => a.textContent),
      menu: [...document.querySelectorAll('.nav__menu-links a')].map((a) => a.textContent),
      afterFaq: sec.previousElementSibling?.id,
      beforeFinal: sec.nextElementSibling?.dataset.sec,
      visible: getComputedStyle(sec.querySelector('.sec-head')).opacity,
    };
  });
  check(r.no === '№ 11', `A: section number ${r.no}`);
  check(r.h2 === 1, 'A: one h2');
  check(r.score === '4.3out of 5, based on 12 reviews', `A: score line "${r.score}"`);
  check(JSON.stringify(r.names) === JSON.stringify(REVIEWS.map((x) => x.name)), `A: names/order ${r.names}`);
  check(r.translate, 'A: a name without translate="no"');
  check(r.months[0] === 'Wedding in November 2026' && r.months[3] === null, `A: months ${r.months}`);
  check(JSON.stringify(r.labels) === JSON.stringify(REVIEWS.map((x) => `${x.rating} out of 5 stars`)), `A: star labels ${r.labels}`);
  check(JSON.stringify(r.fills) === JSON.stringify(REVIEWS.map((x) => x.rating)) && r.lines.every((n) => n === 5), `A: star shapes ${r.fills} / ${r.lines}`);
  check(r.hidden, 'A: a star row is not aria-hidden');
  check(r.note === 'The 6 most recent of 12 reviews.', `A: note "${r.note}"`);
  check(!r.nav.includes('Reviews') && r.nav.at(-1) === 'FAQ', `A: desktop row ${r.nav}`);
  const at = r.menu.indexOf('Reviews');
  check(at > 0 && r.menu[at - 1] === 'FAQ', `A: menu ${r.menu}`);
  check(r.afterFaq === 'faq' && r.beforeFinal === 'final', `A: place ${r.afterFaq} / ${r.beforeFinal}`);
  check(r.visible === '1', `A: header opacity ${r.visible}`);
  const ld = await productLd(page);
  check(JSON.stringify(ld?.aggregateRating) === JSON.stringify({ '@type': 'AggregateRating', ratingValue: 4.3, reviewCount: 12, bestRating: 5, worstRating: 1 }), `A: aggregateRating ${JSON.stringify(ld?.aggregateRating)}`);
  check(ld?.review?.length === 6 && ld.review[3].reviewRating.ratingValue === 2 && ld.offers?.length === 3, 'A: Review list or offers wrong in the JSON-LD');
  check((await ctx.cookies()).every((c) => c.name !== 'stub'), 'A: the stub cookie was kept');
  check((await cls(page)) === 0, `A: layout shift ${await cls(page)}`);
  await ctx.close();
}

/* B. */
{
  const { ctx, page } = await open(on.url, { width: 390, height: 844, lang: 'es', touch: true });
  await page.waitForSelector('#reviews', { timeout: 8000 }).catch(() => {});
  const r = await page.evaluate(() => ({
    score: document.querySelector('.reviews-score')?.textContent,
    month: document.querySelector('.review .proof__place')?.textContent,
    label: document.querySelector('.review [role="img"]')?.getAttribute('aria-label'),
    kicker: document.querySelector('#reviews .sec-kicker')?.textContent,
    wide: document.documentElement.scrollWidth,
  }));
  check(r.score === '4.3de 5, según 12 reseñas', `B: score "${r.score}"`);
  check(r.month === 'Boda en noviembre de 2026', `B: month "${r.month}"`);
  check(r.label === '5 de 5 estrellas' && r.kicker === 'Reseñas', `B: ${r.label} / ${r.kicker}`);
  check(r.wide <= 390, `B: page ${r.wide}px wide at 390`);
  await page.locator('.nav__burger').click();
  const link = page.locator('.nav__menu-links a', { hasText: 'Reseñas' });
  check((await link.count()) === 1, 'B: no "Reseñas" in the menu');
  const box = await link.boundingBox();
  check(box && box.height >= 44, `B: menu link ${box?.height}px tall`);
  await link.click();
  await page.waitForTimeout(400);
  const top = await page.evaluate(() => document.querySelector('#reviews').getBoundingClientRect().top);
  check(Math.abs(top - 80) < 40, `B: the menu link left the section at ${top}px`);
  await page.locator('.lang-toggle--bar button', { hasText: 'EN' }).click();
  const en = await page.evaluate(() => [document.querySelector('#reviews .sec-kicker').textContent, document.querySelector('.review .proof__place').textContent]);
  check(en[0] === 'Reviews' && en[1] === 'Wedding in November 2026', `B: language switch left ${en}`);
  await ctx.close();
}
for (const lang of ['en', 'es'])
  for (const [width, height] of MENU_VIEWS) {
    const { ctx, page } = await open(on.url, { width, height, lang, touch: true });
    await page.waitForSelector('.nav__menu-links a[href="#reviews"]', { state: 'attached', timeout: 8000 }).catch(() => {});
    check((await page.locator('.nav__menu-links a[href="#reviews"]').count()) === 1, `B menu ${lang} ${width}x${height}: no Reviews link`);
    await page.locator('.nav__burger').click();
    await page.waitForTimeout(400);
    const p = await menuProblems(page);
    check(p.length === 0, `B menu ${lang} ${width}x${height}: ${p.join('; ')}`);
    await ctx.close();
  }
/* Review round 3: Tab down and Shift+Tab back up a menu that scrolls; no
   focused item under the solid bar (WCAG 2.4.11). */
for (const lang of ['en', 'es'])
  for (const [width, height] of FOCUS_VIEWS) {
    const { ctx, page } = await open(on.url, { width, height, lang });
    await page.waitForSelector('.nav__menu-links a[href="#reviews"]', { state: 'attached', timeout: 8000 }).catch(() => {});
    await page.locator('.nav__burger').click();
    await page.waitForTimeout(400);
    const f = await menuFocusProblems(page);
    check(f.scrolled, `B keys ${lang} ${width}x${height}: the menu does not scroll, the check proves nothing`);
    check(f.steps >= 14, `B keys ${lang} ${width}x${height}: only ${f.steps} focus steps in the menu`);
    check(f.problems.length === 0, `B keys ${lang} ${width}x${height}: ${f.problems.join('; ')}`);
    await ctx.close();
  }

/* C. */
for (const [mode, score, note] of [
  ['one', '4.0out of 5, based on 1 review', null],
  ['two', '3.5out of 5, based on 2 reviews', null],
]) {
  const { ctx, page } = await open(on.url, { mode });
  await page.waitForSelector('#reviews', { timeout: 8000 }).catch(() => {});
  const r = await page.evaluate(() => [document.querySelector('.reviews-score')?.textContent, document.querySelector('.reviews-note')?.textContent ?? null]);
  check(r[0] === score && r[1] === note, `C ${mode}: ${r}`);
  await ctx.close();
}

/* D. */
for (const mode of ['zero', 'closed', 'unavailable', 'wrong-version', 'unauthorized', 'limited', 'error', 'unreadable']) {
  const { ctx, page } = await open(on.url, { mode });
  await waitHit(page);
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  check(hits().length === 1, `D ${mode}: ${hits().length} reads`);
  check((await shown(page)) === 0, `D ${mode}: the section showed`);
  check((await page.locator('a[href="#reviews"]').count()) === 0, `D ${mode}: a nav item showed`);
  const ld = await productLd(page);
  check(ld && !('aggregateRating' in ld) && !('review' in ld), `D ${mode}: the JSON-LD changed`);
  await ctx.close();
}

/* E. At the end of the page when a slow answer arrives. */
for (const width of [390, 1440]) {
  const { ctx, page } = await open(on.url, { width, height: width < 500 ? 844 : 900, touch: width < 500, hold: 1500 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => document.querySelector('[data-sec="final"]').getBoundingClientRect().top);
  await page.waitForSelector('#reviews', { state: 'attached', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => document.querySelector('[data-sec="final"]').getBoundingClientRect().top);
  check((await shown(page)) === 1, `E ${width}: the section never went in`);
  check(Math.abs(after - before) <= 1, `E ${width}: the final call to action moved ${before} to ${after}`);
  const c = await cls(page);
  check(c < 0.001, `E ${width}: layout shift ${c}`);
  await ctx.close();
}

/* F. The section's place on screen when the answer arrives. */
{
  const { ctx, page } = await open(on.url, { hold: 1200 });
  await page.evaluate(() => {
    const at = document.querySelector('[data-sec="final"]');
    window.scrollTo(0, window.scrollY + at.getBoundingClientRect().top - innerHeight / 2);
  });
  await waitHit(page);
  await page.waitForTimeout(2600);
  check((await shown(page)) === 0, 'F: the section went in while its place was on screen');
  await page.mouse.wheel(0, -1200);
  await page.waitForSelector('#reviews', { state: 'attached', timeout: 4000 }).catch(() => {});
  check((await shown(page)) === 1, 'F: the section never went in after its place left the screen');
  const c = await cls(page);
  check(c < 0.001, `F: layout shift ${c}`);
  await ctx.close();
}

/* G. Menu open at 390 when the answer arrives. */
{
  const { ctx, page } = await open(on.url, { width: 390, height: 844, touch: true, hold: 1200 });
  await page.locator('.nav__burger').click();
  await waitHit(page);
  await page.waitForTimeout(2600);
  check((await shown(page)) === 0, 'G: the section went in behind the open menu');
  check((await page.locator('.nav__menu-links a[href="#reviews"]').count()) === 0, 'G: the menu grew a link while open');
  await page.locator('.nav__burger').click();
  await page.waitForSelector('#reviews', { state: 'attached', timeout: 4000 }).catch(() => {});
  check((await shown(page)) === 1, 'G: the section never went in after the menu closed');
  await ctx.close();
}

/* H. Keyboard (burger width). */
{
  const { ctx, page } = await open(on.url, { width: 1000, height: 800 });
  await page.waitForSelector('#reviews', { state: 'attached', timeout: 8000 }).catch(() => {});
  await page.locator('.nav__burger').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  let label = '';
  for (let i = 0; i < 20 && label !== 'FAQ'; i++) {
    await page.keyboard.press('Tab');
    label = await page.evaluate(() => document.activeElement?.textContent ?? '');
  }
  await page.keyboard.press('Tab');
  label = await page.evaluate(() => document.activeElement?.textContent ?? '');
  check(label === 'Reviews', `H: Tab after FAQ reached "${label}"`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  check((await page.evaluate(() => location.hash)) === '#reviews', 'H: Enter did not go to #reviews');
  await ctx.close();
}

/* J. The desktop row is the same with the reviews shown, refused or off. */
{
  const row = async (url, { width, lang, mode, wait }) => {
    const { ctx, page } = await open(url, { width, lang, mode });
    await page.evaluate(() => document.fonts.ready);
    if (wait) await page.waitForSelector('#reviews', { state: 'attached', timeout: 8000 }).catch(() => {});
    else await page.waitForTimeout(1200);
    const r = await page.evaluate(() =>
      [...document.querySelectorAll('.nav__links a, .nav__login')].map((a) => {
        const b = a.getBoundingClientRect();
        return [a.textContent, Math.round(b.left * 2) / 2, Math.round(b.width * 2) / 2, getComputedStyle(a).fontSize].join(':');
      }),
    );
    await ctx.close();
    return r.join(' ');
  };
  for (const width of [1440, 1200])
    for (const lang of ['en', 'es']) {
      const offRow = await row(off.url, { width, lang, mode: 'open' });
      const shownRow = await row(on.url, { width, lang, mode: 'open', wait: true });
      const refusedRow = await row(on.url, { width, lang, mode: 'unauthorized' });
      check(shownRow === offRow, `J ${lang} ${width}: row with reviews\n  ${shownRow}\n  off: ${offRow}`);
      check(refusedRow === offRow, `J ${lang} ${width}: row with 401\n  ${refusedRow}\n  off: ${offRow}`);
    }
}

/* K. Deep links to #reviews. */
const headerAtTop = (page) => page.evaluate(() => Math.round(document.querySelector('#reviews')?.getBoundingClientRect().top ?? -9999));
const settle = async (page) => {
  await page.waitForSelector('#reviews', { state: 'attached', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
};
for (const [width, lang] of [[390, 'es'], [1440, 'en'], [1440, 'es']]) {
  const { ctx, page } = await open(on.url, { width, height: width < 500 ? 844 : 900, touch: width < 500, lang, path: '/#reviews' });
  await settle(page);
  const top = await headerAtTop(page);
  check(Math.abs(top - 80) < 40, `K ${lang} ${width}: /#reviews left the section at ${top}px`);
  const c = await cls(page);
  await ctx.close();
  /* The same address on the off build: what the page shifts without the
     tab (ES at 1440 shifts 0.0311 as the Spanish words replace the English
     snapshot at start, before any review; carried, not this tab's). */
  const o = await open(off.url, { width, height: width < 500 ? 844 : 900, touch: width < 500, lang, path: '/#reviews' });
  await o.page.waitForTimeout(1200);
  const base = await cls(o.page);
  await o.ctx.close();
  check(c - base < 0.001, `K ${lang} ${width}: /#reviews layout shift ${c} (off build ${base})`);
}
/* Review round 3: the deep link at the widths where the final CTA and the
   footer were scored as moved (CLS 0.9 and 0.8958). */
for (const [width, height] of [[1200, 800], [1024, 768]]) {
  const { ctx, page } = await open(on.url, { width, height, path: '/#reviews' });
  await settle(page);
  const top = await headerAtTop(page);
  const c = await cls(page);
  check(Math.abs(top - 80) < 40 && c < 0.001, `K ${width}x${height}: /#reviews section at ${top}px, layout shift ${c}`);
  await ctx.close();
}
{
  /* 390: menu link, then reload. */
  const { ctx, page } = await open(on.url, { width: 390, height: 844, touch: true, lang: 'es' });
  await settle(page);
  await page.locator('.nav__burger').click();
  await page.locator('.nav__menu-links a[href="#reviews"]').click();
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'load' });
  await settle(page);
  const top = await headerAtTop(page);
  check(Math.abs(top - 80) < 40, `K reload after the menu link (390): section at ${top}px`);
  const c = await cls(page);
  check(c < 0.001, `K reload after the menu link (390): layout shift ${c}`);
  await ctx.close();
}
{
  /* 1440: reload right after the deep link, the old scroll comes back. */
  const { ctx, page } = await open(on.url, { path: '/#reviews' });
  await settle(page);
  await page.reload({ waitUntil: 'load' });
  await settle(page);
  const top = await headerAtTop(page);
  check(Math.abs(top - 80) < 40, `K reload right after the deep link (1440): section at ${top}px`);
  const c = await cls(page);
  check(c < 0.001, `K reload right after the deep link (1440): layout shift ${c}`);
  await ctx.close();
}
/* Review round 2: the visitor moved on, the address still says #reviews. */
const pricingTop = (page) => page.evaluate(() => Math.round(document.querySelector('#pricing').getBoundingClientRect().top));
for (const width of [390, 1440]) {
  const { ctx, page } = await open(on.url, { width, height: width < 500 ? 844 : 900, touch: width < 500, path: '/#reviews', hold: 1500 });
  await settle(page);
  /* Back up to Pricing the way a visitor does (wheel), no hash change. */
  for (let i = 0; i < 80; i++) {
    const t = await pricingTop(page);
    if (t > 40 && t < 300) break;
    await page.mouse.wheel(0, t <= 40 ? Math.max(t - 150, -800) : Math.min(t - 150, 800));
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(300);
  const y1 = await page.evaluate(() => scrollY);
  await settle(page);
  check((await shown(page)) === 1, `K reload at Pricing (${width}): the section never went in`);
  const y2 = await page.evaluate(() => scrollY);
  const pt = await pricingTop(page);
  check(Math.abs(y2 - y1) <= 1, `K reload at Pricing (${width}): the page moved ${y1} to ${y2}`);
  check(pt > -200 && pt < (width < 500 ? 844 : 900), `K reload at Pricing (${width}): Pricing at ${pt}px`);
  await ctx.close();
}
{
  /* 1440: footer, /privacy, Back. */
  const { ctx, page } = await open(on.url, { path: '/#reviews', hold: 1500 });
  await settle(page);
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(600);
  await page.goto(on.url + '/privacy', { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.goBack({ waitUntil: 'load' });
  const type = await page.evaluate(() => performance.getEntriesByType('navigation')[0]?.type);
  await page.waitForTimeout(300);
  const f1 = await page.evaluate(() => Math.round(document.querySelector('[data-sec="footer"]').getBoundingClientRect().top));
  await settle(page);
  const f2 = await page.evaluate(() => Math.round(document.querySelector('[data-sec="footer"]').getBoundingClientRect().top));
  check(type === 'back_forward', `K Back from /privacy: navigation type ${type}`);
  check((await shown(page)) === 1, 'K Back from /privacy: the section never went in');
  check(Math.abs(f2 - f1) <= 1 && f2 < 900, `K Back from /privacy: the footer moved ${f1} to ${f2}`);
  await ctx.close();
}
{
  /* The hash changes to #reviews before the answer. */
  const { ctx, page } = await open(on.url, { hold: 1500 });
  await page.evaluate(() => {
    location.hash = '#reviews';
  });
  await settle(page);
  const top = await headerAtTop(page);
  check(Math.abs(top - 80) < 40, `K hashchange before the answer: section at ${top}px`);
  const c = await cls(page);
  check(c < 0.001, `K hashchange before the answer: layout shift ${c}`);
  await ctx.close();
}
{
  /* A wheel before the answer: the visitor moved on, no jump. */
  const { ctx, page } = await open(on.url, { path: '/#reviews', hold: 1500 });
  await page.waitForTimeout(300);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(400);
  const y = await page.evaluate(() => scrollY);
  await settle(page);
  check((await shown(page)) === 1, 'K wheel: the section never went in');
  const y2 = await page.evaluate(() => scrollY);
  check(Math.abs(y2 - y) <= 1, `K wheel: the page jumped ${y} to ${y2}`);
  const c = await cls(page);
  check(c < 0.001, `K wheel: layout shift ${c}`);
  await ctx.close();
}

/* I. Off. */
{
  const { ctx, page } = await open(off.url);
  await page.waitForTimeout(1500);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
  });
  await page.waitForTimeout(1500);
  check(hits().length === 0, `I: the off build read the API ${hits().length} times`);
  check((await shown(page)) === 0 && (await page.locator('a[href="#reviews"]').count()) === 0, 'I: the off build shows the tab');
  await ctx.close();
}

check(consoleErrors.length === 0, `console errors:\n  ${consoleErrors.join('\n  ')}`);

await browser.close();
on.server.close();
off.server.close();
await stub.close();
rmSync(work, { recursive: true, force: true });

if (failures.length) {
  for (const f of failures) console.error(`test-reviews: ${f}`);
  console.error(`\ntest-reviews FAILED: ${failures.length} of ${checks}`);
  process.exit(1);
}
console.log(
  `test-reviews clean: ${checks} checks (prerender holds no review; one read, no cookie or referrer; average and count as given; order, months, star labels and shapes; JSON-LD from the answer; ES and 390 menu; 8 refused answers show nothing; no shift at the end, on screen or behind the menu; keyboard; off build reads nothing). Reviews chunk ${chunkGz} B gzip; initial JS off ${initial.off} B, on ${initial.on} B`,
);

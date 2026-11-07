/* Desktop nav fit (review round 2, Nov 5). The desktop row starts at 1200px
   and is capped at the 1180px container, so the ES row (longest labels,
   "Empezar mi pedido") must fit at every desktop width. Fails when any nav
   child's right edge passes the row's content box, the primary button leaves
   the viewport, or the page scrolls sideways. Also checks 390 (burger row).
   --reviews: for a build with REVIEWS_ENABLED on. The reviews read is
   answered inside the browser (scripts/lib/reviews-stub.mjs, never the real
   API) and every view waits for the "Reviews" / "Reseñas" link (phone menu
   only since review round 1, Nov 7), then checks the desktop row holds no
   Reviews link.
   Phone menu on short screens (review round 2 of the Reviews tab, Nov 7):
   the menu opened at 390x664, 375x667, 360x640 and 375x548, EN and ES
   (scripts/lib/menu-fit.mjs): no item under the bar, and the order button
   inside the screen or reachable by scrolling the menu; with --reviews the
   menu holds the seventh link.
   Usage: node scripts/check-nav-fit.mjs [baseUrl] [--reviews]   (default http://localhost:5199) */

import { chromium } from 'playwright';
import { reviewsBody } from './lib/reviews-stub.mjs';
import { MENU_VIEWS, menuProblems } from './lib/menu-fit.mjs';

const base = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'http://localhost:5199';
const reviews = process.argv.includes('--reviews');
const WIDTHS = [390, 1200, 1240, 1280, 1366, 1440];
const browser = await chromium.launch();
const problems = [];
let checked = 0;

for (const lang of ['en', 'es']) {
  for (const theme of ['night', 'day']) {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.addInitScript(
        ([t, l]) => {
          localStorage.setItem('gl-theme', t);
          localStorage.setItem('guestly-lang', l);
        },
        [theme, lang],
      );
      if (reviews)
        await ctx.route('**/api/public/reviews**', (route) =>
          route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, json: reviewsBody('open') }),
        );
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      if (reviews) {
        const link = await page.waitForFunction(() => document.querySelector('a[href="#reviews"]'), null, { timeout: 8000 }).catch(() => null);
        if (!link) problems.push(`${lang} ${theme} ${width}: the Reviews link never showed`);
        if (await page.locator('.nav__links a[href="#reviews"]').count()) problems.push(`${lang} ${theme} ${width}: a Reviews link in the desktop row`);
      }
      const r = await page.evaluate(() => {
        const inner = document.querySelector('.nav__inner');
        const box = inner.getBoundingClientRect();
        const contentRight = box.right - parseFloat(getComputedStyle(inner).paddingRight);
        const kids = [...inner.children].filter((c) => getComputedStyle(c).display !== 'none');
        const maxRight = Math.max(...kids.map((c) => c.getBoundingClientRect().right));
        const cta = document.querySelector('.nav__actions .btn');
        const ctaShown = cta && cta.getClientRects().length > 0 && getComputedStyle(cta.parentElement).display !== 'none';
        return {
          over: Math.round(maxRight - contentRight),
          ctaRight: ctaShown ? Math.round(cta.getBoundingClientRect().right) : null,
          docW: document.documentElement.scrollWidth,
          cta: cta?.textContent,
        };
      });
      const where = `${lang} ${theme} ${width}`;
      if (r.over > 0) problems.push(`${where}: nav row passes its box by ${r.over}px`);
      if (r.ctaRight !== null && r.ctaRight > width) problems.push(`${where}: "${r.cta}" ends at ${r.ctaRight} in a ${width}px viewport`);
      if (width >= 1200 && r.ctaRight === null) problems.push(`${where}: the nav button is hidden on the desktop row`);
      if (r.docW > width) problems.push(`${where}: page scrolls sideways (${r.docW}px)`);
      checked++;
      await ctx.close();
    }
  }
}
let menus = 0;
for (const lang of ['en', 'es']) {
  for (const [width, height] of MENU_VIEWS) {
    const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.addInitScript((l) => localStorage.setItem('guestly-lang', l), lang);
    if (reviews)
      await ctx.route('**/api/public/reviews**', (route) =>
        route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, json: reviewsBody('open') }),
      );
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const where = `menu ${lang} ${width}x${height}`;
    if (reviews && !(await page.waitForSelector('.nav__menu-links a[href="#reviews"]', { state: 'attached', timeout: 8000 }).catch(() => null)))
      problems.push(`${where}: the Reviews link never showed`);
    await page.locator('.nav__burger').click();
    await page.waitForTimeout(300);
    for (const p of await menuProblems(page)) problems.push(`${where}: ${p}`);
    menus++;
    await ctx.close();
  }
}
await browser.close();

if (problems.length) {
  for (const p of problems) console.error(`check-nav-fit: ${p}`);
  console.error(`\ncheck-nav-fit FAILED: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`check-nav-fit clean${reviews ? ' with the Reviews link (menu only)' : ''}: ${checked} views (EN, ES; night, day; ${WIDTHS.join(', ')}), every nav item inside its row; ${menus} phone menus (${MENU_VIEWS.map((v) => v.join('x')).join(', ')}, EN and ES) clear of the bar with the order button reachable`);

/* Desktop nav fit (review round 2, Nov 5). The desktop row starts at 1200px
   and is capped at the 1180px container, so the ES row (longest labels,
   "Empezar mi pedido") must fit at every desktop width. Fails when any nav
   child's right edge passes the row's content box, the primary button leaves
   the viewport, or the page scrolls sideways. Also checks 390 (burger row).
   Usage: node scripts/check-nav-fit.mjs [baseUrl]   (default http://localhost:5199) */

import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:5199';
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
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
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
await browser.close();

if (problems.length) {
  for (const p of problems) console.error(`check-nav-fit: ${p}`);
  console.error(`\ncheck-nav-fit FAILED: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`check-nav-fit clean: ${checked} views (EN, ES; night, day; ${WIDTHS.join(', ')}), every nav item inside its row`);

/* Platform tour fit (Phase 5 QA, Nov 8). Every vignette, in both micro states,
   must sit inside its pane at phone widths: before this check a nowrap row made
   the budget vignette 551px wide in a 316px card at 390px and its right-hand
   chips were clipped. Opens each tab at 360, 390, 430 and 1440, EN and ES, night
   and day, taps the micro button, and fails when the vignette is wider than
   its pane, anything inside it ends past the pane, it scrolls inside itself,
   or the page scrolls sideways.
   Usage: node scripts/check-tour-fit.mjs [baseUrl]   (default http://localhost:5199) */

import { chromium } from 'playwright';

const base = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'http://localhost:5199';
const WIDTHS = [360, 390, 430, 1440];
const browser = await chromium.launch();
const problems = [];
let checked = 0;

for (const lang of ['en', 'es']) {
  for (const theme of ['night', 'day']) {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, reducedMotion: 'reduce' });
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
      const ids = await page.$$eval('.tour__tabs [role=tab]', (els) => els.map((e) => e.dataset.tab));
      for (const id of ids) {
        await page.evaluate((i) => document.querySelector(`[data-tab="${i}"]`).scrollIntoView({ block: 'center' }), id);
        await page.click(`[data-tab="${id}"]`, { force: true });
        await page.waitForFunction((i) => !document.querySelector(`#tour-pane-${i} .tour__mock[data-pending]`), id, { timeout: 5000 }).catch(() => {});
        for (const state of ['start', 'after the tap']) {
          if (state !== 'start') {
            const btn = await page.$(`#tour-pane-${id} .mock__micro-btn`);
            if (!btn) continue;
            await btn.click({ force: true });
            await page.waitForTimeout(60);
          }
          const r = await page.evaluate((i) => {
            const pane = document.querySelector(`#tour-pane-${i}`);
            const lim = pane.getBoundingClientRect();
            const mock = pane.querySelector('.mock');
            const out = [];
            pane.querySelectorAll('.tour__mock *').forEach((e) => {
              const b = e.getBoundingClientRect();
              if (b.width && (b.right > lim.right + 0.5 || b.left < lim.left - 0.5)) out.push(`${e.className || e.tagName} ends ${Math.round(b.right - lim.right)}px past the pane`);
            });
            return {
              mock: mock ? Math.round(mock.getBoundingClientRect().width) : 0,
              pane: Math.round(lim.width),
              scrolls: mock ? mock.scrollWidth > mock.clientWidth + 1 : false,
              out: out.slice(0, 3),
              docW: document.documentElement.scrollWidth,
            };
          }, id);
          const where = `${lang} ${theme} ${width} ${id} (${state})`;
          if (r.mock > r.pane + 0.5) problems.push(`${where}: vignette is ${r.mock}px in a ${r.pane}px pane`);
          if (r.scrolls) problems.push(`${where}: vignette scrolls inside itself`);
          for (const o of r.out) problems.push(`${where}: ${o}`);
          if (r.docW > width) problems.push(`${where}: page scrolls sideways (${r.docW}px)`);
          checked++;
        }
      }
      await ctx.close();
    }
  }
}
await browser.close();

if (problems.length) {
  console.error(`check-tour-fit FAILED:\n- ${[...new Set(problems)].join('\n- ')}`);
  process.exit(1);
}
console.log(`check-tour-fit clean: ${checked} vignette states (8 panes, both micro states) at ${WIDTHS.join(', ')}px, EN and ES, night and day: every vignette inside its pane, nothing clipped, no sideways scroll`);

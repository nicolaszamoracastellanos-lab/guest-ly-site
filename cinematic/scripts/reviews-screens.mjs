/* Reviews tab state shots for the contact sheet, against the local stub
   (scripts/lib/reviews-stub.mjs, fictional fixtures, never app.guest-ly.com).
   Builds the page with REVIEWS_ENABLED on into a temp folder, serves it and
   shoots, night and day, EN and ES, 390x844 (DPR 3, touch) and 1440x900:
   - reviews-filled-first: the section's first screen (6 reviews, 12 counted,
     a 2-star review, a 60-character name, a 385-character text, no month);
   - reviews-filled-full: the whole section (nav hidden for this shot only);
   - reviews-one: a single review (no "most recent" note);
   - reviews-nav: the nav row at 1440 with "Reviews" / "Reseñas" last, or
     the open menu at 390;
   - reviews-none: zero reviews (the FAQ runs straight into the final call
     to action, nothing reserved; the same for closed, unavailable or a
     failed read).
   Also reports sideways overflow and console errors per shot.
   Usage: node scripts/reviews-screens.mjs <outDir> */

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { startReviewsStub } from './lib/reviews-stub.mjs';
import { buildSite, serveDir } from './lib/temp-site.mjs';

const outDir = resolve(process.argv[2] || 'reviews-shots');
mkdirSync(outDir, { recursive: true });
const stub = await startReviewsStub();
const work = mkdtempSync(join(tmpdir(), 'gl-reviews-shots-'));
buildSite(join(work, 'on'), { GL_REVIEWS_ENABLED: '1', GL_API_ORIGIN: stub.origin });
const site = await serveDir(join(work, 'on'));
const browser = await chromium.launch();
const report = [];

const VPS = [
  { tag: '390', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  { tag: '1440', width: 1440, height: 900 },
];

async function page(vp, theme, lang, mode) {
  stub.reset();
  stub.state.mode = mode;
  const { tag, width, height, ...rest } = vp;
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: theme === 'day' ? 'light' : 'dark', reducedMotion: 'reduce', ...rest });
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.addInitScript(([t, l]) => {
    localStorage.setItem('gl-theme', t);
    localStorage.setItem('guestly-lang', l);
  }, [theme, lang]);
  await p.goto(site.url, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  return { ctx, p, errors, tag };
}

async function shot(p, name, errors, fn) {
  const file = join(outDir, `${name}.png`);
  await fn(file);
  const wide = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  report.push({ name, overflow: wide, errors: [...errors] });
}

for (const vp of VPS) {
  for (const theme of ['night', 'day']) {
    for (const lang of ['en', 'es']) {
      const suffix = `${lang}-${theme}-${vp.tag}`;
      {
        const { ctx, p, errors } = await page(vp, theme, lang, 'open');
        await p.waitForSelector('#reviews', { timeout: 8000 });
        await p.evaluate(() => {
          const el = document.querySelector('#reviews');
          window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 70);
        });
        await p.waitForTimeout(300);
        await shot(p, `reviews-filled-first-${suffix}`, errors, (path) => p.screenshot({ path }));
        await p.addStyleTag({ content: '.nav,.skip-link{visibility:hidden!important}' });
        await shot(p, `reviews-filled-full-${suffix}`, errors, (path) => p.locator('#reviews').screenshot({ path }));
        await p.addStyleTag({ content: '.nav{visibility:visible!important}' });
        await p.evaluate(() => window.scrollTo(0, 0));
        await p.waitForTimeout(200);
        if (vp.width >= 1200) {
          await shot(p, `reviews-nav-${suffix}`, errors, (path) => p.screenshot({ path, clip: { x: 0, y: 0, width: vp.width, height: 90 } }));
        } else {
          await p.locator('.nav__burger').click();
          await p.waitForTimeout(300);
          await shot(p, `reviews-nav-${suffix}`, errors, (path) => p.screenshot({ path }));
        }
        await ctx.close();
      }
      {
        const { ctx, p, errors } = await page(vp, theme, lang, 'one');
        await p.waitForSelector('#reviews', { timeout: 8000 });
        await p.addStyleTag({ content: '.nav,.skip-link{visibility:hidden!important}' });
        await shot(p, `reviews-one-${suffix}`, errors, (path) => p.locator('#reviews').screenshot({ path }));
        await ctx.close();
      }
      {
        const { ctx, p, errors } = await page(vp, theme, lang, 'zero');
        await p.waitForTimeout(2000);
        await p.evaluate(() => {
          const el = document.querySelector('[data-sec="final"]');
          window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - innerHeight / 2);
        });
        await p.waitForTimeout(300);
        await shot(p, `reviews-none-${suffix}`, errors, (path) => p.screenshot({ path }));
        await ctx.close();
      }
    }
  }
}

await browser.close();
site.server.close();
await stub.close();
rmSync(work, { recursive: true, force: true });
const bad = report.filter((r) => r.overflow > 0 || r.errors.length);
for (const r of bad) console.error(`reviews-screens: ${r.name}: overflow ${r.overflow}px, ${r.errors.length} console error(s) ${r.errors.join(' | ')}`);
console.log(`reviews-screens: ${report.length} shots in ${outDir}, ${bad.length} with overflow or console errors`);
process.exit(bad.length ? 1 : 0);

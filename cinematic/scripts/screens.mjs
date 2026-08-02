/* Wave 5 screenshot harness.
   Usage: node scripts/screens.mjs <outDir> <baseUrl> [--themes=night,day] [--langs=en] [--shots=hero,cards,pricing,faq]
   Viewports are fixed by the master prompt: 390x844 and 1440x900. */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const [outDirArg, baseUrl = 'http://localhost:5173'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.replace(/^--/, '').split('=')),
);
const outDir = resolve(outDirArg || 'shots');
const themes = (flags.themes || 'night,day').split(',');
const langs = (flags.langs || 'en').split(',');
const shotNames = flags.shots ? flags.shots.split(',') : null;

const VIEWPORTS = [
  { tag: '390x844', width: 390, height: 844 },
  { tag: '1440x900', width: 1440, height: 900 },
];

/* Each shot scrolls its anchor into view, waits for reveals, screenshots the viewport. */
const SHOTS = [
  { name: 'hero', sel: '#hero' },
  { name: 'hero-chat', sel: '#hero', action: 'wait-chat' },
  { name: 'marquee', sel: '.marquee' },
  { name: 'pillars', sel: '#pillars', optional: true },
  { name: 'pillars-open', sel: '#pillars', optional: true, action: 'expand-pillars' },
  { name: 'cards', sel: '#included', optional: true },
  { name: 'how', sel: '#how' },
  { name: 'pricing', sel: '#pricing' },
  { name: 'founding', sel: '#founding', optional: true },
  { name: 'faq', sel: '#faq' },
  { name: 'faq-open', sel: '#faq', action: 'open-faq' },
  { name: 'cta-footer', sel: 'footer' },
];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  for (const theme of themes) {
    for (const lang of langs) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: theme === 'day' ? 'light' : 'dark',
        reducedMotion: flags.motion ? 'no-preference' : 'reduce',
      });
      const page = await ctx.newPage();
      await page.addInitScript(
        ([t, l]) => {
          try {
            localStorage.setItem('gl-theme', t);
            localStorage.setItem('guestly-lang', l);
          } catch {}
        },
        [theme, lang],
      );
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);

      for (const shot of SHOTS) {
        if (shotNames && !shotNames.includes(shot.name)) continue;
        const el = page.locator(shot.sel).first();
        if ((await el.count()) === 0) {
          if (!shot.optional) console.error(`MISSING selector ${shot.sel} for ${shot.name}`);
          continue;
        }
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(600);
        if (shot.action === 'wait-chat') {
          await page.waitForTimeout(4500); /* mid-conversation state */
        }
        if (shot.action === 'open-faq') {
          const q = page.locator('.faq-q').first();
          if ((await q.count()) > 0) await q.click();
          await page.waitForTimeout(500);
        }
        if (shot.action === 'expand-pillars') {
          for (const b of await page.locator('.pillar__toggle').all()) await b.click();
          await page.waitForTimeout(600);
        }
        await page.screenshot({ path: `${outDir}/${shot.name}-${theme}-${lang}-${vp.tag}.png` });
      }
      await ctx.close();
    }
  }
}

await browser.close();
console.log(`done -> ${outDir}`);

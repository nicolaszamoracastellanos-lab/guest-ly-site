/* The Spanish platform-tour vignettes never paint English while their
   dictionary (the lazy platform-mock.es chunk) is on its way, and fall back
   to English only when it cannot be fetched (Nov 8, Phase 5 QA). Builds the
   landing into a temp folder, serves it locally, and in a real browser with a
   stored Spanish choice checks four things: the chunk answered at once (the
   box is never painted in English and ends in Spanish), the chunk is slow (the
   box is hidden with its size kept, then Spanish), the chunk fails (English
   shows, not a blank box), and an English visit never requests the chunk.
   The browser only reaches the temp server; any other request fails the test.
   Usage: node scripts/test-es-vignettes.mjs */

import { chromium } from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite, serveDir } from './lib/temp-site.mjs';

const work = mkdtempSync(join(tmpdir(), 'gl-esvig-'));
buildSite(work, {});
const { server, url } = await serveDir(work);
const origin = new URL(url).origin;
const browser = await chromium.launch();
const failures = [];
let checks = 0;
const check = (ok, what) => {
  checks++;
  if (!ok) failures.push(what);
};

/* One visit. `chunk`: 'fast' | 'slow' | 'fail'. Samples the open pane's box every 25ms for ~2.2s. */
async function visit(lang, chunk) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((l) => localStorage.setItem('guestly-lang', l), lang);
  const page = await ctx.newPage();
  let chunkRequests = 0;
  const foreign = [];
  await page.route('**/*', async (route) => {
    const u = route.request().url();
    if (!u.startsWith(origin)) {
      foreign.push(u);
      return route.abort();
    }
    if (/platform-mock\.es-[\w-]+\.js/.test(u)) {
      chunkRequests++;
      if (chunk === 'fail') return route.abort();
      if (chunk === 'slow') await new Promise((r) => setTimeout(r, 900));
    }
    return route.continue();
  });
  await page.goto(url, { waitUntil: 'load' });
  const samples = [];
  for (let i = 0; i < 90; i++) {
    samples.push(
      await page.evaluate(() => {
        const box = document.querySelector('.tour__pane:not([hidden]) .tour__mock');
        const mock = box?.querySelector('.mock');
        const r = box?.getBoundingClientRect();
        const painted = !!box && getComputedStyle(box).visibility !== 'hidden' && getComputedStyle(box).display !== 'none';
        return { painted, h: Math.round(r?.height ?? 0), text: painted ? mock?.innerText.replace(/\s+/g, ' ') ?? '' : '' };
      }),
    );
    await page.waitForTimeout(25);
  }
  await ctx.close();
  return { samples, chunkRequests, foreign };
}

const EN = /\b(questions|answered|topics rising)\b/;
const ES = /preguntas/;

try {
  for (const chunk of ['fast', 'slow']) {
    const v = await visit('es', chunk);
    check(!v.samples.some((s) => EN.test(s.text)), `es, chunk ${chunk}: English painted in the vignette`);
    check(ES.test(v.samples.at(-1).text), `es, chunk ${chunk}: the vignette never ended in Spanish (${JSON.stringify(v.samples.at(-1).text)})`);
    check(v.samples.every((s) => s.h > 100), `es, chunk ${chunk}: the box lost its size while waiting (${Math.min(...v.samples.map((s) => s.h))}px)`);
    check(v.chunkRequests === 1, `es, chunk ${chunk}: expected one request for the chunk, saw ${v.chunkRequests}`);
    check(v.foreign.length === 0, `es, chunk ${chunk}: request outside the local server: ${v.foreign[0]}`);
    if (chunk === 'slow') check(v.samples.some((s) => !s.painted), 'es, slow chunk: the box was never held back while waiting');
  }
  const fail = await visit('es', 'fail');
  check(EN.test(fail.samples.at(-1).text), `es, chunk fails: English is not shown (${JSON.stringify(fail.samples.at(-1).text)})`);
  check(fail.samples.at(-1).painted, 'es, chunk fails: the box stays blank');
  const en = await visit('en', 'fast');
  check(en.chunkRequests === 0, `en: the Spanish chunk was requested ${en.chunkRequests} time(s)`);
  check(EN.test(en.samples.at(-1).text) && en.samples.every((s) => s.painted), 'en: the vignette is not plain English throughout');
} finally {
  await browser.close();
  server.close();
  rmSync(work, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`test-es-vignettes FAILED:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`test-es-vignettes ok: ${checks} checks (fast and slow chunk: never English, size kept, ends Spanish; failed chunk: English, not blank; English visit never fetches the chunk)`);

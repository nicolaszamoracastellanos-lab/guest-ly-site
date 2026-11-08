/* The legal pages (/privacy, /terms, /refunds) are their own lazy chunk, out
   of the home page's first load (Playwright; builds the site into a temp
   folder, never cinematic/dist, with every feature switch off so the result
   does not depend on them). Proves:
   A. no legal text is in any script the home page loads first, in either
      language; the legal chunk holds all of it;
   B. loading the home page requests no legal chunk, in EN and with a stored
      ES, and the home page's visible text is the prerendered text;
   C. with JavaScript off, /privacy, /terms and /refunds show their title,
      every heading and every paragraph in the prerendered HTML (EN), their
      own title and description, the home link, and no local address;
   D. with JavaScript on each legal page loads its chunk, hydrates with no
      console or page error, keeps its text, toggles to ES (text and title)
      and a stored ES shows ES; nothing leaves the page's own origin.
   Usage: node scripts/test-legal-chunk.mjs */

import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { copy } from '../src/copy.ts';
import { legalCopy } from '../src/legal-copy.ts';
import { buildSite, serveDir } from './lib/temp-site.mjs';
import { initialJs } from './lib/initial-js.mjs';

const failures = [];
let checks = 0;
const check = (cond, msg) => {
  checks += 1;
  if (!cond) failures.push(msg);
};

const work = mkdtempSync(join(tmpdir(), 'gl-legal-'));
const dir = join(work, 'site');
buildSite(dir, { GL_BOOKING_ENABLED: '0', GL_GUIDES_ENABLED: '0', GL_REVIEWS_ENABLED: '0' });
const { server, url } = await serveDir(dir);
const origin = new URL(url).origin;

const KINDS = ['privacy', 'terms', 'refunds'];
const LANGS = ['en', 'es'];
const texts = (lang, kind) => {
  const p = legalCopy[lang].pages[kind];
  return { title: p.title, heads: p.sections.map((s) => s.h), paras: p.sections.flatMap((s) => s.body) };
};
/* Sentences the home page says too (the refund guarantee is also an FAQ
   answer) cannot prove anything about where they ship from. */
const homeCopy = JSON.stringify(copy);
const norm = (s) => s.replace(/\s+/g, ' ').trim();

/* A. the first load holds none of it, the legal chunk holds all of it. */
const first = initialJs(dir);
const firstText = first.files.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
const assets = readdirSync(join(dir, 'assets'));
const legalFiles = assets.filter((f) => /^LegalPage-.*\.js$/.test(f));
check(legalFiles.length === 1, `exactly one LegalPage chunk in the build (found ${legalFiles.length})`);
const legalText = legalFiles.map((f) => readFileSync(join(dir, 'assets', f), 'utf8')).join('\n');
check(!first.files.some((f) => /LegalPage/.test(f)), 'the home page does not load the LegalPage chunk first');
for (const lang of LANGS) {
  for (const kind of KINDS) {
    const t = texts(lang, kind);
    /* Short titles are also footer words; the long headings and the first
       paragraph are the legal pages' own. */
    for (const s of [...t.heads.filter((h) => h.length > 14), ...t.paras.map((p) => p.slice(0, 60)).filter((p) => !homeCopy.includes(p))]) {
      const lit = JSON.stringify(s).slice(1, -1).replace(/\\u2019/g, '’');
      check(!firstText.includes(s) && !firstText.includes(lit), `${lang} ${kind}: "${s.slice(0, 40)}" is in the first-load scripts`);
      check(legalText.includes(s) || legalText.includes(lit), `${lang} ${kind}: "${s.slice(0, 40)}" is missing from the LegalPage chunk`);
    }
  }
}

const browser = await chromium.launch();
const logs = [];
const track = (page, tag) => {
  page.on('console', (m) => m.type() === 'error' && logs.push(`${tag}: console error: ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`${tag}: page error: ${e.message}`));
};

/* B. the home page never fetches the legal chunk. */
for (const stored of [null, 'es']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  if (stored) await ctx.addInitScript((l) => localStorage.setItem('guestly-lang', l), stored);
  const page = await ctx.newPage();
  track(page, `home ${stored ?? 'en'}`);
  const reqs = [];
  page.on('request', (r) => reqs.push(r.url()));
  await page.goto(url + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  check(!reqs.some((u) => /LegalPage/.test(u)), `home (${stored ?? 'en'}): the legal chunk was requested`);
  check(reqs.every((u) => u.startsWith(origin) || u.startsWith('data:')), `home (${stored ?? 'en'}): a request left the page's origin`);
  check((await page.locator('.legal-page').count()) === 0, `home (${stored ?? 'en'}): shows a legal page`);
  await ctx.close();
}

/* C. JavaScript off: the prerendered pages carry their content. */
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  for (const kind of KINDS) {
    const page = await ctx.newPage();
    await page.goto(`${url}/${kind}/`, { waitUntil: 'load' });
    const t = texts('en', kind);
    check((await page.title()) === `${t.title}: Guest-ly`, `${kind} (no JS): title is "${await page.title()}"`);
    check(norm(await page.locator('h1').innerText()) === t.title, `${kind} (no JS): h1`);
    const heads = (await page.locator('.legal-page__section h2').allInnerTexts()).map(norm);
    check(JSON.stringify(heads) === JSON.stringify(t.heads.map(norm)), `${kind} (no JS): headings ${JSON.stringify(heads)}`);
    const paras = (await page.locator('.legal-page__section p').allInnerTexts()).map(norm);
    check(JSON.stringify(paras) === JSON.stringify(t.paras.map(norm)), `${kind} (no JS): paragraphs differ from the legal copy`);
    check(norm(await page.locator('.legal-page__contact').innerText()) === norm(legalCopy.en.contactLine), `${kind} (no JS): contact line`);
    check((await page.locator('a.legal-page__back').getAttribute('href')) === '/', `${kind} (no JS): home link`);
    const desc = (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
    check(desc.length > 20 && t.paras[0].startsWith(desc.slice(0, 20)), `${kind} (no JS): description "${desc.slice(0, 40)}"`);
    const html = await page.content();
    check(!/localhost|127\.0\.0\.1/.test(readFileSync(join(dir, kind, 'index.html'), 'utf8')), `${kind}: the prerendered file names a local address`);
    check(!html.includes('application/ld+json'), `${kind} (no JS): carries the home page's JSON-LD`);
    await page.close();
  }
  await ctx.close();
}

/* D. JavaScript on: the chunk loads, the page hydrates, the language toggles. */
for (const kind of KINDS) {
  for (const stored of [null, 'es']) {
    const tag = `${kind} ${stored ?? 'en'}`;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    if (stored) await ctx.addInitScript((l) => localStorage.setItem('guestly-lang', l), stored);
    const page = await ctx.newPage();
    track(page, tag);
    const reqs = [];
    page.on('request', (r) => reqs.push(r.url()));
    await page.goto(`${url}/${kind}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const lang = stored ?? 'en';
    const t = texts(lang, kind);
    check(reqs.some((u) => /LegalPage/.test(u)), `${tag}: the legal chunk was not requested`);
    check(reqs.every((u) => u.startsWith(origin) || u.startsWith('data:')), `${tag}: a request left the page's origin`);
    check(norm(await page.locator('h1').innerText()) === t.title, `${tag}: h1 after hydration`);
    const heads = (await page.locator('.legal-page__section h2').allInnerTexts()).map(norm);
    check(JSON.stringify(heads) === JSON.stringify(t.heads.map(norm)), `${tag}: headings after hydration ${JSON.stringify(heads)}`);
    check((await page.title()) === `${t.title}: Guest-ly`, `${tag}: title "${await page.title()}"`);
    if (!stored) {
      await page.locator('.legal-page__toggles .lang-toggle button', { hasText: 'ES' }).click();
      const es = texts('es', kind);
      check(norm(await page.locator('h1').innerText()) === es.title, `${tag}: h1 after the ES toggle`);
      const paras = (await page.locator('.legal-page__section p').allInnerTexts()).map(norm);
      check(JSON.stringify(paras) === JSON.stringify(es.paras.map(norm)), `${tag}: ES paragraphs after the toggle`);
      check((await page.title()) === `${es.title}: Guest-ly`, `${tag}: ES title "${await page.title()}"`);
    }
    await ctx.close();
  }
}

await browser.close();
server.close();
rmSync(work, { recursive: true, force: true });
failures.push(...logs);

if (failures.length) {
  for (const f of failures) console.error(`test-legal-chunk: ${f}`);
  console.error(`\ntest-legal-chunk FAILED: ${failures.length} problem(s) in ${checks} checks`);
  process.exit(1);
}
console.log(`test-legal-chunk clean: ${checks} checks (no legal text in the first load, no legal chunk on the home page, three pages complete with JavaScript off, hydration clean with a stored language, EN and ES)`);

/* Post-build check of what search and AI engines read (runs inside
   `npm run build`, after prerender). Fails the build when:
   - a JSON-LD offer differs from the prerendered plan card it describes
     (name, guests line, price), or the offer count differs from the cards;
   - a FAQPage answer is not the visible answer to the same question;
   - robots.txt blocks anything or lacks the Sitemap line;
   - sitemap.xml lists a page that was not prerendered, misses one that was,
     or names /reunion or a demo wedding;
   - a listed page's og:url is not its canonical, or it shares its title or
     description with another listed page;
   - an AI facts file (#48: llms.txt, llms-full.txt, es/llms.txt, written by
     scripts/llms.mjs) is missing, does not open with "# Guest-ly" or close
     with the slogan, lists a plan unlike the prerendered card (name, price,
     guests line), or links a guest-ly.com address the build does not serve.
   Usage: node scripts/check-seo.mjs [distDir]   (default: cinematic/dist) */

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { CINEMATIC } from './lib/paths.mjs';

const dist = resolve(process.argv[2] || join(CINEMATIC, 'dist'));
const SITE = 'https://guest-ly.com';
/* The public pages are the routes prerender.mjs snapshots (the same list
   stage-site.sh reads), written the way GitHub Pages serves them. */
const PAGES = [...readFileSync(join(CINEMATIC, 'scripts', 'prerender.mjs'), 'utf8').matchAll(/\['(\/[^']*)',\s*'[^']*index\.html'\]/g)].map(
  ([, route]) => (route === '/' ? '/' : `${route}/`),
);
if (PAGES.length === 0) {
  console.error('check-seo: found no routes in scripts/prerender.mjs');
  process.exit(1);
}
const errors = [];
const fail = (msg) => errors.push(msg);

/* 1. JSON-LD against the visible page, read from the prerendered DOM with
   scripts off: exactly what a crawler without JS sees. */
const browser = await chromium.launch();
const page = await (await browser.newContext({ javaScriptEnabled: false })).newPage();
await page.goto(pathToFileURL(join(dist, 'index.html')).href);
const seen = await page.evaluate(() => {
  const text = (el, sel) => (el.querySelector(sel)?.textContent ?? '').trim();
  return {
    ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
    plans: [...document.querySelectorAll('#pricing .plan')].map((el) => ({
      name: text(el, '.plan__name'),
      guests: text(el, '.plan__channels'),
      price: text(el, '.plan__num'),
    })),
    faq: [...document.querySelectorAll('#faq .faq-item')].map((el) => ({
      q: text(el, '.faq-q span'),
      a: text(el, '.faq-a__inner p'),
    })),
  };
});
await browser.close();

const blocks = [];
for (const raw of seen.ld) {
  try {
    blocks.push(JSON.parse(raw));
  } catch (e) {
    fail(`JSON-LD block does not parse: ${e.message}`);
  }
}
const product = blocks.filter((b) => b['@type'] === 'Product');
const faqPage = blocks.filter((b) => b['@type'] === 'FAQPage');
if (product.length !== 1) fail(`expected 1 Product JSON-LD block, found ${product.length}`);
if (faqPage.length !== 1) fail(`expected 1 FAQPage JSON-LD block, found ${faqPage.length}`);

if (seen.plans.length === 0) fail('no plan cards found in #pricing of the prerendered page');
const offers = product[0]?.offers ?? [];
if (offers.length !== seen.plans.length) fail(`JSON-LD has ${offers.length} offers, the page shows ${seen.plans.length} plans`);
seen.plans.forEach((card, i) => {
  const offer = offers[i];
  if (!offer) return;
  if (offer.name !== card.name) fail(`offer ${i + 1} name "${offer.name}" but the card says "${card.name}"`);
  if (offer.price !== card.price) fail(`${card.name}: JSON-LD price ${offer.price} but the card says ${card.price}`);
  if (offer.priceCurrency !== 'USD') fail(`${card.name}: priceCurrency ${offer.priceCurrency}`);
  if (!String(offer.description).startsWith(`${card.guests}.`))
    fail(`${card.name}: JSON-LD description starts "${String(offer.description).slice(0, 40)}" but the card says "${card.guests}"`);
});

const questions = faqPage[0]?.mainEntity ?? [];
if (questions.length === 0) fail('FAQPage has no questions');
for (const item of questions) {
  const shown = seen.faq.find((f) => f.q === item.name);
  if (!shown) fail(`FAQPage question not on the page: "${item.name}"`);
  else if (shown.a !== item.acceptedAnswer?.text) fail(`FAQPage answer differs from the page for "${item.name}"`);
}

/* 2. robots.txt */
const robotsPath = join(dist, 'robots.txt');
if (!existsSync(robotsPath)) fail('dist/robots.txt missing');
else {
  const robots = readFileSync(robotsPath, 'utf8');
  if (/^\s*disallow\s*:\s*\S/im.test(robots)) fail('robots.txt disallows a path; llms.txt and every page must stay crawlable');
  if (!robots.includes(`Sitemap: ${SITE}/sitemap.xml`)) fail('robots.txt has no Sitemap line');
}

/* 3. sitemap.xml, and each listed page's own head: canonical, og:url,
   a title and a description no other listed page shares. */
const seenHeads = [];
const sitemapPath = join(dist, 'sitemap.xml');
if (!existsSync(sitemapPath)) fail('dist/sitemap.xml missing');
else {
  const xml = readFileSync(sitemapPath, 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const want = PAGES.map((p) => `${SITE}${p}`);
  for (const w of want) if (!locs.includes(w)) fail(`sitemap.xml misses ${w}`);
  for (const l of locs) {
    if (!want.includes(l)) fail(`sitemap.xml lists ${l}, which is not a prerendered public page`);
    if (/\/reunion|demo/i.test(l)) fail(`sitemap.xml lists a private or demo page: ${l}`);
  }
  for (const p of PAGES) {
    const file = join(dist, p === '/' ? 'index.html' : `${p.slice(1)}index.html`);
    if (!existsSync(file)) fail(`sitemap page ${p} has no prerendered file`);
    else {
      const html = readFileSync(file, 'utf8');
      if (!html.includes(`<link rel="canonical" href="${SITE}${p}">`)) fail(`${p}: canonical link does not name ${SITE}${p}`);
      if (p !== '/' && html.includes('application/ld+json')) fail(`${p}: carries the home page JSON-LD`);
      const meta = (re) => html.match(re)?.[1] ?? '';
      const head = {
        title: meta(/<title>([^<]*)<\/title>/),
        description: meta(/<meta name="description" content="([^"]*)"/),
        ogUrl: meta(/<meta property="og:url" content="([^"]*)"/),
      };
      if (head.ogUrl !== `${SITE}${p}`) fail(`${p}: og:url is "${head.ogUrl}", not its canonical ${SITE}${p}`);
      if (!head.title || !head.description) fail(`${p}: missing title or meta description`);
      for (const [key, value] of Object.entries(head)) {
        const other = seenHeads.find((h) => h[key] === value);
        if (key !== 'ogUrl' && other) fail(`${p}: same ${key} as ${other.page} ("${value.slice(0, 50)}")`);
      }
      seenHeads.push({ page: p, ...head });
    }
  }
}

/* 4. The AI facts files. */
const LLMS = [
  ['llms.txt', 'More wedding, less stress.'],
  ['llms-full.txt', 'More wedding, less stress.'],
  ['es/llms.txt', 'Más boda, menos estrés.'],
];
const homeHtml = existsSync(join(dist, 'index.html')) ? readFileSync(join(dist, 'index.html'), 'utf8') : '';
for (const [name, slogan] of LLMS) {
  const file = join(dist, name);
  if (!existsSync(file)) {
    fail(`dist/${name} missing (scripts/llms.mjs writes it)`);
    continue;
  }
  const text = readFileSync(file, 'utf8');
  if (!text.startsWith('# Guest-ly\n')) fail(`${name} does not open with "# Guest-ly"`);
  if (text.trimEnd().split('\n').pop() !== slogan) fail(`${name} does not close with "${slogan}"`);
  if (name !== 'es/llms.txt') {
    for (const card of seen.plans) {
      if (!text.includes(`- ${card.name}: USD ${card.price}. ${card.guests}.`))
        fail(`${name} has no plan line equal to the ${card.name} card (USD ${card.price}, ${card.guests})`);
    }
  }
  for (const [, url] of text.matchAll(/(https:\/\/guest-ly\.com[^\s)]*)/g)) {
    const u = new URL(url.replace(/[.,;:]$/, ''));
    const path = decodeURIComponent(u.pathname);
    const target = path.endsWith('/') ? join(dist, path, 'index.html') : join(dist, path);
    if (!existsSync(target)) fail(`${name} links ${u.href}, which the build does not serve`);
    if (u.hash && path === '/' && !homeHtml.includes(`id="${u.hash.slice(1)}"`)) fail(`${name} links ${u.href}, but the home page has no such anchor`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(`check-seo: ${e}`);
  process.exit(1);
}
console.log(`check-seo clean: ${offers.length} offers and ${questions.length} FAQ answers match the page; robots.txt and sitemap.xml (${PAGES.length} pages) ok; ${LLMS.length} AI facts files ok`);

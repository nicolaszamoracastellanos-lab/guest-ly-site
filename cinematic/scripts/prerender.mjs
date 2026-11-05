/* Build-time prerender (Part 7.2). Serves the fresh dist/ on a local port,
   renders each route in headless Chromium, and writes the full DOM back as
   static files: dist/index.html plus dist/{privacy,terms,refunds}/index.html.
   React hydrates over the markup at runtime (see main.tsx).

   The snapshot browser forces reduced motion, so the WebGL gate renders the
   static stage: crawlers get pure DOM and the served markup matches React's
   first client render (the three.js chunk mounts after hydration). */

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html missing; run vite build first');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

/* Tiny static server with SPA fallback so /privacy resolves pre-snapshot. */
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join(dist, path);
  if (!extname(file)) file = join(dist, 'index.html');
  try {
    const body = readFileSync(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;

const browser = await chromium.launch();
const ctx = await browser.newContext({ colorScheme: 'dark', reducedMotion: 'reduce' });

/* GitHub Pages answers /privacy with a 301 to /privacy/, so the canonical
   address of every page but the home page ends in a slash. */
const SITE = 'https://guest-ly.com';
const pageUrl = (route) => (route === '/' ? `${SITE}/` : `${SITE}${route}/`);

const routes = [
  ['/', 'index.html'],
  ['/privacy', 'privacy/index.html'],
  ['/terms', 'terms/index.html'],
  ['/refunds', 'refunds/index.html'],
];

for (const [route, outFile] of routes) {
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}${route}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#root > *');
  await page.waitForTimeout(400);

  const html = await page.evaluate((canonical) => {
    /* Strip runtime-only state so the served markup is the pre-JS state:
       js-ready gates the reveal animations (without it, content is visible
       even if JS never runs) and is-visible is added back by the observer. */
    document.body.classList.remove('js-ready');
    document.querySelectorAll('.reveal.is-visible').forEach((el) => el.classList.remove('is-visible'));
    /* The hero chat transcript is runtime ambience painted by effects; the
       client hydrates with an empty stage and replays it, so an embedded
       transcript would be a hydration text mismatch. */
    document.querySelectorAll('.chat-card__body').forEach((el) => el.replaceChildren());
    document.querySelectorAll('.chat-card__note').forEach((el) => el.remove());
    /* Night-default markup: the bootstrap script re-resolves per visitor. */
    document.documentElement.setAttribute('data-theme', 'night');
    /* Each page names itself as canonical (index.html ships the home URL). */
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical);
    /* The offers and FAQ JSON-LD describe the home page; the legal pages
       show neither, so they do not carry it. */
    if (!/\.com\/$/.test(canonical))
      document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => el.remove());
    return '<!doctype html>\n' + document.documentElement.outerHTML;
  }, pageUrl(route));

  const target = join(dist, outFile);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
  console.log(`prerendered ${route} -> dist/${outFile} (${(html.length / 1024).toFixed(0)}KB)`);
  await page.close();
}

await browser.close();
server.close();

/* sitemap.xml lists exactly the pages prerendered above, so a new public
   page enters the sitemap and the stage-site.sh allowlist check together.
   Private pages (/reunion/*) and demo weddings are never prerendered here
   and so never listed. No lastmod: the same source builds the same file. */
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...routes.map(([route]) => `  <url><loc>${pageUrl(route)}</loc></url>`),
  '</urlset>',
  '',
].join('\n');
writeFileSync(join(dist, 'sitemap.xml'), sitemap);
console.log(`wrote dist/sitemap.xml (${routes.length} pages)`);

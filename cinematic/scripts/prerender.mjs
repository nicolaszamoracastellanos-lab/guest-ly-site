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

  const html = await page.evaluate(() => {
    /* Strip runtime-only state so the served markup is the pre-JS state:
       js-ready gates the reveal animations (without it, content is visible
       even if JS never runs) and is-visible is added back by the observer. */
    document.body.classList.remove('js-ready');
    document.querySelectorAll('.reveal.is-visible').forEach((el) => el.classList.remove('is-visible'));
    /* Night-default markup: the bootstrap script re-resolves per visitor. */
    document.documentElement.setAttribute('data-theme', 'night');
    return '<!doctype html>\n' + document.documentElement.outerHTML;
  });

  const target = join(dist, outFile);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
  console.log(`prerendered ${route} -> dist/${outFile} (${(html.length / 1024).toFixed(0)}KB)`);
  await page.close();
}

await browser.close();
server.close();

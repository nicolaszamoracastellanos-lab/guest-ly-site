/* Landing privacy check (STUDY-quality-bar 10.4 item 8): load the built
   site and fail on any request to an origin outside guest-ly.com (and its
   subdomains, plus the local server under test) and on any Set-Cookie.
   Covers every prerendered page at 390 and 1440, scrolled to the end so
   lazy chunks load.
   Usage: node scripts/check-origins.mjs <baseUrl> [--report-only]
   Until the D4 font self-hosting lands, Google Fonts is the known miss:
   --report-only prints the findings and exits 0. */

import { chromium } from 'playwright';

const args = process.argv.slice(2);
const base = args.find((a) => !a.startsWith('--')) || 'http://localhost:4173';
const reportOnly = args.includes('--report-only');
const local = new URL(base).host;
const PAGES = ['/', '/privacy/', '/terms/', '/refunds/'];
const VIEWPORTS = [
  { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  { width: 1440, height: 900 },
];

const allowed = (url) => {
  const u = new URL(url);
  if (u.protocol === 'data:' || u.protocol === 'blob:') return true;
  return u.host === local || u.hostname === 'guest-ly.com' || u.hostname.endsWith('.guest-ly.com');
};

const offOrigin = new Map();
const cookies = [];
const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const { width, height, ...rest } = vp;
  const ctx = await browser.newContext({ viewport: { width, height }, ...rest });
  for (const path of PAGES) {
    const page = await ctx.newPage();
    page.on('request', (req) => {
      if (!allowed(req.url())) offOrigin.set(new URL(req.url()).origin, `${path} at ${width}`);
    });
    page.on('response', async (res) => {
      const h = await res.allHeaders().catch(() => ({}));
      if (h['set-cookie']) cookies.push(`${res.url()} (${path} at ${width})`);
    });
    await page.goto(new URL(path, base).href, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
    });
    await page.waitForTimeout(800);
    await page.close();
  }
  const jar = await ctx.cookies();
  for (const c of jar) cookies.push(`cookie in jar: ${c.name} on ${c.domain}`);
  await ctx.close();
}
await browser.close();

const problems = [
  ...[...offOrigin].map(([origin, where]) => `request to ${origin} (first seen on ${where})`),
  ...cookies.map((c) => `Set-Cookie: ${c}`),
];
if (problems.length) {
  for (const p of problems) console.error(`check-origins: ${p}`);
  if (!reportOnly) process.exit(1);
  console.log(`check-origins: ${problems.length} findings (report only)`);
} else {
  console.log(`check-origins clean: ${PAGES.length} pages at 390 and 1440, only guest-ly origins, no cookies`);
}

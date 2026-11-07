/* Landing privacy check (STUDY-quality-bar 10.4 item 8): load the built
   site and fail on any request outside the allowlist and on any Set-Cookie.
   Covers every prerendered page at 390 and 1440, scrolled to the end so
   lazy chunks load.

   The allowlist, by host and path:
   - the site itself: the server under test, guest-ly.com, www.guest-ly.com;
   - app.guest-ly.com (src/switches.ts API_ORIGIN), only on the paths the
     landing calls: /api/public/booking/ (#22), /api/public/guides and what
     is under it (#50, the catalogue and the request), and /api/site/t (#23
     beacon). Any other path there fails;
   - alexnico.guest-ly.com/.netlify/functions/demo-chat, the hero's live
     demo chat (on typing only, never on load).
   Nothing else, so a new origin has to be added here, with its reason.

   --interact: on the home page, also opens the booking dialog (when the
   build has booking buttons), books the first time, and requests a guide
   (when it has the guides section). --fixtures answers the API inside the
   browser from scripts/lib/booking-stub.mjs, so an interact run never
   reaches the real host; the requests still count against the allowlist.
   Usage: node scripts/check-origins.mjs <baseUrl> [--interact [--fixtures]] [--report-only] */

import { chromium } from 'playwright';
import { API_ORIGIN, API_PATHS } from '../src/switches.ts';
import { bookedBody, slotsBody, catalogueBody } from './lib/booking-stub.mjs';

const args = process.argv.slice(2);
const base = args.find((a) => !a.startsWith('--')) || 'http://localhost:4173';
const reportOnly = args.includes('--report-only');
const interact = args.includes('--interact');
const fixtures = args.includes('--fixtures');
const local = new URL(base).host;
const PAGES = ['/', '/privacy/', '/terms/', '/refunds/'];
const VIEWPORTS = [
  { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  { width: 1440, height: 900 },
];

const SITE_HOSTS = new Set([local, 'guest-ly.com', 'www.guest-ly.com']);
const API_HOST = new URL(API_ORIGIN).host;
const ALLOWED_PATHS = new Map([
  [API_HOST, [...API_PATHS, '/api/site/t']],
  ['alexnico.guest-ly.com', ['/.netlify/functions/demo-chat']],
]);

export function allowed(url) {
  const u = new URL(url);
  if (u.protocol === 'data:' || u.protocol === 'blob:') return true;
  if (SITE_HOSTS.has(u.host)) return true;
  const paths = ALLOWED_PATHS.get(u.host);
  return Boolean(paths && u.protocol === 'https:' && paths.some((p) => (p.endsWith('/') ? u.pathname.startsWith(p) : u.pathname === p || u.pathname.startsWith(`${p}/`))));
}

const offOrigin = new Map();
const cookies = [];
const apiSeen = new Set();
const browser = await chromium.launch();

async function answerApi(route) {
  const req = route.request();
  const u = new URL(req.url());
  const headers = { 'Access-Control-Allow-Origin': req.headers().origin ?? '*', Vary: 'Origin', 'Cache-Control': 'no-store' };
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  if (u.pathname.endsWith('/slots')) return route.fulfill({ status: 200, headers, json: slotsBody({ tz: u.searchParams.get('tz') }) });
  if (u.pathname.endsWith('/book')) {
    const start = JSON.parse(req.postData() || '{}').start;
    return route.fulfill({ status: 201, headers, json: bookedBody(API_ORIGIN, start) });
  }
  if (u.pathname === '/api/public/guides') return route.fulfill({ status: 200, headers, json: catalogueBody('open') });
  if (u.pathname === '/api/public/guides/request') return route.fulfill({ status: 200, headers, json: { v: 1, ok: true, status: 'sent' } });
  return route.fulfill({ status: 204, headers });
}

for (const vp of VIEWPORTS) {
  const { width, height, ...rest } = vp;
  const ctx = await browser.newContext({ viewport: { width, height }, ...rest });
  if (fixtures) await ctx.route(`${API_ORIGIN}/api/**`, answerApi);
  for (const path of PAGES) {
    const page = await ctx.newPage();
    page.on('request', (req) => {
      const url = req.url();
      const origin = new URL(url).origin;
      if (new URL(url).host === API_HOST) apiSeen.add(new URL(url).pathname.split('/').slice(0, 4).join('/'));
      /* Keep the first page and width an origin shows up on, not the last. */
      const key = allowed(url) ? null : `${origin}${new URL(url).pathname}`;
      if (key && !offOrigin.has(key)) offOrigin.set(key, `${path} at ${width}`);
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
    if (interact && path === '/') {
      const book = page.locator('.final-cta__actions [data-book]');
      if ((await book.count()) > 0) {
        await book.scrollIntoViewIfNeeded();
        await book.click();
        await page.locator('label.book-time').first().waitFor({ timeout: 8000 }).catch(() => {});
        if ((await page.locator('label.book-time').count()) > 0) {
          await page.locator('label.book-time').first().click();
          await page.locator('.book button[type="submit"]').click();
          await page.locator('.book__fields input[autocomplete="name"]').fill('Ana Pérez');
          await page.locator('.book__fields input[type="email"]').fill('ana@example.com');
          await page.locator('.book button[type="submit"]').click();
          await page.locator('.book__done, .book__error, .book__empty').first().waitFor({ timeout: 8000 }).catch(() => {});
        }
        await page.keyboard.press('Escape');
      }
      if ((await page.locator('#guides').count()) > 0) {
        await page.locator('#guides').scrollIntoViewIfNeeded();
        await page.locator('.guides').waitFor({ timeout: 8000 }).catch(() => {});
        if ((await page.locator('.guides-place').count()) > 0) {
          await page.locator('.guides-place').first().click();
          await page.locator('.guides input[type="email"]').fill('ana@example.com');
          await page.locator('.guides__submit').click();
          await page.locator('.guides-done, .guides__error').first().waitFor({ timeout: 8000 }).catch(() => {});
        }
      }
      await page.waitForTimeout(500);
    }
    await page.close();
  }
  const jar = await ctx.cookies();
  for (const c of jar) cookies.push(`cookie in jar: ${c.name} on ${c.domain}`);
  await ctx.close();
}
await browser.close();

const problems = [
  ...[...offOrigin].map(([where, first]) => `request to ${where} (first seen on ${first})`),
  ...cookies.map((c) => `Set-Cookie: ${c}`),
];
if (problems.length) {
  for (const p of problems) console.error(`check-origins: ${p}`);
  if (!reportOnly) process.exit(1);
  console.log(`check-origins: ${problems.length} findings (report only)`);
} else {
  const api = apiSeen.size ? `; ${API_HOST} only on ${[...apiSeen].sort().join(', ')}${fixtures ? ' (answered in the browser, fixtures)' : ''}` : '';
  console.log(`check-origins clean: ${PAGES.length} pages at 390 and 1440, only allowlisted origins, no cookies${interact ? ', booking and guides exercised' : ''}${api}`);
}

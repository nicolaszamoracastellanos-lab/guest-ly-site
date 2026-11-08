/* #22 demo booking and #50 destination guides on the landing (Playwright),
   against a local stub of the API (scripts/lib/booking-stub.mjs), never
   app.guest-ly.com. Builds the page twice into a temp folder (never
   cinematic/dist): both switches on (API and beacon pointed at the stub on
   another port of localhost: same site, other origin, like guest-ly.com and
   app.guest-ly.com), and both off (today's build). Proves:
   ON
   A. load: no booking request and exactly one guides catalogue read, after
      hydration at idle (simple GET, no cookie, no referrer), no guide request;
      scrolling adds none; the dialog and the guides section are not in the
      prerendered page, the three booking buttons are; the section appears
      once the catalogue answers open (the stub), where it sits today.
   B. pointer over a button prefetches the slot list once (visitor zone in
      the query); the press opens the dialog on that list with no second
      read; the title has focus; times show in the visitor's zone with the
      host's zone named.
   C. keyboard only: arrows between days, a time, the details, Enter books;
      the POST is text/plain (no preflight), carries no Cookie although a
      localhost cookie is planted, no Referer, the agreed fields and a key;
      the stub's Set-Cookie is not kept; the confirmation shows the call in
      the visitor's zone, the host's time, the calendar and manage links;
      Escape closes and focus returns to the button.
   D. Tab never leaves the dialog.
   E. empty fields: messages, focus on the first, no request; a field the
      server refuses keeps the input; no answer: retry reuses the key and
      books; taken: back to fresh times without that time and a new key.
      After no answer (Space on the submit): focus stays on the button, Tab
      stays inside, Escape closes; another email or another time gets a new
      key, the same pair keeps it. 429 email_limit: "You already booked
      today", the input kept, a new key next time.
   F. closed, unavailable, 429, 500 and empty-with-next answers each show
      their calm state (contact links, retry, next open day).
   G. replay: "check your email", no links.
   H. ?book=demo opens the dialog in the stored language and leaves the URL.
   I. guides, on L7p's v1 contract (the stub parses like L7p and refuses
      the old {destination} body): the section is added only after an open
      catalogue read and takes its cards and tips sentence from the catalogue; empty input
      messages; the body is exactly {email, code, lang, visitorTz, tips,
      consentVersion, fax_number}, tips false; ticked: tips true and the
      server reads it as ticked; 503: "try again in a minute", the input
      kept, the retry sends; 409: the side panel becomes the calm message
      and the cards cannot be picked. 503 and 409 leave focus inside the
      form. Catalogue closed, unavailable, 429 or 500 while the section is
      below the viewport: no section and the FAQ is № 10 again; while it is
      in view (?guide=all, or a slow answer after a scroll into the skeleton
      or past the section): the section stays with the "not available"
      line, layout shift under 0.02; the box fits the line at once for
      ?guide=all and past the section, and once the visitor scrolls a held
      part out of view otherwise. Landing on /#faq with a slow catalogue at
      360, 390 and 640: layout shift under 0.02, the FAQ stays at the top.
      A slow sent (200) and a slow 409 at 390 with the button at the bottom
      of the screen: layout shift under 0.02, the box keeps its height.
      ?guide=<code> scrolls to the section with that guide picked and the
      email focused, ?guide=all scrolls there, and the query is dropped.
   J. beacon events: booking opened, slot, booked and guide <id>.
   K. nothing on the device: no cookie, no sessionStorage, localStorage holds
      only the language the visitor picked.
   L. privacy page shows the demo-call and guides paragraphs (EN, ES).
   M. 390 phone: no sideways scroll, 44 px targets in the dialog and form.
   OFF
   W. "Questions before you pay?" in the order wizard's confirmation opens
      the booking dialog above the wizard: the summary and the Pay step stay
      underneath, the page stays locked, Escape closes only the dialog and
      focus returns to the button; the order notification is answered
      locally (never formsubmit.co).
   O. no crypto.randomUUID (Safari before 15.4): the dialog opens and books
      with a valid key, the page stays up.
   N. no booking button, no guides section, no dialog on ?book=demo, no
      request to the API host after scrolling and hovering, no chunk, no
      privacy paragraph.
   No console error or page error anywhere (hydration included).
   Usage: GL_PORTAL_DIR=<portal> node scripts/test-booking.mjs */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';
import { startStub } from './lib/booking-stub.mjs';
import { buildSite, serveDir } from './lib/temp-site.mjs';
import { INITIAL_JS_BUDGET, initialJs } from './lib/initial-js.mjs';

const failures = [];
let checks = 0;
const check = (cond, msg) => {
  checks += 1;
  if (!cond) failures.push(msg);
};

const stub = await startStub();
const S = stub.state;
const work = mkdtempSync(join(tmpdir(), 'gl-booking-'));
const onDir = join(work, 'on');
const offDir = join(work, 'off');
console.log('test-booking: building with booking and guides on (stub API) and off');
buildSite(onDir, { GL_BOOKING_ENABLED: '1', GL_GUIDES_ENABLED: '1', GL_REVIEWS_ENABLED: '0', GL_API_ORIGIN: stub.origin, VITE_SITE_BEACON_URL: `${stub.origin}/api/site/t` });
buildSite(offDir, { GL_BOOKING_ENABLED: '0', GL_GUIDES_ENABLED: '0', GL_REVIEWS_ENABLED: '0' });
const on = await serveDir(onDir);
const off = await serveDir(offDir);

/* Sizes, for the log. */
const gz = (dir, re) =>
  readdirSync(join(dir, 'assets'))
    .filter((f) => re.test(f))
    .reduce((n, f) => n + gzipSync(readFileSync(join(dir, 'assets', f)), { level: 9 }).length, 0);
const sizes = { modal: gz(onDir, /^BookingModal-.*\.js$/), guidesForm: gz(onDir, /^GuidesTab-.*\.js$/) };
check(sizes.modal > 0 && sizes.modal <= 12000, `booking dialog chunk ${sizes.modal} B gzip (budget 12 KB)`);
check(sizes.guidesForm > 0 && sizes.guidesForm <= 6000, `guides chunk ${sizes.guidesForm} B gzip (budget 6 KB)`);
check(readdirSync(join(offDir, 'assets')).every((f) => !/^(BookingModal|GuidesTab)-/.test(f)), 'off build still has a booking or guides chunk');
/* Initial JS (STUDY-quality-bar 7.4). Both builds must fit (the legal pages'
   lazy chunk made room, L7-LOG Nov 7); check-seo.mjs also fails any real
   build over the budget, and scripts/test-initial-js.mjs covers all three
   switches on. */
const initial = { off: initialJs(offDir).bytes, on: initialJs(onDir).bytes };
check(initial.off > 0 && initial.off <= INITIAL_JS_BUDGET, `off build initial JS ${initial.off} B gzip (budget ${INITIAL_JS_BUDGET})`);
check(initial.on > initial.off && initial.on <= INITIAL_JS_BUDGET, `on build (booking and guides) initial JS ${initial.on} B gzip (budget ${INITIAL_JS_BUDGET})`);
const onHtml = readFileSync(join(onDir, 'index.html'), 'utf8');
check((onHtml.match(/data-book=""/g) ?? []).length === 3, `on: expected 3 booking buttons in the prerendered page (pricing, FAQ, final), found ${(onHtml.match(/data-book=""/g) ?? []).length}`);
check(!onHtml.includes('role="dialog"'), 'on: a dialog is in the prerendered page');
check(!onHtml.includes('id="guides"') && !onHtml.includes('class="guides') && !onHtml.includes('guides-slot') && !onHtml.includes('href="#guides"'), 'on: the prerendered page holds guides markup (it is run time only)');
check(!/Free guides|Guías gratis|Getting married\s*away from home|A free guide to your destination/.test(onHtml), 'on: the prerendered page holds the guides words');

/* The portal's own beacon parser (L7p), when GL_PORTAL_DIR has it: every
   batch with booking and guide events must pass with nothing dropped. */
let parseBeacon = null;
const schema = process.env.GL_PORTAL_DIR && join(process.env.GL_PORTAL_DIR, 'src', 'lib', 'site-analytics', 'schema.ts');
if (schema && existsSync(schema)) parseBeacon = (await import(pathToFileURL(schema).href)).parseBeacon;
const parsed = (label) => {
  if (!parseBeacon) return;
  for (const h of S.hits.filter((x) => x.path === '/api/site/t')) {
    const b = JSON.parse(h.body);
    const { rows, dropped } = parseBeacon(b, { visitorDay: '0'.repeat(32), day: '2026-11-05' });
    check(dropped === 0 && rows.length === b.events.length, `${label}: portal parser kept ${rows.length} of ${b.events.length} events`);
  }
};

const browser = await chromium.launch();
const apiHits = (from = 0) => S.hits.slice(from).filter((h) => h.path.startsWith('/api/public/'));
const reset = (m = {}) => {
  S.mode = { slots: 'open', book: 'booked', catalogue: 'open', guide: 'sent', ...m };
  S.taken = [];
};

async function context(opts = {}) {
  const { lang = 'en', width = 1440, tz = 'America/Chicago', beacon = false, ...rest } = opts;
  const ctx = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 900 },
    isMobile: width < 600,
    hasTouch: width < 600,
    reducedMotion: 'reduce',
    timezoneId: tz,
    locale: lang === 'es' ? 'es-MX' : 'en-US',
    ...rest,
  });
  /* A same-site cookie the API requests must never carry. */
  await ctx.addCookies([{ name: 'portal_session', value: 'secret', domain: 'localhost', path: '/' }]);
  const page = await ctx.newPage();
  const errs = [];
  /* The browser logs every non-2xx answer as "Failed to load resource"; the
     API answers 400, 409, 429, 503 by contract, so those lines are not app
     errors. Anything else is. */
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errs.push(m.text()));
  page.on('pageerror', (e) => errs.push(String(e)));
  if (lang === 'es') await page.addInitScript(() => localStorage.setItem('guestly-lang', 'es'));
  if (beacon) await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
  return { ctx, page, errs };
}
const done = async ({ ctx, errs }, label) => {
  check(errs.length === 0, `${label}: console or page errors ${JSON.stringify(errs.slice(0, 3))}`);
  await ctx.close();
};
const finalCta = '.final-cta__actions [data-book]';
async function openDialog(page, sel = finalCta) {
  await page.locator(sel).scrollIntoViewIfNeeded();
  await page.locator(sel).click();
  await page.getByRole('dialog').waitFor();
}
async function toDetails(page) {
  await page.locator('label.book-time').first().waitFor();
  await page.locator('label.book-time').first().click();
  await page.getByRole('button', { name: /Choose this time|Elegir este horario/ }).click();
  await page.locator('.book__fields').waitFor();
}
async function fillDetails(page) {
  await page.getByLabel('Your name').fill('Ana Pérez');
  await page.locator('.book').getByLabel('Email').fill('ana@example.com');
}
const dialogSubmit = (page) => page.locator('.book button[type="submit"]').click();
const lastBook = () => [...S.hits].reverse().find((h) => h.path.endsWith('/book'));
/* Press "Book the call" and wait until the stub saw that POST. */
async function pressBook(page) {
  const n = S.hits.filter((h) => h.path.endsWith('/book')).length;
  await dialogSubmit(page);
  for (let i = 0; i < 50 && S.hits.filter((h) => h.path.endsWith('/book')).length === n; i++) await page.waitForTimeout(50);
}

/* ---------- A, B, C, D, J ---------- */
{
  reset();
  const t = await context({ beacon: true });
  const { page } = t;
  const mark = S.hits.length;
  await page.goto(on.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  check(apiHits(mark).every((h) => h.path === '/api/public/guides' && h.method === 'GET'), `A: an API request on load other than the catalogue read: ${apiHits(mark).map((h) => h.path).join()}`);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
  await page.locator('#guides .guides').waitFor();
  await page.waitForTimeout(200);
  check((await page.locator('#guides').count()) === 1, 'A: the guides section did not appear after an open answer');
  check(await page.evaluate(() => document.getElementById('guides').nextElementSibling?.id === 'faq'), 'A: the guides section is not just before the FAQ');
  check(apiHits(mark).filter((h) => h.path.includes('/booking/')).length === 0, 'A: a booking API request before any intent');
  const cats = apiHits(mark).filter((h) => h.path === '/api/public/guides');
  check(cats.length === 1 && cats[0].method === 'GET', `A: expected one guides catalogue GET after scrolling, saw ${cats.map((h) => h.method).join()}`);
  check(cats[0] && !cats[0].headers.cookie && !cats[0].headers.referer, 'A: the catalogue read carried a cookie or referrer');
  check(apiHits(mark).filter((h) => h.path === '/api/public/guides/request').length === 0, 'A: a guide request before any press');

  const before = S.hits.length;
  await page.locator(finalCta).scrollIntoViewIfNeeded();
  await page.locator(finalCta).hover();
  await page.waitForTimeout(400);
  const pre = apiHits(before).filter((h) => h.path.endsWith('/slots'));
  check(pre.length === 1, `B: hover should prefetch the slots once, saw ${pre.length}`);
  check(pre[0] && new URL(pre[0].url, stub.origin).searchParams.get('tz') === 'America/Chicago', 'B: the slot read names the visitor zone');
  check(pre[0] && !pre[0].headers.cookie, 'B: the slot read carried a cookie');
  check(pre[0] && !pre[0].headers.referer, 'B: the slot read carried a referrer');
  await page.locator(finalCta).click();
  await page.getByRole('dialog').waitFor();
  await page.locator('label.book-time').first().waitFor();
  check(apiHits(before).filter((h) => h.path.endsWith('/slots')).length === 1, 'B: opening read the slots again instead of using the prefetch');
  check(await page.evaluate(() => document.activeElement?.classList.contains('book__title')), 'B: focus is not on the dialog title');
  const zoneText = await page.locator('.book__zone p').innerText();
  check(zoneText.includes('Chicago time') && zoneText.includes('La Paz time'), `B: zone line "${zoneText}"`);

  /* C: keyboard only from the title. */
  const daysChecked = () => page.evaluate(() => document.querySelector('.book-day input:checked')?.value);
  const firstDay = await daysChecked();
  await page.locator('.book-day input:checked').focus();
  await page.keyboard.press('ArrowRight');
  const secondDay = await daysChecked();
  check(firstDay && secondDay && secondDay > firstDay, `C: arrow did not move to a later day (${firstDay} to ${secondDay})`);
  const disabledSkipped = await page.evaluate(() => !document.querySelector('.book-day input:checked')?.disabled);
  check(disabledSkipped, 'C: arrow landed on a day with no times');
  await page.keyboard.press('Tab');
  check(await page.evaluate(() => document.activeElement?.name?.endsWith('-time')), 'C: Tab from the days does not reach the times');
  await page.keyboard.press('Space');
  const chosen = await page.evaluate(() => document.querySelector('.book-time input:checked')?.value);
  check(Boolean(chosen), 'C: Space did not pick a time');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.locator('.book__fields').waitFor();
  check(await page.evaluate(() => document.activeElement?.classList.contains('book__title')), 'C: details step title not focused');
  await page.keyboard.press('Tab'); /* change time */
  await page.keyboard.press('Tab');
  await page.keyboard.type('Ana Pérez');
  await page.keyboard.press('Tab');
  await page.keyboard.type('ana@example.com');
  const postsBefore = S.hits.filter((h) => h.method === 'POST' && h.path.endsWith('/book')).length;
  await page.keyboard.press('Enter');
  await page.locator('.book__done').waitFor();
  const posts = S.hits.filter((h) => h.path.endsWith('/book'));
  check(posts.filter((h) => h.method === 'POST').length === postsBefore + 1, 'C: not exactly one booking POST');
  check(!posts.some((h) => h.method === 'OPTIONS'), 'C: a preflight was sent (the POST must be a simple request)');
  const post = lastBook();
  check(/^text\/plain/.test(post.headers['content-type'] ?? ''), `C: POST content-type ${post.headers['content-type']}`);
  check(!post.headers.cookie, 'C: the booking POST carried a cookie');
  check(!post.headers.referer, 'C: the booking POST carried a referrer');
  const body = JSON.parse(post.body);
  check(body.start === chosen, 'C: start is not the picked time');
  check(body.name === 'Ana Pérez' && body.email === 'ana@example.com', 'C: name or email not sent as typed');
  check(body.lang === 'en' && body.visitorTz === 'America/Chicago', `C: lang ${body.lang}, visitorTz ${body.visitorTz}`);
  check(/^[A-Za-z0-9_-]{8,80}$/.test(body.idempotencyKey), 'C: idempotency key shape');
  check(body.fax_number === '' && body.role === '' && body.weddingDate === '' && body.phone === '' && body.notes === '', 'C: optional fields not empty strings');
  const keys = Object.keys(body).sort().join(',');
  check(keys === 'email,fax_number,idempotencyKey,lang,name,notes,phone,role,start,visitorTz,weddingDate', `C: body keys ${keys}`);
  const doneText = await page.locator('.book__done').innerText();
  check(doneText.includes('Chicago time') && doneText.includes('La Paz time') && doneText.includes('ana@example.com'), `C: confirmation text ${JSON.stringify(doneText.slice(0, 200))}`);
  check((await page.locator('.book__done a[download]').getAttribute('href'))?.startsWith(`${stub.origin}/booking/manage/`), 'C: no calendar link');
  check((await page.locator('.book__done a', { hasText: 'Change or cancel the call' }).getAttribute('href'))?.startsWith(`${stub.origin}/booking/manage/`), 'C: no manage link');
  check(doneText.includes('More wedding, less stress.'), 'C: the slogan does not close the confirmation');
  const jar = await t.ctx.cookies();
  check(!jar.some((c) => c.name === 'gl_stub'), 'C: the API Set-Cookie was kept');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  check(await page.evaluate(() => document.activeElement?.matches('.final-cta__actions [data-book]')), 'C: focus did not return to the booking button');

  /* D: the focus trap. */
  await openDialog(page);
  await page.locator('label.book-time').first().waitFor();
  for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
  check(await page.evaluate(() => Boolean(document.activeElement?.closest('.book'))), 'D: Tab left the dialog');
  for (let i = 0; i < 40; i++) await page.keyboard.press('Shift+Tab');
  check(await page.evaluate(() => Boolean(document.activeElement?.closest('.book'))), 'D: Shift+Tab left the dialog');
  await page.keyboard.press('Escape');

  /* J: beacon events (the beacon flushes on hide). */
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(600);
  const events = S.hits.filter((h) => h.path === '/api/site/t').flatMap((h) => JSON.parse(h.body).events ?? []);
  const booking = events.filter((e) => e.k === 'booking').map((e) => e.a);
  check(booking.includes('opened') && booking.includes('slot') && booking.includes('booked'), `J: booking events ${JSON.stringify(booking)}`);
  check(booking.filter((a) => a === 'booked').length === 1, 'J: "booked" not sent exactly once');
  parsed('J booking');
  await done(t, 'A-D');
}

/* ---------- E: field checks, network failure, taken ---------- */
{
  reset();
  const t = await context();
  const { page } = t;
  await page.goto(on.url, { waitUntil: 'networkidle' });
  await openDialog(page);
  /* "Choose this time" with no time picked: a message, not a disabled button. */
  await page.getByRole('button', { name: 'Choose this time' }).click();
  check(await page.getByText('Pick a time first.').isVisible(), 'E: no message when no time is picked');
  await toDetails(page);
  const mark = S.hits.length;
  await dialogSubmit(page);
  check(await page.getByText('Write your name.').isVisible(), 'E: no name message');
  check(await page.getByText('Write an email address, like ana@example.com.').isVisible(), 'E: no email message');
  check(await page.evaluate(() => document.activeElement?.getAttribute('autocomplete') === 'name'), 'E: focus not on the first wrong field');
  check(S.hits.length === mark, 'E: a request went out with empty fields');
  await fillDetails(page);
  reset({ book: 'invalid-phone' });
  await page.getByLabel('WhatsApp (optional)').fill('+591 7000');
  await dialogSubmit(page);
  await page.getByText('Use digits, spaces and + only.').waitFor();
  check((await page.getByLabel('Your name').inputValue()) === 'Ana Pérez', 'E: input lost after a refusal');
  check(await page.evaluate(() => document.activeElement?.getAttribute('type') === 'tel'), 'E: focus not on the refused field');
  const keyAfterRefusal = JSON.parse(lastBook().body).idempotencyKey;

  reset({ book: 'abort' });
  await dialogSubmit(page);
  await page.getByText('Could not reach Guest-ly. Check your connection and try again.').waitFor();
  const k1 = JSON.parse(lastBook().body).idempotencyKey;
  check(k1 !== keyAfterRefusal, 'E: a refused request kept its key');
  reset({ book: 'booked' });
  await dialogSubmit(page);
  await page.locator('.book__done').waitFor();
  check(JSON.parse(lastBook().body).idempotencyKey === k1, 'E: the retry after no answer used a new key');
  await page.getByRole('button', { name: 'Close' }).click();

  reset({ book: 'taken' });
  await openDialog(page);
  await page.locator('label.book-time').first().waitFor();
  const firstTime = await page.evaluate(() => document.querySelector('.book-time input')?.value);
  await toDetails(page);
  await page.locator('.book__chosen .book-link').click();
  await page.locator('label.book-time').first().waitFor();
  check((await page.evaluate(() => document.querySelector('.book-time input:checked')?.value)) === firstTime, 'E: going back forgot the picked time');
  await toDetails(page);
  await fillDetails(page);
  await dialogSubmit(page);
  await page.getByText('That time was just taken. Pick another.').waitFor();
  const takenStart = JSON.parse(lastBook().body).start;
  check(takenStart === firstTime, 'E: the booked time is not the one picked');
  const shown = await page.evaluate(() => [...document.querySelectorAll('.book-time input')].map((i) => i.value));
  check(!shown.includes(takenStart), 'E: the taken time is still offered');
  check(await page.evaluate(() => document.querySelector('.book-time input:checked') === null), 'E: a time stays picked after "taken"');
  await done(t, 'E');
}

/* ---------- E: after no answer, focus, keys and the email limit ---------- */
{
  reset({ book: 'abort' });
  const t = await context();
  const { page } = t;
  await page.goto(on.url, { waitUntil: 'networkidle' });
  await openDialog(page);
  await toDetails(page);
  await fillDetails(page);
  await page.locator('.book button[type="submit"]').focus();
  await page.keyboard.press('Space');
  await page.getByText('Could not reach Guest-ly. Check your connection and try again.').waitFor();
  check(await page.evaluate(() => document.activeElement?.matches('.book button[type="submit"]')), `E: focus left the submit after no answer (${await page.evaluate(() => document.activeElement?.tagName)})`);
  for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
  check(await page.evaluate(() => Boolean(document.activeElement?.closest('.book'))), 'E: Tab left the dialog after no answer');
  const k1 = JSON.parse(lastBook().body).idempotencyKey;
  await pressBook(page);
  check(JSON.parse(lastBook().body).idempotencyKey === k1, 'E: the same time and email after no answer got a new key');
  await page.locator('.book').getByLabel('Email').fill('ana@example.org');
  await pressBook(page);
  const k2 = JSON.parse(lastBook().body).idempotencyKey;
  check(k2 !== k1, 'E: another email after no answer reused the key');
  await page.locator('.book__chosen .book-link').click();
  await page.locator('label.book-time').nth(1).click();
  await page.getByRole('button', { name: 'Choose this time' }).click();
  await page.locator('.book__fields').waitFor();
  await pressBook(page);
  const b3 = JSON.parse(lastBook().body);
  check(b3.idempotencyKey !== k2 && b3.email === 'ana@example.org', 'E: another time after no answer reused the key');

  S.mode.book = 'email_limit';
  await dialogSubmit(page);
  await page.getByText('You already booked today. Check your email for the details.').waitFor();
  check((await page.getByText('Could not reach Guest-ly').count()) === 0, 'E: email_limit shown as a connection failure');
  check((await page.locator('.book').getByLabel('Email').inputValue()) === 'ana@example.org' && (await page.getByLabel('Your name').inputValue()) === 'Ana Pérez', 'E: input lost after email_limit');
  check(await page.evaluate(() => Boolean(document.activeElement?.closest('.book'))), 'E: focus left the dialog after email_limit');
  const kLimit = JSON.parse(lastBook().body).idempotencyKey;
  S.mode.book = 'booked';
  await dialogSubmit(page);
  await page.locator('.book__done').waitFor();
  check(JSON.parse(lastBook().body).idempotencyKey !== kLimit, 'E: the key was kept after email_limit (a definite refusal)');
  await page.getByRole('button', { name: 'Back to the site' }).click();

  /* Escape still closes after no answer. */
  reset({ book: 'abort' });
  await openDialog(page);
  await toDetails(page);
  await fillDetails(page);
  await page.locator('.book button[type="submit"]').focus();
  await page.keyboard.press('Space');
  await page.getByText('Could not reach Guest-ly. Check your connection and try again.').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
  check((await page.getByRole('dialog').count()) === 0, 'E: Escape did not close the dialog after no answer');
  await done(t, 'E after no answer');
}

/* ---------- F, G: calm states ---------- */
for (const [mode, expect] of [
  [{ slots: 'closed' }, 'No times open right now'],
  [{ slots: 'unavailable' }, 'No times open right now'],
  [{ slots: 'limited' }, 'Could not load the times'],
  [{ slots: 'error' }, 'Could not load the times'],
  [{ slots: 'empty-next' }, 'No open times in these two weeks.'],
]) {
  reset(mode);
  const t = await context();
  const { page } = t;
  await page.goto(on.url, { waitUntil: 'networkidle' });
  await openDialog(page);
  await page.locator('.book__empty').waitFor();
  const txt = await page.locator('.book__empty').innerText();
  check(txt.includes(expect), `F ${mode.slots}: "${txt.slice(0, 80)}"`);
  check((await page.locator('label.book-time').count()) === 0, `F ${mode.slots}: a time grid shows`);
  if (expect.startsWith('No times')) {
    check((await page.locator('.book__empty a[href^="mailto:"]').count()) === 1, `F ${mode.slots}: no email link`);
    check((await page.locator('.book__empty a[href^="https://wa.me/"]').count()) === 1, `F ${mode.slots}: no WhatsApp link`);
  }
  if (mode.slots === 'error') {
    reset();
    await page.getByRole('button', { name: 'Load times again' }).click();
    await page.locator('label.book-time').first().waitFor();
  }
  if (mode.slots === 'empty-next') {
    const mark = S.hits.length;
    await page.locator('.book__empty .btn').click();
    await page.locator('label.book-time').first().waitFor();
    const read = apiHits(mark).find((h) => h.path.endsWith('/slots'));
    check(read && /^\d{4}-\d{2}-\d{2}$/.test(new URL(read.url, stub.origin).searchParams.get('from') ?? ''), 'F empty-next: the next read has no from day');
  }
  await done(t, `F ${mode.slots}`);
}
{
  reset({ book: 'replay' });
  const t = await context();
  const { page } = t;
  await page.goto(on.url, { waitUntil: 'networkidle' });
  await openDialog(page);
  await toDetails(page);
  await fillDetails(page);
  await dialogSubmit(page);
  await page.locator('.book__done').waitFor();
  const txt = await page.locator('.book__done').innerText();
  check(txt.includes('We sent the details and the link to your email.'), 'G: replay text');
  check((await page.locator('.book__done a').count()) === 0, 'G: replay shows links');
  reset({ book: 'closed' });
  await page.getByRole('button', { name: 'Back to the site' }).click();
  await openDialog(page);
  await toDetails(page);
  await fillDetails(page);
  await dialogSubmit(page);
  await page.locator('.book__empty').waitFor();
  check((await page.locator('.book__empty').innerText()).includes('No times open right now'), 'G: closed after the list loaded');
  await done(t, 'G');
}

/* ---------- H: ?book=demo in Spanish ---------- */
{
  reset();
  const t = await context({ lang: 'es', tz: 'America/Bogota' });
  const { page } = t;
  await page.goto(`${on.url}/?book=demo#faq`, { waitUntil: 'networkidle' });
  await page.getByRole('dialog').waitFor();
  await page.locator('label.book-time').first().waitFor();
  check((await page.locator('.book__title').innerText()) === 'Agendar una demo', 'H: title not in Spanish');
  check((await page.locator('.book__zone p').innerText()).includes('hora de Bogotá'), 'H: zone line not in Spanish');
  check(await page.evaluate(() => location.search === '' && location.hash === '#faq'), 'H: ?book=demo stayed in the URL');
  await done(t, 'H');
}

/* ---------- I: guides ---------- */
const guideBodies = (from) => S.hits.slice(from).filter((h) => h.path === '/api/public/guides/request');
const pressGuide = (page) => page.locator('.guides__submit').click();
{
  reset();
  const t = await context({ lang: 'es', tz: 'Europe/Madrid' });
  const { page } = t;
  const mark = S.hits.length;
  await page.goto(on.url, { waitUntil: 'networkidle' });
  await page.locator('.guides').waitFor();
  await page.locator('#guides').scrollIntoViewIfNeeded();
  const names = await page.locator('.guides-place__name').allInnerTexts();
  check(names.length === 7 && names[3] === 'Cancún y Riviera Maya', `I: cards not from the catalogue ${JSON.stringify(names)}`);
  check((await page.locator('.guides__consent').innerText()).trim() === 'Quiero recibir consejos de boda de Guest-ly', 'I: the tips label is not the catalogue sentence word for word');
  await page.getByRole('button', { name: 'Enviarme la guía' }).click();
  check(await page.getByText('Primero elige un destino.').isVisible(), 'I: no destination message');
  check(await page.getByText('Escribe un correo, como ana@ejemplo.com.').isVisible(), 'I: no email message');
  check(guideBodies(mark).length === 0, 'I: a guides request with empty fields');
  const consent = await page.locator('.guides__consent input');
  check(!(await consent.isChecked()), 'I: the tips box starts ticked');
  await page.locator('.guides-place').nth(4).click();
  await page.getByLabel('Tu correo').fill('ana@example.com');
  await page.getByRole('button', { name: 'Enviarme la guía' }).click();
  await page.locator('.guides-done').waitFor();
  const g = guideBodies(mark).at(-1);
  const body = JSON.parse(g.body);
  check(
    JSON.stringify(Object.keys(body).sort()) === JSON.stringify(['code', 'consentVersion', 'email', 'fax_number', 'lang', 'tips', 'visitorTz']),
    `I: body keys ${Object.keys(body).join()}`,
  );
  check(body.code === 'co-cartagena' && body.email === 'ana@example.com', `I: code or email ${g.body}`);
  check(body.lang === 'es' && body.visitorTz === 'Europe/Madrid' && body.tips === false, `I: body ${g.body}`);
  check(body.consentVersion === 'guide-tips-2026-11-05' && body.fax_number === '', 'I: consent version or honeypot');
  check(S.guideInputs.at(-1)?.code === 'co-cartagena' && S.guideInputs.at(-1)?.tips === false, 'I: the L7p parser did not accept the body');
  check(/^text\/plain/.test(g.headers['content-type'] ?? '') && !g.headers.cookie && !g.headers.referer, 'I: content type, cookie or referrer');
  check(!S.hits.some((h) => h.method === 'OPTIONS' && h.path.startsWith('/api/public/guides')), 'I: a preflight for a guides call');
  check((await page.locator('.guides-done').innerText()).includes('ana@example.com'), 'I: confirmation without the address');
  await page.getByRole('button', { name: 'Pedir otra guía' }).click();
  await page.locator('.guides-place').first().click();
  await page.locator('.guides__consent').click();
  await page.getByLabel('Tu correo').fill('ana@example.com');
  await page.getByRole('button', { name: 'Enviarme la guía' }).click();
  await page.locator('.guides-done').waitFor();
  const b2 = JSON.parse(guideBodies(mark).at(-1).body);
  check(b2.tips === true && b2.consentVersion === 'guide-tips-2026-11-05', `I: ticked body ${JSON.stringify(b2)}`);
  check(S.guideInputs.at(-1)?.tips === true, 'I: the L7p parser read a ticked box as unticked');

  /* 503: the email could not be sent; the input stays and a retry sends. */
  reset({ guide: 'unavailable' });
  await page.getByRole('button', { name: 'Pedir otra guía' }).click();
  await page.locator('.guides-place').nth(2).click();
  await page.getByLabel('Tu correo').fill('ana@example.com');
  const m503 = S.hits.length;
  await pressGuide(page);
  await page.locator('.guides__error--form').waitFor();
  check((await page.locator('.guides__error--form').innerText()) === 'No se pudo enviar la guía. Inténtalo de nuevo en un minuto.', 'I: 503 message');
  check((await page.getByLabel('Tu correo').inputValue()) === 'ana@example.com' && (await page.locator('.guides-place input').nth(2).isChecked()), 'I: input lost after 503');
  check(await page.evaluate(() => document.activeElement?.matches('.guides__submit')), `I: focus left the button after 503 (${await page.evaluate(() => document.activeElement?.tagName)})`);
  S.mode.guide = 'sent';
  await pressGuide(page);
  await page.locator('.guides-done').waitFor();
  check(guideBodies(m503).length === 2, 'I: the retry after 503 did not send');

  /* 409: switched off since the catalogue loaded; the panel becomes the line. */
  reset({ guide: 'closed' });
  await page.getByRole('button', { name: 'Pedir otra guía' }).click();
  await page.locator('.guides-place').first().click();
  await page.getByLabel('Tu correo').fill('ana@example.com');
  await pressGuide(page);
  await page.locator('.guides-done[role="status"]').waitFor();
  check((await page.locator('.guides-done').innerText()).startsWith('Las guías no están disponibles ahora.'), 'I: closed message');
  check((await page.locator('.guides__submit').count()) === 0, 'I: the send button stayed after 409');
  check(await page.locator('.guides__places').evaluate((f) => f.disabled), 'I: the cards can still be picked after 409');
  await page.waitForTimeout(100);
  check(await page.evaluate(() => Boolean(document.activeElement?.closest('#guides'))), 'I: focus fell to the page after 409');

  /* K: nothing on the device. */
  const store = await page.evaluate(() => ({ local: Object.keys(localStorage), session: sessionStorage.length, cookie: document.cookie }));
  check(store.local.join() === 'guestly-lang' && store.session === 0, `K: storage ${JSON.stringify(store)}`);
  check(!(await t.ctx.cookies()).some((c) => c.name !== 'portal_session'), 'K: a cookie was set');
  await done(t, 'I');
}

/* ---------- I: catalogue not open: nothing is added ---------- */
const faqNo = (page) => page.evaluate(() => document.querySelector('#faq')?.innerText.match(/№ \d+/)?.[0]);
/* Layout shifts not caused by input, summed from the moment this runs. */
const watchShifts = (page) =>
  page.evaluate(() => {
    window.__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
    }).observe({ type: 'layout-shift' });
  });
const shifts = (page) => page.evaluate(() => window.__cls);
const clsFromStart = (page) =>
  page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
const faqTop = (page) => page.evaluate(() => Math.round(document.getElementById('faq').getBoundingClientRect().top));
const slowly = (ms) => new Promise((r) => setTimeout(r, ms));
const scrollThrough = (page) =>
  page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
for (const catalogue of ['closed', 'unavailable', 'limited', 'error']) {
  for (const width of [390, 1440]) {
    reset({ catalogue });
    const t = await context({ width, lang: width === 390 ? 'es' : 'en' });
    const { page } = t;
    await clsFromStart(page);
    const mark = S.hits.length;
    await page.goto(on.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await scrollThrough(page);
    await page.waitForTimeout(500);
    const tag = `catalogue ${catalogue} ${width}`;
    check((await page.locator('#guides, form.guides, .guides-slot, .guides-done').count()) === 0, `I: ${tag}: guides markup in the page`);
    check((await page.getByText(/not available right now|no están disponibles/).count()) === 0, `I: ${tag}: a "not available" line in the page`);
    check((await faqNo(page)) === '№ 10', `I: ${tag}: the FAQ number is ${await faqNo(page)}`);
    check(apiHits(mark).filter((h) => h.path === '/api/public/guides').length === 1 && guideBodies(mark).length === 0, `I: ${tag}: requests`);
    check((await shifts(page)) < 0.02, `I: ${tag}: layout shift ${(await shifts(page)).toFixed(3)}`);
    await done(t, `I ${tag}`);
  }
}
for (const width of [390, 1440]) {
  /* ?guide=all (the expired guide page's "Request a new link") with guides closed: nothing, no line, no scroll. */
  reset({ catalogue: 'closed' });
  const t = await context({ width });
  const { page } = t;
  await clsFromStart(page);
  await page.goto(`${on.url}/?guide=all`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  check((await page.locator('#guides').count()) === 0, `I: ?guide=all closed ${width}: a section in the page`);
  check((await page.getByText(/not available right now/).count()) === 0, `I: ?guide=all closed ${width}: a "not available" line`);
  check((await page.evaluate(() => scrollY)) === 0, `I: ?guide=all closed ${width}: the page scrolled`);
  check(!page.url().includes('guide='), `I: ?guide=all closed ${width}: left in the URL`);
  check((await shifts(page)) < 0.02, `I: ?guide=all closed ${width}: layout shift ${(await shifts(page)).toFixed(3)}`);
  check((await faqNo(page)) === '№ 10', `I: ?guide=all closed ${width}: FAQ number ${await faqNo(page)}`);
  await done(t, `I ?guide=all closed ${width}`);
}
for (const width of [390, 1440]) {
  /* A slow open answer while the visitor reads the FAQ: nothing goes in while the
     FAQ is on screen; once the visitor has scrolled on, it goes in above them
     and the page scrolls by its height, so what they read does not move. */
  reset();
  let release = () => {};
  S.holdCatalogue = new Promise((r) => (release = r));
  const t = await context({ width });
  const { page } = t;
  /* Not networkidle: the held read keeps the network busy. */
  await page.goto(on.url, { waitUntil: 'load' });
  await page.waitForRequest(/\/api\/public\/guides$/, { timeout: 8000 });
  await page.evaluate(() => document.getElementById('faq').scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.waitForTimeout(300);
  await watchShifts(page);
  release();
  S.holdCatalogue = null;
  await page.waitForTimeout(900);
  check((await page.locator('#guides').count()) === 0, `I: slow open ${width}: the section went in while the FAQ was on screen`);
  check(Math.abs((await faqTop(page)) - 80) <= 2 || (await faqTop(page)) <= 82, `I: slow open ${width}: the FAQ moved to ${await faqTop(page)}`);
  await page.evaluate(() => window.scrollBy({ top: 900, behavior: 'instant' }));
  const item = async () => page.evaluate(() => Math.round(document.querySelector('.faq-human').getBoundingClientRect().top));
  const before = await item();
  await page.waitForFunction(() => document.getElementById('guides'), null, { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(400);
  check((await page.locator('#guides').count()) === 1, `I: slow open ${width}: the section did not go in after the visitor scrolled on`);
  check(Math.abs((await item()) - before) <= 1, `I: slow open ${width}: what the visitor reads moved ${before} to ${await item()}`);
  check((await shifts(page)) < 0.02, `I: slow open ${width}: layout shift ${(await shifts(page)).toFixed(3)} (budget 0.02)`);
  check((await faqNo(page)) === '№ 11', `I: slow open ${width}: FAQ number ${await faqNo(page)}`);
  await done(t, `I slow open ${width}`);
}
for (const width of [390, 1440]) {
  /* The visitor is above the section when the answer comes: it goes in below the screen, nothing moves. */
  reset();
  S.holdCatalogue = slowly(1500);
  const t = await context({ width });
  const { page } = t;
  await clsFromStart(page);
  await page.goto(on.url, { waitUntil: 'load' });
  S.holdCatalogue = null;
  await page.waitForFunction(() => document.getElementById('guides'), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
  check((await page.locator('#guides').count()) === 1, `I: slow open at the top ${width}: the section did not go in`);
  check((await page.evaluate(() => scrollY)) === 0, `I: slow open at the top ${width}: the page scrolled`);
  check((await shifts(page)) < 0.02, `I: slow open at the top ${width}: layout shift ${(await shifts(page)).toFixed(3)}`);
  await done(t, `I slow open top ${width}`);
}
for (const width of [360, 390, 640]) {
  /* Landing on /#faq with a slow answer: the FAQ stays where it is and nothing goes in while it is on screen. */
  reset();
  S.holdCatalogue = slowly(400);
  const t = await context({ width });
  const { page } = t;
  await clsFromStart(page);
  await page.goto(`${on.url}/#faq`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  S.holdCatalogue = null;
  const cls = await shifts(page);
  check(cls < 0.02, `I: /#faq ${width}: layout shift ${cls.toFixed(3)} (budget 0.02)`);
  check(Math.abs((await faqTop(page)) - 80) <= 2, `I: /#faq ${width}: the FAQ is at ${await faqTop(page)}, not 80`);
  await done(t, `I /#faq ${width}`);
}
for (const guide of ['sent', 'closed']) {
  /* A slow answer (L7p answers after sending the email) at 390 with the
     button at the bottom of the screen: the answer takes the panel's place
     and box, nothing below moves. */
  reset({ guide });
  const t = await context({ width: 390 });
  const { page } = t;
  await page.goto(on.url, { waitUntil: 'networkidle' });
  await page.locator('form.guides').waitFor();
  await page.locator('#guides').scrollIntoViewIfNeeded();
  await page.locator('.guides-place').nth(2).click();
  await page.getByLabel('Your email').fill('ana@example.com');
  await page.evaluate(() => {
    const r = document.querySelector('.guides__submit').getBoundingClientRect();
    window.scrollBy({ top: r.bottom - innerHeight + 10, behavior: 'instant' });
  });
  await page.waitForTimeout(200);
  let release = () => {};
  S.holdGuide = new Promise((r) => (release = r));
  const before = { faq: await faqTop(page), slot: await page.locator('#guides .guides-slot').evaluate((e) => Math.round(e.getBoundingClientRect().height)) };
  await pressGuide(page);
  await page.waitForTimeout(700);
  await watchShifts(page);
  release();
  S.holdGuide = null;
  await page.locator('.guides-done').waitFor();
  await page.waitForTimeout(400);
  const cls = await shifts(page);
  check(cls < 0.02, `I: slow ${guide} at 390: layout shift ${cls.toFixed(3)} (budget 0.02)`);
  const after = { faq: await faqTop(page), slot: await page.locator('#guides .guides-slot').evaluate((e) => Math.round(e.getBoundingClientRect().height)) };
  check(Math.abs(after.faq - before.faq) <= 1 && Math.abs(after.slot - before.slot) <= 1, `I: slow ${guide} at 390: ${JSON.stringify(before)} became ${JSON.stringify(after)}`);
  check(await page.evaluate(() => Boolean(document.activeElement?.closest('#guides .guides-done'))), `I: slow ${guide} at 390: focus is not on the answer`);
  await done(t, `I slow ${guide}`);
}

/* ---------- I: ?guide=<code> and ?guide=all (the expired link's "Request a new link") ---------- */
{
  reset();
  const t = await context();
  const { page } = t;
  await page.goto(`${on.url}/?guide=mx-cancun-riviera-maya#x`, { waitUntil: 'networkidle' });
  await page.locator('.guides-place.on').waitFor();
  check((await page.locator('.guides-place.on .guides-place__name').innerText()) === 'Cancún and Riviera Maya', 'I: ?guide= did not pick that guide');
  const focused = await page
    .waitForFunction(() => document.activeElement?.matches('.guides input[type="email"]'), null, { timeout: 3000 })
    .then(() => true, () => false);
  check(focused, 'I: ?guide= did not focus the email');
  check(await page.evaluate(() => { const r = document.getElementById('guides').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), 'I: ?guide= did not scroll to the section');
  check(new URL(page.url()).search === '' && new URL(page.url()).hash === '#x', `I: ?guide= left in the URL ${page.url()}`);
  await done(t, 'I ?guide=code');
}
{
  reset();
  const t = await context({ lang: 'es' });
  const { page } = t;
  await page.goto(`${on.url}/?guide=all`, { waitUntil: 'networkidle' });
  await page.locator('.guides').waitFor();
  check((await page.locator('.guides-place.on').count()) === 0, 'I: ?guide=all picked a guide');
  check(await page.evaluate(() => { const r = document.getElementById('guides').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), 'I: ?guide=all did not scroll to the section');
  check(!page.url().includes('guide='), 'I: ?guide=all left in the URL');
  await done(t, 'I ?guide=all');
}

/* ---------- J for guides: the beacon names the place ---------- */
{
  reset();
  const t = await context({ beacon: true });
  const { page } = t;
  await page.goto(on.url, { waitUntil: 'networkidle' });
  await page.locator('.guides').waitFor();
  await page.locator('#guides').scrollIntoViewIfNeeded();
  await page.locator('.guides-place').nth(1).click();
  await page.getByLabel('Your email').fill('ana@example.com');
  const mark = S.hits.length;
  await page.getByRole('button', { name: 'Email me the guide' }).click();
  await page.locator('.guides-done').waitFor();
  const dest = JSON.parse(S.hits.slice(mark).find((h) => h.path === '/api/public/guides/request').body).code;
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(600);
  const events = S.hits.filter((h) => h.path === '/api/site/t').flatMap((h) => JSON.parse(h.body).events ?? []);
  check(events.some((e) => e.k === 'guide' && e.id === dest), `J: no guide event for ${dest}`);
  parsed('J guides');
  await done(t, 'J guides');
}

/* ---------- L: privacy ---------- */
for (const lang of ['en', 'es']) {
  const t = await context({ lang });
  const { page } = t;
  await page.goto(`${on.url}/privacy/`, { waitUntil: 'networkidle' });
  const heads = await page.locator('.legal-page__section h2').allInnerTexts();
  const want = lang === 'es' ? ['Llamadas de demo', 'Guías de destino'] : ['Demo calls', 'Destination guides'];
  check(want.every((h) => heads.includes(h)), `L ${lang}: privacy headings ${JSON.stringify(heads)}`);
  await done(t, `L ${lang}`);
}

/* ---------- M: 390 phone ---------- */
{
  reset();
  const t = await context({ width: 390 });
  const { page } = t;
  await page.goto(on.url, { waitUntil: 'networkidle' });
  await page.locator('.nav__burger').click();
  await page.locator('.nav__menu-book [data-book]').click();
  await page.locator('label.book-time').first().waitFor();
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('.book button, .book a, .book .book-day:not(.off), .book .book-time')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => [el.className, Math.round(el.getBoundingClientRect().height)])
      .filter(([, h]) => h < 44),
  );
  check(small.length === 0, `M: dialog targets under 44 px ${JSON.stringify(small)}`);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'M: sideways scroll with the dialog open');
  const strip = await page.evaluate(() => {
    const el = document.querySelector('.book-days');
    return el.scrollWidth > el.clientWidth;
  });
  check(strip, 'M: the day strip does not scroll sideways on a phone');
  await page.keyboard.press('Escape');
  await page.locator('.guides').waitFor();
  await page.locator('#guides').scrollIntoViewIfNeeded();
  const smallG = await page.evaluate(() =>
    [...document.querySelectorAll('.guides-place, .guides button, .guides__consent, .guides input[type="email"]')]
      .map((el) => [el.className, Math.round(el.getBoundingClientRect().height)])
      .filter(([, h]) => h < 44),
  );
  check(smallG.length === 0, `M: guides targets under 44 px ${JSON.stringify(smallG)}`);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'M: sideways scroll at the guides section');
  await done(t, 'M');
}

/* ---------- W: booking from the order wizard's confirmation ---------- */
{
  reset();
  const t = await context();
  const { page } = t;
  const orders = [];
  /* The order notification: answered here, never sent to formsubmit.co. */
  await t.ctx.route('https://formsubmit.co/**', (route) => {
    orders.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":"true"}' });
  });
  await page.goto(on.url, { waitUntil: 'networkidle' });
  await page.locator('[data-track="hero-start"]').click();
  await page.locator('.wiz-range').first().click();
  await page.locator('.wiz input[type="date"]').fill('2027-05-15');
  await page.locator('.wiz__body label input:not([type])').first().fill('La Paz');
  await page.locator('.wiz__continue').click();
  await page.locator('.wiz button.btn--gold').click();
  await page.locator('.wiz input[autocomplete="name"]').fill('Ana Pérez');
  await page.locator('.wiz input[type="email"]').fill('ana@example.com');
  await page.locator('.wiz button[type="submit"]').click();
  await page.locator('.wiz-pay').waitFor();
  check(orders.length === 1, `W: order notifications ${orders.length}`);
  await page.locator('.book-line--wizard [data-book]').click();
  await page.locator('.book').waitFor();
  check((await page.locator('.wiz-pay').count()) === 1, 'W: the wizard and its Pay step closed under the booking dialog');
  check(
    await page.evaluate(() => {
      const r = document.querySelector('.book').getBoundingClientRect();
      return Boolean(document.elementFromPoint(r.left + r.width / 2, r.top + 20)?.closest('.book'));
    }),
    'W: the booking dialog is not above the wizard',
  );
  await page.keyboard.press('Escape');
  await page.locator('.book').waitFor({ state: 'detached' });
  check((await page.locator('.wiz-pay').count()) === 1, 'W: Escape in the booking dialog closed the wizard too');
  check(await page.evaluate(() => document.documentElement.classList.contains('wizard-locked')), 'W: the page unlocked while the wizard is open');
  check(await page.evaluate(() => document.activeElement?.getAttribute('data-track') === 'book-wizard'), 'W: focus did not return to the wizard button');
  await page.keyboard.press('Escape');
  await page.locator('.wiz').waitFor({ state: 'detached' });
  check(!(await page.evaluate(() => document.documentElement.classList.contains('wizard-locked'))), 'W: the page stayed locked after the wizard closed');
  check(orders.length === 1, 'W: the order was sent again');
  await done(t, 'W');
}

/* ---------- O: no crypto.randomUUID ---------- */
{
  reset();
  const t = await context();
  const { page } = t;
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, 'randomUUID', { configurable: true, value: undefined });
  });
  await page.goto(on.url, { waitUntil: 'networkidle' });
  await openDialog(page);
  await toDetails(page);
  await page.locator('.book__fields input[autocomplete="name"]').fill('Ana Pérez');
  await page.locator('.book__fields input[type="email"]').fill('ana@example.com');
  await dialogSubmit(page);
  await page.locator('.book__done').waitFor({ timeout: 8000 }).catch(() => {});
  check((await page.locator('main#main').count()) === 1, 'O: the page went blank without crypto.randomUUID');
  check(/^[A-Za-z0-9_-]{8,80}$/.test(JSON.parse(lastBook()?.body ?? '{}').idempotencyKey ?? ''), 'O: no valid key without crypto.randomUUID');
  check((await page.locator('.book__done').count()) === 1, 'O: no confirmation without crypto.randomUUID');
  await done(t, 'O');
}

/* ---------- N: off ---------- */
{
  const t = await context();
  const { page } = t;
  const mark = S.hits.length;
  await page.goto(`${off.url}/?book=demo`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  check((await page.locator('[data-book]').count()) === 0, 'N: a booking button in the off build');
  check((await page.locator('#guides').count()) === 0, 'N: the guides section in the off build');
  check((await page.getByRole('dialog').count()) === 0, 'N: ?book=demo opened something in the off build');
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
  });
  await page.locator('.faq-human').hover();
  check((await page.locator('.faq-human a[href^="mailto:"]').count()) === 1, 'N: the FAQ email path is gone');
  check(S.hits.length === mark, 'N: the off build sent a request to the API host');
  await page.goto(`${off.url}/privacy/`, { waitUntil: 'networkidle' });
  const heads = await page.locator('.legal-page__section h2').allInnerTexts();
  check(!heads.includes('Demo calls') && !heads.includes('Destination guides'), 'N: privacy paragraphs in the off build');
  await done(t, 'N');
}

await browser.close();
on.server.close();
off.server.close();
await stub.close();
rmSync(work, { recursive: true, force: true });

if (failures.length) {
  for (const f of failures) console.error(`test-booking: ${f}`);
  console.error(`test-booking FAILED: ${failures.length} of ${checks} checks`);
  process.exit(1);
}
console.log(
  `${parseBeacon ? 'test-booking: every beacon batch passed the portal parser\n' : ''}test-booking clean: ${checks} checks (prefetch on intent, keyboard booking, no cookie or preflight, every API answer, guides form and consent, beacon events, nothing stored, privacy lines, 390 targets, off build silent); dialog chunk ${sizes.modal} B gzip, guides form ${sizes.guidesForm} B; initial JS off ${initial.off} B, on ${initial.on} B (budget ${INITIAL_JS_BUDGET}${initial.on > INITIAL_JS_BUDGET ? ': a real build with both switches on fails check-seo until it fits' : ''})`,
);

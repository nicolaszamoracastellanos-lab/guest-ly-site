/* #22 demo booking and #50 destination guides on the landing (Playwright),
   against a local stub of the API (scripts/lib/booking-stub.mjs), never
   app.guest-ly.com. Builds the page twice into a temp folder (never
   cinematic/dist): both switches on (API and beacon pointed at the stub on
   another port of localhost: same site, other origin, like guest-ly.com and
   app.guest-ly.com), and both off (today's build). Proves:
   ON
   A. load and scroll: no API request; the dialog is not in the prerendered
      page; three booking buttons and the guides section are.
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
   F. closed, unavailable, 429, 500 and empty-with-next answers each show
      their calm state (contact links, retry, next open day).
   G. replay: "check your email", no links.
   H. ?book=demo opens the dialog in the stored language and leaves the URL.
   I. guides: the form loads only near the section; empty and bad input
      messages; the request names the destination, page language, zone,
      consent false and no consent text; ticked: consent true with the exact
      sentence; the confirmation; 503 shows the calm message.
   J. beacon events: booking opened, slot, booked and guide <id>.
   K. nothing on the device: no cookie, no sessionStorage, localStorage holds
      only the language the visitor picked.
   L. privacy page shows the demo-call and guides paragraphs (EN, ES).
   M. 390 phone: no sideways scroll, 44 px targets in the dialog and form.
   OFF
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
buildSite(onDir, { GL_BOOKING_ENABLED: '1', GL_GUIDES_ENABLED: '1', GL_API_ORIGIN: stub.origin, VITE_SITE_BEACON_URL: `${stub.origin}/api/site/t` });
buildSite(offDir, { GL_BOOKING_ENABLED: '0', GL_GUIDES_ENABLED: '0' });
const on = await serveDir(onDir);
const off = await serveDir(offDir);

/* Sizes, for the log. */
const gz = (dir, re) =>
  readdirSync(join(dir, 'assets'))
    .filter((f) => re.test(f))
    .reduce((n, f) => n + gzipSync(readFileSync(join(dir, 'assets', f)), { level: 9 }).length, 0);
const sizes = { modal: gz(onDir, /^BookingModal-.*\.js$/), guidesForm: gz(onDir, /^GuidesForm-.*\.js$/) };
check(sizes.modal > 0 && sizes.modal <= 12000, `booking dialog chunk ${sizes.modal} B gzip (budget 12 KB)`);
check(sizes.guidesForm > 0 && sizes.guidesForm <= 6000, `guides form chunk ${sizes.guidesForm} B gzip (budget 6 KB)`);
check(readdirSync(join(offDir, 'assets')).every((f) => !/^(BookingModal|GuidesForm)-/.test(f)), 'off build still has a booking or guides chunk');
const onHtml = readFileSync(join(onDir, 'index.html'), 'utf8');
check((onHtml.match(/data-book=""/g) ?? []).length === 3, `on: expected 3 booking buttons in the prerendered page (pricing, FAQ, final), found ${(onHtml.match(/data-book=""/g) ?? []).length}`);
check(!onHtml.includes('role="dialog"'), 'on: a dialog is in the prerendered page');
check(onHtml.includes('id="guides"') && !onHtml.includes('class="guides"'), 'on: the guides header is prerendered and the form is not');

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
  S.mode = { slots: 'open', book: 'booked', guide: 'sent', ...m };
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
  await page.getByLabel('Email').fill('ana@example.com');
}
const dialogSubmit = (page) => page.locator('.book button[type="submit"]').click();
const lastBook = () => [...S.hits].reverse().find((h) => h.path.endsWith('/book'));

/* ---------- A, B, C, D, J ---------- */
{
  reset();
  const t = await context({ beacon: true });
  const { page } = t;
  const mark = S.hits.length;
  await page.goto(on.url, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
  check(apiHits(mark).filter((h) => h.path.includes('/booking/')).length === 0, 'A: a booking API request before any intent');
  check(apiHits(mark).filter((h) => h.path.includes('/guides/')).length === 0, 'A: a guides API request before any press');

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
{
  reset();
  const t = await context({ lang: 'es', tz: 'Europe/Madrid' });
  const { page } = t;
  const mark = S.hits.length;
  await page.goto(on.url, { waitUntil: 'networkidle' });
  check((await page.locator('.guides').count()) === 0, 'I: the guides form loaded before the section came near');
  await page.locator('#guides').scrollIntoViewIfNeeded();
  await page.locator('.guides').waitFor();
  await page.getByRole('button', { name: 'Enviarme la guía' }).click();
  check(await page.getByText('Primero elige un destino.').isVisible(), 'I: no destination message');
  check(await page.getByText('Escribe un correo, como ana@ejemplo.com.').isVisible(), 'I: no email message');
  check(apiHits(mark).length === 0, 'I: a guides request with empty fields');
  const consent = await page.locator('.guides__consent input');
  check(!(await consent.isChecked()), 'I: the tips box starts ticked');
  await page.locator('.guides-place').nth(4).click();
  await page.getByLabel('Tu correo').fill('ana@example.com');
  await page.getByRole('button', { name: 'Enviarme la guía' }).click();
  await page.locator('.guides-done').waitFor();
  const g = [...S.hits].reverse().find((h) => h.path === '/api/public/guides/request');
  const body = JSON.parse(g.body);
  const placeId = await page.evaluate(() => null);
  check(/^[a-z0-9-]+$/.test(body.destination), `I: destination ${body.destination}`);
  check(body.lang === 'es' && body.visitorTz === 'Europe/Madrid' && body.consent === false && !('consentText' in body), `I: body ${g.body}`);
  check(body.consentVersion === 'guides-tips-2026-11-05' && /^[A-Za-z0-9_-]{8,80}$/.test(body.idempotencyKey) && body.fax_number === '', 'I: version, key or honeypot');
  check(/^text\/plain/.test(g.headers['content-type'] ?? '') && !g.headers.cookie && !g.headers.referer, 'I: content type, cookie or referrer');
  check(!S.hits.some((h) => h.method === 'OPTIONS' && h.path.startsWith('/api/public/guides/')), 'I: a preflight for the guide request');
  check((await page.locator('.guides-done').innerText()).includes('ana@example.com'), 'I: confirmation without the address');
  void placeId;
  await page.getByRole('button', { name: 'Pedir otra guía' }).click();
  await page.locator('.guides-place').first().click();
  await page.locator('.guides__consent').click();
  await page.getByLabel('Tu correo').fill('ana@example.com');
  await page.getByRole('button', { name: 'Enviarme la guía' }).click();
  await page.locator('.guides-done').waitFor();
  const b2 = JSON.parse([...S.hits].reverse().find((h) => h.path === '/api/public/guides/request').body);
  check(b2.consent === true && b2.consentText === 'Envíame también consejos de Guest-ly para organizar la boda', `I: ticked body ${JSON.stringify(b2)}`);
  reset({ guide: 'closed' });
  await page.getByRole('button', { name: 'Pedir otra guía' }).click();
  await page.locator('.guides-place').first().click();
  await page.getByLabel('Tu correo').fill('ana@example.com');
  await page.getByRole('button', { name: 'Enviarme la guía' }).click();
  await page.locator('.guides__error--form').waitFor();
  check((await page.locator('.guides__error--form').innerText()).startsWith('Las guías no están disponibles ahora.'), 'I: closed message');
  check((await page.getByLabel('Tu correo').inputValue()) === 'ana@example.com', 'I: input lost after closed');

  /* K: nothing on the device. */
  const store = await page.evaluate(() => ({ local: Object.keys(localStorage), session: sessionStorage.length, cookie: document.cookie }));
  check(store.local.join() === 'guestly-lang' && store.session === 0, `K: storage ${JSON.stringify(store)}`);
  check(!(await t.ctx.cookies()).some((c) => c.name !== 'portal_session'), 'K: a cookie was set');
  await done(t, 'I');
}

/* ---------- J for guides: the beacon names the place ---------- */
{
  reset();
  const t = await context({ beacon: true });
  const { page } = t;
  await page.goto(on.url, { waitUntil: 'networkidle' });
  await page.locator('#guides').scrollIntoViewIfNeeded();
  await page.locator('.guides').waitFor();
  await page.locator('.guides-place').nth(1).click();
  await page.getByLabel('Your email').fill('ana@example.com');
  const mark = S.hits.length;
  await page.getByRole('button', { name: 'Email me the guide' }).click();
  await page.locator('.guides-done').waitFor();
  const dest = JSON.parse(S.hits.slice(mark).find((h) => h.path === '/api/public/guides/request').body).destination;
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
  await page.locator('#guides').scrollIntoViewIfNeeded();
  await page.locator('.guides').waitFor();
  const smallG = await page.evaluate(() =>
    [...document.querySelectorAll('.guides-place, .guides button, .guides__consent, .guides input[type="email"]')]
      .map((el) => [el.className, Math.round(el.getBoundingClientRect().height)])
      .filter(([, h]) => h < 44),
  );
  check(smallG.length === 0, `M: guides targets under 44 px ${JSON.stringify(smallG)}`);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'M: sideways scroll at the guides section');
  await done(t, 'M');
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
  `${parseBeacon ? 'test-booking: every beacon batch passed the portal parser\n' : ''}test-booking clean: ${checks} checks (prefetch on intent, keyboard booking, no cookie or preflight, every API answer, guides form and consent, beacon events, nothing stored, privacy lines, 390 targets, off build silent); dialog chunk ${sizes.modal} B gzip, guides form ${sizes.guidesForm} B`,
);

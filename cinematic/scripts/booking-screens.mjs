/* Screens of #22 (booking dialog) and #50 (guides section) in every state,
   against a local stub of the API (never app.guest-ly.com): builds the page
   with both switches on into a temp folder, prerenders it, serves it, and
   shoots night and day, EN and ES, 390x844 and 1440x900.
   Also "unreachable" shots (the booking API gives no answer, the guides are closed): the same
   page parts in the booking build and in a booking-off build, which must match byte for byte in
   markup, with a pixel diff of the three parts reported (--no-unreachable skips them).
   Usage: node scripts/booking-screens.mjs <outDir> [--states=times,done] [--widths=390,1440]
   The guides come from the stub's catalogue (the landing holds none). */

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { startStub } from './lib/booking-stub.mjs';
import { buildSite, serveDir } from './lib/temp-site.mjs';

const args = process.argv.slice(2);
const outDir = resolve(args.find((a) => !a.startsWith('--')) || 'booking-shots');
const flag = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const pick = flag('states')?.split(',');
const widths = (flag('widths') || '390,1440').split(',').map(Number);
const themes = (flag('themes') || 'night,day').split(',');
const langs = (flag('langs') || 'en,es').split(',');
mkdirSync(outDir, { recursive: true });

const stub = await startStub();
const work = mkdtempSync(join(tmpdir(), 'gl-book-shots-'));
console.log('booking-screens: building with booking and guides on (stub API)');
buildSite(work, { GL_BOOKING_ENABLED: '1', GL_GUIDES_ENABLED: '1', GL_REVIEWS_ENABLED: '0', GL_API_ORIGIN: stub.origin });
const site = await serveDir(work);
const offWork = mkdtempSync(join(tmpdir(), 'gl-book-shots-off-'));
const withUnreachable = !args.includes('--no-unreachable');
if (withUnreachable) buildSite(offWork, { GL_BOOKING_ENABLED: '0', GL_GUIDES_ENABLED: '0', GL_REVIEWS_ENABLED: '0' });
const offSite = withUnreachable ? await serveDir(offWork) : null;

const reset = (m = {}) => {
  stub.state.mode = { slots: 'open', book: 'booked', catalogue: 'open', guide: 'sent', ...m };
  stub.state.holdCatalogue = null;
  stub.state.taken = [];
};

async function openBooking(page, sel = '.final-cta__actions [data-book]') {
  await page.locator(sel).scrollIntoViewIfNeeded();
  await page.locator(sel).click();
  await page.locator('.book').waitFor();
}
async function toDetails(page) {
  await page.locator('label.book-time').first().waitFor();
  await page.locator('label.book-time').first().click();
  await page.getByRole('button', { name: /Choose this time|Elegir este horario/ }).click();
  await page.locator('.book__fields').waitFor();
}
async function fill(page, name = 'María Fernanda Quispe de la Cruz y Alejandro Rodríguez', email = 'maria@example.com') {
  await page.locator('.book__fields input[autocomplete="name"]').fill(name);
  await page.locator('.book__fields input[type="email"]').fill(email);
  await page.locator('.book-role').first().click();
  await page.locator('.book__fields input[type="tel"]').fill('+591 70000000');
}
const submit = (page) => page.locator('.book button[type="submit"]').click();

const STATES = {
  'booking-loading': async (page) => {
    let release;
    stub.state.holdSlots = new Promise((r) => (release = r));
    await openBooking(page);
    await page.locator('.book__skeleton').waitFor();
    return () => {
      release();
      stub.state.holdSlots = null;
    };
  },
  'booking-times': async (page) => {
    await openBooking(page);
    await page.locator('label.book-time').first().click();
  },
  'booking-zone': async (page) => {
    await openBooking(page);
    await page.getByRole('button', { name: /Change time zone|Cambiar zona horaria/ }).click();
  },
  'booking-details': async (page) => {
    await openBooking(page);
    await toDetails(page);
    await fill(page);
  },
  'booking-errors': async (page) => {
    await openBooking(page);
    await toDetails(page);
    await page.locator('.book__fields input[type="tel"]').fill('call me');
    await submit(page);
  },
  'booking-network': async (page) => {
    reset({ book: 'abort' });
    await openBooking(page);
    await toDetails(page);
    await fill(page);
    await submit(page);
    await page.locator('.book__error--form').waitFor();
  },
  'booking-email-limit': async (page) => {
    reset({ book: 'email_limit' });
    await openBooking(page);
    await toDetails(page);
    await fill(page);
    await submit(page);
    await page.locator('.book__error--form').waitFor();
  },
  'booking-done': async (page) => {
    await openBooking(page);
    await toDetails(page);
    await fill(page);
    await submit(page);
    await page.locator('.book__done').waitFor();
  },
  'booking-replay': async (page) => {
    reset({ book: 'replay' });
    await openBooking(page);
    await toDetails(page);
    await fill(page);
    await submit(page);
    await page.locator('.book__done').waitFor();
  },
  'booking-taken': async (page) => {
    reset({ book: 'taken' });
    await openBooking(page);
    await toDetails(page);
    await fill(page);
    await submit(page);
    await page.locator('.book__notice').waitFor();
  },
  'booking-closed': async (page) => {
    reset({ slots: 'closed' });
    await openBooking(page);
    await page.locator('.book__empty').waitFor();
  },
  'booking-empty-next': async (page) => {
    reset({ slots: 'empty-next' });
    await openBooking(page);
    await page.locator('.book__empty').waitFor();
  },
  'booking-error': async (page) => {
    reset({ slots: 'error' });
    await openBooking(page);
    await page.locator('.book__empty').waitFor();
  },
  'page-pricing-line': async (page) => {
    await page.locator('.book-line--pricing').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -window.innerHeight / 2));
  },
  'page-faq': async (page) => {
    await page.locator('#faq').scrollIntoViewIfNeeded();
  },
  'page-final': async (page) => {
    await page.locator('.final-cta').scrollIntoViewIfNeeded();
  },
  'page-menu': async (page, w) => {
    if (w > 1000) return 'skip';
    await page.locator('.nav__burger').click();
    await page.locator('.nav__menu-book [data-book]').waitFor();
  },
  'guides-loading': async (page) => {
    let release;
    stub.state.holdCatalogue = new Promise((r) => (release = r));
    await page.locator('#guides').scrollIntoViewIfNeeded();
    await page.locator('.guides-skeleton').waitFor();
    await page.locator('#guides').scrollIntoViewIfNeeded();
    return () => release();
  },
  'guides-link': async (page) => {
    await page.goto(`${site.url}/?guide=mx-cancun-riviera-maya`, { waitUntil: 'networkidle' });
    await page.locator('.guides-place.on').waitFor();
    await page.waitForTimeout(300);
  },
  'guides-form': async (page) => {
    await page.locator('#guides').scrollIntoViewIfNeeded();
    await page.locator('.guides').waitFor();
    await page.locator('#guides').scrollIntoViewIfNeeded();
  },
  'guides-errors': async (page) => {
    await page.locator('#guides').scrollIntoViewIfNeeded();
    await page.locator('.guides').waitFor();
    await page.locator('.guides__submit').click();
    await page.locator('#guides').scrollIntoViewIfNeeded();
  },
  'guides-filled': async (page) => {
    await page.locator('#guides').scrollIntoViewIfNeeded();
    await page.locator('.guides').waitFor();
    await page.locator('.guides-place').nth(4).click();
    await page.locator('.guides input[type="email"]').fill('maria@example.com');
    await page.locator('.guides__consent').click();
    await page.locator('#guides').scrollIntoViewIfNeeded();
  },
  'guides-done': async (page) => {
    await page.locator('#guides').scrollIntoViewIfNeeded();
    await page.locator('.guides').waitFor();
    await page.locator('.guides-place').nth(3).click();
    await page.locator('.guides input[type="email"]').fill('maria@example.com');
    await page.locator('.guides__submit').click();
    await page.locator('.guides-done').waitFor();
    await page.locator('#guides').scrollIntoViewIfNeeded();
  },
  'guides-retry': async (page) => {
    reset({ guide: 'unavailable' });
    await page.locator('#guides').scrollIntoViewIfNeeded();
    await page.locator('.guides').waitFor();
    await page.locator('.guides-place').first().click();
    await page.locator('.guides input[type="email"]').fill('maria@example.com');
    await page.locator('.guides__submit').click();
    await page.locator('.guides__error--form').waitFor();
    await page.locator('.guides__side').scrollIntoViewIfNeeded();
  },
  'guides-closed': async (page) => {
    reset({ guide: 'closed' });
    await page.locator('#guides').scrollIntoViewIfNeeded();
    await page.locator('.guides').waitFor();
    await page.locator('.guides-place').first().click();
    await page.locator('.guides input[type="email"]').fill('maria@example.com');
    await page.locator('.guides__submit').click();
    await page.locator('.guides-done').waitFor();
    await page.locator('#guides').scrollIntoViewIfNeeded();
  },
  'guides-hidden': async (page) => {
    /* Closed while the section is still below the viewport: it goes away. */
    reset({ catalogue: 'closed' });
    await page.evaluate(() => {
      const top = document.getElementById('guides').getBoundingClientRect().top + scrollY;
      window.scrollTo({ top: top - innerHeight - 300, behavior: 'instant' });
    });
    await page.waitForFunction(() => !document.getElementById('guides'));
    await page.locator('#faq').scrollIntoViewIfNeeded();
  },
  'guides-unavailable-link': async (page) => {
    /* ?guide=all (the expired guide page's link) while guides are closed. */
    reset({ catalogue: 'closed' });
    await page.goto(`${site.url}/?guide=all`, { waitUntil: 'networkidle' });
    await page.locator('#guides .guides-done').waitFor();
    await page.waitForTimeout(300);
  },
  'guides-unavailable-slow': async (page) => {
    /* A slow "unavailable" after the visitor scrolled into the skeleton. */
    reset({ catalogue: 'unavailable' });
    let release;
    stub.state.holdCatalogue = new Promise((r) => (release = r));
    await page.evaluate(() => document.getElementById('guides').scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.locator('#guides .guides-skeleton').waitFor();
    release();
    stub.state.holdCatalogue = null;
    await page.locator('#guides .guides-done').waitFor();
  },
  'guides-unavailable-past': async (page) => {
    /* A slow "unavailable" while the visitor reads the FAQ, then they scroll
       back up: the line, then the FAQ, no hole. */
    reset({ catalogue: 'unavailable' });
    let release;
    stub.state.holdCatalogue = new Promise((r) => (release = r));
    await page.evaluate(() => document.getElementById('faq').scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.locator('#guides .guides-skeleton').waitFor();
    release();
    stub.state.holdCatalogue = null;
    await page.locator('#guides .guides-done').waitFor();
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('guides').scrollIntoView({ block: 'start', behavior: 'instant' }));
  },
  'guides-faq-hash': async (page) => {
    /* /#faq with a slow catalogue: the form loads above, the FAQ stays put. */
    stub.state.holdCatalogue = new Promise((r) => setTimeout(r, 400));
    await page.goto(`${site.url}/#faq`, { waitUntil: 'networkidle' });
    await page.locator('form.guides').waitFor({ state: 'attached' });
    stub.state.holdCatalogue = null;
    await page.waitForTimeout(300);
  },
  'wizard-book': async (page) => {
    await page.route('https://formsubmit.co/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":"true"}' }));
    await page.locator('[data-track="hero-start"]').click();
    await page.locator('.wiz-range').first().click();
    await page.locator('.wiz input[type="date"]').fill('2027-05-15');
    await page.locator('.wiz__body label input:not([type])').first().fill('La Paz');
    await page.locator('.wiz__continue').click();
    await page.locator('.wiz button.btn--gold').click();
    await page.locator('.wiz input[autocomplete="name"]').fill('María Fernanda');
    await page.locator('.wiz input[type="email"]').fill('maria@example.com');
    await page.locator('.wiz button[type="submit"]').click();
    await page.locator('.wiz-pay').waitFor();
    await page.locator('.book-line--wizard [data-book]').click();
    await page.locator('label.book-time').first().waitFor();
  },
};

const browser = await chromium.launch();
const report = [];
let count = 0;
for (const w of widths) {
  const h = w < 600 ? 844 : 900;
  for (const theme of themes) {
    for (const lang of langs) {
      for (const [name, act] of Object.entries(STATES)) {
        if (pick && !pick.includes(name)) continue;
        reset();
        const ctx = await browser.newContext({
          viewport: { width: w, height: h },
          deviceScaleFactor: w < 600 ? 2 : 1,
          isMobile: w < 600,
          hasTouch: w < 600,
          colorScheme: theme === 'day' ? 'light' : 'dark',
          reducedMotion: 'reduce',
          timezoneId: lang === 'es' ? 'America/Bogota' : 'America/Chicago',
          locale: lang === 'es' ? 'es-MX' : 'en-US',
        });
        const page = await ctx.newPage();
        const errors = [];
        /* Non-2xx API answers are logged by the browser itself; not app errors. */
        page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text()));
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.addInitScript(
          ([t, l]) => {
            localStorage.setItem('gl-theme', t);
            localStorage.setItem('guestly-lang', l);
          },
          [theme, lang],
        );
        await page.goto(site.url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(400);
        const after = await act(page, w);
        if (after === 'skip') {
          await ctx.close();
          continue;
        }
        await page.waitForTimeout(250);
        const file = `${name.startsWith('guides') ? '50' : '22'}-${name}-${theme}-${lang}-${w}.png`;
        await page.screenshot({ path: join(outDir, file) });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        const sheetOverflow = await page.evaluate(() => {
          const el = document.querySelector('.book');
          return el ? el.scrollWidth - el.clientWidth : 0;
        });
        report.push({ file, overflow, sheetOverflow, errors });
        if (typeof after === 'function') after();
        count += 1;
        await ctx.close();
      }
    }
  }
}

/* Unreachable: the booking API gives no answer. The page must be the booking-off page. */
const unreachable = [];
if (withUnreachable) {
  for (const w of widths) {
    const h = w < 600 ? 844 : 900;
    for (const theme of themes) {
      for (const lang of langs) {
        const shot = {};
        for (const [which, base] of [['on', site.url], ['off', offSite.url]]) {
          reset({ slots: 'abort', catalogue: 'closed' });
          const ctx = await browser.newContext({
            viewport: { width: w, height: h },
            deviceScaleFactor: w < 600 ? 2 : 1,
            isMobile: w < 600,
            hasTouch: w < 600,
            colorScheme: theme === 'day' ? 'light' : 'dark',
            reducedMotion: 'reduce',
            timezoneId: lang === 'es' ? 'America/Bogota' : 'America/Chicago',
            locale: lang === 'es' ? 'es-MX' : 'en-US',
          });
          const page = await ctx.newPage();
          const errors = [];
          page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text()));
          page.on('pageerror', (e) => errors.push(String(e)));
          await page.addInitScript(([t, l]) => { localStorage.setItem('gl-theme', t); localStorage.setItem('guestly-lang', l); }, [theme, lang]);
          await page.goto(base, { waitUntil: 'networkidle' });
          await page.waitForTimeout(1200);
          shot[which] = { markup: await page.evaluate(() => document.body.innerHTML.replace(/<script[\s\S]*?<\/script>/g, '').replace(/\s+/g, ' ')), errors, buttons: await page.locator('[data-book], .book-line').count(), parts: {} };
          for (const [part, sel] of [['pricing', '#pricing .coord-strip'], ['faq', '#faq'], ['final', '.final-cta']]) {
            await page.locator(sel).scrollIntoViewIfNeeded();
            await page.waitForTimeout(250);
            const file = `22-unreachable-${which}-${part}-${theme}-${lang}-${w}.png`;
            shot[which].parts[part] = await page.screenshot({ path: join(outDir, file) });
          }
          await ctx.close();
        }
        const tag = `${theme} ${lang} ${w}`;
        const same = shot.on.markup === shot.off.markup;
        const pixels = Object.keys(shot.on.parts).map((k) => `${k} ${Buffer.compare(shot.on.parts[k], shot.off.parts[k]) === 0 ? 'same' : 'differs'}`).join(', ');
        unreachable.push({ tag, same, buttons: shot.on.buttons, errors: [...shot.on.errors, ...shot.off.errors], pixels });
      }
    }
  }
}
await browser.close();
site.server.close();
offSite?.server.close();
await stub.close();
rmSync(work, { recursive: true, force: true });
rmSync(offWork, { recursive: true, force: true });
const bad = report.filter((r) => r.overflow > 0 || r.sheetOverflow > 0 || r.errors.length);
for (const r of bad) console.error(`booking-screens: ${r.file}: overflow ${r.overflow}, sheet ${r.sheetOverflow}, errors ${JSON.stringify(r.errors)}`);
const badU = unreachable.filter((u) => !u.same || u.buttons || u.errors.length);
for (const u of unreachable) console.log(`booking-screens: unreachable ${u.tag}: markup ${u.same ? 'identical to the off build' : 'DIFFERS'}, ${u.buttons} booking buttons; pixels: ${u.pixels}`);
for (const u of badU) console.error(`booking-screens: unreachable ${u.tag}: markup same ${u.same}, buttons ${u.buttons}, errors ${JSON.stringify(u.errors)}`);
console.log(`booking-screens: ${count} shots in ${outDir}; ${bad.length} with overflow or console errors; ${unreachable.length} unreachable pairs, ${badU.length} not identical`);
if (bad.length || badU.length) process.exit(1);

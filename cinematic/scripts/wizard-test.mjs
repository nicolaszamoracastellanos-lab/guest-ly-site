/* Wizard walkthrough (Part 4 VERIFY): drives all four steps in EN and ES,
   both themes, screenshots each step, and intercepts the FormSubmit call to
   verify the payload shape WITHOUT hitting the real inbox (request aborted
   unless --send-one is passed). */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const baseUrl = process.argv[2] || 'http://localhost:5199';
const outDir = process.argv[3] || '../docs/wave5-screens/c-wizard';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
};

for (const [lang, theme, vp] of [
  ['en', 'night', { width: 1440, height: 900 }],
  ['es', 'day', { width: 390, height: 844 }],
]) {
  const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'reduce' });
  const page = await ctx.newPage();

  let payload = null;
  await page.route('**/formsubmit.co/**', async (route) => {
    payload = JSON.parse(route.request().postData() || '{}');
    await route.abort(); /* dry run: never spam the real inbox */
  });

  await page.addInitScript(
    ([t, l]) => {
      localStorage.setItem('gl-theme', t);
      localStorage.setItem('guestly-lang', l);
    },
    [theme, lang],
  );
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  const tag = `${lang}-${theme}-${vp.width}`;

  /* Open the wizard from the nav CTA (burger flow on mobile). */
  if (vp.width < 880) {
    await page.click('.nav__burger');
    await page.waitForTimeout(400);
    await page.click('.nav__menu-foot .btn--gold');
  } else {
    await page.click('.nav__actions .btn--gold');
  }
  await page.waitForSelector('.wiz');
  await page.waitForTimeout(400);

  /* Step 1: guest count + date + location. */
  const continueDisabled = await page.locator('.wiz__continue').isDisabled();
  check(`[${tag}] step1 continue disabled before range pick`, continueDisabled);
  await page.click('.wiz-range >> nth=1'); /* 61 to 160 */
  await page.fill('.wiz input[type="date"]', '2027-03-20');
  await page.fill('.wiz .wiz__fields label:nth-of-type(2) input', 'Tarija, Bolivia');
  await page.screenshot({ path: `${outDir}/wiz-step1-${tag}.png` });
  await page.click('.wiz__continue');
  await page.waitForTimeout(400);

  /* Step 2: recommendation preselects Signature. */
  const recommended = await page.locator('.wiz-plan.on .wiz-plan__name').textContent();
  check(`[${tag}] step2 recommends Signature`, /Signature/.test(recommended || ''));
  const reason = await page.locator('.wiz__sub').textContent();
  check(`[${tag}] step2 reason mentions the range`, /(61|160)/.test(reason || ''));
  await page.check('.wiz-addon input');
  await page.screenshot({ path: `${outDir}/wiz-step2-${tag}.png` });
  await page.click('.wiz__nav .btn--gold');
  await page.waitForTimeout(400);

  /* Step 3: contact details; FormSubmit fires on submit. */
  const labels = page.locator('.wiz__fields .field');
  await labels.nth(0).locator('input').fill(lang === 'es' ? 'Ana' : 'Anna');
  await labels.nth(1).locator('input').fill('Luis');
  await labels.nth(2).locator('input').fill('demo@example.com');
  await page.screenshot({ path: `${outDir}/wiz-step3-${tag}.png` });
  await page.click('.wiz__nav button[type="submit"], .wiz__nav .btn--gold');
  await page.waitForTimeout(600);

  check(`[${tag}] FormSubmit fired at end of step 3`, payload !== null);
  if (payload) {
    const keys = Object.keys(payload);
    const expected = ['couple', 'email', 'wedding_date', 'location', 'guest_range', 'plan', 'ai_coordinator', 'price', 'notes'];
    check(`[${tag}] payload has order fields`, expected.every((k) => keys.includes(k)));
    check(`[${tag}] payload addon recorded`, /yes/.test(payload.ai_coordinator || ''));
    check(`[${tag}] payload date from step 1`, payload.wedding_date === '2027-03-20');
  }

  /* Step 4: live Stripe checkout for plan + add-on, and the refund link. */
  const payHref = (await page.locator('.wiz-pay .btn--gold').getAttribute('href')) || '';
  check(`[${tag}] step4 pay button opens Stripe`, /^https:\/\/buy\.stripe\.com\//.test(payHref));
  check(`[${tag}] step4 uses the Signature + Coordinator bundle link`, /00w4gscYJ9tB7rn5Ww63K04/.test(payHref));
  check(`[${tag}] step4 prefills the email`, /prefilled_email=demo%40example\.com/.test(payHref));
  const payText = await page.locator('.wiz-pay .btn--gold').textContent();
  check(`[${tag}] step4 total is plan + add-on ($478)`, /\$478/.test(payText || ''));
  if (payload) check(`[${tag}] payload price is the total`, /\$478/.test(payload.price || ''));
  const refundHref = await page.locator('.wiz-pay__refund a').getAttribute('href');
  check(`[${tag}] step4 links the refund policy`, refundHref === '/refunds');
  await page.screenshot({ path: `${outDir}/wiz-step4-${tag}.png` });

  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);

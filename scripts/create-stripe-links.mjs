#!/usr/bin/env node
/**
 * Guest-ly · Stripe bootstrap
 *
 * Creates everything the order flow needs, idempotently (safe to re-run):
 *   - 3 products  (Basic / Standard / Premium)
 *   - 12 one-time prices (4 guest-count bands per product)
 *   - 12 payment links (phone collection, custom fields, promo codes,
 *     after-payment redirect to https://guest-ly.com/#intake)
 *   - FOUNDING30 promotion code (30% off, max 10 redemptions)
 *   - Patches PAY_LINKS in index.html with the 12 live URLs
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/create-stripe-links.mjs
 *   STRIPE_SECRET_KEY=rk_live_... node scripts/create-stripe-links.mjs   (restricted key — recommended)
 *
 * A restricted key needs WRITE on: Products, Prices (under Products),
 * Payment Links, Coupons/Promotion codes.
 * Run with sk_test_/rk_test_ first for a dry run in sandbox if you like.
 * Requires Node 18+. No dependencies.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error('Set STRIPE_SECRET_KEY (an sk_ or restricted rk_ key). See header comment.');
  process.exit(1);
}
const MODE = KEY.includes('_test_') ? 'TEST (sandbox)' : 'LIVE';
const SITE = 'https://guest-ly.com';
const REDIRECT = SITE + '/#intake';

const PLANS = {
  basic: {
    name: 'Guest-ly Basic — AI Web Concierge',
    description: 'AI concierge on a custom web URL, 30+ languages — creation fee, first 3 months of hosting included.',
    prices: [97, 147, 197, 267],
  },
  standard: {
    name: 'Guest-ly Standard — All Channels',
    description: 'AI concierge on Web, WhatsApp, SMS & Telegram — creation fee, first 3 months of hosting included.',
    prices: [247, 347, 447, 547],
  },
  premium: {
    name: 'Guest-ly Premium — All Channels + Dashboard',
    description: 'All channels plus guest dashboard, RSVP tracking and unlimited revisions — creation fee, first 3 months of hosting included.',
    prices: [447, 597, 747, 897],
  },
};
const BANDS = ['0-100 guests', '100-300 guests', '300-500 guests', '500+ guests'];

/* ── tiny Stripe client (form-encoded, like the official SDK) ── */
function encode(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === null || v === undefined) continue;
    if (typeof v === 'object') encode(v, key, out);
    else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(v));
  }
  return out.join('&');
}
async function stripe(method, path, body) {
  const res = await fetch('https://api.stripe.com/v1/' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? encode(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = json.error ? `${json.error.type}: ${json.error.message}` : res.statusText;
    const err = new Error(`${method} ${path} → ${msg}`);
    err.code = json.error && json.error.code;
    err.status = res.status;
    throw err;
  }
  return json;
}
async function list(path, params = {}) {
  const q = encode({ limit: 100, ...params });
  return (await stripe('GET', path + '?' + q)).data;
}

/* ── idempotent creators ── */
async function ensureProduct(planKey) {
  const plan = PLANS[planKey];
  const existing = (await list('products', { active: true })).find(
    (p) => p.metadata && p.metadata.guestly_plan === planKey
  );
  if (existing) return existing;
  console.log(`  + product ${plan.name}`);
  return stripe('POST', 'products', {
    name: plan.name,
    description: plan.description,
    metadata: { guestly_plan: planKey },
  });
}

async function ensurePrice(product, planKey, band) {
  const lookup = `guestly_${planKey}_${band}`;
  const found = await list('prices', { lookup_keys: [lookup] });
  if (found.length) return found[0];
  console.log(`  + price  $${PLANS[planKey].prices[band]} (${lookup})`);
  return stripe('POST', 'prices', {
    product: product.id,
    unit_amount: PLANS[planKey].prices[band] * 100,
    currency: 'usd',
    nickname: `${planKey} · ${BANDS[band]}`,
    lookup_key: lookup,
    metadata: { guestly_plan: planKey, guestly_band: band },
  });
}

async function ensurePaymentLink(price, planKey, band) {
  const tag = `${planKey}-${band}`;
  const existing = (await list('payment_links', { active: true })).find(
    (l) => l.metadata && l.metadata.guestly === tag
  );
  if (existing) return existing;
  console.log(`  + link   ${planKey} · ${BANDS[band]}`);
  return stripe('POST', 'payment_links', {
    line_items: { 0: { price: price.id, quantity: 1 } },
    allow_promotion_codes: true,
    phone_number_collection: { enabled: true },
    custom_fields: {
      0: { key: 'partner_names', label: { type: 'custom', custom: 'Partner names' }, type: 'text', optional: false },
      1: { key: 'wedding_date', label: { type: 'custom', custom: 'Wedding date' }, type: 'text', optional: false },
      2: { key: 'city_country', label: { type: 'custom', custom: 'City / Country' }, type: 'text', optional: true },
    },
    after_completion: { type: 'redirect', redirect: { url: REDIRECT } },
    metadata: { guestly: tag },
  });
}

async function ensureFoundingCode() {
  const couponId = 'guestly-founding-30';
  let coupon;
  try {
    coupon = await stripe('GET', 'coupons/' + couponId);
  } catch (e) {
    if (e.status !== 404) throw e;
    console.log('  + coupon 30% off, max 10 redemptions');
    coupon = await stripe('POST', 'coupons', {
      id: couponId,
      percent_off: 30,
      duration: 'once',
      max_redemptions: 10,
      name: 'Founding couples — 30% off',
    });
  }
  const codes = await list('promotion_codes', { code: 'FOUNDING30' });
  if (codes.length) return codes[0];
  console.log('  + promotion code FOUNDING30');
  return stripe('POST', 'promotion_codes', { coupon: coupon.id, code: 'FOUNDING30' });
}

/* ── main ── */
console.log(`Stripe mode: ${MODE}\n`);
if (MODE.startsWith('TEST')) {
  console.log('⚠  Test-mode links cannot take real cards. Re-run with your live key');
  console.log('   after activating the account to generate the real links.\n');
}

const urls = { basic: [], standard: [], premium: [] };
for (const planKey of Object.keys(PLANS)) {
  console.log(planKey.toUpperCase());
  const product = await ensureProduct(planKey);
  for (let band = 0; band < 4; band++) {
    const price = await ensurePrice(product, planKey, band);
    const link = await ensurePaymentLink(price, planKey, band);
    urls[planKey].push(link.url);
  }
}
console.log('\nFOUNDING OFFER');
await ensureFoundingCode();

const block =
  'var PAY_LINKS = {\n' +
  `  basic:    ['${urls.basic.join("', '")}'],\n` +
  `  standard: ['${urls.standard.join("', '")}'],\n` +
  `  premium:  ['${urls.premium.join("', '")}']\n` +
  '};';

console.log('\n──── PAY_LINKS block ────\n' + block + '\n─────────────────────────');

/* patch index.html if we can find it */
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = join(root, 'index.html');
if (existsSync(htmlPath)) {
  const html = readFileSync(htmlPath, 'utf8');
  const re = /var PAY_LINKS = \{[\s\S]*?\};/;
  if (re.test(html)) {
    writeFileSync(htmlPath, html.replace(re, block));
    console.log('\n✓ index.html patched. Review with `git diff`, then commit & deploy.');
  } else {
    console.log('\n⚠ Could not find the PAY_LINKS block in index.html — paste the block above manually.');
  }
} else {
  console.log('\n⚠ index.html not found next to scripts/ — paste the block above manually.');
}
if (MODE === 'LIVE') {
  console.log('\nDone. Place one $0-risk test: open the site, order, pay with a real card,');
  console.log('then refund yourself from the Stripe dashboard (Payments → ⋯ → Refund).');
}

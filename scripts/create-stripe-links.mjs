#!/usr/bin/env node
/**
 * Guest-ly · Stripe bootstrap (wave 5, canonical one-time pricing)
 *
 * Creates everything the order flow needs, idempotently (safe to re-run):
 *   - 3 products: Essentials / Signature / Grande
 *   - 3 one-time prices: $199 / $399 / $699
 *   - 1 add-on product + price: AI Coordinator $79 one-time
 *   - 3 payment links (phone collection, custom fields, promo codes,
 *     after-payment redirect to https://guest-ly.com/#intake)
 *   - FOUNDING30 promotion code (30% off, max 10 redemptions)
 *   - Patches PAY_LINKS in cinematic/src/config.ts with the 3 live URLs
 *
 * Usage:
 *   STRIPE_SECRET_KEY=rk_live_... node scripts/create-stripe-links.mjs
 *
 * A restricted key needs WRITE on: Products, Prices (under Products),
 * Payment Links, Coupons/Promotion codes.
 * Run with rk_test_/sk_test_ first for a sandbox dry run if you like.
 * Requires Node 18+. No dependencies.
 *
 * Afterwards: cd cinematic && npm run build, copy dist/ over the repo
 * root, commit. The wizard reads the links from config.ts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
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
  essentials: {
    name: 'Guest-ly Essentials',
    description:
      'AI wedding concierge on WhatsApp and the web (EN/ES), wedding website with registry and RSVP, guest import, dashboard with full transcripts. Up to 60 guests. One payment, yours until the wedding.',
    amount: 19900,
  },
  signature: {
    name: 'Guest-ly Signature',
    description:
      'Everything in Essentials plus per-person per-event RSVP, unlimited broadcasts, QR day-of check-in and Zola RSVP sync. Up to 160 guests. One payment, yours until the wedding.',
    amount: 39900,
  },
  grande: {
    name: 'Guest-ly Grande',
    description:
      'Everything in Signature plus the AI Coordinator, done-for-you setup and a planner seat. Up to 300 guests. One payment, yours until the wedding.',
    amount: 69900,
  },
};

const ADDON = {
  key: 'coordinator',
  name: 'Guest-ly AI Coordinator (add-on)',
  description:
    'Run your wedding by chat: guest list, RSVPs, knowledge base and reminders, with a confirmation card before every change. One-time add-on for Essentials and Signature; already included with Grande.',
  amount: 7900,
};

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
    const err = new Error(`${method} ${path} -> ${msg}`);
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

/* ── idempotent creators (everything is keyed by metadata) ── */
async function ensureProduct(key, def) {
  const existing = (await list('products', { active: true })).find(
    (p) => p.metadata && p.metadata.guestly_plan === key,
  );
  if (existing) return existing;
  console.log(`  + product ${def.name}`);
  return stripe('POST', 'products', {
    name: def.name,
    description: def.description,
    metadata: { guestly_plan: key },
  });
}

async function ensurePrice(product, key, amount) {
  const lookup = `guestly_${key}_onetime`;
  const found = await list('prices', { lookup_keys: [lookup] });
  if (found.length) return found[0];
  console.log(`  + price  $${amount / 100} (${lookup})`);
  return stripe('POST', 'prices', {
    product: product.id,
    unit_amount: amount,
    currency: 'usd',
    nickname: `${key} · one-time`,
    lookup_key: lookup,
    metadata: { guestly_plan: key },
  });
}

async function ensurePaymentLink(price, key) {
  const existing = (await list('payment_links', { active: true })).find(
    (l) => l.metadata && l.metadata.guestly === `wave5-${key}`,
  );
  if (existing) return existing;
  console.log(`  + link   ${key}`);
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
    metadata: { guestly: `wave5-${key}` },
  });
}

async function ensureFoundingCode() {
  const codes = await list('promotion_codes', { code: 'FOUNDING30' });
  if (codes.length) {
    console.log('  FOUNDING30 exists');
    return codes[0];
  }
  const coupon = await stripe('POST', 'coupons', {
    percent_off: 30,
    duration: 'once',
    name: 'Founding Couples 30%',
  });
  console.log('  + FOUNDING30 (max 10 redemptions)');
  return stripe('POST', 'promotion_codes', {
    coupon: coupon.id,
    code: 'FOUNDING30',
    max_redemptions: 10,
  });
}

function patchConfig(links) {
  const configPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'cinematic', 'src', 'config.ts');
  let src = readFileSync(configPath, 'utf8');
  for (const [key, url] of Object.entries(links)) {
    const re = new RegExp(`(  ${key}: ')[^']*(',)`);
    if (!re.test(src)) throw new Error(`PAY_LINKS entry for ${key} not found in config.ts`);
    src = src.replace(re, `$1${url}$2`);
  }
  writeFileSync(configPath, src);
  console.log('\nPatched cinematic/src/config.ts PAY_LINKS. Now rebuild:');
  console.log('  cd cinematic && npm run build   (then copy dist/ over the repo root and commit)');
}

console.log(`Stripe bootstrap in ${MODE} mode\n`);
const links = {};
for (const [key, def] of Object.entries(PLANS)) {
  const product = await ensureProduct(key, def);
  const price = await ensurePrice(product, key, def.amount);
  const link = await ensurePaymentLink(price, key);
  links[key] = link.url;
}
const addonProduct = await ensureProduct(ADDON.key, {
  name: ADDON.name,
  description: ADDON.description,
});
await ensurePrice(addonProduct, ADDON.key, ADDON.amount);
await ensureFoundingCode();
patchConfig(links);
console.log('\nDone.');

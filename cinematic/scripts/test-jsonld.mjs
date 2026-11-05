/* K18 pure test: the JSON-LD built from the copy carries the plan cards'
   names, prices and guest caps from src/pricing.ts, and only visible FAQ
   answers. Runs the TypeScript sources directly (Node type stripping).
   Usage: node scripts/test-jsonld.mjs */

import { copy } from '../src/copy.ts';
import { PLANS, guestsLabel } from '../src/pricing.ts';
import { faqLd, jsonLdScripts, productLd } from '../src/seo/jsonld.ts';

const errors = [];
const expect = (label, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) errors.push(`${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

/* Offers mirror the EN plan cards, which mirror pricing.ts. */
const product = productLd(copy.en);
expect('offer names', product.offers.map((o) => o.name), ['Essentials', 'Signature', 'Grande']);
expect('offer prices', product.offers.map((o) => o.price), ['199', '399', '699']);
expect('offer prices = PLANS', product.offers.map((o) => Number(o.price)), Object.values(PLANS).map((p) => p.price));
expect(
  'offer guest caps',
  product.offers.map((o) => o.description.split('.')[0]),
  ['Up to 160 guests', 'Up to 300 guests', '500+ guests'],
);
expect('currency', [...new Set(product.offers.map((o) => o.priceCurrency))], ['USD']);
if (/\b60 guests/.test(JSON.stringify(product))) errors.push('the old 60-guest cap is back in the offers');
if (!product.offers.every((o) => o.description.includes(copy.en.pricing.maintenanceLine)))
  errors.push('an offer lacks the visible maintenance line');

/* The cards in both languages read the same caps and prices. */
for (const loc of ['en', 'es']) {
  copy[loc].pricing.plans.forEach((plan) => {
    expect(`${loc} ${plan.id} price`, plan.price, PLANS[plan.id].price);
    expect(`${loc} ${plan.id} guests`, plan.guests, guestsLabel(plan.id, loc));
  });
}
expect('es caps', copy.es.pricing.plans.map((p) => p.guests), ['Hasta 160 invitados', 'Hasta 300 invitados', '500+ invitados']);

/* FAQ: only items marked ld, word for word. */
const faq = faqLd(copy.en);
const marked = copy.en.faq.items.filter((i) => i.ld);
expect('faq count', faq.mainEntity.length, marked.length);
if (marked.length < 5) errors.push(`only ${marked.length} FAQ items marked ld`);
faq.mainEntity.forEach((q, i) => {
  expect(`faq ${i + 1} question`, q.name, marked[i].q);
  expect(`faq ${i + 1} answer`, q.acceptedAnswer.text, marked[i].a);
});

/* A copy string can never close the script element. */
const hostile = structuredClone(copy.en);
hostile.faq.items[0].a = 'x</script><script>alert(1)</script>';
const html = jsonLdScripts(hostile);
expect('closing script tags', html.match(/<\/script>/g)?.length, 2);
for (const block of html.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/g) ?? []) {
  const json = block.replace(/^<script[^>]*>\n/, '').replace(/\n<\/script>$/, '');
  try {
    JSON.parse(json);
  } catch (e) {
    errors.push(`a JSON-LD block does not parse: ${e.message}`);
  }
}
if (!html.includes('x\\u003c/script>')) errors.push('"<" is not escaped in JSON-LD');

if (errors.length) {
  for (const e of errors) console.error(`test-jsonld: ${e}`);
  process.exit(1);
}
console.log(`test-jsonld clean: ${product.offers.length} offers from pricing.ts, ${faq.mainEntity.length} FAQ answers, script-safe`);

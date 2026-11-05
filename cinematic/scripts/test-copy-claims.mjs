/* Pure test of scripts/check-copy-claims.mjs: today's copy and its JSON-LD
   are clean, and each claim the round-1 review removed fails when planted
   back, in EN or ES, in the copy or in the JSON-LD.
   Usage: node scripts/test-copy-claims.mjs */

import { copy } from '../src/copy.ts';
import { faqLd, productLd } from '../src/seo/jsonld.ts';
import { copyClaimProblems } from './check-copy-claims.mjs';

/* The blocked terms features.json holds today for F24, F60 and F63. */
const blockedTerms = ['sync with Zola', 'Zola sync', 'sincroniza con Zola', 'sincronización con Zola', 'SMS concierge', 'concierge por SMS', 'Telegram', 'two-way sync'];
const errors = [];
const ld = (c) => [productLd(c.en), faqLd(c.en)];

const clean = copyClaimProblems({ copy, ld: ld(copy), blockedTerms });
if (clean.length) errors.push(`today's copy is not clean:\n  ${clean.join('\n  ')}`);

function mustFail(label, plant, want) {
  const c = structuredClone(copy);
  plant(c);
  const got = copyClaimProblems({ copy: c, ld: ld(c), blockedTerms });
  if (!got.some((p) => p.includes(want))) errors.push(`${label}: expected "${want}", got ${JSON.stringify(got)}`);
}

mustFail('EN Zola sync on a plan card', (c) => (c.en.pricing.plans[1].features[3] = 'QR check-in + Zola sync'), 'blocked term "Zola sync"');
mustFail('the same claim reaches the JSON-LD offer', (c) => (c.en.pricing.plans[1].features[3] = 'QR check-in + Zola sync'), 'json-ld[0].offers[1].description: blocked term');
mustFail('"Keep Zola. We sync with it."', (c) => (c.en.pricing.zolaLine = 'Keep Zola. We sync with it.'), 'Zola sync claim');
mustFail('ES "sincroniza desde Zola"', (c) => (c.es.how.steps[0].details[1] = 'Importa tu lista o sincroniza desde Zola'), 'Zola sync claim');
mustFail('ES "Nos sincronizamos con él"', (c) => (c.es.faq.items[0].a = 'Conserva Zola. Nos sincronizamos con él.'), 'Zola sync claim');
mustFail('FAQPage answer with a sync claim', (c) => (c.en.faq.items.find((i) => i.ld).a = 'Keep Zola. We sync with it.'), 'json-ld[1]');
mustFail('EN coming soon', (c) => (c.en.channels.liveLabel = 'Coming soon'), 'roadmap promise');
mustFail('ES "Muy pronto"', (c) => (c.es.channels.liveLabel = 'Muy pronto'), 'roadmap promise');
mustFail('ES "llegan pronto"', (c) => (c.es.faq.items[0].a = 'SMS y WhatsApp llegan pronto.'), 'roadmap promise');
mustFail('Telegram anywhere', (c) => (c.en.channels.cards[0].name = 'Telegram'), 'blocked term "Telegram"');
mustFail('"Get started" button', (c) => (c.en.nav.cta = 'Get started'), 'generic button label');
mustFail('"Empezar" button', (c) => (c.es.pricing.plans[0].cta = 'Empezar'), 'generic button label');
mustFail('glyph arrow in a button', (c) => (c.en.wizard.step1.next = 'Choose plan →'), 'glyph arrow');
mustFail('exclamation in the JSON-LD', (c) => (c.en.faq.items.find((i) => i.ld).a = 'Yes!'), 'exclamation mark');

if (errors.length) {
  for (const e of errors) console.error(`test-copy-claims: ${e}`);
  process.exit(1);
}
console.log('test-copy-claims clean: copy and JSON-LD clean today; 14 planted claims each fail');

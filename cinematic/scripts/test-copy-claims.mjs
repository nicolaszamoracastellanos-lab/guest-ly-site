/* Pure test of scripts/check-copy-claims.mjs: today's copy and its JSON-LD
   are clean, and each claim the round-1 review removed fails when planted
   back, in EN or ES, in the copy or in the JSON-LD.
   Usage: node scripts/test-copy-claims.mjs */

import { copy } from '../src/copy.ts';
import { faqLd, productLd } from '../src/seo/jsonld.ts';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { copyClaimProblems, htmlControlArrowProblems, tsxArrowProblems } from './check-copy-claims.mjs';
import { CINEMATIC } from './lib/paths.mjs';

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
mustFail('EN founding offer back', (c) => (c.en.founding.body[1] = 'First 10 weddings: 30% off with FOUNDING30.'), 'retired Founding Couples offer');
mustFail('ES Parejas Fundadoras', (c) => (c.es.founding.kicker = 'Parejas Fundadoras'), 'retired Founding Couples offer');
mustFail('ES "llegan pronto"', (c) => (c.es.faq.items[0].a = 'SMS y WhatsApp llegan pronto.'), 'roadmap promise');
mustFail('Telegram anywhere', (c) => (c.en.channels.cards[0].name = 'Telegram'), 'blocked term "Telegram"');
mustFail('"Get started" button', (c) => (c.en.nav.cta = 'Get started'), 'generic button label');
mustFail('"Empezar" button', (c) => (c.es.pricing.plans[0].cta = 'Empezar'), 'generic button label');
mustFail('glyph arrow in a button', (c) => (c.en.wizard.step1.next = 'Choose plan →'), 'glyph arrow');
mustFail('EN arrow on a link label', (c) => (c.en.hero.watchLink = 'Watch it happen →'), 'glyph arrow in a button or link label');
mustFail('ES arrow on the compare link', (c) => (c.es.pricing.compareLink = 'Mira cómo se compara →'), 'glyph arrow in a button or link label');
mustFail('exclamation in the JSON-LD', (c) => (c.en.faq.items.find((i) => i.ld).a = 'Yes!'), 'exclamation mark');

/* Arrows appended in the TSX (round 2): today's src is clean, a planted
   {`${label} →`} fails, the portal mocks' change data stays allowed. */
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : [],
  );
const src = walk(join(CINEMATIC, 'src')).map((f) => [relative(CINEMATIC, f).split('\\').join('/'), readFileSync(f, 'utf8')]);
const tsxToday = tsxArrowProblems(src);
if (tsxToday.length) errors.push(`today's TSX has glyph arrows:\n  ${tsxToday.join('\n  ')}`);
if (!tsxArrowProblems([['src/ui/Hero.tsx', '<a href="#x">{`${h.watchLink} →`}</a>']]).length) errors.push('a TSX-appended arrow was not caught');
if (tsxArrowProblems([['src/ui/MockScreens.tsx', '<span>table 7 → 4</span>']]).length) errors.push('the portal mock change data was flagged');
if (!htmlControlArrowProblems('<p>x <a class="hero__watch" href="#s">Watch it happen →</a></p>', 'p').length) errors.push('an arrow in a built <a> was not caught');
if (!htmlControlArrowProblems('<button type="button"><span>Pay</span> ➔</button>', 'p').length) errors.push('an arrow in a built <button> was not caught');
if (htmlControlArrowProblems('<span>table 7 → 4</span><a href="#s">Watch it happen</a>', 'p').length) errors.push('an arrow outside any control was flagged');

if (errors.length) {
  for (const e of errors) console.error(`test-copy-claims: ${e}`);
  process.exit(1);
}
console.log('test-copy-claims clean: copy and JSON-LD clean today; 18 planted claims each fail; TSX and built-page arrows caught (4 cases), mock data and plain controls pass');

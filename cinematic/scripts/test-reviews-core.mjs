/* Pure tests for the Reviews tab (no browser): reading every answer of the
   L6 contract (L6-LOG "Reviews API for the landing", v1), the labels in EN
   and ES (average as given, month through Intl, star fills), the JSON-LD
   built from the answer only, the copy under the house rules, the switch
   shipping off, the build guard (reviewsClaimProblems) on planted leaks and,
   when a portal checkout with the API is found (GL_L6_DIR, else
   GL_PORTAL_DIR), that the stub's answer keys equal the server's.
   Usage: [GL_L6_DIR=<portal with reviews>] node scripts/test-reviews-core.mjs */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  averageLabel, fill, ldText, monthLabel, readReviews, REVIEWS_LIMIT, reviewsLd, starFills, withReviewsLd,
} from '../src/reviews/core.ts';
import { reviewsCopy } from '../src/reviews/copy.ts';
import { reviewsNavCopy } from '../src/reviews/head-copy.ts';
import { resolveSwitches, REVIEWS_ENABLED, API_PATHS } from '../src/switches.ts';
import { reviewsClaimProblems, REVIEW_CLAIM } from './lib/feature-claims.mjs';
import { copyProblems } from './lib/copy-rules.mjs';
import { REVIEWS, reviewsBody } from './lib/reviews-stub.mjs';

const errors = [];
let checks = 0;
const eq = (label, got, want) => {
  checks += 1;
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) errors.push(`${label}: got ${g}, want ${w}`);
};
const ok = (label, cond) => eq(label, Boolean(cond), true);

/* 1. Reading answers. */
const open = readReviews(200, reviewsBody('open'));
ok('open: read', open);
eq('open: count as given (12, not the 6 listed)', open?.count, 12);
eq('open: average as given', open?.average, 4.3);
eq('open: six reviews in the given order', open?.reviews.map((r) => r.id), REVIEWS.map((r) => r.id));
eq('open: low rating kept (no rating gate)', open?.reviews[3].rating, 2);
eq('open: no month stays null', open?.reviews[3].month, null);
eq('open: only the fields shown', Object.keys(open?.reviews[0] ?? {}), ['id', 'rating', 'text', 'name', 'month']);
eq('one review', readReviews(200, reviewsBody('one'))?.count, 1);
eq('average 4 kept as 4', readReviews(200, reviewsBody('one'))?.average, 4);
for (const mode of ['zero', 'closed', 'unavailable', 'wrong-version']) eq(`${mode}: nothing shows`, readReviews(200, reviewsBody(mode)), null);
for (const status of [204, 401, 404, 429, 500, 503]) eq(`HTTP ${status}: nothing shows`, readReviews(status, reviewsBody('open')), null);
eq('unparsable body', readReviews(200, null), null);
eq('array body', readReviews(200, []), null);
eq('string body', readReviews(200, '<html>'), null);
const base = reviewsBody('open');
eq('count not an integer', readReviews(200, { ...base, count: 2.5 }), null);
eq('count as a string', readReviews(200, { ...base, count: '12' }), null);
eq('average null with reviews', readReviews(200, { ...base, average: null }), null);
eq('average out of range', readReviews(200, { ...base, average: 5.4 }), null);
eq('reviews not a list', readReviews(200, { ...base, reviews: {} }), null);
eq('more listed than counted', readReviews(200, { ...base, count: 3 }), null);
eq('open with an empty list', readReviews(200, { ...base, reviews: [] }), null);
const junk = [
  null,
  'x',
  { ...REVIEWS[0], id: '' },
  { ...REVIEWS[0], id: 'r1', rating: 0 },
  { ...REVIEWS[0], id: 'r2', rating: 6 },
  { ...REVIEWS[0], id: 'r3', rating: 4.5 },
  { ...REVIEWS[0], id: 'r4', rating: '5' },
  { ...REVIEWS[0], id: 'r5', text: '   ' },
  { ...REVIEWS[0], id: 'r6', name: '' },
  { ...REVIEWS[0], id: 'r7', text: 42 },
];
const mixed = readReviews(200, { ...base, reviews: [...junk, REVIEWS[1], REVIEWS[1], { ...REVIEWS[2], month: '2026-13' }] });
eq('junk reviews dropped, duplicates once, the rest kept', mixed?.reviews.map((r) => r.id), [REVIEWS[1].id, REVIEWS[2].id]);
eq('bad month read as none', mixed?.reviews[1].month, null);
eq('only junk: nothing shows', readReviews(200, { ...base, reviews: junk }), null);
const spaced = readReviews(200, { ...base, reviews: [{ ...REVIEWS[0], text: '  Calm\n\non the  day. ', name: ' Ana \t y Luis ' }] });
eq('whitespace and line breaks collapsed', [spaced?.reviews[0].text, spaced?.reviews[0].name], ['Calm on the day.', 'Ana y Luis']);
const long = readReviews(200, { ...base, reviews: [{ ...REVIEWS[0], text: 'a'.repeat(900), name: 'b'.repeat(90) }] });
eq('text held to 400, name to 60', [long?.reviews[0].text.length, long?.reviews[0].name.length], [400, 60]);
const html = readReviews(200, { ...base, reviews: [{ ...REVIEWS[0], text: '<img src=x onerror=alert(1)>', name: '<b>Ana</b>' }] });
eq('markup stays text (rendered as text by React)', html?.reviews[0].text, '<img src=x onerror=alert(1)>');
const many = readReviews(200, { ...base, count: 40, reviews: Array.from({ length: 20 }, (_, i) => ({ ...REVIEWS[0], id: `id${i}` })) });
eq(`at most ${REVIEWS_LIMIT} shown`, many?.reviews.length, REVIEWS_LIMIT);
eq('the page asks for 6', REVIEWS_LIMIT, 6);

/* 2. Labels. */
eq('average EN', averageLabel(4.3, 'en'), '4.3');
eq('average ES', averageLabel(4.3, 'es'), '4.3');
eq('average 4 prints 4.0', averageLabel(4, 'en'), '4.0');
eq('average 4.75 as given to one decimal', averageLabel(4.7, 'en'), '4.7');
eq('month EN', monthLabel('2026-11', 'en'), 'November 2026');
eq('month ES', monthLabel('2026-11', 'es'), 'noviembre de 2026');
eq('January stays January west of UTC', monthLabel('2027-01', 'en'), 'January 2027');
eq('December stays December', monthLabel('2026-12', 'es'), 'diciembre de 2026');
eq('no month', monthLabel(null, 'en'), '');
eq('bad month', monthLabel('2026-1', 'en'), '');
eq('5 stars', starFills(5), [1, 1, 1, 1, 1]);
eq('2 stars', starFills(2), [1, 1, 0, 0, 0]);
eq('4.3 stars', starFills(4.3), [1, 1, 1, 1, 0.3]);
eq('3.5 stars', starFills(3.5), [1, 1, 1, 0.5, 0]);
eq('fill', fill(reviewsCopy.en.countMany, { n: 12 }), 'based on 12 reviews');
eq('fill ES', fill(reviewsCopy.es.newest, { shown: 6, n: 12 }), 'Las 6 más recientes de 12 reseñas.');
eq('unknown placeholder kept', fill('{x}', {}), '{x}');

/* 3. JSON-LD from the answer only. */
const ld = reviewsLd(open);
eq('aggregateRating is the API figure', ld.aggregateRating, { '@type': 'AggregateRating', ratingValue: 4.3, reviewCount: 12, bestRating: 5, worstRating: 1 });
eq('one Review per review shown', ld.review.length, 6);
eq('review shape', ld.review[3], {
  '@type': 'Review',
  author: { '@type': 'Person', name: 'Hannah and Tom' },
  reviewRating: { '@type': 'Rating', ratingValue: 2, bestRating: 5, worstRating: 1 },
  reviewBody: REVIEWS[3].text,
});
const product = { '@context': 'https://schema.org', '@type': 'Product', name: 'Guest-ly', offers: [] };
const merged = withReviewsLd(product, open);
eq('product keeps its fields', [merged['@type'], merged.name, merged.offers], ['Product', 'Guest-ly', []]);
ok('the built block is untouched', !('aggregateRating' in product));
ok('"<" escaped in the script text', !ldText({ a: '</script><b>' }).includes('<'));

/* 4. Copy: both languages, same keys, every house rule. */
eq('same keys EN and ES', Object.keys(reviewsCopy.en), Object.keys(reviewsCopy.es));
for (const [name, dict] of [['reviewsCopy', reviewsCopy], ['reviewsNavCopy', reviewsNavCopy]]) {
  for (const lang of ['en', 'es']) {
    for (const [k, v] of Object.entries(dict[lang])) eq(`${name}.${lang}.${k} house rules`, copyProblems(v), []);
  }
}
eq('nav labels', [reviewsNavCopy.en.label, reviewsNavCopy.es.label], ['Reviews', 'Reseñas']);
eq('section follows the FAQ', [reviewsCopy.en.no, reviewsCopy.en.noAfterGuides], ['№ 11', '№ 12']);

/* 5. Switch. */
eq('REVIEWS_ENABLED ships true', REVIEWS_ENABLED, true);
eq('no env: the shipped value', resolveSwitches({}).reviews, true);
eq('env can turn it off', resolveSwitches({ GL_REVIEWS_ENABLED: '0' }).reviews, false);
eq('test env turns it on', resolveSwitches({ GL_REVIEWS_ENABLED: '1' }).reviews, true);
ok('the API path is allowlisted', API_PATHS.includes('/api/public/reviews'));

/* 6. Build guard. */
const offSw = { reviews: false };
const clean = { home: '<main><section id="faq"></section></main>', assets: [{ name: 'index-a.js', text: 'x' }], css: [{ name: 'index.css', text: '.faq{}' }], ld: ['Product', 'Guest-ly', 'Plans'], llms: [{ name: 'llms.txt', text: '# Guest-ly\n30+ languages' }], fixtures: [REVIEWS[0].text] };
eq('clean off build', reviewsClaimProblems({ switches: offSw, ...clean }), []);
const onClean = { ...clean, assets: [{ name: 'index-a.js', text: 'fetch("/api/public/reviews")' }, { name: 'ReviewsTab-x.js', text: 'y' }] };
eq('clean on build', reviewsClaimProblems({ switches: { reviews: true }, ...onClean }), []);
eq('on without the chunk or the read', reviewsClaimProblems({ switches: { reviews: true }, ...clean }).length, 2);
const planted = reviewsClaimProblems({
  switches: offSw,
  home: '<section id="reviews"></section><a href="#reviews">Reviews</a>',
  pages: [['/privacy/', '<a href="#reviews">x</a>']],
  assets: [{ name: 'ReviewsTab-x.js', text: '/api/public/reviews' }, { name: 'index-b.js', text: REVIEWS[0].text }],
  css: [{ name: 'index.css', text: '.reviews-score{}' }],
  ld: ['AggregateRating', 'Rated 4.8 out of 5'],
  llms: [{ name: 'llms.txt', text: 'Couples rate Guest-ly 4.9 stars.' }],
  fixtures: [REVIEWS[0].text],
});
eq('planted leaks: every one caught', planted.length, 10);
ok('claim regex: "4.7 out of 5"', REVIEW_CLAIM.test('4.7 out of 5'));
ok('claim regex: "4,8 de 5"', REVIEW_CLAIM.test('4,8 de 5'));
ok('claim regex: not "30+ languages"', !REVIEW_CLAIM.test('30+ languages, 2 channels'));
ok('claim regex: not "A planner reviews a draft"', !REVIEW_CLAIM.test('A planner reviews a proposed draft'));

/* 7. The stub against L6's source, when an L6 checkout has the API. */
const l6 = process.env.GL_L6_DIR || process.env.GL_PORTAL_DIR || '';
const core = l6 ? join(l6, 'src', 'lib', 'feedback-core.ts') : '';
if (core && existsSync(core) && readFileSync(core, 'utf8').includes('export type PublicReview')) {
  const src = readFileSync(core, 'utf8');
  const keys = /export type PublicReview = \{([^}]*)\}/.exec(src)?.[1].match(/(\w+):/g).map((k) => k.slice(0, -1));
  eq('stub review keys equal L6 PublicReview', Object.keys(REVIEWS[0]), keys);
  const body = /export type PublicReviewsBody = \{([^}]*)\}/.exec(src)?.[1].match(/^\s*(\w+):/gm).map((k) => k.trim().slice(0, -1));
  eq('stub body keys equal L6 PublicReviewsBody', Object.keys(reviewsBody('open')), body);
  ok('L6 still answers version 1', /PUBLIC_REVIEWS_API_VERSION = 1\b/.test(src));
  ok('L6 still caps the name at 60', /DISPLAY_NAME_MAX = 60\b/.test(src));
} else {
  console.log('test-reviews-core: no portal checkout with the reviews API (GL_L6_DIR or GL_PORTAL_DIR), L6 source check skipped');
}

if (errors.length) {
  for (const e of errors) console.error(`test-reviews-core: ${e}`);
  console.error(`\ntest-reviews-core FAILED: ${errors.length} of ${checks}`);
  process.exit(1);
}
console.log(`test-reviews-core clean: ${checks} checks (every contract answer, labels EN and ES, JSON-LD from the answer, copy rules, switch ships on, build guard on planted leaks)`);

/* Pure test of the Founding Couples offer expiry (review round 2, Nov 5):
   the card shows through the last day in every time zone and never after,
   and the copy names the same day as src/founding.ts.
   Usage: node scripts/test-founding.mjs */

import { copy } from '../src/copy.ts';
import { FOUNDING_ENDS, foundingOfferOpen } from '../src/founding.ts';

const errors = [];
const at = (iso) => Date.parse(iso);
const expect = (label, got, want) => {
  if (got !== want) errors.push(`${label}: expected ${want}, got ${got}`);
};

expect('Oct 31 late evening at UTC-12', foundingOfferOpen(at('2026-10-31T23:59:00-12:00'), '2026-10-31'), true);
expect('Oct 31 in Tarija (UTC-4), 23:00', foundingOfferOpen(at('2026-10-31T23:00:00-04:00'), '2026-10-31'), true);
expect('midnight after the day at UTC-12', foundingOfferOpen(at('2026-11-01T00:00:00-12:00'), '2026-10-31'), false);
expect('Nov 5 (the review day)', foundingOfferOpen(at('2026-11-05T09:00:00Z'), '2026-10-31'), false);
expect('empty date hides the offer', foundingOfferOpen(at('2026-01-01T00:00:00Z'), ''), false);
expect('a bad date hides the offer', foundingOfferOpen(at('2026-01-01T00:00:00Z'), 'soon'), false);

/* The words on the card name the configured day, EN and ES. */
const [y, m, d] = FOUNDING_ENDS.split('-').map(Number);
if (FOUNDING_ENDS) {
  const en = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const es = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  if (!copy.en.founding.offer.ends.includes(en)) errors.push(`EN ends "${copy.en.founding.offer.ends}" does not name ${en}`);
  if (!copy.es.founding.offer.ends.includes(es)) errors.push(`ES ends "${copy.es.founding.offer.ends}" does not name ${es}`);
}

if (errors.length) {
  for (const e of errors) console.error(`test-founding: ${e}`);
  process.exit(1);
}
console.log(`test-founding clean: offer open through ${FOUNDING_ENDS} in every zone, closed after; card copy names the same day (EN, ES)`);

/* The home page's initial JS against its budget (STUDY-quality-bar 7.4, 100 KB
   gzip) for every mix of the three feature switches, so turning a switch on
   never needs a code change to fit. Builds the site into a temp folder
   (never cinematic/dist; no prerender is needed, the scripts the home page
   links are the same) and checks:
   - the shipped switches (src/switches.ts: booking, guides and Reviews all
     on since Nov 8) fit, and so does the all-off build, so switching any of
     them off never needs a code change either;
   - the headroom with all three on (the shipped mix) is at least
     MIN_HEADROOM, so the next small change cannot silently use up the room;
   - no legal text and no legal chunk in the first load (test-legal-chunk).
   Usage: node scripts/test-initial-js.mjs */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BOOKING_ENABLED, GUIDES_ENABLED, REVIEWS_ENABLED } from '../src/switches.ts';
import { buildSite } from './lib/temp-site.mjs';
import { INITIAL_JS_BUDGET, initialJs } from './lib/initial-js.mjs';

const MIN_HEADROOM = 500;
const failures = [];
const work = mkdtempSync(join(tmpdir(), 'gl-initjs-'));
const sizes = {};

const MIXES = {
  shipped: { env: {}, label: `shipped (booking ${BOOKING_ENABLED}, guides ${GUIDES_ENABLED}, reviews ${REVIEWS_ENABLED})` },
  allOff: { env: { GL_BOOKING_ENABLED: '0', GL_GUIDES_ENABLED: '0', GL_REVIEWS_ENABLED: '0' }, label: 'all three off' },
  allOn: { env: { GL_BOOKING_ENABLED: '1', GL_GUIDES_ENABLED: '1', GL_REVIEWS_ENABLED: '1' }, label: 'booking, guides and reviews on' },
};

for (const [name, { env, label }] of Object.entries(MIXES)) {
  const dir = join(work, name);
  buildSite(dir, env, { prerender: false });
  const js = initialJs(dir);
  sizes[name] = js.bytes;
  if (js.files.length === 0) failures.push(`${label}: the home page loads no module script`);
  if (js.missing.length) failures.push(`${label}: linked but not built: ${js.missing.join(', ')}`);
  if (js.bytes > INITIAL_JS_BUDGET) failures.push(`${label}: initial JS ${js.bytes} B gzip, over the ${INITIAL_JS_BUDGET} B budget`);
  if (js.files.some((f) => /LegalPage/.test(f))) failures.push(`${label}: the legal chunk is in the first load`);
}
if (INITIAL_JS_BUDGET - sizes.allOn < MIN_HEADROOM)
  failures.push(`booking, guides and reviews on leave ${INITIAL_JS_BUDGET - sizes.allOn} B of headroom, under ${MIN_HEADROOM} B`);
if (!(sizes.allOff < sizes.shipped && sizes.shipped <= sizes.allOn)) failures.push(`sizes out of order: off ${sizes.allOff}, shipped ${sizes.shipped}, all on ${sizes.allOn}`);

rmSync(work, { recursive: true, force: true });
if (failures.length) {
  for (const f of failures) console.error(`test-initial-js: ${f}`);
  console.error('\ntest-initial-js FAILED');
  process.exit(1);
}
console.log(
  `test-initial-js clean: initial JS gzip, budget ${INITIAL_JS_BUDGET} B: all off ${sizes.allOff} B, shipped ${sizes.shipped} B, booking + guides + reviews on ${sizes.allOn} B (${INITIAL_JS_BUDGET - sizes.allOn} B of headroom)`,
);

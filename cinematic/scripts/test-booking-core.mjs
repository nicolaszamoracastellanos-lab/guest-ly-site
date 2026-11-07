/* Pure tests for #22 and #50 (no browser): reading every API answer of the
   contract, days and labels across a DST change and in a zone without one,
   the visitor checks and keys (with no crypto.randomUUID), the guides
   catalogue and answers of L7p's v1 contract (and, when a portal checkout
   with the guides API is found, that the stub's catalogue and parser match
   L7p's source), ?guide=, the switches, and the build guard for off features.
   Usage: [GL_L7P_DIR=<portal with #50>] node scripts/test-booking-core.mjs */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  addDays, dayLong, dayOf, dayParts, daysOf, draftProblems, newKey, randomId, readBook, readSlots, timeLabel, validZone, whenLabel, zoneChoices, zoneCity, zonePhrase,
} from '../src/booking/core.ts';
import { guideParam, readCatalogue, readGuide } from '../src/guides/core.ts';
import { resolveSwitches, BOOKING_ENABLED, GUIDES_ENABLED, API_ORIGIN } from '../src/switches.ts';
import { featureClaimProblems } from './lib/feature-claims.mjs';
import { slotsBody, bookedBody, catalogueBody, parseGuideBody, GUIDES, GUIDES_CONSENT } from './lib/booking-stub.mjs';

const errors = [];
let checks = 0;
const eq = (label, got, want) => {
  checks += 1;
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) errors.push(`${label}: got ${g}, want ${w}`);
};
const ok = (label, cond) => eq(label, Boolean(cond), true);
const ORIGIN = 'https://app.guest-ly.com';

/* ---------- switches ship off ---------- */
eq('BOOKING_ENABLED ships false', BOOKING_ENABLED, false);
eq('GUIDES_ENABLED ships false', GUIDES_ENABLED, false);
eq('API origin', API_ORIGIN, ORIGIN);
eq('no env: both off', resolveSwitches({}), { booking: false, guides: false, apiOrigin: ORIGIN });
eq('test env turns them on', resolveSwitches({ GL_BOOKING_ENABLED: '1', GL_GUIDES_ENABLED: 'true' }).booking, true);
eq('local stub origin allowed', resolveSwitches({ GL_API_ORIGIN: 'http://localhost:5310' }).apiOrigin, 'http://localhost:5310');
let refused = false;
try {
  resolveSwitches({ GL_API_ORIGIN: 'https://evil.example' });
} catch {
  refused = true;
}
ok('a third-party API origin is refused', refused);

/* ---------- slots answers (L7P-LOG v1) ---------- */
const now = Date.parse('2026-11-05T15:00:00Z');
const open = slotsBody({ tz: 'America/Chicago', now });
const r = readSlots(200, open);
eq('open: kind', r.kind, 'open');
eq('open: host zone', r.kind === 'open' && r.hostZone, 'America/La_Paz');
eq('open: window zone', r.kind === 'open' && r.window.timeZone, 'America/Chicago');
ok('open: slots sorted and unique', r.kind === 'open' && r.slots.length > 10 && r.slots.every((s, i, a) => i === 0 || Date.parse(a[i - 1]) < Date.parse(s)));
eq('closed', readSlots(200, { v: 1, status: 'closed', slots: [] }).kind, 'closed');
eq('unavailable', readSlots(200, { v: 1, status: 'unavailable', host: null, slots: [] }).kind, 'closed');
eq('404 not_found', readSlots(404, { v: 1, status: 'not_found' }).kind, 'closed');
eq('429 limited', readSlots(429, { v: 1, status: 'limited' }).kind, 'error');
eq('500', readSlots(500, null).kind, 'error');
eq('unreadable body', readSlots(200, null).kind, 'error');
eq('wrong version', readSlots(200, { ...open, v: 2 }).kind, 'error');
eq('bad host zone', readSlots(200, { ...open, host: { name: 'x', timeZone: 'Mars/Base' } }).kind, 'error');
const junk = readSlots(200, { ...open, slots: ['nope', open.slots[1], open.slots[0], open.slots[0]] });
eq('junk slots dropped, duplicates merged, sorted', junk.kind === 'open' && junk.slots, [open.slots[0], open.slots[1]].sort());
eq('nextOpen kept', readSlots(200, { ...open, slots: [], nextOpen: '2026-12-07T13:00:00.000Z' }).nextOpen, '2026-12-07T13:00:00.000Z');

/* ---------- book answers ---------- */
const start = '2026-11-20T15:00:00.000Z';
const booked = readBook(201, bookedBody(ORIGIN, start), ORIGIN);
eq('booked', booked.kind, 'booked');
eq('booked: manage link', booked.manageUrl, `${ORIGIN}/booking/manage/tok_fixture_0123456789abcdefABCDEF`);
eq('booked: ics link', booked.icsUrl, `${ORIGIN}/booking/manage/tok_fixture_0123456789abcdefABCDEF/ics`);
const replay = readBook(201, bookedBody(ORIGIN, start, { replay: true }), ORIGIN);
eq('replay: no links', [replay.kind, replay.replay, replay.manageUrl, replay.icsUrl], ['booked', true, null, null]);
const foreign = readBook(201, { ...bookedBody(ORIGIN, start), booking: { ...bookedBody(ORIGIN, start).booking, manageUrl: 'https://evil.example/booking/manage/x' } }, ORIGIN);
eq('a link to another origin is not shown', foreign.manageUrl, null);
for (const f of ['name', 'email', 'phone', 'weddingDate', 'notes', 'start']) eq(`invalid ${f}`, readBook(400, { v: 1, ok: false, status: 'invalid', field: f }, ORIGIN), { kind: 'invalid', field: f });
eq('invalid null field', readBook(400, { v: 1, ok: false, status: 'invalid', field: null }, ORIGIN), { kind: 'invalid', field: null });
eq('invalid unknown field', readBook(400, { v: 1, ok: false, status: 'invalid', field: 'role' }, ORIGIN), { kind: 'invalid', field: null });
eq('taken with fresh slots', readBook(409, { v: 1, ok: false, status: 'taken', slots: [start] }, ORIGIN), { kind: 'taken', slots: [start] });
eq('409 closed', readBook(409, { v: 1, ok: false, status: 'closed', slots: [] }, ORIGIN).kind, 'closed');
eq('404', readBook(404, { v: 1, ok: false, status: 'not_found' }, ORIGIN).kind, 'closed');
eq('503', readBook(503, { v: 1, ok: false, status: 'unavailable' }, ORIGIN).kind, 'closed');
eq('500', readBook(500, { v: 1 }, ORIGIN).kind, 'error');
eq('no body', readBook(502, null, ORIGIN).kind, 'error');

/* ---------- days and labels ---------- */
/* Chicago leaves daylight saving on Sun Nov 1 2026: a 9:00 La Paz slot is
   8:00 Chicago before and 7:00 after. La Paz has no DST. */
eq('Chicago before the change', timeLabel('2026-10-30T13:00:00.000Z', 'America/Chicago', 'en'), '8:00 am');
eq('Chicago after the change', timeLabel('2026-11-02T13:00:00.000Z', 'America/Chicago', 'en'), '7:00 am');
eq('La Paz, ES 24 h', timeLabel('2026-11-02T13:00:00.000Z', 'America/La_Paz', 'es'), '09:00');
eq('ES afternoon', timeLabel('2026-11-02T18:30:00.000Z', 'America/La_Paz', 'es'), '14:30');
eq('a late slot belongs to the visitor day', dayOf('2026-11-21T03:30:00.000Z', 'America/Chicago'), '2026-11-20');
eq('the same slot in Madrid', dayOf('2026-11-21T03:30:00.000Z', 'Europe/Madrid'), '2026-11-21');
eq('addDays over the month', addDays('2026-11-30', 2), '2026-12-02');
const ds = daysOf(['2026-11-03T15:00:00.000Z', '2026-11-03T16:00:00.000Z', '2026-11-05T15:00:00.000Z'], 'America/Chicago', '2026-11-02', 5);
eq('daysOf: every day, slots grouped', ds.map((d) => [d.day, d.slots.length]), [['2026-11-02', 0], ['2026-11-03', 2], ['2026-11-04', 0], ['2026-11-05', 1], ['2026-11-06', 0]]);
eq('daysOf: a fresh list past the window extends it', daysOf(['2026-11-20T15:00:00.000Z'], 'UTC', '2026-11-18', 2).length, 3);
eq('day strip EN', dayParts('2026-11-20', 'en'), { weekday: 'Fri', date: 'Nov 20' });
eq('day strip ES', dayParts('2026-11-20', 'es'), { weekday: 'vie', date: '20 nov' });
eq('long day EN', dayLong('2026-11-20', 'en'), 'Friday, November 20');
eq('long day ES', dayLong('2026-11-20', 'es'), 'viernes, 20 de noviembre');
eq('when EN', whenLabel(start, 'America/Chicago', 'en'), 'Friday, November 20, 9:00 am');
eq('zone city', [zoneCity('America/Argentina/Buenos_Aires'), zoneCity('America/La_Paz'), zoneCity('UTC')], ['Buenos Aires', 'La Paz', 'UTC']);
eq('zone phrase', [zonePhrase('America/Chicago', 'en'), zonePhrase('America/Chicago', 'es')], ['Chicago time', 'hora de Chicago']);
eq('accents and Spanish names', [zonePhrase('America/Bogota', 'es'), zonePhrase('America/Bogota', 'en'), zonePhrase('America/Mexico_City', 'es'), zonePhrase('America/Sao_Paulo', 'en')], ['hora de Bogotá', 'Bogota time', 'hora de Ciudad de México', 'São Paulo time']);
ok('zone choices start with the visitor and the host, no duplicates', (() => {
  const z = zoneChoices('Asia/Tokyo', 'America/La_Paz');
  return z[0] === 'Asia/Tokyo' && z[1] === 'America/La_Paz' && new Set(z).size === z.length && z.every(validZone);
})());
eq('a bogus visitor zone is dropped', zoneChoices('Nowhere/City', 'America/La_Paz')[0], 'America/La_Paz');

/* ---------- visitor checks ---------- */
const good = { name: 'Ana Pérez', email: 'ana@example.com', phone: '', weddingDate: '', notes: '' };
eq('a clean draft', draftProblems(good), []);
eq('empty name and email', draftProblems({ ...good, name: ' ', email: '' }), ['name', 'email']);
eq('bad email', draftProblems({ ...good, email: 'ana@' }), ['email']);
eq('phone with letters', draftProblems({ ...good, phone: 'call me' }), ['phone']);
eq('phone with + and spaces', draftProblems({ ...good, phone: '+591 70000000' }), []);
eq('long note', draftProblems({ ...good, notes: 'x'.repeat(1001) }), ['notes']);
const key = newKey();
ok('key shape (8 to 80 of A-Za-z0-9_-)', /^[A-Za-z0-9_-]{8,80}$/.test(key));
ok('keys differ', newKey() !== key);
eq('short random padded', newKey(() => 'ab'), 'ab000000');

/* ---------- keys without crypto.randomUUID (Safari before 15.4, http) ---------- */
const fixed = new Uint8Array(16).fill(171);
ok('randomId with getRandomValues only', /^[0-9a-f]{32}$/.test(randomId({ getRandomValues: (a) => (a.set(fixed), a) })));
ok('randomId with no crypto at all', /^[a-z0-9]{8,}$/.test(randomId(null)));
ok('randomId with an empty crypto object', /^[a-z0-9]{8,}$/.test(randomId({})));
{
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: (a) => globalThis.__c.getRandomValues(a) } });
  globalThis.__c = saved.get ? saved.get.call(globalThis) : saved.value;
  let k = '';
  try {
    k = newKey();
  } catch (e) {
    k = String(e);
  }
  Object.defineProperty(globalThis, 'crypto', saved);
  delete globalThis.__c;
  ok(`newKey without randomUUID does not throw (${k})`, /^[A-Za-z0-9_-]{8,80}$/.test(k));
}

/* ---------- guides catalogue (GET /api/public/guides, L7p v1) ---------- */
const cat = readCatalogue(200, catalogueBody('open'));
eq('catalogue open: every guide', cat.kind === 'open' ? cat.guides.map((x) => x.code) : [], GUIDES.map((x) => x.code));
eq('catalogue open: consent from the server', cat.kind === 'open' ? cat.consent : null, GUIDES_CONSENT);
eq('catalogue open: place line kept', cat.kind === 'open' ? cat.guides[3].place.es : null, 'Quintana Roo, México');
for (const st of ['closed', 'unavailable']) eq(`catalogue ${st} hides`, readCatalogue(200, catalogueBody(st)).kind, 'hidden');
eq('catalogue 429 hides', readCatalogue(429, { v: 1, status: 'limited' }).kind, 'hidden');
eq('catalogue 404 hides', readCatalogue(404, null).kind, 'hidden');
eq('catalogue 500 hides', readCatalogue(500, { v: 1 }).kind, 'hidden');
eq('catalogue wrong version hides', readCatalogue(200, { ...catalogueBody('open'), v: 2 }).kind, 'hidden');
eq('catalogue without consent text hides', readCatalogue(200, { ...catalogueBody('open'), consent: { version: 'x', text: { en: 'Send' } } }).kind, 'hidden');
eq('catalogue with no guides hides', readCatalogue(200, { ...catalogueBody('open'), guides: [] }).kind, 'hidden');
{
  const junk = readCatalogue(200, { ...catalogueBody('open'), guides: [GUIDES[0], { code: 'Bad Code', name: GUIDES[1].name, place: GUIDES[1].place }, { code: 'x-1', name: { en: 'Only EN' }, place: GUIDES[1].place }, GUIDES[0], 'x'] });
  eq('catalogue drops junk and repeats', junk.kind === 'open' ? junk.guides.map((x) => x.code) : [], [GUIDES[0].code]);
}

/* ---------- guides answers (POST /api/public/guides/request, L7p v1) ---------- */
eq('200 sent', readGuide(200, { v: 1, ok: true, status: 'sent' }), { kind: 'sent' });
eq('invalid email', readGuide(400, { v: 1, ok: false, status: 'invalid', field: 'email' }), { kind: 'invalid', field: 'email' });
eq('invalid code', readGuide(400, { v: 1, ok: false, status: 'invalid', field: 'code' }), { kind: 'invalid', field: 'code' });
eq('invalid unreadable body', readGuide(400, { v: 1, ok: false, status: 'invalid', field: null }), { kind: 'invalid', field: null });
eq('invalid other', readGuide(400, { v: 1, ok: false, status: 'invalid', field: 'x' }), { kind: 'invalid', field: null });
eq('409 closed', readGuide(409, { v: 1, ok: false, status: 'closed' }).kind, 'closed');
eq('503 is retry, not closed', readGuide(503, { v: 1, ok: false, status: 'unavailable' }).kind, 'retry');
eq('404 route missing', readGuide(404, null).kind, 'closed');
eq('500', readGuide(500, { v: 1 }).kind, 'error');
eq('unreadable 200', readGuide(200, null).kind, 'error');

/* ---------- the stub parses like L7p ---------- */
const body = { email: 'Ana@Example.com', code: 'co-cartagena', lang: 'es', visitorTz: 'America/Chicago', tips: false, consentVersion: GUIDES_CONSENT.version, fax_number: '' };
eq('stub parser: the landing body', parseGuideBody(body), { ok: true, input: { email: 'ana@example.com', code: 'co-cartagena', lang: 'es', tips: false } });
eq('stub parser: ticked', parseGuideBody({ ...body, tips: true }).input.tips, true);
eq('stub parser: ticked, old version reads unticked', parseGuideBody({ ...body, tips: true, consentVersion: 'guides-tips-2026-11-05' }).input.tips, false);
eq('stub parser: the old body {destination, consent} is refused on code', parseGuideBody({ email: 'ana@example.com', destination: 'co-cartagena', consent: true, consentVersion: 'guides-tips-2026-11-05' }), { ok: false, field: 'code' });
eq('stub parser: unknown code', parseGuideBody({ ...body, code: 'xx-nowhere' }), { ok: false, field: 'code' });
eq('stub parser: bad email first', parseGuideBody({ ...body, email: 'ana@' }), { ok: false, field: 'email' });

/* ---------- ?guide= ---------- */
eq('?guide=<code>', guideParam('?guide=co-cartagena'), 'co-cartagena');
eq('?guide=all', guideParam('?x=1&guide=all'), 'all');
eq('?guide=junk ignored', guideParam('?guide=%3Cscript%3E'), null);
eq('no ?guide', guideParam('?book=demo'), null);

/* ---------- the stub matches L7p's source, when a checkout with #50 is found ---------- */
const l7p = [process.env.GL_L7P_DIR, process.env.GL_PORTAL_DIR].find((d) => d && existsSync(join(d, 'src/lib/guides/core.ts')));
if (l7p) {
  const i18n = readFileSync(join(l7p, 'src/lib/i18n/guides.ts'), 'utf8');
  const core = readFileSync(join(l7p, 'src/lib/guides/core.ts'), 'utf8');
  eq('L7p consent version', /TIPS_CONSENT_VERSION = "([^"]+)"/.exec(i18n)?.[1], GUIDES_CONSENT.version);
  const textBlock = /TIPS_CONSENT_TEXT[^=]*=\s*\{([^}]+)\}/.exec(i18n)?.[1] ?? '';
  eq('L7p consent text EN', /en:\s*"([^"]+)"/.exec(textBlock)?.[1], GUIDES_CONSENT.text.en);
  eq('L7p consent text ES', /es:\s*"([^"]+)"/.exec(textBlock)?.[1], GUIDES_CONSENT.text.es);
  const parser = core.slice(core.indexOf('export function parseGuideRequest'), core.indexOf('export function mintToken'));
  const reads = [...new Set([...parser.matchAll(/raw\.(\w+)/g)].map((m) => m[1]))].sort();
  const sends = Object.keys(body).filter((k) => k !== 'fax_number').sort();
  eq('L7p parser reads exactly the fields the landing sends', reads, sends);
  ok('L7p parser refuses a missing code on field "code"', /field:\s*"code"/.test(parser));
  ok('L7p parser counts tips only as === true', /raw\.tips === true/.test(parser));
  const data = join(l7p, 'src/lib/destinations/data/destinations.json');
  if (existsSync(data)) {
    const ds = JSON.parse(readFileSync(data, 'utf8'));
    eq('stub catalogue codes = L7p fact-checked places', ds.destinations.filter((d) => d.review_status === 'fact_checked').map((d) => d.id), GUIDES.map((x) => x.code));
  }
  console.log(`test-booking-core: guides contract checked against ${l7p}`);
} else console.log('test-booking-core: no portal checkout with the guides API (GL_L7P_DIR), L7p source check skipped');

/* ---------- build guard for off features ---------- */
const offSw = { booking: false, guides: false };
eq('clean off build', featureClaimProblems({ switches: offSw, home: '<main></main>', privacy: '<h2>Data</h2>', assets: [{ name: 'index-a.js', text: 'x' }], ld: ['Plans'], llms: [{ name: 'llms.txt', text: '# Guest-ly' }] }), []);
const planted = featureClaimProblems({
  switches: offSw,
  home: '<button data-book="">Book a demo call</button><section id="guides">',
  privacy: '<h2>Demo calls</h2><h2>Guías de destino</h2>',
  assets: [{ name: 'BookingModal-x.js', text: '' }, { name: 'index-b.js', text: '"/api/public/guides/request"' }],
  ld: ['Book a demo with us', 'Free destination guides'],
  llms: [{ name: 'es/llms.txt', text: '# Guest-ly\n- Agenda una demo\n- Guías gratis de destino' }],
});
for (const want of ['home page shows it', 'privacy page discloses it', 'has its chunk BookingModal', 'calls /api/public/guides', 'JSON-LD says: Book a demo', 'JSON-LD says: Free destination', 'es/llms.txt line 2', 'es/llms.txt line 3'])
  ok(`planted off-feature caught: ${want}`, planted.some((p) => p.includes(want)));
eq('on: the home page must show it', featureClaimProblems({ switches: { booking: true, guides: true }, home: '<main></main>' }).length, 2);

if (errors.length) {
  for (const e of errors) console.error(`test-booking-core: ${e}`);
  process.exit(1);
}
console.log(`test-booking-core clean: ${checks} checks (API answers, DST and zones, visitor checks, keys without randomUUID, guides catalogue and answers, stub parser, ?guide=, switches ship off, off-feature guard)`);

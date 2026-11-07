/* #22 demo booking and #50 destination guides: what a build may say and
   carry for each switch (src/switches.ts). Used by scripts/check-seo.mjs
   (fails the build) and tested by scripts/test-booking-core.mjs.
   - Switch off: no booking button or guides section in the prerendered home
     page, no disclosure for it on the privacy page, no asset that calls its
     API path or holds its lazy chunk.
   - Search and AI engines (JSON-LD, llms.txt and friends) never describe a
     feature whose switch is off. With the switch on, llms.txt can name it
     only once features.json marks it live and ok (scripts/llms.mjs).
   No dependencies. */

export const BOOKING_CLAIM =
  /\bbook(ing)? (a |an |your )?(demo|call)\b|\bdemo calls?\b|\bagendar? una (demo|llamada)\b|\bllamadas? de demo\b|\breservar? una demo\b/iu;
export const GUIDE_CLAIM = /\bdestination guides?\b|\bfree (destination )?guides?\b|\bgu[ií]as? de destino\b|\bgu[ií]as? gratis\b/iu;

/* switches: { booking, guides }. home, privacy: prerendered HTML.
   assets: [{ name, text }] of dist/assets/*.js. ld: JSON-LD strings.
   llms: [{ name, text }]. Returns problems as strings. */
export function featureClaimProblems({ switches, home = '', privacy = '', assets = [], ld = [], llms = [] }) {
  const out = [];
  const features = [
    {
      key: 'booking',
      label: '#22 demo booking (BOOKING_ENABLED)',
      claim: BOOKING_CLAIM,
      api: '/api/public/booking/',
      chunk: /^BookingModal-/,
      inHome: /\bdata-book=/,
      inPrivacy: /<h2>(Demo calls|Llamadas de demo)<\/h2>/,
    },
    {
      key: 'guides',
      label: '#50 destination guides (GUIDES_ENABLED)',
      claim: GUIDE_CLAIM,
      api: '/api/public/guides',
      chunk: /^GuidesForm-/,
      inHome: /\bid="guides"/,
      inPrivacy: /<h2>(Destination guides|Guías de destino)<\/h2>/,
    },
  ];
  for (const f of features) {
    const on = Boolean(switches[f.key]);
    if (on) {
      if (!f.inHome.test(home)) out.push(`${f.label} is on, but the prerendered home page does not show it`);
      continue;
    }
    if (f.inHome.test(home)) out.push(`${f.label} is off, but the prerendered home page shows it`);
    if (f.inPrivacy.test(privacy)) out.push(`${f.label} is off, but the privacy page discloses it`);
    for (const a of assets) {
      if (f.chunk.test(a.name)) out.push(`${f.label} is off, but the build has its chunk ${a.name}`);
      if (a.text.includes(f.api)) out.push(`${f.label} is off, but ${a.name} calls ${f.api}`);
    }
    for (const s of ld) if (f.claim.test(s)) out.push(`${f.label} is off, but the JSON-LD says: ${s.slice(0, 90)}`);
    for (const file of llms) {
      file.text.split('\n').forEach((line, i) => {
        if (f.claim.test(line)) out.push(`${f.label} is off, but ${file.name} line ${i + 1} says: ${line.trim().slice(0, 90)}`);
      });
    }
  }
  return out;
}

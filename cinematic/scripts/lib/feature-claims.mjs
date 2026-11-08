/* #22 demo booking and #50 destination guides: what a build may say and
   carry for each switch (src/switches.ts). Used by scripts/check-seo.mjs
   (fails the build) and tested by scripts/test-booking-core.mjs.
   - Run time only (guides, booking: the Reviews tab's rule): never in the
     prerendered home page, switch on or off; on, the chunk and the read must
     be in the build.
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
      chunk: /^(BookingModal|BookingGate)-/,
      inHome: /\bdata-book=|\bbook-line\b|\bfaq-human__book\b|\bnav__menu-book\b/,
      /* Like the guides and the Reviews tab (Nov 8): the buttons exist at run
         time only (added after an "open" read of the slots), never in the
         prerendered page, switch on or off. */
      runtime: true,
      inPrivacy: /<h2>(Demo calls|Llamadas de demo)<\/h2>/,
    },
    {
      key: 'guides',
      label: '#50 destination guides (GUIDES_ENABLED)',
      claim: GUIDE_CLAIM,
      api: '/api/public/guides',
      chunk: /^GuidesTab-/,
      inHome: /\bid="guides"|\bclass="guides/,
      /* Like the Reviews tab: the section exists at run time only (added after
         an "open" read), never in the prerendered page, switch on or off. */
      runtime: true,
      inPrivacy: /<h2>(Destination guides|Guías de destino)<\/h2>/,
    },
  ];
  for (const f of features) {
    const on = Boolean(switches[f.key]);
    if (on) {
      if (f.runtime) {
        if (f.inHome.test(home) || (f.key === 'guides' && /href="#guides"/.test(home))) out.push(`${f.label} is on, but the prerendered home page holds it (run time only)`);
        if (!assets.some((a) => f.chunk.test(a.name))) out.push(`${f.label} is on, but the build has no ${f.chunk.source.replace(/^\^/, "")} chunk`);
        if (!assets.some((a) => a.text.includes(f.api))) out.push(`${f.label} is on, but no asset reads ${f.api}`);
      } else if (!f.inHome.test(home)) out.push(`${f.label} is on, but the prerendered home page does not show it`);
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

/* The Reviews tab (REVIEWS_ENABLED): reviews exist only at run time, read
   from the API. Whatever the switch, the build itself may never carry a
   review: no Reviews section or nav item in the prerendered pages, no
   Review, AggregateRating or Rating in the JSON-LD, no rating claim in an AI
   facts file, and no asset holding a test fixture's words. Off: no chunk,
   no CSS and no asset calling the API. On: the chunk and the one read are
   in the build. fixtures: strings from scripts/lib/reviews-stub.mjs. */
export const REVIEW_CLAIM =
  /\b\d(?:[.,]\d)? (?:out )?of 5\b|\b\d(?:[.,]\d)? (?:de 5|stars?|estrellas?)\b|\baggregate ?rating\b|\bratingValue\b|\b(?:customer|couple) reviews\b|\btestimonials?\b|\btestimonios?\b|\brese[ñn]as de (?:parejas|clientes)\b/iu;

export function reviewsClaimProblems({ switches, home = '', pages = [], assets = [], css = [], ld = [], llms = [], fixtures = [] }) {
  const out = [];
  const label = 'Reviews tab (REVIEWS_ENABLED)';
  for (const [name, html] of [['home page', home], ...pages]) {
    if (/\bid="reviews"/.test(html)) out.push(`${label}: the prerendered ${name} holds the Reviews section (run time only)`);
    if (/href="#reviews"/.test(html)) out.push(`${label}: the prerendered ${name} holds the Reviews nav item (run time only)`);
  }
  for (const s of ld) if (/^(Review|AggregateRating|Rating)$/.test(s) || REVIEW_CLAIM.test(s)) out.push(`${label}: the built JSON-LD holds a review or rating: ${s.slice(0, 90)}`);
  for (const file of llms) {
    file.text.split('\n').forEach((line, i) => {
      if (REVIEW_CLAIM.test(line)) out.push(`${label}: ${file.name} line ${i + 1} claims reviews or a rating: ${line.trim().slice(0, 90)}`);
    });
  }
  for (const a of [...assets, ...css]) {
    for (const f of fixtures) if (f && a.text.includes(f)) out.push(`${label}: ${a.name} holds test fixture text "${f.slice(0, 40)}"`);
  }
  const chunk = assets.find((a) => /^ReviewsTab-/.test(a.name));
  const reads = assets.some((a) => a.text.includes('/api/public/reviews'));
  if (switches.reviews) {
    if (!chunk) out.push(`${label} is on, but the build has no ReviewsTab chunk`);
    if (!reads) out.push(`${label} is on, but no asset reads /api/public/reviews`);
  } else {
    if (chunk) out.push(`${label} is off, but the build has its chunk ${chunk.name}`);
    if (reads) out.push(`${label} is off, but an asset calls /api/public/reviews`);
    for (const c of css) if (/\.reviews-(score|stars|list)\b/.test(c.text)) out.push(`${label} is off, but ${c.name} holds its CSS`);
  }
  return out;
}

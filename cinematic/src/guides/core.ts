/* #50 destination guides, the pure part: reading the catalogue, the request
   body and reading the answer. Contract: L7P-LOG "Guides API for the landing
   (v1, fixed Nov 5)" on app.guest-ly.com:
   GET  /api/public/guides          the guides on offer and the tips sentence
   POST /api/public/guides/request  one guide by email
   No guide data lives in the landing (D24): the cards, the checkbox sentence
   and its version all come from the catalogue. No browser or Vite globals,
   so the Node tests import it directly. */

import { CODE_RE } from './link.ts';

export { CODE_RE, guideParam } from './link.ts';

export type GuideLang = 'en' | 'es';
type Pair = { en: string; es: string };

export type CatalogueGuide = { code: string; name: Pair; place: Pair };
/* open: cards and the tips sentence. hidden: closed, unavailable, limited,
   not deployed or unreadable; the section is not shown. */
export type Catalogue = { kind: 'open'; guides: CatalogueGuide[]; consent: { version: string; text: Pair } } | { kind: 'hidden' };

export type GuideRequest = {
  email: string;
  /* A catalogue code, e.g. "co-cartagena". */
  code: string;
  lang: GuideLang;
  visitorTz: string;
  /* true only when the box is ticked; never ticked by default. */
  tips: boolean;
  /* The catalogue's consent.version (another value reads as unticked). */
  consentVersion: string;
  /* Honeypot: '' from people. */
  fax_number: string;
};

export type GuideField = 'email' | 'code';
/* retry: 503, the email could not be sent; keep the input, a retry sends.
   closed: 409 (switched off since the catalogue loaded) or 404 (not deployed). */
export type GuideResult = { kind: 'sent' } | { kind: 'invalid'; field: GuideField | null } | { kind: 'closed' } | { kind: 'retry' } | { kind: 'error' };

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const pair = (v: unknown, max: number): Pair | null => (isObj(v) && text(v.en, max) && text(v.es, max) ? { en: v.en, es: v.es } : null);


export function readCatalogue(status: number, body: unknown): Catalogue {
  if (status !== 200 || !isObj(body) || body.v !== 1 || body.status !== 'open' || !Array.isArray(body.guides)) return { kind: 'hidden' };
  const consent = isObj(body.consent) && text(body.consent.version, 64) ? { version: body.consent.version, text: pair(body.consent.text, 200) } : null;
  if (!consent?.text) return { kind: 'hidden' };
  const guides: CatalogueGuide[] = [];
  for (const g of body.guides.slice(0, 40)) {
    if (!isObj(g) || typeof g.code !== 'string' || !CODE_RE.test(g.code)) continue;
    const name = pair(g.name, 80);
    const place = pair(g.place, 120);
    if (name && place && !guides.some((x) => x.code === g.code)) guides.push({ code: g.code, name, place });
  }
  return guides.length ? { kind: 'open', guides, consent: { version: consent.version, text: consent.text } } : { kind: 'hidden' };
}

/* Every accepted, repeated, limited or honeypot request answers the same
   200 sent (the server never says whether an address asked before). */
export function readGuide(status: number, body: unknown): GuideResult {
  if (status === 404) return { kind: 'closed' };
  if (!isObj(body) || body.v !== 1) return { kind: 'error' };
  if (status >= 200 && status < 300 && body.ok === true) return { kind: 'sent' };
  if (status === 400 && body.status === 'invalid') {
    const f = body.field;
    return { kind: 'invalid', field: f === 'email' || f === 'code' ? f : null };
  }
  if (status === 409) return { kind: 'closed' };
  if (status === 503) return { kind: 'retry' };
  return { kind: 'error' };
}

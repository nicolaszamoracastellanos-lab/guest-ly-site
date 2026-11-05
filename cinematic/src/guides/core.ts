/* #50 destination guides, the pure part: the request body and reading the
   answer of POST /api/public/guides/request (contract in L7-LOG "Guides API
   for the landing", proposed by L7 for L7p). No browser or Vite globals, so
   the Node tests import it directly. */

export type GuideRequest = {
  /* The destinations dataset id, e.g. "co-cartagena". */
  destination: string;
  email: string;
  lang: 'en' | 'es';
  visitorTz: string;
  /* The tips box, never ticked by default. consentText is the exact sentence
     the person saw, sent only when ticked, with its version. */
  consent: boolean;
  consentVersion: string;
  consentText?: string;
  idempotencyKey: string;
  /* Honeypot: '' from people. */
  fax_number: string;
};

export type GuideField = 'email' | 'destination';
export type GuideResult = { kind: 'sent' } | { kind: 'invalid'; field: GuideField | null } | { kind: 'closed' } | { kind: 'error' };

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/* Every accepted, repeated, limited or honeypot request answers the same
   success (the server never says whether an address asked before). */
export function readGuide(status: number, body: unknown): GuideResult {
  if (!isObj(body) || body.v !== 1) return status === 404 ? { kind: 'closed' } : { kind: 'error' };
  if (status >= 200 && status < 300 && body.ok === true) return { kind: 'sent' };
  if (status === 400 && body.status === 'invalid') {
    const f = body.field;
    return { kind: 'invalid', field: f === 'email' || f === 'destination' ? f : null };
  }
  if (status === 404 || status === 409 || status === 503) return { kind: 'closed' };
  return { kind: 'error' };
}

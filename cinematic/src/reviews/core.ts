/* The Reviews tab: reading GET /api/public/reviews and the words around it.
   Pure (no DOM, no fetch), so scripts/test-reviews-core.mjs runs it in Node.
   Contract: L6-LOG "Reviews API for the landing" (v1, fixed 2026-11-07).

   Rules from the contract, all here:
   - the tab shows only for a 200, v 1, status "open", count > 0 and at least
     one readable review; anything else (closed, unavailable, 429, 401, 5xx,
     a network error, a body that does not parse) is null: nothing shows;
   - the average and the count are printed as given, never recomputed from
     the list (the list is only the newest few);
   - no rating gate: every review in the answer, low or high, in the order
     given;
   - the month is formatted with Intl in the visitor's language;
   - text and name stay text (React renders them as text, never HTML). */

export type Lang = 'en' | 'es';

export type Review = {
  id: string;
  rating: number;
  text: string;
  name: string;
  /** "YYYY-MM", the wedding month, or null. */
  month: string | null;
};

export type Reviews = {
  /** Every published review (not just this list). */
  count: number;
  /** Mean rating of every published review, one decimal, as the API gave it. */
  average: number;
  /** The newest published reviews, at most REVIEWS_LIMIT, in the API's order. */
  reviews: Review[];
};

/* How many the page shows: two rows of three at 1440. The count and the
   average still cover every published review. */
export const REVIEWS_LIMIT = 6;
export const REVIEWS_PATH = '/api/public/reviews';

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '').slice(0, max);

function readOne(raw: unknown): Review | null {
  if (!isObj(raw)) return null;
  const id = clean(raw.id, 64);
  const text = clean(raw.text, 400);
  const name = clean(raw.name, 60);
  const rating = raw.rating;
  if (!id || !text || !name) return null;
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  const month = typeof raw.month === 'string' && MONTH_RE.test(raw.month) ? raw.month : null;
  return { id, rating, text, name, month };
}

/* status: the HTTP status; body: the parsed JSON (or null). */
export function readReviews(status: number, body: unknown): Reviews | null {
  if (status !== 200 || !isObj(body) || body.v !== 1 || body.status !== 'open') return null;
  const { count, average } = body;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) return null;
  if (typeof average !== 'number' || !Number.isFinite(average) || average < 1 || average > 5) return null;
  if (!Array.isArray(body.reviews)) return null;
  const seen = new Set<string>();
  const reviews: Review[] = [];
  for (const raw of body.reviews) {
    const r = readOne(raw);
    if (!r || seen.has(r.id)) continue;
    seen.add(r.id);
    reviews.push(r);
    if (reviews.length === REVIEWS_LIMIT) break;
  }
  /* Nothing to show, or a list longer than the count it claims to be part of. */
  if (reviews.length === 0 || reviews.length > count) return null;
  return { count, average, reviews };
}

export const locale = (lang: Lang) => (lang === 'es' ? 'es-MX' : 'en-US');

/** "4.7"; one decimal, as given ("4" prints "4.0"). */
export function averageLabel(average: number, lang: Lang): string {
  return new Intl.NumberFormat(locale(lang), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(average);
}

/** "November 2026" / "noviembre de 2026"; '' for no month. Noon UTC on the
    15th, formatted in UTC, so no time zone moves it to another month. */
export function monthLabel(month: string | null, lang: Lang): string {
  const m = month ? MONTH_RE.exec(month) : null;
  if (!m) return '';
  const at = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 15, 12));
  return new Intl.DateTimeFormat(locale(lang), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(at);
}

/** How much of each of the five stars is filled for a rating (to a tenth). */
export function starFills(value: number): number[] {
  const v = Math.round(Math.min(5, Math.max(0, value)) * 10) / 10;
  return [0, 1, 2, 3, 4].map((i) => Math.round(Math.min(1, Math.max(0, v - i)) * 10) / 10);
}

/** Fills "{name}" placeholders. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? String(values[key]) : all));
}

/* schema.org, from the answer only: an aggregateRating with the API's own
   average and count, and one Review per review shown. Added at run time to
   the Product block the build writes (src/seo/jsonld.ts); never prerendered. */
export function reviewsLd(data: Reviews) {
  return {
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: data.average,
      reviewCount: data.count,
      bestRating: 5,
      worstRating: 1,
    },
    review: data.reviews.map((r) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.name },
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      reviewBody: r.text,
    })),
  };
}

/** The Product block with the reviews added (a new object; the input is untouched). */
export function withReviewsLd(product: Record<string, unknown>, data: Reviews): Record<string, unknown> {
  return { ...product, ...reviewsLd(data) };
}

/** JSON for a script element: "<" escaped so no text can close the element. */
export function ldText(data: unknown): string {
  return JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
}

// #20 Review ask, the app's Home card (Master Wave, 1.4.0). GET /couple/home
// sends `cards.review` ({ feedback_link, dismiss } or null) to app 1.4.0 and up
// while MW_REVIEW_ASK is on for the wedding, after the wedding day, until this
// person sends feedback or taps "Not now". A rating (or the card's own button)
// asks POST feedback_link for a no-login URL and opens it in the in-app
// browser (?r=N picks the rating); "Not now" is POST dismiss { dismissed }
// with Undo. When the browser closes, Apple's rating sheet may be asked for
// once per install (expo-store-review), never gated on the rating.
//
// Pure: no React, no network. scripts/tests/review-card.test.ts runs it.

export type ReviewCard = { link: string; dismiss: string };

const PATH = /^\/couple\/feedback\/[a-z]+$/;

/** cards.review as the app can use it; null for no key (flag off, older portal), null, or anything odd. */
export function readReviewCard(raw: unknown): ReviewCard | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const link = typeof r.feedback_link === "string" && PATH.test(r.feedback_link) ? r.feedback_link : null;
  const dismiss = typeof r.dismiss === "string" && PATH.test(r.dismiss) ? r.dismiss : null;
  return link && dismiss ? { link, dismiss } : null;
}

export const RATINGS = [1, 2, 3, 4, 5] as const;
export type Rating = (typeof RATINGS)[number];

/** The feedback page URL with the rating picked (the page reads ?r=N for an unsent answer only). */
export function withRating(url: string, n: Rating | null): string {
  if (n === null) return url;
  const [base, hash] = url.split("#");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}r=${n}${hash !== undefined ? `#${hash}` : ""}`;
}

/** The URL POST feedback_link answered, if it is one the browser may open (https, or http on a local stack). */
export function readLinkUrl(data: unknown): string | null {
  const url = data && typeof data === "object" ? (data as Record<string, unknown>).url : null;
  if (typeof url !== "string") return null;
  return /^https:\/\/\S+$/.test(url) || /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\/\S*$/.test(url) ? url : null;
}

/** Install-wide (not per person, not cleared on sign-out): Apple's sheet is asked for once per install. */
export const STORE_REVIEW_KEY = "gl.storeReviewAsked.v1";

/**
 * Whether to ask iOS for its rating sheet now, after the feedback browser
 * closed. Once per install; only where the sheet can show (isAvailableAsync,
 * hasAction); only strictly after the wedding day in the phone's calendar, so
 * never on the day or the day before. The rating chosen plays no part.
 */
export function storeReviewDue(o: { asked: boolean; available: boolean; hasAction: boolean; weddingDate: string | null | undefined; today: string }): boolean {
  if (o.asked || !o.available || !o.hasAction) return false;
  const day = typeof o.weddingDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(o.weddingDate) ? o.weddingDate.slice(0, 10) : null;
  return !!day && o.today > day;
}

/** Today in the phone's calendar, YYYY-MM-DD. */
export function localDay(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Words: the portal's (src/lib/i18n/feedback.ts, word for word) plus the two failure lines the app needs. */
export const REVIEW_COPY = {
  en: {
    body: "How did Guest-ly do for your wedding? Only our team reads your answer.",
    ratings: { 1: "Poor", 2: "Fair", 3: "Good", 4: "Very good", 5: "Excellent" } as Record<Rating, string>,
    give: "Give feedback",
    notNow: "Not now",
    dismissed: "Card hidden",
    openFailed: "Could not open your feedback page.",
    hideFailed: "Could not hide the card.",
  },
  es: {
    body: "¿Cómo te fue con Guest-ly en tu boda? Solo nuestro equipo lee tu respuesta.",
    ratings: { 1: "Mal", 2: "Regular", 3: "Bien", 4: "Muy bien", 5: "Excelente" } as Record<Rating, string>,
    give: "Dar tu opinión",
    notNow: "Ahora no",
    dismissed: "Tarjeta oculta",
    openFailed: "No se pudo abrir tu página de opinión.",
    hideFailed: "No se pudo ocultar la tarjeta.",
  },
};
export type ReviewCopy = (typeof REVIEW_COPY)["en"];

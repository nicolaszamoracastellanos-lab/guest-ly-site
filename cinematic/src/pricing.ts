/* Guest-ly's own prices, guest caps and included months on guest-ly.com.
   The plan cards and every copy line that names one of our prices (copy.ts,
   EN and ES, built with template literals), the order wizard (config.ts)
   and the JSON-LD offers and FAQ in index.html (src/seo/jsonld.ts, built
   from that copy) read these values. scripts/test-jsonld.mjs fails if any
   copy string names a dollar amount or a month count that is not one of
   these (the compare table's competitor prices are the only exception), and
   scripts/check-seo.mjs fails the build if the built JSON-LD differs from
   the rendered page. Prices must match the Stripe Payment Links in config.ts. */

export type PlanId = 'essentials' | 'signature' | 'grande';

export interface PlanPrice {
  name: string;
  price: number;
  /* Highest guest count the plan covers; null means open ended ("500+"). */
  maxGuests: number | null;
  /* Shown as "N+" when the plan is open ended. */
  fromGuests?: number;
}

export const CURRENCY = 'USD';
export const MONTHS_INCLUDED = 5;
export const MAINTENANCE_MONTHLY = 20;
export const COORDINATOR_ONCE = 79;
export const COORDINATOR_MONTHLY = 19;

export const PLANS: Record<PlanId, PlanPrice> = {
  essentials: { name: 'Essentials', price: 199, maxGuests: 160 },
  signature: { name: 'Signature', price: 399, maxGuests: 300 },
  grande: { name: 'Grande', price: 699, maxGuests: null, fromGuests: 500 },
};

/* "5th", "1st", "22nd": the English ordinal for a month count in copy. */
export function ordinalEn(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

/* The guests line on a plan card, in the page language. */
export function guestsLabel(id: PlanId, locale: 'en' | 'es'): string {
  const plan = PLANS[id];
  const noun = locale === 'es' ? 'invitados' : 'guests';
  if (plan.maxGuests === null) return `${plan.fromGuests}+ ${noun}`;
  return locale === 'es' ? `Hasta ${plan.maxGuests} ${noun}` : `Up to ${plan.maxGuests} ${noun}`;
}

/* The one source for every price and guest cap on guest-ly.com.
   The plan cards (copy.ts, EN and ES), the order wizard (config.ts) and the
   JSON-LD offers in index.html (src/seo/jsonld.ts, injected at build time)
   all read these values, so the page and what search and AI engines read
   cannot drift apart again. scripts/check-jsonld.mjs fails the build if
   they do. Prices must match the Stripe Payment Links in config.ts. */

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

/* The guests line on a plan card, in the page language. */
export function guestsLabel(id: PlanId, locale: 'en' | 'es'): string {
  const plan = PLANS[id];
  const noun = locale === 'es' ? 'invitados' : 'guests';
  if (plan.maxGuests === null) return `${plan.fromGuests}+ ${noun}`;
  return locale === 'es' ? `Hasta ${plan.maxGuests} ${noun}` : `Up to ${plan.maxGuests} ${noun}`;
}

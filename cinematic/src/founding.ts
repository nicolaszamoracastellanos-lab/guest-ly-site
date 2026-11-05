/* FOUNDING COUPLES OFFER (re-exported by config.ts).
   FOUNDING_ENDS is the last day of the offer; copy.ts founding.offer.ends
   says the same date in words, EN and ES. The offer card renders through the
   end of this day in every time zone and never after it, so an expired offer
   cannot show. A new date here and in founding.offer.ends brings it back;
   '' hides it. */
export const FOUNDING_ENDS: string = '2026-10-31';

/* True until midnight after FOUNDING_ENDS at UTC-12, the last time zone to
   finish the day (= noon UTC the next day). */
export function foundingOfferOpen(now: number, ends: string = FOUNDING_ENDS): boolean {
  if (!ends) return false;
  const close = Date.parse(`${ends}T12:00:00Z`) + 24 * 3600 * 1000;
  return Number.isFinite(close) && now < close;
}

import { getSlots, visitorZone } from './client';
import { readSlots } from './core';

/* The one read that decides whether the booking buttons show (lazy chunk,
   fetched at idle by ./state.ts). True only for an "open" answer to the slot
   list, the answer the dialog needs. The answer is not kept: the dialog reads
   its own, on intent or on the press. Closed, unavailable, 429, a network
   error, a slow answer (15 s) or anything unreadable is false. */
export async function bookingIsOpen(): Promise<boolean> {
  const raw = await getSlots(visitorZone());
  return !!raw && readSlots(raw.status, raw.body).kind === 'open';
}

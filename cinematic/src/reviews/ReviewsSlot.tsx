import { useEffect } from 'react';
import { startReviews, useReviews } from './state';

/* Where the Reviews section goes: just before the final call to action
   (Overlay). Empty until ./state.ts adds it; starts the one read. */
export function ReviewsSlot() {
  const r = useReviews();
  useEffect(startReviews, []);
  return r ? <r.Section data={r.data} /> : null;
}

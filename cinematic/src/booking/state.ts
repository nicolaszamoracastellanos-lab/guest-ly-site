import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

/* The booking buttons in the first load (only while BOOKING_ENABLED): when to
   read the API and when to add the buttons. The read itself is the lazy
   ./BookingGate chunk. The same rules as the guides (../guides/state.ts):

   - Read once per page view, after hydration and at idle; never while the
     build prerenders the page. Nothing about booking is prerendered: no
     button, no line, no wrapper. The prerendered page is the booking-off page.
   - Only an "open" answer adds the buttons (FAQ, final call to action,
     pricing line; the order form and the menu show theirs when they open).
     Closed, unavailable, limited (429), a network error, a slow answer
     (15 s) or anything unreadable: nothing is added and nothing is left
     behind, so the page stays the booking-off page.
   - Nothing is reserved. The buttons go in together, only when that moves
     nothing the visitor sees: every place is below the screen, or above it
     once scrolling has stopped (the page then scrolls by exactly what was
     added above the screen, in the same frame). While a place is on screen,
     or the menu or the order form is open, they wait. */

let shown = false;
let ready = false;
let started = false;
const subs = /* @__PURE__ */ new Set<() => void>();

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

/* Where the page buttons go. below: the change cannot reach the screen;
   above: it can only push what is on screen down. The pricing line goes after
   the coordinator strip, the FAQ button ends the "write to us" card, the final
   button joins the final actions (which re-centres them). */
const SPOTS: { sec: string; at: string; below: (r: DOMRect) => boolean; above: (r: DOMRect) => boolean }[] = [
  { sec: '#pricing', at: '#pricing .coord-strip', below: (r) => r.bottom >= innerHeight, above: (r) => r.bottom <= 0 },
  { sec: '#faq', at: '#faq .faq-human', below: (r) => r.bottom >= innerHeight, above: (r) => r.bottom <= 0 },
  { sec: '[data-sec="final"]', at: '.final-cta__actions', below: (r) => r.top >= innerHeight, above: (r) => r.bottom <= 0 },
];

/* Adds the buttons now if that moves nothing on screen; false to wait. */
function place(scrolling: boolean): boolean {
  const html = document.documentElement;
  if (!ready || html.classList.contains('menu-locked') || html.classList.contains('wizard-locked')) return false;
  let lastAbove: Element | null = null;
  for (const s of SPOTS) {
    const sec = document.querySelector(s.sec);
    const at = document.querySelector(s.at);
    if (!sec || !at) continue;
    const r = at.getBoundingClientRect();
    if (s.below(r)) continue;
    if (!s.above(r) || scrolling) return false;
    lastAbove = sec;
  }
  /* What follows the last place above the screen moves by exactly what the
     places above the screen add. */
  const marker = lastAbove ? lastAbove.nextElementSibling ?? lastAbove.parentElement?.nextElementSibling ?? null : null;
  const before = marker ? marker.getBoundingClientRect().top : 0;
  ready = false;
  html.style.overflowAnchor = 'none';
  flushSync(() => {
    shown = true;
    subs.forEach((f) => f());
  });
  if (marker) window.scrollBy(0, marker.getBoundingClientRect().top - before);
  requestAnimationFrame(() => requestAnimationFrame(() => html.style.removeProperty('overflow-anchor')));
  return true;
}

function watch() {
  let timer = 0;
  const done = () => {
    removeEventListener('scroll', onScroll);
    clearInterval(tick);
    clearTimeout(timer);
  };
  const onScroll = () => {
    clearTimeout(timer);
    if (place(true)) return done();
    timer = window.setTimeout(() => place(false) && done(), 150);
  };
  /* For a menu or form that closes without a scroll. */
  const tick = window.setInterval(() => place(false) && done(), 1000);
  addEventListener('scroll', onScroll, { passive: true });
  if (place(false)) done();
}

export function startBooking() {
  const w = window as unknown as { __glPrerender?: boolean };
  if (started || w.__glPrerender) return;
  started = true;
  const go = () =>
    import('./BookingGate')
      .then(async (m) => {
        if (!(await m.bookingIsOpen())) return;
        ready = true;
        watch();
      })
      .catch(() => {});
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 3000 });
  else setTimeout(go, 1200);
}

/* With the switch off the build keeps none of this (the literal is false). */
export const useBookingShown: () => boolean = import.meta.env.VITE_BOOKING_ENABLED
  ? () => useSyncExternalStore(subscribe, () => shown, () => false)
  : () => false;

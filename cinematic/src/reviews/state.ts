import { useSyncExternalStore } from 'react';
import type { ComponentType } from 'react';
import { flushSync } from 'react-dom';
import type { Reviews } from './core';

/* The Reviews tab in the first load (only while REVIEWS_ENABLED): when to
   read, and when to add the section and its nav item. Everything else (the
   read itself, the section, its words and CSS) is the lazy ReviewsTab
   chunk.

   - Read once per page view, after hydration and at idle; never while the
     build prerenders the page (the snapshot must hold no review).
   - Nothing is reserved. The section and the nav item appear together, only
     for an answer worth showing, and only when adding the section moves
     nothing the visitor sees: its place (just before the final call to
     action) is below the screen, or above it once scrolling has stopped, and
     then the page scrolls by exactly the section's height in the same frame.
     While its place is on screen, or the menu or the order form is open, it
     waits.
   - Asked for by the address (/#reviews opened, shared or reloaded, or a
     later change of the hash to it): it goes in as soon as the answer is
     ready, wherever its place is, and the page scrolls to it. A wheel, touch
     or key first means the visitor moved on: the rules above apply.
   - Zero reviews or any failure: nothing is added, ever, for this view.
   - The nav item is in the phone menu only; the desktop row never changes. */

type Shown = { Section: ComponentType<{ data: Reviews }>; data: Reviews };

let shown: Shown | null = null;
let ready: Shown | null = null;
let started = false;
/* The address asks for the section (see above). */
let asked = false;
const subs = /* @__PURE__ */ new Set<() => void>();

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

/* Adds the section now if that moves nothing on screen; false to wait. */
function place(scrolling: boolean): boolean {
  const html = document.documentElement;
  const at = document.querySelector('[data-sec="final"]');
  if (!ready || !at || html.classList.contains('menu-locked') || html.classList.contains('wizard-locked')) return false;
  const next = ready;
  if (asked) {
    ready = null;
    flushSync(() => {
      shown = next;
      subs.forEach((f) => f());
    });
    /* Asked for, so this scroll is the visitor's, not a shift. */
    document.getElementById('reviews')?.scrollIntoView({ block: 'start' });
    return true;
  }
  const top = at.getBoundingClientRect().top;
  const below = top >= innerHeight;
  if (!below && (top > 0 || scrolling)) return false;
  ready = null;
  /* The browser's own scroll anchoring stays out of it for a moment, so the
     one correction below is the only one. */
  html.style.overflowAnchor = 'none';
  flushSync(() => {
    shown = next;
    subs.forEach((f) => f());
  });
  if (!below) window.scrollBy(0, at.getBoundingClientRect().top - top);
  requestAnimationFrame(() => requestAnimationFrame(() => html.style.removeProperty('overflow-anchor')));
  return true;
}

function watch() {
  let timer = 0;
  const done = () => {
    removeEventListener('scroll', onScroll);
    removeEventListener('hashchange', onHash);
    clearInterval(tick);
    clearTimeout(timer);
  };
  const onHash = () => {
    asked = location.hash === '#reviews';
    if (asked && place(false)) done();
  };
  /* Scrolling: below the screen it can go in at once; above, only once the
     page has been still for 150 ms (never during a fling). */
  const onScroll = () => {
    clearTimeout(timer);
    if (place(true)) return done();
    timer = window.setTimeout(() => place(false) && done(), 150);
  };
  /* For a menu or form that closes without a scroll. */
  const tick = window.setInterval(() => place(false) && done(), 1000);
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('hashchange', onHash);
  if (place(false)) done();
}

/* From page start until the answer: does the address still ask for the
   section? A change to #reviews says yes; another hash, or the visitor's
   own wheel, touch or key, says no. */
function listenAsked() {
  asked = location.hash === '#reviews';
  const moved = () => {
    asked = false;
    stop();
  };
  const stop = () => {
    for (const t of ['wheel', 'touchstart', 'keydown']) removeEventListener(t, moved, true);
  };
  for (const t of ['wheel', 'touchstart', 'keydown']) addEventListener(t, moved, { capture: true, passive: true });
  addEventListener('hashchange', () => {
    asked = location.hash === '#reviews';
  });
  return stop;
}

export function startReviews() {
  const w = window as unknown as { __glPrerender?: boolean };
  if (started || w.__glPrerender) return;
  started = true;
  const stopAsked = listenAsked();
  const go = () =>
    import('./ReviewsTab')
      .then(async (m) => {
        const data = await m.loadReviews();
        if (!data) return stopAsked();
        ready = { Section: m.ReviewsSection, data };
        watch();
      })
      .catch(stopAsked);
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 3000 });
  else setTimeout(go, 1200);
}

/* With the switch off the build keeps none of this (the literal is false). */
export const useReviewsShown: () => boolean = import.meta.env.VITE_REVIEWS_ENABLED
  ? () => useSyncExternalStore(subscribe, () => shown !== null, () => false)
  : () => false;

/* The section, once state says so (./ReviewsSlot.tsx). */
export const useReviews = () => useSyncExternalStore(subscribe, () => shown, () => null);

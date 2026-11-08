import { useSyncExternalStore } from 'react';
import type { ComponentType } from 'react';
import { flushSync } from 'react-dom';
import { guideParam } from './link';
import type { Open } from './GuidesForm';

/* The destination guides in the first load (only while GUIDES_ENABLED): when
   to read, and when to add the section. Everything else (the read itself,
   the section, its words and CSS) is the lazy GuidesTab chunk. The same
   rules as the Reviews tab (../reviews/state.ts):

   - Read once per page view, after hydration and at idle; never while the
     build prerenders the page. Nothing about the guides is prerendered: no
     header, no intro, no reserved box.
   - Nothing is reserved. The section appears only for an "open" answer with
     at least one guide, and only when adding it moves nothing the visitor
     sees: its place (just before the FAQ) is below the screen, or above it
     once scrolling has stopped, and then the page scrolls by exactly the
     section's height in the same frame. While its place is on screen, or the
     menu or the order form is open, it waits.
   - Closed, unavailable, limited (429), a network error or anything
     unreadable: nothing is added and nothing is left behind, no line either.
   - A ?guide=<code> or ?guide=all link (the expired guide link's "Request a
     new link"): the query is dropped from the address, and once the answer
     is ready the section goes in wherever its place is (moving nothing, as
     above) and two frames later the page scrolls to it; for a code the guide
     is picked and the email gets focus. A wheel, touch or key first means the
     visitor moved on: the rules above apply and nothing is focused. */

type Shown = { Section: ComponentType<{ data: Open; initial: string | null; onSettled: (after?: () => void) => void }>; data: Open; initial: string | null };

let shown: Shown | null = null;
let ready: Shown | null = null;
let started = false;
/* The address asked for the section (?guide=) and the visitor has not moved. */
let asked = false;
let want: string | null = null;
/* What the form wants done once the page has scrolled to the section. */
let afterScroll: (() => void) | undefined;
const subs = /* @__PURE__ */ new Set<() => void>();

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

/* The form is in the page (./GuidesSection.tsx gives it this). */
export function settled(after?: () => void) {
  afterScroll = after;
}

/* Adds the section now if that moves nothing on screen; false to wait. */
function place(scrolling: boolean): boolean {
  const html = document.documentElement;
  const at = document.getElementById('faq');
  if (!ready || !at || html.classList.contains('menu-locked') || html.classList.contains('wizard-locked')) return false;
  const next = ready;
  const top = at.getBoundingClientRect().top;
  const below = top >= innerHeight;
  if (!asked && !below && (top > 0 || scrolling)) return false;
  ready = null;
  html.style.overflowAnchor = 'none';
  flushSync(() => {
    shown = next;
    subs.forEach((f) => f());
  });
  if (!below) window.scrollBy(0, at.getBoundingClientRect().top - top);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (asked) {
        document.getElementById('guides')?.scrollIntoView({ block: 'start' });
        afterScroll?.();
      }
      afterScroll = undefined;
      html.style.removeProperty('overflow-anchor');
    }),
  );
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

/* From page start until the answer: does the address still ask for the
   section? The visitor's own wheel, touch or key says no. */
function listenAsked() {
  want = guideParam(location.search);
  if (!want) return () => {};
  const url = new URL(location.href);
  url.searchParams.delete('guide');
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  asked = true;
  const moved = () => {
    asked = false;
    stop();
  };
  const stop = () => {
    for (const t of ['wheel', 'touchstart', 'keydown']) removeEventListener(t, moved, true);
  };
  for (const t of ['wheel', 'touchstart', 'keydown']) addEventListener(t, moved, { capture: true, passive: true });
  return stop;
}

export function startGuides() {
  const w = window as unknown as { __glPrerender?: boolean };
  if (started || w.__glPrerender) return;
  started = true;
  const stopAsked = listenAsked();
  const go = () =>
    import('./GuidesTab')
      .then(async (m) => {
        const data = await m.loadCatalogue();
        if (data.kind !== 'open') return stopAsked();
        ready = { Section: m.GuidesSection, data, initial: want };
        watch();
      })
      .catch(stopAsked);
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 3000 });
  else setTimeout(go, 1200);
}

/* With the switch off the build keeps none of this (the literal is false). */
export const useGuidesShown: () => boolean = import.meta.env.VITE_GUIDES_ENABLED
  ? () => useSyncExternalStore(subscribe, () => shown !== null, () => false)
  : () => false;

/* The section, once state says so (./GuidesSlot.tsx). */
export const useGuides = () => useSyncExternalStore(subscribe, () => shown, () => null);

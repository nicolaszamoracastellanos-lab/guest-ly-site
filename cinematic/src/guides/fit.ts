import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/* #50: how tall the guides slot can be, and how far the page may scroll with
   it, without anything the visitor already sees moving (STUDY-quality-bar
   5.5 and 10.4: CLS under 0.02, the box fits what it holds).

   The slot holds one thing at a time: the skeleton, the form, or the "not
   available" line. Its height changes when that thing changes (the catalogue
   answered with more or fewer guides than the reserve was sized for, or not
   at all) or when the visitor scrolls a held part out of view. Three kinds of
   content can move: what is above the slot (the section header and the page
   above it), what the slot holds, and what is below it (the FAQ). Each may
   move only while it is out of the viewport before and after:
   - above, and the slot's own top: only when the page scrolls with it (c),
     and only while the slot's top is above the viewport;
   - the slot's content: freely when it is new (nothing was there to move),
     otherwise only while it is above the viewport too;
   - below: either it stays put (h - c equals the old height), or it is below
     the viewport before and after.
   The smallest height that keeps all three is the answer; whatever is left
   over is blank only while it is on screen, and goes as it leaves.

   top: the slot's top as the visitor last saw it (viewport px). prevH: the
   slot's height then. want: what the content needs. vh: viewport height.
   fresh: the content is new since then. move: the page may scroll now (not
   in the middle of a fling, which a scroll would stop on iOS).
   Returns h, the slot's new height, and c, how far to scroll down (negative
   is up). */

export type Fit = { h: number; c: number };

export function fitSlot(o: { top: number; prevH: number; want: number; vh: number; fresh: boolean; move: boolean }): Fit {
  const { top, prevH, want, vh, fresh, move } = o;
  const options: Fit[] = [];
  const belowHidden = top + prevH >= vh;
  /* Nothing moves at all: keep the height. */
  if (prevH >= want) options.push({ h: prevH, c: 0 });
  /* What is below the slot stays below the viewport. */
  if (belowHidden) options.push({ h: Math.max(want, vh - top), c: 0 });
  /* Scroll with the change while everything above it is out of view. */
  const canScroll = move && top <= 0 && (fresh || top + want <= 0);
  if (canScroll) {
    const least = fresh ? top : top + want;
    const c = Math.max(least, want - prevH);
    options.push({ h: prevH + c, c });
    if (belowHidden) options.push({ h: Math.max(want, vh - top + least), c: least });
  }
  /* Content that grew in view with no room: it has to push (a real shift,
     only when the reserve was too small and the slot is on screen). */
  if (options.length === 0) return { h: want, c: 0 };
  return options.reduce((best, x) => (x.h < best.h - 0.5 ? x : best));
}

/* The box follows what it holds, for as long as the form is mounted.
   Returns fit-now, for the moment the catalogue's answer is in the page.
   lastY is the scroll the visitor last saw (scroll events come before
   ResizeObserver in a frame), so a browser that already anchored the scroll
   is not corrected twice. */
export function useFitBox(slot: RefObject<HTMLDivElement | null>, box: RefObject<HTMLDivElement | null>): () => void {
  const fitNow = useRef<() => void>(() => {});
  useEffect(() => {
    const s = slot.current;
    const b = box.current;
    if (!s || !b || typeof ResizeObserver === 'undefined') return;
    let shown: Element | null = null;
    let lastH = s.getBoundingClientRect().height;
    let lastY = window.scrollY;
    let held = false;
    let idle = 0;
    let input = -1e9;
    const fit = (move: boolean) => {
      const now = b.firstElementChild;
      if (!now) return;
      const fresh = now !== shown;
      shown = now;
      /* Right after a click or a key in the same content (an error line,
         the form coming back), the page follows it like any form: the
         visitor caused it, and Chrome does not count shifts within 500 ms
         of an input. Not pointerdown: a finger that starts a scroll sends
         one too. */
      if (!fresh && performance.now() - input < 300) {
        s.style.minHeight = '0px';
        lastH = s.getBoundingClientRect().height;
        lastY = window.scrollY;
        held = false;
        return;
      }
      /* The skeleton sits in the reserve; the reserve stays until the answer. */
      if (now.hasAttribute('data-placeholder')) {
        lastH = s.getBoundingClientRect().height;
        return;
      }
      const top = s.getBoundingClientRect().top + (window.scrollY - lastY);
      const want = b.getBoundingClientRect().height;
      const { h, c } = fitSlot({ top, prevH: lastH, want, vh: window.innerHeight, fresh, move });
      s.style.minHeight = `${h}px`;
      if (Math.abs(window.scrollY - (lastY + c)) > 0.5) window.scrollTo({ top: lastY + c, behavior: 'instant' });
      lastY = window.scrollY;
      lastH = s.getBoundingClientRect().height;
      held = h - want > 0.5;
    };
    fitNow.current = () => fit(true);
    const ro = new ResizeObserver(() => fit(true));
    ro.observe(b);
    /* While part of the box is held: a part that left the bottom of the
       viewport goes at once; a part above it goes when the scroll stops. */
    const onScroll = () => {
      lastY = window.scrollY;
      if (!held) return;
      fit(false);
      window.clearTimeout(idle);
      idle = window.setTimeout(() => held && fit(true), 150);
    };
    const onInput = () => {
      input = performance.now();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('click', onInput, { passive: true, capture: true });
    window.addEventListener('keydown', onInput, { passive: true, capture: true });
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('click', onInput, { capture: true });
      window.removeEventListener('keydown', onInput, { capture: true });
      window.clearTimeout(idle);
      fitNow.current = () => {};
    };
  }, [slot, box]);
  return useCallback(() => fitNow.current(), []);
}


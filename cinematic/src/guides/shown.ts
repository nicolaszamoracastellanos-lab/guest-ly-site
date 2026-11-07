import { useSyncExternalStore } from 'react';

/* #50: whether the guides section is on the page. It is while GUIDES_ENABLED
   until the catalogue answers "not open" while the section is still below
   the viewport; then it goes away and the FAQ takes back its own number. */

let shown = true;
const subs = new Set<() => void>();

export function guidesRemoved(): void {
  if (!shown) return;
  shown = false;
  subs.forEach((f) => f());
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

/* With the switch off the build keeps none of this (the literal is false). */
export const useGuidesShown: () => boolean = import.meta.env.VITE_GUIDES_ENABLED
  ? () => useSyncExternalStore(subscribe, () => shown, () => true)
  : () => false;

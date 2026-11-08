import { useEffect } from 'react';
import { settled, startGuides, useGuides } from './state';

/* Where the guides section goes: just before the FAQ (Overlay). Empty until
   ./state.ts adds it; starts the one read. */
export function GuidesSlot() {
  const g = useGuides();
  useEffect(startGuides, []);
  return g ? <g.Section data={g.data} initial={g.initial} onSettled={settled} /> : null;
}

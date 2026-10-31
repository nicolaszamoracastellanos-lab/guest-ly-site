// Edit mode on the app's customizable Home (Oct 31 2026): move, resize, hide
// and add cards on the list as shown. Pure; scripts/tests/home-edit.test.ts.
// The shared core (homeLayout.ts) stays a verbatim copy of the portal's, so
// these app-only helpers live here. Saving applies the core's
// markPhaseHandled: once the couple arranges Home during a phase, their
// arrangement wins over the phase's automatic order.

import type { CardId, HomeCard } from "./homeLayout";

/** Swaps a visible card with its visible neighbour (hidden cards keep their places). */
export function moveCard(cards: HomeCard[], id: CardId, dir: -1 | 1): HomeCard[] {
  const vis = cards.filter((c) => !c.hidden);
  const i = vis.findIndex((c) => c.id === id);
  const other = i >= 0 ? vis[i + dir] : undefined;
  if (!other) return cards;
  const out = [...cards];
  const a = out.findIndex((c) => c.id === id);
  const b = out.findIndex((c) => c.id === other.id);
  [out[a], out[b]] = [out[b], out[a]];
  return out;
}

export function setCard(cards: HomeCard[], id: CardId, patch: Partial<Pick<HomeCard, "size" | "hidden">>): HomeCard[] {
  return cards.map((c) => (c.id === id ? { ...c, ...patch } : c));
}

/** Shows a hidden card again, right after the last visible one. */
export function showCard(cards: HomeCard[], id: CardId): HomeCard[] {
  const i = cards.findIndex((c) => c.id === id);
  if (i < 0) return cards;
  const item = { ...cards[i], hidden: false };
  const rest = cards.filter((c) => c.id !== id);
  let last = -1;
  rest.forEach((c, k) => {
    if (!c.hidden) last = k;
  });
  return [...rest.slice(0, last + 1), item, ...rest.slice(last + 1)];
}

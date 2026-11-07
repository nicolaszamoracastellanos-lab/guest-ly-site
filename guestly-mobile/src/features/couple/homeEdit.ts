// Edit mode on the app's customizable Home (Oct 31 2026): move, resize, hide
// and add cards on the list as shown. Pure; scripts/tests/home-edit.test.ts.
// The shared core (homeLayout.ts) stays a verbatim copy of the portal's, so
// these app-only helpers live here. Saving applies the core's
// markPhaseHandled: once the couple arranges Home during a phase, their
// arrangement wins over the phase's automatic order.

import type { CardId, HomeCard } from "./homeLayout";

/**
 * The cards Home leaves out because it has nothing to draw for them (the web's
 * `absent`, dashboard/page.tsx and home-board.tsx). #20 review: absent without
 * cards.review (flag off, before the wedding, sent, "Not now") in view AND edit
 * mode, so Edit Home never shows a feedback card the server said not to show.
 * Its layout entry stays in the list, so a save posts it unchanged. #6 road:
 * absent in view mode only (kept in edit mode on purpose, Oct 31).
 */
export function absentCards(o: { editing: boolean; road: boolean; review: boolean }): Set<CardId> {
  const out = new Set<CardId>();
  if (!o.review) out.add("review");
  if (!o.editing && !o.road) out.add("road");
  return out;
}

/** The cards drawn: not hidden and not absent. */
export function shownCards(cards: readonly HomeCard[], absent: ReadonlySet<CardId>): HomeCard[] {
  return cards.filter((c) => !c.hidden && !absent.has(c.id));
}

/** Swaps a shown card with its shown neighbour (hidden and absent cards keep their places). */
export function moveCard(cards: HomeCard[], id: CardId, dir: -1 | 1, absent: ReadonlySet<CardId> = new Set()): HomeCard[] {
  const vis = shownCards(cards, absent);
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

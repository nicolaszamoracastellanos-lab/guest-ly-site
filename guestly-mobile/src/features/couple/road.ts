// #6 Road to the wedding, the app's side (Master Wave, 1.4.0). The portal
// derives the line (src/lib/milestones.ts, copied verbatim here as
// ./milestones.ts) and words it (src/lib/milestones-view.ts) in the request's
// language; GET /couple/home sends it as `cards.road` (RoadVM) only to app
// 1.4.0 and up with MW_ROAD on, and GET /planner/portfolio adds `stage` to
// each wedding with the flag on. This file reads both tolerantly and maps the
// web paths the line links to onto app screens.
//
// K8, app half: the Home layout core (./homeLayout.ts, verbatim) places an
// introduced card ("road") once, visible, in any list that never mentioned
// it. A surface that is not shown that card (flag off, an older portal) must
// neither draw it nor post it, so the server keeps the stored entry
// (mergeCards). keepServed and onlyServed do that.
//
// Pure: no React, no network. scripts/tests/road.test.ts runs it.

import { CARD_IDS, INTRODUCED, type CardId, type HomeCard } from "./homeLayout";
import { MILESTONE_IDS, type MilestoneId, type MilestoneState } from "./milestones";

export type RoadItem = {
  id: MilestoneId;
  state: MilestoneState;
  overdue: boolean;
  label: string;
  sub: string | null;
  /** The web path behind the milestone; null when this reader may not open it. */
  href: string | null;
  marked: boolean;
};

export type RoadCard = {
  items: RoadItem[];
  nowId: MilestoneId | null;
  nextId: MilestoneId | null;
  done: number;
  total: number;
  doneText: string;
  nextStep: { text: string; href: string | null; linkLabel: string } | null;
};

/** The planner portfolio's per-wedding `stage` (MW_ROAD on for that wedding). */
export type WeddingStage = { nowId: MilestoneId | null; label: string; done: number; total: number };

const STATES: readonly MilestoneState[] = ["done", "now", "upcoming"];

function isMilestoneId(v: unknown): v is MilestoneId {
  return typeof v === "string" && (MILESTONE_IDS as readonly string[]).includes(v);
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}
function count(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
}

/**
 * cards.road as the app can draw it, or null (no key, null, or nothing
 * usable). Unknown milestone ids and rows without a label are dropped; Now
 * and Next must name a row that is there.
 */
export function readRoad(raw: unknown): RoadCard | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.items)) return null;
  const items: RoadItem[] = [];
  for (const it of r.items) {
    if (!it || typeof it !== "object") continue;
    const i = it as Record<string, unknown>;
    const label = str(i.label);
    if (!isMilestoneId(i.id) || !label || items.some((x) => x.id === i.id)) continue;
    items.push({
      id: i.id,
      state: STATES.includes(i.state as MilestoneState) ? (i.state as MilestoneState) : "upcoming",
      overdue: i.overdue === true,
      label,
      sub: str(i.sub),
      href: str(i.href),
      marked: i.marked === true,
    });
  }
  if (!items.length) return null;
  const has = (id: unknown): id is MilestoneId => isMilestoneId(id) && items.some((x) => x.id === id);
  const done = count(r.done) ?? items.filter((x) => x.state === "done").length;
  const total = count(r.total) ?? items.length;
  const ns = r.nextStep && typeof r.nextStep === "object" ? (r.nextStep as Record<string, unknown>) : null;
  const nextText = ns ? str(ns.text) : null;
  return {
    items,
    nowId: has(r.nowId) ? r.nowId : null,
    nextId: has(r.nextId) ? r.nextId : null,
    done,
    total,
    doneText: str(r.doneText) ?? `${done} / ${total}`,
    nextStep: ns && nextText ? { text: nextText, href: str(ns.href), linkLabel: str(ns.linkLabel) ?? "" } : null,
  };
}

/** GET /planner/portfolio `stage` of one wedding, or null (flag off: no key). */
export function readStage(raw: unknown): WeddingStage | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const label = str(r.label);
  const done = count(r.done);
  const total = count(r.total);
  if (!label || done === null || total === null || total === 0) return null;
  return { nowId: isMilestoneId(r.now_id) ? r.now_id : null, label, done: Math.min(done, total), total };
}

/** The web tabs the line links to (milestones.ts TAB, plus the Brain) and the couple screen of each. */
export const ROAD_ROUTES: Readonly<Record<string, string>> = {
  "/vendors": "/couple/vendors",
  "/broadcasts": "/couple/broadcasts",
  "/guests": "/couple/guests",
  "/runsheet": "/couple/runsheet",
  "/brain": "/couple/brain",
};

/** The app screen for a web path of the line; null for a path the app has no screen for, or none. */
export function roadRoute(href: string | null | undefined): string | null {
  if (typeof href !== "string") return null;
  const path = href.split(/[?#]/)[0].replace(/\/+$/, "");
  return Object.prototype.hasOwnProperty.call(ROAD_ROUTES, path) ? ROAD_ROUTES[path] : null;
}

/** Where tapping the card goes: the Now step's screen, else the runsheet (every step done). */
export function roadCardRoute(road: RoadCard | null): string {
  const now = road?.nowId ? road.items.find((i) => i.id === road.nowId) : null;
  return roadRoute(road?.nextStep?.href ?? now?.href ?? null) ?? "/couple/runsheet";
}

/** The rows a card of this size shows: every row (L), Now and Next (M), Now alone (S). */
export function roadRows(road: RoadCard, size: "s" | "m" | "l"): RoadItem[] {
  if (size === "l") return road.items;
  const pick = size === "m" ? [road.nowId, road.nextId] : [road.nowId];
  return road.items.filter((i) => pick.includes(i.id));
}

// ---------------------------------------------------------------- K8

function isIntroduced(id: CardId): boolean {
  return Object.prototype.hasOwnProperty.call(INTRODUCED, id);
}

/** The card ids a layout payload actually listed (valid ids only); empty for anything else. */
export function listedIds(rawCards: unknown): Set<CardId> {
  const out = new Set<CardId>();
  if (!Array.isArray(rawCards)) return out;
  for (const c of rawCards) {
    const id = c && typeof c === "object" ? (c as Record<string, unknown>).id : null;
    if (typeof id === "string" && (CARD_IDS as readonly string[]).includes(id)) out.add(id as CardId);
  }
  return out;
}

/**
 * The cards the server served. The core introduces a card the list never
 * mentioned (K8); when the server left it out on purpose (flag off for this
 * wedding, a build it is not sent to, an older portal) the app drops it, so
 * it is neither drawn nor posted back.
 */
export function keepServed(cards: readonly HomeCard[], rawCards: unknown): HomeCard[] {
  const listed = listedIds(rawCards);
  return cards.filter((c) => !NOT_DRAWN.has(c.id) && (!isIntroduced(c.id) || listed.has(c.id)));
}

/**
 * Introduced cards this build has no body for yet: read as never served, so
 * they are neither drawn nor posted back and the server keeps what it stored
 * for them (mergeCards, mergeDismissed), exactly as a 1.3 build would.
 * "review" (#20, MW_REVIEW_ASK): the core lists it since the portal's #20
 * change; the app's card (feedback link in expo-web-browser, Not now) is not
 * built in this step.
 */
export const NOT_DRAWN: ReadonlySet<CardId> = new Set<CardId>(["review"]);

/**
 * The card list to PUT: introduced ids the server did not serve are left
 * out, so the server keeps whatever it stored for them (mergeCards) instead
 * of taking this phone's guess. `served` null (no layout read yet): every
 * introduced id is left out.
 */
export function onlyServed(cards: readonly HomeCard[], served: ReadonlySet<CardId> | readonly CardId[] | null): HomeCard[] {
  const set = served ? new Set<CardId>(served as Iterable<CardId>) : new Set<CardId>();
  return cards.filter((c) => !NOT_DRAWN.has(c.id) && (!isIntroduced(c.id) || set.has(c.id)));
}

/**
 * The `dismissed` keys to PUT: `<phase>:<id>` keys of cards this build did
 * not serve (NOT_DRAWN, or introduced and not served) are left out, like the
 * cards in onlyServed. markPhaseHandled marks every card of the phase, the
 * review card (#20) included; posting "after:review" from a build that never
 * showed that card would stop the web lifting it. The server keeps any stored
 * key for a card the post leaves out (mergeDismissed), as with a 1.3 build.
 */
export function onlyServedKeys(keys: readonly string[], served: ReadonlySet<CardId> | readonly CardId[] | null): string[] {
  const set = served ? new Set<CardId>(served as Iterable<CardId>) : new Set<CardId>();
  return keys.filter((k) => {
    const id = k.split(":")[1] as CardId;
    return !NOT_DRAWN.has(id) && (!isIntroduced(id) || set.has(id));
  });
}

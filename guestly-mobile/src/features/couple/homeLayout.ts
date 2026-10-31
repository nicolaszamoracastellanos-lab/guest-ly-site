// The customizable Home (Oct 31 2026): the shared pure core. The SAME file
// lives in the portal as src/lib/home-layout-core.ts; keep the two identical
// (the portal stores the layout, both surfaces render it). No imports.
//
// One layout per wedding: the quiz answers, the cards in display order (each
// S, M or L, shown or hidden) and the phase cards the couple dismissed. As the
// date nears (answers.adapt), the cards that matter in that phase move to the
// top on their own.

export const CARD_IDS = [
  "countdown",
  "briefing",
  "setup",
  "rsvp",
  "replies",
  "questions",
  "tasks",
  "budget",
  "vendors",
  "seating",
  "website",
  "runsheet",
  "checkin",
  "album",
  "thankyou",
  "partner",
  "planner",
  "activity",
] as const;
export type CardId = (typeof CARD_IDS)[number];
export type CardSize = "s" | "m" | "l";
export type HomeCard = { id: CardId; size: CardSize; hidden: boolean };
export const FOCUS_IDS = ["rsvp", "budget", "questions", "tasks", "vendors", "seating", "website"] as const;
export type Focus = (typeof FOCUS_IDS)[number];
export type HomeAnswers = {
  focus: Focus[];
  detail: "glance" | "balanced" | "full";
  when: "daily" | "weekly" | "needed";
  team: "solo" | "partner" | "planner";
  adapt: boolean;
};
export type Phase = "planning" | "final" | "week" | "after";

export const DEFAULT_SIZES: Record<CardId, CardSize> = {
  countdown: "s",
  briefing: "m",
  setup: "s",
  rsvp: "m",
  replies: "m",
  questions: "m",
  tasks: "m",
  budget: "m",
  vendors: "m",
  seating: "s",
  website: "s",
  runsheet: "l",
  checkin: "s",
  album: "m",
  thankyou: "s",
  partner: "s",
  planner: "s",
  activity: "m",
};

export const FOCUS_CARDS: Record<Focus, CardId[]> = {
  rsvp: ["rsvp", "replies"],
  budget: ["budget"],
  questions: ["questions"],
  tasks: ["tasks"],
  vendors: ["vendors"],
  seating: ["seating"],
  website: ["website", "setup"],
};

export const PHASE_CARDS: Record<Exclude<Phase, "planning">, CardId[]> = {
  final: ["rsvp", "seating", "vendors", "budget"],
  week: ["runsheet", "checkin", "questions"],
  after: ["album", "thankyou", "budget"],
};

/** The Skip path: the standard Home. */
export const STANDARD_ANSWERS: HomeAnswers = { focus: ["rsvp", "tasks", "budget"], detail: "balanced", when: "weekly", team: "solo", adapt: true };

/** Cards that stay small when the couple asks for full detail (a number reads best small). */
const STAY_SMALL: ReadonlySet<CardId> = new Set<CardId>(["seating", "setup", "website", "checkin", "thankyou", "partner", "planner"]);

/** Days to the wedding (negative after it) to its phase. */
export function phaseFor(daysToWedding: number | null): Phase {
  if (daysToWedding === null || !Number.isFinite(daysToWedding) || daysToWedding > 30) return "planning";
  if (daysToWedding >= 8) return "final";
  if (daysToWedding >= 0) return "week";
  return "after";
}

/** The layout the answers suggest (phase "planning"). Every card appears once; the unused ones hidden. */
export function suggestedCards(a: HomeAnswers): HomeCard[] {
  const out: HomeCard[] = [];
  const seen = new Set<CardId>();
  const add = (id: CardId, size?: CardSize) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, size: size ?? DEFAULT_SIZES[id], hidden: false });
  };
  add("countdown", "s");
  if (a.when === "needed") add("briefing", "l");
  else if (a.when === "daily") add("briefing", "m");
  a.focus.forEach((f, i) => FOCUS_CARDS[f].forEach((id, j) => add(id, a.detail === "full" && i === 0 && j === 0 ? "l" : undefined)));
  if (a.team === "partner") add("partner");
  else if (a.team === "planner") add("planner");
  if (a.when === "weekly") add("briefing", "m");
  if (a.when !== "needed" && a.detail !== "glance") add("activity");
  out.forEach((c, i) => {
    if (a.detail === "glance" && c.id !== "runsheet") c.size = "s";
    if (a.detail === "full" && c.size === "s" && i > 0 && !STAY_SMALL.has(c.id)) c.size = "m";
  });
  // "Only when something needs us": a short Home; the rest stays one tap away in Add a card.
  const shown = a.when === "needed" ? out.slice(0, 4) : out;
  for (const c of out.slice(shown.length)) c.hidden = true;
  const all = [...shown, ...out.slice(shown.length)];
  for (const id of CARD_IDS) if (!seen.has(id)) all.push({ id, size: DEFAULT_SIZES[id], hidden: true });
  return all;
}

/** The cards to show today: the stored layout, with the phase's cards moved to the top (after the countdown) when the couple asked Home to adapt. */
export function effectiveCards(cards: HomeCard[], a: HomeAnswers, phase: Phase, dismissed: string[]): HomeCard[] {
  const base = cards.map((c) => ({ ...c }));
  if (!a.adapt || phase === "planning") return base;
  const promote = PHASE_CARDS[phase].filter((id) => !dismissed.includes(`${phase}:${id}`));
  if (!promote.length) return base;
  const promoted = promote.map((id) => {
    const had = base.find((c) => c.id === id);
    return { id, size: had?.size ?? DEFAULT_SIZES[id], hidden: false } as HomeCard;
  });
  const rest = base.filter((c) => !promote.includes(c.id));
  const cd = rest.findIndex((c) => c.id === "countdown");
  const at = cd >= 0 && !rest[cd].hidden ? cd + 1 : 0;
  return [...rest.slice(0, at), ...promoted, ...rest.slice(at)];
}

/** Column spans for the visible cards: rows always end flush (the last card of a row widens to the edge); order never changes. */
export function rowSpans(visible: HomeCard[], cols: 12 | 2): number[] {
  const W: Record<CardSize, number> = cols === 2 ? { s: 1, m: 2, l: 2 } : { s: 4, m: 6, l: 12 };
  const spans: number[] = [];
  let cur = 0;
  visible.forEach((c, i) => {
    const w = W[c.size];
    if (cur + w > cols) {
      spans[i - 1] += cols - cur;
      cur = 0;
    }
    spans.push(w);
    cur += w;
  });
  if (spans.length && cur > 0 && cur < cols) spans[spans.length - 1] += cols - cur;
  return spans;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback);
const isCardId = (v: unknown): v is CardId => typeof v === "string" && (CARD_IDS as readonly string[]).includes(v);

export function sanitizeAnswers(raw: unknown): HomeAnswers | null {
  if (!isObj(raw)) return null;
  const focus: Focus[] = [];
  if (Array.isArray(raw.focus)) for (const f of raw.focus) if (typeof f === "string" && (FOCUS_IDS as readonly string[]).includes(f) && !focus.includes(f as Focus) && focus.length < 3) focus.push(f as Focus);
  return {
    focus: focus.length ? focus : [...STANDARD_ANSWERS.focus],
    detail: oneOf(raw.detail, ["glance", "balanced", "full"] as const, STANDARD_ANSWERS.detail),
    when: oneOf(raw.when, ["daily", "weekly", "needed"] as const, STANDARD_ANSWERS.when),
    team: oneOf(raw.team, ["solo", "partner", "planner"] as const, STANDARD_ANSWERS.team),
    adapt: typeof raw.adapt === "boolean" ? raw.adapt : STANDARD_ANSWERS.adapt,
  };
}

/** Validates a stored or sent layout: unknown ids dropped, duplicates dropped, missing ids appended hidden, sizes clamped. */
export function sanitizeLayout(raw: unknown): { answers: HomeAnswers; cards: HomeCard[]; dismissed: string[] } | null {
  if (!isObj(raw)) return null;
  const answers = sanitizeAnswers(raw.answers);
  if (!answers) return null;
  let cards: HomeCard[];
  if (Array.isArray(raw.cards)) {
    cards = [];
    const seen = new Set<CardId>();
    for (const c of raw.cards) {
      if (!isObj(c) || !isCardId(c.id) || seen.has(c.id)) continue;
      seen.add(c.id);
      cards.push({ id: c.id, size: oneOf(c.size, ["s", "m", "l"] as const, DEFAULT_SIZES[c.id]), hidden: c.hidden === true });
    }
    for (const id of CARD_IDS) if (!seen.has(id)) cards.push({ id, size: DEFAULT_SIZES[id], hidden: true });
  } else {
    cards = suggestedCards(answers);
  }
  const dismissed: string[] = [];
  if (Array.isArray(raw.dismissed))
    for (const d of raw.dismissed) {
      if (typeof d !== "string" || dismissed.includes(d)) continue;
      const [p, id] = d.split(":");
      if ((p === "final" || p === "week" || p === "after") && isCardId(id)) dismissed.push(d);
    }
  return { answers, cards, dismissed };
}

/** Edit-mode helpers, shared so the web and the app move cards the same way. */
export function moveCard(cards: HomeCard[], id: CardId, dir: -1 | 1): HomeCard[] {
  const vis = cards.filter((c) => !c.hidden);
  const i = vis.findIndex((c) => c.id === id);
  const other = vis[i + dir];
  if (i < 0 || !other) return cards;
  const out = [...cards];
  const a = out.findIndex((c) => c.id === id);
  const b = out.findIndex((c) => c.id === other.id);
  [out[a], out[b]] = [out[b], out[a]];
  return out;
}

export function setCard(cards: HomeCard[], id: CardId, patch: Partial<Pick<HomeCard, "size" | "hidden">>): HomeCard[] {
  return cards.map((c) => (c.id === id ? { ...c, ...patch } : c));
}

/** Shows a hidden card again, placed after the last visible one. */
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

/** Hiding a card the phase promoted remembers it for that phase, so it does not come back tomorrow. */
export function hideCard(cards: HomeCard[], dismissed: string[], id: CardId, phase: Phase, adapt: boolean): { cards: HomeCard[]; dismissed: string[] } {
  const promoted = adapt && phase !== "planning" && PHASE_CARDS[phase].includes(id);
  const key = `${phase}:${id}`;
  return { cards: setCard(cards, id, { hidden: true }), dismissed: promoted && !dismissed.includes(key) ? [...dismissed, key] : dismissed };
}

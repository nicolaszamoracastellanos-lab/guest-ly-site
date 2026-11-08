// The customizable Home's pure core (Oct 31 2026). One layout per wedding,
// shared by both partners and by two surfaces: the portal Dashboard and the
// app's couple Home. This file is copied VERBATIM into the app
// (guestly-mobile/src/features/couple/homeLayout.ts) with the same tests, so
// it imports nothing and touches no runtime API.
//
// The quiz answers build a suggested layout (suggestedCards); the couple can
// then move, resize, hide and add cards. When they chose "adapt", the cards
// that matter in the final month, the wedding week and after the wedding are
// moved to the top while that phase lasts (effectiveCards), until the couple
// arranges or hides them in that phase themselves (the `dismissed` list).
// Rows always end flush (rowSpans): the last card of a row widens to the edge.
//
// Cards added after the first release (INTRODUCED, Nov 2026: "road", #6; "review",
// #20, the feedback ask after the wedding, which the after phase also lifts) are
// shown once to layouts that have never mentioned them, right after the
// countdown, instead of being appended hidden; and a client that posts a card
// list without an id (an older app that does not know it) keeps the stored
// entry for that id (mergeCards), so it never hides a card for both partners.

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
  "road",
  "review",
] as const;
export type CardId = (typeof CARD_IDS)[number];
export type CardSize = "s" | "m" | "l";
export type HomeCard = { id: CardId; size: CardSize; hidden: boolean };

export const FOCUS_IDS = ["rsvp", "budget", "questions", "tasks", "vendors", "seating", "website"] as const;
export type Focus = (typeof FOCUS_IDS)[number];

export type HomeAnswers = {
  /** One to three, in the order picked. */
  focus: Focus[];
  detail: "glance" | "balanced" | "full";
  /** Also written to recap_prefs for the person answering. */
  when: "daily" | "weekly" | "needed";
  team: "solo" | "partner" | "planner";
  adapt: boolean;
};

export type Phase = "planning" | "final" | "week" | "after";
export const PHASES: readonly Phase[] = ["planning", "final", "week", "after"];

/** The Skip path: today's Home, give or take. */
export const STANDARD_ANSWERS: HomeAnswers = {
  focus: ["rsvp", "tasks", "budget"],
  detail: "balanced",
  when: "weekly",
  team: "solo",
  adapt: true,
};

/** Each card's natural size. */
export const DEFAULT_SIZE: Record<CardId, CardSize> = {
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
  road: "l",
  review: "m",
};

/**
 * Cards added after the first release, each with the card it goes after the
 * first time a layout meets it (top when that card is hidden or absent).
 */
export const INTRODUCED: Partial<Record<CardId, CardId>> = {
  road: "countdown",
  review: "countdown",
};

function isIntroduced(id: CardId): boolean {
  return Object.prototype.hasOwnProperty.call(INTRODUCED, id);
}

/** Places every introduced card the list does not hold yet, visible, after its anchor. */
function introduce(list: HomeCard[], size?: (id: CardId) => CardSize): HomeCard[] {
  // Last first: cards sharing an anchor end up in CARD_IDS order right after it.
  for (const id of [...CARD_IDS].reverse()) {
    if (!isIntroduced(id) || list.some((c) => c.id === id)) continue;
    const after = INTRODUCED[id];
    const anchor = list.findIndex((c) => c.id === after && !c.hidden);
    list.splice(anchor >= 0 ? anchor + 1 : 0, 0, { id, size: size ? size(id) : DEFAULT_SIZE[id], hidden: false });
  }
  return list;
}

export const FOCUS_CARDS: Record<Focus, CardId[]> = {
  rsvp: ["rsvp", "replies"],
  budget: ["budget"],
  questions: ["questions"],
  tasks: ["tasks"],
  vendors: ["vendors"],
  seating: ["seating"],
  website: ["website", "setup"],
};

/** Cards a phase brings to the top when the couple chose "adapt". */
export const PHASE_CARDS: Record<Phase, CardId[]> = {
  planning: [],
  final: ["rsvp", "seating", "vendors", "budget"],
  week: ["runsheet", "checkin", "questions"],
  after: ["review", "album", "thankyou", "budget"],
};

/** Cards that stay small even when the couple wants full detail. */
const ALWAYS_SMALL: ReadonlySet<CardId> = new Set<CardId>(["seating", "setup", "website", "checkin", "thankyou", "partner", "planner"]);

/** Days to the wedding (negative after it) to the phase of the plan. */
export function phaseFor(daysToWedding: number | null): Phase {
  if (daysToWedding === null || !Number.isFinite(daysToWedding)) return "planning";
  if (daysToWedding < 0) return "after";
  if (daysToWedding <= 7) return "week";
  if (daysToWedding <= 30) return "final";
  return "planning";
}

function isCardId(v: unknown): v is CardId {
  return typeof v === "string" && (CARD_IDS as readonly string[]).includes(v);
}

/** The layout the answers suggest (the planning phase); every card id once, unused ones hidden. */
export function suggestedCards(a: HomeAnswers): HomeCard[] {
  const out: HomeCard[] = [];
  const seen = new Set<CardId>();
  const add = (id: CardId, size?: CardSize) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, size: size ?? DEFAULT_SIZE[id], hidden: false });
  };
  add("countdown", "s");
  if (a.when === "needed") add("briefing", "l");
  else if (a.when === "daily") add("briefing", "m");
  a.focus.forEach((f, i) => {
    FOCUS_CARDS[f].forEach((id, j) => add(id, a.detail === "full" && i === 0 && j === 0 ? "l" : undefined));
  });
  if (a.team === "partner") add("partner");
  else if (a.team === "planner") add("planner");
  if (a.when === "weekly") add("briefing", "m");
  if (a.when !== "needed" && a.detail !== "glance") add("activity");
  out.forEach((c, i) => {
    if (a.detail === "glance" && c.id !== "runsheet") c.size = "s";
    if (a.detail === "full" && c.size === "s" && i > 0 && !ALWAYS_SMALL.has(c.id)) c.size = "m";
  });
  const shown = a.when === "needed" ? out.slice(0, 4) : out;
  const shownIds = new Set(shown.map((c) => c.id));
  for (const id of CARD_IDS) {
    if (!shownIds.has(id) && !isIntroduced(id)) shown.push({ id, size: DEFAULT_SIZE[id], hidden: true });
  }
  return introduce(shown, (id) => (a.detail === "glance" ? "s" : DEFAULT_SIZE[id]));
}

/**
 * What Home shows today. With "adapt" on and a phase past planning, that
 * phase's cards go to the top (after the countdown) and show, unless the
 * couple already arranged or hid them in this phase (`<phase>:<id>` in
 * `dismissed`). Without adapt, or in planning, the stored order as is.
 */
export function effectiveCards(cards: HomeCard[], a: HomeAnswers, phase: Phase, dismissed: string[]): HomeCard[] {
  const list = cards.map((c) => ({ ...c }));
  if (!a.adapt || phase === "planning") return list;
  const handled = new Set(dismissed);
  const promote = PHASE_CARDS[phase].filter((id) => !handled.has(`${phase}:${id}`));
  if (!promote.length) return list;
  const byId = new Map(list.map((c) => [c.id, c] as const));
  const lifted: HomeCard[] = promote.map((id) => {
    const c = byId.get(id) ?? { id, size: DEFAULT_SIZE[id], hidden: false };
    return { ...c, hidden: false };
  });
  const rest = list.filter((c) => !promote.includes(c.id));
  const at = rest.length && rest[0].id === "countdown" && !rest[0].hidden ? 1 : 0;
  return [...rest.slice(0, at), ...lifted, ...rest.slice(at)];
}

/**
 * After the couple edits Home during a phase, their arrangement wins: every
 * card that phase would promote is marked handled for that phase.
 */
export function markPhaseHandled(dismissed: string[], a: HomeAnswers, phase: Phase): string[] {
  if (!a.adapt || phase === "planning") return dismissed;
  const out = new Set(dismissed);
  for (const id of PHASE_CARDS[phase]) out.add(`${phase}:${id}`);
  return [...out];
}

/**
 * Column spans for the visible cards, in order: s 4, m 6, l 12 on the
 * 12-column grid; s 1, m and l 2 on the 2-column phone grid. When the next
 * card does not fit, the last card of the row widens to the edge, and so
 * does the last card overall. Order never changes.
 */
export function rowSpans(visible: HomeCard[], cols: 12 | 2): number[] {
  const w: Record<CardSize, number> = cols === 2 ? { s: 1, m: 2, l: 2 } : { s: 4, m: 6, l: 12 };
  const spans: number[] = [];
  let cur = 0;
  visible.forEach((c, i) => {
    const width = w[c.size];
    if (cur + width > cols && i > 0) {
      spans[i - 1] += cols - cur;
      cur = 0;
    }
    spans.push(width);
    cur += width;
  });
  if (spans.length && cur > 0 && cur < cols) spans[spans.length - 1] += cols - cur;
  return spans;
}

const DETAIL = ["glance", "balanced", "full"] as const;
const WHEN = ["daily", "weekly", "needed"] as const;
const TEAM = ["solo", "partner", "planner"] as const;

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Answers from untrusted JSON; null when there is nothing answer-shaped. */
export function sanitizeAnswers(raw: unknown): HomeAnswers | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const focus: Focus[] = [];
  if (Array.isArray(r.focus)) {
    for (const f of r.focus) {
      if (typeof f === "string" && (FOCUS_IDS as readonly string[]).includes(f) && !focus.includes(f as Focus)) focus.push(f as Focus);
      if (focus.length === 3) break;
    }
  }
  return {
    focus: focus.length ? focus : [...STANDARD_ANSWERS.focus],
    detail: pick(r.detail, DETAIL, STANDARD_ANSWERS.detail),
    when: pick(r.when, WHEN, STANDARD_ANSWERS.when),
    team: pick(r.team, TEAM, STANDARD_ANSWERS.team),
    adapt: typeof r.adapt === "boolean" ? r.adapt : STANDARD_ANSWERS.adapt,
  };
}

/** The valid entries of an untrusted card list, in order: unknown ids and repeats dropped, sizes clamped. */
function parseCards(raw: unknown): HomeCard[] {
  const out: HomeCard[] = [];
  const seen = new Set<CardId>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      if (!isCardId(r.id) || seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({ id: r.id, size: pick(r.size, ["s", "m", "l"] as const, DEFAULT_SIZE[r.id]), hidden: r.hidden === true });
    }
  }
  return out;
}

/**
 * Cards from untrusted JSON: unknown ids and repeats dropped, sizes clamped,
 * missing ids appended hidden; an introduced card the list never mentioned is
 * placed once, visible, after its anchor.
 */
export function sanitizeCards(raw: unknown): HomeCard[] {
  const out = parseCards(raw);
  const seen = new Set(out.map((c) => c.id));
  for (const id of CARD_IDS) if (!seen.has(id) && !isIntroduced(id)) out.push({ id, size: DEFAULT_SIZE[id], hidden: true });
  return introduce(out);
}

/**
 * A posted card list merged over the stored one. An id the client did not
 * send (an older app that does not know it, or a surface that does not show
 * it) keeps its stored entry, placed after the nearest card that came before
 * it in the stored list. With nothing stored, sanitizeCards' rules apply.
 */
export function mergeCards(raw: unknown, stored: readonly HomeCard[] | null): HomeCard[] {
  const out = parseCards(raw);
  if (stored) {
    stored.forEach((c, i) => {
      if (!isCardId(c.id) || out.some((x) => x.id === c.id)) return;
      let at = 0;
      for (let j = i - 1; j >= 0; j--) {
        const k = out.findIndex((x) => x.id === stored[j].id);
        if (k >= 0) {
          at = k + 1;
          break;
        }
      }
      out.splice(at, 0, { id: c.id, size: c.size, hidden: c.hidden });
    });
  }
  return sanitizeCards(out);
}

/** `<phase>:<id>` strings only, no repeats, at most one per phase card. */
export function sanitizeDismissed(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const [phase, id] = v.split(":");
    if ((PHASES as readonly string[]).includes(phase) && isCardId(id) && PHASE_CARDS[phase as Phase].includes(id)) out.add(`${phase}:${id}`);
  }
  return [...out];
}

/**
 * A posted `dismissed` list merged over the stored one (K8, like mergeCards).
 * A client whose posted cards leave out an introduced card (an older app that
 * does not know it, or a surface that hides it) cannot know that card's
 * `<phase>:<id>` keys either, so the stored ones stay: a 1.3 app saving Home
 * after the wedding never brings back a review card the couple put away.
 * A client that posts the card speaks for its keys.
 */
export function mergeDismissed(raw: unknown, postedCards: unknown, stored: readonly string[] | null): string[] {
  const out = new Set(sanitizeDismissed(raw));
  if (!stored) return [...out];
  const known = new Set(parseCards(postedCards).map((c) => c.id));
  for (const key of sanitizeDismissed(stored)) {
    const id = key.split(":")[1] as CardId;
    if (isIntroduced(id) && !known.has(id)) out.add(key);
  }
  return [...out];
}

/** A stored or posted layout, validated. Null when the answers are missing or not an object. */
export function sanitizeLayout(raw: unknown): { answers: HomeAnswers; cards: HomeCard[]; dismissed: string[] } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const answers = sanitizeAnswers(r.answers);
  if (!answers) return null;
  const cards = Array.isArray(r.cards) && r.cards.length ? sanitizeCards(r.cards) : suggestedCards(answers);
  return { answers, cards, dismissed: sanitizeDismissed(r.dismissed) };
}

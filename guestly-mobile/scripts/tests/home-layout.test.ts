// Run: node --experimental-strip-types scripts/tests/home-layout.test.ts
// The customizable Home's pure core (src/features/couple/homeLayout.ts), a
// verbatim copy of the portal's src/lib/home-layout-core.ts. These are the
// portal's cases (scripts/test-home-layout-core.mjs, K8 groups included)
// unchanged, so both copies answer to the same assertions.

import assert from "node:assert/strict";
import * as core from "../../src/features/couple/homeLayout.ts";

const { CARD_IDS, INTRODUCED, STANDARD_ANSWERS, phaseFor, suggestedCards, effectiveCards, markPhaseHandled, rowSpans, sanitizeLayout, sanitizeCards, mergeCards } = core;

let n = 0;
const t = (name, fn) => { fn(); n++; };
const ids = (cards) => cards.filter((c) => !c.hidden).map((c) => c.id);
const everyOnce = (cards) => {
  assert.equal(cards.length, CARD_IDS.length);
  assert.deepEqual([...cards.map((c) => c.id)].sort(), [...CARD_IDS].sort());
};

t("phaseFor", () => {
  assert.equal(phaseFor(null), "planning");
  assert.equal(phaseFor(90), "planning");
  assert.equal(phaseFor(31), "planning");
  assert.equal(phaseFor(30), "final");
  assert.equal(phaseFor(8), "final");
  assert.equal(phaseFor(7), "week");
  assert.equal(phaseFor(0), "week");
  assert.equal(phaseFor(-1), "after");
  assert.equal(phaseFor(Number.NaN), "planning");
});

t("suggested: the mockup's default answers", () => {
  const a = { focus: ["rsvp", "budget", "questions"], detail: "balanced", when: "weekly", team: "partner", adapt: true };
  const s = suggestedCards(a);
  everyOnce(s);
  assert.deepEqual(ids(s), ["countdown", "road", "rsvp", "replies", "budget", "questions", "partner", "briefing", "activity"]);
  assert.equal(s[0].size, "s");
});

t("suggested: every combination has every card once", () => {
  for (const detail of ["glance", "balanced", "full"])
    for (const when of ["daily", "weekly", "needed"])
      for (const team of ["solo", "partner", "planner"])
        for (const focus of [["rsvp"], ["seating", "website"], ["vendors", "tasks", "questions"]]) {
          const s = suggestedCards({ focus, detail, when, team, adapt: true });
          everyOnce(s);
          // The road (#6, introduced) comes on top of the four "needed" cards.
          if (when === "needed") assert.ok(ids(s).filter((id) => id !== "road").length <= 4);
          assert.deepEqual(ids(s).slice(0, 2), ["countdown", "road"]);
          if (detail === "glance") assert.ok(s.filter((c) => !c.hidden).every((c) => c.size === "s"));
        }
});

t("suggested: needed puts the briefing large and first after the countdown", () => {
  const s = suggestedCards({ ...STANDARD_ANSWERS, when: "needed" });
  assert.deepEqual(ids(s).slice(0, 3), ["countdown", "road", "briefing"]);
  assert.equal(s[2].size, "l");
});

t("suggested: full detail widens the first focus card", () => {
  const s = suggestedCards({ ...STANDARD_ANSWERS, detail: "full", focus: ["budget"] });
  assert.equal(s.find((c) => c.id === "budget").size, "l");
});

t("effective: planning or no adapt keeps the stored order", () => {
  const base = suggestedCards(STANDARD_ANSWERS);
  assert.deepEqual(effectiveCards(base, STANDARD_ANSWERS, "planning", []), base);
  assert.deepEqual(effectiveCards(base, { ...STANDARD_ANSWERS, adapt: false }, "week", []), base);
});

t("effective: wedding week lifts its cards after the countdown and shows them", () => {
  const base = suggestedCards(STANDARD_ANSWERS);
  const e = effectiveCards(base, STANDARD_ANSWERS, "week", []);
  everyOnce(e);
  assert.deepEqual(ids(e).slice(0, 5), ["countdown", "runsheet", "checkin", "questions", "road"]);
});

t("effective: handled phase cards stay where the couple put them", () => {
  const base = suggestedCards(STANDARD_ANSWERS);
  const d = markPhaseHandled([], STANDARD_ANSWERS, "after");
  assert.deepEqual(d.sort(), ["after:album", "after:budget", "after:thankyou"]);
  assert.deepEqual(effectiveCards(base, STANDARD_ANSWERS, "after", d), base);
  const one = effectiveCards(base, STANDARD_ANSWERS, "after", ["after:album"]);
  assert.deepEqual(ids(one).slice(0, 3), ["countdown", "thankyou", "budget"]);
  assert.ok(ids(one).includes("road"));
  assert.equal(one.find((c) => c.id === "album").hidden, true);
  assert.deepEqual(markPhaseHandled(["x"], STANDARD_ANSWERS, "planning"), ["x"]);
});

t("rowSpans: rows end flush on 12 and 2 columns", () => {
  const c = (size) => ({ id: "rsvp", size, hidden: false });
  assert.deepEqual(rowSpans([c("s"), c("m"), c("m"), c("m")], 12), [4, 8, 6, 6]);
  assert.deepEqual(rowSpans([c("s"), c("s"), c("s")], 12), [4, 4, 4]);
  assert.deepEqual(rowSpans([c("m"), c("l"), c("s")], 12), [12, 12, 12]);
  assert.deepEqual(rowSpans([c("s"), c("m"), c("s")], 2), [2, 2, 2]);
  assert.deepEqual(rowSpans([c("s"), c("s"), c("l")], 2), [1, 1, 2]);
  assert.deepEqual(rowSpans([], 12), []);
  for (const cols of [12, 2]) {
    const sizes = ["s", "m", "l", "s", "s", "m", "s"];
    const spans = rowSpans(sizes.map(c), cols);
    let cur = 0;
    for (const s of spans) { cur += s; assert.ok(cur <= cols); if (cur === cols) cur = 0; }
    assert.equal(cur, 0);
  }
});

t("sanitize: garbage in", () => {
  assert.equal(sanitizeLayout(null), null);
  assert.equal(sanitizeLayout("x"), null);
  assert.equal(sanitizeLayout([]), null);
  assert.equal(sanitizeLayout({ cards: [] }), null);
  const l = sanitizeLayout({
    answers: { focus: ["budget", "nope", "budget", "tasks", "rsvp", "seating"], detail: "huge", when: "daily", team: 3, adapt: "yes" },
    cards: [{ id: "budget", size: "xl", hidden: "no" }, { id: "budget", size: "l" }, { id: "hack" }, 7, null],
    dismissed: ["week:runsheet", "week:budget", "nope", 5, "week:runsheet"],
  });
  assert.deepEqual(l.answers, { focus: ["budget", "tasks", "rsvp"], detail: "balanced", when: "daily", team: "solo", adapt: true });
  everyOnce(l.cards);
  // An old list never mentioned the road: it is placed once, visible, at the top (no countdown shown).
  assert.deepEqual(l.cards[0], { id: "road", size: "l", hidden: false });
  assert.deepEqual(l.cards[1], { id: "budget", size: "m", hidden: false });
  assert.ok(l.cards.slice(2).every((c) => c.hidden));
  assert.deepEqual(l.dismissed, ["week:runsheet"]);
  const noCards = sanitizeLayout({ answers: STANDARD_ANSWERS });
  assert.deepEqual(noCards.cards, suggestedCards(STANDARD_ANSWERS));
  everyOnce(sanitizeCards("nope"));
});

// K8: new card ids are not hidden for every existing layout, and an older client's
// save does not hide them again.
const OLD_IDS = CARD_IDS.filter((id) => !(id in INTRODUCED));
const oldLayout = [
  { id: "countdown", size: "s", hidden: false },
  { id: "rsvp", size: "m", hidden: false },
  { id: "tasks", size: "m", hidden: false },
  ...OLD_IDS.filter((id) => !["countdown", "rsvp", "tasks"].includes(id)).map((id) => ({ id, size: "m", hidden: true })),
];

t("K8: introduced cards are listed with their anchor", () => {
  assert.deepEqual(INTRODUCED, { road: "countdown" });
  assert.ok(CARD_IDS.includes("road"));
  assert.equal(CARD_IDS[CARD_IDS.length - 1], "road", "new ids are appended, the order of the old ones does not move");
});

t("K8: an existing layout shows the road once, right after the countdown", () => {
  const c = sanitizeCards(oldLayout);
  everyOnce(c);
  assert.deepEqual(ids(c), ["countdown", "road", "rsvp", "tasks"]);
  assert.equal(c[1].size, "l");
  // The same list stored again keeps the couple's choice from then on.
  const hidden = c.map((x) => (x.id === "road" ? { ...x, hidden: true } : x));
  assert.equal(sanitizeCards(hidden).find((x) => x.id === "road").hidden, true);
  // Countdown hidden or absent: the road goes to the top.
  assert.equal(ids(sanitizeCards([{ id: "countdown", size: "s", hidden: true }, { id: "budget", size: "m" }]))[0], "road");
  assert.equal(ids(sanitizeCards([]))[0], "road");
});

t("K8: a save from an app that does not know the road keeps its stored entry", () => {
  const stored = sanitizeCards(oldLayout).map((x) => (x.id === "road" ? { ...x, hidden: true, size: "m" } : x));
  // The 1.3 app posts its own list: no road in it.
  const posted = [{ id: "tasks", size: "m", hidden: false }, { id: "countdown", size: "s", hidden: false }, { id: "rsvp", size: "l", hidden: false }, ...OLD_IDS.filter((id) => !["countdown", "rsvp", "tasks"].includes(id)).map((id) => ({ id, size: "m", hidden: true }))];
  const m = mergeCards(posted, stored);
  everyOnce(m);
  assert.deepEqual(m.find((x) => x.id === "road"), { id: "road", size: "m", hidden: true }, "hidden stays hidden");
  assert.deepEqual(ids(m), ["tasks", "countdown", "rsvp"], "the app's own order and sizes win");
  // A visible road stays visible and keeps its place after the card it followed.
  const shown = sanitizeCards(oldLayout);
  const m2 = mergeCards(posted, shown);
  assert.deepEqual(ids(m2), ["tasks", "countdown", "road", "rsvp"]);
  // Nothing stored: the usual rules (the road is introduced after the countdown).
  assert.deepEqual(ids(mergeCards(posted, null)), ["tasks", "countdown", "road", "rsvp"]);
  // An id the client did send wins over the stored entry.
  const m3 = mergeCards([...posted, { id: "road", size: "s", hidden: false }], stored);
  assert.deepEqual(m3.find((x) => x.id === "road"), { id: "road", size: "s", hidden: false });
  // Garbage posted: the stored layout survives intact.
  assert.deepEqual(mergeCards("nope", stored), stored);
});

console.log(`test-home-layout-core: ${n} groups ok`);

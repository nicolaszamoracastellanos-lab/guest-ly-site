// Run: node --experimental-strip-types scripts/tests/home-layout.test.ts
// The customizable Home's pure core (src/features/couple/homeLayout.ts), a
// verbatim copy of the portal's src/lib/home-layout-core.ts. These are the
// portal's cases (scripts/test-home-layout-core.mjs, K8 and #20 groups
// included) unchanged, so both copies answer to the same assertions.

import assert from "node:assert/strict";
import * as core from "../../src/features/couple/homeLayout.ts";

const { CARD_IDS, INTRODUCED, STANDARD_ANSWERS, phaseFor, suggestedCards, effectiveCards, markPhaseHandled, rowSpans, sanitizeLayout, sanitizeCards, mergeCards, mergeDismissed, sanitizeDismissed } = core;

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
  assert.deepEqual(ids(s), ["countdown", "road", "review", "rsvp", "replies", "budget", "questions", "partner", "briefing", "activity"]);
  assert.equal(s[0].size, "s");
});

t("suggested: every combination has every card once", () => {
  for (const detail of ["glance", "balanced", "full"])
    for (const when of ["daily", "weekly", "needed"])
      for (const team of ["solo", "partner", "planner"])
        for (const focus of [["rsvp"], ["seating", "website"], ["vendors", "tasks", "questions"]]) {
          const s = suggestedCards({ focus, detail, when, team, adapt: true });
          everyOnce(s);
          // The road (#6) and the review ask (#20), introduced, come on top of the four "needed" cards.
          if (when === "needed") assert.ok(ids(s).filter((id) => id !== "road" && id !== "review").length <= 4);
          assert.deepEqual(ids(s).slice(0, 3), ["countdown", "road", "review"]);
          if (detail === "glance") assert.ok(s.filter((c) => !c.hidden).every((c) => c.size === "s"));
        }
});

t("suggested: needed puts the briefing large and first after the countdown", () => {
  const s = suggestedCards({ ...STANDARD_ANSWERS, when: "needed" });
  assert.deepEqual(ids(s).slice(0, 4), ["countdown", "road", "review", "briefing"]);
  assert.equal(s[3].size, "l");
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
  assert.deepEqual(d.sort(), ["after:album", "after:budget", "after:review", "after:thankyou"]);
  assert.deepEqual(effectiveCards(base, STANDARD_ANSWERS, "after", d), base);
  const one = effectiveCards(base, STANDARD_ANSWERS, "after", ["after:album"]);
  // #20: the review ask leads the after phase.
  assert.deepEqual(ids(one).slice(0, 4), ["countdown", "review", "thankyou", "budget"]);
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
  assert.deepEqual(l.cards[1], { id: "review", size: "m", hidden: false });
  assert.deepEqual(l.cards[2], { id: "budget", size: "m", hidden: false });
  assert.ok(l.cards.slice(3).every((c) => c.hidden));
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
  assert.deepEqual(INTRODUCED, { road: "countdown", review: "countdown" });
  assert.ok(CARD_IDS.includes("road"));
  assert.deepEqual(CARD_IDS.slice(-2), ["road", "review"], "new ids are appended, the order of the old ones does not move");
});

t("K8: an existing layout shows the road once, right after the countdown", () => {
  const c = sanitizeCards(oldLayout);
  everyOnce(c);
  assert.deepEqual(ids(c), ["countdown", "road", "review", "rsvp", "tasks"]);
  assert.equal(c[1].size, "l");
  assert.equal(c[2].size, "m");
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
  assert.deepEqual(ids(m), ["tasks", "countdown", "review", "rsvp"], "the app's own order and sizes win");
  // A visible road stays visible and keeps its place after the card it followed.
  const shown = sanitizeCards(oldLayout);
  const m2 = mergeCards(posted, shown);
  assert.deepEqual(ids(m2), ["tasks", "countdown", "road", "review", "rsvp"]);
  // Nothing stored: the usual rules (the road is introduced after the countdown).
  assert.deepEqual(ids(mergeCards(posted, null)), ["tasks", "countdown", "road", "review", "rsvp"]);
  // An id the client did send wins over the stored entry.
  const m3 = mergeCards([...posted, { id: "road", size: "s", hidden: false }], stored);
  assert.deepEqual(m3.find((x) => x.id === "road"), { id: "road", size: "s", hidden: false });
  // Garbage posted: the stored layout survives intact.
  assert.deepEqual(mergeCards("nope", stored), stored);
});

// #20 the review ask card ("review"): introduced like the road, lifted first after the
// wedding, and never hidden by a save from an app that does not know it.
t("K8 #20: the review card after the wedding, and a 1.3 save keeps it", () => {
  const stored = sanitizeCards(oldLayout);
  assert.equal(stored.find((x) => x.id === "review").hidden, false);
  const after = effectiveCards(stored, STANDARD_ANSWERS, "after", []);
  assert.deepEqual(ids(after).slice(0, 2), ["countdown", "review"]);
  // The couple hides it (Edit Home): it stays hidden, also through a 1.3 save without it.
  const hid = stored.map((x) => (x.id === "review" ? { ...x, hidden: true } : x));
  const posted = hid.filter((x) => x.id !== "review" && x.id !== "road");
  assert.equal(mergeCards(posted, hid).find((x) => x.id === "review").hidden, true);
  // Arranged in the after phase: no longer lifted.
  assert.deepEqual(effectiveCards(hid, STANDARD_ANSWERS, "after", ["after:review"]).find((x) => x.id === "review").hidden, true);
  assert.deepEqual(sanitizeDismissed(["after:review", "planning:review"]), ["after:review"]);
});

// Review round 1 (L6): the 1.3 app drops "after:review" from dismissed (its PHASE_CARDS.after has
// no review) and posts markPhaseHandled's list without it. The stored key must survive, or
// effectiveCards lifts the hidden review card back to the top of Home.
t("K8 #20: a 1.3 save after the wedding keeps the hidden review card hidden (dismissed too)", () => {
  const base = sanitizeCards(oldLayout);
  // Web Edit Home in the after phase: review hidden, every after-phase card handled.
  const webCards = base.map((x) => (x.id === "review" ? { ...x, hidden: true } : x));
  const webDismissed = mergeDismissed(markPhaseHandled([], STANDARD_ANSWERS, "after"), webCards, null);
  assert.deepEqual([...webDismissed].sort(), ["after:album", "after:budget", "after:review", "after:thankyou"]);
  assert.equal(effectiveCards(webCards, STANDARD_ANSWERS, "after", webDismissed).find((x) => x.id === "review").hidden, true);
  // The partner saves any change from the 1.3 app: no review card, the 1.3 markPhaseHandled list.
  const appCards = webCards.filter((x) => x.id !== "review" && x.id !== "road").map((x) => (x.id === "budget" ? { ...x, size: "l" } : x));
  const appDismissed = ["after:album", "after:thankyou", "after:budget"];
  const cards = mergeCards(appCards, webCards);
  const dismissed = mergeDismissed(appDismissed, appCards, webDismissed);
  assert.ok(dismissed.includes("after:review"), "the stored key of a card the app does not know stays");
  assert.equal(cards.find((x) => x.id === "review").hidden, true);
  const shown = effectiveCards(cards, STANDARD_ANSWERS, "after", dismissed);
  assert.equal(shown.find((x) => x.id === "review").hidden, true, "review stays hidden on web and 1.4 Home");
  assert.ok(!ids(shown).includes("review"));
  // A client that posts the card speaks for its keys (web, 1.4): leaving the key out lifts it again.
  assert.ok(!mergeDismissed(appDismissed, webCards, webDismissed).includes("after:review"));
  // Only introduced cards keep stored keys: the app owns album, thankyou and budget.
  assert.deepEqual(mergeDismissed([], appCards, webDismissed), ["after:review"]);
  // Nothing posted as cards (a dismissed-only body): stored introduced keys stay.
  assert.deepEqual(mergeDismissed([], undefined, ["after:review", "after:album"]), ["after:review"]);
  // Nothing stored: the posted list, sanitized.
  assert.deepEqual(mergeDismissed(["after:review", "x:y", 3], appCards, null), ["after:review"]);
});

console.log(`test-home-layout-core: ${n} groups ok`);

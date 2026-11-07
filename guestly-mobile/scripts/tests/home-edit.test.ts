// Run: node --experimental-strip-types scripts/tests/home-edit.test.ts
// Edit mode helpers on the app's customizable Home, with the shared core.
import assert from "node:assert/strict";
import { suggestedCards, effectiveCards, markPhaseHandled, type HomeAnswers } from "../../src/features/couple/homeLayout.ts";
import { absentCards, moveCard, setCard, shownCards, showCard } from "../../src/features/couple/homeEdit.ts";

const ids = (cs: { id: string; hidden: boolean }[]) => cs.filter((c) => !c.hidden).map((c) => c.id);
const a: HomeAnswers = { focus: ["rsvp", "budget", "questions"], detail: "balanced", when: "weekly", team: "partner", adapt: true };
const s1 = suggestedCards(a);
// K8 (#6, #20): the core introduces the road and the review ask right after the countdown.
assert.deepEqual(ids(s1), ["countdown", "road", "review", "rsvp", "replies", "budget", "questions", "partner", "briefing", "activity"]);

// Move swaps visible neighbours; the ends do nothing.
assert.deepEqual(ids(moveCard(s1, "replies", -1)).slice(0, 5), ["countdown", "road", "review", "replies", "rsvp"]);
assert.equal(moveCard(s1, "countdown", -1), s1);
assert.equal(moveCard(s1, "activity", 1), s1);
// Size and hide.
assert.equal(setCard(s1, "rsvp", { size: "l" }).find((c) => c.id === "rsvp")!.size, "l");
assert.equal(ids(setCard(s1, "partner", { hidden: true })).includes("partner"), false);
// Add a card: after the last visible one.
assert.equal(ids(showCard(s1, "vendors")).at(-1), "vendors");
assert.equal(showCard(s1, "activity").length, s1.length);

// Saving an edit made during the final month: the couple's order wins from then on.
const shownFinal = effectiveCards(s1, a, "final", []);
const edited = setCard(moveCard(shownFinal, "budget", -1), "seating", { hidden: true });
const dismissed = markPhaseHandled([], a, "final");
assert.deepEqual(ids(effectiveCards(edited, a, "final", dismissed)), ids(edited));
assert.equal(ids(effectiveCards(edited, a, "final", dismissed)).includes("seating"), false);

// #20 (review round 1, b3): MW_REVIEW_ASK on, so the layout lists a visible
// review entry, but cards.review is null (before the wedding, sent, Not now).
// The card is absent in view AND edit mode, as on the web (home-board.tsx).
const shownIds = (cs: { id: string }[]) => cs.map((c) => c.id);
for (const editing of [false, true]) {
  const off = absentCards({ editing, road: true, review: false });
  assert.equal(shownIds(shownCards(s1, off)).includes("review"), false, `no review card (editing ${editing})`);
  // The entry stays in the list, so a save posts it unchanged.
  assert.equal(s1.some((c) => c.id === "review" && !c.hidden), true);
  // A move swaps shown neighbours: rsvp up passes over the absent review card.
  const moved = moveCard(s1, "rsvp", -1, off);
  assert.deepEqual(shownIds(shownCards(moved, off)).slice(0, 3), ["countdown", "rsvp", "road"]);
  assert.equal(moved.find((c) => c.id === "review")!.hidden, false);
}
// With its data the card shows in both modes.
assert.equal(shownIds(shownCards(s1, absentCards({ editing: true, road: true, review: true }))).includes("review"), true);
assert.equal(shownIds(shownCards(s1, absentCards({ editing: false, road: true, review: true }))).includes("review"), true);
// Road keeps its Oct 31 rule: absent without data in view mode only.
assert.equal(absentCards({ editing: false, road: false, review: true }).has("road"), true);
assert.equal(absentCards({ editing: true, road: false, review: true }).has("road"), false);

console.log("home-edit.test.ts: ok");

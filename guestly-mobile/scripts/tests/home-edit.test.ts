// Run: node --experimental-strip-types scripts/tests/home-edit.test.ts
// Edit mode helpers on the app's customizable Home, with the shared core.
import assert from "node:assert/strict";
import { suggestedCards, effectiveCards, markPhaseHandled, type HomeAnswers } from "../../src/features/couple/homeLayout.ts";
import { moveCard, setCard, showCard } from "../../src/features/couple/homeEdit.ts";

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

console.log("home-edit.test.ts: ok");

// Run: node --experimental-strip-types scripts/tests/home-layout.test.ts
// The customizable Home core. The portal runs the same assertions on its copy
// (src/lib/home-layout-core.ts); the two files must stay identical.
import assert from "node:assert/strict";
import { CARD_IDS, STANDARD_ANSWERS, phaseFor, suggestedCards, effectiveCards, rowSpans, sanitizeLayout, moveCard, showCard, hideCard, type HomeAnswers, type HomeCard } from "../../src/features/couple/homeLayout.ts";

const ids = (cs: HomeCard[]) => cs.filter((c) => !c.hidden).map((c) => c.id);
const everyOnce = (cs: HomeCard[]) => assert.deepEqual([...cs.map((c) => c.id)].sort(), [...CARD_IDS].sort());

// Phases.
assert.equal(phaseFor(null), "planning");
assert.equal(phaseFor(90), "planning");
assert.equal(phaseFor(31), "planning");
assert.equal(phaseFor(30), "final");
assert.equal(phaseFor(8), "final");
assert.equal(phaseFor(7), "week");
assert.equal(phaseFor(0), "week");
assert.equal(phaseFor(-1), "after");
assert.equal(phaseFor(Number.NaN), "planning");

// The mockup's default answers: RSVPs, budget, questions; balanced; weekly; partner.
const mock: HomeAnswers = { focus: ["rsvp", "budget", "questions"], detail: "balanced", when: "weekly", team: "partner", adapt: true };
const s1 = suggestedCards(mock);
everyOnce(s1);
assert.deepEqual(ids(s1), ["countdown", "rsvp", "replies", "budget", "questions", "partner", "briefing", "activity"]);

// Glance: everything small. Full: the first focus card is large.
assert.ok(suggestedCards({ ...mock, detail: "glance" }).filter((c) => !c.hidden).every((c) => c.size === "s"));
const full = suggestedCards({ ...mock, detail: "full" });
assert.equal(full.find((c) => c.id === "rsvp")!.size, "l");
assert.equal(full.find((c) => c.id === "partner")!.size, "s");

// Daily: the briefing right after the countdown. Needed: a short Home of four, briefing large, nothing lost.
assert.deepEqual(ids(suggestedCards({ ...mock, when: "daily" })).slice(0, 2), ["countdown", "briefing"]);
const needed = suggestedCards({ ...mock, when: "needed" });
everyOnce(needed);
assert.equal(ids(needed).length, 4);
assert.equal(needed.find((c) => c.id === "briefing")!.size, "l");
assert.equal(needed.find((c) => c.id === "activity")!.hidden, true);

// Standard (Skip): every card once.
everyOnce(suggestedCards(STANDARD_ANSWERS));

// Effective: planning or adapt off changes nothing; final promotes after the countdown.
assert.deepEqual(effectiveCards(s1, mock, "planning", []), s1);
assert.deepEqual(effectiveCards(s1, { ...mock, adapt: false }, "week", []), s1);
const fin = effectiveCards(s1, mock, "final", []);
assert.deepEqual(ids(fin).slice(0, 5), ["countdown", "rsvp", "seating", "vendors", "budget"]);
everyOnce(fin);
const wk = effectiveCards(s1, mock, "week", ["week:checkin"]);
assert.deepEqual(ids(wk).slice(0, 3), ["countdown", "runsheet", "questions"]);
assert.equal(wk.find((c) => c.id === "checkin")!.hidden, true);
// A hidden countdown: phase cards go first.
const noCd = s1.map((c) => (c.id === "countdown" ? { ...c, hidden: true } : c));
assert.equal(ids(effectiveCards(noCd, mock, "after", []))[0], "album");

// Rows end flush, order kept.
const v = (sizes: string) => sizes.split("").map((s, i) => ({ id: CARD_IDS[i], size: s as "s" | "m" | "l", hidden: false }));
assert.deepEqual(rowSpans(v("smmm"), 12), [4, 8, 6, 6]);
assert.deepEqual(rowSpans(v("sss"), 12), [4, 4, 4]);
assert.deepEqual(rowSpans(v("lsm"), 12), [12, 4, 8]);
assert.deepEqual(rowSpans(v("s"), 12), [12]);
assert.deepEqual(rowSpans(v("ssm"), 2), [1, 1, 2]);
assert.deepEqual(rowSpans(v("sms"), 2), [2, 2, 2]);
assert.deepEqual(rowSpans([], 2), []);

// Sanitize: junk dropped, missing appended hidden, sizes clamped, answers defaulted.
const clean = sanitizeLayout({
  answers: { focus: ["budget", "nope", "budget", "rsvp", "tasks", "seating"], detail: "huge", when: "daily", team: "planner", adapt: "yes" },
  cards: [{ id: "budget", size: "xl" }, { id: "budget", size: "s" }, { id: "ghost" }, "x", { id: "rsvp", size: "l", hidden: true }],
  dismissed: ["final:seating", "final:seating", "later:rsvp", "week:ghost", 3],
})!;
assert.deepEqual(clean.answers, { focus: ["budget", "rsvp", "tasks"], detail: "balanced", when: "daily", team: "planner", adapt: true });
assert.deepEqual(clean.cards.slice(0, 2), [{ id: "budget", size: "m", hidden: false }, { id: "rsvp", size: "l", hidden: true }]);
everyOnce(clean.cards);
assert.deepEqual(clean.dismissed, ["final:seating"]);
assert.equal(sanitizeLayout(null), null);
assert.equal(sanitizeLayout({ cards: [] }), null);
assert.deepEqual(sanitizeLayout({ answers: {} })!.cards, suggestedCards(STANDARD_ANSWERS));

// Edit helpers.
const moved = moveCard(s1, "replies", -1);
assert.deepEqual(ids(moved).slice(0, 3), ["countdown", "replies", "rsvp"]);
assert.equal(moveCard(s1, "countdown", -1), s1);
const shown = showCard(s1, "vendors");
assert.equal(ids(shown).at(-1), "vendors");
const h = hideCard(fin, [], "seating", "final", true);
assert.deepEqual(h.dismissed, ["final:seating"]);
assert.equal(ids(effectiveCards(h.cards, mock, "final", h.dismissed)).includes("seating"), false);
assert.deepEqual(hideCard(s1, [], "activity", "planning", true).dismissed, []);

console.log("home-layout.test.ts: ok");

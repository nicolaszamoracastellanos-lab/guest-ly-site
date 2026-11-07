// Run: node --experimental-strip-types scripts/tests/road.test.ts
// #6 Road to the wedding and K8, the app's side (src/features/couple/road.ts):
// reading cards.road and the portfolio stage, mapping the line's web paths to
// app screens, and the K8 rule that a card the server did not serve is
// neither drawn nor posted back (so the server keeps its stored entry).
// Plus copy parity and static checks that every surface uses the rules.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./lib/ts-resolve.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (p: string) => readFileSync(path.join(here, "../..", p), "utf8");
const road = await import("../../src/features/couple/road.ts");
const core = await import("../../src/features/couple/homeLayout.ts");
const { HOME_COPY } = await import("../../src/features/couple/homeCopy.ts");
const { COPY: PLANNER } = await import("../../src/features/planner/copy.ts");

let n = 0;
const t = (name: string, fn: () => void) => {
  try {
    fn();
    n++;
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
};

// The portal's RoadVM for Valentina & Mateo after review round 2 (milestones-view roadView).
const VM = {
  items: [
    { id: "venue", state: "done", overdue: false, label: "Venue booked", sub: "Done", dueSub: "Usually by June 2026", href: "/vendors", markable: false, markOffered: false, marked: false, doneAt: null },
    { id: "save_the_dates", state: "upcoming", overdue: false, label: "Save the dates sent", sub: null, dueSub: null, href: "/broadcasts", markable: true, markOffered: true, marked: false, doneAt: null },
    { id: "invitations", state: "done", overdue: false, label: "Invitations sent", sub: "Done Sep 26", dueSub: null, href: "/broadcasts", markable: false, markOffered: false, marked: false, doneAt: "2026-09-26" },
    { id: "replies", state: "now", overdue: true, label: "Replies in", sub: "By Nov 1", dueSub: "By Nov 1", href: "/guests", markable: false, markOffered: false, marked: false, doneAt: null },
    { id: "wedding_day", state: "upcoming", overdue: false, label: "Wedding day", sub: "Dec 12", dueSub: "Dec 12", href: "/runsheet", markable: false, markOffered: false, marked: false, doneAt: null },
  ],
  nowId: "replies",
  nextId: "wedding_day",
  done: 2,
  total: 5,
  doneText: "2 of 5 done",
  nextStep: { text: "Follow up with the guests who have not answered.", href: "/guests", linkLabel: "Open guests" },
};

t("readRoad: the portal's view model as the app draws it", () => {
  const r = road.readRoad(VM);
  assert.ok(r);
  assert.equal(r.items.length, 5);
  assert.equal(r.nowId, "replies");
  assert.equal(r.nextId, "wedding_day");
  assert.equal(r.doneText, "2 of 5 done");
  assert.equal(r.items[3].overdue, true);
  assert.deepEqual(r.nextStep, VM.nextStep);
  assert.equal(road.roadCardRoute(r), "/couple/guests", "the card opens the Now step");
});

t("readRoad: missing, null, garbage and unknown ids", () => {
  for (const raw of [undefined, null, "road", [], {}, { items: "x" }, { items: [] }, { items: [{ id: "honeymoon", label: "x" }] }]) assert.equal(road.readRoad(raw), null);
  const odd = road.readRoad({ items: [{ id: "venue", label: "Venue booked", state: "weird" }, { id: "venue", label: "again" }, { id: "replies" }], nowId: "timeline", nextId: 3 });
  assert.ok(odd);
  assert.equal(odd.items.length, 1, "repeats and rows without a label are dropped");
  assert.equal(odd.items[0].state, "upcoming");
  assert.equal(odd.nowId, null, "Now must name a row that is there");
  assert.equal(odd.doneText, "0 / 1");
  assert.equal(road.roadCardRoute(odd), "/couple/runsheet", "no Now step: the runsheet");
});

t("roadRows: every row (L), Now and Next (M), Now alone (S)", () => {
  const r = road.readRoad(VM)!;
  assert.equal(road.roadRows(r, "l").length, 5);
  assert.deepEqual(road.roadRows(r, "m").map((i) => i.id), ["replies", "wedding_day"]);
  assert.deepEqual(road.roadRows(r, "s").map((i) => i.id), ["replies"]);
  const allDone = { ...r, nowId: null, nextId: null };
  assert.deepEqual(road.roadRows(allDone, "m"), []);
});

t("roadRoute: the five web tabs, with query or slash; anything else none", () => {
  assert.equal(road.roadRoute("/vendors"), "/couple/vendors");
  assert.equal(road.roadRoute("/broadcasts?new=1"), "/couple/broadcasts");
  assert.equal(road.roadRoute("/guests/"), "/couple/guests");
  assert.equal(road.roadRoute("/brain"), "/couple/brain");
  assert.equal(road.roadRoute("/planner/w/x/guests"), null, "a planner path never opens a couple screen");
  assert.equal(road.roadRoute("https://evil.example/guests"), null);
  assert.equal(road.roadRoute(null), null);
});

t("readStage: the portfolio's Stage, or nothing", () => {
  assert.deepEqual(road.readStage({ now_id: "save_the_dates", label: "Send save the dates", done: 1, total: 5 }), { nowId: "save_the_dates", label: "Send save the dates", done: 1, total: 5 });
  assert.deepEqual(road.readStage({ now_id: null, label: "All done", done: 7, total: 7 })?.nowId, null);
  for (const raw of [undefined, null, {}, { label: "", done: 1, total: 5 }, { label: "x", done: -1, total: 5 }, { label: "x", done: 1, total: 0 }]) assert.equal(road.readStage(raw), null);
  assert.equal(road.readStage({ label: "x", done: 9, total: 5 })?.done, 5, "never more done than total");
});

// ---- K8 ---------------------------------------------------------------------------------
const OLD = core.CARD_IDS.filter((id: string) => id !== "road" && id !== "review");
const served = (withRoad: boolean, roadHidden = false) => [
  { id: "countdown", size: "s", hidden: false },
  ...(withRoad ? [{ id: "road", size: "l", hidden: roadHidden }] : []),
  { id: "rsvp", size: "m", hidden: false },
  ...OLD.filter((id: string) => !["countdown", "rsvp"].includes(id)).map((id: string) => ({ id, size: "m", hidden: true })),
];
const ids = (cards: { id: string; hidden: boolean }[]) => cards.filter((c) => !c.hidden).map((c) => c.id);

t("K8: the app's lists of introduced and milestone ids match the cores", () => {
  assert.deepEqual(Object.keys(core.INTRODUCED), ["road", "review"]);
  assert.ok(src("src/features/couple/road.ts").includes('from "./homeLayout"'), "reads INTRODUCED from the verbatim core");
});

t("K8: a payload without the road (flag off, older portal) never draws or posts it", () => {
  const raw = served(false);
  const clean = core.sanitizeLayout({ answers: core.STANDARD_ANSWERS, cards: raw })!;
  assert.ok(clean.cards.some((c: { id: string }) => c.id === "road"), "the core alone would introduce it");
  const kept = road.keepServed(clean.cards, raw);
  assert.ok(!kept.some((c) => c.id === "road"));
  assert.deepEqual(ids(kept), ["countdown", "rsvp"]);
  // The quiz's suggestion is filtered the same way before a PUT.
  const suggested = core.suggestedCards(core.STANDARD_ANSWERS);
  assert.ok(ids(suggested).includes("road"));
  assert.ok(!road.onlyServed(suggested, kept.map((c) => c.id)).some((c) => c.id === "road"));
  assert.ok(!road.onlyServed(suggested, null).some((c) => c.id === "road"), "no layout read yet: left to the server");
});

t("K8: a payload with the road keeps it as served, shown or hidden", () => {
  for (const hidden of [false, true]) {
    const raw = served(true, hidden);
    const clean = core.sanitizeLayout({ answers: core.STANDARD_ANSWERS, cards: raw })!;
    const kept = road.keepServed(clean.cards, raw);
    const r = kept.find((c) => c.id === "road");
    assert.ok(r);
    assert.equal(r.hidden, hidden, "the partner's choice stands");
    const put = road.onlyServed(kept, kept.map((c) => c.id));
    assert.deepEqual(put, kept, "a save posts exactly what was served");
  }
});

t("K8: what the app posts merges on the server without hiding the stored road", () => {
  // The server stored the road visible after the countdown; this phone was not served it.
  const stored = core.sanitizeCards(served(true));
  const kept = road.keepServed(core.sanitizeCards(served(false)), served(false));
  const moved = [kept[1], kept[0], ...kept.slice(2)];
  const merged = core.mergeCards(moved, stored);
  assert.deepEqual(merged.find((c: { id: string }) => c.id === "road"), { id: "road", size: "l", hidden: false });
  // The core also introduces "review" (#20) into a stored list without it; the server
  // leaves it out of what it serves while MW_REVIEW_ASK is off (lib/mobile/home-layout.ts).
  assert.deepEqual(ids(merged).filter((id: string) => id !== "review"), ["rsvp", "countdown", "road"]);
});

t("#20 review card: served to 1.4.0 after the wedding, this build draws and posts it", () => {
  assert.equal(road.NOT_DRAWN.size, 0, "batch 3: no introduced card is left undrawn");
  // What GET /couple/home sends a 1.4.0 couple with MW_REVIEW_ASK on after the day:
  // review lifted first, visible (lib/mobile/home-layout.ts).
  const raw = [{ id: "review", size: "m", hidden: false }, ...served(true)];
  const clean = core.sanitizeLayout({ answers: core.STANDARD_ANSWERS, cards: raw })!;
  const kept = road.keepServed(clean.cards, raw);
  assert.ok(kept.some((c) => c.id === "review" && !c.hidden), "kept as served");
  assert.ok(road.onlyServed(kept, kept.map((c) => c.id)).some((c) => c.id === "review"), "posted back as served");
  // Flag off (or an older portal): not listed, so neither drawn nor posted, and the
  // server keeps its stored card and the partner's key (mergeCards, mergeDismissed).
  const off = served(true);
  const keptOff = road.keepServed(core.sanitizeLayout({ answers: core.STANDARD_ANSWERS, cards: off })!.cards, off);
  assert.ok(!keptOff.some((c) => c.id === "review"));
  assert.ok(!road.onlyServed(core.suggestedCards(core.STANDARD_ANSWERS), keptOff.map((c) => c.id)).some((c) => c.id === "review"));
  const stored = core.sanitizeCards(raw.map((c) => (c.id === "review" ? { ...c, hidden: true } : c)));
  assert.deepEqual(core.mergeCards(keptOff, stored).find((c: { id: string }) => c.id === "review"), { id: "review", size: "m", hidden: true });
  assert.ok(core.mergeDismissed([], keptOff, ["after:review"]).includes("after:review"));
  assert.equal(HOME_COPY.en.cards.review, "Your feedback", "the portal's card title");
  assert.equal(HOME_COPY.es.cards.review, "Tu opinión");
});

t("#20 review card: Edit Home after the wedding posts after:review only when the card was served", () => {
  const a = { ...core.STANDARD_ANSWERS, adapt: true };
  const stored = core.suggestedCards(a);
  assert.equal(core.effectiveCards(stored, a, "after", [])[1].id, "review", "the web lifts the review card second");
  // Served (flag on): the couple arranged Home with the card in view, as on the web.
  const keptOn = road.keepServed(stored, stored);
  const postedOn = road.onlyServedKeys(core.markPhaseHandled([], a, "after"), keptOn.map((c) => c.id));
  assert.ok(postedOn.includes("after:review"));
  // Not served (flag off): no key for a card this phone never showed; the web keeps lifting it.
  const keptOff = road.keepServed(stored, stored.filter((c: { id: string }) => c.id !== "review"));
  const postedOff = road.onlyServedKeys(core.markPhaseHandled([], a, "after"), keptOff.map((c) => c.id));
  assert.deepEqual(postedOff, ["after:album", "after:thankyou", "after:budget"]);
  const merged = core.mergeDismissed(postedOff, keptOff, []);
  assert.equal(core.effectiveCards(core.mergeCards(keptOff, stored), a, "after", merged)[1].id, "review");
  assert.ok(core.mergeDismissed(postedOff, keptOff, ["after:review"]).includes("after:review"), "a key stored on the web stands");
  // No layout read yet: introduced keys are left to the server; others pass.
  assert.deepEqual(road.onlyServedKeys(["after:review", "after:album", "final:rsvp"], null), ["after:album", "final:rsvp"]);
  assert.ok(/onlyServedKeys\(markPhaseHandled\(draft\.dismissed, layout\.answers, layout\.phase\), layout\.served\)/.test(src("src/features/couple/CustomHome.tsx")), "Edit Home posts only served keys");
});

t("listedIds: only ids the payload listed", () => {
  assert.deepEqual([...road.listedIds([{ id: "road" }, { id: "nope" }, null, "x", { id: "rsvp" }])], ["road", "rsvp"]);
  assert.equal(road.listedIds("x").size, 0);
});

// ---- copy -------------------------------------------------------------------------------
const DASH = /[\u2013\u2014]/;
t("copy: road words EN and ES, the planner Stage line, no dash, no exclamation", () => {
  for (const lang of ["en", "es"] as const) {
    const h = HOME_COPY[lang];
    for (const k of ["roadNow", "roadNext", "roadOverdue", "roadAllDone", "roadDoneA11y", "roadNotYetA11y"] as const) {
      assert.ok(h[k], `${lang}.${k}`);
      assert.ok(!DASH.test(h[k]) && !h[k].includes("!"), `${lang}.${k}`);
    }
    assert.ok(h.cards.road);
    const p = PLANNER[lang];
    for (const k of ["stage", "stageA11y"] as const) for (const ph of ["{label}", "{done}", "{total}"]) assert.ok(p[k].includes(ph), `${lang}.${k} ${ph}`);
  }
  assert.equal(HOME_COPY.en.cards.road, "Road to the wedding", "the portal's title");
  assert.equal(HOME_COPY.es.cards.road, "Camino a la boda");
  assert.equal(HOME_COPY.es.roadNext, "Después", "the portal's nextLabel");
});

// ---- static: every surface applies the rules -------------------------------------------
t("static: layout read, saves, card, plain Home and portfolio use the rules", () => {
  const cards = src("src/features/couple/homeCards.ts");
  assert.ok(/keepServed\(clean\.cards, r\.cards\)/.test(cards), "readLayout drops what was not served");
  assert.ok(/served: cards\.map/.test(cards));
  assert.ok(/onlyServed\(suggestedCards\(answers\), start\.served\)/.test(src("src/features/couple/HomeQuiz.tsx")), "the quiz posts only served ids");
  const home = src("src/app/couple/index.tsx");
  assert.ok(/onlyServed\(suggestedCards\(STANDARD_ANSWERS\), layout\?\.served \?\? null\)/.test(home), "Skip posts only served ids");
  assert.ok(/roadOnPlainHome/.test(home));
  const custom = src("src/features/couple/CustomHome.tsx");
  assert.ok(/absentCards\(\{ editing, road: !!road,/.test(custom), "no data, no road card on Home");
  assert.ok(/roadCardRoute\(road\)/.test(custom));
  assert.ok(!/Pressable|Button/.test(custom.slice(custom.indexOf("export function RoadBody"), custom.indexOf("function Tool("))), "nothing inside the road card is a second button");
  assert.ok(/readStage\(w\.stage\)/.test(src("src/features/planner/Cockpit.tsx")));
});

console.log(`road (#6, K8): ${n} groups ok`);

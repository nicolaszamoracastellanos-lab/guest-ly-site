// Run: node --experimental-strip-types scripts/tests/review-card.test.ts
// #20 review card on the couple's Home (src/features/couple/reviewCard.ts):
// reading cards.review (absent = no card), the rating on the feedback URL, the
// link the browser may open, when Apple's rating sheet may be asked for (once
// per install, strictly after the wedding day, never by rating), the portal's
// words, and static checks on the card, the sheet and Home.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./lib/ts-resolve.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (p: string) => readFileSync(path.join(here, "../..", p), "utf8");
const rc = await import("../../src/features/couple/reviewCard.ts");

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

const PAYLOAD = { feedback_link: "/couple/feedback/link", dismiss: "/couple/feedback/dismiss" };

t("cards.review: the portal's payload reads; absent, null or odd means no card", () => {
  assert.deepEqual(rc.readReviewCard(PAYLOAD), { link: "/couple/feedback/link", dismiss: "/couple/feedback/dismiss" });
  for (const bad of [undefined, null, "x", [], {}, { feedback_link: "/couple/feedback/link" }, { ...PAYLOAD, feedback_link: "https://evil.example/x" }, { ...PAYLOAD, dismiss: "/planner/feedback/dismiss" }]) {
    assert.equal(rc.readReviewCard(bad), null, JSON.stringify(bad));
  }
});

t("the rating rides on the URL as ?r=N, after any query, before any hash", () => {
  assert.equal(rc.withRating("https://app.guest-ly.com/feedback/abc", 4), "https://app.guest-ly.com/feedback/abc?r=4");
  assert.equal(rc.withRating("https://app.guest-ly.com/feedback/abc?lang=es", 1), "https://app.guest-ly.com/feedback/abc?lang=es&r=1");
  assert.equal(rc.withRating("https://app.guest-ly.com/feedback/abc#f", 5), "https://app.guest-ly.com/feedback/abc?r=5#f");
  assert.equal(rc.withRating("https://app.guest-ly.com/feedback/abc", null), "https://app.guest-ly.com/feedback/abc");
});

t("only an https link (or the local stack) is opened", () => {
  assert.equal(rc.readLinkUrl({ url: "https://app.guest-ly.com/feedback/tok", expires_in_days: 60 }), "https://app.guest-ly.com/feedback/tok");
  assert.equal(rc.readLinkUrl({ url: "http://localhost:3200/feedback/tok" }), "http://localhost:3200/feedback/tok");
  for (const bad of [null, {}, { url: 3 }, { url: "http://evil.example/x" }, { url: "javascript:alert(1)" }, { url: "https://a b" }]) {
    assert.equal(rc.readLinkUrl(bad), null, JSON.stringify(bad));
  }
});

t("Apple's sheet: once per install, only where it can show, strictly after the wedding day", () => {
  const ok = { asked: false, available: true, hasAction: true, weddingDate: "2026-11-27", today: "2026-11-28" };
  assert.equal(rc.storeReviewDue(ok), true);
  assert.equal(rc.storeReviewDue({ ...ok, today: "2026-11-27" }), false, "never on the wedding day");
  assert.equal(rc.storeReviewDue({ ...ok, today: "2026-11-26" }), false, "never the day before");
  assert.equal(rc.storeReviewDue({ ...ok, asked: true }), false, "once per install");
  assert.equal(rc.storeReviewDue({ ...ok, available: false }), false);
  assert.equal(rc.storeReviewDue({ ...ok, hasAction: false }), false);
  assert.equal(rc.storeReviewDue({ ...ok, weddingDate: null }), false, "no date, no ask");
  assert.equal(rc.storeReviewDue({ ...ok, weddingDate: "2026-11-27T00:00:00Z", today: "2027-01-02" }), true);
  assert.equal(rc.localDay(new Date(2026, 10, 7, 23, 59)), "2026-11-07");
  // Per install: not under gl.scoped., so a sign-out does not ask again.
  assert.ok(!rc.STORE_REVIEW_KEY.startsWith("gl.scoped."));
});

t("words: the portal's, EN and ES, no dashes or exclamation marks", () => {
  for (const lang of ["en", "es"] as const) {
    const c = rc.REVIEW_COPY[lang];
    assert.deepEqual(Object.keys(c.ratings), ["1", "2", "3", "4", "5"]);
    for (const v of [c.body, c.give, c.notNow, c.dismissed, c.openFailed, c.hideFailed, ...Object.values(c.ratings)]) {
      assert.ok(!/[–—!]/.test(v), v);
      assert.ok(!/Guestly|Guest ly/.test(v), v);
    }
  }
  assert.deepEqual(Object.keys(rc.REVIEW_COPY.en).sort(), Object.keys(rc.REVIEW_COPY.es).sort());
  const portal = process.env.GL_PORTAL_DIR || "/Users/nicolas_z/gl-mw/integration";
  const file = path.join(portal, "src/lib/i18n/feedback.ts");
  if (!existsSync(file)) return console.warn(`WARN  ${file} not found, word parity skipped`);
  const text = readFileSync(file, "utf8");
  for (const lang of ["en", "es"] as const) {
    const c = rc.REVIEW_COPY[lang];
    for (const [key, mine] of [["cardBody", c.body], ["giveFeedback", c.give], ["notNow", c.notNow], ["dismissed", c.dismissed]] as const) {
      assert.ok(text.includes(`${key}: ${JSON.stringify(mine)}`), `${lang} ${key} is the portal's word for word`);
    }
    const r = c.ratings;
    assert.ok(text.includes(`ratings: { 1: ${JSON.stringify(r[1])}, 2: ${JSON.stringify(r[2])}, 3: ${JSON.stringify(r[3])}, 4: ${JSON.stringify(r[4])}, 5: ${JSON.stringify(r[5])} }`), `${lang} ratings`);
  }
});

t("static: the card opens the browser, then maybe the sheet; Not now has Undo; Home draws it only with its payload", () => {
  const body = src("src/features/couple/ReviewCardBody.tsx");
  const open = body.indexOf("WebBrowser.openBrowserAsync(withRating(url, n))");
  const ask = body.indexOf("maybeAskStoreReview(weddingDate)");
  assert.ok(open > 0 && ask > open, "the sheet comes after the browser closes");
  assert.ok(!/maybeAskStoreReview\([^)]*\bn\b/.test(body), "the rating plays no part in the sheet");
  assert.match(body, /post\(card\.dismiss, \{ dismissed: true \}\)/);
  assert.match(body, /undo: \(\) => \{[\s\S]*post\(card\.dismiss, \{ dismissed: false \}\)/);
  assert.match(body, /isMissingEndpoint\(err\)/, "a 404 (flag off) hides the card quietly");
  const sheet = src("src/features/couple/storeReview.ts");
  assert.ok(sheet.indexOf("AsyncStorage.setItem(STORE_REVIEW_KEY") < sheet.indexOf("StoreReview.requestReview()"), "marked before asking");
  const home = src("src/features/couple/CustomHome.tsx");
  assert.match(home, /readReviewCard\(cards\?\.review\)/);
  assert.match(home, /absentCards\(\{ editing, road: !!road, review: !!review && !reviewOff \}\)/, "review is absent without its data");
  assert.match(home, /shownCards\(list, absent\)/, "view and edit mode both draw only shown cards");
  assert.match(home, /moveCard\(d\.cards, item\.id, dir, absent\)/, "a move skips absent cards, as on the web");
  assert.ok(!/editing \|\| \(\(x\.id/.test(home), "no edit-mode bypass of the review rule");
  assert.match(home, /link=\{item\.id !== "review"\}/, "the card itself is not a link: its ratings are");
  assert.equal(src("src/features/couple/road.ts").includes('new Set<CardId>(["review"])'), false, "NOT_DRAWN no longer holds review");
});

console.log(`review-card: ${n} groups passed`);

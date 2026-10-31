// Run: node --experimental-strip-types scripts/tests/home-cards.test.ts
// The customizable Home on the app side: rows of two, every card opens a
// screen that exists, the recap line in both languages.
import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { rowsOf, CARD_ROUTES } from "../../src/features/couple/homeCardsCore.ts";
import { rowSpans, CARD_IDS, type HomeCard } from "../../src/features/couple/homeLayout.ts";
import { HOME_COPY, hourLabel, recapLine } from "../../src/features/couple/homeCopy.ts";

// Rows of two from rowSpans: S cards pair up, M and L take a row, a lone S widens.
const v = (sizes: string): HomeCard[] => sizes.split("").map((s, i) => ({ id: CARD_IDS[i], size: s as "s" | "m" | "l", hidden: false }));
const shape = (cards: HomeCard[]) => rowsOf(cards, rowSpans(cards, 2)).map((r) => r.map((x) => x.span));
assert.deepEqual(shape(v("ssm")), [[1, 1], [2]]);
assert.deepEqual(shape(v("sms")), [[2], [2], [2]]);
assert.deepEqual(shape(v("lssl")), [[2], [1, 1], [2]]);
assert.deepEqual(shape(v("")), []);
assert.deepEqual(rowsOf(["a", "b", "c"], [1, 1, 2]).map((r) => r.map((x) => x.item)), [["a", "b"], ["c"]]);

// Every card opens a screen the app has (expo-router files under src/app, route groups ignored).
const appDir = join(import.meta.dirname, "../../src/app");
const routes = new Set<string>();
(function walk(dir: string, url: string) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, /^\(.*\)$/.test(name) ? url : `${url}/${name}`);
    else if (/\.tsx$/.test(name) && !name.startsWith("_")) routes.add(name === "index.tsx" ? url || "/" : `${url}/${name.replace(/\.tsx$/, "")}`);
  }
})(appDir, "");
for (const id of CARD_IDS) assert.ok(routes.has(CARD_ROUTES[id]), `${id} opens ${CARD_ROUTES[id]}, which is not a route`);
assert.ok(existsSync(join(appDir, "home-setup.tsx")));

// Copy: both languages carry every card title; the recap reads naturally.
for (const lang of ["en", "es"] as const) for (const id of CARD_IDS) assert.ok(HOME_COPY[lang].cards[id], `${lang} title for ${id}`);
assert.equal(hourLabel(8, "en"), "8:00 AM");
assert.equal(hourLabel(0, "en"), "12:00 AM");
assert.equal(hourLabel(19, "en"), "7:00 PM");
assert.equal(hourLabel(19, "es"), "19:00");
assert.equal(recapLine(HOME_COPY.en, { cadence: "weekly", weekday: 1, hour: 8 }, "en"), "Mondays at 8:00 AM");
assert.equal(recapLine(HOME_COPY.es, { cadence: "weekly", weekday: 6, hour: 9 }, "es"), "Los sábados a las 9:00");
assert.equal(recapLine(HOME_COPY.es, { cadence: "weekly", weekday: 1, hour: 9 }, "es"), "Los lunes a las 9:00");
assert.equal(recapLine(HOME_COPY.en, { cadence: "daily", weekday: 1, hour: 7 }, "en"), "Every day at 7:00 AM");
assert.equal(recapLine(HOME_COPY.en, { cadence: "needed", weekday: 1, hour: 7 }, "en"), "Only when something needs you");
// No em or en dashes anywhere in the copy.
assert.ok(!/[–—]/.test(JSON.stringify(HOME_COPY)));

console.log("home-cards.test.ts: ok");

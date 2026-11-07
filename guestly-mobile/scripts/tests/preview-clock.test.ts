// Run: node --experimental-strip-types scripts/tests/preview-clock.test.ts
// "Preview the day" (src/features/dayof/previewClock.ts): demo weddings only,
// the moments offered, the clock moving in real time from the chosen moment,
// one wedding at a time, and the engine giving the right Now / Next at a
// preview instant (La Paz wedding, Tokyo viewer clock irrelevant). Static: the
// live screens pass their slug to useNow, Mark done in a preview sends nothing.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./lib/ts-resolve.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (p: string) => readFileSync(path.join(here, "../..", p), "utf8");
const PC = await import("../../src/features/dayof/previewClock.ts");
const L = await import("../../src/features/dayof/live.ts");
const { DAYOF_COPY } = await import("../../src/features/dayof/copy.ts");

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

const PROD = { dev: false, apiBase: "https://app.guest-ly.com" };
t("allowed only on demo weddings (or a dev build on a local portal)", () => {
  assert.equal(PC.previewAllowed({ slug: "demo-valentina-and-mateo" }, PROD), true);
  assert.equal(PC.previewAllowed({ slug: "demo-review" }, PROD), true);
  assert.equal(PC.previewAllowed({ slug: "any", is_demo: true }, PROD), true);
  assert.equal(PC.previewAllowed({ slug: "alexnico2026" }, PROD), false);
  assert.equal(PC.previewAllowed({ slug: "dante-y-gleicy" }, PROD), false);
  assert.equal(PC.previewAllowed({ slug: "dante-y-gleicy", is_demo: "true" }, PROD), false, "only a real true");
  assert.equal(PC.previewAllowed({ slug: "valentina-y-mateo" }, { dev: true, apiBase: "http://127.0.0.1:3295" }), true);
  assert.equal(PC.previewAllowed({ slug: "valentina-y-mateo" }, { dev: true, apiBase: "https://app.guest-ly.com" }), false, "dev build on production: never");
  assert.equal(PC.previewAllowed({ slug: "valentina-y-mateo" }, { dev: false, apiBase: "http://127.0.0.1:3295" }), false, "release build: never");
  assert.equal(PC.previewAllowed(null, PROD), false);
});

const DAY = "2027-05-22";
const TZ = "America/La_Paz";
const blocks = [
  { id: "a", day: DAY, starts_at: "16:00", ends_at: "16:45", title: "Ceremonia" },
  { id: "b", day: DAY, starts_at: "17:00", ends_at: "18:30", title: "Cóctel" },
  { id: "c", day: DAY, starts_at: "01:30", ends_at: null, title: "Última canción" },
  { id: "x", day: "2027-05-23", starts_at: "11:00", ends_at: "13:00", title: "Brunch" },
];

t("moments: the day's moments in service order, a few minutes in, plus 30 min before", () => {
  const { before, moments } = PC.previewMoments(blocks, TZ, DAY);
  assert.deepEqual(moments.map((m) => m.id), ["a", "b", "c"], "01:30 is the end of the night; other days left out");
  assert.equal(moments[0].atMs - moments[0].startMs, 5 * 60_000);
  assert.equal(before, moments[0].startMs - 30 * 60_000);
  // 16:00 La Paz is 20:00 UTC.
  assert.equal(new Date(moments[0].startMs).toISOString(), "2027-05-22T20:00:00.000Z");
  const short = PC.previewMoments([{ id: "s", day: DAY, starts_at: "16:00", ends_at: "16:04", title: "Entrada" }], TZ, DAY).moments[0];
  assert.equal(short.atMs - short.startMs, 2 * 60_000);
  assert.deepEqual(PC.previewMoments(blocks, TZ, "2030-01-01").moments, []);
});

t("the engine at a preview instant: Now, minutes left, Next", () => {
  const at = PC.previewMoments(blocks, TZ, DAY).moments[0].atMs;
  const s = L.liveState(blocks.filter((b) => b.day === DAY), { now: at, timeZone: TZ });
  assert.equal(s.items.find((i) => i.state === "now")?.block.id, "a");
  assert.equal(s.items.find((i) => i.state === "next")?.block.id, "b");
});

t("store: one wedding at a time, real time keeps running, end and reset clear it", () => {
  PC.endPreview();
  assert.equal(PC.previewNow("demo-review", 1_000), null);
  const v0 = PC.previewVersion();
  PC.startPreview("demo-review", 5_000_000, 1_000);
  assert.ok(PC.previewVersion() > v0);
  assert.equal(PC.previewNow("demo-review", 1_000), 5_000_000);
  assert.equal(PC.previewNow("demo-review", 61_000), 5_060_000);
  assert.equal(PC.previewNow("demo-review", 500), 5_000_000, "never runs backwards");
  assert.equal(PC.previewNow("other-wedding", 61_000), null);
  assert.equal(PC.previewActive("demo-review"), true);
  PC.endPreview();
  assert.equal(PC.previewActive("demo-review"), false);
  assert.ok(src("src/features/dayof/PreviewDay.tsx").includes("registerScopedReset(endPreview)"), "sign-out and wedding switch end it");
});

t("static: live screens pass their slug; preview marks send nothing; copy EN/ES", () => {
  assert.ok(src("src/features/dayof/ServerLive.tsx").includes("useNow(offset, slug)"));
  assert.ok(src("src/features/dayof/LiveDay.tsx").includes("useNow(entry?.offsetMs ?? 0, slug)"));
  const sl = src("src/features/dayof/ServerLive.tsx");
  const mark = sl.slice(sl.indexOf("async function mark("), sl.indexOf("async function mark(") + 600);
  assert.ok(mark.indexOf("if (preview)") < mark.indexOf("await post("), "ServerLive: preview returns before any request");
  const ld = src("src/features/dayof/LiveDay.tsx");
  const set = ld.slice(ld.indexOf("async function setStatus("), ld.indexOf("async function setStatus(") + 2400);
  assert.ok(set.indexOf("if (previewOn)") < set.indexOf("sendBlockStatus"), "LiveDay: preview returns before the outbox");
  for (const k of ["previewOpen", "previewTitle", "previewIntro", "previewBanner", "previewBannerBody", "previewExit", "previewMarked", "previewBefore"] as const) {
    assert.ok(DAYOF_COPY.en[k] && DAYOF_COPY.es[k], k);
    for (const l of ["en", "es"] as const) assert.ok(!/[–—!]/.test(DAYOF_COPY[l][k]), `${l}.${k}`);
  }
  // In a preview the banner gives the time: no real "Updated" time beside it on either live screen.
  assert.ok(/\{preview \? null : \(\s*<T[^>]*>\s*\{fmt\(c\.updated/.test(sl), "ServerLive: Updated hidden in a preview");
  assert.ok(ld.includes("previewOn ? null : fmt(c.updated"), "LiveDay: Updated hidden in a preview");
  // Never persisted: the store has no storage import.
  assert.ok(!/AsyncStorage|SecureStore/.test(src("src/features/dayof/previewClock.ts")));
});

console.log(`preview-clock: ${n} checks passed`);

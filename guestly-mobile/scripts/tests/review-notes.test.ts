// Run: node --experimental-strip-types scripts/tests/review-notes.test.ts
// 1.4.0 App Review notes and privacy (store/metadata.json, store/REVIEW-NOTES-1.4.0.md,
// app.config.ts privacyManifests): the notes say what the binary does (the
// 5.1.2(i) permission screen, Preview the day only on demo weddings, no rating
// prompt while nothing imports expo-store-review). No mic in
// 1.4.0 (Nicolas, Nov 6, c-mic): the notes, the What's new text and the label
// say nothing about a mic, voice or AssemblyAI, the 1.3 "No audio" line is
// back, no Audio Data anywhere, and the review file carries the notes word for
// word.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (p: string) => readFileSync(path.join(here, "../..", p), "utf8");
const meta = JSON.parse(src("store/metadata.json")) as { review_notes_en: string; whats_new: { en: string; es: string }; app_privacy: { collected: { type: string; linked: boolean; purpose: string; who: string }[] } };
const notes = meta.review_notes_en;
const md = src("store/REVIEW-NOTES-1.4.0.md");
const cfg = src("app.config.ts");

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

// Words that would describe a mic or voice feature, EN and ES.
const MIC_WORDS = /\bmic\b|microphone|micr[oó]fono|voice|\bvoz\b|AssemblyAI|speech|recording|grabaci[oó]n|dictat|audio data/i;

t("no mic in 1.4.0: notes, What's new and the label say nothing about one", () => {
  assert.ok(!MIC_WORDS.test(notes), `review notes: ${MIC_WORDS.exec(notes)?.[0]}`);
  assert.ok(/CAMERA: [^\n]*No audio or video is recorded\./.test(notes), "the 1.3 camera line is back");
  for (const lang of ["en", "es"] as const) {
    const w = meta.whats_new[lang];
    assert.ok(w.length > 80, `whats_new ${lang}`);
    assert.ok(!MIC_WORDS.test(w), `whats_new ${lang}: ${MIC_WORDS.exec(w)?.[0]}`);
    assert.ok(!/!/.test(w), `whats_new ${lang}: no '!'`);
  }
  assert.ok(/^Your wedding day, live:/.test(meta.whats_new.en), "the launch kit draft Nicolas approved (a-notes)");
  for (const c of meta.app_privacy.collected) assert.ok(!MIC_WORDS.test(`${c.type} ${c.who}`), `label: ${c.type}`);
  assert.ok(!/AudioData/.test(cfg), "no NSPrivacyCollectedDataTypeAudioData in the manifest");
  assert.ok(md.includes(meta.whats_new.en) && md.includes(meta.whats_new.es), "the review file repeats What's new");
});

t("notes name the AI providers and the 5.1.2(i) permission screen", () => {
  assert.ok(/Anthropic \(Claude API\)/.test(notes));
  assert.ok(/5\.1\.2\(i\)/.test(notes));
  assert.ok(/"Not now" sends nothing/.test(notes));
});

t("notes point reviewers at Preview the day, demo weddings only", () => {
  assert.ok(/Preview the day/.test(notes));
  assert.ok(/only on demo weddings/.test(notes));
  assert.ok(/Nothing done in the preview is saved/.test(notes));
});

t("label and manifest: Product Interaction for guest app opens (K21, #37), linked, no tracking", () => {
  const pi = meta.app_privacy.collected.find((c) => c.type === "Usage Data: Product Interaction");
  assert.ok(pi && pi.linked && pi.purpose === "App Functionality", "the label lists the guest app opens");
  const i = cfg.indexOf('"NSPrivacyCollectedDataTypeProductInteraction"');
  assert.ok(i > 0, "the privacy manifest lists Product Interaction");
  const block = cfg.slice(i, i + 400);
  assert.ok(block.includes("NSPrivacyCollectedDataTypeLinked: true") && block.includes("NSPrivacyCollectedDataTypeTracking: false") && block.includes("PurposeAppFunctionality"));
  const notCollected = (meta.app_privacy as unknown as { not_collected: string[] }).not_collected.join(" | ");
  assert.ok(!/^Analytics/m.test(notCollected.replace(/ \| /g, "\n")), "no 'Analytics' line that contradicts the opens");
  assert.ok(/Product Interaction/.test(md), "the review file says to add it by hand");
});

t("the purpose string and the notes agree; the review file carries the notes word for word", () => {
  const purpose = /const MICROPHONE_PURPOSE = "([^"]+)"/.exec(cfg)![1];
  assert.ok(md.includes(purpose));
  assert.ok(md.includes(notes), "REVIEW-NOTES-1.4.0.md repeats review_notes_en exactly");
});

// The notes may describe Apple's rating prompt only when the binary can show it:
// some file under src imports expo-store-review (#20 card, not built in 1.4.0).
const srcFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? srcFiles(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
const RATING_WORDS = /SKStoreReviewController|StoreReview|rating prompt|RATINGS:|requestReview/i;

t("notes mention a rating prompt only if the app calls expo-store-review", () => {
  const ships = srcFiles(path.join(here, "../../src")).some((f) => /from\s+["']expo-store-review["']|require\(\s*["']expo-store-review["']\s*\)/.test(readFileSync(f, "utf8")));
  const reviewPart = md.slice(0, md.indexOf("## Open before submit"));
  assert.ok(reviewPart.length > 0 && md.includes("## Open before submit"), "the review file keeps its Open before submit section");
  if (!ships) {
    assert.ok(!RATING_WORDS.test(notes), `review notes describe a rating prompt the build lacks: ${RATING_WORDS.exec(notes)?.[0]}`);
    assert.ok(!RATING_WORDS.test(reviewPart), `review file describes a rating prompt the build lacks: ${RATING_WORDS.exec(reviewPart)?.[0]}`);
  }
});

// Each 1.4 feature the notes or What's new name, the words that name it, and
// the flag the portal sends it behind. "Open before submit" must list every
// flag, or App Review's wedding (an off row like any client) shows none of it.
const FLAGGED: readonly [RegExp, string][] = [
  [/Now and Next|wedding day, live/i, "MW_LIVE_DAY"],
  [/no signal|without signal/i, "MW_DAY_PACK"],
  [/Run N actions|COORDINATOR PLANS/, "MW_PLAN_CARD"],
  [/timeline lock|Locked timeline/i, "MW_RUNSHEET_LOCK"],
  [/places with/i, "MW_PLACES"],
  [/hair and makeup/i, "MW_HMU"],
  [/final guest count/i, "MW_FINAL_COUNT"],
  [/travel times/i, "MW_TRAVEL_WINDOWS"],
  [/know-before-you-go/i, "MW_KNOW_BEFORE"],
  [/"Seen"/, "MW_SEEN"],
  [/road[- ]to[- ]the[- ]wedding|road to the wedding/i, "MW_ROAD"],
];

t("Open before submit lists the flag of every feature the notes and What's new name", () => {
  const open = md.slice(md.indexOf("## Open before submit"), md.indexOf("## review_notes_en"));
  assert.ok(open.length > 0);
  const said = `${notes}\n${meta.whats_new.en}`;
  for (const [words, flag] of FLAGGED) {
    if (!words.test(said)) continue;
    assert.ok(new RegExp(`^\\s*- ${flag}:`, "m").test(open), `${flag} (for ${words}) missing from Open before submit`);
  }
  assert.ok(/review wedding/.test(open) && /production/.test(open), "on for the review wedding and in production");
  // Every flag the app reads for a 1.4 screen is in the table above (MW_REVIEW_ASK: card not built).
  const used = new Set(srcFiles(path.join(here, "../../src")).flatMap((f) => readFileSync(f, "utf8").match(/\bMW_[A-Z_]+\b/g) ?? []));
  const known = new Set([...FLAGGED.map(([, f]) => f), "MW_REVIEW_ASK", "MW_KEY", "MW_LIVE_PREVIEW_LOCAL"]);
  for (const f of used) assert.ok(known.has(f), `new flag ${f}: add it to FLAGGED and to Open before submit`);
});

t("copy rules: brand hyphenated, no dashes", () => {
  for (const [name, text] of [["notes", notes], ["md", md]] as const) {
    assert.ok(!/[–—]/.test(text), name);
    assert.ok(!/Guestly|Guest ly/.test(text.replace(/guestly-mobile|com\.zcventures\.guestly/g, "")), `${name}: brand`);
  }
});

console.log(`review-notes: ${n} checks passed`);

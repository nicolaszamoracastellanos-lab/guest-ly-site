// Run: node --experimental-strip-types scripts/tests/review-notes.test.ts
// 1.4.0 App Review notes and privacy (store/metadata.json, store/REVIEW-NOTES-1.4.0.md,
// app.config.ts privacyManifests): the notes say what the binary does (mic,
// AssemblyAI, the 5.1.2(i) permission screen, Preview the day only on demo
// weddings), the old "No audio" claim is gone, Audio Data is on the label and
// in the manifest, and the review file carries the notes word for word.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (p: string) => readFileSync(path.join(here, "../..", p), "utf8");
const meta = JSON.parse(src("store/metadata.json")) as { review_notes_en: string; app_privacy: { collected: { type: string; linked: boolean; purpose: string }[] } };
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

t("notes describe the mic truthfully", () => {
  assert.ok(!/No audio or video is recorded/.test(notes), "the 1.3 claim is false with the mic");
  assert.ok(/MICROPHONE: only when a couple or planner taps the mic button in the Coordinator/.test(notes));
  assert.ok(/AssemblyAI/.test(notes) && /deleted as soon as the text is ready/.test(notes));
  assert.ok(/no background audio/.test(notes));
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

t("label and manifest: Audio Data, linked, app functionality, no tracking", () => {
  const audio = meta.app_privacy.collected.find((c) => c.type === "User Content: Audio Data");
  assert.ok(audio && audio.linked && audio.purpose === "App Functionality");
  const block = cfg.slice(cfg.indexOf('"NSPrivacyCollectedDataTypeAudioData"'), cfg.indexOf('"NSPrivacyCollectedDataTypeAudioData"') + 400);
  assert.ok(block.includes("NSPrivacyCollectedDataTypeLinked: true") && block.includes("NSPrivacyCollectedDataTypeTracking: false") && block.includes("PurposeAppFunctionality"));
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

t("copy rules: brand hyphenated, no dashes", () => {
  for (const [name, text] of [["notes", notes], ["md", md]] as const) {
    assert.ok(!/[–—]/.test(text), name);
    assert.ok(!/Guestly|Guest ly/.test(text.replace(/guestly-mobile|com\.zcventures\.guestly/g, "")), `${name}: brand`);
  }
});

console.log(`review-notes: ${n} checks passed`);

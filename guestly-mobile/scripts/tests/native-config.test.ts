// Run: node --experimental-strip-types scripts/tests/native-config.test.ts
// Native config guard (Master Wave L8 step 1, Nov 5 2026). The 1.4.0 binary is
// the only native build this wave, so the native set it carries is pinned here:
// expo-store-review is installed and used by the #20 review card (Apple's
// rating sheet once per install), the build 36 crash pin stays exact, the
// microphone string is the same in the config and both locale files, and
// nothing adds background audio. No mic in 1.4.0 (Nicolas, Nov 6, c-mic):
// expo-audio is removed (batch 3, Nov 7: package, lockfile and plugin), no
// source file imports it, the microphone string says the app does not record,
// and Android RECORD_AUDIO is blocked.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import makeConfig from "../../app.config.ts";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json"));
const deps: Record<string, string> = pkg.dependencies;

// Modules for this wave.
assert.ok(deps["expo-store-review"], "expo-store-review is installed (#20 rating sheet)");
assert.ok(deps["expo-asset"], "expo-asset is installed directly (also a dependency of expo itself)");
assert.equal(deps["expo-av"], undefined, "expo-av left the SDK");
// Batch 3: expo-audio is gone from the native set (unused since the mic left 1.4.0).
assert.equal(deps["expo-audio"], undefined, "expo-audio is not a dependency");
const lock = JSON.parse(read("package-lock.json"));
assert.equal(lock.packages?.["node_modules/expo-audio"], undefined, "expo-audio is not in the lockfile");
assert.equal(lock.packages?.[""]?.dependencies?.["expo-audio"], undefined, "nor in the lockfile's root dependencies");

// Build 36 launch crash: expo-contacts ships a prebuilt xcframework tied to the
// ExpoModulesCore it was built against. Exact pin only; move it together with
// expo and only after scripts/check-prebuilt-symbols.mjs passes.
assert.match(deps["expo-contacts"], /^\d+\.\d+\.\d+$/, "expo-contacts stays pinned exactly");

// Every Expo package on one SDK.
for (const [name, range] of Object.entries(deps)) {
  if (name === "expo" || name.startsWith("expo-") || name === "@expo/ui") {
    assert.match(range, /^[~]?58\./, `${name} is on SDK 58 (${range})`);
  }
}

const config = makeConfig({ config: {} } as never);
const plist = config.ios?.infoPlist ?? {};
const mic = plist.NSMicrophoneUsageDescription as string;
const en = JSON.parse(read("locales/en.json")).ios;
const es = JSON.parse(read("locales/es.json")).ios;

// No mic button in 1.4.0: the string stays only because the camera library
// links the audio capture API (ITMS-90683), and it says the app does not record.
assert.equal(en.NSMicrophoneUsageDescription, mic, "en.json matches app.config.ts");
assert.match(mic, /^Guest-ly does not record audio\./);
assert.match(es.NSMicrophoneUsageDescription, /^Guest-ly no graba audio\./);
assert.doesNotMatch(`${mic} ${es.NSMicrophoneUsageDescription}`, /Coordinat|Coordinador|mic button|botón del micrófono/, "no mic button is claimed");

// No recording code reachable: nothing under src/ or app/ imports expo-audio.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(t|j)sx?$/.test(f) ? [p] : [];
  });
const importers = walk(path.join(root, "src")).filter((f) => /["']expo-audio(\/[^"']*)?["']/.test(readFileSync(f, "utf8")));
assert.deepEqual(importers, [], "no source file imports expo-audio");
for (const gone of ["src/features/assistant/voice.tsx", "src/features/assistant/voiceCore.ts"]) {
  assert.throws(() => statSync(path.join(root, gone)), `${gone} is removed`);
}
const manifest = JSON.stringify(config.ios?.privacyManifests ?? {});
assert.doesNotMatch(manifest, /AudioData/, "no Audio Data in the privacy manifest");
for (const [lang, strings] of [["en", en], ["es", es]] as const) {
  for (const [key, text] of Object.entries(strings as Record<string, string>)) {
    assert.doesNotMatch(text, /[–—!]/, `${lang} ${key}: no dashes or exclamation marks`);
    assert.match(text, /Guest-ly/, `${lang} ${key}: brand with the hyphen`);
    assert.ok(text.length <= 200, `${lang} ${key}: short enough for the system alert`);
  }
  assert.deepEqual(Object.keys(strings).sort(), Object.keys(en).sort(), `${lang}: same keys as en`);
}

// No background audio, and no plugin for a package that is not installed.
assert.equal(plist.UIBackgroundModes, undefined, "no UIBackgroundModes in Info.plist");
const audio = (config.plugins ?? []).find((p) => (Array.isArray(p) ? p[0] : p) === "expo-audio");
assert.equal(audio, undefined, "no expo-audio plugin");
// The #20 card really calls the rating module (so the review notes may name it).
const reviewers = walk(path.join(root, "src")).filter((f) => /from\s+["']expo-store-review["']/.test(readFileSync(f, "utf8")));
assert.deepEqual(reviewers.map((f) => path.relative(root, f)), ["src/features/couple/storeReview.ts"], "one place asks for Apple's rating sheet");

// Android: the app never records, so RECORD_AUDIO is blocked; contacts stay blocked.
const blocked = config.android?.blockedPermissions ?? [];
assert.ok(blocked.includes("android.permission.RECORD_AUDIO"), "RECORD_AUDIO blocked");
assert.ok(blocked.includes("android.permission.READ_CONTACTS"));

console.log("native-config: ok");

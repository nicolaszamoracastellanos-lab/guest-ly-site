// Run: node --experimental-strip-types scripts/tests/native-config.test.ts
// Native config guard (Master Wave L8 step 1, Nov 5 2026). The 1.4.0 binary is
// the only native build this wave, so the native set it carries is pinned here:
// the rating module (#20) and the recording module (D5 mic) are present, the
// build 36 crash pin stays exact, the microphone string is the same in the
// config and both locale files, and nothing adds background audio.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import makeConfig from "../../app.config.ts";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json"));
const deps: Record<string, string> = pkg.dependencies;

// Modules for this wave.
assert.ok(deps["expo-store-review"], "expo-store-review (#20 rating prompt) is a dependency");
assert.ok(deps["expo-audio"], "expo-audio (D5 mic) is a dependency");
assert.ok(deps["expo-asset"], "expo-asset is installed directly (peer of expo-audio)");
assert.equal(deps["expo-av"], undefined, "expo-av left the SDK; expo-audio replaces it");

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

// The microphone string tells the truth about the mic button, in both languages.
assert.equal(en.NSMicrophoneUsageDescription, mic, "en.json matches app.config.ts");
assert.match(mic, /Coordinator/);
assert.match(es.NSMicrophoneUsageDescription, /Coordinador/);
assert.doesNotMatch(mic, /does not record/, "old 'does not record' text is gone");
for (const [lang, strings] of [["en", en], ["es", es]] as const) {
  for (const [key, text] of Object.entries(strings as Record<string, string>)) {
    assert.doesNotMatch(text, /[–—!]/, `${lang} ${key}: no dashes or exclamation marks`);
    assert.match(text, /Guest-ly/, `${lang} ${key}: brand with the hyphen`);
    assert.ok(text.length <= 200, `${lang} ${key}: short enough for the system alert`);
  }
  assert.deepEqual(Object.keys(strings).sort(), Object.keys(en).sort(), `${lang}: same keys as en`);
}

// No background audio: the expo-audio plugin turns it on by default.
assert.equal(plist.UIBackgroundModes, undefined, "no UIBackgroundModes in Info.plist");
const audio = (config.plugins ?? []).find((p) => Array.isArray(p) && p[0] === "expo-audio") as [string, Record<string, unknown>] | undefined;
assert.ok(audio, "expo-audio plugin is configured explicitly");
assert.equal(audio[1].enableBackgroundPlayback, false);
assert.equal(audio[1].enableBackgroundRecording, false);
assert.equal(audio[1].microphonePermission, mic, "plugin uses the same microphone string");

// Android: the mic needs RECORD_AUDIO; contacts stay blocked.
const blocked = config.android?.blockedPermissions ?? [];
assert.ok(!blocked.includes("android.permission.RECORD_AUDIO"), "RECORD_AUDIO not blocked");
assert.ok(blocked.includes("android.permission.READ_CONTACTS"));

console.log("native-config: ok");

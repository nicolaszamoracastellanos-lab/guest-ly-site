// Run: node --experimental-strip-types scripts/tests/ai-consent.test.ts
// Apple 5.1.2(i) consent (src/features/aiconsent): who is asked for what, the
// stored answers, the copy (names the company, what is sent, a plain no) and
// static checks that every path that sends to an AI provider asks first.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./lib/ts-resolve.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (p: string) => readFileSync(path.join(here, "../..", p), "utf8");
const C = await import("../../src/features/aiconsent/core.ts");
const { CONSENT_COPY } = await import("../../src/features/aiconsent/copy.ts");

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

t("a new person is asked for each scope; no mic scope in 1.4.0", () => {
  const empty = C.parseConsent(null);
  assert.deepEqual(C.missingScopes(empty, "coordinator"), ["coordinator"]);
  assert.deepEqual(C.missingScopes(empty, "brief"), ["brief"]);
  assert.deepEqual([...C.CONSENT_SCOPES], ["coordinator", "brief"], "Coordinator and brief only (c-mic: no mic this wave)");
  const chat = C.withConsent(empty, ["coordinator"], "2026-11-05T15:00:00Z");
  assert.deepEqual(C.missingScopes(chat, "coordinator"), []);
  assert.deepEqual(C.missingScopes(chat, "brief"), ["brief"], "the chat's yes is not the brief's");
});

t("stored answers survive a round trip; junk and older versions ask again", () => {
  const rec = C.withConsent(C.parseConsent(null), ["coordinator", "brief"], "2026-11-05T15:00:00Z");
  const back = C.parseConsent(JSON.stringify(rec));
  assert.deepEqual(C.missingScopes(back, "brief"), []);
  // A record written by an earlier 1.4.0 dev build with a "voice" answer reads without it.
  const old = C.parseConsent(JSON.stringify({ v: C.CONSENT_VERSION, given: { coordinator: "t", voice: "t" } }));
  assert.deepEqual(Object.keys(old.given), ["coordinator"]);
  assert.deepEqual(C.missingScopes(C.parseConsent("{nope"), "coordinator"), ["coordinator"]);
  assert.deepEqual(C.missingScopes(C.parseConsent(JSON.stringify({ v: 0, given: { coordinator: "x" } })), "coordinator"), ["coordinator"]);
  assert.deepEqual(C.missingScopes(C.parseConsent(JSON.stringify({ v: C.CONSENT_VERSION, given: { coordinator: 1 } })), "coordinator"), ["coordinator"]);
});

t("taking the chat back keeps the brief", () => {
  const rec = C.withConsent(C.parseConsent(null), ["coordinator", "brief"], "t");
  const off = C.withoutConsent(rec, "coordinator");
  assert.deepEqual(C.missingScopes(off, "coordinator"), ["coordinator"]);
  assert.deepEqual(C.missingScopes(off, "brief"), []);
});

t("answers are per person and deleted on sign-out (gl.scoped. prefix)", () => {
  assert.equal(C.consentKey("u1"), "gl.scoped.aiconsent.v1:u1");
  assert.notEqual(C.consentKey("u1"), C.consentKey("u2"));
  const scope = src("src/lib/scope.ts");
  assert.ok(/PREFIXES = \[[^\]]*"gl\.scoped\."/.test(scope));
  assert.ok(src("src/features/aiconsent/ConsentGate.tsx").includes("registerScopedReset(forgetConsentMemory)"));
});

t("copy names the company, what is sent and why, with a plain no, EN and ES", () => {
  for (const lang of ["en", "es"] as const) {
    const c = CONSENT_COPY[lang];
    for (const s of C.CONSENT_SCOPES) {
      const who = c[s].who;
      const provider = C.CONSENT_PROVIDER[s].split(" ")[0];
      assert.ok(who.includes(provider), `${lang} ${s} names ${provider}`);
      assert.ok(c[s].what.length > 20 && c[s].why.length > 20);
    }
    assert.ok(c.decline && c.allow);
    const all = JSON.stringify(c);
    assert.ok(!/[–—!]/.test(all), `${lang}: no dashes, no '!'`);
    assert.ok(!/seamless|effortless|magic|mágic|successfully|con éxito/i.test(all));
    assert.ok(/Claude/.test(c.coordinator.who) && /Claude/.test(c.brief.who));
    // No mic in 1.4.0: the sheet never speaks of audio, voice or a recording.
    assert.ok(!/\bmic\b|microphone|micr[oó]fono|voice|\bvoz\b|audio|AssemblyAI|speech|record|grab/i.test(all), `${lang}: no audio words`);
  }
  assert.deepEqual(Object.keys(CONSENT_COPY.en).sort(), Object.keys(CONSENT_COPY.es).sort());
  assert.ok(!("voice" in CONSENT_COPY.en), "no voice sheet");
});

t("static: every send to the AI asks first; a no sends nothing", () => {
  const gate = src("src/features/aiconsent/ConsentGate.tsx");
  assert.ok(/if \(!missing\.length\) return true;/.test(gate));
  assert.ok(/onClose=\{\(\) => finish\(false\)\}/.test(gate), "closing the sheet is a no");
  const view = src("src/features/assistant/AssistantView.tsx");
  assert.ok(/if \(!\(await consent\.ask\("coordinator"\)\)\) return;\n\s+void Haptics/.test(view), "send asks before the draft is cleared or anything is posted");
  assert.ok(view.includes("{consent.sheet}"));
  assert.ok(!/askMic|voiceReceipt|from "\.\/voice/.test(view), "the Coordinator has no mic path");
});

console.log(`ai-consent: ${n} checks passed`);

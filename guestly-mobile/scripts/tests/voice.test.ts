// Run: node --experimental-strip-types scripts/tests/voice.test.ts
// D5 mic in the Coordinator (src/features/assistant/voiceCore.ts): when the
// mic is drawn (dark until MW_MIC and the voice route), reading the route's
// answers, the poll schedule, failures to sentences, the draft merge and the
// receipt rule (the web's), plus static checks: no background audio, the local
// file is deleted, the note is deleted on cancel and failure.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./lib/ts-resolve.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (p: string) => readFileSync(path.join(here, "../..", p), "utf8");
const V = await import("../../src/features/assistant/voiceCore.ts");
const { VOICE_COPY } = await import("../../src/features/assistant/voiceCopy.ts");

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

t("dark: the mic needs the flag, the route saying enabled, and a person who may write", () => {
  const on = V.readAvailability({ enabled: true });
  assert.equal(V.micVisible(true, on, true), true);
  assert.equal(V.micVisible(false, on, true), false, "MW_MIC off");
  assert.equal(V.micVisible(true, null, true), false, "route not answered / 404");
  assert.equal(V.micVisible(true, V.readAvailability({ enabled: false }), true), false, "no speech key");
  assert.equal(V.micVisible(true, on, false), false, "read-only role");
  assert.equal(V.micVisible(true, V.readAvailability(null), true), false);
});

t("availability: the server's limit, clamped; the portal's 180 s by default", () => {
  assert.equal(V.readAvailability({ enabled: true }).maxSeconds, 180);
  assert.equal(V.readAvailability({ enabled: true, max_seconds: 90 }).maxSeconds, 90);
  assert.equal(V.readAvailability({ enabled: true, max_seconds: 5 }).maxSeconds, 180);
  assert.equal(V.readAvailability({ enabled: true, max_seconds: 99999 }).maxSeconds, 600);
});

t("start answer: note id, https upload url or none (fake provider), audio content type", () => {
  assert.deepEqual(V.readStart({ note_id: "0b5e8c1a-3c2e-4b8f-9d1e-1234567890ab", upload_url: "http://127.0.0.1:57321/storage/v1/object/upload/sign/x?token=1", content_type: "audio/mp4" }), {
    noteId: "0b5e8c1a-3c2e-4b8f-9d1e-1234567890ab",
    uploadUrl: "http://127.0.0.1:57321/storage/v1/object/upload/sign/x?token=1",
    contentType: "audio/mp4",
  });
  assert.equal(V.readStart({ note_id: "0b5e8c1a-3c2e-4b8f-9d1e-1234567890ab", upload_url: null })!.uploadUrl, null);
  assert.equal(V.readStart({ note_id: "0b5e8c1a-3c2e-4b8f-9d1e-1234567890ab", upload_url: "javascript:alert(1)" })!.uploadUrl, null);
  assert.equal(V.readStart({ note_id: "../../etc" }), null);
  assert.equal(V.readStart({ note_id: "0b5e8c1a-3c2e-4b8f-9d1e-1234567890ab", content_type: "text/html" })!.contentType, "audio/mp4");
});

t("poll answers: processing, completed with text and receipt, anything else unreadable", () => {
  assert.deepEqual(V.readPoll({ status: "processing", retrying: true }), { status: "processing" });
  assert.deepEqual(V.readPoll({ status: "completed", text: "  agrega  a Ana\n ", receipt: "r" }), { status: "completed", text: "agrega a Ana", receipt: "r" });
  assert.equal(V.readPoll({ status: "completed", text: "   ", receipt: "r" }), null);
  assert.equal(V.readPoll({ status: "completed", text: "hola" }), null, "no receipt, no text");
  assert.equal(V.readPoll({ status: "weird" }), null);
});

t("poll schedule: 1 s, 1.5 s, then 2.5 s; gives up at 90 s", () => {
  assert.deepEqual([0, 1, 2, 9].map(V.pollDelay), [1000, 1500, 2500, 2500]);
  assert.equal(V.pollGivesUp(0, 89_999), false);
  assert.equal(V.pollGivesUp(0, 90_000), true);
});

t("failures map to the portal's VoiceCode and a sentence in both languages", () => {
  assert.equal(V.voiceFailure(404, "not_found"), "off");
  assert.equal(V.voiceFailure(403, "forbidden"), "denied");
  assert.equal(V.voiceFailure(413, "too_large"), "tooLong");
  assert.equal(V.voiceFailure(429, "rate_limited"), "rate");
  assert.equal(V.voiceFailure(408, "timeout"), "noAnswer");
  assert.equal(V.voiceFailure(0, "offline"), "offline");
  assert.equal(V.voiceFailure(500, "server_error"), "failed");
  assert.deepEqual(Object.keys(VOICE_COPY.en.fail).sort(), Object.keys(VOICE_COPY.es.fail).sort());
  for (const lang of ["en", "es"] as const) {
    const all = JSON.stringify(VOICE_COPY[lang]);
    assert.ok(!/[–—!]/.test(all), lang);
    assert.ok(/Guest-ly/.test(VOICE_COPY[lang].fail.denied));
  }
  assert.deepEqual(Object.keys(VOICE_COPY.en).sort(), Object.keys(VOICE_COPY.es).sort());
});

t("the transcript joins the draft; the receipt rides only with text in the box", () => {
  assert.equal(V.mergeDraft("", " Agrega a Ana "), "Agrega a Ana");
  assert.equal(V.mergeDraft("Hola. ", "Agrega a Ana"), "Hola. Agrega a Ana");
  assert.equal(V.mergeDraft("Hola", ""), "Hola");
  assert.equal(V.receiptToSend("Agrega a Ana", "r1"), "r1");
  assert.equal(V.receiptToSend("   ", "r1"), null);
  assert.equal(V.receiptToSend("typed", null), null);
});

t("recording names and the clock", () => {
  assert.equal(V.recordingName("file:///x/rec.m4a"), "voice-note.m4a");
  assert.equal(V.recordingName("file:///x/rec.caf"), "voice-note.m4a");
  assert.equal(V.recordingName(null), "voice-note.m4a");
  assert.equal(V.clockOf(7_400), "0:07");
  assert.equal(V.clockOf(179_999), "2:59");
});

t("static: no background audio, files deleted, notes deleted on cancel and failure, hook only when on", () => {
  const cfg = src("app.config.ts");
  assert.ok(/enableBackgroundRecording: false/.test(cfg));
  const voice = src("src/features/assistant/voice.tsx");
  assert.ok(voice.includes("allowsRecording: false"), "the audio session is released after every recording");
  assert.ok(/discardFile\(uri\)/.test(voice));
  assert.ok(/if \(noteId\) void del\(/.test(voice), "a note that was not read is deleted on the server");
  assert.ok(/if \(!mic\) return <ChatComposer/.test(voice), "the recorder hook mounts only with the mic on");
  assert.ok(/isMissingEndpoint\(err\)\) return \{ enabled: false/.test(voice), "a missing route hides the mic");
  assert.ok(/featureOn\(me, "MW_MIC"\)/.test(voice));
  const view = src("src/features/assistant/AssistantView.tsx");
  assert.ok(/voiceReceipt: receipt/.test(view) && /if \(!t\.trim\(\)\) setVoiceReceipt\(null\)/.test(view));
});

console.log(`voice: ${n} checks passed`);

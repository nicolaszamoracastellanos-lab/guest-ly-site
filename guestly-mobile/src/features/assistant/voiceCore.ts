// D5 mic in the Coordinator (1.4.0 binary, dark until MW_MIC): the pure half.
//
// The app records with expo-audio and turns the recording into text through
// the SAME server path as the web's voice notes (portal
// lib/coordinator-voice-actions.ts: start, signed upload to the private
// bucket, transcribe, poll, delete on both sides once the text is read, a
// receipt that flags the message as dictated). The web calls those as server
// actions; the app needs them as mobile routes, which the portal does not
// have yet. The routes this file reads (contract for Lane 5, also in the L8
// log), under /couple/coordinator or /planner/coordinator:
//
//   GET    /voice                 { enabled, max_seconds? }   404 while MW_MIC is off
//   POST   /voice  {filename,size} { note_id, upload_url | null, content_type }
//   POST   /voice/{id}/transcribe {lang}  {}
//   GET    /voice/{id}?lang=      { status: "processing" } | { status: "completed", text, receipt }
//   DELETE /voice/{id}            {}
//   chat POST gains voiceReceipt (pickChatBody keeps it for 1.4.0)
//
// The mic shows only when /auth/me says MW_MIC is on AND GET /voice answers
// enabled: a missing route (404), no speech key or no flag all hide it.
//
// PURE: no imports. Tests: scripts/tests/voice.test.ts.

/** The portal's cap (coordinator-voice-core VOICE_MAX_SECONDS); the server may send its own. */
export const VOICE_MAX_SECONDS_DEFAULT = 180;
/** The portal's size cap (VOICE_MAX_MB). */
export const VOICE_MAX_BYTES = 25 * 1024 * 1024;
/** How long the app waits for the text before it gives up (the recording is deleted then). */
export const VOICE_POLL_GIVE_UP_MS = 90_000;

export type VoiceAvailability = { enabled: boolean; maxSeconds: number };

export function readAvailability(data: unknown): VoiceAvailability {
  const o = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const max = typeof o.max_seconds === "number" && o.max_seconds >= 10 ? Math.min(Math.floor(o.max_seconds), 600) : VOICE_MAX_SECONDS_DEFAULT;
  return { enabled: o.enabled === true, maxSeconds: max };
}

/** The mic is drawn only with the flag on, the route answering enabled, and a person who may write. */
export function micVisible(flagOn: boolean, availability: VoiceAvailability | null, canSend: boolean): boolean {
  return flagOn && canSend && availability?.enabled === true;
}

export type VoiceStart = { noteId: string; uploadUrl: string | null; contentType: string };

export function readStart(data: unknown): VoiceStart | null {
  const o = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const id = typeof o.note_id === "string" ? o.note_id : "";
  if (!/^[0-9a-f-]{8,64}$/i.test(id)) return null;
  const url = typeof o.upload_url === "string" && /^https?:\/\//.test(o.upload_url) ? o.upload_url : null;
  const type = typeof o.content_type === "string" && o.content_type.startsWith("audio/") ? o.content_type : "audio/mp4";
  return { noteId: id, uploadUrl: url, contentType: type };
}

export type VoicePoll = { status: "processing" } | { status: "completed"; text: string; receipt: string };

export function readPoll(data: unknown): VoicePoll | null {
  const o = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  if (o.status === "processing") return { status: "processing" };
  if (o.status === "completed" && typeof o.text === "string" && typeof o.receipt === "string") {
    const text = o.text.replace(/\s+/g, " ").trim().slice(0, 4000);
    return text && o.receipt ? { status: "completed", text, receipt: o.receipt } : null;
  }
  return null;
}

/** 1 s, then 1.5 s, then every 2.5 s: a short note is back in a few seconds without hammering the route. */
export function pollDelay(attempt: number): number {
  return attempt <= 0 ? 1000 : attempt === 1 ? 1500 : 2500;
}

export function pollGivesUp(startedAt: number, now: number): boolean {
  return now - startedAt >= VOICE_POLL_GIVE_UP_MS;
}

/** What went wrong, in the words the composer shows. */
export type VoiceFailure = "off" | "denied" | "tooLong" | "rate" | "noAnswer" | "offline" | "failed" | "empty";

/** From an API failure (status, code) to the sentence kind. Mirrors the portal's VoiceCode. */
export function voiceFailure(status: number, code: string | null | undefined): VoiceFailure {
  const c = String(code ?? "");
  if (status === 404 || c === "not_found" || c === "audio_off" || c === "audioOff") return "off";
  if (status === 403 || c === "forbidden" || c === "not_allowed" || c === "notAllowed") return "denied";
  if (status === 413 || c === "too_large" || c === "audioTooLarge") return "tooLong";
  if (status === 429 || c === "rate_limited" || c === "rateLimited") return "rate";
  if (c === "timeout") return "noAnswer";
  if (status === 0 || c === "offline") return "offline";
  return "failed";
}

/** The transcript joins what is already typed, with one space, never replacing it. */
export function mergeDraft(draft: string, text: string): string {
  const a = draft.trimEnd();
  const b = text.trim();
  if (!a) return b;
  if (!b) return draft;
  return `${a} ${b}`;
}

/** "0:07", "2:59": the recording time, tabular. */
export function clockOf(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The receipt rides with the next send only while the box still holds text (the web's rule). */
export function receiptToSend(draft: string, receipt: string | null): string | null {
  return receipt && draft.trim() ? receipt : null;
}

/** m4a from the iOS HIGH_QUALITY preset; the file name the server checks the type by. */
export function recordingName(uri: string | null | undefined): string {
  const ext = /\.(m4a|aac|wav|mp4|caf|webm|ogg|3gp)$/i.exec(String(uri ?? ""))?.[1]?.toLowerCase();
  return `voice-note.${ext === "caf" || ext === "3gp" || !ext ? "m4a" : ext}`;
}

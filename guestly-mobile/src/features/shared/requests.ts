// Request helpers the couple screens share on top of lib/api.
//
// - postLong: a POST that may legitimately take longer than the default 20 s
//   (AI reads, vision, WhatsApp sends). Passes the per-call timeout api()
//   already supports.
// - postOnce: a POST that must never run twice (broadcast send, RSVP
//   reminders). The caller mints one key per send attempt (newSendKey) and
//   reuses it on every retry of that attempt, so the portal can return the
//   first result instead of messaging every guest again. The key travels in
//   the "Idempotency-Key" header and as `idempotency_key` in the JSON body
//   (the portal accepts either). A replay answers 200 with the stored result;
//   a send still running answers 409 send_in_progress.
// - errorText: the bilingual message of an API failure, or the common
//   fallback, so an alert is never blank.

import * as Crypto from "expo-crypto";
import { api, ApiFailure, get } from "@/lib/api";

/** Model and vision calls: the portal routes allow up to 60 s. */
export const AI_TIMEOUT_MS = 90_000;
/** WhatsApp sends run one engine call per language batch. */
export const SEND_TIMEOUT_MS = 180_000;
/** Photo uploads (already downscaled on the device). */
export const UPLOAD_TIMEOUT_MS = 60_000;

export function postLong<T>(path: string, body: unknown, timeoutMs: number = AI_TIMEOUT_MS): Promise<T> {
  return api<T>(path, { method: "POST", body, timeoutMs });
}

export function newSendKey(): string {
  return Crypto.randomUUID();
}

export function postOnce<T>(path: string, body: Record<string, unknown>, key: string, timeoutMs: number = SEND_TIMEOUT_MS): Promise<T> {
  return api<T>(path, {
    method: "POST",
    body: { ...body, idempotency_key: key },
    timeoutMs,
    headers: { "Idempotency-Key": key },
  });
}

/** True when the send may have gone out: the answer never came back
 *  (timeout, dropped connection) or the portal says the same send is still
 *  running (409 send_in_progress). A send in that state must not be re-armed
 *  as if it failed; the person checks the Sent list instead. */
export function outcomeUnknown(err: unknown): boolean {
  return err instanceof ApiFailure && (err.status === 0 || err.code === "offline" || err.code === "timeout" || err.code === "send_in_progress");
}

const TOO_LARGE = {
  en: "That file is too large to send. Choose a smaller one.",
  es: "Ese archivo es demasiado grande para enviarlo. Elige uno más pequeño.",
};

export function errorText(err: unknown, lang: "en" | "es", fallback: string): string {
  if (err instanceof ApiFailure) {
    // A 413 from the host arrives without the portal's JSON body.
    if (err.code === "http_413") return TOO_LARGE[lang];
    return err.messages[lang] || fallback;
  }
  return fallback;
}

/** For raw fetch/XHR calls outside lib/api (file export, the Coordinator
 *  stream): a 401 or 426 is replayed through the shared client with one cheap
 *  GET, so the app's sign-out and update handlers run exactly as for any API
 *  call. Can be swapped for a direct handler call once lib/api exports one. */
export function relayAuthStatus(status: number) {
  if (status === 401 || status === 426) void get("/auth/me").catch(() => {});
}

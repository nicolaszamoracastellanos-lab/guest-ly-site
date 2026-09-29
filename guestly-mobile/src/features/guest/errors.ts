// What a guest reads when a request fails. Known codes map to the app's own
// copy (informal tú, full sentences), so a raw machine code such as
// "(missing_answers)" or "http_502" never reaches the screen, whatever the
// server sends.

import { ApiFailure } from "@/lib/api";
import type { Copy } from "@/i18n/en";

type Lang = "en" | "es";

/** The reason behind a failed RSVP save. The portal sends it either as the
 *  error code itself or inside the sentence, "(missing_answers)". */
export function rsvpReason(err: unknown): string | null {
  if (!(err instanceof ApiFailure)) return null;
  // The portal sends error.reason (feat/app-v1.1); read it when the client keeps it.
  const reason = (err as ApiFailure & { reason?: unknown }).reason;
  if (typeof reason === "string" && reason) return reason;
  if (/^(missing_answers|invalid_answers|invalid_companions|invalid_events|invalid_party_size|invalid_notes)$/.test(err.code)) return err.code;
  const m = `${err.messages.en} ${err.message}`.match(/\(([a-z_]+)\)/);
  return m ? m[1] : null;
}

/** A sentence for any failure on the guest side. */
export function guestErrorText(err: unknown, copy: Copy, lang: Lang): string {
  if (!(err instanceof ApiFailure)) return copy.common.error;
  switch (err.code) {
    case "offline":
      return copy.common.offlineRetry;
    case "rate_limited":
      return copy.common.rateLimited;
    case "invalid_code":
      return copy.invite.wrong;
    case "too_many_matches":
      return copy.find.moreLetters;
    case "not_live":
    case "tenant_unavailable":
      return copy.invite.notLive;
    case "engine_unavailable":
      return copy.concierge.unavailable;
  }
  const reason = rsvpReason(err);
  if (reason === "missing_answers") return copy.rsvp.requiredMissing;
  if (reason === "invalid_answers") return copy.rsvp.errAnswers;
  // Server sentences are full bilingual sentences for 4xx; anything that still
  // carries a code in brackets, or any 5xx, reads as the shared copy.
  const text = err.messages[lang];
  const clean = !!text && err.status > 0 && err.status < 500 && !/\([a-z_]+\)|http_\d+/.test(text);
  if (reason) return clean ? text : copy.rsvp.errSave;
  return clean ? text : copy.common.error;
}

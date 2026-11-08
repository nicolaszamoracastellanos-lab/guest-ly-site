// An error toast in two halves: what failed, then what to do (quality bar
// section 4, rule 5). The screen names the failure in its own words ("Publish
// failed. Nothing changed for your guests."); the second half comes from the
// failure itself:
//  - the phone was offline when it tried (offline, and the device says it has
//    no connection): nothing was sent, so check the connection and try again
//    (the api's own offline sentence promises a retry, which a one-off action
//    like publishing never does);
//  - no answer came back (a timeout, or a dropped connection while the device
//    is online): the request may have reached the server and done its work.
//    A write then must not say it failed, or the person taps again and adds a
//    second guest or sends a second message (quality bar 5.4). The whole toast
//    is UNKNOWN instead: we did not hear back, check before trying again. A
//    read (`read: true`) is safe to repeat and keeps the network sentence;
//  - the host refused the upload as too large (413): choose a smaller file;
//  - the server refused with a sentence of its own: that sentence;
//  - anything else, or the server's generic "Something went wrong": try again.
// Pure (no imports) so the tests run it under node. Callers pass an
// ApiFailure, or null for any other error: requests.ts `failedText`, which
// also passes whether the device is online.

export type FailureLike = { status: number; code: string; messages: { en: string; es: string } };

const NETWORK = {
  en: "Check your connection and try again.",
  es: "Revisa tu conexión e inténtalo de nuevo.",
};
/** No answer: the write may have gone through. Never "Could not". */
export const UNKNOWN = {
  en: "We did not hear back in time. It may have gone through, so check before you try again.",
  es: "No recibimos respuesta a tiempo. Puede que sí se haya completado, así que revisa antes de intentarlo de nuevo.",
};
const AGAIN = { en: "Try again.", es: "Inténtalo de nuevo." };
/** A 413 from the host arrives without the portal's JSON body. */
export const TOO_LARGE = {
  en: "That file is too large to send. Choose a smaller one.",
  es: "Ese archivo es demasiado grande para enviarlo. Elige uno más pequeño.",
};
const GENERIC = new Set(["Something went wrong. Please try again.", "Algo salió mal. Inténtalo de nuevo."]);

export type FailOptions = {
  /** The call only reads: repeating it is harmless, so a missing answer is
   *  still "check your connection". */
  read?: boolean;
  /** What the device reported at the moment of the failure. False: a network
   *  error means nothing left the phone. True or unknown with a timeout, or
   *  true with a network error: the answer was lost on the way back. */
  online?: boolean;
};

/** True when a write may have reached the server although no answer came. */
export function noAnswer(failure: FailureLike | null, opts: FailOptions = {}): boolean {
  if (!failure || opts.read) return false;
  if (failure.code === "timeout") return true;
  return failure.code === "offline" && opts.online === true;
}

export function failText(what: string, failure: FailureLike | null, lang: "en" | "es", opts: FailOptions = {}): string {
  if (noAnswer(failure, opts)) return UNKNOWN[lang];
  return `${what.trim()} ${failReason(failure, lang)}`;
}

function failReason(failure: FailureLike | null, lang: "en" | "es"): string {
  if (!failure) return AGAIN[lang];
  if (failure.code === "offline" || failure.code === "timeout") return NETWORK[lang];
  if (failure.code === "http_413") return TOO_LARGE[lang];
  const said = failure.messages[lang]?.trim();
  if (!said || GENERIC.has(said)) return AGAIN[lang];
  return said;
}

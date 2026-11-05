// An error toast in two halves: what failed, then what to do (quality bar
// section 4, rule 5). The screen names the failure in its own words ("Publish
// failed. Nothing changed for your guests."); the second half comes from the
// failure itself:
//  - the request never reached the server (offline, timeout): check the
//    connection and try again (the api's own offline sentence promises a
//    retry, which a one-off action like publishing never does);
//  - the server refused with a sentence of its own: that sentence;
//  - anything else, or the server's generic "Something went wrong": try again.
// Pure (no imports) so the tests run it under node. Callers pass an
// ApiFailure, or null for any other error: requests.ts `failedText`.

export type FailureLike = { status: number; code: string; messages: { en: string; es: string } };

const NETWORK = {
  en: "Check your connection and try again.",
  es: "Revisa tu conexión e inténtalo de nuevo.",
};
const AGAIN = { en: "Try again.", es: "Inténtalo de nuevo." };
const GENERIC = new Set(["Something went wrong. Please try again.", "Algo salió mal. Inténtalo de nuevo."]);

export function failText(what: string, failure: FailureLike | null, lang: "en" | "es"): string {
  return `${what.trim()} ${failReason(failure, lang)}`;
}

function failReason(failure: FailureLike | null, lang: "en" | "es"): string {
  if (!failure) return AGAIN[lang];
  if (failure.status === 0 || failure.code === "offline" || failure.code === "timeout") return NETWORK[lang];
  const said = failure.messages[lang]?.trim();
  if (!said || GENERIC.has(said)) return AGAIN[lang];
  return said;
}

// Apple guideline 5.1.2(i) (Nov 2025 text): before personal data goes to a
// third-party AI, the app says who receives it and what is sent, and asks.
// This is the pure half: which kinds of sharing exist, who receives each, and
// how a person's answers are stored on the phone.
//
//   coordinator  the couple's Coordinator and the planner assistant (#5): the
//                person's messages and the wedding details the chat reads go
//                to Anthropic (Claude API) to write each reply.
//   brief        the planner's pre-meeting brief (#32): the recap is written by
//                Anthropic from the wedding's figures. Reading the brief itself
//                calls no model, so only "Write the recap" asks.
//   voice        the Coordinator's mic (D5): the recording goes to AssemblyAI
//                to become text; the text then goes to the chat like typed
//                words (so the coordinator answer is needed as well).
//
// Answers are per person (the signed-in user id), under the gl.scoped. prefix:
// sign-out deletes them through resetUserScopedState, so the next person on
// the phone is asked for themselves. A wedding switch keeps them.
// CONSENT_VERSION goes up when a provider or what is sent changes: everyone is
// asked again before the next use.
//
// PURE: no imports. Tests: scripts/tests/ai-consent.test.ts.

export type ConsentScope = "coordinator" | "brief" | "voice";
export const CONSENT_SCOPES: readonly ConsentScope[] = ["coordinator", "brief", "voice"];
export const CONSENT_VERSION = 1;

/** Who receives the data, named as Apple asks (the company and its service). */
export const CONSENT_PROVIDER: Record<ConsentScope, string> = {
  coordinator: "Anthropic (Claude)",
  brief: "Anthropic (Claude)",
  voice: "AssemblyAI",
};

/** Scopes that must be answered yes before `scope` may run (the mic feeds the chat). */
export function requiredScopes(scope: ConsentScope): ConsentScope[] {
  return scope === "voice" ? ["coordinator", "voice"] : [scope];
}

export type ConsentRecord = { v: number; given: Partial<Record<ConsentScope, string>> };

export function consentKey(userId: string): string {
  return `gl.scoped.aiconsent.v1:${userId}`;
}

/** A stored record, or an empty one for anything unreadable or from an older version. */
export function parseConsent(raw: string | null | undefined): ConsentRecord {
  if (!raw) return { v: CONSENT_VERSION, given: {} };
  try {
    const o = JSON.parse(raw) as { v?: unknown; given?: unknown };
    if (o.v !== CONSENT_VERSION || !o.given || typeof o.given !== "object") return { v: CONSENT_VERSION, given: {} };
    const given: ConsentRecord["given"] = {};
    for (const s of CONSENT_SCOPES) {
      const at = (o.given as Record<string, unknown>)[s];
      if (typeof at === "string" && at) given[s] = at;
    }
    return { v: CONSENT_VERSION, given };
  } catch {
    return { v: CONSENT_VERSION, given: {} };
  }
}

/** The scopes still to ask before `scope` runs, in the order they are asked. */
export function missingScopes(record: ConsentRecord, scope: ConsentScope): ConsentScope[] {
  return requiredScopes(scope).filter((s) => !record.given[s]);
}

export function withConsent(record: ConsentRecord, scopes: readonly ConsentScope[], at: string): ConsentRecord {
  const given = { ...record.given };
  for (const s of scopes) given[s] = at;
  return { v: CONSENT_VERSION, given };
}

export function withoutConsent(record: ConsentRecord, scope: ConsentScope): ConsentRecord {
  const given = { ...record.given };
  delete given[scope];
  // The mic feeds the chat: taking the chat back takes the mic back too.
  if (scope === "coordinator") delete given.voice;
  return { v: CONSENT_VERSION, given };
}

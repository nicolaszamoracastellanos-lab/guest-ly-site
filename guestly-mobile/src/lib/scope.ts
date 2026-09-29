// Everything on this phone that belongs to one signed-in person (a guest of
// one wedding, or a couple or planner account) and must never be seen by the
// next one: the query cache (memory and disk), drafts, chat history, the
// offline check-in queue, the biometric and day-of switches.
//
// resetUserScopedState() is the one reset. The session runs it on sign out,
// when the guest identity changes, and when a 401 ends a session. Feature
// modules that keep state outside react-query register their own reset with
// registerScopedReset(); guest-only storage uses scopedStorageKey() so two
// guests on one phone never share a key even before a reset runs.
//
// Kept on purpose: the chosen language, the assistant bubble's position and
// the welcome-tour completion marks (per person already, see features/tour).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearQueryCache } from "@/lib/query";
import { clearQueue } from "@/lib/queue";

/** Exact keys removed by the reset. */
const KEYS = [
  "gl.biometric",
  "gl.dayof.manual",
  "gl.me",
  "gl.push.prefs",
  "budget-selected",
];
/** Key prefixes removed by the reset (drafts, chat history, scoped keys). */
const PREFIXES = ["gl.concierge.", "gl.rsvp.", "gl.draft.", "gl.scoped."];

type Reset = () => void | Promise<void>;
const resets = new Set<Reset>();

/** Registers a reset for state kept outside react-query and AsyncStorage
 *  (module-level drafts). Returns the unregister function. */
export function registerScopedReset(fn: Reset): () => void {
  resets.add(fn);
  return () => {
    resets.delete(fn);
  };
}

let storageScope = "anon";

/** Set by the session: "guest:{slug}:{guestId}" or "user:{userId}:{slug}". */
export function setStorageScope(scope: string | null) {
  storageScope = scope ?? "anon";
}

/** A storage key that belongs to the person signed in now, e.g.
 *  scopedStorageKey("gl.concierge.history"). Removed by the reset too. */
export function scopedStorageKey(base: string): string {
  return `${base}:${storageScope}`;
}

/** Runs only the registered resets (a wedding switch keeps the person), and
 *  always the module-level drafts (brain editor, seating plan, website
 *  builder), which live outside react-query. Imported on demand: the drafts
 *  import the API client, which imports the session, which imports this file,
 *  so a static import would be a require cycle. */
export async function runScopedResets() {
  try {
    const { resetTenantDrafts } = await import("@/features/shared/tenantScope");
    resetTenantDrafts();
  } catch {
    // the other resets still run
  }
  for (const fn of Array.from(resets)) {
    try {
      await fn();
    } catch {
      // one broken reset must not stop the others
    }
  }
}

/**
 * Clears everything that belongs to the person signed in now. Safe to call
 * twice. It does not touch the session's own keys (guest token, tenant
 * preference, push token): the session removes those itself, after it has
 * unregistered the push token with the old credential.
 */
export async function resetUserScopedState(): Promise<void> {
  await clearQueryCache();
  await clearQueue().catch(() => {});
  try {
    const all = await AsyncStorage.getAllKeys();
    const doomed = all.filter((k) => KEYS.includes(k) || PREFIXES.some((p) => k.startsWith(p)));
    if (doomed.length) await AsyncStorage.multiRemove(doomed);
  } catch {
    // best effort: the next reset tries again
  }
  await runScopedResets();
  storageScope = "anon";
}

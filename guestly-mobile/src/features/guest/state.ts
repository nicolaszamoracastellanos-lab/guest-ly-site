// Small per-guest state kept on the phone (build 12):
//  - the newest couple reply the guest has seen in Ask (gold dot on the tab)
//  - the half-done RSVP (draft), so Home can say "almost ready"
//  - "Not now" on the notification ask of the confirmation
//
// Keys go through scopedStorageKey with prefixes that the sign-out reset
// removes (lib/scope), so the next person on this phone never sees them.
// Reads are synchronous after the first load (useSyncExternalStore), so the
// tab bar dot and the Home card change the moment a screen writes.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useSyncExternalStore } from "react";
import { registerScopedReset, scopedStorageKey } from "@/lib/scope";
import { useGuestSession } from "@/lib/session";

const mem = new Map<string, string | null>();
const loading = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
function load(key: string) {
  if (mem.has(key) || loading.has(key)) return;
  loading.add(key);
  AsyncStorage.getItem(key)
    .then((v) => {
      // A write that landed first wins over the stored value.
      if (!mem.has(key)) {
        mem.set(key, v);
        emit();
      }
    })
    .catch(() => {
      if (!mem.has(key)) {
        mem.set(key, null);
        emit();
      }
    })
    .finally(() => loading.delete(key));
}

registerScopedReset(() => {
  mem.clear();
  loading.clear();
  emit();
});

/** undefined while loading, null when nothing is stored. */
function useStored(key: string | null): string | null | undefined {
  useEffect(() => {
    if (key) load(key);
  }, [key]);
  return useSyncExternalStore(
    subscribe,
    () => (key ? (mem.has(key) ? mem.get(key)! : undefined) : null),
    () => null
  );
}

function write(key: string, value: string | null) {
  mem.set(key, value);
  emit();
  (value === null ? AsyncStorage.removeItem(key) : AsyncStorage.setItem(key, value)).catch(() => {});
}

/** One key per guest of one wedding. The scope string makes two guests on
 *  one phone distinct even before a reset runs. */
function useGuestKey(base: string): string | null {
  const session = useGuestSession();
  if (!session) return null;
  // scopedStorageKey adds the session scope ("guest:{slug}:{id}") as well.
  return `${scopedStorageKey(base)}:${session.tenant.slug}:${session.guest.id}`;
}

// ---------------------------------------------------------------- Ask: seen

/** ISO time of the newest couple reply the guest has had on screen. */
export function useAskSeen(): { seen: string | null | undefined; markSeen: (iso: string) => void } {
  const key = useGuestKey("gl.scoped.guestAskSeen");
  const seen = useStored(key);
  return {
    seen,
    markSeen: (iso: string) => {
      if (!key) return;
      const cur = mem.get(key);
      if (cur && Date.parse(cur) >= Date.parse(iso)) return;
      write(key, iso);
    },
  };
}

// ---------------------------------------------------------------- RSVP draft

export type RsvpDraft = {
  /** The payload version it was made for (guest + existing reply time). */
  for: string;
  seats: Record<string, "attending" | "declined">[];
  answers: Record<string, string>;
  note: string;
};

export function useRsvpDraft(): { draft: RsvpDraft | null | undefined; saveDraft: (d: RsvpDraft | null) => void } {
  const key = useGuestKey("gl.rsvp.draft");
  const raw = useStored(key);
  let draft: RsvpDraft | null | undefined = raw === undefined ? undefined : null;
  if (raw) {
    try {
      const d = JSON.parse(raw) as RsvpDraft;
      draft = d && Array.isArray(d.seats) ? d : null;
    } catch {
      draft = null;
    }
  }
  return {
    draft,
    saveDraft: (d) => {
      if (!key) return;
      write(key, d ? JSON.stringify(d) : null);
    },
  };
}

// ---------------------------------------------------------------- notifications ask

/** "Not now" on the confirmation's notification ask, remembered per guest. */
export function useNotifLater(): { later: boolean; setLater: () => void } {
  const key = useGuestKey("gl.scoped.guestNotifLater");
  const v = useStored(key);
  return { later: v === "1", setLater: () => key && write(key, "1") };
}

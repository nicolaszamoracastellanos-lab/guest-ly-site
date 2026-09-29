// Biometric lock and app-switcher privacy, as a tiny store every layer can
// read without the session context (the kit's Screen and Sheet, the web view).
//
// Why covers everywhere instead of one overlay: native-stack modals and RN
// <Modal> sheets are presented above the root view, so a single overlay in the
// root layout sat BEHIND an open request thread or the wedding switcher and
// the content stayed usable (review P0-3). Each presented surface therefore
// draws its own cover while `covered` is true; the root keeps the one that
// asks for biometrics.

import { useSyncExternalStore } from "react";

export type LockSnapshot = {
  /** Biometric unlock is required before anything is shown. */
  locked: boolean;
  /** The app is not active (app switcher) and biometric unlock is on. */
  privacy: boolean;
};

let snap: LockSnapshot = { locked: false, privacy: false };
const listeners = new Set<() => void>();
let unlockHandler: (() => void) | null = null;
let signOutHandler: (() => void) | null = null;

export function setLockSnapshot(next: Partial<LockSnapshot>) {
  const merged = { ...snap, ...next };
  if (merged.locked === snap.locked && merged.privacy === snap.privacy) return;
  snap = merged;
  for (const l of Array.from(listeners)) l();
}

export function getLockSnapshot(): LockSnapshot {
  return snap;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useLockSnapshot(): LockSnapshot {
  return useSyncExternalStore(subscribe, getLockSnapshot, getLockSnapshot);
}

/** True while content must be hidden (locked, or in the app switcher). */
export function useCovered(): boolean {
  const s = useLockSnapshot();
  return s.locked || s.privacy;
}

/** The root layout registers what the cover's buttons do. */
export function setLockHandlers(h: { unlock: () => void; signOut: () => void }) {
  unlockHandler = h.unlock;
  signOutHandler = h.signOut;
}

export function requestUnlock() {
  unlockHandler?.();
}

export function requestLockSignOut() {
  signOutHandler?.();
}

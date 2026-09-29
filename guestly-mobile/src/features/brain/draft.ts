// The draft the editor works on, shared by the brain screens without prop
// drilling. Section screens change paths; the store debounces a draft save
// to the portal and tracks what the server last accepted.

import { useSyncExternalStore } from "react";
import { post } from "@/lib/api";
import type { WeddingFacts } from "./hooks";

type State = {
  facts: WeddingFacts;
  /** Facts the server last confirmed (head version). */
  saved: WeddingFacts;
  loadedVersion: number | null;
  status: "idle" | "saving" | "saved" | "error";
  error: string | null;
};

let state: State = { facts: {}, saved: {}, loadedVersion: null, status: "idle", error: null };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
const savedListeners = new Set<(version: number) => void>();
/** Bumped by resetBrainDraft so a save still in flight cannot land in the
 *  next wedding's draft. */
let generation = 0;

function emit(next: Partial<State>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

export function initDraft(facts: WeddingFacts, version: number | null) {
  // Keep unsaved local edits when the same version is re-fetched.
  if (state.loadedVersion === version && isDirty()) return;
  // Versions only grow. A cached copy older than what this draft last saved
  // must not replace it (it would show, and later save, stale facts).
  if (state.loadedVersion !== null && version !== null && version < state.loadedVersion) return;
  emit({ facts: clone(facts), saved: clone(facts), loadedVersion: version, status: "idle", error: null });
}

/** Forgets the draft: sign-out or a switch to another wedding. A pending
 *  save is cancelled so nothing is written into the next wedding. */
export function resetBrainDraft() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  generation += 1;
  emit({ facts: {}, saved: {}, loadedVersion: null, status: "idle", error: null });
}

/** Called after every accepted draft save; returns the unsubscribe. */
export function addSavedListener(fn: (version: number) => void): () => void {
  savedListeners.add(fn);
  return () => {
    savedListeners.delete(fn);
  };
}

/** True once a server draft has been loaded into the store. Edits and saves
 *  before that would post a near-empty draft over the real one. */
export function isLoaded(): boolean {
  return state.loadedVersion !== null;
}

export function isDirty(): boolean {
  return JSON.stringify(state.facts) !== JSON.stringify(state.saved);
}

export function getFacts(): WeddingFacts {
  return state.facts;
}

/** Sets a dotted path ("transportation.recommended_service.name") in the draft. */
export function setPath(path: string, value: unknown) {
  const next = clone(state.facts) as Record<string, unknown>;
  const parts = path.split(".");
  let cursor: Record<string, unknown> = next;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof cursor[k] !== "object" || cursor[k] === null) cursor[k] = {};
    cursor = cursor[k] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1];
  if (value === "" || value === undefined || value === null) delete cursor[last];
  else cursor[last] = value;
  emit({ facts: next as WeddingFacts });
  scheduleSave();
}

export function replaceFacts(facts: WeddingFacts) {
  emit({ facts: clone(facts) });
  scheduleSave();
}

function scheduleSave() {
  if (state.loadedVersion === null) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void saveNow(), 900);
}

export async function saveNow(): Promise<boolean> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (state.loadedVersion === null) return false;
  if (!isDirty()) {
    emit({ status: "idle" });
    return true;
  }
  const snapshot = clone(state.facts);
  const gen = generation;
  emit({ status: "saving", error: null });
  try {
    const r = await post<{ version: number; unchanged: boolean }>("/couple/brain/draft", { facts: snapshot });
    if (gen !== generation) return false;
    emit({ saved: snapshot, status: "saved", loadedVersion: r.version });
    for (const fn of savedListeners) fn(r.version);
    return true;
  } catch (err) {
    if (gen !== generation) return false;
    emit({ status: "error", error: err instanceof Error ? err.message : "error" });
    return false;
  }
}

export function useDraft(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state
  );
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? {})) as T;
}

/** Reads a dotted path. */
export function getPath(facts: WeddingFacts, path: string): unknown {
  let cursor: unknown = facts;
  for (const k of path.split(".")) {
    if (!cursor || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[k];
  }
  return cursor;
}

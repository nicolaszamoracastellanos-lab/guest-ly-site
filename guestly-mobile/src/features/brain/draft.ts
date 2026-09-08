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
let onSaved: ((version: number) => void) | null = null;

function emit(next: Partial<State>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

export function initDraft(facts: WeddingFacts, version: number | null) {
  // Keep unsaved local edits when the same version is re-fetched.
  if (state.loadedVersion === version && isDirty()) return;
  emit({ facts: clone(facts), saved: clone(facts), loadedVersion: version, status: "idle", error: null });
}

export function setSavedListener(fn: ((version: number) => void) | null) {
  onSaved = fn;
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
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void saveNow(), 900);
}

export async function saveNow(): Promise<boolean> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!isDirty()) {
    emit({ status: "idle" });
    return true;
  }
  const snapshot = clone(state.facts);
  emit({ status: "saving", error: null });
  try {
    const r = await post<{ version: number; unchanged: boolean }>("/couple/brain/draft", { facts: snapshot });
    emit({ saved: snapshot, status: "saved", loadedVersion: r.version });
    onSaved?.(r.version);
    return true;
  } catch (err) {
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

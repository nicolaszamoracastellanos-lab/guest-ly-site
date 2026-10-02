// Welcome tour: who sees which tour, and whether they have already seen it.
//
// The tour is an overlay drawn by <TourHost /> in the root layout, never a
// screen in the navigation stack, so a deep link or a push tap that arrives
// while it is open lands on its real screen underneath and is there when the
// tour closes.
//
// Entry points (any file may call them):
//   startTour()                              replay now (Settings rows)
//   startTour({ variant: "couple-pending" }) replay one variant now
//   startTourOnce({ variant })               show only if this person has not
//                                            finished or skipped it yet
//   router.push("/tour?variant=pending")     the same through a route
//
// Completion is remembered per tour version, variant and person (user id for
// couples and planners, wedding + guest id for guests) in AsyncStorage. Sign
// out does not clear it, so signing in again on this phone does not replay it.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

/** Bump when the content changes enough that everyone should see it again. */
// 2: build 12, new tabs per role and three cards at most.
export const TOUR_VERSION = 2;

export type TourVariant = "guest" | "couple" | "couple-pending" | "planner";

export type TourRequest = {
  /** Omitted: the variant that matches the signed-in session. */
  variant?: TourVariant;
  /** True: skip it when this person already finished or skipped it. */
  once: boolean;
  /** Set by the automatic trigger after a fresh sign-in. It waits until the
   *  person is on their home surface (past the notification step). */
  auto?: boolean;
  /** Increments per request, so the host can tell two requests apart. */
  seq: number;
};

let current: TourRequest | null = null;
let seq = 0;
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

/** Accepts the short alias "pending" from a route param. */
export function parseVariant(v: unknown): TourVariant | undefined {
  if (v === "pending") return "couple-pending";
  return v === "guest" || v === "couple" || v === "couple-pending" || v === "planner" ? v : undefined;
}

/** Show the tour now (a replay), even if it was seen before. */
export function startTour(opts?: { variant?: TourVariant }): void {
  current = { variant: opts?.variant, once: false, seq: ++seq };
  emit();
}

/** Show the tour only if this person has not finished or skipped it yet. */
export function startTourOnce(opts?: { variant?: TourVariant }): void {
  current = { variant: opts?.variant, once: true, seq: ++seq };
  emit();
}

/** Used by the root trigger after a fresh sign-in. */
export function requestAutoTour(): void {
  // A request someone made on purpose (a replay) is never replaced by the
  // automatic one.
  if (current && !current.auto) return;
  current = { once: true, auto: true, seq: ++seq };
  emit();
}

/** Drops a request (the host calls it once a request is shown or discarded). */
export function clearTourRequest(which?: number): void {
  if (!current || (which !== undefined && current.seq !== which)) return;
  current = null;
  emit();
}

export function useTourRequest(): TourRequest | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

// ---------------------------------------------------------------- on screen

// Whether the tour layer is on screen, for the root layout: the floating
// assistant bubble hides while it is, so no floating control sits under (or
// can be reached through) the tour.
let onScreen = false;
const screenListeners = new Set<() => void>();

export function setTourOnScreen(v: boolean): void {
  if (v === onScreen) return;
  onScreen = v;
  screenListeners.forEach((l) => l());
}

export function useTourOnScreen(): boolean {
  return useSyncExternalStore(
    (l) => {
      screenListeners.add(l);
      return () => {
        screenListeners.delete(l);
      };
    },
    () => onScreen,
    () => false
  );
}

// ---------------------------------------------------------------- storage

function key(variant: TourVariant, personId: string): string {
  return `gl.tour.v${TOUR_VERSION}.${variant}.${personId}`;
}

/** Never throws: storage trouble reads as "seen", so the tour cannot block. */
export async function hasSeenTour(variant: TourVariant, personId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(variant, personId))) !== null;
  } catch {
    return true;
  }
}

export async function markTourSeen(variant: TourVariant, personId: string, how: "done" | "skipped"): Promise<void> {
  try {
    await AsyncStorage.setItem(key(variant, personId), JSON.stringify({ how, at: new Date().toISOString() }));
  } catch {
    // best effort
  }
}

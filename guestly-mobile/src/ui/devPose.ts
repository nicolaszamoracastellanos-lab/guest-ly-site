// Development switch that forces the inferred pose, so the table, book and tent
// arrangements can be checked on a simulator that cannot fold. Always null in a
// normal build: only DevProbe (EXPO_PUBLIC_DUO_PROBE=1) ever sets it.

import { useSyncExternalStore } from "react";
import type { Pose } from "./layoutMath";

let override: Pose | null = null;
const subs = new Set<() => void>();

export function setDevPose(p: Pose | null) {
  override = p;
  subs.forEach((f) => f());
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

// The focused Screen's scroll, so DevProbe can scroll for screenshots (a
// simulator cannot be swiped from the command line). Set only in probe builds.
type ScrollFn = (y: number) => void;
let devScroll: ScrollFn | null = null;
export function setDevScroll(fn: ScrollFn | null) {
  devScroll = fn;
}
export function devScrollTo(y: number) {
  devScroll?.(y);
}

export function useDevPose(): Pose | null {
  return useSyncExternalStore(subscribe, () => override, () => null);
}

// Forces the hinge openness (0 closed .. 1 flat) for the effects that follow it.
let openOverride: number | null = null;
export function setDevOpenness(n: number | null) {
  openOverride = n;
  subs.forEach((f) => f());
}
export function useDevOpenness(): number | null {
  return useSyncExternalStore(subscribe, () => openOverride, () => null);
}

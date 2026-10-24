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

export function useDevPose(): Pose | null {
  return useSyncExternalStore(subscribe, () => override, () => null);
}

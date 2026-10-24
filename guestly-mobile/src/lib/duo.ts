// iPhone Duo helpers for JS: reserved regions (the fold, the cameras) and the
// effects that follow the hinge. Everything here is optional: on any other
// phone, on Android, on iOS before 27.1 and in Expo Go it reads as "no fold".
//
// Apple: hinge data is for effects and interactions; for LAYOUT use size
// classes (ui/layout) and reserved regions (here).

import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, useWindowDimensions } from "react-native";
import { useHinge } from "expo-hinge";
import * as Haptics from "expo-haptics";
import GuestlyDuo, { type NativeRegion, type NativeRegions } from "../../modules/guestly-duo/src/GuestlyDuoModule";

export type Region = { x: number; y: number; width: number; height: number; active: boolean; margins: { top: number; left: number; bottom: number; right: number } };
export type Regions = { division: Region | null; occlusions: Region[] };

const NONE: Regions = { division: null, occlusions: [] };

function toRegion(r: NativeRegion): Region {
  return { x: r.x, y: r.y, width: r.width, height: r.height, active: r.active, margins: { top: r.marginTop, left: r.marginLeft, bottom: r.marginBottom, right: r.marginRight } };
}

function sameRegion(a: Region | null, b: Region | null): boolean {
  if (!a || !b) return a === b;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height && a.active === b.active;
}

function convert(n: NativeRegions): Regions {
  return { division: n.division ? toRegion(n.division) : null, occlusions: (n.occlusions ?? []).map(toRegion) };
}

/** True when this build and this OS can report reserved regions. */
export function reservedRegionsAvailable(): boolean {
  try {
    return !!GuestlyDuo?.isAvailable();
  } catch {
    return false;
  }
}

/** The fold and camera regions of the window, in window points (the React
 *  root fills the window). Re-read whenever the window size or the hinge
 *  changes. Includes inactive regions: `division.active` says whether the
 *  fold is currently dividing the screen (half folded). */
export function useReservedRegions(): Regions {
  const { width, height } = useWindowDimensions();
  const hinge = useHinge();
  const [regions, setRegions] = useState<Regions>(NONE);
  // The hinge angle changes continuously; regions only change at status edges.
  const status = hinge?.status ?? "none";
  useEffect(() => {
    if (!GuestlyDuo || !reservedRegionsAvailable()) return;
    let alive = true;
    GuestlyDuo.getReservedRegionsAsync()
      .then((n) => {
        if (!alive) return;
        const next = convert(n);
        setRegions((prev) => (sameRegion(prev.division, next.division) && prev.occlusions.length === next.occlusions.length ? prev : next));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [width, height, status]);
  return regions;
}

/** A light tick when the Duo reaches fully open or closes (hinge effects are
 *  allowed, and encouraged, by Apple). Nothing without a hinge. */
export function useHingeHaptics() {
  const hinge = useHinge();
  const last = useRef<string | null>(null);
  useEffect(() => {
    const status = hinge?.status ?? null;
    const prev = last.current;
    last.current = status;
    if (!status || !prev || prev === status) return;
    if (status === "fullyOpen" || status === "closed") void Haptics.selectionAsync();
  }, [hinge?.status]);
}

/** True when Reduce Motion is on (effects that follow the hinge then stay still). */
export function useReduceMotion(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setOn(v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setOn);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return on;
}

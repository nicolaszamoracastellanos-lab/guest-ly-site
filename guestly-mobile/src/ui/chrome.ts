// App chrome rules shared by the kit and the root layout: where the floating
// tab bar is on screen, where the assistant bubble may rest, and how much room
// a screen keeps free at its end so neither ever covers a control.
//
// Part 9 audit (Sep 18 2026), D-003 and D-010: bottom actions sat behind the
// tab bar and the bubble rested on top of toggles, badges and buttons. The
// rule now lives in one place instead of a magic number per screen.

import { useCallback, useId, useSyncExternalStore } from "react";
import { usePathname, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BUBBLE_ZONE, TAB_BAR_BOTTOM, TAB_BAR_HEIGHT, TAB_CLEARANCE } from "./tokens";

const SURFACES = ["guest", "couple", "planner"];

/** True when the route is drawn inside one of the three tab layouts, where the
 *  floating tab bar is always on screen (pushed screens included). */
export function pathHasTabBar(pathname: string): boolean {
  const head = pathname.split("/")[1] ?? "";
  return SURFACES.includes(head);
}

// Sections where a person is typing, answering or scanning. The bubble would
// only be in the way there, and it hides on every detail and form screen
// (three or more path segments) as well.
const NO_BUBBLE_SECTIONS = ["/guest/rsvp", "/guest/concierge", "/couple/checkin", "/couple/settings"];

/** The bubble shows on the browse screens only: tab roots, the section lists
 *  behind the More menus and the guest site pages. */
export function pathShowsBubble(pathname: string): boolean {
  if (!pathHasTabBar(pathname)) return false;
  if (NO_BUBBLE_SECTIONS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return false;
  if (pathname.startsWith("/guest/site")) return true;
  return pathname.split("/").filter(Boolean).length <= 2;
}

/** Room a screen keeps free below its last control, safe area included. */
export function useBottomClearance(): { tabBar: boolean; bubble: boolean; clearance: number } {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const tabBar = pathHasTabBar(pathname);
  const bubble = pathShowsBubble(pathname);
  const clearance = insets.bottom + (tabBar ? TAB_CLEARANCE : 24) + (bubble ? BUBBLE_ZONE : 0);
  return { tabBar, bubble, clearance };
}

/** Distance from the bottom of the window to the top edge of the floating tab
 *  bar. Floating controls sit a gap above this. */
export function useTabBarTop(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + TAB_BAR_BOTTOM + TAB_BAR_HEIGHT;
}

// A screen with its own floating control above the tab bar (the add-guest
// button, a docked action bar) lifts the bubble's resting place by that much.
// Tab screens stay mounted, so the lift is tied to focus, and it is keyed so a
// blur that arrives after the next focus cannot wipe the newer value.
const lifts = new Map<string, number>();
let lift = 0;
const listeners = new Set<() => void>();
function recompute() {
  const next = lifts.size ? Math.max(...lifts.values()) : 0;
  if (next === lift) return;
  lift = next;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Read by the bubble. */
export function useBubbleLiftValue(): number {
  return useSyncExternalStore(subscribe, () => lift, () => 0);
}

/** Called by a screen that floats something above the tab bar. */
export function useBubbleLift(px: number) {
  const id = useId();
  useFocusEffect(
    useCallback(() => {
      lifts.set(id, px);
      recompute();
      return () => {
        lifts.delete(id);
        recompute();
      };
    }, [id, px])
  );
}

// A screen with its own round floating button (the add-guest button) shows no
// bubble while it is focused: two gold circles stacked at the right edge read
// as clutter and covered two rows of badges. The Coordinator stays one tap away
// in the More menu and on every other tab.
const hides = new Set<string>();
let hiddenByScreen = false;
const hideListeners = new Set<() => void>();
function recomputeHide() {
  const next = hides.size > 0;
  if (next === hiddenByScreen) return;
  hiddenByScreen = next;
  hideListeners.forEach((l) => l());
}
function subscribeHide(l: () => void) {
  hideListeners.add(l);
  return () => {
    hideListeners.delete(l);
  };
}

/** Read by the root layout. */
export function useBubbleHiddenByScreen(): boolean {
  return useSyncExternalStore(subscribeHide, () => hiddenByScreen, () => false);
}

/** Called by a screen that floats its own round button. */
export function useBubbleHide(active: boolean) {
  const id = useId();
  useFocusEffect(
    useCallback(() => {
      if (!active) return undefined;
      hides.add(id);
      recomputeHide();
      return () => {
        hides.delete(id);
        recomputeHide();
      };
    }, [id, active])
  );
}

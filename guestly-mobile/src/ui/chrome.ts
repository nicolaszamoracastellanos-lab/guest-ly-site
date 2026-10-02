// App chrome rules shared by the kit and the root layout: where the floating
// tab bar is on screen, where the floating Coordinator bubble may show, and how
// much room a screen keeps free at its end so the tab bar never covers a
// control.
//
// v1.2 (Oct 2026, audit I9 and I11): the bubble is now an AssistiveTouch style
// button that the person drags anywhere and that never rests half off screen.
// The band every screen used to reserve for it, the per-screen lift, the hide
// on screens with their own round button, the collision check on the homes and
// the dock into the gutter while a list scrolled are gone. The three hooks
// screens still call (useBubbleLift, useBubbleHide, useBubbleAvoid) are kept
// as no-ops for one release so nothing breaks while their call sites go away.

import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_HEIGHT, TAB_CLEARANCE, tabBarOffset } from "./tokens";

const SURFACES = ["guest", "couple", "planner"];

/** True when the route is drawn inside one of the three tab layouts, where the
 *  floating tab bar is always on screen (pushed screens included). */
export function pathHasTabBar(pathname: string): boolean {
  const head = pathname.split("/")[1] ?? "";
  return SURFACES.includes(head);
}

/** The chat screens the bubble opens: it never shows on top of its own chat. */
const BUBBLE_TARGETS = ["/guest/concierge", "/assistant"];

/** The bubble shows on every screen inside the three surfaces (guest, couple,
 *  planner), except on the chat it opens. Settings, the web view and the
 *  entrance screens have none. */
export function pathShowsBubble(pathname: string): boolean {
  if (!pathHasTabBar(pathname)) return false;
  return !BUBBLE_TARGETS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Room a screen keeps free below its last control, safe area included. Only
 *  the tab bar counts now: the bubble floats and moves, it reserves nothing. */
export function useBottomClearance(): { tabBar: boolean; clearance: number } {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const tabBar = pathHasTabBar(pathname);
  // v1.2: the bar sits in the home indicator strip (tabBarOffset), so the
  // clearance is measured from the bar itself, not from the safe area.
  const clearance = tabBar ? tabBarOffset(insets.bottom) + TAB_BAR_HEIGHT + TAB_CLEARANCE : insets.bottom + 24;
  return { tabBar, clearance };
}

/** Distance from the bottom of the window to the top edge of the floating tab
 *  bar. Floating controls sit a gap above this. */
export function useTabBarTop(): number {
  const insets = useSafeAreaInsets();
  return tabBarOffset(insets.bottom) + TAB_BAR_HEIGHT;
}

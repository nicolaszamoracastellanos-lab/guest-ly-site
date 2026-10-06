// The floating glass tab bar (Direction A). Used as expo-router's custom
// tabBar so every root tab shares it.
//
// Dynamic Type (Part 9 audit, D-031): the bar has a fixed height and up to five
// slots, so its labels do not scale with the system text size, the same way
// the system tab bar behaves. Each tab has a full accessibility label, and a
// long Spanish label shrinks a little instead of running into its neighbour.
// On wide windows the bar is a centered 520 pt pill, not a full-width strip.
//
// v1.2 (audit N3, N26):
// - A section that is not a tab itself (Tasks, Budget, Day-of... declared with
//   `href: null`) lights the tab it belongs to: the spec whose `owns` lists it,
//   else the fallback tab (More). Before, no tab was lit inside them and
//   people lost their place.
// - Tapping a tab you are not on opens it at its first screen (its list), not
//   at a screen another tab pushed into it earlier. Tapping the tab you are on
//   pops it to its list (the stack does that on tabPress).
//
// Build 12 (plan v1.2 b, c; prototype):
// - Each role layout declares its own tab list with `RoleTabs` (or passes
//   specs to GlassTabBar). The list is registered with lib/nav so the safe back
//   of an owned section returns to its tab.
// - 12 pt labels (were 10), a soft gold pill behind the lit tab, 24 pt icons.
// - The bar sits in the home indicator strip (tabBarOffset), 36 pt lower than
//   build 11 on a phone with a home indicator, and goes solid with Reduce
//   Transparency.
// - `resetKey`: when it changes (a planner switching weddings, F1), every tab
//   pops back to its first screen, so no detail of the previous wedding stays
//   in any tab.
// - A tab badge can be a count or a dot.
//
// Build 13 (couple Broadcast and Tools tabs, planner Tools):
// - A label fits on one line, shrinking to 80% at most (70% on a window under
//   360 pt). Only a long label of several words ("Guest Messages") takes two
//   centered lines at 11 pt instead, so no word is ever cut.
// - The couple has no More tab any more: its fallback tab is Tools.
//
// Tabs' tabBar prop is a render function that the navigator CALLS (it is not
// mounted as a component), so hooks cannot live in that function. RoleTabs
// passes `(props) => <GlassTabBar {...props} ... />` and this component owns
// the hooks.

import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, View, Pressable, StyleSheet, Text, useWindowDimensions } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs, usePathname } from "expo-router";
import * as Haptics from "expo-haptics";
import { Icon, type IconName } from "./Icon";
import { useCovered } from "@/lib/lock";
import { registerTabs } from "@/lib/nav";
import { useCopy } from "@/i18n";
import { colors, fonts, TAB_BAR_HEIGHT, TAB_BAR_MAX_WIDTH, FILL, tabBarOffset } from "./tokens";

type TabsProps = React.ComponentProps<typeof Tabs>;
type TabBarFn = NonNullable<TabsProps["tabBar"]>;
type BottomTabBarProps = Parameters<TabBarFn>[0];

export type TabSpec = {
  /** Route name of the tab in its Tabs ("index" for the surface home). */
  name: string;
  icon: IconName;
  label: string;
  /** A count (capped at 99) or a dot. 0, null and undefined show nothing. */
  badge?: number | "dot" | null;
  /** Hidden routes (route names in the same Tabs) that light this tab while
   *  open, and that its safe back returns to. Hidden routes no spec owns light
   *  the fallback tab ("more"). */
  owns?: string[];
};

/** A route declared in the Tabs but not shown as a tab (`href: null`). A plain
 *  name pops to its first screen when left (popToTopOnBlur), so its detail
 *  screens never linger mounted with the last record's state. */
export type HiddenRoute = string | { name: string; popToTopOnBlur?: boolean };

type NestedState = { key?: string; index?: number; type?: string; routes?: { name: string }[]; routeNames?: string[] };

/** Back to a tab stack's list. A record pushed into a stack that had never
 *  mounted can be that stack's only screen ([new], [[id]]): popping to the top
 *  does nothing there, so the stack is reset to its "index" instead (review
 *  fix, build 12). Returns true when it dispatched. */
export function resetStackToRoot(dispatch: (a: { type: string; target?: string; payload?: object }) => void, nested: NestedState | undefined): boolean {
  if (!nested?.key || nested.type !== "stack") return false;
  const first = nested.routes?.[0]?.name;
  if (first && first !== "index" && nested.routeNames?.includes("index")) {
    dispatch({ type: "RESET", target: nested.key, payload: { index: 0, routes: [{ name: "index" }] } });
    return true;
  }
  if ((nested.index ?? 0) > 0) {
    dispatch({ type: "POP_TO_TOP", target: nested.key });
    return true;
  }
  return false;
}

type TabRoute = { key: string; name: string; state?: unknown };
type TabNav = { getState: () => { key: string; index: number; routes: TabRoute[] }; dispatch: (a: { type: string; target?: string; payload?: object }) => void };

/** The last path shown in each tab bar tab (by route key). A tab stack that
 *  was first mounted by a push from another tab ([[id]], [new]) keeps that
 *  first state to itself: react-navigation only writes a nested state into
 *  the tab's route once it changes, so `route.state` is empty and nothing
 *  above can see or pop it (seen on the sims). The path it last showed tells
 *  whether a record is sitting there. */
const lastPaths = new Map<string, string>();
const depth = (path: string) => path.split("/").filter(Boolean).length;

/** Sends tab bar tabs back to their lists: the one with `only`, or every one
 *  but `skip`. A stack whose state the tab can see goes through
 *  resetStackToRoot; a tab whose own stack never reported a state but last
 *  showed a record (".../messages/{id}") gets its stack reset to "index". */
export function resetTabs(nav: TabNav, opts: { only?: string; skip?: string; tabs: ReadonlySet<string> }) {
  const st = nav.getState();
  const nested: NestedState[] = [];
  let changed = false;
  const routes = st.routes.map((r) => {
    if ((opts.only && r.key !== opts.only) || r.key === opts.skip || !opts.tabs.has(r.name)) return r;
    if (r.state) {
      nested.push(r.state as NestedState);
      return r;
    }
    const p = lastPaths.get(r.key);
    if (!p || depth(p) < 3) return r;
    lastPaths.delete(r.key);
    changed = true;
    return { ...r, state: { routes: [{ name: "index" }] } };
  });
  if (changed) nav.dispatch({ type: "RESET", target: st.key, payload: { ...st, routes } });
  for (const n of nested) resetStackToRoot((a) => nav.dispatch(a), n);
}

/** Which spec is lit for the focused route. */
function litSpecName(routeName: string, specs: TabSpec[], fallback: string): string | null {
  if (specs.some((s) => s.name === routeName)) return routeName;
  const owner = specs.find((s) => s.owns?.includes(routeName));
  if (owner) return owner.name;
  return specs.some((s) => s.name === fallback) ? fallback : null;
}

/** Two centered lines only for a long label of several words (build 13). */
export function tabLabelLines(label: string): 1 | 2 {
  const t = label.trim();
  return t.length > 10 && /\s/.test(t) ? 2 : 1;
}

/** Solid bar with Reduce Transparency (plan v1.2 c). */
function useReduceTransparency(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((v) => alive && setOn(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setOn);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return on;
}

export function GlassTabBar({
  state,
  navigation,
  specs,
  fallback = "more",
  resetKey,
}: BottomTabBarProps & {
  specs: TabSpec[];
  /** Tab lit inside hidden routes no spec owns. Default "more". */
  fallback?: string;
  /** When this changes (the wedding), every tab except the focused one goes
   *  back to its list. The focused one is left alone: a notification for
   *  another wedding switches first and then opens its screen there. */
  resetKey?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const covered = useCovered();
  const common = useCopy().common;
  const solid = useReduceTransparency();
  const pathname = usePathname();
  const surface = pathname.split("/")[1] ?? "";
  const { width } = useWindowDimensions();
  const minScale = width < 360 ? 0.7 : 0.8;

  // The safe back of an owned section returns to its tab (lib/nav).
  const specKey = specs.map((s) => `${s.name}:${(s.owns ?? []).join(",")}`).join("|");
  useEffect(() => {
    registerTabs(surface, specs, fallback);
    // specKey stands for the specs' names and owners; labels do not matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, specKey, fallback]);

  // The path each tab bar tab shows (see resetTabs).
  const tabNames = React.useMemo(() => new Set(specs.map((s) => s.name)), [specKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const focusedRoute = state.routes[state.index];
  useEffect(() => {
    if (!focusedRoute) return;
    const seg = pathname.split("/").filter(Boolean);
    if (seg[1] === focusedRoute.name || (focusedRoute.name === "index" && seg.length === 1)) lastPaths.set(focusedRoute.key, pathname);
  }, [pathname, focusedRoute]);

  // Wedding switch (F1): every other tab back to its root.
  const latestState = useRef(state);
  useEffect(() => {
    latestState.current = state;
  });
  const lastReset = useRef(resetKey);
  useEffect(() => {
    const prev = lastReset.current;
    lastReset.current = resetKey;
    if (resetKey == null || prev == null || prev === resetKey) return;
    const st = latestState.current;
    resetTabs(navigation as unknown as TabNav, { skip: st.routes[st.index]?.key, tabs: tabNames });
  }, [resetKey, navigation, tabNames]);

  const bottom = tabBarOffset(Math.max(insets.bottom, 0));
  // The bar floats above the screens, so it would sit on top of their lock
  // cover (with its badge counts): it steps aside while the app is covered.
  if (covered) return null;
  const litName = litSpecName(state.routes[state.index]?.name ?? "", specs, fallback);
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <View style={styles.bar}>
        {solid ? null : <BlurView intensity={45} tint="dark" style={FILL} blurMethod="dimezisBlurView" />}
        <View style={[styles.fill, solid && styles.fillSolid]} />
        {state.routes.map((route, index) => {
          const spec = specs.find((s) => s.name === route.name);
          if (!spec) return null;
          const focused = state.index === index;
          // Lit: this tab, or the tab the open hidden section belongs to.
          const lit = focused || litName === route.name;
          const color = lit ? colors.goldLight : colors.ivory70;
          const count = typeof spec.badge === "number" && spec.badge > 0 ? spec.badge : 0;
          const dot = spec.badge === "dot";
          return (
            <Pressable
              key={route.key}
              testID={`tab-${route.name}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: lit }}
              // A dot (RSVP pending, an unread reply) is not color alone.
              accessibilityLabel={count ? `${spec.label}, ${count}` : dot ? `${spec.label}, ${common.newItem}` : spec.label}
              onPress={() => {
                void Haptics.selectionAsync();
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (focused || event.defaultPrevented) return;
                // Back to the tab's own list: a screen pushed into it from
                // another tab (Guests to RSVP questions) does not linger.
                resetTabs(navigation as unknown as TabNav, { only: route.key, tabs: tabNames });
                navigation.navigate(route.name);
              }}
              style={[styles.tab, lit && styles.tabLit]}
            >
              <View>
                <Icon name={spec.icon} size={24} color={color} />
                {count ? (
                  <View style={styles.badge}>
                    <Text allowFontScaling={false} style={styles.badgeText}>
                      {count > 99 ? "99" : count}
                    </Text>
                  </View>
                ) : dot ? (
                  <View style={styles.dot} />
                ) : null}
              </View>
              {tabLabelLines(spec.label) === 2 ? (
                <Text allowFontScaling={false} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={minScale} style={[styles.label, styles.label2, { color }]}>
                  {spec.label}
                </Text>
              ) : (
                <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={minScale} style={[styles.label, { color }]}>
                  {spec.label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * A role's tab layout in one declaration (build 12). Each role lists its own
 * tabs; every other route of the folder is declared hidden.
 *
 *   <RoleTabs
 *     specs={[
 *       { name: "index", icon: "home", label: c.home },
 *       { name: "guests", icon: "guests", label: c.guests },
 *       { name: "messages", icon: "chat", label: c.messages, badge: unread },
 *       { name: "broadcasts", icon: "megaphone", label: c.broadcast },
 *       { name: "tools", icon: "grid", label: c.tools, owns: ["budget", "tasks", "seating", "runsheet"] },
 *     ]}
 *     fallback="tools"
 *     hidden={["dayof", "checkin", "budget", "tasks", "seating", "runsheet", "settings"]}
 *   />
 *
 * Back means the screen the person came from (backBehavior "history"). Pass
 * `resetKey` (the session's tenantKey) to send every other tab back to its
 * root when the wedding changes.
 */
export function RoleTabs({ specs, hidden = [], fallback = "more", resetKey }: { specs: TabSpec[]; hidden?: HiddenRoute[]; fallback?: string; resetKey?: string | null }) {
  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) => <GlassTabBar {...props} specs={specs} fallback={fallback} resetKey={resetKey} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.night },
        lazy: true,
      }}
    >
      {specs.map((s) => (
        <Tabs.Screen key={s.name} name={s.name} />
      ))}
      {hidden.map((h) => {
        const name = typeof h === "string" ? h : h.name;
        const pop = typeof h === "string" ? true : h.popToTopOnBlur ?? true;
        return <Tabs.Screen key={name} name={name} options={{ href: null, popToTopOnBlur: pop }} />;
      })}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 10, right: 10, alignItems: "center" },
  bar: {
    width: "100%",
    maxWidth: TAB_BAR_MAX_WIDTH,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "stretch",
    padding: 5,
    borderWidth: 1,
    borderColor: "rgba(247,243,236,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  fill: {
    ...{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    backgroundColor: "rgba(13,17,23,0.82)",
  },
  fillSolid: { backgroundColor: colors.night },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: 26,
    paddingHorizontal: 2,
  },
  tabLit: { backgroundColor: colors.goldWash },
  label: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 14, letterSpacing: 0.1, alignSelf: "stretch", textAlign: "center" },
  // Two lines in the same 52 pt: 24 icon + 2 gap + 2 x 12.
  label2: { fontSize: 11, lineHeight: 12, letterSpacing: 0 },
  badge: {
    position: "absolute",
    top: -5,
    left: 15,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: colors.night,
  },
  badgeText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    lineHeight: 13,
    color: colors.ink,
  },
  dot: { position: "absolute", top: -1, right: -5, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.night },
});

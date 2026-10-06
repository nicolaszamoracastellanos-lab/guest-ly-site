// Safe back. A screen opened by a cold deep link or a push tap is the first
// entry in history, so router.back() does nothing and the back control is
// dead (Part 9 audit, D-022). useSafeBack goes back when it can, and otherwise
// replaces the route with the screen's parent.
//
// Parent rule when no explicit fallback is passed:
//   /couple/tasks/abc      -> /couple/tasks      (the section list)
//   /couple/settings/x     -> /couple/tools      (that section has no index)
//   /couple/tasks          -> /couple/tools      (sections hang off Tools)
//   /guest/rsvp, tab roots -> the surface home
//   /settings, /assistant, /web, entrance screens -> the home of the session
//
// The tab layouts use backBehavior="history", so inside a surface "back" means
// the screen the person came from, not the first tab.
//
// Build 12: each role layout declares its own tabs (RoleTabs / GlassTabBar in
// the kit), and the tab bar registers them here. A registered surface uses its
// own tab roots, and a section a tab `owns` (Budget under Plan, Day-of under
// the guest's Invitation) goes back to that tab instead of More. Until a
// layout registers, the build 11 table below applies.
//
// Build 13: the couple's tabs are Home, Guests, Messages, Broadcast and Tools
// (no More: Tools is the couple's fallback); the planner's Wedding tab is
// Tools.

import { useCallback } from "react";
import { useNavigation, usePathname, useRouter, type Href } from "expo-router";
import { useSession } from "@/lib/session";

const SURFACES = ["guest", "couple", "planner"];
const TAB_ROOTS: Record<string, string[]> = {
  // Build 12 tabs (used only until the layout registers). Sections a tab
  // owns that hang off the home (rsvp, dayof) are listed so they return home.
  guest: ["rsvp", "dayof", "schedule", "concierge", "more"],
  couple: ["guests", "rsvps", "messages", "broadcasts", "tools"],
  planner: ["requests", "guests", "tools", "more"],
};
/** The tab that owns unlisted sections before a layout registers. */
const FALLBACK: Record<string, string> = { guest: "more", couple: "tools", planner: "more" };
const NO_INDEX = ["settings"];

type Registered = { roots: string[]; owners: Record<string, string>; fallback: string };
const registered: Record<string, Registered> = {};

/** Called by the tab bar with the layout's tab list. `name` is the route of
 *  each tab ("index" is the surface home); `owns` lists hidden sections that
 *  belong to that tab; `fallback` is the tab that owns the rest ("more"). */
export function registerTabs(surface: string, specs: { name: string; owns?: string[] }[], fallback = "more") {
  if (!SURFACES.includes(surface)) return;
  const owners: Record<string, string> = {};
  for (const spec of specs) for (const o of spec.owns ?? []) owners[o] = spec.name;
  registered[surface] = { roots: specs.map((s) => s.name).filter((n) => n !== "index"), owners, fallback };
}

/** The route of a tab: the surface home for "index". */
function tabPath(surface: string, tab: string): string {
  return tab === "index" ? `/${surface}` : `/${surface}/${tab}`;
}

export function parentOf(pathname: string, home: string): string {
  const seg = pathname.split("/").filter(Boolean);
  const surface = seg[0] ?? "";
  if (!SURFACES.includes(surface)) return home;
  const reg = registered[surface];
  const ownerOf = (section: string) => (reg ? reg.owners[section] ?? reg.fallback : FALLBACK[surface] ?? "more");
  if (seg.length >= 3) return NO_INDEX.includes(seg[1]) ? tabPath(surface, ownerOf(seg[1])) : `/${surface}/${seg[1]}`;
  if (seg.length === 2) return (reg ? reg.roots : TAB_ROOTS[surface]).includes(seg[1]) ? `/${surface}` : tabPath(surface, ownerOf(seg[1]));
  return home;
}

export function useSafeBack(fallback?: string): () => void {
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useSession();
  const home = state.status === "guest" ? "/guest" : state.status === "user" ? (state.me.surface === "planner" ? "/planner" : "/couple") : "/";
  const navigation = useNavigation();
  return useCallback(() => {
    // A record pushed into another tab's stack (a request opened from a guest
    // row, a thread opened from a guest card) can be that stack's only
    // screen: the lazy tab never mounted its list. Back follows the tab
    // history to where the person came from, and the stack it leaves gets
    // its list back, so the tab never reopens on the abandoned screen
    // (seen on the sims).
    const st = navigation.getState?.() as { key?: string; type?: string; routes?: { name: string }[]; routeNames?: string[] } | undefined;
    const solo = !!st?.key && st.type === "stack" && st.routes?.length === 1 && st.routes[0].name !== "index" && !!st.routeNames?.includes("index");
    if (router.canGoBack()) {
      router.back();
      if (solo) setTimeout(() => navigation.dispatch({ type: "REPLACE", payload: { name: "index" }, target: st!.key } as never), 0);
    } else router.replace((fallback ?? parentOf(pathname, home)) as Href);
  }, [router, navigation, pathname, home, fallback]);
}

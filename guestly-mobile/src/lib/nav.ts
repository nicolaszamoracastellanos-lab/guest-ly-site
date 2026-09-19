// Safe back. A screen opened by a cold deep link or a push tap is the first
// entry in history, so router.back() does nothing and the back control is
// dead (Part 9 audit, D-022). useSafeBack goes back when it can, and otherwise
// replaces the route with the screen's parent.
//
// Parent rule when no explicit fallback is passed:
//   /couple/tasks/abc      -> /couple/tasks      (the section list)
//   /couple/settings/x     -> /couple/more       (that section has no index)
//   /couple/tasks          -> /couple/more       (sections hang off the More menu)
//   /guest/rsvp, tab roots -> the surface home
//   /settings, /assistant, /web, entrance screens -> the home of the session
//
// The tab layouts use backBehavior="history", so inside a surface "back" means
// the screen the person came from, not the first tab.

import { useCallback } from "react";
import { usePathname, useRouter, type Href } from "expo-router";
import { useSession } from "@/lib/session";

const SURFACES = ["guest", "couple", "planner"];
const TAB_ROOTS: Record<string, string[]> = {
  guest: ["rsvp", "schedule", "concierge", "more"],
  couple: ["guests", "rsvps", "messages", "more"],
  planner: ["guests", "requests", "budget", "more"],
};
const NO_INDEX = ["settings"];

export function parentOf(pathname: string, home: string): string {
  const seg = pathname.split("/").filter(Boolean);
  const surface = seg[0] ?? "";
  if (!SURFACES.includes(surface)) return home;
  if (seg.length >= 3) return NO_INDEX.includes(seg[1]) ? `/${surface}/more` : `/${surface}/${seg[1]}`;
  if (seg.length === 2) return TAB_ROOTS[surface].includes(seg[1]) ? `/${surface}` : `/${surface}/more`;
  return home;
}

export function useSafeBack(fallback?: string): () => void {
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useSession();
  const home = state.status === "guest" ? "/guest" : state.status === "user" ? (state.me.surface === "planner" ? "/planner" : "/couple") : "/";
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace((fallback ?? parentOf(pathname, home)) as Href);
  }, [router, pathname, home, fallback]);
}

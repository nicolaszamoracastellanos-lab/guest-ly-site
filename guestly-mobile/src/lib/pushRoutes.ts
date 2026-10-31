// Where a tapped push lands, and the push preference keys per surface. Pure
// (no React Native imports): scripts/tests/push-routes.test.ts runs it under
// plain node. lib/push re-exports everything here.

export type Surface = "guest" | "couple" | "planner";

/** The push preference keys each surface registers (POST /{surface}/push
 *  prefs). HH wave F adds couple album and team, guest album and pass; the
 *  portal ignores a key it does not send yet. */
export const PUSH_KEYS: Record<Surface, readonly string[]> = {
  guest: ["dayof", "replies", "rsvp_reminder", "album", "pass"],
  couple: ["rsvps", "escalations", "tasks", "album", "team"],
  planner: ["approvals", "tasks"],
};

// Screens that exist in each surface. A push route is used as is only when
// its first segment is one of these; anything else (a web-only page, a typo)
// lands on the surface home instead of the "Unmatched route" page.
// Build 13: the couple's Plan and More are Tools, the planner's Wedding is
// Tools. The old names stay valid (their routes redirect) and are rewritten
// to Tools here, so a push never lands on a redirect.
// HH wave F: couple album and thankyou, guest album and pass ("pass" has no
// screen of its own: the wallet button sits on the invitation, the guest home).
const SECTIONS: Record<Surface, string[]> = {
  guest: ["rsvp", "schedule", "concierge", "messages", "dayof", "more", "site", "album", "pass"],
  couple: ["guests", "rsvps", "messages", "broadcasts", "tools", "plan", "more", "requests", "tasks", "budget", "vendors", "seating", "runsheet", "brain", "insights", "website", "dayof", "checkin", "settings", "album", "thankyou"],
  planner: ["guests", "requests", "tasks", "tools", "wedding", "budget", "vendors", "seating", "runsheet", "broadcasts", "more"],
};
// An alias of "" means the surface home.
const SECTION_ALIASES: Record<Surface, Record<string, string>> = {
  guest: { pass: "" },
  couple: { plan: "tools", more: "tools" },
  planner: { wedding: "tools" },
};

// Web bell hrefs (root-relative, one per surface) and where they live in the app.
const WEB_MAP: Record<Surface, Record<string, string>> = {
  guest: {},
  couple: {
    "/rsvps": "/couple/rsvps",
    "/guests": "/couple/guests",
    "/conversations": "/couple/messages",
    "/messages": "/couple/messages",
    "/requests": "/couple/requests",
    "/tasks": "/couple/tasks",
    "/budget": "/couple/budget",
    "/vendors": "/couple/vendors",
    "/seating": "/couple/seating",
    "/runsheet": "/couple/runsheet",
    "/broadcasts": "/couple/broadcasts",
    "/album": "/couple/album",
    "/thankyou": "/couple/thankyou",
    "/settings/team": "/couple/settings/team",
  },
  planner: {
    // Rows for audience "all" carry the couple's href; a planner opens the
    // planner twin of that screen (review P1-10).
    "/rsvps": "/planner/guests",
    "/guests": "/planner/guests",
    "/requests": "/planner/requests",
    "/tasks": "/planner/tasks",
    "/budget": "/planner/budget",
    "/vendors": "/planner/vendors",
    "/seating": "/planner/seating",
    "/runsheet": "/planner/runsheet",
    "/broadcasts": "/planner/broadcasts",
  },
};

/** Where a tapped notification should land, from its data payload and the
 *  surface of the session that is open. */
export function routeFor(data: Record<string, unknown> | undefined, surface: Surface): string {
  const home = `/${surface}`;
  // The portal says which audience a push was for. A push meant for another
  // surface than the session on this phone opens its home, never a screen
  // of the wrong surface.
  const meant = data?.surface;
  if ((meant === "guest" || meant === "couple" || meant === "planner") && meant !== surface) return home;
  const raw = typeof data?.route === "string" ? data.route.trim() : "";
  const route = raw.split(/[?#]/)[0].replace(/\/+$/, "");
  if (!route || route === home) return home;
  const seg = route.split("/").filter(Boolean);
  // An app route for this surface: only when its section exists.
  if (seg[0] === surface) {
    if (seg.length === 1) return route;
    if (!SECTIONS[surface].includes(seg[1])) return home;
    const alias = SECTION_ALIASES[surface][seg[1]];
    if (alias === "") return home;
    return alias && seg.length === 2 ? `/${surface}/${alias}` : route;
  }
  // The planner web portal lives under /planner too: /planner/requests etc.
  // For any other surface a route into a different surface goes home.
  if (seg[0] === "guest" || seg[0] === "couple" || seg[0] === "planner") return home;
  const mapped = (seg.length > 1 ? WEB_MAP[surface][`/${seg[0]}/${seg[1]}`] : undefined) ?? WEB_MAP[surface][`/${seg[0]}`];
  return mapped ?? home;
}

/** The wedding a push belongs to (the portal adds `tenant`), or null. */
export function tenantOf(data: Record<string, unknown> | undefined): string | null {
  const t = data?.tenant;
  return typeof t === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/.test(t) ? t : null;
}

// Signed-in web view bridge. The app never hands the browser its own
// tokens: it asks the portal for a one-time magic link token for the same
// user and opens /auth/mobile with it, which starts a separate browser
// session and lands on the requested page.

import { post, API_BASE } from "@/lib/api";

export type BridgeStart = { token_hash: string; url: string };

/** Origin every in-app web page must live on (the portal). */
export function portalOrigin(): string {
  return API_BASE.replace(/\/$/, "");
}

/** True when `url` is on the portal, so it is allowed inside the web view. */
export function isPortalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const o = new URL(portalOrigin());
    return u.origin === o.origin;
  } catch {
    return false;
  }
}

/** Signed-in portal pages the app may open. Everything else is refused, so a
 *  deep link can never walk the web view into the rest of the portal, where
 *  there are billing pages the app must not show (Part 9 audit, D-019). */
export const SIGNED_IN_PATHS = ["/guide", "/planner/guide"] as const;

/** A clean, allow-listed signed-in path, or null. "//host" and friends are refused. */
export function allowedSignedInPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  if (path.startsWith("//") || path.includes("\\") || path.includes("://")) return null;
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return (SIGNED_IN_PATHS as readonly string[]).includes(clean) ? clean : null;
}

/** True when `url` is a portal page under one of `prefixes` (path prefixes). */
export function isWithin(url: string, prefixes: string[]): boolean {
  if (!isPortalUrl(url)) return false;
  try {
    const path = new URL(url).pathname;
    return prefixes.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`));
  } catch {
    return false;
  }
}

/**
 * Builds the URL to load for a signed-in page at `path` (a portal path such
 * as /guide). Throws ApiFailure when the portal refuses (signed out).
 */
export async function signedInUrl(path: string): Promise<string> {
  const start = await post<BridgeStart>("/auth/bridge", {});
  const base = portalOrigin();
  const clean = path.startsWith("/") ? path : `/${path}`;
  // ?embed=1 tells the portal's own Shell/PlannerShell to drop the
  // sidebar/topbar/bottom-nav chrome for this page (D-019); no real browser
  // session ever sets it, only this bridge, only for the two allow-listed
  // guide pages.
  const next = `${clean}${clean.includes("?") ? "&" : "?"}embed=1`;
  return `${base}/auth/mobile?token_hash=${encodeURIComponent(start.token_hash)}&next=${encodeURIComponent(next)}`;
}

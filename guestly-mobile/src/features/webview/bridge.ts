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

/**
 * Builds the URL to load for a signed-in page at `path` (a portal path such
 * as /guide). Throws ApiFailure when the portal refuses (signed out).
 */
export async function signedInUrl(path: string): Promise<string> {
  const start = await post<BridgeStart>("/auth/bridge", {});
  const base = portalOrigin();
  const next = path.startsWith("/") ? path : `/${path}`;
  return `${base}/auth/mobile?token_hash=${encodeURIComponent(start.token_hash)}&next=${encodeURIComponent(next)}`;
}

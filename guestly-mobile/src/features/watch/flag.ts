// Release gate for the Apple Watch app. Pure, so the rule is tested under node.
// Off by default for everyone; `MW_WATCH` (portal release flag, same delivery as
// MW_LIVE_DAY) turns it on per wedding; never on for the protected real wedding.

import { WATCH_NEVER } from "./snapshot";

/** The release flag every watch surface waits for. */
export const WATCH_FLAG = "MW_WATCH";

export function watchEnabled(a: { flagOn: boolean; slug: string | null; force: boolean }): boolean {
  if (a.slug && WATCH_NEVER.includes(a.slug)) return false;
  return a.flagOn || a.force;
}

/* #24 Live app screens: which real portal screenshots the platform tour shows.

   Written only by `node scripts/live-screens.mjs --publish` (never by hand):
   the shots come from the released portal build with the seeded demo
   wedding, after the train that ships the features shown is live. Empty
   today, so every pane keeps its placeholder vignette and the page does not
   change. See the header of scripts/live-screens.mjs. */

import type { LiveScreensManifest } from './ui/live-screens.ts';

export const LIVE_SCREENS: LiveScreensManifest = {
  version: '',
  widths: { desktop: [440, 880], phone: [260, 520] },
  screens: {},
};

/* Where the shots came from (not used by the page, so not in the bundle). */
export const LIVE_SCREENS_SOURCE = {
  portalCommit: '',
  shotAt: '',
  features: {} as Record<string, readonly string[]>,
  held: {} as Record<string, string>,
};

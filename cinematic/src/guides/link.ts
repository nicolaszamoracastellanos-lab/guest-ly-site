/* #50: the guides link on the page (?guide=), in the initial bundle while
   GUIDES_ENABLED is on. Kept apart from ./core.ts so the catalogue and
   answer readers stay in the form's lazy chunk. */

/* Same shape as the beacon's guide id (L7p site-analytics CODE_RE), so a
   requested guide can always be counted. */
export const CODE_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

/* ?guide=<code> opens that guide's form, ?guide=all scrolls to the section
   (the expired /g page's "Request a new link"). Anything else is ignored. */
export function guideParam(search: string): string | null {
  const v = new URLSearchParams(search).get('guide');
  return v && (v === 'all' || CODE_RE.test(v)) ? v : null;
}

// "Preview the day" (Master Wave, L8 step 5): a demo-only clock that lets App
// Review (and the D2 rehearsal) see the wedding-day screens on any day. The
// live views (#3 ServerLive, #30 LiveDay) ask useNow(offset, slug) for the
// time; while a preview runs on THIS wedding they get the preview instant
// instead, moving forward in real time from the moment it was set.
//
// Never a real wedding: the control is drawn only when previewAllowed() says
// the open wedding is a demo (tenant.is_demo when the portal sends it, else
// the fixed demo slugs, mirroring portal lib/demo/constants.ts), or in a dev
// build pointed at a local portal (the portal's MW_LIVE_PREVIEW_LOCAL rule).
// The preview is memory only (never stored), belongs to one wedding slug, and
// is cleared by every scoped reset (sign-out, wedding switch). While it runs
// nothing is sent: Mark done changes only the preview.
//
// PURE except the tiny store at the bottom. Tests: scripts/tests/preview-clock.test.ts.

import { timingsFor, type LiveBlockInput } from "./live";

/** The demo weddings in production: the sales demo and the App Review wedding. */
export const PREVIEW_DEMO_SLUGS: readonly string[] = ["demo-valentina-and-mateo", "demo-review"];

const LOCAL_API = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/;

export function previewAllowed(tenant: { slug?: string | null; is_demo?: unknown } | null | undefined, env: { dev: boolean; apiBase: string }): boolean {
  if (!tenant) return false;
  if (tenant.is_demo === true) return true;
  const slug = String(tenant.slug ?? "").trim().toLowerCase();
  if (PREVIEW_DEMO_SLUGS.includes(slug)) return true;
  return env.dev && LOCAL_API.test(env.apiBase);
}

export type PreviewMoment = { id: string; title: string; startMs: number; atMs: number };

/**
 * The moments of `day` a preview can jump to: a few minutes into each one
 * (half its length when shorter than ten minutes), so Now shows that moment
 * with its minutes left. First a point 30 minutes before the first moment,
 * so "Not started yet" can be seen too.
 */
export function previewMoments<B extends LiveBlockInput & { title?: string | null }>(blocks: readonly B[], timeZone: string, day: string): { before: number | null; moments: PreviewMoment[] } {
  const t = timingsFor(
    blocks.filter((b) => b.day === day),
    timeZone
  );
  const moments = t.map((x) => {
    const into = Math.min(5 * 60_000, Math.floor((x.endMs - x.startMs) / 2));
    return { id: x.block.id, title: String(x.block.title ?? ""), startMs: x.startMs, atMs: x.startMs + Math.max(into, 60_000) };
  });
  return { before: t.length ? t[0].startMs - 30 * 60_000 : null, moments };
}

// ---------------------------------------------------------------- store

type Preview = { slug: string; atMs: number; setAt: number };
let current: Preview | null = null;
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

export function subscribePreview(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export const previewVersion = () => version;

export function startPreview(slug: string, atMs: number, realNow: number = Date.now()) {
  current = { slug, atMs, setAt: realNow };
  emit();
}

export function endPreview() {
  if (!current) return;
  current = null;
  emit();
}

/** The preview's now for this wedding, or null when no preview runs on it. */
export function previewNow(slug: string | null | undefined, realNow: number = Date.now()): number | null {
  if (!current || !slug || current.slug !== slug) return null;
  return current.atMs + Math.max(0, realNow - current.setAt);
}

export function previewActive(slug: string | null | undefined): boolean {
  return !!current && !!slug && current.slug === slug;
}

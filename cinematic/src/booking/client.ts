/* #22: the two calls to the booking API on app.guest-ly.com. Never a cookie
   (credentials omit), never a referrer, never cached. The slot read is a
   simple GET; the booking is a text/plain POST (the default for a string
   body), so neither needs a preflight. Answers come back raw ({status, body},
   or null when nothing came back); the dialog reads them with core.ts, which
   stays in its lazy chunk. Nothing here throws. */

export type Raw = { status: number; body: unknown } | null;

const ORIGIN: string = import.meta.env.VITE_GL_API_ORIGIN;
const BASE = `${ORIGIN}/api/public/booking/guestly/demo`;

export const API_ORIGIN = ORIGIN;

/* The visitor's IANA zone (the host's when the browser does not say). */
export function visitorZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/La_Paz';
  } catch {
    return 'America/La_Paz';
  }
}

export async function call(url: string, init: RequestInit): Promise<Raw> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', ...init, signal: ctrl.signal });
    return { status: res.status, body: await res.json().catch(() => null) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function getSlots(tz: string, from?: string): Promise<Raw> {
  const q = new URLSearchParams({ days: '14', tz });
  if (from) q.set('from', from);
  return call(`${BASE}/slots?${q}`, { method: 'GET' });
}

export function postBooking(body: unknown): Promise<Raw> {
  return call(`${BASE}/book`, { method: 'POST', body: JSON.stringify(body) });
}

/* Intent prefetch (pointer over, focus or touch on a booking button): the
   first list is read once and kept for a minute, so the dialog opens with
   times already there. */
let ahead: { tz: string; at: number; raw: Promise<Raw> } | null = null;

export function prefetchSlots(tz: string): void {
  const now = Date.now();
  if (!ahead || ahead.tz !== tz || now - ahead.at > 60000) ahead = { tz, at: now, raw: getSlots(tz) };
}

/* The dialog's first read: the prefetched answer when fresh, then forgotten
   so a later opening reads again. */
export function firstSlots(tz: string): Promise<Raw> {
  prefetchSlots(tz);
  const raw = ahead!.raw;
  ahead = null;
  return raw;
}

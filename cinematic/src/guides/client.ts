import { readCatalogue, readGuide } from './core';
import type { Catalogue, GuideRequest, GuideResult } from './core';

/* #50: the two calls to app.guest-ly.com. The catalogue is read when the
   section comes near the viewport; the request only when the person presses
   the button. Simple requests (a GET, a text/plain POST: no preflight), no
   cookie, no referrer. */
const BASE = `${import.meta.env.VITE_GL_API_ORIGIN}/api/public/guides`;
const INIT: RequestInit = { mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' };

async function call<T>(url: string, init: RequestInit, read: (status: number, body: unknown) => T, failed: T): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { ...INIT, ...init, signal: ctrl.signal });
    return read(res.status, await res.json().catch(() => null));
  } catch {
    return failed;
  } finally {
    clearTimeout(timer);
  }
}

export function getCatalogue(): Promise<Catalogue> {
  return call(BASE, { method: 'GET' }, readCatalogue, { kind: 'hidden' });
}

export function requestGuide(req: GuideRequest): Promise<GuideResult> {
  return call(`${BASE}/request`, { method: 'POST', body: JSON.stringify(req) }, readGuide, { kind: 'error' });
}

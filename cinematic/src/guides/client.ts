import { readGuide } from './core';
import type { GuideRequest, GuideResult } from './core';

/* #50: the one call to app.guest-ly.com, made only when the person presses
   the button. A text/plain POST (no preflight), no cookie, no referrer. */
const URL_REQUEST = `${import.meta.env.VITE_GL_API_ORIGIN}/api/public/guides/request`;

export async function requestGuide(req: GuideRequest): Promise<GuideResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(URL_REQUEST, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      body: JSON.stringify(req),
      signal: ctrl.signal,
    });
    return readGuide(res.status, await res.json().catch(() => null));
  } catch {
    return { kind: 'error' };
  } finally {
    clearTimeout(timer);
  }
}

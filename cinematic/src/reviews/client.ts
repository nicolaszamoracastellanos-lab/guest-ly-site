import { readReviews, REVIEWS_LIMIT, REVIEWS_PATH } from './core';
import type { Reviews } from './core';

/* One read, no cookie, no referrer. The answer may come from the browser
   cache (the API sends max-age=60). */
export async function loadReviews(): Promise<Reviews | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`${import.meta.env.VITE_GL_API_ORIGIN}${REVIEWS_PATH}?limit=${REVIEWS_LIMIT}`, {
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: ctrl.signal,
    });
    return readReviews(res.status, await res.json().catch(() => null));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

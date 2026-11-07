/* A local stand-in for GET /api/public/reviews on app.guest-ly.com, shaped
   exactly like L6-LOG "Reviews API for the landing" (v1, fixed 2026-11-07;
   server src/lib/feedback-core.ts publicReviews on mw/l6-money-home). Used by
   scripts/test-reviews.mjs and scripts/reviews-screens.mjs, and by
   check-origins.mjs --fixtures (answered inside the browser). TEST FIXTURES
   ONLY: fictional couples and words that never reach a built page (the
   tests prove no build carries them). Every answer: JSON, Vary Origin, the
   Origin echoed in Access-Control-Allow-Origin (as landing-cors does for the
   landing origin), and (to prove the page keeps none) a Set-Cookie. */

import { createServer } from 'node:http';

const LONG_NAME = 'María Fernanda Villavicencio and Juan Sebastián Arrieta Rojo'; // 60 characters, the API's maximum
const LONG_TEXT =
  'We were worried about the guests from abroad, but every question about hotels, the shuttle and the dress code was answered at any hour, ' +
  'in Spanish for my grandparents and in English for his friends from Chicago. Our planner saw every answer in the portal and the RSVPs ' +
  'arrived per person, with meals and allergies, so the caterer had the final count two weeks early. The day felt calm.';

/* Newest first, like the API. Ratings from 5 down to 2: no rating gate. */
export const REVIEWS = [
  { id: 'a1f3c9d2e801', rating: 5, text: 'Everything in one place, and calm on the day.', name: 'Valentina and Mateo', month: '2026-11', lang: 'es' },
  { id: 'b27e4410c9aa', rating: 4, text: 'Las preguntas de los invitados se respondían solas. Nos ahorró semanas de mensajes.', name: 'Lucía y Andrés', month: '2026-10', lang: 'es' },
  { id: 'c93d0b6f1e27', rating: 5, text: LONG_TEXT, name: LONG_NAME, month: '2026-09', lang: 'en' },
  { id: 'd4508e2a7b13', rating: 2, text: 'The website builder took us a while to figure out. The concierge itself worked well.', name: 'Hannah and Tom', month: null, lang: 'en' },
  { id: 'e6c2f9a03d58', rating: 5, text: 'Nuestra planner vio cada confirmación al momento.', name: 'Camila y Diego', month: '2026-08', lang: 'es' },
  { id: 'f80a1d7c4e96', rating: 4, text: 'Good value for a 300-guest wedding.', name: 'Priya and Sam', month: '2026-07', lang: 'en' },
];

/* What the API answers for the fixtures above: count and average are the
   server's own figures (here: 12 published, average 4.3), never derived from
   the six listed. */
export function reviewsBody(mode = 'open', { limit = 20 } = {}) {
  const take = (n) => REVIEWS.slice(0, Math.max(1, Math.min(50, limit, n)));
  switch (mode) {
    case 'open':
      return { v: 1, status: 'open', count: 12, average: 4.3, reviews: take(6) };
    case 'two':
      return { v: 1, status: 'open', count: 2, average: 3.5, reviews: [REVIEWS[0], REVIEWS[3]] };
    case 'one':
      return { v: 1, status: 'open', count: 1, average: 4, reviews: [REVIEWS[1]] };
    case 'zero':
      return { v: 1, status: 'open', count: 0, average: null, reviews: [] };
    case 'closed':
    case 'unavailable':
      return { v: 1, status: mode, count: 0, average: null, reviews: [] };
    case 'wrong-version':
      return { v: 2, status: 'open', count: 12, average: 4.3, reviews: take(6) };
    default:
      return null;
  }
}

/* mode: open | two | one | zero | closed | unavailable | wrong-version |
   limited (429) | error (500) | unreadable (200, not JSON) | unauthorized
   (401 with no CORS header, what the proxy answers today) | hang (never
   answers). hold: ms to wait before answering. */
export async function startReviewsStub({ port = 0 } = {}) {
  const state = { mode: 'open', hold: 0, hits: [] };
  const server = createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    state.hits.push({ method: req.method, path: u.pathname, query: u.search, headers: req.headers });
    const cors = { 'Access-Control-Allow-Origin': req.headers.origin ?? '*', Vary: 'Origin' };
    const send = (status, body, extra = {}) => {
      if (res.writableEnded) return;
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Set-Cookie': 'stub=1; Path=/', ...cors, ...extra });
      res.end(typeof body === 'string' ? body : JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') return send(204, '');
    if (u.pathname !== '/api/public/reviews' || req.method !== 'GET') return send(404, { error: 'not found' });
    const answer = () => {
      const m = state.mode;
      if (m === 'hang') return;
      if (m === 'limited') return send(429, { v: 1, status: 'limited' }, { 'Retry-After': '60' });
      if (m === 'error') return send(500, { v: 1, status: 'error' });
      if (m === 'unreadable') return send(200, '<html>oops</html>');
      if (m === 'unauthorized') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Not signed in.' }));
      }
      const limit = Number(u.searchParams.get('limit')) || 20;
      return send(200, reviewsBody(m, { limit }));
    };
    if (state.hold) setTimeout(answer, state.hold);
    else answer();
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    state,
    reset() {
      state.mode = 'open';
      state.hold = 0;
      state.hits.length = 0;
    },
    close: () => new Promise((r) => server.close(r)),
  };
}

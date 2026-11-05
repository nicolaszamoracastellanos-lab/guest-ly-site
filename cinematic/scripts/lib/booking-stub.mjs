/* A local stand-in for the booking and guides API on app.guest-ly.com, shaped
   exactly like L7P-LOG "Booking API for the landing" (v1) and L7-LOG "Guides
   API for the landing" (v1, proposed). Used by scripts/test-booking.mjs and
   scripts/booking-screens.mjs, and by check-origins.mjs --fixtures (which
   answers inside the browser and never reaches the real host). Fictional
   data only. Every answer: JSON, Cache-Control no-store, Vary Origin, the
   Origin echoed in Access-Control-Allow-Origin, and (to prove the page keeps
   none) a Set-Cookie. */

import { createServer } from 'node:http';

export const HOST_ZONE = 'America/La_Paz';
const TYPE = {
  slug: 'demo',
  durationMin: 30,
  title: { en: 'Guest-ly demo', es: 'Demo de Guest-ly' },
  description: {
    en: 'A 30-minute video call: we walk through Guest-ly with your wedding in mind and answer your questions.',
    es: 'Una videollamada de 30 minutos: te mostramos Guest-ly pensando en tu boda y respondemos tus preguntas.',
  },
  location: 'video',
};

const dayIn = (ms, tz) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const addDays = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const validZone = (tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return Boolean(tz);
  } catch {
    return false;
  }
};

/* Host hours, La Paz (UTC-4, no daylight saving): weekdays 9:00 to 12:00 and
   14:00 to 15:00, every 30 minutes, nothing on Wednesdays of even weeks
   (a weekday with no times), 4 hours of notice. */
export function hostSlots(now, days = 45) {
  const out = [];
  const today = dayIn(now, HOST_ZONE);
  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    if (wd === 3 && Math.floor(i / 7) % 2 === 0) continue;
    for (const hm of ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30']) {
      const ms = Date.parse(`${day}T${hm}:00-04:00`);
      if (ms > now + 4 * 3600000) out.push(ms);
    }
  }
  return out;
}

export function slotsBody({ tz, from, days = 14, now = Date.now(), taken = [] }) {
  const zone = validZone(tz) ? tz : HOST_ZONE;
  const today = dayIn(now, zone);
  const start = from && /^\d{4}-\d{2}-\d{2}$/.test(from) && from >= today ? from : today;
  const end = addDays(start, days);
  const slots = hostSlots(now)
    .filter((ms) => !taken.includes(new Date(ms).toISOString()))
    .filter((ms) => {
      const d = dayIn(ms, zone);
      return d >= start && d < end;
    })
    .map((ms) => new Date(ms).toISOString());
  const startIso = new Date(Date.parse(`${start}T00:00:00Z`)).toISOString();
  return {
    v: 1,
    status: 'open',
    host: { name: 'Guest-ly', timeZone: HOST_ZONE },
    type: TYPE,
    window: { from: start, days, timeZone: zone, start: startIso, end: new Date(Date.parse(startIso) + days * 86400000).toISOString() },
    slots,
    nextOpen: null,
  };
}

export function bookedBody(origin, start, { replay = false } = {}) {
  const token = 'tok_fixture_0123456789abcdefABCDEF';
  return {
    v: 1,
    ok: true,
    status: 'booked',
    replay,
    booking: {
      start: replay ? null : start,
      end: replay ? null : new Date(Date.parse(start) + 30 * 60000).toISOString(),
      timeZone: HOST_ZONE,
      manageUrl: replay ? null : `${origin}/booking/manage/${token}`,
      icsUrl: replay ? null : `${origin}/booking/manage/${token}/ics`,
    },
  };
}

/* The stub server. mode.slots: open | closed | unavailable | empty-next |
   limited | error | slow. mode.book: booked | replay | taken | invalid-<field>
   | invalid-null | closed | unavailable | error | abort. mode.guide: sent |
   invalid-email | invalid-destination | closed | error | abort.
   hits: every request (method, url, headers, body). */
export async function startStub({ port = 0 } = {}) {
  const state = { hits: [], mode: { slots: 'open', book: 'booked', guide: 'sent' }, taken: [], holdSlots: null };
  let origin = '';
  const server = createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const body = Buffer.concat(chunks).toString('utf8');
      const url = new URL(req.url, origin);
      state.hits.push({ method: req.method, url: req.url, path: url.pathname, headers: req.headers, body });
      const headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        Vary: 'Origin',
        'Set-Cookie': 'gl_stub=1; Path=/; SameSite=Lax',
      };
      if (req.headers.origin) headers['Access-Control-Allow-Origin'] = req.headers.origin;
      const send = (status, json, extra = {}) => {
        res.writeHead(status, { ...headers, ...extra });
        res.end(json === null ? '' : JSON.stringify(json));
      };
      if (req.method === 'OPTIONS') {
        return send(204, null, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      }
      if (url.pathname === '/api/site/t') return send(204, null);

      if (url.pathname === '/api/public/booking/guestly/demo/slots') {
        if (state.holdSlots) await state.holdSlots;
        const m = state.mode.slots;
        const tz = url.searchParams.get('tz');
        if (m === 'closed' || m === 'unavailable') return send(200, { v: 1, status: m, host: null, type: null, window: null, slots: [], nextOpen: null });
        if (m === 'limited') return send(429, { v: 1, status: 'limited' }, { 'Retry-After': '60' });
        if (m === 'error') return send(500, { v: 1, status: 'error' });
        if (m === 'empty-next' && !url.searchParams.get('from')) {
          const b = slotsBody({ tz, days: 14 });
          const later = hostSlots(Date.now(), 45).map((ms) => new Date(ms).toISOString());
          const next = later.find((iso) => Date.parse(iso) > Date.parse(b.window.end)) ?? null;
          return send(200, { ...b, slots: [], nextOpen: next });
        }
        return send(200, slotsBody({ tz, from: url.searchParams.get('from'), days: Number(url.searchParams.get('days')) || 14, taken: state.taken }));
      }

      if (url.pathname === '/api/public/booking/guestly/demo/book' && req.method === 'POST') {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch {}
        const m = state.mode.book;
        if (m === 'abort') return req.socket.destroy();
        if (m === 'error') return send(500, { v: 1, ok: false, status: 'error' });
        if (m === 'closed') return send(409, { v: 1, ok: false, status: 'closed', slots: [] });
        if (m === 'unavailable') return send(503, { v: 1, ok: false, status: 'unavailable' });
        if (m === 'invalid-null') return send(400, { v: 1, ok: false, status: 'invalid', field: null });
        if (m.startsWith('invalid-')) return send(400, { v: 1, ok: false, status: 'invalid', field: m.slice(8) });
        if (m === 'taken') {
          if (json?.start) state.taken.push(json.start);
          const fresh = slotsBody({ tz: json?.visitorTz, days: 14, taken: state.taken });
          return send(409, { v: 1, ok: false, status: 'taken', slots: fresh.slots });
        }
        return send(201, bookedBody(origin, json?.start ?? new Date().toISOString(), { replay: m === 'replay' }));
      }

      if (url.pathname === '/api/public/guides/request' && req.method === 'POST') {
        const m = state.mode.guide;
        if (m === 'abort') return req.socket.destroy();
        if (m === 'error') return send(500, { v: 1, ok: false, status: 'error' });
        if (m === 'closed') return send(503, { v: 1, ok: false, status: 'unavailable' });
        if (m.startsWith('invalid-')) return send(400, { v: 1, ok: false, status: 'invalid', field: m.slice(8) });
        return send(202, { v: 1, ok: true, status: 'sent' });
      }
      send(404, { v: 1, status: 'not_found' });
    });
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  origin = `http://localhost:${server.address().port}`;
  return { server, origin, state, close: () => new Promise((r) => server.close(r)) };
}

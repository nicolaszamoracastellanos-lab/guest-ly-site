# Sandbox demo bot setup (for the live hero demo)

STATUS: LIVE since Aug 1, 2026. The endpoint is
`https://alexnico.guest-ly.com/.netlify/functions/demo-chat` (a dedicated
`demo-chat` Netlify function in the platform repo, pinned server-side to
the fictional `demo-emma-james` tenant), already set in
`cinematic/src/config.ts`. Seed script:
`alexnico2026/scripts/seed-demo-tenant.mjs` (idempotent; re-run it to
change the demo wedding's facts). Rate limits live in Postgres
(`demo_chat_hit` RPC, 10/min and 60/day per IP) on top of the browser
caps. The notes below remain as the reference for how it is built.

The hero chat card runs against a real Guest-ly concierge for a
FICTIONAL demo wedding ("Emma & James"). If `SANDBOX_BOT_ENDPOINT` is
ever cleared, the scripted loop plays instead.

## Hard rules

1. NEVER point the marketing site at the alexnico2026 production
   functions or any real wedding tenant. The demo gets its own tenant
   with fictional data only.
2. The marketing repo never holds an API key. The sandbox function owns
   the key; the browser only ever calls the public sandbox URL.

## Steps

1. **Create a demo tenant** in the Guest-ly platform (like any client
   wedding): couple "Emma & James", a fictional venue, hotel, shuttle
   schedule, dress code and registry. 15 minutes with the ops portal.
2. **Deploy a `demo-chat` function** next to the existing web-chat
   function, pinned to that tenant:
   - Input: `POST { "message": string }` (no auth, no session).
   - Output: `{ "reply": string }`.
   - Set `max_tokens` low (about 300) and temperature as in production.
   - Add per-IP rate limiting (for example 10 requests/minute and 100/day
     via your existing rate-limit helper or the platform's KV store).
     The browser already enforces 6 messages/session, 250 chars,
     1 message per 3 seconds, but the browser cannot be trusted: the
     server limit is the real one.
   - CORS: allow `https://guest-ly.com` (and localhost for testing).
3. **Point the config at it**: paste the URL into
   `SANDBOX_BOT_ENDPOINT` in `cinematic/src/config.ts`. `LIVE_DEMO`
   flips to `'live'` automatically. Rebuild and the hero input becomes
   real: first scripted exchange autoplays, then typing and the four
   quick-reply chips send real messages.
4. **Test**: ask about dress code, shuttle, hotels, RSVP; confirm the
   answers match the fictional wedding, then break it on purpose (kill
   the function) and confirm the card degrades to the scripted
   "concierge is napping" answer instead of an error state.

## Failure behavior already built in

- Endpoint down / non-200 / empty reply: the card answers with the
  scripted fallback, prefixed honestly. Never a broken card.
- Over-limit: friendly EN/ES limit copy, no request sent.
- Session state lives in browser memory only; nothing demo-related is
  stored or linked to identity (this is also stated on /privacy).

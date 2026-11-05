/* Build-time switches for the two landing features whose server half lives on
   app.guest-ly.com (Lane 7p). Plain constants with no browser or Vite
   globals, so vite.config.ts and the Node checks read the same values.

   BOOKING_ENABLED (#22 demo booking). false: the page keeps today's contact
   path (the FAQ email and the order wizard), no booking button renders, the
   booking code is not in the build and no booking request is ever made.
   Going live: true here and rebuild, once the booking API is deployed, its
   flag (MW_DEMO_BOOKING) released and Nicolas has turned on "Taking
   bookings" in /ops/bookings, and once the privacy lines are approved.

   GUIDES_ENABLED (#50 destination guides). false: the guides section is not
   rendered and its code is not in the build. Going live: true here and
   rebuild, once POST /api/public/guides/request is deployed and released.
   The destinations come from the portal's destinations dataset at build
   time (scripts/lib/guide-destinations.mjs).

   vite.config.ts writes both into the build as literals
   (import.meta.env.VITE_BOOKING_ENABLED, VITE_GUIDES_ENABLED), so false
   drops every component, chunk and request behind them. JSON-LD and the llms
   files never mention either (scripts/check-seo.mjs). */
export const BOOKING_ENABLED: boolean = false;
export const GUIDES_ENABLED: boolean = false;

/* The one origin both features call. check-origins.mjs allows it, and only
   its /api/public/booking/ and /api/public/guides/ paths. */
export const API_ORIGIN = 'https://app.guest-ly.com';
export const API_PATHS = ['/api/public/booking/', '/api/public/guides/'] as const;

export type Switches = { booking: boolean; guides: boolean; apiOrigin: string };

/* Test builds may turn a switch on (GL_BOOKING_ENABLED=1, GL_GUIDES_ENABLED=1)
   and point the API at a local stub (GL_API_ORIGIN=http://127.0.0.1:port).
   Any other origin is refused, so no build can send these requests to a
   third party. */
export function resolveSwitches(env: Record<string, string | undefined>): Switches {
  const on = (v: string | undefined, dflt: boolean) => (v === undefined || v === '' ? dflt : v === '1' || v === 'true');
  const apiOrigin = env.GL_API_ORIGIN || API_ORIGIN;
  if (apiOrigin !== API_ORIGIN && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(apiOrigin)) {
    throw new Error(`GL_API_ORIGIN must be ${API_ORIGIN} or a local http origin, not ${apiOrigin}`);
  }
  return { booking: on(env.GL_BOOKING_ENABLED, BOOKING_ENABLED), guides: on(env.GL_GUIDES_ENABLED, GUIDES_ENABLED), apiOrigin };
}

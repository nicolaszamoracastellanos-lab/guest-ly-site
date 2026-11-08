/* Build-time switches for the landing features whose server half lives on
   app.guest-ly.com (Lane 7p; the reviews API is Lane 6's). Plain constants with no browser or Vite
   globals, so vite.config.ts and the Node checks read the same values.

   BOOKING_ENABLED (#22 demo booking). false: the page keeps today's contact
   path (the FAQ email and the order wizard), no booking button renders, the
   booking code is not in the build and no booking request is ever made.
   true (shipped Nov 8): like the guides and Reviews, run time only. Nothing
   of booking is prerendered: no button and no line (the privacy page's own
   "Demo calls" section is text on the privacy page). After hydration, at idle, the page
   reads GET /api/public/booking/guestly/demo/slots once (src/booking/state.ts,
   src/booking/BookingGate.ts), and only an "open" answer adds the booking buttons
   (FAQ, pricing line, final call to action; the order form and the menu show
   theirs when they open), all together and only when that moves nothing on
   screen. Closed, unavailable, 429, a network error, a slow answer or an
   unreadable one: nothing is added and nothing is left behind, so the page is
   exactly the booking-off page. The dialog itself is a lazy chunk, loaded on
   intent or on the press (and by ?book=demo, the "Book another time" link in
   the booking emails, which opens it whatever the read said). It needs the
   booking API deployed, MW_DEMO_BOOKING released and "Taking bookings" on in
   /ops/bookings; until then the read answers closed and the page shows no
   booking button.

   GUIDES_ENABLED (#50 destination guides). false: the guides section is not
   rendered and its code is not in the build. true (shipped Nov 7): like the
   Reviews tab, the section is run time only. Nothing of it is prerendered;
   after hydration, at idle, the page reads GET /api/public/guides once, and
   only an "open" answer with at least one guide adds the section, just
   before the FAQ (src/guides/state.ts). Closed, unavailable, 429, a network
   error or an unreadable answer: nothing is added and nothing is left
   behind, so the page is exactly the switch-off page. The guides and the
   tips sentence come from that catalogue at run time; none of them is in
   the landing (D24). The request ("POST /api/public/guides/request", L7P-LOG
   "Guides API for the landing") needs the API deployed and MW_GUIDES released.
   Any switch, or all three, on must still fit the 100 KB initial JS budget
   (scripts/check-seo.mjs fails the build otherwise). They do: the legal
   pages are their own lazy chunk (L7-LOG, Nov 7), so guides, Reviews and
   booking together fit; all three are shipped on, and
   scripts/test-initial-js.mjs builds the shipped mix, all off and all on and
   keeps each under the budget.

   vite.config.ts writes the switches into the build as literals
   (import.meta.env.VITE_BOOKING_ENABLED, VITE_GUIDES_ENABLED), so false
   drops every component, chunk and request behind them. JSON-LD and the llms
   files never mention either (scripts/check-seo.mjs). */
export const BOOKING_ENABLED: boolean = true;
export const GUIDES_ENABLED: boolean = true;

/* REVIEWS_ENABLED (the Reviews tab: reviews kept in Guest-ly, ANSWERS-NOV6
   c-google; server half L6-LOG "Reviews API for the landing"). false: no
   section, nav item, chunk, CSS or request in the build. true: after
   hydration, at idle, the page reads GET /api/public/reviews once; only an
   "open" answer with at least one review adds the section (before the final
   call to action) and its nav item, plus the Review and AggregateRating
   JSON-LD built from that answer. Zero reviews, "closed", "unavailable",
   429, a network error or anything unreadable: nothing shows, nothing is
   left behind. Nothing about reviews is ever prerendered (scripts/check-seo.mjs).
   Shipped on (Nov 7, with the guides): while the API is unreachable, answers
   401 or has nothing published, the page shows no reviews section at all. */
export const REVIEWS_ENABLED: boolean = true;

/* The one origin these features call. check-origins.mjs allows it, and only
   these paths: a path ending in "/" covers what is under it, one without
   covers itself and what is under it (/api/public/guides is the guides
   catalogue, /api/public/guides/request the request, /api/public/reviews the
   published reviews). */
export const API_ORIGIN = 'https://app.guest-ly.com';
export const API_PATHS = ['/api/public/booking/', '/api/public/guides', '/api/public/reviews'] as const;

export type Switches = { booking: boolean; guides: boolean; reviews: boolean; apiOrigin: string };

/* Test builds may turn a switch on (GL_BOOKING_ENABLED=1, GL_GUIDES_ENABLED=1,
   GL_REVIEWS_ENABLED=1)
   and point the API at a local stub (GL_API_ORIGIN=http://127.0.0.1:port).
   Any other origin is refused, so no build can send these requests to a
   third party. */
export function resolveSwitches(env: Record<string, string | undefined>): Switches {
  const on = (v: string | undefined, dflt: boolean) => (v === undefined || v === '' ? dflt : v === '1' || v === 'true');
  const apiOrigin = env.GL_API_ORIGIN || API_ORIGIN;
  if (apiOrigin !== API_ORIGIN && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(apiOrigin)) {
    throw new Error(`GL_API_ORIGIN must be ${API_ORIGIN} or a local http origin, not ${apiOrigin}`);
  }
  return {
    booking: on(env.GL_BOOKING_ENABLED, BOOKING_ENABLED),
    guides: on(env.GL_GUIDES_ENABLED, GUIDES_ENABLED),
    reviews: on(env.GL_REVIEWS_ENABLED, REVIEWS_ENABLED),
    apiOrigin,
  };
}

/* Build-time literals written by vite.config.ts (define). */
interface ImportMetaEnv {
  /** #23: where the beacon posts; '' = off. */
  readonly VITE_SITE_BEACON_URL: string;
  /** #22 switch (src/switches.ts). */
  readonly VITE_BOOKING_ENABLED: boolean;
  /** #50 switch (src/switches.ts). */
  readonly VITE_GUIDES_ENABLED: boolean;
  /** Reviews tab switch (src/switches.ts). */
  readonly VITE_REVIEWS_ENABLED: boolean;
  /** Origin of the booking, guides and reviews API (https://app.guest-ly.com). */
  readonly VITE_GL_API_ORIGIN: string;
}

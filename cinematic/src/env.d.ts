/* Build-time literals written by vite.config.ts (define). */
interface ImportMetaEnv {
  /** #23: where the beacon posts; '' = off. */
  readonly VITE_SITE_BEACON_URL: string;
  /** #22 switch (src/switches.ts). */
  readonly VITE_BOOKING_ENABLED: boolean;
  /** #50 switch (src/switches.ts). */
  readonly VITE_GUIDES_ENABLED: boolean;
  /** Origin of the booking and guides API (https://app.guest-ly.com). */
  readonly VITE_GL_API_ORIGIN: string;
  /** #50 destinations from the portal dataset; [] while GUIDES_ENABLED is false. */
  readonly VITE_GUIDE_DESTINATIONS: readonly {
    id: string;
    name: { en: string; es: string };
    country: { en: string; es: string };
  }[];
}

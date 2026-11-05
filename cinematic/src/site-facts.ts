/* Facts about Guest-ly itself that the page and the build scripts share.
   Plain constants with no browser or Vite globals, so Node scripts
   (scripts/llms.mjs) can import this file directly. */

/* LEGAL: registered entity name for the footer, the terms page and llms.txt. */
export const LEGAL_ENTITY = 'ZC Ventures LLC';

/* The slogan, exactly (master prompt section 2). The footer of every page
   and the last line of each llms file. */
export const SLOGAN = { en: 'More wedding, less stress.', es: 'Más boda, menos estrés.' } as const;

/* Public addresses. */
export const SITE_URL = 'https://guest-ly.com';
export const APP_URL = 'https://app.guest-ly.com';

/* The iPhone app on the App Store. Same value as DEFAULT_IOS_STORE_URL in
   the portal (src/lib/routes.ts); scripts/llms.mjs fails the build when the
   portal checkout it reads says otherwise. */
export const IOS_APP_URL = 'https://apps.apple.com/app/id6809618039';

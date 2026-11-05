import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { copy } from './src/copy.ts'
import { JSON_LD_MARKER, jsonLdScripts } from './src/seo/jsonld.ts'
import { resolveSwitches } from './src/switches.ts'
import { loadGuideDestinations } from './scripts/lib/guide-destinations.mjs'

/* Writes the JSON-LD blocks into index.html from the EN copy, so the
   offers and FAQ that search and AI engines read are the ones on the page. */
function jsonLd(): Plugin {
  return {
    name: 'guestly-json-ld',
    transformIndexHtml(html) {
      if (!html.includes(JSON_LD_MARKER)) throw new Error('index.html lost the JSON-LD marker comment')
      return html.replace(JSON_LD_MARKER, jsonLdScripts(copy.en))
    },
  }
}

/* #23 LANDING ANALYTICS, the one switch: where the cookieless beacon posts.
   '' (today) = off: the beacon is not even in the build and nothing is sent.
   Going live: put 'https://app.guest-ly.com/api/site/t' in place of the
   final '' and rebuild, once that endpoint is deployed and its flag
   (MW_SITE_ANALYTICS) released, and once the privacy page's "Visit counts"
   paragraph (shown only while this is set) is approved. A build may set
   VITE_SITE_BEACON_URL instead (scripts/test-beacon.mjs points it at a
   local stub). It is a literal at build time, so an empty value drops the
   beacon chunk, its loader and every emit() call. */
const SITE_BEACON_URL = process.env.VITE_SITE_BEACON_URL ?? ''

/* #24 LIVE SCREENS: the page reads src/live-screens.data.ts, which only
   scripts/live-screens.mjs --publish writes. A build may point
   GL_LIVE_SCREENS_MODULE at another copy of it (scripts/test-live-screens.mjs
   builds the page with fixture shots in a temp folder this way). */
const LIVE_SCREENS_MODULE = process.env.GL_LIVE_SCREENS_MODULE ?? ''

/* #22 DEMO BOOKING and #50 DESTINATION GUIDES: the switches live in
   src/switches.ts (both false today). They are written into the build as
   literals, so a switch that is off removes its components, its lazy chunk
   and every request to the API. The guides list is read from the portal's
   destinations dataset only while GUIDES_ENABLED is on. */
const SWITCHES = resolveSwitches(process.env)
const GUIDE_DESTINATIONS = SWITCHES.guides ? loadGuideDestinations().list : []

/* A switch that is off also drops its stylesheet: a CSS import is a side
   effect, so the bundler would keep it even after the component is gone.
   CSS imported from src/booking/ or src/guides/ resolves to an empty module
   while that feature's switch is off. */
function featureCss(): Plugin {
  const EMPTY = '\0gl-feature-off.css'
  const off = (importer: string) =>
    (!SWITCHES.booking && /[\\/]src[\\/]booking[\\/]/.test(importer)) || (!SWITCHES.guides && /[\\/]src[\\/]guides[\\/]/.test(importer))
  return {
    name: 'guestly-feature-css',
    enforce: 'pre',
    resolveId(id, importer) {
      if (importer && id.endsWith('.css') && off(importer)) return EMPTY
      return null
    },
    load(id) {
      return id === EMPTY ? '' : null
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [featureCss(), react(), jsonLd()],
  resolve: {
    alias: LIVE_SCREENS_MODULE ? [{ find: /^\.\.\/live-screens\.data\.ts$/, replacement: LIVE_SCREENS_MODULE }] : [],
  },
  define: {
    'import.meta.env.VITE_SITE_BEACON_URL': JSON.stringify(SITE_BEACON_URL),
    'import.meta.env.VITE_BOOKING_ENABLED': JSON.stringify(SWITCHES.booking),
    'import.meta.env.VITE_GUIDES_ENABLED': JSON.stringify(SWITCHES.guides),
    'import.meta.env.VITE_GL_API_ORIGIN': JSON.stringify(SWITCHES.booking || SWITCHES.guides ? SWITCHES.apiOrigin : ''),
    'import.meta.env.VITE_GUIDE_DESTINATIONS': JSON.stringify(GUIDE_DESTINATIONS),
  },
})

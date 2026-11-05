import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { copy } from './src/copy.ts'
import { JSON_LD_MARKER, jsonLdScripts } from './src/seo/jsonld.ts'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), jsonLd()],
  define: {
    'import.meta.env.VITE_SITE_BEACON_URL': JSON.stringify(SITE_BEACON_URL),
  },
})

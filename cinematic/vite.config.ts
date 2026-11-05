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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), jsonLd()],
})

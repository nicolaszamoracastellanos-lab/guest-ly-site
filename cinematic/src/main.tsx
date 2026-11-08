import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { legalRoute } from './legal-route.ts'

const rootEl = document.getElementById('root')!

/* The build prerenders the full EN DOM into index.html (Part 7.2); React
   hydrates over it. Dev serves an empty root and renders normally.
   The flag lets LanguageProvider hydrate in EN (matching the prerendered
   markup) and switch to a stored 'es' right after mount, instead of
   tripping hydration mismatches. */
function boot(tree: ReactNode) {
  const app = <StrictMode>{tree}</StrictMode>
  if (rootEl.childElementCount > 0) {
    ;(window as unknown as { __glHydrating?: boolean }).__glHydrating = true
    hydrateRoot(rootEl, app)
  } else {
    createRoot(rootEl).render(app)
  }
}

/* The legal pages (/privacy, /terms, /refunds) are their own chunk, so their
   text and page code stay out of the home page's first load: a legal
   address loads it, then hydrates its prerendered page (no Suspense
   boundary, so the markup is exactly what the build wrote). The home page
   boots at once. If the chunk cannot load, the prerendered page stays as
   it is: plain readable text. */
const legal = legalRoute()
if (legal) {
  import('./ui/LegalPage.tsx').then((m) => boot(<m.LegalPage kind={legal} />), () => {})
} else {
  boot(<App />)
}

/* #23 landing analytics: its own small chunk, fetched only when a beacon URL
   is configured, after hydration and at idle, so it never competes with the
   first paint. Any failure stays silent. The URL is a build-time literal
   (vite.config.ts), read here directly so an empty one drops the chunk. */
const beaconUrl: string = import.meta.env.VITE_SITE_BEACON_URL
if (beaconUrl) {
  const load = () => {
    import('./analytics/beacon.ts').then((m) => m.start(beaconUrl)).catch(() => {})
  }
  if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 4000 })
  else setTimeout(load, 1500)
}

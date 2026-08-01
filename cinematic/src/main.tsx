import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const rootEl = document.getElementById('root')!
const app = (
  <StrictMode>
    <App />
  </StrictMode>
)

/* The build prerenders the full EN DOM into index.html (Part 7.2); React
   hydrates over it. Dev serves an empty root and renders normally. */
if (rootEl.childElementCount > 0) {
  hydrateRoot(rootEl, app)
} else {
  createRoot(rootEl).render(app)
}

# GUEST-LY WAVE 5: LANDING PAGE REBUILD, MASTER EXECUTION PROMPT

Paste this entire file into Claude Code opened at the root of the `guest-ly-site` repo (the marketing site repo, NOT `alexnico2026`, NOT `guestly-portal`). This document is the single source of truth for this wave. Build everything, self-review everything with screenshots, then hand Nico the test script.

---

# PART 0: HOW TO OPERATE

You are the senior founding engineer and design lead of Guest-ly. You report to Nico. Ship all eight workstreams in order with no approval gates between them, except the two stops below.

**Absolute stops:**

1. STOP before Workstream G (Stripe wiring) if the `PAY_LINKS` values in Part 1 are still `PENDING`. Payment links are a purchase-adjacent, high-blast-radius item: Nico creates them in Stripe himself and pastes the URLs. Build everything else, leave the config keys ready, and list this as a blocker in the final summary.
2. STOP at the end, after the full self-review protocol (Part 11) passes, and present the audit table plus the 10-minute test script (Part 12). Nico tests, then approves the push to `main` (GitHub Pages auto-deploys on push, so a push IS a deploy: never push without his explicit approval).

**Operating rules:**

- Maintain a live todo list across all workstreams. Mark items complete in real time. Plan briefly at the top of each workstream (files touched, risks), then build. No plan-mode ceremony per workstream.
- Work on a branch `wave5-landing-rebuild`. Commit per meaningful unit with conventional commits. Never commit secrets.
- All work is in `cinematic/`. The root-level `index.html`, `assets/`, `textures/` are the previous build output: regenerate them only at the very end via the build, never hand-edit them.
- Loop discipline: every workstream ends with a GOAL, BUILD, VERIFY, REVISE cycle. VERIFY always means rendered output (Playwright screenshot or executed check), never reasoning from code alone. If VERIFY fails, REVISE and re-verify before moving on. Log each cycle in `BUILD-LOG.md` at the repo root (create it).
- No em dashes anywhere: not in code, comments, UI copy, commit messages, or this project's docs. Use periods, commas, colons, or parentheses. This applies to every string you write into `copy.ts`.
- No emojis in any client-facing copy, including the chat mock, testimonial section, and marquee. The only permitted symbols are the diamond, checkmarks, crosses, and typographic marks already in the design system.
- Brand constants never change: Navy `#0D1B2A` family, Ivory `#FAF6F0` family, Gold `#B8965A`, Cormorant-class serif display + Jost-class sans body (the current Playfair/EB Garamond/Inter stack may stay; do not add new families).
- Bilingual EN/ES: every string you touch or add ships in both languages in `copy.ts`. Keep the existing `SiteCopy` type discipline: extend the interface first, then both locales.

**What Nico explicitly wants preserved (do not remove or "simplify away"):**

- The WebGL background: floral field, bokeh, silk, camera drift, the day-to-evening warmth as you scroll. It stays. It becomes theme-aware and performance-gated, but the cinematic feel is a feature, not a bug.
- The question marquee.
- The overall editorial aesthetic: glass cards, eyebrow labels, serif display type.

---

# PART 1: NICO INPUTS (fill before running, or leave PENDING)

Edit these values in this file before pasting, or answer them when Claude Code asks at startup. Anything left `PENDING` gets built around, flagged in the summary, and never invented.

```
CANONICAL_PRICING:
  essentials: { name: "Essentials", guests: "Up to 60 guests",  price: 199 }
  signature:  { name: "Signature",  guests: "Up to 160 guests", price: 399 }
  grande:     { name: "Grande",     guests: "Up to 300 guests", price: 699 }
  model: one-time payment, yours until the wedding, no subscriptions
  coordinator_addon: $79 one-time or $19/mo, included with Grande
  # ^ This is the model currently on the live site. If Nico wants the
  #   creation-fee-plus-hosting model instead, he must say so here.
  #   Pricing is a high-blast-radius decision: whatever is written here is
  #   propagated everywhere and recorded; if this block is edited, note the
  #   change prominently in the final summary so Nico can update DECISIONS.md.

PAY_LINKS:
  essentials: PENDING   # Stripe Payment Link URL
  signature:  PENDING
  grande:     PENDING

SANDBOX_BOT:
  endpoint: PENDING     # e.g. https://<sandbox-site>.netlify.app/.netlify/functions/chat
  # A dedicated sandbox tenant with a FICTIONAL demo wedding. NEVER point the
  # live hero at the alexnico2026 production functions. If PENDING, build the
  # full live-chat UI behind a config flag, ship the current scripted loop as
  # fallback, and write docs/sandbox-bot-setup.md (Part 6.4) so Nico can
  # stand up the sandbox in under an hour.

WHATSAPP_ORDER_NUMBER: PENDING   # digits only, for the wizard confirmation step

LEGAL:
  entity_name: PENDING           # legal/business name for footer + terms
  contact_email: nicolas@guest-ly.com
```

---

# PART 2: WORKSTREAM A, SEMANTIC THEME LAYER + DAY/NIGHT MODE

The single biggest structural change. Do it first because every later workstream builds on the tokens.

## 2.1 Token refactor

`cinematic/src/styles/tokens.css` currently names colors by what they are (`--ink`, `--ivory`). Add a semantic layer and migrate every component to it:

- Keep the raw palette constants at `:root` (navy, ivory, golds, sage, online).
- Add two theme scopes, `[data-theme="night"]` and `[data-theme="day"]`, each defining ONLY semantic tokens: `--bg`, `--bg-grad`, `--surface`, `--surface-raised`, `--text`, `--text-muted`, `--text-faint`, `--border`, `--border-soft`, `--accent`, `--accent-text`, `--accent-ink`, `--shadow-card`, plus glass tokens `--glass-bg`, `--glass-border`, `--glass-highlight`.
- Day mode rules: background ivory `#FAF6F0` with a warm white radial, text navy, cards white with soft navy-tinted borders and shadows. Gold contrast rule: `#B8965A` fails WCAG AA on ivory (about 2.6:1), so day mode uses a deep gold near `#8A6D3E` for TEXT and links, while `#B8965A` remains for fills, rules, the diamond, and button backgrounds with navy or white ink on top. Verify every text/background pair at 4.5:1 minimum with an actual contrast computation in the verify step, not by eye.
- Night mode reproduces the current look exactly (this is the regression guard: night-mode screenshots before and after the refactor must be visually identical apart from intentional fixes in Part 2.4).
- Migrate: grep for every literal hex and every `var(--ink|--ivory|--gold...)` usage in `overlay.css`, `index.css`, and all components. Zero raw palette references may remain in component styles; components use semantic tokens only. This is a grep gate in Part 11.

## 2.2 Theme switching + OS preference

- `data-theme` lives on `<html>`. Resolution ladder, exactly this order: stored user choice in `localStorage('gl-theme')`, else `prefers-color-scheme` via `matchMedia` (this is the "match the phone's mode" requirement), else `night`.
- Inline a tiny synchronous script in `cinematic/index.html` `<head>` that resolves the ladder and sets `data-theme` before first paint. No flash of wrong theme. Verify with a Playwright run forcing `colorScheme: 'light'` and `'dark'`.
- Live-follow: subscribe to the `matchMedia` change event; if the user has NOT made an explicit choice, follow the OS live when it flips.
- UI control: a Day/Night pill toggle in the nav, styled with the existing pill language (mirror the EN/ES toggle), present on desktop nav, mobile bar, and inside the burger menu. Explicit click stores the choice. `aria-pressed` states, visible focus ring.
- Background color transitions over about 0.5s with the site's lux easing; instant under `prefers-reduced-motion`.
- Add `<meta name="color-scheme" content="dark light">` and a theme-color meta per theme.

## 2.3 Theme-aware WebGL (keep the cinematic background)

`Experience.tsx` hardcodes `scene.background = '#0d1117'`, fog `['#0d1117', 10, 30]`, and lighting. Make the canvas subscribe to the theme:

- Extract a `themeScene` map: for `night`, exactly the current values. For `day`: scene background and fog in warm ivory (`#F2ECE1` region), ambient light up, point light warmth recalibrated so petals and bokeh read as soft gold-on-cream rather than glow-in-the-dark, exposure tuned down slightly. The day-to-evening scroll warmth curve stays in both themes; in day mode it warms toward late-afternoon gold instead of amber night.
- Petal, bokeh, and silk materials: audit each scene file for baked-in colors or opacities that assume a dark background; parameterize per theme. Bokeh in day mode should drop opacity so it never muddies text.
- Transition the scene colors with a short lerp on theme change (or an acceptable hard swap behind the 0.5s CSS transition; pick one, verify it does not flash).
- The vignette and film grain in `index.css`: in day mode, vignette opacity near zero and grain at 0.02 or off. In night mode, reduce grain to 0.03 and change the grain element so it does not sit over the central text column (Part 2.4).

## 2.4 Legibility fixes that ride along (both themes)

- `--sage #79705f` secondary text on dark fails AA: replace all text usage with a compliant muted tone.
- Grain layer currently covers all content at `z-index:3`: reduce and mask as above.
- Soften the night vignette so card edges near the viewport boundary are not eaten.
- Add a skip-to-content link. Ensure collapsed FAQ answers are `inert` (or content unmounted) so keyboard users do not tab through hidden text.

VERIFY: Playwright, both themes, 390x844 and 1440x900, screenshots of hero, one card section, pricing, FAQ open/closed. Programmatic contrast check on the main text/background pairs. Night-before vs night-after diff.

---

# PART 3: WORKSTREAM B, INFORMATION ARCHITECTURE: 9 SECTIONS, PROGRESSIVE DISCLOSURE

Reorganize; do not redesign the visual language. Target under 600 visible English words on first paint (currently 1,944).

## 3.1 New section order

1. Hero (Workstream C)
2. Question marquee (unchanged)
3. Three Pillars (new, replaces Channels + Included + Platform + Difference)
4. How it works (keep, 4 steps)
5. Pricing (Workstream D)
6. Founding Couples (Workstream E, honest version)
7. FAQ (trim to the best 5; fold cut answers' content into pillar expanders where relevant)
8. Final CTA
9. Footer (+ legal links, Workstream H)

Delete as standalone sections: Channels, What's included, Your portal, The difference, Testimonials (replaced by E), the competitor table (replaced by one line, Part 5.3).

## 3.2 Three Pillars component (the signature interaction)

New `Pillars.tsx`. Three glass cards in a row (stacked on mobile):

- Pillar 1 "Your guests": one line, "Ask anything, any hour, in their language." Expander reveals: web chat link, WhatsApp number, wedding website + per-person per-event RSVP, travel/visa/currency answers, QR guest pass.
- Pillar 2 "You": one line, "One screen, everything visible, nothing to install." Expander: Wedding Brain, live dashboard, guest import, RSVP board + reminders, broadcasts, website studio, AI Coordinator teaser line.
- Pillar 3 "Under it": one line, "Built, hosted and monitored by us." Expander: trained only on your wedding, flags unknowns, full transcripts, we handle WhatsApp approval and hosting, version history, live in about a week.

Interaction: tap or click the card header ("See what that means") expands with an animated grid-rows transition, plus icon rotates to a cross, card border warms to gold. `aria-expanded`, `aria-controls`, full keyboard support. Only these three expanders and the FAQ use disclosure; do not sprinkle accordions anywhere else.

Migrate every factual claim from the four deleted sections into pillar expanders or FAQ so no true information is lost; it just stops being forced on scanners. Deduplicate the overlaps (Website/Website Studio, RSVPs/RSVP Board) into single entries.

## 3.3 Claims cleanup (truth pass) while migrating copy

- "30+ Languages" becomes "Bilingual English and Spanish, with best-effort answers in other languages."
- SMS and Telegram: remove from sold features (only web + WhatsApp are implemented). If mentioned at all, a single "coming soon" note inside pillar 1's expander.
- Hero stat "2 AI assistants" is replaced (Part 4.2).
- Remove the French and German marquee lines OR keep them only if the best-effort language line ships; Nico's call defaults to keeping the marquee as-is since it illustrates guest reality, with the honest language claim in place.
- Nav labels rewritten as buyer questions: "See it work" (#hero demo), "What you get" (#pillars), "How it works", "Pricing", "FAQ".

VERIFY: word count script over rendered EN DOM text (under 600 first-paint), screenshot of pillars collapsed and expanded, both themes, both breakpoints, keyboard-only expansion test.

---

# PART 4: WORKSTREAM C, LIVE HERO DEMO (the product IS the pitch)

## 4.1 Real chat, safely

Upgrade `ChatCard.tsx` from a scripted loop to a real, typeable chat against `SANDBOX_BOT.endpoint`:

- Config flag `LIVE_DEMO` in `config.ts`: `'live' | 'scripted'`. If the endpoint is PENDING, ship `'scripted'` (current behavior, minus emojis) and everything below is built and dormant behind the flag.
- Live mode: the input is real. Autoplay the first scripted guest question + answer for ambience, then invite typing: placeholder "Ask about the demo wedding of Emma and James".
- Four seeded quick-reply chips (dress code, hotels, shuttle, RSVP) that send real messages.
- Client-side guardrails: max 6 user messages per session, 250 chars per message, 1 message per 3 seconds, friendly limit copy in EN/ES, session state in memory only.
- Server note: document in `docs/sandbox-bot-setup.md` that the sandbox function must add IP rate limiting and a low max_tokens cap; the marketing repo never holds an API key.
- Errors degrade gracefully to a "the concierge is napping, here is what it would say" scripted answer, never a broken card.
- Label honestly inside the card: "Live demo. A real Guest-ly concierge for a fictional wedding."

## 4.2 Hero copy

- Stats row: replace "2 AI assistants" with an outcome stat ("0" / "questions you answer at 2am"). Keep 24/7 and ~7d. Language stat becomes "EN/ES" / "fully bilingual".
- Badge "Born at a real 400-guest wedding" changes tense honestly: "Built for our own 400-guest wedding" (it is being built for it; no fabricated past).
- Primary CTA stays "Get my concierge"; secondary becomes "Try the demo" anchoring to the chat card on mobile (where the card sits below the copy).

## 4.3 Order wizard inversion

`Wizard.tsx` step 1 currently asks "Choose your plan" cold. Invert:

- Step 1: guest count (four tappable ranges) + wedding date + city/country. Things every couple knows instantly.
- Step 2: recommendation screen: the fitting tier pre-selected with a one-line reason ("160 guests fits Signature"), other tiers selectable, Coordinator add-on as a checkbox with its one-line pitch.
- Step 3: contact details (existing fields minus the ones moved to step 1).
- Step 4: confirmation + payment (existing step 3, now honest per Workstream G).
- FormSubmit notification fires at the end of step 3 so the lead is captured even if payment is abandoned. Keep the existing `sendNotification`.

VERIFY: full wizard walkthrough via Playwright in EN and ES, both themes; live-chat flow mocked at the network layer if endpoint is PENDING; rate-limit copy screenshot.

---

# PART 5: WORKSTREAM D, PRICING SECTION, HONEST AND SINGULAR

## 5.1 One pricing model

Propagate `CANONICAL_PRICING` from Part 1 into `copy.ts` (both locales) and everywhere derived. Grep the repo for any stray alternative numbers (97, 247, 447, 747, 267, 547, 897, "$5/mo", "$12/mo", "$19/mo" outside the coordinator context) and remove them. List in the final summary any place OUTSIDE this repo Nico must reconcile (PLATFORM-STATE.md, DECISIONS.md, Stripe, Notion).

## 5.2 Plan cards

Keep the three glass plan cards. Trim each feature list to 5 lines maximum; overflow detail moves to pillar expanders. Keep popular ribbon, guarantee line, Founding banner (Workstream E), Coordinator strip.

## 5.3 Kill the competitor table

Delete the 6x5 comparison table entirely (unverifiable claims about named competitors, unreadable at 390px, and it argues against the "complement to Zola" strategy). Replace with one centered line under the plans: "Keep Zola. We sync with it." / "Conserva Zola. Nos sincronizamos con el." Style it as a quiet gold-marked note.

VERIFY: pricing screenshots both themes/breakpoints; grep gate for stray prices returns zero.

---

# PART 6: WORKSTREAM E, TRUTH LAYER: TESTIMONIALS OUT, FOUNDING STORY IN

## 6.1 Remove fabrications

Delete the Valentina & Diego and Camila & Rodrigo testimonials, the past-tense Alexandra & Nicolas quote, the five-star rows, the "Real weddings" kicker, and the three past-tense trust badges. No fabricated social proof survives anywhere, in either language. This is a grep gate.

## 6.2 The Founding Couples section (replacement)

The true story is stronger. One section, present tense:

- Kicker: "The origin". Title: "Built for our own wedding first."
- Body (write in the site's voice, both languages): Guest-ly is being built and battle-tested for the founders' own 400-guest wedding in Tarija, Bolivia, this November, with guests flying in from multiple countries. Every feature exists because a real guest needed it.
- Founding offer card (moves here from pricing, one place only): first 10 weddings, 30% off, Coordinator included, in exchange for an honest testimonial. Ends Aug 31, 2026. CTA opens the wizard.
- A slot component `FoundingProof.tsx` ready to accept real testimonials later: renders nothing when the array is empty.

VERIFY: screenshots; grep for "Valentina", "Camila", "Rodrigo", "★" in `src/` returns zero.

---

# PART 7: WORKSTREAM F, PERFORMANCE + SEO (keep the cinema, gate it)

## 7.1 Performance gates on the WebGL layer

- Capability gate before mounting the Canvas: skip WebGL and render a static themed gradient backdrop when `navigator.deviceMemory <= 4`, or `navigator.connection.saveData`, or `prefers-reduced-motion: reduce` (currently reduced-motion users still get a full render loop; that ends now), or WebGL context creation fails.
- Pause the R3F frameloop when the tab is hidden (`visibilitychange`) and when the canvas is fully offscreen.
- Mobile: drop the grain layer entirely, keep dpr cap at 1.5.
- Code-split: lazy-load the three.js Experience chunk after first paint so text and CTA render from a small initial bundle; the static gradient shows until the chunk arrives. Target: initial JS chunk under 300KB uncompressed; report the real numbers.

## 7.2 Prerender for crawlers

The served HTML is currently an empty root div. Add a build-time prerender step (a Puppeteer/Playwright script in the GitHub Action, or vite-plugin-prerender class solution) that emits the full EN DOM into `index.html` with the correct night-default markup and the theme bootstrap script intact. React hydrates over it. Add JSON-LD: `Product` (three offers from canonical pricing) and `FAQPage` (the 5 FAQ items). Verify by curling the built file and asserting real copy is present.

## 7.3 Housekeeping

- `font-display: swap` is present via Google Fonts param; also preload the two critical font files.
- Compress `hero.png` and `silk.jpg` if savings exist; serve silk texture only when WebGL mounts.

VERIFY: Lighthouse (or equivalent) run on the built output, mobile emulation, before/after scores logged in BUILD-LOG.md; curl test for prerendered copy; reduced-motion run shows static backdrop.

---

# PART 8: WORKSTREAM G, PAYMENTS (blocked on Nico) + WIZARD HONESTY

- If `PAY_LINKS` are provided: paste into `config.ts`, wizard step 4 shows the real "Pay $X securely" button per plan, note copy updated. Add `?client_reference_id` style metadata if trivially supported by Payment Links.
- If PENDING: build the exact same UI reading from config, keep the current graceful fallback copy, and put "Create 3 Stripe Payment Links and paste into cinematic/src/config.ts PAY_LINKS" as blocker #1 in the final summary, with STRIPE-SETUP.md referenced.
- `WHATSAPP_ORDER_NUMBER` wired the same way.
- Either way, add a plain-language line to the confirmation step: what happens next, refund guarantee restated, link to the refund policy page (Workstream H).

---

# PART 9: WORKSTREAM H, LEGAL + FOOTER

Three static pages, served as real routes that work under GitHub Pages (hash-free: generate `privacy/index.html` etc. via the prerender step, or a tiny client router with prerendered files; choose the simplest thing that yields crawlable URLs):

- `/privacy`: what is collected (order form fields via FormSubmit, demo chat messages if live demo ships), why, retention, contact email.
- `/terms`: service description, one-time payment terms, the "yours until the wedding" definition, entity name (or "operated by [PENDING]" flagged).
- `/refunds`: the existing guarantee, expanded to a page: full refund before first guest message or within 30 days, whichever comes first, how to request.

Footer: add the three links, the entity line, keep the existing structure. Both languages (a single bilingual page per topic with an EN/ES toggle is acceptable).

---

# PART 10: WORKSTREAM I, COPY CONFORMANCE PASS

Across the whole of `copy.ts` after all workstreams:

- Zero em dashes (currently 98). Rewrite each sentence properly; do not just swap in hyphens.
- Zero emojis in client-facing strings, including the chat mock and any scripted demo messages.
- Both locales complete and equivalent; no EN string leaking into ES mode (verify by screenshotting ES at each section).
- Add a `scripts/lint-copy.mjs` that fails the build on em dash or emoji codepoints in `copy.ts`, wired into the GitHub Action.

---

# PART 11: SELF-REVIEW PROTOCOL (mandatory before telling Nico anything is ready)

Run after ALL workstreams. Do not present per-workstream progress reports.

1. **Requirement audit table.** For each numbered requirement: (1) day/night mode with OS auto-detect and manual override, (2) WebGL background preserved and theme-aware, (3) 9-section IA under 600 first-paint words, (4) three-pillar progressive disclosure, (5) live-demo hero (or flagged-dormant with setup doc), (6) inverted wizard, (7) single pricing model propagated, (8) competitor table removed, (9) fabricated testimonials removed + founding story in, (10) performance gates + code split, (11) prerender + JSON-LD, (12) payments wired or cleanly blocked, (13) legal pages, (14) copy conformance: write PASS or FAIL with concrete evidence (file, screenshot path, measured number).
2. **Visual verification loop.** Dev server + Playwright. Screenshots at 390x844 and 1440x900, BOTH themes, EN and ES, of: hero (demo idle and mid-conversation), pillars collapsed and each expanded, how it works, pricing, founding, FAQ open, wizard steps 1 through 4, privacy page, footer. Personally inspect every screenshot for overflow, unthemed elements (anything still night-colored in day mode), contrast failures, wrong fonts, clipped text, broken glass effects on light backgrounds. Fix and re-shoot until clean. Store the final set under `docs/wave5-screens/` (gitignored is fine; reference paths in the summary).
3. **Functional smoke.** Theme ladder (localStorage beats OS, OS followed live when no explicit choice, no flash on load in either forced colorScheme); pillar keyboard operation; wizard EN+ES full pass and FormSubmit payload shape (dry, do not spam the real inbox more than once); demo rate limits; prerendered HTML contains real copy; JSON-LD validates; legal routes resolve on a static file server simulating Pages.
4. **Hostile review pass.** Re-read the full diff hunting for: any fabricated claim that survived, any stray pricing number, raw palette tokens in components, em dashes, emojis, hardcoded `#0d1117` outside the theme map, secrets, the sandbox endpoint accidentally set to alexnico2026, accessibility regressions (focus rings, aria states, inert FAQ panels), and CSS specificity collisions between old overlay.css rules and new ones. Fix everything found.
5. **Grep gates (all must return zero in `cinematic/src/`):** em dash character; emoji codepoints in copy.ts; `Valentina|Camila|Rodrigo`; `#0d1117` outside the theme scene map; `--ink|--ivory` referenced by components (raw constants may exist only in tokens.css); `2,499|97|247|747` price strays; `alexnico2026`.
6. **Performance numbers.** Initial chunk size, total JS, Lighthouse mobile perf score before and after, logged in BUILD-LOG.md.
7. **Build + preview.** `npm run build`, serve `dist/`, one final screenshot pass on the BUILT output (not just dev) in both themes.

Only when every line passes: present the audit table, the blockers list, and the test script below. Do not push to main.

---

# PART 12: NICO'S 10-MINUTE TEST SCRIPT (present verbatim when ready)

1. `npm run dev` in `cinematic/`. Page loads matching your Mac's appearance setting. Flip macOS appearance: the site follows. Click the Day/Night toggle: it sticks after reload and stops following the OS.
2. Confirm the background still feels like Guest-ly in both modes: petals, bokeh, scroll warmth, marquee.
3. Count the scroll: 9 sections, nothing repeated. Expand each of the three pillars, on your phone too.
4. Type into the hero demo (or confirm the scripted fallback plus read docs/sandbox-bot-setup.md if the endpoint was pending).
5. Run the wizard: guest count first, recommendation second, your details third. Check nicolas@guest-ly.com received the lead. Confirm the payment step shows either your real Stripe link or the honest fallback.
6. Verify no testimonials from people who do not exist. Read the Founding section: is every sentence true today?
7. Open /privacy, /terms, /refunds.
8. `npm run build && npx serve dist`, then `curl -s localhost:3000 | grep "Ask anything"`: real copy in the HTML.
9. Review BUILD-LOG.md numbers and the screenshot folder.
10. If satisfied: approve, and only then merge `wave5-landing-rebuild` to `main` (this deploys).

---

# PART 13: BEGIN

Restate the eight workstreams in one line each. List any conflict between this document and the current code or any PENDING input you need. Then start Workstream A and work through everything without stopping, run Part 11, and come back with the audit table, the blockers, and the test script.

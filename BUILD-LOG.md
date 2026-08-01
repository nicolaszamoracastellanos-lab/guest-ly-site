# Wave 5 Build Log

Branch: wave5-landing-rebuild. Source of truth: wave5-master-prompt.md.
Every workstream logs its GOAL, BUILD, VERIFY, REVISE cycles here. Verification is always rendered output (Playwright screenshots at 390x844 and 1440x900, both themes) or an executed check, never reasoning from code.

Pending inputs at start (Part 1): PAY_LINKS (all three), SANDBOX_BOT.endpoint, WHATSAPP_ORDER_NUMBER, LEGAL.entity_name. CANONICAL_PRICING provided and matches the codebase (199/399/699, coordinator 79 one-time or 19/mo).

---

## Workstream A: semantic theme layer + day/night mode

GOAL: Semantic tokens with night and day scopes on <html data-theme>, resolution ladder (localStorage 'gl-theme', then prefers-color-scheme, then night), no-flash bootstrap, live OS follow when no explicit choice, Day/Night pill in nav + mobile bar + burger menu, theme-aware WebGL (night pixel-identical), legibility fixes (grain mask + reduction, softer night vignette, AA-compliant muted text, skip link, inert FAQ panels).

### Cycle A-0: night baseline (before any change)
Captured docs/wave5-screens/baseline-night/ (hero, cards, pricing, faq open and closed, 390x844 + 1440x900). Hero inspected: petals, bokeh, glass card, marquee all present.

### Cycle A-1: token refactor + theme system
BUILD: tokens.css rewritten (raw palette at :root, semantic scopes for night/day), overlay.css and index.css fully migrated to semantic tokens (zero raw palette references left in components, verified by grep), theme store (src/theme/theme.ts) + React binding, no-flash bootstrap inline in index.html head, color-scheme + theme-color metas, Day/Night pill in desktop nav + phone bar + burger menu, theme-aware WebGL (THEME_SCENE map in Experience.tsx, lerped bg/fog/lights/exposure, per-theme petal opacity and emissive, bokeh color/opacity/blending, silk tint), 2.4 legibility fixes (night faint text 46% -> 52% ivory, vignette 0.55 -> 0.38 and pushed out, grain 0.05 -> 0.03 + masked off the central column + dropped on phones, skip link, FAQ answers inert when collapsed, aria-controls).
VERIFY 1: night after-shots vs baseline: visually identical apart from the intentional pill + faint-text fixes. Day hero/pricing/faq clean at both viewports.
REVISE 1: 390px nav overflowed with the second pill (flex gap 1.5rem too wide). Fixed: mobile gap 0.5rem, tighter theme-pill padding. Re-shot ES day 390 (widest case, Dia/Noche): fits. PASS.
VERIFY 2 (contrast, programmatic): scripts/contrast.mjs composites real computed tokens and computes WCAG ratios. All 24 pairs PASS at >= 4.5:1 (night min 5.01, day min 5.11). Note: day gold text uses #7a5f33 ("deep gold near #8A6D3E"; #8A6D3E itself measured 4.4:1 on ivory and failed, so the tone was deepened to pass).
VERIFY 3 (ladder smoke): OS light -> day PASS; OS dark -> night PASS; stored beats OS PASS; live OS flip followed when no explicit choice PASS; explicit click stores and stops following PASS; data-theme resolved at document commit (no flash) PASS.

Committed: cd3eb6d.

---

## Workstream B: 9-section IA + Three Pillars

GOAL: New section order (hero, marquee, pillars, how, pricing, founding, faq, final CTA, footer), Pillars.tsx as the only new disclosure component, Channels/Included/Portal/Difference/Testimonials deleted as standalone sections with every factual claim migrated into pillar expanders, truth pass on claims, buyer-question nav labels, under 600 visible EN words at first paint.

### Cycle B-1
BUILD: copy.ts rewritten in full (new SiteCopy interface, EN + ES; no em dashes, no emojis, honest claims: "Fully bilingual English and Spanish, with best-effort answers in other languages", SMS/Telegram demoted to one coming-soon note inside pillar one, stats row 24/7 / 0-questions-at-2am / EN-ES / ~7d, badge tense fixed to "Built for our own 400-guest wedding"). Pillars.tsx (grid-rows expander, plus rotates to cross, gold border when open, aria-expanded/aria-controls, inert when collapsed). Sections.tsx reduced to SectionHeader + How + FinalCta. Dead CSS for the five deleted sections removed (~400 lines).
VERIFY (screenshots): pillars collapsed + expanded, how, pricing, founding, faq, footer at 390x844 + 1440x900, night + day, EN + ES (56 shots, docs/wave5-screens/b-final). Inspected: pillars open state (day 1440), pillars ES night 390, founding night 1440: all clean.
REVISE 1: footer wrapped its new Legal column badly; grid updated to four columns at >=820px. Re-shot: clean.
VERIFY (word count, scripts/wordcount.mjs): counts words in text nodes with a visible rendered box; collapsed (inert) panels excluded; the marquee's aria-hidden duplicate animation track counted once; off-canvas skip link excluded. Result: 599 total (537 excluding the decorative multilingual marquee), was 1,944 per the master prompt. PASS (<600), stable across 3 runs.
VERIFY (keyboard): Tab reaches pillar toggle PASS; Enter expands (aria-expanded false->true) PASS; aria-controls resolves PASS; collapsed bodies inert PASS; Enter collapses PASS.

Committed: 47a3db4.

---

## Workstream C: live hero demo + hero copy + wizard inversion

GOAL: ChatCard upgraded to a real typeable chat behind the LIVE_DEMO flag (scripted fallback while SANDBOX_BOT_ENDPOINT is PENDING), client guardrails (6 msgs/session, 250 chars, 1 per 3s, in-memory state), graceful degradation, honest live label; hero stats and badge per Part 4.2; wizard inverted to 4 steps (guest count + date + city first, recommendation second, contact third with lead capture, honest payment last).

### Cycle C-1
BUILD: ChatCard.tsx dual-mode (live: autoplay opener then real input + sending chips; scripted: cleaned loop). Wizard.tsx rewritten: range radios map to recommended tier ("{guests} guests fits {plan}", 300+ flagged for capacity confirmation), coordinator add-on checkbox (locked to included on Grande), FormSubmit fires at end of step 3, step 4 = summary incl. date and add-on + pay link/fallback + refund line linking /refunds. docs/sandbox-bot-setup.md written (fictional tenant, no keys in this repo, server-side IP rate limiting + low max_tokens).
VERIFY (wizard walkthrough, scripts/wizard-test.mjs, EN night 1440 + ES day 390): 18/18 PASS, including FormSubmit payload intercepted at the network layer (dry: request aborted, real inbox untouched) with correct field set, add-on flag and step 1 date. Screenshots of steps 1 to 4 in docs/wave5-screens/c-wizard.
REVISE 1: four step labels crowded the sheet header at 390px; phones now label only the current step.
VERIFY (live demo, endpoint temporarily set and mocked at network layer, then reverted to PENDING): live placeholder PASS; honest "fictional wedding" label PASS; typed message gets reply PASS; rate-limit copy PASS (screenshot c-live/live-rate-limit.png); outage degrades to napping fallback PASS; chip sends PASS; session cap copy PASS (screenshot c-live/live-session-cap.png).

Committed: 20dc0ec.

---

## Workstream D: pricing, honest and singular

GOAL: canonical pricing (199/399/699 one-time; coordinator 79 one-time or 19/mo, included with Grande) propagated everywhere; plan cards at 5 feature lines max; competitor table deleted and replaced by the single Zola line; zero stray prices.

### Cycle D-1
BUILD: Pricing.tsx rebuilt (cards + Zola line + coordinator strip + guarantee; founding banner moved to the Founding section, one place only). Feature lists now 4 lines per card. Comparison table component, copy and CSS deleted.
VERIFY (grep): stray price tokens (97|247|447|747|267|547|897|2,499|$5/mo|$12/mo) in src: zero (one false positive: the 247 channel of an rgba() ivory in tokens.css). All $19/mo|$19/mes occurrences sit in coordinator context: PASS. Screenshots: pricing at both viewports/themes clean; nothing horizontally scrollable at 390px anymore.
OUTSIDE THIS REPO (for the final summary): PLATFORM-STATE.md, DECISIONS.md, Stripe products, Notion pricing docs must be reconciled by Nico if they still carry the old creation-fee model.

---

## Workstream E: truth layer

GOAL: no fabricated social proof anywhere, in either language; Founding Couples section with the true present-tense story; FoundingProof slot for real testimonials.

### Cycle E-1
BUILD: Testimonials component deleted with its copy (Valentina & Diego, Camila & Rodrigo, past-tense Alexandra & Nicolas quote, five-star rows, "Real weddings" kicker, past-tense badges). Founding.tsx: kicker "The origin", title "Built for our own wedding first", present-tense body, founding offer card (30% off, Coordinator included, honest testimonial, ends Aug 31 2026), CTA opens the wizard. FoundingProof.tsx returns null on the empty proof array.
VERIFY (grep): Valentina|Camila|Rodrigo|star glyph in src: ZERO. "couldn't believe"|"Real weddings"|5-star fragments: ZERO. proof: [] present in both locales. Screenshots: founding section night/day, both viewports (docs/wave5-screens/b-final).

---

## Workstream F: performance + SEO

GOAL: capability-gate the WebGL layer (deviceMemory <= 4, saveData, reduced motion, context failure -> static themed gradient), pause the frameloop when hidden/offscreen, phone dpr cap 1.5 and no grain, code-split three.js behind the gradient, build-time prerender with JSON-LD, font preloads, image compression. Initial JS chunk under 300KB uncompressed.

### Cycle F-1
BUILD: capabilities.ts gate; App lazy-loads the Experience chunk after first paint with .static-stage as fallback and as the permanent gated backdrop; FrameloopGovernor (visibilitychange + IntersectionObserver safety net; the stage is fixed so it is never offscreen today); dpr [1, 1.5] under 720px; GSAP moved into a deferred scroll-driver chunk (it only feeds the WebGL progress store, so gated-off users never load it); prerender script (scripts/prerender.mjs) snapshots /, /privacy, /terms, /refunds from the built dist under forced reduced motion (markup = React's first client render), strips js-ready/is-visible so the no-JS fallback keeps working, forces night-default markup, and main.tsx hydrates when the root has children; JSON-LD Product (three canonical offers) + FAQPage (5 items) inline in index.html; two critical latin woff2 files preloaded; silk.jpg recompressed 165KB -> 72KB; unused hero.png/vite.svg deleted; lint-copy wired into the build and as a blocking job in deploy.yml.
NUMBERS (real, from vite): initial JS 255.19KB uncompressed / 79.34KB gzip (target <300KB: PASS); deferred: driver 113.10KB, Experience (three.js) 888.71KB, total JS 1,257KB (was: single 995KB-class eager bundle including three+gsap up front). CSS 37.75KB.
VERIFY (built output, served dist): curl finds real copy ("Ask anything, any hour, in their language", "Three promises") in the HTML PASS; /privacy /terms /refunds resolve as real prerendered files with correct titles PASS; both JSON-LD blocks parse PASS; page hydrates with zero console errors and the canvas mounts after paint PASS; reduced-motion run: static backdrop, no canvas, Experience and gsap chunks never even fetched PASS.
VERIFY (Lighthouse 12, mobile emulation, simulated throttling): performance 37 (old committed build) -> 60 (new dist). FCP 4.7s -> 3.5s, LCP 5.3s -> 3.6s, TBT 2,880ms -> 1,070ms, Speed Index 6.0s -> 3.5s. Remaining cost is hydration of the full page; acceptable for this wave, logged honestly.

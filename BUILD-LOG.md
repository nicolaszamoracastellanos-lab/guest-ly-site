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

# Guest·ly Content Generation Guide (v2)

Version 2.0. August 2026. Supersedes v1 (July 2026).

What changed from v1: the Demo Reels workflow now contains the itemized sanitize checklist (Section 4), and the batch schedule is reconciled with the marketing plan's 3-hour cap (Section 6). Everything else (brand tokens, tool map, MCP prompts, prompt rules, asset sizes) carries over unchanged and is reproduced here so this document stands alone.

---

## Open questions to close before Week 1

Same table as the marketing plan; the two items that live primarily in THIS document are #4 and #7.

| # | Open item | Blocks | Owner |
|---|---|---|---|
| 1 | LLC approval (filed, pending). Default: free founding motion proceeds personally, paid activity waits. | Founding-30 offer wording | Nico |
| 2 | WhatsApp still on Twilio sandbox; Meta approval not yet in. Default: captions say "WhatsApp demo" until approved. | Any "live on WhatsApp" claim in reel captions or end cards | Nico |
| 3 | Handle availability unverified. Priority: guestly, guest.ly, guestly.ai, tryguestly, getguestly. | Avatar and wordmark exports in Week 1 | Nico |
| 4 | Time budget mismatch resolved in this v2: 3-hour cap covers production only (Section 6 now totals 180 min including capture); the daily DM block is pipeline time. Marketing plan is authoritative; this document now matches. Confirm the split. | Whether the Section 6 batch session is sustainable | Nico |
| 5 | Paid bridge for founding clients. Default: creation fee waived, 3 months included, standard hosting after, testimonial in exchange. | CTA end-card copy that references the founding offer | Nico |
| 6 | Alex & Nico wedding as anchor. Default: founding story, hero asset swapped for first client wedding by day 90. | Which footage gets recorded and how end cards frame it | Nico |
| 7 | Sanitize checklist: WRITTEN, in Section 4 below. Needs Nico's read-through and sign-off before the first Pillar 1 capture. | All Pillar 1 recordings | Nico |

---

## 1. Brand Tokens (paste these into every prompt)

- **Navy:** #0D1B2A (primary background)
- **Ivory:** #FAF6F0 (light background)
- **Gold:** #B8965A (accent, the diamond)
- **Warm white:** #FFFDF9
- **Typography:** Cormorant Garamond (serif headlines) + Jost (sans body)
- **Logo files:** guestlyonnavy.png, guestlyonivory.png, guestlyblack.png, guestlywhite.png
- **Aesthetic:** editorial, elegant, minimal, warm, destination-wedding luxury, generous whitespace
- **Never:** neon, heavy gradients, stock-photo cheese, clip art, emojis in designs

**Reusable brand block (copy-paste):**

```
Brand: Guest·ly, an AI wedding concierge. Palette: deep navy #0D1B2A,
ivory #FAF6F0, gold accent #B8965A. Typography: elegant serif headlines
(Cormorant Garamond style), clean geometric sans body (Jost style).
Mood: editorial, minimal, warm, destination-wedding luxury. Generous
whitespace. No gradients, no neon, no clip art, no emojis.
```

Note for on-ivory designs: #B8965A gold fails WCAG AA contrast on ivory backgrounds (a known Wave 5 site fix). In social designs, use gold on NAVY for text, and on ivory use gold only for decorative elements (dividers, the diamond), with navy carrying all readable text.

---

## 2. Tool-to-Asset Map

| Asset type | Primary tool | Why | Backup |
|---|---|---|---|
| Demo reels (screen recordings) | iPhone screen record + CapCut | Real product footage beats anything generated | QuickTime |
| Carousels | **Canva MCP** | Templated, repeatable, text-heavy | Claude Design |
| Quote/stat cards | **Canva MCP** | Fast, brand-kit driven | Higgsfield image |
| Atmospheric imagery | **Higgsfield MCP** (generate_image) | Photorealistic scenes Canva cannot do | Skip |
| Short cinematic b-roll (5 to 8 sec) | **Higgsfield MCP** (generate_video) | Animate stills for reel intros | Static image |
| One-pagers, mockup-grade layouts | **Claude Design** | Pixel-level brand control | Canva |
| Phone device frames | Canva smart mockups or shots.so | Fast framing | Claude Design |
| Background removal, upscaling | **Higgsfield MCP** | Already connected | Canva remover |

**Rule of thumb (unchanged):** text-heavy assets go to Canva, scene assets go to Higgsfield, product/UI assets are real screen recordings. Never generate fake bot conversations with AI imagery: real screenshots ARE the proof, and generated UI reads as fake instantly.

---

## 3. MCPs Connected and How to Use Them

### 3.1 Canva MCP (design workhorse)

Workflow: generate from a full brief in this chat, adjust text manually in Canva, resize once (1080x1350 feed, 1080x1920 story, 1200x627 LinkedIn), export. Build the master carousel template ONCE, duplicate forever.

**Master carousel template prompt (run once):**

```
Using Canva, create a 7-slide Instagram carousel template, 1080x1350.
[PASTE BRAND BLOCK]
Slide 1 (hook): navy background, large ivory serif headline centered,
small gold diamond accent, tiny "Guest·ly" wordmark bottom center.
Slides 2-6 (content): ivory background, navy serif heading top-left,
navy sans body text, gold number top-right, thin gold divider.
Slide 7 (CTA): navy background, ivory serif line "Your guests have
questions. Your bot has answers.", gold button shape reading
"DM us GUEST", wordmark below. All text as placeholders.
```

**"12 Questions" carousel prompt (plan post #8):**

```
Using Canva, create a 7-slide Instagram carousel, 1080x1350.
[PASTE BRAND BLOCK]
Slide 1 hook: "The 12 questions every destination wedding guest WILL
ask you". Slides 2-6: two questions per slide, numbered 1-12, navy
serif question with a one-line gold-on-navy sans sub-answer.
Questions: How do I get there? / Do I need a visa? / What currency
do I bring? / What is the weather? / What do I wear? / Can I bring
a plus-one? / Where do I stay? / How do I get from the airport? /
Is it safe? / What plugs do they use? / How much do I tip? / What
gift do I bring?
Slide 7 CTA: "Or... a bot answers all 12. Instantly. In two
languages. DM us GUEST."
```

**Stat card prompt (plan post #10):**

```
Using Canva, create a single Instagram post, 1080x1350.
[PASTE BRAND BLOCK]
Navy background. Giant ivory serif "98%" centered upper third. Below,
smaller sans: "of WhatsApp messages get opened." Thin gold divider.
Then: "Your wedding website? 9%." Bottom: small gold line "Put your
answers where your guests already are." plus the wordmark.
```

### 3.2 Higgsfield MCP (scenes, b-roll, utilities)

Use for atmospheric openers and b-roll only. Never for anything containing UI, logos, or rendered text (add text in Canva afterward).

**Destination atmosphere prompt:**

```
Generate an image with Higgsfield: editorial wedding photography style,
a long elegant dinner table set outdoors in a South American vineyard
at golden hour, warm candlelight, mountains softly out of focus, ivory
linens, gold accents, no faces in focus, cinematic 35mm depth of field,
warm grade leaning ivory and gold, vertical 4:5, empty space in the
upper third for a text overlay.
```

**Overwhelmed-couple intro frame (plan post #9):**

```
Generate an image with Higgsfield: editorial lifestyle photo, an elegant
couple at a kitchen table at night lit by phone glow, both looking at
one phone with mild exhaustion, wedding planning binder and passports
on the table, moody warm tones with deep navy shadows, cinematic,
shallow depth of field, vertical 9:16, faces partially turned away.
```

**Animate a still (5 sec b-roll):**

```
Using Higgsfield, animate this image into a 5-second video: slow subtle
push-in, candle flames flickering, gentle depth-of-field breathing,
no camera shake, cinematic and calm.
```

Utilities: "Use Higgsfield to remove the background from this image" / "Use Higgsfield to upscale this image 2x."

### 3.3 Claude Design (brand-exact layouts)

Best for one-pagers and planner pitch visuals where template gravity fights the brand.

**Planner one-pager prompt:**

```
Design a one-page visual for Guest·ly aimed at wedding planners.
[PASTE BRAND BLOCK]
Top navy band: wordmark plus "Your guests' questions, answered before
they reach you." Middle ivory section: three columns (WhatsApp + Web,
English + Spanish, Destination travel intelligence), each with a navy
serif heading and two-line navy sans description. Gold-on-navy
pull-quote band: "One planner. 120 guests. Zero midnight taxi
questions." Bottom: "Partner with Guest·ly" and the site URL.
Export at 1080x1350 and US Letter.
```

### 3.4 Notion MCP (ops)

Create two databases in Mission Control: **Social Pipeline** (post title, pillar, channel, status idea/drafted/designed/scheduled/posted, publish date, asset link, performance notes) and **DM Leads** (name, source post, wedding location, stage, next step, date).

---

## 4. Demo Reels: The Non-Negotiable Workflow (with the v2 sanitize checklist)

Pillar 1 is real footage. The capture process:

1. **Prepare** a clean test environment (see checklist below). This step is new and mandatory.
2. **Capture:** iPhone screen recording of a WhatsApp exchange with the bot (test contact, Spanish first), plus the web chat on mobile Safari.
3. **Edit in CapCut:** trim to 30 to 45 sec, auto-captions styled ivory/gold, 1-second navy title card at the START is wrong: open ON the question being typed, logo at the END. CTA end card from Canva.
4. **Export** 1080x1920, post as Reel, pin.

### 4.1 Sanitize checklist (run BEFORE recording, verify frame-by-frame AFTER)

Rule zero: **never record a real guest's conversation.** All demo footage comes from a fresh test thread on a test contact. The checklist exists because real data can still leak into a "test" recording through the device itself.

| # | Item to check | Where it leaks | Fix |
|---|---|---|---|
| 1 | Real guest names | Chat history visible when opening WhatsApp, contact autocomplete, forwarded-message headers | Record inside a dedicated test thread only; never show the chat list screen; archive real threads before recording |
| 2 | Phone numbers | Contact header at top of chat, status bar carrier info, message metadata, the sandbox number itself | Name the test contact "Guest·ly Demo" (no number visible in header); decide deliberately whether the Twilio sandbox number may appear on camera, and if not, crop the header |
| 3 | Twilio sandbox join code | The "join <word-word>" onboarding message at the top of any sandbox thread | Scroll it out of frame or delete it from the test thread before recording; the code lets anyone join your sandbox |
| 4 | The planner's real number (Raquel) | The bot's own answers include her WhatsApp number by design | Either get her written OK to appear in public marketing, or use a test knowledge base with a dummy planner number for recordings. Do not broadcast a real person's phone number without consent. |
| 5 | Email addresses | Autocomplete, notification banners | Do Not Disturb ON for the entire capture session |
| 6 | Physical addresses beyond public venue info | Bot answers about hotels/venues are fine (public); anything about where a specific person is staying is not | Test questions only ask about public logistics, never "where is [person] staying" |
| 7 | RSVP details, party sizes, plus-one info | Bot or admin surfaces tied to real guests | Never record the admin panel; demo the guest-facing surfaces only |
| 8 | Dietary, accessibility, or medical notes | Any real guest-linked record | Same as #7: guest-facing surfaces only, test data only |
| 9 | Notification banners (any app) | Incoming texts, emails, Slack during recording | Do Not Disturb + Airplane-mode check before every take; re-record if a banner slips through |
| 10 | Status bar personal info | Carrier name, low battery, personal hotspot indicator | Crop the status bar in CapCut, or record with the status bar excluded |
| 11 | Device personalization | Wallpaper, device name in screen-mirror titles, keyboard suggestions revealing typed history | Fresh keyboard (disable predictive for the session), neutral wallpaper if any home screen appears |
| 12 | Real conversation history in the WEB chat | Browser autofill, localStorage of prior sessions | Record web demos in a private/incognito window every time |
| 13 | The Zola links on camera | Fine to show (public site), but they anchor the brand to the Alex & Nico wedding | Consistent with open item #6: acceptable during the founding-story phase, revisit at day 90 |

**Sign-off rule:** the first time this checklist is used, Nico reviews the raw capture frame-by-frame before it enters CapCut. After two clean captures, spot-checking the final export is enough.

---

## 5. Prompt Engineering Rules

Unchanged from v1:

1. Always paste the brand block; generation tools have no memory of the palette.
2. Text belongs in Canva/Claude Design; scenes belong in Higgsfield. Never ask an image model to render words.
3. Specify composition space ("empty upper third for text overlay").
4. Specify aspect ratio in the prompt (4:5 feed, 9:16 reels, 1.91:1 LinkedIn).
5. One asset, one prompt, iterate one variable at a time.
6. Batch by tool, not by post.
7. Save every good prompt in a Notion Prompt Library page next to its asset.

---

## 6. Weekly Batch Session (reconciled with the 3-hour cap)

Authoritative budget lives in the marketing plan (open item #4): **3 hours/week production**, split Monday 90 min (captions and scripts), Tuesday 60 min (visuals, below), Wednesday 30 min (scheduling). The daily 10-minute DM block is pipeline time, outside this cap. The v1 version of this section fit inside Tuesday's 60 minutes and still does:

- 0:00 to 0:10 — Screen-record new bot demos (checklist pre-run on Monday so capture is capture, not prep)
- 0:10 to 0:30 — Canva MCP: duplicate master template, fill this week's carousel and cards
- 0:30 to 0:40 — Higgsfield: 1 or 2 atmosphere images or b-roll clips
- 0:40 to 0:55 — CapCut: cut the reel, captions, CTA end card
- 0:55 to 1:00 — Assets into Notion Social Pipeline, status "designed"

Overrun rule: if Tuesday exceeds 60 minutes two weeks running, cut Pillar 4 assets first, then Pillar 2. Pillar 1 and the master-template discipline are never cut.

---

## 7. Quick-Reference: Asset Sizes

| Placement | Size | Ratio |
|---|---|---|
| IG feed post / carousel | 1080 x 1350 | 4:5 |
| IG Reel / Story | 1080 x 1920 | 9:16 |
| IG avatar | 320 x 320 | 1:1 (gold diamond mark alone if the wordmark is unreadable small) |
| LinkedIn post image | 1200 x 627 | 1.91:1 |
| LinkedIn article header | 1920 x 1080 | 16:9 |

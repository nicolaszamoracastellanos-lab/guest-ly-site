# Guest-ly App Store screenshots, set v3 (app 1.2.0, build 13)

Ten panels per language, 1320 x 2868 PNG (App Store 6.9 inch), sRGB, no alpha. Same visual system as v2 (photo backdrops, CSS phone, lifted callouts, ivory chapter panels).

- Output: `../ios-6.9/en-US/v3/` and `../ios-6.9/es-MX/v3/` (ES goes to the Spanish (Mexico) localization).
- Upload copies: `../ios-6.9/{en-US,es-MX}/v3-jpg/` (JPEG q94, about 300 to 560 KB each; the 2 MB+ PNGs failed in App Store Connect before).
- Contact sheets: `../sheets/v3/`.
- v1 (`../ios-6.9/*/raw`, `*/framed`) and v2 (`../ios-6.9/*/v2`) are untouched. The `assets/` folder now holds the v3 inputs (the v2 renders stay as finished PNGs).

## How it is built

1. **Captures.** Real screens of the 1.2.0 Release simulator build (iPhone 17 Pro Max simulator, status bar 9:41 / full bars / 100 %, battery not charging), EN and ES (app language switched through the `gl.lang` key), from the `demo-review` wedding on production `https://app.guest-ly.com`. Native PNGs live in `raw/` (git-ignored; 31 files). Sessions were injected with `scripts/part9/inject-session.mjs` (couple, planner, guest via the CAMAND link); nothing was sent, saved or approved.
2. **Assets.** `python3 tools/prepare.py raw` copies the screens the panels use into `assets/screens/{en,es}/` (JPEG q94) and cuts the lifted callouts from those same captures into `assets/callouts/{en,es}/` (boxes in `crops.json`; `"tight": true` snaps a rough box to the card edge). It also writes `boxes.js`.
3. **Layout.** `index.html` + `styles.css` + `panels.js`. All panels sit side by side on one strip (panel *i* starts at x = 1320 x *i*) so the photo backdrops run across neighbouring panels. The phone frame is drawn in CSS. Every word is live type: Jost (headlines, body) and Cormorant Garamond (wordmark only), embedded from `assets/fonts/` (SIL OFL, licences included). The wordmark is "Guest" + a drawn rotated-square gem + italic "ly", never a typed character; the TM appears once, on the hook.
4. **Render.** `node render.mjs all` (or `en` / `es`, optionally `--only 06-broadcast`; `SET=v4` writes another folder). Uses Playwright; it looks for it in this folder, then `$PLAYWRIGHT_FROM`, then `~/Desktop/guest-ly/guestly-portal-deploy`. Screenshots at deviceScaleFactor 1, then flattens to RGB (python3 + Pillow; on this Mac use `/usr/local/bin/python3`, the Homebrew one has no Pillow). It warns if a headline block runs into a phone.
5. **Review.** `python3 tools/sheets.py ../sheets/v3 [set]` writes contact sheets: full set at 440 px, search scale at 300 px, and the search-result trio (panels 1-3, EN over ES).
6. **JPEGs.** Pillow, quality 94, RGB, same names, into `v3-jpg/`.

Open `index.html?lang=es` in a browser to inspect the strip.

## Panels

| # | EN | ES | Screen (callouts) |
|---|----|----|--------|
| 01 | Every guest. Every answer. | Cada invitado. Cada respuesta. | Guest home (invitation) + concierge Q&A |
| 02 | RSVP for the whole party | Confirma por todo tu grupo | Guest reply screen (Grant Adler's card) |
| 03 | Ask anything. Get answers. | Pregunta lo que quieras | Ask tab (parking answer) |
| 04 | Where to be, right now | Dónde estar, ahora mismo | Guest day-of (schedule card) |
| 05 | Every RSVP as it lands | Cada confirmación, al instante | Couple Guests tab (ivory) + the RSVP card from couple Home |
| 06 | Message every guest on WhatsApp | Avisa a todos por WhatsApp | New broadcast composer (template chips, message preview) |
| 07 | Every tool in one place | Todo en un solo lugar | Couple Tools tab (Budget and Tasks tiles) |
| 08 | Seat everyone, table by table | Sienta a todos, mesa por mesa | Couple seating (seated, still unseated) |
| 09 | Check-in at the door | Registro en la puerta | Door check-in: a real guest pass in the scan frame + the CHECKED IN card |
| 10 | Planners propose. Couples approve. | Tú propones. La pareja aprueba. | Couple approval screen + the planner's Waiting on the couple card (ivory) |

Dropped from v2: "Straight to the couple" and "Your wedding, set up in minutes".

## Image sources

- App screens and callouts: captured from Guest-ly 1.2.0 in the iOS Simulator (demo wedding `demo-review`, fictional guests; venue names fictional: Capilla de Los Tilos, Hacienda Los Tilos, Hotel Brisa del Valle).
- `assets/photos/*.jpg`: generated for Guest-ly with Higgsfield (model nano_banana_2, 4K, 21:9) on 30 Sep 2026; prompts asked for no people, no text, no logos. Job ids d2adc0cf-c816-4d45-af7b-dbdee35b8528, b8462cb7-ef9a-4955-96c1-0eef4d9bc4b0, be9b0361-bd54-4620-82ce-f8f9754976a2, 5d01ddc1-c017-427a-8249-1665dfe407a0. Downscaled to 4400 px wide JPEG.
- Photos inside the app screens are the app's own `assets/photos` (Higgsfield placeholders, see BUILD-LOG decision 13).

### What is not a fresh capture, and why

- **Concierge Q&A (01, 03).** Production does not store concierge Q&A on the server yet; the app keeps it on the phone (`gl.concierge.history:<scope>`). Asking again would write to production, so the phone history was seeded with the concierge's own answers from the v2 capture (30 Sep 2026, verbatim) and rendered by the 1.2.0 Ask screen. The ES first question is typed guest text.
- **CHECKED IN card (09).** Tapping a name or scanning checks the guest in (a POST). The card is the v2 capture (`c-{en,es}-checkin-card.png`, copied into `raw/`); the card code is unchanged since 1.1. The scan screen behind it is a fresh capture.
- **Template chips (06, ES).** The Spanish chip row overflows the screen, so the chips callout comes from a second capture with the row scrolled (`c-es-compose-chips.png`).

## Panel 09: the pass in the camera

The simulator has no camera, so `tools/scan.py raw` builds the camera feed: the real guest pass for the demo guest on that card (Kevin O'Brien EN, Brandon Mitchell ES), from `https://app.guest-ly.com/pass/demo-review?g=<guest id>&lang=<en|es>` (`assets/pass/pass-{en,es}.png`, kept from v2), shown as a printed pass with a slight tilt over a blurred venue, under the app's own 35 % scrim. The captured app UI is laid back on top unchanged (lighten blend). Run it before `prepare.py` after a recapture.

## Soft focus

A lifted card is bigger than its source, so it would half-cover neighbouring UI. `soft` on a device lists bands in native px: `[y0, y1]` (full width), `[x0, y0, x1, y1]` (a rectangle) and an optional trailing `"light"` (blur without dimming, for text over a photo). `fade: y` sinks everything below y into the night (hook). No half-covered text stays legible. v3 also uses it to keep demo-data artefacts out of focus:

- 04: the top clock (real capture time, past midnight), the ceremony note (demo data, see below) and, in ES, the Getting there and Dress code cards (English only in the demo data).
- 06: the recipient counts, the no-phone note, the Demo banner and the disabled Send (demo guests have no phone numbers).
- 08: the "0 free seats" tile.
- 10 (ES): the planner's note and reply, typed in English.

## Recapturing

The demo account credentials are in `~/Desktop/guest-ly/guestly-mobile/credentials/demo-accounts.env` (never print them); guest invite code CAMAND, guest Whitney Adler. Capture from a copy of the app built for the simulator (never inside the worktree). The floating Coordinator bubble remembers its place in AsyncStorage (`assistant-bubble`, `{side, frac}`); set it per screen so it sits where a soft band or nothing important is. After a recapture, rerun `tools/scan.py raw` and `tools/prepare.py raw`, check the crops in `crops.json` (text length moves cards), then render.

Production safety while capturing: open screens, scroll, open composers and cancel. Never confirm a broadcast, submit an RSVP, approve or decline a request, tap a name on the door check-in, ask the concierge, request a template or regenerate a code.

# Guest-ly App Store screenshots, set v2 (app 1.1)

Ten panels per language, 1320 x 2868 PNG (App Store 6.9 inch), sRGB, no alpha.

- Output: `../ios-6.9/en-US/v2/` and `../ios-6.9/es-MX/v2/` (ES goes to the Spanish (Mexico) localization).
- The v1 files (`../ios-6.9/*/raw`, `*/framed`) are untouched.

## How it is built

1. **Captures.** Real screens of app 1.1 (Release build, iPhone 17 Pro Max simulator, status bar 9:41 / full bars / 100 %), EN and ES, from the `demo-review` wedding on production. Native PNGs live in `raw/` (git-ignored; 24 files).
2. **Assets.** `python3 tools/prepare.py` copies the screens the panels use into `assets/screens/{en,es}/` (JPEG q94) and cuts the lifted callouts from those same captures into `assets/callouts/{en,es}/` (boxes in `crops.json`; `"tight": true` snaps a rough box to the card edge). It also writes `boxes.js`.
3. **Layout.** `index.html` + `styles.css` + `panels.js`. All panels sit side by side on one strip (panel *i* starts at x = 1320 x *i*) so the photo backdrops run across neighbouring panels. The phone frame (titanium band, bezel, Dynamic Island, side buttons) is drawn in CSS. Every word is live type: Jost (headlines, body) and Cormorant Garamond (wordmark only), embedded from `assets/fonts/` (SIL OFL, licences included). The wordmark is "Guest" + a drawn rotated-square gem + italic "ly", never a typed character; the TM appears once, on the hook.
4. **Render.** `node render.mjs all` (or `en` / `es`, optionally `--only 03-concierge`). Uses Playwright; it looks for it in this folder, then `$PLAYWRIGHT_FROM`, then `~/Desktop/guest-ly/guestly-portal-deploy`. Screenshots at deviceScaleFactor 1, then flattens to RGB (python3 + Pillow). It warns if a headline block runs into a phone.
5. **Review.** `python3 tools/sheets.py <dir>` writes contact sheets: full set at 440 px, search scale at 300 px, and the search-result trio (panels 1-3, EN over ES).

Open `index.html?lang=es` in a browser to inspect the strip.

## Panels

| # | EN | ES | Screen |
|---|----|----|--------|
| 01 | Every guest. Every answer. | Cada invitado. Cada respuesta. | Guest home (invitation) + a real concierge Q&A |
| 02 | RSVP for the whole party | Confirma por todo tu grupo | Guest RSVP per person and event |
| 03 | Ask anything. Get answers. | Pregunta lo que quieras | Concierge chat |
| 04 | Straight to the couple | Directo a los novios | Guest messages: question passed to the couple, couple's reply |
| 05 | Where to be, right now | Dónde estar, ahora mismo | Guest day-of |
| 06 | Every RSVP as it lands | Cada confirmación, al instante | Couple RSVPs (ivory chapter panel) |
| 07 | Seat everyone, table by table | Sienta a todos, mesa por mesa | Couple seating |
| 08 | Check-in at the door | Registro en la puerta | Door check-in: a real guest pass in the scan frame (see below) + the real CHECKED IN card |
| 09 | Planners propose. Couples approve. | Tú propones. La pareja aprueba. | Couple approval screen + planner's request card (ivory) |
| 10 | Your wedding, set up in minutes | Tu boda, lista en minutos | Couple sign-up |

## Image sources

- App screens and callouts: captured from Guest-ly 1.1 in the iOS Simulator (demo wedding `demo-review`, fictional guests; venue names fictional: Capilla de Los Tilos, Hacienda Los Tilos, Hotel Brisa del Valle, Valle de Guadalupe).
- `assets/photos/table-vineyard.jpg`, `courtyard-night.jpg`, `candles-still.jpg`, `valley-dusk.jpg`: generated for Guest-ly with Higgsfield (model nano_banana_2, 4K, 21:9) on 30 Sep 2026; prompts asked for no people, no text, no logos. Job ids d2adc0cf-c816-4d45-af7b-dbdee35b8528, b8462cb7-ef9a-4955-96c1-0eef4d9bc4b0, be9b0361-bd54-4620-82ce-f8f9754976a2, 5d01ddc1-c017-427a-8249-1665dfe407a0. Downscaled to 4400 px wide JPEG.
- Photos inside the app screens (invitation, day-of, sign-up) are the app's own `assets/photos` (Higgsfield placeholders, see BUILD-LOG decision 13).

## Panel 08: the pass in the camera

The simulator has no camera, so `tools/scan.py` builds the camera feed: the real guest pass for the demo guest on that card (Kevin O'Brien EN, Brandon Mitchell ES), screenshotted from `https://app.guest-ly.com/pass/demo-review?g=<guest id>&lang=<en|es>` into `assets/pass/pass-{en,es}.png` (its QR encodes that guest's id), shown as a printed pass with a slight tilt over a blurred venue, under the app's own 35 % scrim. The captured app UI is laid back on top unchanged (lighten blend). Run it before `prepare.py` after a recapture.

## Soft focus under lifted cards

A lifted card is bigger than its source, so it would half-cover neighbouring UI. `soft: [[y0, y1]]` on a device (native px) blurs and dims that band of the screen with feathered edges; `fade: y` sinks everything below y into the night (hook). No half-covered text stays legible.

## Recapturing

The demo account credentials are in `~/Desktop/guest-ly/guestly-mobile/credentials/demo-accounts.env`; guest invite code CAMAND, guest Whitney Adler. Capture from a copy of the app built for the simulator (never inside the worktree). After a recapture, rerun `tools/prepare.py`, check the crops in `crops.json` (text length moves cards), then render.

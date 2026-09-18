# Part 9 harness: the app on simulators, plus the automation that reaches every route

Wave Sep 18 2026, branch `mobile/part9-audit`. This is the record of what WORKED on this Mac,
with the exact commands. The plan is `docs/wave-sep18/PLAN-mobile.md` at the repo root; where
this file and the plan disagree, this file is what was proven.

Everything talks to the LIVE API at app.guest-ly.com. Only the demo-review tenant, only its demo
accounts, invite code CAMAND and the guest Sofía Rojas. No secrets are in this file.

## 0. Rules that every command below obeys

- Shell state does not persist between agent tool calls. Start EVERY command with
  `source /Users/nicolas_z/Desktop/guest-ly/guestly-mobile/scripts/part9/env.sh`.
- macOS has no `timeout` binary. zsh does not word-split unquoted variables (wrap multi-path git
  commands in `bash -c '...'`).
- Passwords live only in `guestly-mobile/credentials/demo-accounts.env` (gitignored, easignored,
  mode 600, keys `PART9_COUPLE_EMAIL`, `PART9_COUPLE_PASSWORD`, `PART9_PLANNER_EMAIL`,
  `PART9_PLANNER_PASSWORD`). Never `cat` it. Scripts read it; nothing prints it.
- One password grant per simulator and role. Never copy a session to a second simulator. Use
  `--role keep` (or `walk.mjs --session keep`) for a language change.
- Never: send, remind, approve, decline, publish, delete account, email a sign-in link, finish
  Apple or Google sign-in. Plan section 8.4 has the full list.
- A screenshot is not a pass. Open it with the Read tool.

## 1. Tool versions that worked

| Tool | Version | How it got here |
|---|---|---|
| Xcode | 26.6, iOS 26.5 simulator runtime | already installed |
| Node | 24.16.0 | already installed |
| eas-cli | 23.2.0 (through `npx eas`) | already installed |
| Java | OpenJDK 17.0.20.1 | `brew install openjdk@17` |
| Maestro | 2.10.0 | official installer: `curl -fsSL "https://get.maestro.mobile.dev" \| bash` (never `brew install maestro`, that is another product) |
| Playwright + Chromium | the copy in `guestly-portal/node_modules/playwright` | imported by absolute path, read-only, no second install |

Maestro 2.10.0 DOES attach to the iOS 26.5 runtime. idb was not needed.

## 2. Simulators

| Letter | Device | UDID | Points | Use |
|---|---|---|---|---|
| S | GL-S iPhone SE3 (created for this wave) | `B9898E62-D4D4-452A-B4B0-460D4A016ED2` | 375x667 | small phone, home button |
| M | iPhone 17e | `30398ECB-3A6B-4A34-BC77-B9FB8B4EF25F` | 390x844 | pass A11 |
| L | iPhone 17 Pro Max | `615D5183-56C3-4184-BC78-0FAB711D9A50` | 440x956, 1320x2868 px | large phone, store size |
| T | iPad mini (A17 Pro) | `B1D6BA49-2379-4886-BA9B-3A3FB4C71897` | iPhone compatibility mode | tablet column |
| P | iPad Pro 13-inch (M5) | `F5F84E6A-4E3B-4417-A413-368E0A5BAC81` | iPhone compatibility mode | spot check |

The letters are defined in `scripts/part9/env.sh` and in `scripts/part9/lib.mjs`. Boot at most two
at a time (disk and memory).

```
source scripts/part9/env.sh
bash scripts/part9/sim.sh create          # once; prints the UDID of the SE, already stored as GL_UDID_S
bash scripts/part9/sim.sh boot S          # boot, dark appearance, 9:41 status bar, keyboard tutorials marked seen
bash scripts/part9/sim.sh boot T
```

On iPadOS 26.5 the iPhone-only app runs in a rounded compatibility WINDOW over the wallpaper
(not the old letterbox). That is what App Review sees; it is normal, not a defect.

## 3. The simulator binary (EAS cloud build, profile `sim-dev`)

- Profiles `sim-dev` and `sim-release` are in `eas.json` (commit 9a38dfd). Neither has
  `autoIncrement`, so the remote build number stays 7.
- Build started with:
  `npx eas build -p ios --profile sim-dev --non-interactive --no-wait --json > .part9/build-sim-dev.json`
- Build id `d267d22f-c9fd-4f44-bc3b-6751541f44d4`, from commit 9a38dfd, SDK 57, app 1.0.0 (7).
  Queue 5 s, build 9 min 2 s (18:51 to 19:01 UTC). Status FINISHED.
- **Build budget: 1 of 3 simulator builds used.** No production build, no submit, no update.
- Download and install:

```
source scripts/part9/env.sh
URL="$(npx eas build:view d267d22f-c9fd-4f44-bc3b-6751541f44d4 --json | python3 -c "import json,sys; print(json.load(sys.stdin)['artifacts']['applicationArchiveUrl'])")"
curl -L -o .part9/sim-dev.tar.gz "$URL" && mkdir -p .part9/sim-dev && tar -xzf .part9/sim-dev.tar.gz -C .part9/sim-dev && rm .part9/sim-dev.tar.gz
bash scripts/part9/sim.sh install S .part9/sim-dev/Guestly.app      # also T, L, M, P as needed
bash scripts/part9/sim.sh grant S                                    # camera + photos for the populated passes
```

  The app is `.part9/sim-dev/Guestly.app` (313 MB unpacked). `sim.sh install` also writes the dev
  menu switches (see gotcha G2).
- No JS change needs a rebuild: `sim-dev` loads JS from Metro. No new native module was added.

## 4. Metro, launch, deep links, screenshots

```
source scripts/part9/env.sh
cd "$GL_ROOT" && npx expo start --dev-client --port 8097 --no-dev --minify --clear     # run_in_background
bash scripts/part9/sim.sh launch S            # terminate, then open the dev client link that loads the bundle
bash scripts/part9/sim.sh open S /couple/budget
bash scripts/part9/sim.sh shot S .part9/probe/x.png
```

- Port 8097 is explicit (8081 and 3000 can belong to other apps). First bundle takes about 5 s to
  build and up to 90 s to load.
- `--no-dev --minify` means no LogBox and no fast refresh. To pick up a JS change:
  `bash scripts/part9/sim.sh launch <dev>`.
- Dev client link: `exp+guestly://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8097`
  (the `exp+guestly` scheme IS registered). App routes: `guestly:///couple/budget`.

## 5. Signing in without typing: `inject-session.mjs`

```
node scripts/part9/inject-session.mjs --udid S --role couple  --lang es
node scripts/part9/inject-session.mjs --udid L --role planner --lang en
node scripts/part9/inject-session.mjs --udid T --role guest   --lang en    # needs .part9/ids.json
node scripts/part9/inject-session.mjs --udid S --role keep    --lang en    # language only, no grant
node scripts/part9/inject-session.mjs --udid S --role none    --lang en    # signed out
```

How: with the app terminated it writes the app's AsyncStorage files inside the simulator
container (`Library/Application Support/com.zcventures.guestly/RCTAsyncLocalStorage_V1/`):
`manifest.json` holds values up to 1024 bytes inline; a larger value goes to a file named by the
MD5 hex of its key, with `null` in the manifest. Couple and planner get a fresh Supabase password
grant written as `sb-twkwdgwvottotseefnbf-auth-token`. Guests use the product's own link
`guestly:///i/CAMAND?g=<guestId>` and then `guestly:///guest` to step past the notification
pre-prompt. `gl.lang` is always written, so neither the device locale nor the wedding default
can override the language. `gl.query.cache` is removed so no stale-language content shows.

Switching ONE simulator between roles works: the guest token stays in the keychain, but the app
only honours it together with `gl.guest.meta`, which every couple, planner and none injection
removes (proven on S: guest through the UI, then `--role couple`, home came up as the couple).

**Calibrated against a real UI sign-in (Sep 18):** after `signin-ui.yaml` passed, the manifest held
`gl.lang` inline and `sb-twkwdgwvottotseefnbf-auth-token` as `null` with the MD5-named file next to
it; the session JSON fields were `access_token, expires_at, expires_in, refresh_token, token_type,
user, weak_password`. The script writes the same shape (without the optional `weak_password`).

The script never prints or saves a token. On failure it prints the HTTP status only.

## 6. Ids for dynamic routes: `resolve-ids.mjs`

`node scripts/part9/resolve-ids.mjs` (read only, one grant per role, asserts demo-review) writes
`.part9/ids.json`: ids only, no token, no email. Before the seed, the lists that are empty on
demo-review give `null`, and the walker reports those routes as `skipped: no id` instead of
guessing. Run it again after `seed-demo.mjs`.

## 7. Walking the route manifest: `walk.mjs`

`scripts/part9/routes.json` has 102 rows: 9 signed out, 14 guest, 59 couple (including the shared
screens S01 to S10), 20 planner. 99 are reachable by deep link; S08 (biometric lock) is manual,
S09 (update overlay) needs the proxy, S10 (bubble states) needs Maestro.

```
node scripts/part9/walk.mjs --device S --role couple  --lang es                 # fresh grant, all couple rows
node scripts/part9/walk.mjs --device S --role couple  --lang en --session keep  # same session, language only
node scripts/part9/walk.mjs --device L --role planner --lang es
node scripts/part9/walk.mjs --device T --role guest   --lang en
node scripts/part9/walk.mjs --device S --role none    --lang en
node scripts/part9/walk.mjs --device S --role couple --lang es --only C02,C11 --scroll --tag A4
node scripts/part9/sheet.mjs --dir .part9/shots/L/es/planner                     # contact sheets, 3 per row, 1800 px
```

Output: `.part9/shots/<device>/<lang>/<role>[/<tag>]/<id>-<state>.png`, a 1400 px JPEG twin under
`jpg/`, `index.json`, and `sheets/sheet-NN.jpg` from `sheet.mjs`. Guest links are paced seven
seconds apart (10 calls a minute per IP on `/auth/guest/open`). Rows marked `modal` trigger a
relaunch after capture, because a deep link opened while a modal is up lands underneath it.

### Evidence from this step (all images were opened and looked at, as sheets or singly)

| Walk | Captured | Skipped | Time | What the images show |
|---|---|---|---|---|
| S, none, EN | 9 | 0 | 39 s | entrance, invite with keyboard, find, three notify surfaces, sign-in, expired link, bad code |
| S, couple, ES | 71 | 12 | 5 min 43 s | every couple screen in Spanish; 9 skips are empty lists before the seed, 3 are S08 to S10 |
| L, couple, EN | 4 | 0 | 16 s | home, guests, RSVPs, More in English on the Pro Max |
| L, planner, ES | 15 | 5 | 1 min 17 s | planner home, guests, requests (empty), tasks, budget, vendors, More; skips are empty lists |
| L, planner, EN | 3 | 0 | 12 s | home, guests, More |
| T, guest, EN and ES | 14 + 14 | 0 | 1 min each | guest home, RSVP, confirm, schedule, concierge, day-of, messages, More, six site pages, in the iPad compatibility window |

Entrance seen on S (`shots/S/en/none/E01`), L (`probe/l-now.jpg`) and T (`probe/t-entrance.jpg`).
Couple, planner and guest each reached their home in EN and in ES. That is the harness done-bar.

## 8. Maestro flows (`.maestro/`)

| Flow | What it does | Proven |
|---|---|---|
| `prep.yaml` | accepts the iOS sheet "Open in Guest-ly?" and closes the dev menu | yes, used by every walk |
| `launch.yaml` | included launch step: dev client link, or `launchApp` with `-e GL_BINARY=release` | yes |
| `signin-ui.yaml` | the true sign-in through the UI | yes, passed in ES on S at 18:17 CDT |
| `invite-ui.yaml` | code, name search, pick, optional notification skip | yes, passed in ES on S (CAMAND, "Sof", Sofía Rojas), see G6 and G7 |
| `scroll-shots.yaml` | four screenshots while scrolling to the end | yes: `/couple/more` on S gave three different pages, p3 equals p4 (end reached) |
| `open-sheet.yaml` | tap a control, capture the sheet, close it | yes: guests list tools sheet on S |
| `keyboard.yaml` | focus a field, capture with the keyboard up | yes: guests search on S |
| `tap-point.yaml` | one tap at a relative point, for system alerts Maestro cannot see | yes |

Screenshot flows go through `flow.mjs`, which moves the PNGs out of Maestro's run folder and
deletes the rest:

```
node scripts/part9/flow.mjs --device S --flow scroll-shots.yaml --to .part9/shots/S/es/couple/A4 --env NAME=C11-more
node scripts/part9/flow.mjs --device S --flow open-sheet.yaml  --to <dir> --env TARGET_TEXT="Herramientas de la lista" --env NAME=C02-tools
node scripts/part9/flow.mjs --device S --flow keyboard.yaml    --to <dir> --env TARGET_TEXT="Buscar invitados" --env NAME=C02-keyboard
node scripts/part9/tap-targets.mjs --device S --name C02-guests-es      # controls under 44 pt on the CURRENT screen
```

The sign-in flow types a password, so `flow.mjs` refuses it. Run it directly, and delete the run
folder straight after (Maestro stores the resolved text of every `inputText`):

```
source scripts/part9/env.sh; set -a; source credentials/demo-accounts.env; set +a
node scripts/part9/inject-session.mjs --udid S --role none --lang es --no-launch
maestro --device "$GL_UDID_S" test -e EMAIL="$PART9_COUPLE_EMAIL" -e PW="$PART9_COUPLE_PASSWORD" \
  -e HOME_TAB=tab-rsvps -e DEVCLIENT_URL="$GL_DEVCLIENT_URL" .maestro/signin-ui.yaml
rm -rf ~/.maestro/tests
```

`HOME_TAB` is `tab-rsvps` for the couple and `tab-requests` for the planner. The flow asserts that
the password field is on screen before it taps submit, so it can never email a real link.

## 9. Forcing states: `proxy.mjs`

```
node scripts/part9/proxy.mjs                                            # run_in_background, 127.0.0.1:8787
EXPO_PUBLIC_API_BASE=http://127.0.0.1:8787 npx expo start --dev-client --port 8097 --no-dev --minify --clear
curl -s "http://127.0.0.1:8787/__part9/mode?set=fail"                   # pass slow fail fail-html offline expired update hang
curl -s "http://127.0.0.1:8787/__part9/mode"                            # current mode and hit count
```

Proven on S, couple, ES, `/couple/guests`: `pass` showed the list, `fail` changed the screen, `pass`
restored it (`.part9/probe/px-1-pass.png`, `px-2-fail.png`, `px-3-pass-again.png`; the proxy console
showed the 500s and then the 200s). Rules: `--clear` every time the base changes; see hits in the
proxy console before capturing; `/web` screens are never audited through the proxy; after a proxy
pass restart Metro WITHOUT the variable (again with `--clear`) and confirm one real data screen.
Metro is on the direct base right now (checked in the process environment).

Lead for the audit, seen in `px-2-fail`: with the API failing, the guests list shows its EMPTY
state ("Empiece por las personas...") instead of an error (plan H11).

## 10. Web rig: `web-rig.mjs` (360, 390, 430, 768, 1024, 1440)

```
cd "$GL_ROOT" && npx expo export -p web --output-dir .part9/web        # about 10 MB, rebuild after JS fixes
node scripts/part9/web-rig.mjs                                          # everything: 4 roles, 2 languages, 6 widths
node scripts/part9/web-rig.mjs --roles guest,couple,planner --widths 360,1440 --langs es
```

It serves the export itself (with an SPA fallback), launches Chromium with `--disable-web-security`
(the live API sends no CORS headers for localhost; local rig only), CLICKS through the UI, and
records `overflow_px` per screen in `.part9/web-shots/index.json`. Safety built in: the Supabase
OTP endpoint is answered locally for the whole run, so the "link sent" state never sends an
email; a never-click rule covers sign out, leave, delete, send, remind, approve, decline; one
sign-in per role per run; tracing, video and HAR are off. The guest surface works on web because
of `src/lib/secure.web.ts` (localStorage, web only, never in a native bundle).

### Evidence from this step

The signed-out set ran at 360 in ES (entrance, invite, sign-in link mode, the link-sent state with
the OTP call answered locally, password mode). Guest, couple and planner each ran end to end at
360 and 1440 in ES: 89 screenshots in 6 minutes (guest 13 per width: five tabs, the RSVP form
scrolled to its end, the six site pages and messages; couple 17 to 20 per width: five tabs and
every More tile; planner 12 per width). Never-click notes recorded "Salir de esta boda" and
"Recordar a 16 pendientes" as skipped. `tab-budget is not visible` for the planner is correct: the
demo planner has four tabs (the same four the simulator shows).

**Artifact found and fixed:** that first full run resized one live page from width to width. The
virtualized lists did not lay out again, the tab bar lost its icons at 1440, and the draggable
assistant bubble kept its old x position, which read as 16 px of horizontal overflow on EVERY
screen at 360. The rig now reloads at the root after every width change (`sizeSignedIn`). Proof:
planner, 360 and 1440, ES, 24 screenshots, 0 with overflow, layouts correct (both widths opened
and looked at). The misleading first-run shots were deleted; `.part9/web-shots/` holds only the
run with the reload. The full six-width, two-language run belongs to pass A9 of the audit step.

The signed-out set was run again at 360 and 1440 in ES into `.part9/web-shots-none/` (10
screenshots). One REAL overflow: the entrance at 360 is 420 px wider than the window, which is
exactly the 780 px photo minus 360 (plan H12, `ImageBackground` keeps the intrinsic width).

Real leads already visible at 1440: every surface stretches edge to edge (search field, rows, tab
bar, buttons), as plan H12 predicted.

## 11. Demo content: `seed-demo.mjs` (NOT applied in this step)

The plan runs pass A1 (empty states) BEFORE seeding, so the harness step only built and dry-ran it:

```
node scripts/part9/seed-demo.mjs --dry-run     # read only. Ran clean on Sep 18: fence ok for both accounts, reminders off, all lists empty
node scripts/part9/seed-demo.mjs --lang en     # audit step, after A1. Then: node scripts/part9/resolve-ids.mjs
node scripts/part9/seed-demo.mjs --lang es     # retitles in place. --verify checks the EN end state. --remove uses the ledger.
```

**Seed applied at: not yet (as of the end of the harness step).** Every route the script calls
exists in the portal's mobile API (checked against `guestly-portal-deploy/src/app/api/mobile/v1`,
read only), and creating a shared board task sends no email or notification (checked in
`coupleCreateTask`). Field-level payloads have NOT been exercised by a real write yet: the first
real run must be watched, it stops at the first non-2xx and the ledger is saved after every row.

## 12. Gates

`bash scripts/part9/gates.sh` (add `--fast` to skip expo-doctor): tsc, eslint (0 errors, the
baseline of 9 warnings must not grow), em dash, brand spelling, purchase wording, Face ID wording,
real tenant names, JWT-shaped tokens on disk, the two demo password values on disk, feature copy
parity (`copy-parity.mjs`, 16 files). The token gate prints file names only and filters exactly one
value: the PUBLIC Supabase anon key, which the web export inlines by design.

## 13. Gotchas met (each one cost time)

- **G1. "Open in Guest-ly?"** iOS 26.5 shows a system sheet the first time `simctl openurl` is used
  for a scheme on a simulator (once for `exp+guestly`, once for `guestly`). Until it is accepted
  nothing reaches the app (the first iPad walk captured the sheet 14 times). `prep.yaml` accepts it;
  `walk.mjs` and the guest injection run it unless `--no-prep`.
- **G2. Dev menu on top of screenshots.** The dev client keeps its switches in the APP CONTAINER
  preferences, not in the simulator-wide domain. `sim.sh devprefs` writes them to the right plist
  (onboarding finished, no floating button, no launch menu, no shake or touch gesture). Run it
  again if the gear button comes back after a reinstall.
- **G3. Save Password sheet.** After a UI sign-in iOS offers to save the password. While that sheet
  is up Maestro cannot see the app, so the home assertion timed out behind it. The flow now
  declines first ("Not Now" or "Ahora no"), then asserts the home tab. The demo password is never
  saved to the simulator keychain.
- **G4. "Sign in to your Apple Account" alert.** A stray tap on Continue with Apple leaves a system
  alert that Maestro's hierarchy cannot see. Close it with
  `maestro --device <udid> test -e POINT="32%,58%" .maestro/tap-point.yaml` (SE coordinates).
- **G5. Maestro screenshots.** Maestro 2.10 only writes `takeScreenshot` inside its own run folder.
  Flows take a relative NAME; `flow.mjs` and `walk.mjs --scroll` move the files. `hideKeyboard` is
  unreliable on iOS 26.5; the flows press Enter or leave the keyboard for the next deep link.
- **G6. The invite screen opens by itself** when the sixth character lands (`invite.tsx` effect).
  Tapping `invite-open` afterwards either finds nothing or calls `/auth/guest/open` twice. The rig
  and `invite-ui.yaml` only type the code.
- **G7. `/notify` does not show after entering by code and name**, on web AND on the simulators.
  `find.tsx` asks for it, but the session gate counts `/find` as an entrance and moves the fresh
  guest to `/guest` first (audit lead H29 in the wave build log). The rig and `invite-ui.yaml`
  accept both paths. The pre-prompt is captured by deep link (`/notify?surface=...`, rows E04 to
  E06) and appears on the invite LINK path (`/i/CAMAND?g=...`).
- **G8. Sheet scrim.** The scrim fills the screen and the sheet sits over its centre, so a tap on
  the scrim ELEMENT lands on a sheet row. `open-sheet.yaml` taps the strip above the sheet.
- **G9. On the 667 pt phone the sign-in email field starts below the fold**, and iOS only reports
  what is on screen: the flow scrolls until each control is visible.
- **G10. demo-review moved while we watched.** The guests header read 42 parties at 14:52, 41 at
  14:56 and 40 at 18:05 CDT. This step created no guest. Another workstream or person is using
  demo-review through the portal. Counts in screenshots taken hours apart may differ; that is not
  an app defect.
- **G11. `--no-dev` has no fast refresh.** Relaunch to load new JS.

## 14. Deviations from the plan

| Plan | What was done | Why |
|---|---|---|
| 7.4.3 `defaults write com.zcventures.guestly ...` | written to the app container plist path | the simulator-wide domain is not where the dev client reads (G2) |
| 7.7 `query.tsx` imports `@/lib/secure` | only `session.tsx` does | `query.tsx` never imported SecureStore (it only mentions it in a comment) |
| 7.8 static `python3 -m http.server` | the rig serves the export itself with an SPA fallback | a reload at `/` after a language change needs the fallback |
| 7.8 rig clicks `invite-open` | only types the code | G6 |
| 9.3 token gate greps `.part9` for `eyJ` | same, minus the public anon key value | the web export under `.part9/web` inlines that public key by design |
| 3 files list | added `lib.mjs`, `flow.mjs`, `sheet.mjs`, `tap-targets.mjs`, `copy-parity.mjs`, `.maestro/launch.yaml`, `prep.yaml`, `tap-point.yaml` | shared helpers, the C11 contact sheets, pass A8, the 9.3 parity check, the launch subflow of 7.5 |
| seed in the harness step | built and dry-run only | A1 (empty states) must be captured before the seed |

## 15. Not proven in this step (say so in later reports too)

- `sim-release` (not built yet; it belongs to the end of the fix step). `GL_BINARY=release`
  switches `sim.sh launch`, `walk.mjs`, `inject-session.mjs` and `launch.yaml` to `launchApp`; that
  branch has not run.
- A real write by `seed-demo.mjs`.
- M (iPhone 17e) and P (iPad Pro 13) have not been booted; the app is installed on S and T, and was
  on L for the walks above.
- Not testable on this Mac at all: Sign in with Apple and Google end to end, real push delivery,
  QR scanning with a real camera, biometric hardware, Android on any device, a real iPad.

## 16. State left for the next step

- Simulators S and T are booted with the dev client installed; S is signed in as the demo couple
  in Spanish (through the real UI flow), T holds a demo guest session. Metro runs on 8097 on the
  direct API base. The proxy and the web server are stopped.
- `.part9/` (gitignored) holds the app (313 MB), about 230 MB of shots, the web export and ids.json.
  `sim.sh teardown` at the end of the wave erases the simulators and the large folders.
- `~/.maestro/tests` is empty. No token and no password is on disk outside the simulators
  (gates clean).

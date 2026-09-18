# PLAN: Guest-ly mobile app, Part 9 audit on simulators, UI fixes, store readiness

Wave: Sep 18 2026. Branch: `mobile/part9-audit`. Repo root: `/Users/nicolas_z/Desktop/guest-ly`. App: `guestly-mobile/`.
Author: planner agent. Amended by the plan critic on Sep 18 2026 (section 15 lists every change; where an older sentence and section 15 disagree, section 15 wins). Executed by four fresh agents in order: **harness**, **audit**, **fix**, **store**. Each agent has only this file, so everything needed is here.

Copy rules for every file you write in this wave: no em dashes, brand is written Guest-ly, user-facing copy in EN and ES, never a raw error on screen. Secrets never go in a committed file, a report, or terminal output.

---

## 0. Decisions in one screen

| # | Decision | Short reason |
|---|---|---|
| D1 | Simulator binary = EAS cloud build, profile `sim-dev` (dev client, `ios.simulator: true`), JS served by local Metro. A second profile `sim-release` is built once at the end of the fix step for final verification and store captures. Local `expo run:ios` is the fallback only. | Lowest disk (no `ios/`, no Pods, no DerivedData). JS fixes need no rebuild. No Apple credentials needed for simulator builds. |
| D2 | Login automation = session injection, not UI typing. Couple and planner: write a Supabase session into the app's AsyncStorage files inside the simulator container. Guest: the existing deep link `guestly:///i/CAMAND?g=<guestId>`. Language: write `gl.lang` the same way. Maestro is installed for everything that needs a real tap, typing, scroll or hierarchy dump. One password grant per simulator and role; a session is never copied to a second simulator (C6). | Deterministic, zero product code, no password ever typed into a UI or stored in the bundle. Verified in code: `src/lib/supabase.ts` persists to AsyncStorage, `src/app/i/[code].tsx` mints a guest session from the link. |
| D3 | Loading, error, offline, session-expired and update-required states are forced with a tiny local pass-through proxy (`scripts/part9/proxy.mjs`) that Metro points the app at. | The live API cannot be made to fail on demand, and we must never break production to test. |
| D4 | **iPad: lock to phone for 1.0** (`ios.supportsTablet` stays `false`). The iPad column of the audit is the iPhone compatibility mode that App Review also sees. Separately, the layout is made large-screen safe (max content width) because Android tablets and foldables get no such lock. | Shipping as universal is a one-way door on the App Store, iPadOS 26 windowing requires all orientations and free resizing, the design canvas has no tablet artboards, and the app is a phone companion (door check-in, RSVP). Full justification in section 2.4. |
| D5 | Marketing version stays `1.0.0`. Build numbers are remote (`appVersionSource: remote`): next iOS build is 8, next Android versionCode is 5, both auto. No new native modules in this wave. | 1.0.0 was never released; ASC already has version 1.0 in Prepare for Submission. Same runtime version keeps OTA compatibility with TestFlight build 7. |
| D6 | The demo-review tenant gets display content seeded **through the mobile API as the demo couple** (tasks, budget, vendors, seating tables, run sheet, one RSVP question, one open planner request). Empty states are captured first. The seed stays in place for App Review; a ledger allows removal. The seed obeys the side-effect rules in section 2.6 (C1): the planner request is created once, reminders stay off, no collaborator, no contact details. | Verified today: those lists are all empty on demo-review, so populated states, store screenshots and App Review would otherwise show empty screens. No SQL, no service role, demo tenant only. |
| D7 | Raw audit screenshots live in gitignored `guestly-mobile/.part9/`. Only defect evidence (downscaled JPEG) and the final store set are committed. | About 550 full-resolution PNGs would add close to 1 GB to git. |

---

## 1. Current state found in code (verified Sep 18 2026)

### 1.1 Repo and tooling

- `guestly-mobile/` is an Expo SDK 57 app (`expo ~57.0.20`, RN 0.86.3, React 19.2.3, expo-router 57, reanimated 4.5). Managed workflow: `ios/` and `android/` do not exist and are gitignored. `AGENTS.md` says: read `https://docs.expo.dev/versions/v57.0.0/` before writing code.
- Baseline gates today: `npx tsc --noEmit` clean; `npx eslint src` 0 errors, 9 warnings; grep gates clean (0 em dashes, 0 hits for `stripe|checkout|upgrade|pricing`, 0 middle-dot brand spellings).
- `app.config.ts`: bundle `com.zcventures.guestly`, scheme `guestly`, `orientation: "portrait"`, `userInterfaceStyle: "dark"`, `supportsTablet: false`, `runtimeVersion: { policy: "appVersion" }`, EAS project `1c6ed3fa-7393-40e1-be3d-6fd64f0e1056`, owner `nzamoras-team`.
- `eas.json`: profiles `development` (dev client, internal), `preview`, `production` (autoIncrement). `cli.appVersionSource: "remote"`. No simulator profile yet. `submit.production.android` points at `credentials/google-service-account.json`, which does not exist (only `asc-api-key.p8` is there).
- EAS: logged in (`npx eas whoami` answers, accounts `n_zamora`, `nzamoras-team`). Seven builds so far this month; last iOS = build 7 (`9295e07b`, commit 718c15f, already in App Store Connect), last Android = versionCode 4 (`6f087837`).
- `/Users/nicolas_z/Desktop/guest-ly/.easignore` uploads only `guestly-mobile/**` minus `node_modules`, `.expo`, `credentials`. Note: `guestly-mobile/.env` IS uploaded (public values only, by design).
- This Mac: Xcode 26.6, iOS 26.5 runtime, simulators iPhone 17e, 17, 17 Pro, 17 Pro Max, Air, iPad mini (A17 Pro), iPad Pro 13 (M5) and others. Device types for `iPhone SE (3rd generation)` and `iPhone 13 mini` exist, so a 375 pt simulator can be created. Homebrew present. **No Java, no Maestro, no CocoaPods, no idb, no ImageMagick, no ffmpeg, no Android SDK.** `sips` exists. Free disk about 30 GB.
- Playwright with cached Chromium exists at `/Users/nicolas_z/Desktop/guest-ly/guestly-portal/node_modules/playwright` (read-only use; import it by absolute path, do not install another copy).
- `guestly-portal/` and `guestly-portal-deploy/` are separate git repos owned by other work. **Read-only for this wave.** API payload docs: `guestly-portal-deploy/docs/mobile-api.md` and `guestly-portal-deploy/docs/mobile-api/*.md`.
- **Publishing hazard:** `.github/workflows/deploy.yml` uploads the whole repo root to GitHub Pages (guest-ly.com) on every push to `main`. Anything committed on this branch becomes public if the branch is merged to main. Nothing secret may be committed, and the lead decides about the merge (section 13).

### 1.2 App structure

- 103 `.tsx` files under `src/app`: 93 screens plus 10 layouts (counted Sep 18; full inventory in section 8.2). Root `src/app/_layout.tsx` holds providers, the session gate (redirects by role), the biometric lock overlay, the update overlay and the floating `AssistantBubble`.
- Three tab layouts use the custom `GlassTabBar` (`src/ui/TabBar.tsx`): `guest/_layout.tsx`, `couple/_layout.tsx`, `planner/_layout.tsx`.
- Component kit in `src/ui/index.tsx` (Screen, TopBar, Button, IconButton, Chip, Segmented, Toggle, LangToggle, Input, ListRow, Sheet, EmptyState, Banner, Skeleton...). Tokens in `src/ui/tokens.ts`. One text component `src/ui/Text.tsx` (`maxFontSizeMultiplier={1.3}`).
- i18n: `src/i18n/en.ts`, `es.ts` (typed against EN), per-feature `src/features/*/copy.ts`. Ladder in `src/i18n/index.tsx`: stored choice `gl.lang`, else device locale, and `applyTenantDefault` overrides the device locale whenever the user has not chosen explicitly.
- Session: `src/lib/session.tsx`. Guest token in SecureStore (`gl.guest`), guest meta in AsyncStorage, couple and planner through Supabase Auth persisted in AsyncStorage. `src/lib/api.ts` reads the API base from `Constants.expoConfig.extra.apiBase` first, then `EXPO_PUBLIC_API_BASE`.
- There are **zero `testID` props** in the app today.

### 1.3 Demo data (live API, read-only probe today)

- Demo logins work: `review@guest-ly.com` (owner) and `planner-review@guest-ly.com` (planner) both returned HTTP 200 from the Supabase password grant. **Do not reset them.** The passwords currently live only in `~/.claude/jobs/8bc32a88/tmp/PARITY-BRIEF.md` (section "Verification you must run", item 4). The harness step copies them to a durable gitignored file (section 7.2).
- Guest: invite code `CAMAND`, query `Sof` returns exactly one candidate (Sofía Rojas).
- demo-review `locale_default` is `en` (seed in `guestly-portal-deploy/docs/migrations/mobile-v1.sql`), so an English review phone stays English; H14 is a product question, not an App Review blocker.
- Both demo logins are on the `guest-ly.com` domain, which the portal treats as staff (`src/lib/ops.ts` `STAFF_DOMAINS`): `tenantCoupleEmails` and `tenantTeamEmails` filter them out, so portal notification emails for demo-review have no member recipient. The ops contact of the tenant (if one is set) is NOT filtered. This is why section 2.6 and 8.4 restrict which writes are allowed.
- demo-review has: 40 guests, 24 RSVPs, 3 conversations, 2 events, brain facts published, website config, 4 broadcast templates, 2 top questions in insights.
- demo-review is **empty** for: tasks, budget, vendors, seating tables, run sheet, requests, broadcast history, RSVP questions, Coordinator sessions, planner tasks.

### 1.4 Defect hypotheses from reading the code

These are leads, not findings. The audit confirms or clears each one with a screenshot, and looks for everything else too.

| ID | Where | Suspected problem |
|---|---|---|
| H1 | `src/ui/TabBar.tsx` | Labels and badge use raw `Text` at 10 px with no `maxFontSizeMultiplier` and no `numberOfLines`. Spanish planner labels "Presupuesto" and "Solicitudes" are tight at 375 pt and will overflow with large Dynamic Type. |
| H2 | `src/ui/index.tsx` `Input` and raw `TextInput`s | No `maxFontSizeMultiplier`, no `keyboardAppearance="dark"` (a light keyboard under a dark app when the system is in light mode). |
| H3 | `src/ui/index.tsx` | Tap targets under 44 pt: `IconButton` 40x40, `Chip` minHeight 36, `Segmented` segment minHeight 36, `Toggle` 44x26 (hitSlop 8 gives 42 high), `LangToggle` text plus hitSlop 10 is about 36 high. Inline text links: sign-in "use a password", find "tell the couple". |
| H4 | `Button` | `numberOfLines={1}` silently truncates long Spanish labels on narrow phones. |
| H5 | `Sheet` and 18 files using `Sheet` or `Modal` | Fixed `top` offsets from 120 to 420. On a 667 pt tall phone a `top={420}` sheet is 247 pt tall. No scroll inside, no keyboard avoidance inside the modal. |
| H6 | 22 files | `KeyboardAvoidingView` is placed inside the `Screen` ScrollView, where it cannot work. `Screen`'s `keyboard` prop only sets the dismiss mode. Inputs near the bottom are probably hidden by the keyboard. Chat screens (`assistant.tsx`, `guest/concierge.tsx`, `couple/messages/[id].tsx`) need a composer check. |
| H7 | 89 call sites | `router.back()` with no `canGoBack()` fallback. A screen opened by deep link or push tap has no history, so the back button does nothing. |
| H8 | `src/app/sign-in.tsx:41`, several `Alert.alert(copy.common.error, "")`, `couple/insights/index.tsx:31` | Supabase's raw English `err.message` is shown to the user; alerts with an empty body; `Alert.alert("")` can show a blank alert. The missing-env `Alert` names env vars. |
| H9 | `TopBar`, `IconButton`, `Sheet` | Hardcoded English accessibility labels ("Back", "Close", and the icon name such as "gear" or "bell" when no label is passed). |
| H10 | `src/app/find.tsx`, `src/app/guest/index.tsx` | Raw ISO date (`2027-03-21`) shown instead of `shortDate` or `longDate`. |
| H11 | for example `guest/index.tsx`, `couple/guests/index.tsx` | Queries read only `data` and `isLoading`; `isError` is ignored. With no cache and a failing API the screen is blank or a permanent skeleton. No shared error component exists. |
| H12 | `src/app/index.tsx` and every full-bleed hero | Verified today on the web rig at 1024 px: the 780 px entrance photo does not cover (dark band on the right) and buttons stretch the full width. Same cause as the FILL gotcha in `tokens.ts` (`ImageBackground` keeps the intrinsic width). Matters on Android tablets and foldables (target SDK 36 ignores the portrait lock on large screens). |
| H13 | `src/app/index.tsx` | Verified on the web rig at 360 px: the trademark line wraps next to the language toggle. |
| H14 | `src/i18n/index.tsx` | The header comment says device locale beats the wedding default, the code does the opposite. An English phone may flip to Spanish after opening demo-review, which would confuse App Review. Confirm `locale_default` of demo-review and the intended ladder, then fix or document. |
| H15 | `src/ui/Text.tsx` | Global 1.3 cap is a fine policy; find every text that escapes it (raw `Text`, `TextInput`, native alerts) and every layout that breaks at 1.3. |
| H16 | `app.config.ts` infoPlist | `NSPhotoLibraryUsageDescription` describes a shared album that does not exist (real use: website images, floor plan, budget receipt). `NSCameraUsageDescription` omits floor plan and receipt photos (`couple/seating/plan.tsx`, `features/budget/screens/Import.tsx`). `NSLocationWhenInUseUsageDescription` exists although location is never read. No Spanish purpose strings (`locales`). Guideline 5.1.1 risk. |
| H17 | `app.config.ts` privacyManifests, `store/metadata.json` app_privacy | Photos are uploaded to the server, so "Photos or Videos" is collected; metadata says it is not. Phone number is in metadata but not in the privacy manifest. |
| H18 | `guest/concierge.tsx`, `assistant.tsx` | No visible statement that the concierge and the Coordinator are AI (project AI disclosure standard, App Review guideline 5.1.2(i)). Verify in both languages. |
| H19 | `src/app/web.tsx` with `path=/guide` | The portal guide renders inside the app. Check it for pricing, plan or checkout wording and links (guideline 3.1.1). |
| H20 | `src/app/settings.tsx` | The plan line shows the tier. Verify wording has no purchase call to action. |
| H21 | `src/app/_layout.tsx` | `Notifications.getLastNotificationResponseAsync()` rejects on web (seen in the web rig console) and re-runs on every session state change. Guard with `Platform.OS`. |
| H22 | `src/ui/AssistantBubble.tsx` vs FAB in `couple/guests/index.tsx` | Both sit bottom right; possible overlap, and the bubble may cover row badges. |
| H23 | `assets/photos/*.jpg` | 780 px wide sources are upscaled about 1.7x on a 3x Pro Max. Heroes may look soft in store screenshots. |
| H24 | `src/app/_layout.tsx` `UpdateOverlay` | Critic, verified in code: the update-required overlay has a title and a body but no button. The user is stuck on a dead end. Needs a store button (fix in 9.1). |
| H25 | `src/app/web.tsx`, `src/features/webview/bridge.ts` | Critic, verified in code: `/web?path=` is reachable by deep link and signs the web view in as the current user. Probe once, read-only: `guestly:///web?path=//example.com` and `guestly:///web?url=https://example.com` must both end on the refused state, never on a foreign page. File as P0 if a foreign origin renders. |
| H26 | `app.config.ts` `expo-camera` plugin | Critic, verified in `node_modules/expo-camera/plugin/build/withCamera.js`: the plugin injects an English default `NSMicrophoneUsageDescription` ("Allow Guest-ly to access your microphone") and the Android `RECORD_AUDIO` permission. The app never records audio (`mediaTypes: ["images"]` everywhere, no `recordAsync`). Untranslated purpose string on iOS, an undeclared sensitive permission on Play. Fix in section 9.1 item 4. |
| H27 | `src/app/find.tsx:100` | Critic, verified in code: "tell the couple" is gold text styled like a link but has no `onPress`. It is a dead affordance, not a small tap target. Either make it do something that exists or restyle it as plain text. |
| H28 | `src/lib/session.tsx` boot | Critic, verified in code: a guest token in SecureStore wins over a Supabase session at boot, and `expo-secure-store` on web is an empty object, so every SecureStore call throws there. Matters for the harness (C5, C6), not for users. |

---

## 2. Design, with alternatives rejected

### 2.1 Getting the app onto simulators (D1)

Chosen: two new EAS profiles in `eas.json`.

```json
"sim-dev":     { "extends": "development", "ios": { "simulator": true } },
"sim-release": { "extends": "preview", "channel": "simulator", "ios": { "simulator": true } }
```

- `sim-dev` is built once in the harness step. The audit and the fix loop run on it with JS from Metro. Screenshot passes start Metro with `--no-dev --minify` so there is no LogBox toast and `__DEV__` is false; fix iterations can use normal dev mode for fast refresh.
- `sim-release` is built once at the end of the fix step from the fixed commit (embedded JS, release configuration, its own `simulator` update channel so it never pulls an OTA). It is the binary for the final regression walk and the store captures.
- Neither profile has `autoIncrement`, so the remote build number stays at 7 for the lead's production build.
- **Build budget (C9): agents may start at most three simulator builds in this wave** (one `sim-dev`, one `sim-release`, one retry). The month already has seven builds and the lead still needs two production builds. A fourth build needs the lead's yes.

Rejected:
- **Local `npx expo run:ios`**: needs CocoaPods plus 4 to 6 GB of `ios/`, Pods and DerivedData on a tight disk, and 15 to 25 minutes per native build. Kept as the documented fallback if the EAS queue exceeds 90 minutes or the build fails twice (section 7.9).
- **Expo Go**: not the shipping binary, no `guestly://` scheme, no Sign in with Apple entitlement.
- **Only a release simulator build**: every JS fix would need a new cloud build.
- **EAS Update to push fixes into a release simulator build**: it works, but it adds a cloud publish step on the same runtime version as the production channel. One wrong `--channel` flag would ship to TestFlight users. Not worth the risk.

### 2.2 Driving the UI (D2)

Chosen, in layers:

1. `xcrun simctl` for boot, install, deep links (`openurl`), screenshots, status bar, appearance, Dynamic Type, privacy grants.
2. **Session injection** for couple and planner: `scripts/part9/inject-session.mjs` terminates the app, gets a session from `POST {SUPABASE_URL}/auth/v1/token?grant_type=password` with the anon key, and writes it into the app's AsyncStorage files (format in section 7.6). Verified in `node_modules/@react-native-async-storage/async-storage/ios/RNCAsyncStorage.mm`: directory `Library/Application Support/com.zcventures.guestly/RCTAsyncLocalStorage_V1/`, `manifest.json` holds values up to 1024 bytes inline, larger values go to a file named by the MD5 hex of the key with `null` in the manifest.
3. **Guest deep link**: `guestly:///i/CAMAND?g=<guestId>` mints the guest session with no typing; then `guestly:///guest` skips the notification pre-prompt.
4. **Maestro** (CLI 2.10.0 is current, needs Java 17) for what needs real interaction: walking the true sign-in and invite flows once per language, opening sheets and modals, keyboard-open captures, scrolling, and `maestro hierarchy` dumps for the tap target measurements.
5. A small set of `testID`s added in the harness step so Maestro selectors are language independent (list in section 7.7). `testID` is inert for users.

Rejected:
- **A login-by-deep-link route in the app** (`/dev-login?email=&password=`): a login CSRF surface if the gate ever fails, and product code that exists only for tests. Session injection needs no product code.
- **AppleScript or cliclick on the Simulator window**: needs Accessibility permission prompts, breaks when the window moves.
- **idb**: unmaintained installer chain (Python plus a brew tap). Named as the fallback only if Maestro cannot drive iOS 26.5 (section 7.5).
- **`brew install maestro`**: WRONG PACKAGE. Homebrew core's `maestro` is an unrelated product. Use the official installer script or the `mobile-dev-inc/tap`.

### 2.3 Forcing states (D3)

`scripts/part9/proxy.mjs` (Node built-ins only, about 90 lines) listens on `127.0.0.1:8787`, forwards everything to `https://app.guest-ly.com` with streaming (the Coordinator uses SSE), and has a mode switch:

| Mode | Behaviour | State it produces |
|---|---|---|
| `pass` | forward unchanged | normal |
| `slow` | 4 s delay before forwarding | skeletons and loading |
| `fail` | HTTP 500 with the API error envelope for everything except `/api/mobile/v1/auth/*` | error states |
| `offline` | destroy the socket for everything except `/auth/*` | offline banner and cached data |
| `expired` | HTTP 401 for everything except `/auth/*` | session-expired handling |
| `update` | HTTP 426 with code `update_required` | update overlay |

| `fail-html` | HTTP 502 with a short HTML body and no JSON envelope, same exclusions as `fail` | what a real Netlify outage looks like; proves no raw text or blank screen (C8) |
| `hang` | accept the request and never answer | the 20 s client timeout; run on three screens only (one per role) |

Switch with `curl -s "http://127.0.0.1:8787/__part9/mode?set=fail"`.

Proxy rules added by the critic (C8): send `Host: app.guest-ly.com` and the matching TLS server name upstream (Netlify routes by host); never add or forward an `x-forwarded-for` header; refuse any request whose path does not start with `/api/mobile/v1/` while a failure mode is on; keep no request log on disk. Start Metro with `--clear` every time `EXPO_PUBLIC_API_BASE` changes (the value is inlined into the bundle and Metro can serve a cached transform), and confirm the switch by seeing hits in the proxy console before capturing. The `/web` screens are NOT audited through the proxy: `portalOrigin()` derives from the API base, so the web view would load the portal over plain http on 127.0.0.1 and its cookies would not stick. Audit `/web` on the direct base only. After every proxy pass, relaunch on the direct base and confirm one real data screen before continuing. Metro is started with `EXPO_PUBLIC_API_BASE=http://127.0.0.1:8787` for these passes (the shell value wins over `.env`, and `app.config.ts` feeds it into `extra.apiBase`). The proxy never logs headers or bodies. It only works with `sim-dev` (the release build has the real base compiled in), which is fine.

Rejected: mocking the API (would drift from the real payloads), changing product code to add a debug switch.

### 2.4 iPad (D4), the recorded decision

**Lock to phone for version 1.0.** The fix step writes this into `guestly-mobile/BUILD-LOG.md` as decision 14:

1. Adding iPad to a shipped app can never be undone in a later update. Phone-only keeps the choice open.
2. iPadOS 26 runs iPad apps in freely resizable windows. `UIRequiresFullScreen` is deprecated, so a universal app must support all four orientations and arbitrary sizes. The app is `orientation: "portrait"` with photo-led, full-bleed phone layouts. Doing that well is a design project, not an audit fix.
3. The approved design canvas (Direction A, 54 artboards) has no tablet artboards.
4. The product is a phone companion: invitation, RSVP, concierge, door check-in with the camera.
5. A universal app needs a 13 inch iPad screenshot set per language. Phone-only needs only the 6.9 inch set.
6. App Review still runs iPhone apps on iPad in compatibility mode, so that mode is audited on an iPad simulator and must be flawless (no crash, no clipped modal, share sheet and camera permission fine).

What we still do for large screens: Android has no equivalent lock, and with target SDK 36 Android 16 ignores the portrait lock on screens 600 dp and wider. So the fix step adds a max content width and fixes the full-bleed photos (section 6.2). That also makes a future `supportsTablet: true` a small change: flip the flag, remove the portrait lock for iPad, add the 13 inch screenshots, rebuild.

Rejected: shipping universal now with a centered 560 pt column. It would pass review but look unfinished on a 13 inch screen in landscape, and it is irreversible.

### 2.5 Version and build (D5)

- `version` stays `"1.0.0"` in `app.config.ts` and `package.json`. Footer copy stays "Guest-ly 1.0".
- Build numbers are remote and auto: the lead's production build becomes iOS build 8 and Android versionCode 5. `android.versionCode: 1` in `app.config.ts` is ignored under the remote source; the store step adds a one-line comment saying so.
- **No new native modules and no SDK change in this wave.** That keeps runtime `1.0.0` compatible between TestFlight build 7 and build 8 and means `sim-dev` never needs a rebuild. Native *config* changes are allowed (purpose strings, privacy manifest, `locales`); they ride in `sim-release` and in the lead's production build.
- Rejected: bumping to 1.0.1. 1.0.0 never shipped, and ASC already holds version 1.0.

### 2.6 Demo content (D6)

`scripts/part9/seed-demo.mjs` signs in as the demo couple and planner and creates, only when the corresponding list is empty:

- 8 tasks across overdue, today, this week, later and done; 1 checklist.
- 1 budget with 5 categories, about 12 lines, 3 payments (so percent paid is not null).
- 5 vendors across statuses, 2 linked to budget lines.
- 6 seating tables with about half of the attending parties seated.
- Run sheet: use `POST /couple/runsheet/seed` if it builds from the itinerary, else 8 blocks by hand.
- 1 RSVP question (meal choice with 3 options).
- As planner: 1 open `plus_one` request with a note, left **open** (approving executes a guest change).
- 1 short Coordinator question per language during the audit, never confirming any action card.

**Side-effect rules (C1), verified in the portal code on Sep 18:**

- `createRequest` (`guestly-portal-deploy/src/app/planner/requests/actions.ts`) rings the couple's bell and emails every owner or admin whose address is not on a staff domain. For demo-review the only members are `@guest-ly.com`, so no email goes out today. The seed therefore creates the planner request **exactly once per wave** (never delete and recreate it per language; its note is written in English and the ES store capture for slot 08 uses `/planner` home instead). The script reads the `emailSent` flag of the response: if it is ever `true`, stop all seeding and tell the lead, because it means a non-staff member exists on demo-review.
- Task reminder emails (`src/lib/task-reminders.ts`, hourly cron) go out only when the tenant has `tasks.reminders_enabled`; the default is off. The seed reads `/couple/tasks/reminders` first and aborts the task seed if reminders are on. No agent ever turns them on.
- No collaborators, no assignees with an email address. Tasks stay unassigned.
- Vendors and run sheet rows carry no real contact details: no phone numbers, emails only of the form `name@test.guest-ly.com` or empty, fictional business names that are not real companies in Bolivia, Mexico or the US.
- The RSVP question is optional (not required), so the 24 existing RSVPs stay valid.
- Seating uses the API as the couple; it never triggers a guest message.
- Language retitling edits rows in place through the update routes. It never deletes and recreates. The wrap-up (10.5) re-reads every seeded list through the API and asserts the EN titles are back.
- Other workstreams of this wave may be using demo-review through the portal at the same time. The first line of the harness report and of the final report states the time the seed was applied, so the lead can explain a changed count to another agent.

Rules: payload shapes come from `guestly-portal-deploy/docs/mobile-api/*.md`. Content table is bilingual; `--lang en|es` retitles the seeded rows so the EN store set shows English content and the ES set Spanish. Final state is EN. Every created id goes to `guestly-mobile/.part9/seed-ledger.json`; `--remove` deletes them. The script refuses to run unless `/auth/me` reports tenant slug `demo-review`.

---

## 3. Exact files to add or change

All paths relative to `/Users/nicolas_z/Desktop/guest-ly`.

### Harness step

| Action | Path | What |
|---|---|---|
| change | `guestly-mobile/eas.json` | add `sim-dev` and `sim-release` profiles (section 2.1) |
| change | `.easignore` (repo root) | add `guestly-mobile/.part9`, `guestly-mobile/docs/part9`, `guestly-mobile/store/screenshots`, `guestly-mobile/.maestro` so EAS uploads stay small |
| change | `guestly-mobile/.gitignore` | add `.part9/` (goes into the FIRST commit of 7.1 together with `eas.json` and `.easignore`, before anything is written to `.part9/`) |
| add | `guestly-mobile/src/lib/secure.ts`, `guestly-mobile/src/lib/secure.web.ts` | C5: `secure.ts` re-exports `getItemAsync`, `setItemAsync`, `deleteItemAsync` from `expo-secure-store` unchanged (native behaviour identical). `secure.web.ts` is a `localStorage` version that Metro resolves only for the web platform, which is never shipped; its header comment says so. `src/lib/session.tsx` and `src/lib/query.tsx` import from `@/lib/secure`. This is what lets the guest surface be checked at 360 px on the web rig. |
| add | `guestly-mobile/scripts/part9/env.sh` | JAVA_HOME, PATH for Maestro, UDIDs, ports, `MAESTRO_CLI_NO_ANALYTICS=1`; sourced by every command because shell state does not persist between tool calls |
| add | `guestly-mobile/scripts/part9/sim.sh` | subcommands: `create`, `boot`, `install <app>`, `open <udid> <route>`, `shot <udid> <name>`, `statusbar`, `lang`, `dyn <size>`, `appearance`, `erase`, `teardown` |
| add | `guestly-mobile/scripts/part9/inject-session.mjs` | session and language injection (section 7.6) |
| add | `guestly-mobile/scripts/part9/resolve-ids.mjs` | logs in through the API, writes `.part9/ids.json` with first ids for every dynamic route (guest, conversation, request, task, board, vendor, budget category and item, run sheet block, table, broadcast, brain section keys, website section types, guest id of Sofía Rojas) |
| add | `guestly-mobile/scripts/part9/routes.json` | the route manifest (section 8.2): role, route template, states, needs-seed flag |
| add | `guestly-mobile/scripts/part9/walk.mjs` | walks the manifest for one device, role and language: deep link, wait, screenshot, optional Maestro subflow, writes `.part9/shots/<device>/<lang>/<role>/<id>-<state>.png` and an `index.json` |
| add | `guestly-mobile/scripts/part9/proxy.mjs` | state proxy (section 2.3) |
| add | `guestly-mobile/scripts/part9/seed-demo.mjs` | demo content (section 2.6) |
| add | `guestly-mobile/scripts/part9/gates.sh` | tsc, eslint and the grep gates in one command (section 9.3) |
| add | `guestly-mobile/scripts/part9/web-rig.mjs` | Expo web plus Playwright click-through at six widths (section 7.8) |
| add | `guestly-mobile/.maestro/*.yaml` | flows: `signin-ui.yaml`, `invite-ui.yaml`, `scroll-shots.yaml`, `open-sheet.yaml`, `keyboard.yaml` |
| change | about 12 files under `guestly-mobile/src` | `testID` props only (section 7.7) |
| add | `guestly-mobile/docs/PART9-HARNESS.md` | the exact commands that worked, versions, UDIDs, gotchas met |
| add (not committed) | `guestly-mobile/credentials/demo-accounts.env` | demo passwords, mode 600; the folder is gitignored and easignored |

### Audit step

| Action | Path | What |
|---|---|---|
| add | `guestly-mobile/docs/PART9-AUDIT.md` | matrix and defect register (section 8.5) |
| add | `guestly-mobile/docs/part9/evidence/*.jpg` | one downscaled crop per defect |
| change | `guestly-mobile/scripts/part9/routes.json` | corrections discovered while walking |

No product code changes in the audit step.

### Fix step (expected; the defect register is the authority)

| Action | Path | What |
|---|---|---|
| change | `guestly-mobile/src/ui/tokens.ts` | `MAX_CONTENT_WIDTH = 560`, `WIDE_BREAKPOINT = 700`, `SHEET_MAX_WIDTH = 640` |
| change | `guestly-mobile/src/ui/index.tsx` | `Screen` (content width, real keyboard handling, optional error slot), `TopBar` (localized back label, safe back), `IconButton` 44, `Chip` and `Segmented` 44 touch height, `Toggle` and `LangToggle` hit areas, `Button` label fitting, `Input` (`keyboardAppearance`, `maxFontSizeMultiplier`), `Sheet` (height from window, scroll, keyboard, max width), new `QueryError` |
| change | `guestly-mobile/src/ui/TabBar.tsx` | label fitting, font scale cap, max width 520 centered |
| change | `guestly-mobile/src/ui/Text.tsx` | only if the audit finds a gap |
| add | `guestly-mobile/src/lib/nav.ts` | `useSafeBack(fallbackHref)` |
| change | `guestly-mobile/src/i18n/en.ts`, `es.ts` | `common.back`, `common.close`, `common.retry`, `common.errorTitle`, `common.errorBody`, icon labels, sign-in error copy |
| change | `guestly-mobile/src/i18n/index.tsx` | language ladder, if H14 is confirmed |
| change | `guestly-mobile/src/app/index.tsx`, `sign-in.tsx`, `notify.tsx`, `guest/index.tsx` and other hero screens | photo fill, width constraint, raw date |
| change | `guestly-mobile/src/app/sign-in.tsx` | map Supabase errors to bilingual copy, 44 pt password link |
| change | `guestly-mobile/src/app/_layout.tsx` | web guard for notifications (H21) |
| change | screens listed by the audit | per-defect fixes |
| change | `guestly-mobile/app.config.ts` | purpose strings, remove the location string, privacy manifest types, `locales` |
| add | `guestly-mobile/locales/es.json`, `locales/en.json` | localized Info.plist strings |
| change | `guestly-mobile/BUILD-LOG.md` | decision 14 (iPad), decision 15 (large-screen rule), wave log |
| change | `guestly-mobile/docs/PART9-AUDIT.md` | fix status and verified shots |

### Store step

| Action | Path | What |
|---|---|---|
| add | `guestly-mobile/store/screenshots/ios-6.9/{en-US,es-MX}/{raw,framed}/NN-name.jpg` | 1320x2868, no alpha |
| add | `guestly-mobile/store/screenshots/play-phone/{en-US,es-419}/NN-name.jpg` | 1080x1920 framed |
| add | `guestly-mobile/store/icon-512.png`, `store/feature-graphic.png` | Play assets referenced by `docs/PLAY-CONSOLE-SETUP.md` but missing today |
| add | `guestly-mobile/scripts/part9/frame.mjs`, `scripts/part9/frame.html` | HTML plus Playwright compositor for the framed sets and the feature graphic |
| change | `guestly-mobile/store/metadata.json` | final copy, privacy, review notes EN and ES, credential placeholders |
| add | `guestly-mobile/docs/ANDROID-READINESS.md` | section 10.4 |
| change | `guestly-mobile/scripts/screenshots.sh` | replace the stale device names or make it a thin wrapper over `scripts/part9` |
| change | `guestly-mobile/app.config.ts` | comment on remote version source only |
| change | `guestly-mobile/README.md`, `docs/CREDENTIALS-CHECKLIST.md`, `BUILD-LOG.md` | status |

---

## 4. Data model and migration

**No migration.** Nothing in this wave changes a table, a column, an RLS policy or a portal route. The portal repos are read-only here. The app already tolerates `pending_db` answers; the audit verifies the pending state still renders as a calm message (it can be produced with the proxy by rewriting one response if needed, optional). Seeded demo content is ordinary tenant data created through existing API routes as the demo user.

---

## 5. Security and privacy design

- **Secrets.** Demo passwords live in `guestly-mobile/credentials/demo-accounts.env` (keys `PART9_COUPLE_EMAIL`, `PART9_COUPLE_PASSWORD`, `PART9_PLANNER_EMAIL`, `PART9_PLANNER_PASSWORD`), `chmod 600`. The `credentials/` folder is gitignored and easignored. Scripts read the file; nothing echoes it. Never `cat` it, never put a password on a command line that gets logged in a doc, never in Maestro YAML (pass with `-e` from the env file at run time), never in a screenshot (the sign-in UI flow uses `secureTextEntry`; still, do not capture with the password visible).
- **Do not run `create-demo-users.mjs`** while the current passwords work: a reset would invalidate what Nicolas pastes into App Store Connect. Only if a login returns 400: `cd /Users/nicolas_z/Desktop/guest-ly/guestly-portal-deploy && node --env-file=.env.local scripts/create-demo-users.mjs > /Users/nicolas_z/Desktop/guest-ly/guestly-mobile/credentials/demo-reset.out`, move the values into `demo-accounts.env`, delete the `.out` file, and tell the lead the passwords changed.
- **Tenant fence.** Every script asserts `tenant.slug === "demo-review"` from `/auth/me` before any write and aborts otherwise. Never send an `x-gl-tenant` header for another tenant. Never touch `alexnico2026`, `valentina-sebastian`, `renata-joaquin`.
- **No real messages.** Never complete a broadcast (the typed SEND or ENVIAR confirmation), never press remind, never reply on a WhatsApp thread, never confirm a Coordinator action card. Demo guests have no phone numbers, but the rule holds anyway.
- **Never press Delete account** beyond opening and cancelling its confirmation alert. It emails the operator and flags the auth user (this happened once, see BUILD-LOG Sep 7).
- **Session injection** writes a demo user's tokens only into the simulator's app container on this Mac. `sim.sh teardown` erases the simulators at the end of the wave.
- **Proxy** binds to 127.0.0.1 only, logs method, path, status and mode, never headers or bodies.
- **testID** values are static names, no data.
- **Privacy declarations** must become true (H16, H17): purpose strings describe real use in EN and ES, the unused location string goes away, Photos or Videos and Phone Number are declared, tracking stays false.
- **AI disclosure** (H18): the concierge and the Coordinator screens state, in both languages, that answers come from an AI assistant and that the couple sees escalated questions.
- **Published repo.** Everything committed may end up public through GitHub Pages. No secrets, no real guest data, no screenshots of real tenants.
- **No push by agents (C12).** Agents commit locally on `mobile/part9-audit` and never run `git push`. EAS builds upload the working tree and do not need a push. The lead decides when and where the branch goes.
- **Tokens and passwords on disk (C6, C7).** `inject-session.mjs` never prints or saves a token; on failure it prints the HTTP status only. Nothing under `.part9/` may contain an access token, a refresh token or a password (the gate in 9.3 greps for `eyJ` and for the two password values read from the env file at run time). Maestro writes the resolved text of every `inputText` into `~/.maestro/tests/<run>/`; delete that run folder right after any flow that typed a password, never point `--debug-output` or `--format junit` into the repo, and never attach a Maestro report to a doc. Playwright runs with tracing, video and HAR recording off.
- **One session per simulator (C6).** Supabase refresh tokens rotate and reuse is detected: the same session JSON written into two simulators makes the second refresh revoke the whole family and both apps bounce to the entrance. Do one password grant per simulator and role, space grants at least two seconds apart, and use `--role keep` (language change only) whenever the role does not change.
- **Live API rate limits.** `/auth/guest/open` allows 10 calls a minute per IP and `/auth/guest/session` 20. The walker waits seven seconds between guest deep links and never retries a 429 in a loop.

---

## 6. UI design rules the fix step implements and the audit measures

### 6.1 Phones (375, 390 to 402, 430 to 440 pt wide)

- Side padding 24. Body text 17 to 18, captions 15, label 12; the tab label at 10 is the single documented exception and must never truncate.
- Every interactive element has an effective touch area of at least 44x44 pt. Rule for the kit: the pressable's own box is at least 44 in both axes (use `minHeight: 44`, `minWidth: 44`, centered content). `hitSlop` is allowed only for inline text links, and then the slop must bring the area to 44.
- No horizontal page scroll. Horizontal scrolling is allowed only inside `ChipRow`-style rails, and the rail must show a partial chip at the edge so it reads as scrollable.
- Safe areas: top padding is `max(insets.top, 54)` by design rule (`TOP_SAFE_MIN`); on the SE (status bar 20 pt, no notch) check that the 54 pt does not read as a hole and that nothing touches the status bar. Bottom = home indicator inset (0 on the SE) plus the floating tab bar (62 high, 24 above the inset) plus 16. Nothing interactive sits under the tab bar or the assistant bubble at rest.
- Spanish: no truncation of any label, button or title. Buttons fit by `adjustsFontSizeToFit` with `minimumFontScale={0.85}`, and if still too long they wrap to two lines with the height growing. Never an ellipsis on a call to action.
- Keyboard: the focused field and its primary action stay visible above the keyboard. iOS: `automaticallyAdjustKeyboardInsets` on the `Screen` ScrollView; non-scroll chat screens use one `KeyboardAvoidingView` at the root with `behavior="padding"` and the header height as `keyboardVerticalOffset`. Android keeps the default `resize`. `keyboardAppearance="dark"` on every input.
- Sheets: height is content driven with `maxHeight = windowHeight - topInset - 24`, content scrolls inside, the sheet moves above the keyboard, grabber and scrim stay. No fixed `top` value that can leave less than 320 pt.
- Dynamic Type: the text cap stays 1.3 (documented policy). At the largest setting nothing clips, overlaps or truncates on the 375 pt phone. Raw `Text` and `TextInput` get the same cap.
- Appearance: the app is dark only. With the system in light mode: keyboard dark, status bar light content, native alerts and pickers acceptable, web view background night while loading.
- Back: every pushed screen's back control works even when the screen was the first in history (`useSafeBack` falls back to the surface home).

### 6.2 Tablets and large windows (768, 1024 pt; Android tablets and foldables; iPad only later)

- Content column: `width: "100%"`, `maxWidth: MAX_CONTENT_WIDTH (560)`, centered, applied inside `Screen` (header and body) and to every `FlatList` `contentContainerStyle` through one helper exported from `src/ui`.
- Full-bleed photos really cover at any width: a `View` with `overflow: "hidden"` and an `Image` using the `FILL` style with `resizeMode="cover"` (never `ImageBackground` with a local `require`). The text and buttons on top sit in the centered column.
- Tab bar: width `min(window - 40, 520)`, centered.
- Sheets: `maxWidth: 640`, centered, when the window is 700 or wider.
- More-menu tile grid: two columns inside the 560 column at every width of 380 and above; one column below 380 if any Spanish label would wrap to three lines.
- iOS on iPad in this release = compatibility mode; nothing to lay out, but it must be clean.

### 6.3 Desktop width (1440) and 360

A native app has no desktop target. The 360 and 1440 checks run on the **web rig** (Expo web export plus Playwright, section 7.8) as a proxy for small Android phones and very wide windows: the same column rule applies, nothing stretches, photos cover, no horizontal scroll at 360.

### 6.4 States every data screen must have

| State | Required rendering |
|---|---|
| Loading | `Skeleton` blocks in the shape of the content. Never a full-screen spinner, never a blank screen. |
| Empty | `EmptyState` with a plain sentence, plus the create action when the user can create. |
| Error | New shared `QueryError`: title, one sentence, Retry button (44 pt), both languages from `ApiFailure.messages[lang]` or `common.errorBody`. Never an error code, a stack, or an English-only vendor message. |
| Offline | `Banner` with `wifi-off`, cached data stays visible, writes explain themselves. |
| Pending (server says `pending_db`) | calm "not available yet" copy, no retry loop. |
| Read-only (planner, viewer) | write controls hidden, not disabled-looking dead buttons. |
| Session expired | lands on the entrance without a flash of broken content. |
| Update required | the overlay, with copy in both languages. |
| Success | visible confirmation (toast-like banner, check state or navigation), plus haptic. |

### 6.5 Accessibility

- Every pressable has a role and a localized label; icons-only controls never announce the icon file name.
- Contrast AA: 4.5:1 for text under 24 px (or 19 px bold), 3:1 above. Known safe: ivory, ivory90, ivory70, ivory55, ivory40 on night; goldLight on night. Check: `goldDim` as text (about 3.8:1, not allowed for small text), `muted` on cream, red and amber text on tinted cards, any text over a photo without enough scrim. The audit computes ratios for token pairs with a 20-line script and eyeballs text over photos.
- Focus: on iOS the system draws the VoiceOver and Full Keyboard Access focus; our duty is correct grouping and labels. On the web rig the default focus outline must not be removed.
- Reduce Motion: no essential information only in animation.

---

## 7. STEP 1, HARNESS (exact procedure)

Work from `/Users/nicolas_z/Desktop/guest-ly/guestly-mobile`. Always use absolute paths. macOS has no `timeout`; a bare `=====` is a command in zsh.

### 7.1 Start the cloud build first (it queues while you do the rest)

1. Read `AGENTS.md`, `BUILD-LOG.md`, this plan. Edit `eas.json` (section 2.1) and the root `.easignore`, then commit just those two files so the build has a clean tree:
   `git add guestly-mobile/eas.json guestly-mobile/.gitignore .easignore && git commit -m "mobile: simulator build profiles for the Part 9 audit" -- guestly-mobile/eas.json guestly-mobile/.gitignore .easignore` (the `.gitignore` line for `.part9/` rides in this commit, C10)
2. `cd /Users/nicolas_z/Desktop/guest-ly/guestly-mobile && npx eas build -p ios --profile sim-dev --non-interactive --no-wait --json > .part9/build-sim-dev.json` (create `.part9/` first). Record the build id.
3. Poll without sleeping in the foreground: use the Monitor tool with an until-loop on `npx eas build:view <id> --json | python3 -c "import json,sys; print(json.load(sys.stdin)['status'])"` until `FINISHED` or `ERRORED`. If `ERRORED`, read `npx eas build:view <id>` logs, fix, retry once, then go to the fallback (7.9).

If `eas build` is refused by the permission system, stop and report; do not look for a way around it.

### 7.2 Credentials file

Create `guestly-mobile/credentials/demo-accounts.env` with a script that parses `~/.claude/jobs/8bc32a88/tmp/PARITY-BRIEF.md` (in that item the couple password is the JSON `password` value next to `review@guest-ly.com`, and the planner password is the backticked value right after the planner email and a slash; both are 16 characters) and writes the four `PART9_*` keys, without printing them. `chmod 600`. Verify each login with the password grant and print only the HTTP status. `git check-ignore guestly-mobile/credentials/demo-accounts.env` must print the path. If the brief file is gone, ask the lead; reset only as a last resort (section 5).

### 7.3 Simulators

```
xcrun simctl create "GL-S iPhone SE3" "iPhone SE (3rd generation)" com.apple.CoreSimulator.SimRuntime.iOS-26-5
```

- **S** (small): the SE just created, 375x667, home button, 20 pt status bar. If creation fails, use iPhone 17e `30398ECB-3A6B-4A34-BC77-B9FB8B4EF25F` and say so in the harness doc.
- **L** (large): iPhone 17 Pro Max `615D5183-56C3-4184-BC78-0FAB711D9A50` (440x956 pt, 1320x2868 px, the 6.9 inch store size).
- **T** (tablet): iPad mini (A17 Pro) `B1D6BA49-2379-4886-BA9B-3A3FB4C71897`, compatibility mode. Spot check of 10 screens on iPad Pro 13-inch (M5) `F5F84E6A-4E3B-4417-A413-368E0A5BAC81`.
- Boot at most two at a time (`xcrun simctl boot <udid>`, `open -a Simulator`). For every device: `xcrun simctl status_bar <udid> override --time "9:41" --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3`, and `xcrun simctl ui <udid> appearance dark`.
- Put the UDIDs in `scripts/part9/env.sh`.

### 7.4 Install and launch the dev client

1. Artifact URL: `npx eas build:view <id> --json` field `artifacts.applicationArchiveUrl`. `curl -L -o .part9/sim-dev.tar.gz <url>`, `tar -xzf` into `.part9/sim-dev/`, find the `.app`.
2. Per device: `xcrun simctl install <udid> <path to .app>`.
3. Pre-dismiss the dev menu onboarding: `xcrun simctl spawn <udid> defaults write com.zcventures.guestly EXDevMenuIsOnboardingFinished -bool YES` (best effort; if the sheet still shows, dismiss once with Maestro and note it).
4. Grants: `xcrun simctl privacy <udid> grant camera com.zcventures.guestly` and `grant photos` for the populated passes. Reset them (`privacy <udid> reset all com.zcventures.guestly`) for the permission-denied state captures.
5. Metro on a free explicit port (8081 may be taken): `npx expo start --dev-client --port 8097 --no-dev --minify` with `run_in_background`. For proxy passes prefix `EXPO_PUBLIC_API_BASE=http://127.0.0.1:8787`.
6. Load the bundle: `xcrun simctl openurl <udid> "exp+guestly://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8097"` (if the scheme is not registered, the same URL with `guestly://`). First load takes up to 90 s. Then routes: `xcrun simctl openurl <udid> "guestly:///couple/budget"`.
7. After `--no-dev` there is no fast refresh: to pick up a JS change, `xcrun simctl terminate <udid> com.zcventures.guestly`, then step 6 again.

### 7.5 Java and Maestro

```
brew install openjdk@17
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
curl -fsSL "https://get.maestro.mobile.dev" | bash
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"; export MAESTRO_CLI_NO_ANALYTICS=1
maestro --version
```

- Never `brew install maestro` (unrelated package). The alternative install is `brew tap mobile-dev-inc/tap && brew install mobile-dev-inc/tap/maestro`.
- Target a device with `maestro --device <udid> test <flow>`; check `maestro --help`, the flag was renamed between major versions.
- In flows do **not** use `launchApp` with the dev client (it lands on the launcher). Start with `openLink` to the dev client URL, then `openLink: guestly:///...`. With `sim-release`, `launchApp` is fine. Keep the launch step in one included subflow chosen by an env var.
- Proof of life: one flow that opens the entrance, taps `entrance-couple`, types the demo email into `signin-email`, taps `signin-use-password`, types the password passed with `-e PW="$PART9_COUPLE_PASSWORD"` where the variable comes from sourcing `credentials/demo-accounts.env` in the same shell command (never a literal on the command line), taps `signin-submit`, asserts the couple home. Do not screenshot while the password field is populated. Delete the `~/.maestro/tests/<run>` folder of that run straight after (C7). Never tap "email me a link" with a real address, and never complete Apple or Google sign-in (C2).
- If Maestro cannot attach to iOS 26.5 after both install routes and one version pin attempt: record the exact error in `PART9-HARNESS.md`, continue with simctl plus injection (which covers every route), and mark interaction states (sheets, keyboard, scroll) as "needs Maestro or a person" so the audit reports them honestly. `idb` (`brew tap facebook/fb && brew install idb-companion`, `pipx install fb-idb`) is the optional second try.

### 7.6 Session and language injection (`inject-session.mjs`)

Usage: `node scripts/part9/inject-session.mjs --udid <udid> --role couple|planner|guest|none|keep --lang en|es`. `keep` changes only `gl.lang` and clears `gl.query.cache`; it does no grant and leaves the session files alone (C6).

1. `xcrun simctl terminate <udid> com.zcventures.guestly` (ignore failure).
2. `DATA=$(xcrun simctl get_app_container <udid> com.zcventures.guestly data)`; storage dir = `$DATA/Library/Application Support/com.zcventures.guestly/RCTAsyncLocalStorage_V1`. Create it if missing.
3. Read `manifest.json` (or `{}`).
4. Always set `manifest["gl.lang"] = lang` (this makes the choice explicit, so neither the device locale nor the wedding default overrides it). Remove `gl.query.cache` so no stale language content shows. Keep `assistant-bubble`.
5. `role=couple|planner`: password grant, build the session object exactly as supabase-js stores it (`access_token`, `refresh_token`, `expires_in`, `expires_at`, `token_type`, `user`), key `sb-twkwdgwvottotseefnbf-auth-token`. The JSON is larger than 1024 bytes, so write it to a file named `md5(key)` (hex) in the storage dir and set `manifest[key] = null`. Remove guest keys `gl.guest.meta`.
6. `role=guest`: remove the Supabase key and its file; after launch open `guestly:///i/CAMAND?g=<guestId from ids.json>`, wait for `/notify`, then open `guestly:///guest`. The SecureStore guest token persists across launches; to leave guest mode use the Sign out row in guest More through Maestro, or `xcrun simctl uninstall` plus install (keychain items can survive an uninstall on simulators; if a guest session comes back, run `xcrun simctl keychain <udid> reset`).
7. `role=none`: remove everything except `gl.lang`.
8. Write the manifest, relaunch through step 7.4.6.

**Calibrate before trusting it:** do one real UI sign-in with Maestro, then read `manifest.json` and the directory listing to confirm the key name, the file naming and the JSON shape, and adjust the script. If a refresh token is rejected on launch, the symptom is a bounce to the entrance; the fix is a fresh grant (tokens are single use across rotations).

### 7.7 testIDs to add (JS only, no behaviour change)

`entrance-guest`, `entrance-couple` (`src/app/index.tsx`); `lang-en`, `lang-es` (`LangToggle`); `signin-email`, `signin-password`, `signin-use-password`, `signin-submit`, `signin-apple`, `signin-google` (`sign-in.tsx`; `Input` must forward `testID` to the `TextInput`); `invite-input`, `invite-open` (`invite.tsx`); `find-input`, `find-row-0..n` (`find.tsx`); `notify-allow`, `notify-skip`; `tab-<name>` (`TabBar.tsx`); `topbar-back` (`TopBar`); `assistant-bubble`; `sheet-scrim`; `settings-signout`, `settings-delete`; `fab-add` (guests). `Button`, `IconButton`, `ListRow`, `Chip` accept and forward an optional `testID`. Run `npx tsc --noEmit` and `npx eslint src` after.

### 7.8 Web rig (secondary layout check at 360, 768, 1024, 1440)

```
cd /Users/nicolas_z/Desktop/guest-ly/guestly-mobile
npx expo export -p web --output-dir .part9/web
cd .part9/web && python3 -m http.server 8793
```

Playwright script (`scripts/part9/web-rig.mjs`) imports `/Users/nicolas_z/Desktop/guest-ly/guestly-portal/node_modules/playwright/index.mjs`, launches Chromium with `--disable-web-security` (the live API has no CORS for localhost; this flag is for this local rig only), and for each viewport 360x740, 390x844, 430x932, 768x1024, 1024x1366, 1440x900: opens `/`, **clicks** "Open my invitation" and back, clicks "I'm the couple or the planner", types the demo credentials from the env file, submits, then clicks through the five couple tabs and More tiles; same for planner. The static server has no SPA fallback, so navigate by clicking, not by `goto` on deep paths. Screenshot each. The guest surface is walked too (C5): with `src/lib/secure.web.ts` in place the rig clicks "Open my invitation", types `CAMAND`, searches `Sof`, taps Sofía Rojas, skips the notification step and walks the five guest tabs, the RSVP flow up to (not including) the final submit, and the site pages, at all six widths in EN and ES. The guest surface is the one most people will open on a 360 dp Android phone, so it is not optional. The "link sent" state of `/sign-in` is captured ONLY here, with `page.route('**/auth/v1/otp*')` fulfilled locally with HTTP 200 and `{}` so that no email is ever sent (C2). Tracing, video and HAR stay off. This was proven feasible today: the export builds (3.5 MB bundle) and renders the entrance. Delete `.part9/web` when the wave ends.

### 7.9 Fallback: local build

Only if 7.1 fails or queues beyond 90 minutes. `brew install cocoapods`, then `npx expo run:ios --device "<udid>"` (Debug gives the dev client). Expect 4 to 6 GB. When the wave ends: `rm -rf /Users/nicolas_z/Desktop/guest-ly/guestly-mobile/ios` and the matching `~/Library/Developer/Xcode/DerivedData/Guestly-*` folder. `ios/` is already gitignored. Record the choice.

### 7.10 Harness done-bar

- Entrance visible on S, L and T. Couple, planner and guest each reach their home on one device through injection or the deep link, in EN and in ES.
- `walk.mjs` produces screenshots for at least 10 routes per role from `routes.json` and they were opened with the Read tool to confirm they show the right screen, not the launcher or a redirect.
- Proxy: `fail` mode shows a changed screen; `pass` restores it.
- `docs/PART9-HARNESS.md` lists every command that worked, tool versions, UDIDs, the build id, timings, and every deviation from this plan.
- `npx tsc --noEmit`, `npx eslint src` clean. Commit with explicit paths (eas.json, .easignore, .gitignore, scripts/part9, .maestro, the testID source files, docs/PART9-HARNESS.md).

---

## 8. STEP 2, AUDIT (find everything, fix nothing)

### 8.1 Matrix and passes

Devices S, L, T. Languages EN, ES. Roles guest, couple, planner, plus the signed-out entrance set.

| Pass | Build and API | Scope | Purpose |
|---|---|---|---|
| A1 | sim-dev, live API, **before seeding** | every route, S only, EN and ES | empty states |
| seed | run `seed-demo.mjs --lang en`, then `resolve-ids.mjs` | | |
| A2 | sim-dev, live API | every route, S, L, T, EN and ES (content retitled with `--lang es` for the ES walk, back to `en` at the end) | the main matrix |
| A3 | sim-dev through the proxy | every data screen on S in ES, modes `slow`, `fail`, `offline`; `expired` and `update` once per role | loading, error, offline, expired, update |
| A4 | Maestro on S (ES) and L (EN) | every form with the keyboard open; every sheet and modal open; every long screen scrolled to the end (up to 4 pages) | keyboard overlap, sheet clipping, bottom insets |
| A5 | S, ES, `xcrun simctl ui <udid> content_size accessibility-extra-extra-extra-large` | the 25 busiest screens (homes, lists, forms, tab bars, More menus, RSVP flow) | Dynamic Type |
| A6 | S, `appearance light` | sign-in with keyboard, one alert, one picker, the web view, a share sheet | system light mode leaks |
| A7 | permissions reset | check-in camera denied, photo picker denied, notification pre-prompt | permission states in both languages |
| A8 | `maestro hierarchy` on each screen (S) | script flags elements whose bounds are under 44 in either axis; cross-check `hitSlop` in code before filing | tap targets |
| A9 | web rig | 360, 768, 1024, 1440 | small Android and large-screen layout |
| A10 | iPad Pro 13 spot check | 10 screens | compatibility mode sanity |
| A11 | iPhone 17e `30398ECB-3A6B-4A34-BC77-B9FB8B4EF25F` (390 pt), ES | the 15 busiest screens (three homes, guest RSVP, guests list, budget, tasks, seating, requests, the three More menus, sign-in, invite, find) | the 390 width of the brief on a real simulator, not only on the web rig (C4) |

Reset `content_size large` and `appearance dark` after A5 and A6.

**How to read about 550 screenshots without losing findings (C11).** One agent context cannot hold them all. Work in batches of at most 20 screenshots; after each batch append the findings to `docs/PART9-AUDIT.md` on disk before reading the next batch, so nothing lives only in context. S-EN and S-ES (the tightest device) are read one image at a time. For L, T, A10, A11 and every regression walk, `scripts/part9/sheet.mjs` (Playwright, same compositor approach as `frame.mjs`) builds contact sheets of three screenshots side by side at 1800 px wide, each labelled with its route id; read the sheets, and open the single full image for anything that looks off or has dense text. A cell is `pass` only if its image or its sheet was actually read.

**Read every screenshot with the Read tool.** Downscale first so reading is cheap: `sips -Z 1400 <png> --out <jpg> -s format jpeg -s formatOptions 80`. Do not judge from file names or from the walk log. A screenshot that shows the dev launcher, a redirect, a system dialog or a spinner is a harness miss: recapture it, do not mark it pass.

### 8.2 Route inventory (the rows of the table)

Signed out: `/`, `/invite`, `/invite` with a wrong code (error), `/find` (empty, results, too many matches), `/notify?surface=guest|couple|planner`, `/sign-in` (link mode, password mode, error; the link-sent state only on the web rig with the OTP call intercepted, C2), `/auth/callback` with no code (expired link screen), `/i/XXXXXX` bad code.

Guest: `/guest`, `/guest/rsvp`, `/guest/rsvp/confirm`, `/guest/schedule`, `/guest/concierge` (empty, after one question), `/guest/dayof`, `/guest/messages`, `/guest/more`, `/guest/site`, `/guest/site/hotels`, `/guest/site/gifts`, `/guest/site/story`, `/guest/site/gallery`, `/guest/site/faq`.

Couple: `/couple`, `/couple/guests`, `/couple/guests/[id]`, `/couple/guests/new`, `/couple/guests/import`, `/couple/rsvps`, `/couple/rsvps/record`, `/couple/rsvps/questions`, `/couple/messages`, `/couple/messages/[id]`, `/couple/more`, `/couple/dayof`, `/couple/checkin` (camera granted, denied, name search), `/couple/requests`, `/couple/requests/[id]`, `/couple/tasks`, `/couple/tasks/[id]`, `/couple/tasks/new`, `/couple/tasks/board/[id]`, `/couple/tasks/board/new`, `/couple/tasks/checklists`, `/couple/tasks/collaborators`, `/couple/tasks/reminders`, `/couple/budget`, `/couple/budget/category/[id]`, `/couple/budget/item/[id]`, `/couple/budget/import`, `/couple/vendors`, `/couple/vendors/[id]`, `/couple/vendors/new`, `/couple/seating`, `/couple/seating/table/[id]`, `/couple/seating/auto`, `/couple/seating/plan`, `/couple/runsheet`, `/couple/runsheet/[id]`, `/couple/runsheet/new`, `/couple/brain`, `/couple/brain/section/[key]` (each key), `/couple/brain/preview`, `/couple/brain/versions`, `/couple/insights`, `/couple/broadcasts`, `/couple/broadcasts/new` (up to the dry-run preview, never the send), `/couple/broadcasts/[id]` (only if history exists), `/couple/website`, `/couple/website/section/[type]` (each type), `/couple/website/theme`, `/couple/settings/invite`, `/couple/settings/notifications`, `/couple/settings/reminders`.

Planner: `/planner`, `/planner/guests`, `/planner/requests`, `/planner/requests/[id]`, `/planner/requests/new`, `/planner/tasks`, `/planner/tasks/[id]`, `/planner/tasks/new`, `/planner/budget`, `/planner/budget/category/[id]`, `/planner/budget/item/[id]`, `/planner/budget/import`, `/planner/vendors`, `/planner/vendors/[id]`, `/planner/runsheet`, `/planner/seating`, `/planner/broadcasts`, `/planner/more`.

Shared: `/settings` (couple and planner; wedding switcher sheet; delete alert opened then cancelled), `/assistant` (empty, after one question, sessions drawer), `/web?path=/guide` (read its content for H19), `/web` site preview from the website builder, the lock overlay (enable biometric in settings with simulator Face ID enrolled: `xcrun simctl spawn <udid> notifyutil -s com.apple.BiometricKit.enrollmentChanged 1 && xcrun simctl spawn <udid> notifyutil -p com.apple.BiometricKit.enrollmentChanged`; match with `notifyutil -p com.apple.BiometricKit_Sim.pearl.match`; turn it off again after), the update overlay (proxy `update`), the assistant bubble at rest on a list, dragged left, and with the keyboard open.

Dynamic routes resolve through `.part9/ids.json`. If a route redirects (the gate in `_layout.tsx` moves wrong-surface links), the row says so.

### 8.3 What to check on every screenshot

1. Clipping and overflow: text cut at an edge, under the tab bar, under the bubble, under the status bar or home indicator.
2. Truncation: any ellipsis on a label, title, button, chip, tab, badge; especially ES.
3. Tap targets: from A8 plus eyeballing icon-only and text-link controls.
4. Safe areas: top on the SE (no notch) and on the Pro Max (Dynamic Island); bottom with and without the tab bar; landscape is locked, confirm it stays locked.
5. Keyboard: focused field and primary button visible; composer on chat screens; the bubble hides.
6. Dark and light: section 6.1.
7. States: section 6.4, all of them where the screen has data.
8. Dynamic Type: A5.
9. Copy: both languages present, formal usted in ES, no em dash, no raw ISO date, no raw enum (`in_progress`, `plus_one`, tenant `status`), no English inside ES screens (check feature `copy.ts` files, alerts, accessibility labels), brand spelled Guest-ly, no "Face ID" wording, no purchase or plan-change wording.
10. Content fit with real data: long names, 0 and 1 and many counts, big currency amounts, 40 guests.
11. Visual quality: alignment to the 24 grid, consistent card radii, one paper card per screen, gold never as text on ivory, photo sharpness, gradient banding, the wordmark gem visible.
12. Navigation: back from a deep-linked screen (H7), tab badge counts, the gate redirects.
13. iPad compatibility mode: renders, letterboxed, no crash, modals and the share sheet work.
14. Store readiness leads H16 to H20.
15. Anything that would embarrass Nicolas in front of a couple. If in doubt, file it as P3.

### 8.4 Writes allowed during the audit

Only on demo-review, and each one reverted or logged in the audit doc: one guest RSVP edit as Sofía Rojas (note the original answers first, restore them), one concierge question per language, one Coordinator question per language, one reply on an **app** thread only if needed (then note it), creating and deleting a throwaway task, vendor, budget line, table and run sheet block to see the forms' success states. Never: send, remind, approve, decline, publish brain or website, rotate the invite code, change the site slug or password, delete account. Also never (C2, verified against the portal code): save anything on `/couple/settings/reminders` or `/couple/tasks/reminders` (turning either on starts hourly cron sends), add a collaborator or a team member, finish a guest import or a budget AI import (open the screen, pick nothing, leave), run auto-seat past its preview unless the seed script is the one doing it, request an emailed sign-in link on a simulator, complete Apple or Google sign-in, create a second planner request. The concierge question must be one the published facts answer (parking, dress code or ceremony time): a question the bot cannot answer is escalated by email to the wedding team and to the tenant's ops contact, and joins the daily open-questions roundup. If the concierge answers with its fallback, stop asking and report it; do not try a second question.

### 8.5 `docs/PART9-AUDIT.md` format

1. Header: date, commit, build id, devices with UDIDs and point sizes, tool versions, what could not be tested and why (Apple and Google sign-in, real push delivery, real camera scanning, Android).
2. Matrix table, one row per route and state:

`| ID | Role | Route | State | S-EN | S-ES | L-EN | L-ES | T-EN | T-ES | Defects | Fixed | Verified shot |`

Cells are `pass`, `FAIL`, or `n/a` with a reason. `Fixed` and `Verified shot` stay empty for the fix step.

3. Defect register:

`| D-### | Sev | Class | Screens | Devices and langs | What is wrong | Evidence | Suspected file:line | Proposed fix | Status |`

Severity: P0 blocks use or App Review; P1 visibly broken (clipped, truncated, overlapped, raw error, wrong language, target under 44, dead back button); P2 inconsistent or awkward; P3 polish. Class: clipping, truncation, tap-target, safe-area, keyboard, appearance, state-loading, state-empty, state-error, state-offline, dynamic-type, copy, a11y, navigation, large-screen, store-compliance, visual.

4. Hypotheses table: H1 to H23 each marked confirmed (with D ids) or cleared (with the screenshot that clears it).
5. Systemic findings first: a kit-level defect (for example `Chip` height) is ONE defect listing all affected screens, so the fix is made once.
6. Evidence: `docs/part9/evidence/D-###.jpg`, cropped and downscaled (`sips -Z 1000`, JPEG 80), total under 25 MB. Raw shots stay in `.part9/shots/`.

Commit: `docs/PART9-AUDIT.md`, `docs/part9/evidence`, `scripts/part9/routes.json`.

---

## 9. STEP 3, FIX

### 9.1 Order

1. **Kit and systemic fixes first** (`src/ui/*`, `src/lib/nav.ts`, i18n commons): content width helper, `Screen` keyboard handling, `Sheet`, touch sizes, `Button` fitting, `TabBar`, `Input`, `TopBar` back and labels, `QueryError`. After each kit change, re-walk ten representative screens on S in ES before moving on, because a kit change can shift every screen.
2. **Shared flows**: entrance, invite, find, notify, sign-in (bilingual error mapping: invalid credentials, rate limit, network, unknown), auth callback, settings, assistant, web view, lock and update overlays.
3. **Per-surface defects** in register order: P0, P1, P2, then P3. Every P0 and P1 must be fixed. P2 and P3 are fixed unless the fix needs a new native module, a portal change or a design decision by Nicolas; those are listed as deferred with the reason.
4. **Native config**: purpose strings EN, `locales/es.json` and `locales/en.json` (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSFaceIDUsageDescription`, `NSUserNotificationsUsageDescription`), remove `NSLocationWhenInUseUsageDescription`, privacy manifest additions (`NSPrivacyCollectedDataTypePhotosorVideos`, `NSPrivacyCollectedDataTypePhoneNumber`, both linked, not tracking, app functionality), keep camera and expo-local-authentication plugin strings in sync. **Microphone (H26, C3):** set `recordAudioAndroid: false` on the `expo-camera` plugin (drops `RECORD_AUDIO` from the Android manifest) and set `microphonePermission` to a truthful bilingual string instead of the injected English default ("Guest-ly does not record audio. iOS shows this text only if a video with sound is ever captured, which the app does not do." plus the ES twin in `locales/es.json`); do not set it to `false`: the camera library very likely still links the audio capture API, and App Store Connect can refuse an upload that references it without a purpose string (ITMS-90683). Keeping a truthful string is the choice that cannot break the lead's upload. **Location (C3):** before removing `NSLocationWhenInUseUsageDescription`, run `strings` over the main binary and every framework inside the downloaded `sim-dev` `.app` and count `CLLocationManager`. Zero hits: remove the key. Any hit: keep the key with truthful bilingual wording ("Guest-ly does not read your location.") and say so in the audit doc. **The authority for purpose strings is the built app, not the config:** after `sim-release` is downloaded run `plutil -p <App>.app/Info.plist | grep -i usage` and check `es.lproj/InfoPlist.strings` exists; paste both outputs into the audit doc. `NSUserNotificationsUsageDescription` is not a real iOS key: leave it alone and do not localize it. Check with `npx expo config --type prebuild --json | python3 -c ...` (or `--type public`) that the keys resolve; no prebuild folder is left behind.
5. **Docs**: BUILD-LOG decisions 14 (iPad, section 2.4 text) and 15 (large-screen rule), wave log.

Constraints: no new dependencies, no SDK change, no change to `src/lib/api.ts` contracts or to any portal file, no change to API payloads. New copy goes into `en.ts` and `es.ts` (or the feature `copy.ts`) with identical key shapes. Match the file's existing style (long single-line JSX props are the house style here).

Guidance for the known systemic items:
- `useSafeBack(fallback?)`: `router.canGoBack() ? router.back() : router.replace(fallback ?? home)` where `home` comes from the session (`/guest`, `/couple`, `/planner`, or `/` when signed out), so shared screens (`settings`, `assistant`, `web`) never bounce a planner through `/couple` and the gate. `TopBar` takes `onBack` as today. Replace all 89 call sites, fallback by folder, then verify ONE deep-linked screen per folder on the simulator: inside the tab navigators `canGoBack()` can be true because of tab history and send the user to the first tab instead of the parent list; where that happens pass an explicit parent and use `router.replace` (C13).
- `Screen`: wrap header and body content in the width helper; on iOS set `automaticallyAdjustKeyboardInsets` when `keyboard` is true and pass `keyboard` on every screen that contains an input; remove the inner `KeyboardAvoidingView`s that sit inside the ScrollView, keep the root-level ones on non-scroll chat screens and verify them.
- `Sheet`: `top` prop becomes a hint for minimum height only; real layout is `maxHeight` plus internal `ScrollView` plus `KeyboardAvoidingView`, `SHEET_MAX_WIDTH` when wide.
- `Button` label fitting: `numberOfLines={2}` with `adjustsFontSizeToFit` and `minimumFontScale={0.85}` (the shrink only works on iOS when `numberOfLines` is set), `minHeight` instead of a fixed height so a two-line Spanish label grows the button. On web there is no shrink, only the wrap; check it on the rig at 360 (C13).
- `UpdateOverlay` (H24): the API sends no store URL (verified: `MOBILE_IOS_STORE_URL` is only read by portal pages) and the portal is read-only in this wave, so the button uses public constants in the app: iOS `https://apps.apple.com/app/id6809618039`, Android `https://play.google.com/store/apps/details?id=com.zcventures.guestly`, opened with `Linking.openURL` inside a try and catch that falls back to the calm copy. The overlay can only appear after a newer version is in the store, so the link is live whenever a user can see it. No new dependency.
- Touch sizes: grow the pressable box, not the visual. For `Chip` and `Segmented` keep the 36 pt visual pill centered inside a 44 pt pressable. `Toggle` keeps its 44x26 visual inside a 52x44 pressable.
- Entrance photo: replace `ImageBackground` by a `View` plus `Image` with `FILL`.
- Language ladder (if confirmed): apply the tenant default only when the device language is neither EN nor ES, keep the stored explicit choice on top. Guest `language` from the guest record may seed the default for guests. Put the final ladder in the file header comment and in BUILD-LOG.

### 9.2 Verify every fix

For each defect: re-capture the same screen, device and language as the evidence, **Read the new shot**, save it as `docs/part9/evidence/D-###-fixed.jpg`, set `Fixed` to the commit and `Verified shot` to the path, flip the matrix cells to pass. A defect is closed only by a screenshot that was looked at.

Then the regression walk: full A2 on S-ES and L-EN, A4 on S-ES, A5 on the 25 screens, A9 on the web rig at all six widths. Compare against the audit shots for unintended shifts.

### 9.3 Gates (all must pass before each commit)

The harness step puts these into `scripts/part9/gates.sh` (exit non-zero on any hit) so every later step runs one command. The forbidden characters are produced with `printf` so that the script and this plan never contain them literally:

```
cd /Users/nicolas_z/Desktop/guest-ly/guestly-mobile
npx tsc --noEmit
npx eslint src                       # 0 errors; do not add warnings
EMDASH="$(printf '\342\200\224')"    # U+2014
MIDDOT_BRAND="$(printf 'Guest\302\267ly')"
SCAN="src docs store scripts .maestro locales README.md BUILD-LOG.md app.config.ts eas.json"
# each of the next five must print nothing (grep exit status 1); missing folders are fine
grep -rn "$EMDASH" $SCAN 2>/dev/null
grep -rn "$MIDDOT_BRAND" $SCAN 2>/dev/null
grep -rniE "stripe|checkout|upgrade|pricing" src
grep -rnE "Face ID|FaceID" src                       # app.config.ts key names are exempt
grep -rniE "Alexandra|alexnico" src store .maestro scripts/part9   # C14: shipped, seeded and captured content only; docs may state the rule
grep -rnE "eyJ[A-Za-z0-9_-]{20,}" .part9 docs store scripts .maestro 2>/dev/null   # C7: no token on disk or in git (the anon key lives only in .env, which is not scanned)
npx expo-doctor                      # report, fix only what this wave caused
```

The same two character scans must also pass on `/Users/nicolas_z/Desktop/guest-ly/docs/wave-sep18/`. Key parity of `es.ts` against `en.ts` is enforced by tsc (es is typed against en).

Also check feature copy parity: for each `src/features/*/copy.ts`, `en` and `es` have the same key shape (a 15-line node script with `typescript` transpile or a regex count is enough; tsc does not enforce it there unless typed).

### 9.4 Release simulator build and final verification

After the last fix commit: `npx eas build -p ios --profile sim-release --non-interactive --no-wait --json`, install on S, L, T (uninstall the dev client first; same bundle id). Injection works the same. Walk A2 on S-ES and L-EN plus the ten iPad spot screens on the release binary, trigger the camera and photo permission prompts once in ES to see the localized purpose strings, and record results in the audit doc under "Release build verification". This is the binary the store step captures from.

Commits: small and thematic, explicit paths only, for example `mobile: kit touch targets at 44pt (D-003, D-004, D-007)`.

---

## 10. STEP 4, STORE

### 10.1 Screenshots

Source: `sim-release` on iPhone 17 Pro Max (1320x2868), status bar override 9:41, dark appearance, `content_size large`, demo-review only, seeded content in the matching language, assistant bubble parked where it covers nothing (or captured on screens where it adds to the story). Eight per language, same order:

| # | Screen | Caption EN | Caption ES |
|---|---|---|---|
| 01 | `/guest` invitation home | Your invitation, in your pocket | Su invitación, en su bolsillo |
| 02 | `/guest/rsvp` | Answer for everyone in your party | Responda por todo su grupo |
| 03 | `/guest/schedule` | Every event, on your calendar | Cada evento, en su calendario |
| 04 | `/guest/concierge` with the parking question answered | Ask anything about the day | Pregunte lo que quiera sobre el día |
| 05 | `/couple` home | Every RSVP as it arrives | Cada confirmación en cuanto llega |
| 06 | `/couple/guests` or `/couple/rsvps` | Your whole guest list, one search away | Toda su lista, a una búsqueda |
| 07 | `/couple/seating` or `/couple/budget` (whichever reads best populated) | Seating and budget, handled | Mesas y presupuesto, resueltos |
| 08 | `/planner` or `/planner/requests` | Planners propose, couples approve | El planner propone, la pareja aprueba |

Captions are proposals; keep them short, no em dashes, no claims the app cannot keep. Deliver:

- `store/screenshots/ios-6.9/en-US/raw/` and `es-MX/raw/`: untouched captures converted to JPEG 92 (`sips -s format jpeg -s formatOptions 92`), exactly 1320x2868, no alpha.
- `.../framed/`: HTML plus Playwright composite at exactly 1320x2868: night background with the gold bloom, caption in Cormorant Garamond, sub-line in Jost (fonts loaded by `@font-face` from the ttf files under `node_modules/@expo-google-fonts`), the capture scaled with a 44 px corner radius and a hairline border. No device frame artwork, no AI-generated typography.
- `store/screenshots/play-phone/en-US` and `es-419`: the same composition at 1080x1920 (Play rejects images whose long side is more than twice the short side, so raw 1320x2868 captures cannot be used there).
- `store/icon-512.png` (`sips -Z 512 assets/brand/icon.png`), `store/feature-graphic.png` 1024x500 from the same compositor.

Priority inside this step (C15): iOS raw set, iOS framed set, `metadata.json`, `ANDROID-READINESS.md`, version notes, and only then the Play phone set, `icon-512.png` and the feature graphic. If time or disk runs short the Play assets are the part that is dropped, and `ANDROID-READINESS.md` lists them as open.

Checks: `sips -g pixelWidth -g pixelHeight -g hasAlpha` on every file; Read every image; no real tenant data (search the screenshots visually for Alexandra, Nicolas, real phone numbers or emails); text legible at thumbnail size; each file under 700 KB. iPad screenshots are not needed (phone-only, D4).

### 10.2 `store/metadata.json`

- Re-read every string against the fixed app. The description must not promise what the app does not do (for example "add everything to your calendar" must match the schedule screen; "even without signal" must match the offline queue in `src/lib/queue.ts`). Mention planners' tasks, budget, vendors, seating and the assistant only if they are in the build. Keep "There is nothing to buy in the app."
- `app_privacy`: add Photos or Videos (couples and planners: website images, floor plan, budget receipts; linked; app functionality), keep phone number; remove the location remark once the purpose string is gone; keep tracking false.
- Add `review_notes_es`, `whats_new` (EN and ES), `copyright` ("2026 ZC Ventures LLC"), `primary_locale`, `promotional_text` EN and ES, `age_rating_answers` (no objectionable content, no unrestricted web access: the in-app web view is fenced to the portal origin), `export_compliance` (uses only exempt encryption, already `ITSAppUsesNonExemptEncryption: false`), `sign_in_required: true`.
- Review notes: keep the three flows, add: what the AI concierge and Coordinator are and that they are disclosed in the app; camera is used for door check-in and for photographing a floor plan or a receipt; notifications are optional; account deletion path; the app runs on iPad in iPhone compatibility mode; Sign in with Apple is offered; demo data is fictional.
- **Credentials placeholders, never values:**
  `review@guest-ly.com / [COUPLE PASSWORD: guestly-mobile/credentials/demo-accounts.env, key PART9_COUPLE_PASSWORD]` and the same for `PART9_PLANNER_PASSWORD`. Add a `credentials_location` field that says: the file is gitignored and exists only on Nicolas's Mac; the values go into App Store Connect, App Review Information (user name and password fields take the couple account; the planner account and the guest code go in Notes) and into Play Console, App access.
- No `store.config.json` in this wave (C15). An EAS Metadata file next to a logged-in CLI is one command away from overwriting the App Store Connect listing. **Never run `eas metadata:push` or `eas metadata:pull`.** Nicolas pastes the listing by hand from `metadata.json`.

### 10.3 Version and build

- `npx eas build:version:get -p ios` and `-p android` (read-only) to confirm 7 and 4; write the numbers into `docs/CREDENTIALS-CHECKLIST.md` status and BUILD-LOG.
- `app.config.ts`: comment next to `android.versionCode` that the remote source owns it. `version` stays `1.0.0`.
- Write the lead's next commands into BUILD-LOG, not run by any agent: `npx eas build -p ios --profile production --non-interactive --no-wait` and `npx eas build -p android --profile production --non-interactive --no-wait`. Submit stays behind Nicolas typing SUBMIT IOS or SUBMIT ANDROID.

### 10.4 `docs/ANDROID-READINESS.md`

Sections: (1) what is done (AAB versionCode 4 built, package id, adaptive icon, permissions, intent filter for `/i/`, target SDK 36, min SDK 26); (2) what only Nicolas can do, in order, with time estimates: Play Console **organization** account for ZC Ventures LLC (D-U-N-S, 25 USD, identity verification, why organization avoids the 12 testers for 14 days rule), create the app, service account JSON saved as `guestly-mobile/credentials/google-service-account.json` with the exact Play permissions, Firebase project with package `com.zcventures.guestly`, `google-services.json` and the FCM v1 service account uploaded with `npx eas credentials -p android`, first internal-track upload, SHA-256 fingerprints into the portal env `ANDROID_SHA256_FINGERPRINTS` and a portal redeploy by the lead, store listing, data safety form answers mirrored from `metadata.json`, content rating, target audience; (3) code follow-ups before an Android release: `android.googleServicesFile` in `app.config.ts` once the file exists (verify `src/lib/push.ts` fails soft without it), edge to edge and predictive back check, large-screen behaviour (section 6.2); (4) **honest gap**: no Android emulator or SDK on this Mac, so Android was not audited on a device in this wave; how to close it (Android Studio plus a Pixel AVD needs about 10 GB, or sideload the preview APK on a phone) and the checklist to run; (5) Play screenshot and graphic assets delivered in 10.1. Update or fold in `docs/PLAY-CONSOLE-SETUP.md` so the two do not disagree.

### 10.5 Wrap up

- `sim.sh teardown`: shut down simulators, `xcrun simctl erase` the ones used, delete the created SE device, stop Metro, the proxy and the static server, delete `.part9/web`, `.part9/sim-*`, large raw shot folders (keep `index.json` files), and the local `ios/` and DerivedData if the fallback was used. Report free disk before and after.
- Demo tenant end state (C1): re-read tasks, budget, vendors, seating, run sheet, RSVP questions and requests through the API; assert the titles are the EN set, exactly one open planner request exists, Sofía Rojas's RSVP equals the values noted before the audit, task reminders and RSVP reminders are still off, the invite code is still `CAMAND`. Write the result into the audit doc.
- Delete `~/.maestro/tests/*` created in this wave and confirm the token and password greps of 9.3 are empty.
- Final gates (9.3), final commit with explicit paths. No push (C12).
- Final report: commits, test counts, screenshot paths, what was not verifiable, the list in section 13.

---

## 11. Test plan summary

| Layer | Tool | When | Pass bar |
|---|---|---|---|
| Types | `npx tsc --noEmit` | every commit | 0 errors |
| Lint | `npx eslint src` | every commit | 0 errors, no new warnings |
| Grep gates | section 9.3 | every commit | all empty |
| Copy parity | tsc for `es.ts`; script for feature `copy.ts` | fix, store | identical key shapes |
| Simulator matrix | `walk.mjs` plus Read | audit, fix (regression), store | every cell pass or justified n/a |
| Interaction | Maestro flows | audit, fix | flows green; keyboard and sheet shots pass |
| States | proxy modes | audit, fix | section 6.4 satisfied on every data screen |
| Dynamic Type, light mode, permissions | simctl ui and privacy | audit, fix | no clipping, localized prompts |
| Tap targets | `maestro hierarchy` script | audit, fix | nothing under 44 without justified hitSlop |
| Large and small widths | web rig, clicking through | audit, fix | column rule holds, no horizontal scroll at 360 |
| Release binary | sim-release walk | end of fix | same as dev walk |
| API safety | scripts assert demo-review | always | abort otherwise |
| Config | `npx expo config --type public`, `npx expo-doctor` | fix, store | purpose strings and privacy types present |

Test accounts: couple `review@guest-ly.com`, planner `planner-review@guest-ly.com` (passwords in `guestly-mobile/credentials/demo-accounts.env`), guest invite `CAMAND` then `Sof` and Sofía Rojas, tenant `demo-review` only. Secondary demo codes that exist but are not needed: `sofia-mateo-demo` 6JBRPT, `demo-emma-james` JYSTEN.

Not testable on this Mac, to be said plainly in every report: Sign in with Apple and Google end to end, real push delivery, QR scanning with a real camera, biometric hardware, Android on any device, a real iPad.

---

## 12. Rollout order and rollback

1. harness commit(s): profiles, ignore rules, scripts, flows, testIDs, harness doc.
2. audit commit: audit doc, evidence, manifest corrections.
3. fix commits: kit, shared flows, per surface, native config, docs. Then the `sim-release` build.
4. store commit(s): screenshots, metadata, Android doc, version notes, README and checklist status.
5. Lead (not these agents): review, production EAS builds, TestFlight, decide on merging the branch (remember the Pages upload of the repo root), submit only after Nicolas's typed go.

Rollback: every change is a normal commit on `mobile/part9-audit`; undo with `git revert <sha>` (never reset, never stash, never checkout another branch). Simulator builds are disposable. Demo seed is removable with `seed-demo.mjs --remove` from the ledger. Nothing in production changes in this wave: no deploy, no SQL, no `eas submit`, no `eas update`, no `eas metadata:push`, no portal edits. If TestFlight build 7 must stay the candidate, simply do not build 8.

---

## 13. Only Nicolas can do

1. Confirm the iPad decision (phone-only for 1.0). If he wants a universal app, that is a separate design wave before the production build, because it cannot be reversed after release.
2. Keep the demo passwords somewhere durable (password manager) and paste them into App Store Connect, App Review Information, and later Play Console, App access.
3. Upload the screenshots and listing text in App Store Connect by hand (no EAS Metadata push in this wave, C15), answer the App Privacy questionnaire per the updated `metadata.json` (now including Photos), age rating, export compliance; check that build 8 is selectable under ASC version 1.0 (if not, rename the ASC version to 1.0.0).
4. Device pass on the new TestFlight build: camera QR check-in, push received, biometric unlock, Sign in with Apple and Google, the permission prompts in Spanish.
5. Type SUBMIT IOS when satisfied (and run `eas submit` himself if the permission system blocks the agent, as it did before).
6. Google: Play Console organization account (D-U-N-S, fee, verification), service account JSON, Firebase project and `google-services.json`, FCM key upload, then SUBMIT ANDROID later.
7. Real venue photography or approval to upscale the 780 px placeholders (H23); any paid image service is his call.
8. Decide whether the seeded demo content stays on demo-review (recommended: yes, App Review sees a living wedding). Default taken: it stays, in English (section 15).
9. Pick raw or framed screenshots, and approve the captions.
10. If EAS queues are slow or the monthly build allowance runs out, decide on a paid EAS plan or accept the local build fallback.
11. Tell the lead whether `review@guest-ly.com` and `planner-review@guest-ly.com` are real mailboxes and whether demo-review has an ops contact email. The plan assumes unknown and never triggers an email to them (section 15).
12. Decide when `mobile/part9-audit` is pushed and merged; agents do not push (C12).

---

## 14. Risks

- **EAS queue or quota.** Free-tier iOS queues can take an hour or more and the month already has 7 builds. Mitigation: start the build first, local fallback documented, only two simulator builds planned.
- **Maestro on iOS 26.5.** If the driver does not attach, interaction states lose automation. Mitigation: injection plus deep links cover every route; the gap is reported, not hidden.
- **AsyncStorage injection drift.** Key or file format differs from what the code suggests. Mitigation: calibrate from one real UI login before trusting it.
- **Dev client vs release differences.** Mitigation: `--no-dev --minify` for captures and a final walk on `sim-release`.
- **Kit changes ripple.** A 44 pt chip or a width helper shifts many screens. Mitigation: kit first, ten-screen re-walk after each kit change, full regression walk at the end.
- **Token cost and time of reading about 550 screenshots.** Mitigation: downscale to 1400 px JPEG, systemic defects filed once, passes ordered so the tightest device and language (S-ES) is read first.
- **Disk.** Four simulators plus shots plus Java can reach 8 to 10 GB. Mitigation: two simulators booted at a time, teardown at the end, no `ios/` unless the fallback is used.
- **Live production API.** Everything runs against app.guest-ly.com. Mitigation: demo tenant assertion in every script, the forbidden-actions list in 8.4, one AI question per language, the side-effect rules in 2.6.
- **Hidden email side effects.** Some portal writes send email (planner request created, concierge escalation, task and RSVP reminders once switched on, magic link). Mitigation: C1 and C2; the `emailSent` check; the magic link state is captured only with the OTP call intercepted.
- **Public repo root.** Merging to main publishes committed files on guest-ly.com. Mitigation: no secrets in git, lead decides on the merge; consider excluding `guestly-mobile/` and `docs/` from the Pages artifact in a later wave.
- **Compatibility-mode surprises on iPad.** If something is broken there, it is a P0 because App Review will see it.
- **Permission system fences.** `eas submit`, management API writes and key signing were blocked before. If `eas build` for a simulator profile is ever refused, stop and report rather than work around it.
- **ASC version string 1.0 vs 1.0.0.** Probably equivalent for Apple; verify when selecting build 8.

---

## 15. Critic amendments (Sep 18 2026)

The critic read the plan, then checked its claims against `guestly-mobile/` and, read-only, against `guestly-portal-deploy/`. What held up: the simulator route (D1), session injection against AsyncStorage 2.2.0 (D2), the phone-only iPad decision with compatibility-mode audit (D4), version 1.0.0 with remote build numbers (D5), no migration, the SE (3rd generation) and 13 mini device types exist on the iOS 26.5 runtime, 89 `router.back()` sites, 22 `KeyboardAvoidingView` files, 18 sheet or modal files, zero `testID`s, all grep gates clean at baseline, the brief file with the demo passwords still exists. Where this section and an older sentence disagree, this section wins.

| # | Change | Why (evidence) |
|---|---|---|
| C1 | Seed side-effect rules added to 2.6, D6 and the wrap-up: planner request created exactly once and never recreated per language, `emailSent` must be `false` or seeding stops, task reminders checked off before the task seed, no collaborators or assignees, no real contact details on vendors, RSVP question optional, retitling edits in place, end-state assertion in 10.5. | The plan said "no real messages" but its own seed calls `createRequest`, which emails every non-staff owner or admin (`guestly-portal-deploy/src/app/planner/requests/actions.ts`). It is harmless today only because both demo members are on the staff domain (`src/lib/ops.ts`). Overdue seeded tasks would start a daily email the moment anyone enabled task reminders (`src/lib/task-reminders.ts`). The plan did not know either fact. |
| C2 | Forbidden-writes list in 8.4 widened; "link sent" sign-in state moved to the web rig with the Supabase OTP call intercepted; concierge question restricted to one the published facts answer. | `sign-in.tsx` calls `signInWithOtp` with `shouldCreateUser: false`, so the state can only be reached by sending a real email to a real account. Reminder settings screens start hourly cron sends when saved. An unanswered concierge question is escalated by email to the team and the ops contact, which is not staff-filtered (`src/lib/notify.ts` `tenantTeamEmails`). |
| C3 | Native config fixes made safe: microphone string replaced and `RECORD_AUDIO` dropped (H26), location key removed only after a `strings` check of the built binary, the built `Info.plist` is the authority, `NSUserNotificationsUsageDescription` left alone. | `expo-camera`'s plugin injects an English microphone purpose string and an Android audio permission the app never uses; the plan missed both. Removing a purpose string that a linked framework still references can get the lead's upload refused, so removal is conditional. `expo config` output is not proof of what ships. |
| C4 | New pass A11: 15 screens on iPhone 17e (390 pt) in ES. | The brief names 360, 390 and 430. The matrix had 375 and 440 on simulators and 390 only on the web rig, where at that point the guest surface could not even sign in. |
| C5 | Guest surface added to the web rig through `src/lib/secure.ts` plus `secure.web.ts`; native behaviour unchanged. | `expo-secure-store` on web is an empty object (`node_modules/expo-secure-store/build/ExpoSecureStore.web.js`), so the plan's rig skipped every guest screen at 360 px and at tablet widths and called that acceptable. Guests are the largest audience and the most likely to hold a small Android phone. A `.web.ts` file never enters an iOS or Android bundle. |
| C6 | One password grant per simulator and role, `--role keep` for language changes, spacing between grants, guest deep links paced to the rate limit. | Supabase rotates refresh tokens and revokes the family on reuse; a session shared across simulators would log both out mid-walk and look like an app bug. `/auth/guest/open` is limited to 10 a minute per IP. |
| C7 | Secret hygiene: Maestro run folders deleted after any typed password, no Maestro or Playwright recordings, no token under `.part9/`, new `eyJ` gate. | Maestro stores the resolved `inputText` value in `~/.maestro/tests/`. The plan only covered the YAML and the command line. |
| C8 | Proxy: `fail-html` and `hang` modes, Host and SNI rule, no forwarded-for header, path fence, `--clear` on base change, `/web` excluded from proxy passes, return-to-direct check. | A real outage is an HTML 502, not a tidy JSON envelope, and that is the case that shows raw text. `EXPO_PUBLIC_*` values are inlined and Metro can serve a stale transform. `portalOrigin()` follows the API base, so the web view cannot work through the proxy. |
| C9 | Build budget: at most three simulator builds by agents. | Seven builds already this month and the lead needs two production builds. |
| C10 | `.gitignore` entry for `.part9/` moved into the first commit. | Step 7.1 wrote `.part9/build-sim-dev.json` before the ignore rule existed. |
| C11 | Batching and contact sheets for reading screenshots; findings written to disk after every batch. | About 550 images do not fit in one agent context; without this rule findings are lost at compaction or cells get marked pass unread. S-EN and S-ES are still read one by one. |
| C12 | Agents never `git push`. | The repo root is published by GitHub Pages from `main`, and the remote may be public. Nothing in this wave needs a push. |
| C13 | `useSafeBack` derives the home from the session and is verified per folder for the tab-history case; `Button` fitting spelled out (`numberOfLines={2}`, `minHeight`); `UpdateOverlay` gets a store button from public constants. | A fixed `"/couple"` fallback bounces planners through the gate. `adjustsFontSizeToFit` does nothing on iOS without `numberOfLines`. The update overlay is a dead end today (verified in `_layout.tsx`) and the API sends no store URL. |
| C14 | The "Alexandra or alexnico" gate now scans shipped, seeded and captured content only, not docs. New hypotheses H24 to H28. Route file count corrected (103 files, 93 screens). | The old gate fails at baseline on `scripts/screenshots.sh` and would fail on any doc that states the rule. H27: "tell the couple" is not a small link, it is not pressable at all. |
| C15 | `store.config.json` removed from the wave; Play graphics made the lowest priority of the store step. | Scope: the brief asks for iOS screenshots, metadata, an Android readiness doc and a version bump. An EAS Metadata file is a foot-gun next to a logged-in CLI. |

Defaults chosen where only Nicolas could decide (safest option taken, recorded here and in section 13):

1. iPad: phone-only for 1.0 (D4). Reversible later; the opposite is not.
2. Seeded demo content stays on demo-review after the wave, in English, with the ledger kept in `.part9/seed-ledger.json` AND copied (ids only, no tokens) into `docs/PART9-AUDIT.md`, because `.part9/` is deleted at teardown.
3. Language ladder (H14): fix the code to match its own header comment (explicit choice, then device language when it is EN or ES, then the guest's language, then the wedding default). The header comment is the recorded intent; demo-review is `en`, so App Review is unaffected either way.
4. Whether `review@guest-ly.com` and `planner-review@guest-ly.com` are real mailboxes is unknown from this Mac. The plan assumes they are not and therefore never causes an email to them.

What the critic could not verify from this Mac and the plan must treat as unproven until the harness step proves it: that `simctl openurl` opens `guestly:///` links on iOS 26.5 without a system confirmation sheet (if one appears, dismiss it with Maestro and record it as a harness note, never as an app defect); that Maestro 2.x attaches to the iOS 26.5 runtime; that ASC accepts build 8 of `1.0.0` under the version named `1.0`; that the EAS account still has build allowance this month.

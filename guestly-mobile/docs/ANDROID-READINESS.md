# Android readiness

Part 9 store step, Sep 20 2026. What is actually done in this repo, what
only Nicolas can do (in order, with time estimates), the code follow-ups an
Android release still needs, and the honest gap: Android has never run on
this Mac. `docs/PLAY-CONSOLE-SETUP.md` is the step-by-step for section 2; the
two should never disagree, and this section wins if they ever do.

## 1. What is done

- `app.config.ts`: `android.package` is `com.zcventures.guestly`, target SDK
  36 and min SDK 26 (Expo SDK 57 defaults, unchanged in this wave), an
  adaptive icon (`assets/brand/adaptive-foreground.png` on `#0d1117`), the
  four permissions the app actually uses (`CAMERA`, `USE_BIOMETRIC`,
  `POST_NOTIFICATIONS`, `VIBRATE`), `RECORD_AUDIO` explicitly blocked (the
  app never records audio; `expo-image-picker` would otherwise add it), and
  an intent filter for `https://app.guest-ly.com/i/*` (App Links, guest
  invite deep links).
- `eas.json`: `appVersionSource: "remote"`; Android `versionCode` is **4**
  today (confirmed read-only with `eas build:version:get -p android`,
  2026-09-20), and `production.autoIncrement: true` means the lead's next
  `eas build -p android --profile production` becomes versionCode 5 with no
  edit needed anywhere. `app.config.ts`'s local `versionCode: 1` is inert
  under a remote source; it now carries a comment saying so.
- An Android **preview** build (APK, `versionCode` 4, commit `6f087837`)
  already exists from an earlier wave (plan section 1.1) and can be
  sideloaded on a real phone today for a first look, without Play Console.
- Store copy is Android-ready: `store/metadata.json` carries EN/ES
  description, keywords, `app_privacy` (mirrors Play's Data safety form,
  now including Photos or Videos for website images, the floor plan and
  budget receipts), `promotional_text`, `whats_new`, and Android-flavoured
  credential placeholders in `credentials_location`. `store/icon-512.png`
  (512x512, from `assets/brand/icon.png`) and `store/feature-graphic.png`
  (1024x500) are both built and committed this step.
- `docs/PLAY-CONSOLE-SETUP.md` (an earlier wave) is the walkthrough for
  section 2 below; its Data safety list (step 4) should be read together
  with the fuller `app_privacy` block in `store/metadata.json`, which now
  also lists Photos or Videos.

## 2. What only Nicolas can do, in order

1. **Play Console organization account for ZC Ventures LLC** (about 45
   minutes to submit, then Google's identity verification: usually 1 to 3
   days, occasionally longer). Needs a D-U-N-S number (free at dnb.com if
   the LLC does not have one yet) and the $25 one-time fee. Organization
   accounts skip the personal-account rule that forces a 14-day closed test
   with 12 testers before any production release; a personal account would
   not. Full steps: `docs/PLAY-CONSOLE-SETUP.md` section 1.
2. **Create the app record** (10 minutes): name `Guest-ly`, package
   `com.zcventures.guestly` (fixed by the first upload), default language
   English (US), add Spanish (Latin America). `docs/PLAY-CONSOLE-SETUP.md`
   section 2.
3. **Google Cloud service account for `eas submit`** (20 minutes): create or
   reuse a Google Cloud project, IAM > Service accounts > Create, download
   its JSON key, save it as `guestly-mobile/credentials/google-service-account.json`
   (gitignored, never commit it), then in Play Console grant that service
   account **Release to production, exclude devices, and use Play App
   Signing** plus **View app information** for the Guest-ly app.
   `eas.json`'s `submit.production.android.serviceAccountKeyPath` already
   points at that path. `docs/PLAY-CONSOLE-SETUP.md` section 5.
4. **Firebase project for push** (15 minutes): create a Firebase project
   named `guestly` with package `com.zcventures.guestly`, download
   `google-services.json`, and upload the Firebase service account key with
   `npx eas credentials -p android` (Push Notifications, Google Service
   Account Key). Until this exists, Android push tokens simply fail to
   register; `src/lib/push.ts` already fails soft (see section 3).
5. **First internal-track upload** (the lead runs the commands; Nicolas
   approves): `npx eas build -p android --profile production` then
   `npx eas submit -p android --profile production`. Lands in Internal
   testing. Add Nicolas's Google account as a tester and install from the
   opt-in link.
6. **SHA-256 fingerprints into the portal** (10 minutes, after step 5): copy
   both fingerprints (upload key and Play App Signing key) from Play
   Console, Setup, App signing, into the portal's `ANDROID_SHA256_FINGERPRINTS`
   env var (comma-separated) on Netlify, then have the lead redeploy the
   portal. Without this, `https://app.guest-ly.com/.well-known/assetlinks.json`
   will not list the app and `app.guest-ly.com/i/*` links open a browser
   instead of the app.
7. **Store listing, content rating, target audience, data safety form**
   (30 to 45 minutes): copy from `store/metadata.json` and
   `docs/PLAY-CONSOLE-SETUP.md` sections 3 and 4. The data safety answers
   should now include Photos or Videos (linked, app functionality, couples
   and planners only) alongside the fields `PLAY-CONSOLE-SETUP.md` already
   lists.
8. **Promote to Production**: only after Nicolas types `SUBMIT ANDROID`
   (global rule; no agent runs `eas submit` or promotes a Play track).

## 3. Code follow-ups before an Android release

- Add `android.googleServicesFile: "./google-services.json"` to
  `app.config.ts` once step 2.4 produces that file. Until then, verify (and
  keep verifying after the field is added) that `src/lib/push.ts` fails
  soft when Firebase is not configured: it already wraps registration in a
  try/catch and simply leaves the push token unset rather than crashing or
  showing an error, so this is a config addition, not a rewrite.
- Edge-to-edge and predictive back: Expo SDK 57 targets SDK 36, which
  defaults to edge-to-edge and expects `enableOnBackInvokedCallback` for
  predictive back. Worth one real pass on a device or emulator once one
  exists (section 4) to check the tab bar and sheet safe-area insets, which
  were only ever tuned against iOS safe areas in this wave.
- Large-screen behaviour (tablets and foldables, plan section 6.2): the
  phone-only iPad decision (`docs/... BUILD-LOG.md` decision 14) is iOS-only
  by construction (`ios.supportsTablet: false`); Android has no equivalent
  flag, so a large-screen or folded Android device will run this
  `orientation: "portrait"` phone layout full-screen or letterboxed
  depending on the OEM. Not tested; flagged for the same reason iPad was
  flagged, not fixed here.

## 4. Honest gap

No Android emulator or SDK is installed on this Mac, so **no screen of this
app has ever been audited, walked, or even opened on Android** in this
wave or any earlier one. Everything in section 1 is a static reading of
`app.config.ts`, `eas.json` and the store copy, not a running app. Two ways
to close this gap, in order of effort:

1. **Sideload the existing preview APK** (`versionCode` 4, commit
   `6f087837`) on a real Android phone. Fastest path to a first look;
   catches nothing that needs a debugger.
2. **Android Studio plus a Pixel AVD** (about 10 GB of disk; this Mac has
   about 24 GB free at the end of this step, so it fits but leaves little
   room). Needed for the real audit: repeat plan section 8's per-screen
   pass (all three roles, both languages, at minimum one phone width and
   one tablet/foldable width), the D-045/D-046 concierge findings from this
   step (a 20 s timeout was too short for the AI concierge and has been
   raised to 120 s; markdown from the AI reply is not rendered, still
   open), the tap-target and Dynamic Type passes, and the edge-to-edge and
   predictive back check from section 3.

## 5. Store assets (plan 10.1)

Delivered this step, demo-review only: `store/screenshots/ios-6.9/{en-US,es-MX}/{raw,framed}/`
(8 screens x 2 languages), `store/icon-512.png`, `store/feature-graphic.png`.

**Not delivered this step** (plan C15: explicitly the lowest priority,
dropped first when time is short): the Play phone screenshot set at
1080x1920 (`store/screenshots/play-phone/en-US/` and `es-419/`). The iOS
raw captures are 1320x2868 (long:short ratio 2.17), which Play rejects
outright (it caps the ratio at 2:1), so this set needs its own capture and
compositor pass, not a resize of the iOS set. Building it is a small
version of the same `frame.html` + Playwright pipeline used for the iOS
framed set (`.part9/frame-build/`, not committed, gitignored), at the
smaller canvas.

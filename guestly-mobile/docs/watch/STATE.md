# Guest-ly Apple Watch app: state (Nov 9 2026)

Branch `feat/watch` (app, from `mw/app` b34975e) and `feat/watch-api` (portal, from `mw/integration` f2494819) in
/Users/nicolas_z/gl-mw/watch and /Users/nicolas_z/gl-mw/watch-portal. Local commits only. Nothing pushed, built on EAS,
deployed or submitted. App version bumped to 1.5.0.

## What works (verified)

- Phase 1, targets: `@bacons/apple-targets` 5.0.0 (pinned) makes the watch app (`com.zcventures.guestly.watchkitapp`,
  companion `com.zcventures.guestly`, watchOS 10.0) and the watch widgets (`.watchkitapp.widgets`), both in app group
  `group.com.zcventures.guestly`. `npx expo prebuild -p ios --clean` reproduces everything; the iPhone scheme builds for the
  simulator with the watch app embedded (`Guestly.app/Watch/GuestlyWatchApp.app`); the watch scheme builds for watchOS simulators.
  The watch target is called `GuestlyWatchApp` because a target named `GuestlyWatch` collides with the new iPhone module's pod.
- Phase 1, bridge: `modules/guestly-watch` (WatchConnectivity; session activated at launch from an Expo app delegate subscriber;
  messages queued until JS listens; 20 s timeout reply).
- Phase 2, snapshot: `src/features/watch/{types,copy,snapshot,flag}.ts`, pure. `scripts/tests/watch-snapshot.test.ts`: 19 checks
  (each role, flag rules, overrun rule, privacy scan, square QR, size under 50 KB, en and es).
- Phase 4, actions: `src/features/watch/actions.ts` + `scripts/tests/watch-actions.test.ts`: 18 checks against a mocked API
  (paths, bodies, role and permission refusals, push-15 order and stop at first refusal, Coordinator stream, clipping).
- Phase 3, UI: all 16 screens (SwiftUI, px / 2 = pt, one Theme file), vertical-page navigation per role, FindGuest sheet,
  phone-needed sheet, toast, haptics. Demo mode (debug builds only): `-glDemo couple|couple-dayof|planner-dayof|guest`,
  `-glDemoLang es`, `-glDemoPage <page>`. Screenshots in `docs/watch/shots/` (46 mm all screens, en and es samples, and
  Countdown, Today and Door on 42 mm and 49 mm). Tools: `docs/watch/tools/shoot.sh`, `sizes.sh`, `gen_demo.py`.
- Phase 5 code: 4 complications (GLCountdown circular, corner and inline; GLArrivals; GLNowNext; GLReplies) and the two
  notification looks, both build.
- Phase 6 portal: `MW_WATCH` registered (opt-in, off everywhere), `categoryId` on the matching pushes, release note, product
  fact F161. `tsc`, `lint`, craft gate and `check-product-facts` pass.
- App gates green: `npm run typecheck`, `lint` (0 errors), `test` (all), `craft`. `native-config.test.ts` pins the watch native set;
  `review-notes.test.ts` knows `MW_WATCH`.

## NOT verified (read this)

1. Phone to watch link end to end. The dev-client app on the iPhone simulator stops at a system "Open in Guest-ly?" dialog
   that cannot be tapped from the command line, so the debug ping (`-glPing 1` on the watch) was never answered by real JS.
   The native module and the JS handlers are each built and tested, but not together.
2. Complications and notification looks were not seen rendered (the widget gallery and the notification permission prompt
   need taps). They compile and are installed.
3. Side by side with the design: the `.dc.html` files need the canvas runtime, so I compared against their px values by
   reading them, not against a render. Fonts, colours and spacing follow the files; check the shots against the canvas.
4. Planner and guest roles, the overrun card, vendor arrivals and the Coordinator were run only on demo data and mocks.
5. Portal: `scripts/test-mw-flags.mts` cannot run on this base (`scripts/demo/test-helpers.mjs` is missing from
   `mw/integration` as well). `npm run build` was not run. The registry entry was checked by hand against that test's rules.
6. Nothing ran on a real Apple Watch.

## Differences from the plan (decided by the simplest option)

- Demo data is `targets/watch/Demo/DemoData.swift` (generated, inside `#if DEBUG`), not JSON files, so Release carries none.
- Fixed watch strings are an in-code table (`L10n.swift`) keyed by the snapshot language, not `Localizable.xcstrings`.
- QR: `qrcode-generator` (pure JS) instead of `qrcode`; the app had no QR library for the guest pass.
- Today shows at most 3 rows (open tasks first, then the latest done one only if there is room), not 4 open + 1 done.
- Vendor arrivals say "On site" without a time (the app has no arrival time); late and due use the run sheet times.
- Guests have no release flag in the API, so the guest watch is on only with `EXPO_PUBLIC_WATCH_FORCE=1` until a guest flag path exists.
- The guest table shows only if the saved Day pack (MW_DAY_PACK) already holds it; the watch never fetches it.
- Planner day of: now and next come from the agenda (no end times, so no progress bar), no run-sheet overrun card (planners
  cannot edit times), no vendor arrivals page (not built for planners).
- Planner `checkin` capability and `tasks`, `runsheet` edit levels gate the matching actions.
- Money on the watch is `$18,400` style (currency symbol, no cents), not the app's `USD 18,400.00`, to fit the screen.
- Push categories are sent to every device (an old build ignores an unknown category); the portal does not check app version.
- Not built, as planned: Send thanks, arrival alert, telling vendors about a time change.

## Side effects on this Mac (tell Nicolas)

- I ran `xcodebuild -downloadPlatform watchOS`, which downloaded and installed the 3.9 GB watchOS 27.2 simulator runtime.
- Created and paired simulators: Apple Watch Series 12 46 mm with iPhone 17 (pair EB0853B6). The three watch simulators
  (46, 42 and 49 mm) were erased more than once and may be shut down. The iPhone 17 simulator has the dev build installed.
- The Metro server I started for the ping attempt was stopped.

## Left for Nicolas

1. Push both branches (his push, not mine).
2. One interactive EAS run with his Apple ID so EAS registers the two new bundle ids, the watch app group and their
   provisioning profiles (the widget target needed the same in October). Remote build number continues from 1.4.0.
3. A pass on a real Apple Watch: phone link in the background, haptics, complications on a real face, mirrored notifications
   (and whether the watch asks for its own notification permission, which did not happen on a clean simulator).
4. Turn `MW_WATCH` on for a demo wedding first. Never `alexnico2026` without his word (the app refuses it too).
5. Open product decisions: arrival alerts (no arrival push exists), telling vendors about a time change (no endpoint),
   run-sheet push for planners, "Send thanks" from the reply alert, a guest flag path for the guest watch.
6. App Store: watch screenshots and review notes before any submission; submission only on his "SUBMIT IOS".

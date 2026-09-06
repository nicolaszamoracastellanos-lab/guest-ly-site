# Guest-ly for iOS and Android

One Expo (React Native, TypeScript, expo-router) codebase. Bundle and package `com.zcventures.guestly`. Companion to the web product at app.guest-ly.com: couples and planners sign in with the portal account, guests open an invite code. The app sells nothing.

## Layout

```
app.config.ts          Expo config (bundle ids, plugins, privacy manifest, deep links)
eas.json               build profiles: development, preview (APK), production
src/app/               expo-router routes
  index.tsx            entrance
  sign-in.tsx          couples and planners (Apple, Google, emailed link, password)
  invite.tsx find.tsx  guest entrance (code, then name)
  notify.tsx           notification pre-prompt (all surfaces)
  i/[code].tsx         deep link app.guest-ly.com/i/{code}?g={guestId}
  guest/               guest tabs: home, rsvp, schedule, concierge, more (+ dayof, messages)
  couple/              couple tabs: home, guests, rsvps, messages, more (+ dayof, checkin, requests)
  planner/             planner tabs: home, guests, requests, budget, more (+ tasks)
  settings.tsx         shared settings (couple and planner)
src/ui/                tokens, Text, Icon set, component kit, floating tab bar
src/i18n/              en.ts, es.ts (typed against en), ladder and formatters
src/lib/               api client, session store, supabase (auth only), push, offline queue, biometric, query cache
assets/brand           icon, splash, wordmark (raster), notification icon
assets/photos          Higgsfield placeholders until real venue photography
docs/                  credentials checklist, Play Console setup
store/                 listing metadata and App Review notes
scripts/screenshots.sh simulator and emulator screenshot runs (demo tenant only)
```

## Run

```
cp .env.example .env        # fill EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npx expo start              # dev client or Expo Go for JS-only screens
npx tsc --noEmit            # typecheck
npx expo lint
```

The app talks only to `https://app.guest-ly.com/api/mobile/v1/*` (see `guestly-portal/docs/mobile-api.md`) and to Supabase Auth for the couple or planner JWT. It never queries a Supabase table.

## Build and submit

See `docs/CREDENTIALS-CHECKLIST.md` for the one-time setup. Then:

```
npx eas build -p ios --profile production
npx eas submit -p ios --profile production --no-wait      # TestFlight
npx eas build -p android --profile preview                # APK to sideload
npx eas build -p android --profile production             # AAB
npx eas submit -p android --profile production            # internal track, once Play Console exists
```

App Store review only after Nico types `SUBMIT IOS`; Google Play only after `SUBMIT ANDROID`.

## OTA updates

JS and copy fixes ship without a store review:

```
npx eas update --channel production --message "copy: ES fixes"
```

Runtime version follows `appVersion`; native changes (new modules, permissions) need a new store build.

## Design rules (enforced)

- Tokens are the portal's `globals.css` values (`src/ui/tokens.ts`). Change the look there only.
- Body copy never below 15px, captions never below 13px (`Text` clamps and warns in development).
- No fake status bar. 54px top safe area minimum. Hit targets 44px. Primary buttons 58px.
- At most one ivory (paper) card per screen. Gold is never text on ivory.
- The wordmark is a raster asset. The gold diamond is drawn in code and is the only place a glyph like it appears.
- Copy: formal, plain, EN and ES, no emojis, no em dashes. "Biometric unlock", never a vendor name.
- Footer: `Guest-ly 1.0` and `Guest-ly is a trademark of Nicolas Zamora.`

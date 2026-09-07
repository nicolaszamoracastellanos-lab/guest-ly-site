# Credentials checklist

Everything the app build and the store uploads need, in the order Nico does them. Nothing here is ever committed. The `credentials/` folder is gitignored.

## 1. Expo account (blocks every EAS command)

Done 7 Sep 2026: logged in as `nzamoras-team`, project `@nzamoras-team/guestly` created (id `1c6ed3fa-7393-40e1-be3d-6fd64f0e1056`, pinned in `app.config.ts`). If a new Mac needs it:

```
! cd ~/Desktop/guest-ly/guestly-mobile && npx eas login
```

## 2. Supabase public values (the app bundle)

`.env` in `guestly-mobile/`:

```
EXPO_PUBLIC_API_BASE=https://app.guest-ly.com
EXPO_PUBLIC_SUPABASE_URL=https://twkwdgwvottotseefnbf.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase, Project Settings, API>
```

Anon key only. The service role key never leaves the portal server. For EAS cloud builds run the same three as EAS environment variables:

```
npx eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key> --environment production --visibility plaintext
```

Repeat for `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_API_BASE` (production, preview and development).

## 3. Portal environment (Netlify, app.guest-ly.com)

| Variable | Value |
|---|---|
| `MOBILE_GUEST_TOKEN_SECRET` | 48+ random characters: `openssl rand -base64 48` |
| `MOBILE_MIN_VERSION` | `1.0.0` |
| `EXPO_ACCESS_TOKEN` | Optional. Expo dashboard, Access tokens. Raises push rate limits. |
| `APPLE_TEAM_ID` | Apple Developer, Membership. Needed for Universal Links (`/.well-known/apple-app-site-association`). |
| `ANDROID_SHA256_FINGERPRINTS` | Comma-separated. From `npx eas credentials -p android` (upload key) plus the Play App Signing key once Play Console exists. |
| `MOBILE_IOS_STORE_URL` | Fill after the App Store listing exists. Shows the link on the dashboard and the wedding site. |
| `MOBILE_ANDROID_STORE_URL` | Fill after Google Play publication. |

Then redeploy the portal (`/deploy` in the session, netlify-cli method).

## 4. Database

Run `guestly-portal/docs/migrations/mobile-v1.sql` in the Supabase SQL editor. It is idempotent. It creates the demo tenant `demo-review` with invite code `CAMAND`.

Then create the two demo logins (the script prints the passwords once):

```
cd ~/Desktop/guestly-mobile-api && node --env-file=.env.local scripts/create-demo-users.mjs
```

## 5. Apple

- Apple Developer Program: enrolled (done).
- Signing credentials (one interactive step, Apple ID login in the terminal). EAS creates the distribution certificate, the provisioning profile, the App ID with Sign in with Apple, and the APNs key:

  ```
  ! cd ~/Desktop/guest-ly/guestly-mobile && npx eas build -p ios --profile production
  ```

  Answer the prompts: log in with the Apple Developer account, let EAS generate everything. The build starts at the end.
- App Store Connect API key (for `eas submit` without an Apple ID prompt): App Store Connect, Users and Access, Integrations, App Store Connect API, Team Keys, Generate. Role: App Manager. Download the `.p8` once.
  - Save it as `guestly-mobile/credentials/asc-api-key.p8`.
  - Put the Key ID and Issuer ID in `eas.json` under `submit.production.ios` (replace the two placeholders).
- Sign in with Apple: enabled automatically by EAS when it creates the App ID (`usesAppleSignIn: true`).
- Push: EAS creates the APNs key on the first `eas build -p ios`. Accept when asked.

## 6. Google

- Play Console developer account: not created yet. See `docs/PLAY-CONSOLE-SETUP.md`.
- Google Cloud service account JSON for `eas submit -p android`: save as `guestly-mobile/credentials/google-service-account.json`.
- FCM: EAS asks for the Firebase service account on the first Android push setup (`npx eas credentials -p android`, Push Notifications, Google Service Account Key). Create a Firebase project `guestly` with package `com.zcventures.guestly`, download the service account JSON, and upload it there.
- Google sign-in in the app uses the portal's existing Supabase Google provider. Add `guestly://auth/callback` to Supabase Auth, URL Configuration, Redirect URLs.

## 7. Supabase Auth redirect URLs

Add exactly these entries in Supabase Auth, URL Configuration, Redirect URLs (exact entries, no query strings):

```
guestly://auth/callback
guestly://
```

## 8. Builds and uploads (in order)

```
cd ~/Desktop/guest-ly/guestly-mobile
npx eas build -p ios --profile production          # creates certs, APNs key, App ID
npx eas submit -p ios --profile production --no-wait   # uploads to TestFlight
npx eas build -p android --profile preview         # APK to sideload today
npx eas build -p android --profile production      # AAB for Play
```

Add Nico's Apple ID as an internal TestFlight tester in App Store Connect, TestFlight, Internal Testing.

App Store review submission happens only after Nico types `SUBMIT IOS`. Google Play only after `SUBMIT ANDROID`.

## What is missing on this Mac (as of 5 Sep 2026)

- Expo login (step 1).
- Xcode.app (only the Command Line Tools are installed): no iOS Simulator, so the screenshot script cannot run here until Xcode is installed from the App Store.
- Android Studio / SDK: no emulator or `adb`. The APK can still be built in the cloud and sideloaded on a device.
- CocoaPods: not needed for EAS cloud builds.

# Google Play Console setup

Nico does this once. Budget 45 minutes plus Google's identity verification wait (usually one to three days).

## 1. Developer account

1. Go to play.google.com/console/signup with the Google account that will own the apps.
2. Choose **Organization**, not personal. Organization: ZC Ventures LLC. Google asks for a D-U-N-S number; request one free at dnb.com (Bolivian or US entity, five to ten business days) if the LLC does not have one yet.
3. Pay the one-time $25 registration fee.
4. Complete identity verification (organization documents, a phone number, the developer email shown on the listing: use `hello@guest-ly.com`).

Organization accounts skip the personal-account requirement of a 14-day closed test with 12 testers before production. If Google classifies the account as personal, that closed test becomes mandatory; keep the account as an organization.

## 2. Create the app

- App name: `Guest-ly`
- Default language: English (United States); add Spanish (Latin America).
- App or game: App. Free.
- Package name is fixed by the first upload: `com.zcventures.guestly`.

## 3. Store listing

- Short description (80 chars): `Your wedding concierge for guests, couples and planners.`
- Full description: copy from `store/metadata.json` (EN and ES).
- App icon 512x512: `store/icon-512.png`.
- Feature graphic 1024x500: `store/feature-graphic.png`.
- Phone screenshots: from `store/screenshots/android/` once the emulator run exists (see `scripts/screenshots.sh`). Demo tenant only.
- Category: Lifestyle. Tags: Weddings, Events.
- Contact email `hello@guest-ly.com`, privacy policy `https://guest-ly.com/privacy`.

## 4. App content (policy forms)

- Privacy policy: `https://guest-ly.com/privacy`.
- Ads: No.
- App access: provide the demo credentials so reviewers can sign in:
  - Guest: invite code `CAMAND`, then type `Sof` and pick Sofía Rojas.
  - Couple: `review@guest-ly.com` and the password from `scripts/create-demo-users.mjs`.
  - Planner: `planner-review@guest-ly.com`.
- Content rating: complete the IARC questionnaire as a Utility/Productivity app, no user-generated public content, no violence. Expect "Everyone".
- Target audience: 18 and over. Not designed for children.
- News app: No. COVID-19: No. Financial features: No. Health: No.
- Government app: No.
- Data safety (mirror the iOS privacy answers):
  - Collected: Name, Email address (couples and planners, account), Device or other IDs (push token), Messages (guest questions to the concierge).
  - Shared: No.
  - Encrypted in transit: Yes. Users can request deletion: Yes (in-app Settings, Delete account, and email nicolas@guest-ly.com).
  - Not used for advertising or analytics.

## 5. Service account for `eas submit`

1. Google Cloud console, create a project `guestly-play` (or reuse the existing Guest-ly Google Cloud project).
2. IAM, Service accounts, Create: `eas-submit`. Create a JSON key and save it as `guestly-mobile/credentials/google-service-account.json`.
3. Play Console, Users and permissions, Invite new users, enter the service account email, grant **Release to production, exclude devices, and use Play App Signing** and **View app information** for the Guest-ly app.
4. `eas.json` already points `submit.production.android.serviceAccountKeyPath` at that file, track `internal`.

## 6. First upload and testing tracks

```
cd ~/Desktop/guest-ly/guestly-mobile
npx eas build -p android --profile production
npx eas submit -p android --profile production
```

The first upload lands in the **Internal testing** track. Add Nico's Google account as a tester and install from the opt-in link. Promote to Production only after Nico types `SUBMIT ANDROID`.

## 7. App Links verification

After the first upload, copy the SHA-256 certificate fingerprint from Play Console, Setup, App signing (both the upload key and the app signing key) into the portal env `ANDROID_SHA256_FINGERPRINTS` (comma-separated) and redeploy the portal. `https://app.guest-ly.com/.well-known/assetlinks.json` must list them for `app.guest-ly.com/i/*` to open the app.

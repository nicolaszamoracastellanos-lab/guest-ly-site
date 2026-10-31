# Wave F second half: screens plan (Guest-ly app)

Written Oct 30 2026 by builder F1 on `hh/f-app` (base `feat/duo-v2`). This file makes items (2) new screens and (5) push events of master prompt section 8.1 mechanical. Nothing here is built yet. The portal routes go on the paired branch `hh/f-app-api` from main, AFTER the portal waves that own the data have merged (A2 settings, D2 album and thank-you, D1 referral, E1 connections and passes, E2 billing). The app must never call a route that is not live (gate 8.2).

Ground rules for every screen below: Guest-ly with the hyphen, no em dashes, EN and ES in the feature's `copy.ts` with correct accents and the app's register (Spanish `tú` for couples and guests, `usted` only where the copy file already uses it for planners), no emoji, no exclamation marks, no "Coming soon". Type by ramp name only (`ui/tokens.ts type`), icons from `ui/Icon.tsx`, the gold disc and the sparkle only for the Coordinator (`CoordinatorMark`), filled glass only on list surfaces (`Card kind="solid"`, `MenuCard`, `ListRow`).

## 0. The pattern every screen follows

Read `src/features/vendors` and `src/app/couple/(tools)/vendors` once; copy their shape.

1. `src/features/<name>/copy.ts`: `export const COPY = { en: {...}, es: {...} }`, read with `useFeatureCopy(COPY)` (never edit `src/i18n/en.ts` or `es.ts` for feature copy).
2. `src/features/<name>/hooks.ts`: response types, query keys as `const` arrays, `useQuery` with `get<T>("/couple/...")` from `@/lib/api`, mutations with `post` / `del` and an optimistic `qc.setQueryData` plus rollback (the notifications screen `src/app/couple/(tools)/settings/notifications.tsx` is the reference). Persist only keys that must open offline (add them to `PERSISTED` in `lib/query`).
3. `src/features/<name>/screens/*.tsx`: the screens, role-aware with a `role` prop when the planner shares them (as `features/checkin/CheckinScreen`).
4. `src/app/<role>/(tools)/<name>/{_layout,index,[id]}.tsx`: thin route files that render the feature screen, keyed by `useTenantKey()` so a wedding switch remounts. `_layout.tsx` is the same real `Stack` as `src/app/couple/(tools)/settings/_layout.tsx`.
5. States, every screen: `Screen query={...}` (offline, stale and error banners come from the kit), `Skeleton` while loading, `EmptyState` with one action when empty, `QueryError` with retry. Two panes on the Duo inner display through `MasterDetail` where the screen is a list plus a record.
6. Pure logic in a `.ts` file with no React Native imports and a `scripts/tests/<name>.test.ts` run by `npm test`.
7. Portal side, one route file per endpoint under `src/app/api/mobile/v1/<role>/<name>/route.ts`, written exactly like `couple/home/route.ts`: `guarded(async (req) => { const s = await requireCouple(req); if (!s.ok) return s.response; return ok(await view(s.value, langOf(req, null, s.value.tenant.locale_default))) })`, `methodNotAllowed` for the other verbs, the view function in `src/lib/mobile/<name>-views.ts` calling the SAME server library the web page uses (never a second implementation), permission checks through `canEditScope` for planners, and a contract test `scripts/test-mobile-<name>.mjs` in the pattern of `scripts/test-mobile-planner-checkin.mjs`.

## 1. Settings (couple and planner)

Today: `src/app/settings.tsx` is one screen per session (wedding switcher, language, push, day-of, biometric, plan line, legal, delete, sign out) and the couple has `settings/{invite,notifications,reminders}`. The portal's wave A2 adds `/settings/{general,team,notifications,profile,billing,integrations}` backed by `user_profiles`, `tenant_invites`, `notification_prefs` and new `tenants` columns (`timezone`, `wedding_city`, `venue_booked`).

App files:
- `src/features/settings/` already exists (copy.ts, hooks.ts). Add `screens/General.tsx`, `screens/Profile.tsx`, `screens/Preferences.tsx`, `screens/Billing.tsx`, `screens/Connections.tsx`, and `team/` (below). Extend `hooks.ts`.
- Routes: `src/app/couple/(tools)/settings/{general,team,team/invite,profile,billing,connections}.tsx`; `notifications.tsx` is rewritten as the preference center. Planner: `src/app/planner/(tools)/settings/{_layout,index,team,notifications,profile,billing,connections}.tsx` with the agency scope.
- `src/app/settings.tsx` becomes the index: a `MenuCard` per group (Your wedding: General, Team, Billing, Connections; You: Profile, Notifications, Language, Biometric; App: Tour, Privacy, Terms; Delete account, Sign out). Rows show a live line (team count, plan name, "2 need setup").

Endpoints (portal `hh/f-app-api`, each wraps the A2 server code):

| Method and path | Body / response | Wraps |
|---|---|---|
| GET `/couple/settings/general` | `{ couple_names, wedding_date, wedding_city, venue_booked, timezone, locale_default, can_edit }` | tenants row |
| POST `/couple/settings/general` | partial of the above; 400 with field errors | the A2 server action's validator |
| GET `/me/profile` | `{ first_name, last_name, lang, timezone, marketing_consent, email }` | `ensureProfile` + `user_profiles` |
| POST `/me/profile` | partial; `marketing_consent` stamps `marketing_consent_at`, source `app` | same |
| GET `/me/prefs` | `{ events: { key, channels: { email, push, bell }, mode? }[], quiet_hours, marketing }` | `getPrefs(userId, tenantId)` in `src/lib/prefs.ts` |
| POST `/me/prefs` | `{ event, channel, enabled }` or `{ event: "rsvp_new", mode: "instant"|"daily" }` | same |
| GET `/couple/billing` | `{ tier, tier_label, cap, used, live_until, maintenance: { state, monthly_usd }, upgrade_links: { tier, url }[] }` | `billing-plans.ts`, `usage.ts`, `maintenance.ts` |
| GET `/couple/connections` | `{ items: { provider, category, status: "connected"|"needs_attention"|"not_set_up", reason, last_ok_at }[] }` | wave E1 `connections` table |

Screens:
- General: a form (`Field`, `Input`, `DateEcho` for the date, a `Segmented` for language, a searchable `Pickers` list for the time zone grouped by region), one Save in the `TopBar`, `useUnsavedGuard`. View-only for `can_edit: false` with a one-line note.
- Profile: first and last name, language (also calls `setLang`), time zone (default from `Intl.DateTimeFormat().resolvedOptions().timeZone` on first open, saved only on Save), marketing consent `ToggleRow` with the CAN-SPAM one-liner from the A2 copy, "Change password" opens the existing reset link in `web`.
- Notifications (preference center): one `Card` per event (RSVP replies, Daily roundup, Monday digest, Questions waiting, Tasks due, Planner requests, Escalations, Product news), a `ToggleRow` per channel (Email, Push, In-app). RSVP replies gets a `Segmented` Instant / Daily. Quiet hours: two `Pickers` hours. Push channel toggles also update `savePushPrefs` locally (see section 9). Marketing switch at the bottom, the same value as Profile.
- Billing (read-only): plan name, guests used of cap as a bar (the Home funnel bar style), live until date, maintenance line. Upgrade rows open the Stripe link in `WebBrowser.openBrowserAsync` (no in-app purchase: a wedding service sold on the web, App Review guideline 3.1.3(e); keep the link out of the guest surface).
- Connections (read-only): rows grouped by category, each with a status `Badge` (green Connected, amber Needs attention, mute Not set up) and the reason line from the server; a row opens the web `/settings/integrations` for setup (live on every portal build; once the wave E Connections page ships it redirects to `/settings/connections`, so the link never 404s whatever the merge order). No secrets ever reach the app.

API needs: the A2 and E1 tables must exist; `tenants.timezone` replaces `websites.config.reminders.tz` (today `/couple/settings` returns `wedding.timezone`; keep that key).

## 2. Team (partner invite)

App files: `src/features/settings/team/{hooks.ts,TeamScreen.tsx,InviteSheet.tsx}`; route `src/app/couple/(tools)/settings/team.tsx`; planner `src/app/planner/(tools)/settings/team.tsx` (agency members, read-only unless agency admin).

Endpoints:
- GET `/couple/team` -> `{ members: { user_id, name, email_masked, role, is_me }[], invites: { id, email_masked, role, expires_at, status }[], can_invite }`. Emails masked (`a***@gmail.com`) except the caller's own.
- POST `/couple/team/invite` `{ email, role: "admin"|"viewer", lang }` -> `{ id }`. Server: insert `tenant_invites` with a hashed token, send C14 through `notify.ts sendPartnerInvite` (A2). 409 when already a member.
- POST `/couple/team/invite/{id}/resend`, DELETE `/couple/team/invite/{id}`.
- Accept happens on the web `/invite/[token]` (A2); the app opens universal links `https://app.guest-ly.com/invite/*` in `web.tsx` and then signs in with the existing email code flow.

Screen: members as `ListRow` with `Avatar` and a role `Badge`; pending invites below with Resend and Cancel in a long-press menu (`ListRowLongPress`) and swipe; primary `DockedAction` "Invite your partner" opens `InviteSheet` (email `Input` with `textContentType="emailAddress"`, role `Segmented`, language `Segmented`). Toast "Invitation sent." with Undo (Undo calls DELETE).

## 3. Notifications screen and push events

See section 9 for the push wiring. The screen itself is section 1's preference center.

## 4. Profile

Section 1. The avatar row at the top of `settings.tsx` opens it.

## 5. Billing

Section 1 (read-only). Planner billing (`/planner/billing` on the web) stays web-only; the planner settings index links to it in `web.tsx`.

## 6. Connections

Section 1 (read-only status chips). Planner variant reads `/planner/connections` with the same shape.

## 7. Album (guest upload, couple moderation)

Depends on wave D2: `album_photos`, bucket `wedding-photos`, `websites.config.album`, routes `api/mobile/v1/guest/album` and `couple/album` (D2 writes these; F only consumes them, check their final shape before building).

Contract (agreed Oct 30 2026: the app follows the album branch `hh/d-album-thankyou`, `src/lib/mobile/album.ts`; the portal's `scripts/test-mobile-album.mjs` checks it end to end and saves the real GET answers the app's `scripts/tests/album.test.ts` reads from `scripts/tests/fixtures/album-*.json`):
- GET `/guest/album` and `/couple/album` -> `{ album: { enabled, moderation, share_with_guests, upload, see_all, link }, photos: { id, status, width, height, caption, mine, from?, created_at, small, large, original? }[] }`. No paging: the couple gets every status in one answer (the tabs filter it in the app); `from` (uploader name) and `original` are couple-only. Photo links are absolute and load without a cookie (`?g=` for a guest, a 6-hour `?m=` grant for the couple).
- A guest's GET is 403 `forbidden` while the couple keeps the album off; the app reads it as "closed" and hides the Info row.
- POST to the same path with `{ action }`: `upload_url` `{ content_type, bytes }` -> `{ id, upload_url, token, path, method: "PUT" }`, then `PUT upload_url` with the file (`Content-Type`, `x-upsert: true`), then `complete` `{ id }` -> `{ photo }`. Couple only: `moderate` `{ ids, status }` -> `{ updated }`; `settings` `{ album: { enabled?, moderation?, share_with_guests? } }` -> `{ album }`. Viewers read only (403 on POST).

App files: `src/features/album/{copy.ts,hooks.ts,upload.ts,grid.ts,screens/GuestAlbum.tsx,screens/CoupleAlbum.tsx,Lightbox.tsx}`; routes `src/app/guest/(more)/album.tsx` (entry row on the guest Info tab next to Photos) and `src/app/couple/(tools)/album/{_layout,index}.tsx` (entry row in couple Tools).
- Upload: `expo-image-picker` (already a dependency; multiple selection, `quality: 0.85`), resize to 2400 px long side with `expo-image-manipulator` (already a dependency) before upload, `expo-file-system` upload task with progress (`FileSystem.createUploadTask`, `httpMethod: "PUT"`). A per-photo progress ring and a retry on failure. Uploads continue in a small queue modeled on `lib/queue.ts` (persisted, client ids) so a guest at the party with bad signal does not lose photos.
- Grid: `FlatList` with `numColumns` from `useLayout().columns` (3 on phones, 5 on the Duo inner display), `expo-image` with `cacheKey` per photo id, `recyclingKey`. Pure layout math in `grid.ts` with a test.
- Couple moderation: segmented Pending / Approved / Hidden, long press for Approve and Hide, a multi-select bar (`features/inbox/selection.tsx` pattern), a header action to copy the share link.
- Purpose strings already cover the photo library (`app.config.ts PHOTOS_PURPOSE`); extend the text to "the wedding album" in EN and ES (locales/*.json) in the same commit.

## 8. Thank-you list

Depends on D2 `/thankyou` server code.
- GET `/couple/thankyou` -> `{ items: { guest_id, party_names, table, attended: boolean, draft: string|null, done: boolean }[], source: "checkin"|"confirmed" }`.
- POST `/couple/thankyou/{guest_id}/draft` -> `{ draft }` (server calls the D2 helper with claude-haiku-4-5-20251001; the app never talks to a model).
- POST `/couple/thankyou/{guest_id}` `{ draft?, done? }`.

App: `src/features/thankyou/{copy.ts,hooks.ts,screens/List.tsx,screens/Note.tsx}`; routes `src/app/couple/(tools)/thankyou/{_layout,index,[id]}.tsx`; entry row in couple Tools that appears from the wedding day on (`countdown.passed` or `day_of`). List with a done check per row and a progress line ("12 of 80 written"); the note screen is a multiline `Input` with Write draft, Copy (`expo-clipboard`, already a dependency) and Mark done. Two panes on the Duo.

## 9. Push events (item 5)

Today the prefs are per surface keys in `src/app/notify.tsx` (guest `dayof, replies, rsvp_reminder`; couple `rsvps, escalations, tasks`; planner `approvals, tasks`), saved with `registerPush(surface, token, prefs)` and `savePushPrefs`, and `routeFor` in `src/lib/push.ts` maps a tapped push to a screen through `SECTIONS`.

Add (portal: the same keys in `src/lib/push.ts` prefs on the server and the senders in the D2 and A2 code paths):
- couple `album` ("A guest added photos" and "Photo approved" for the uploader is guest-side), `team` ("Your partner joined"), guest `album` ("Your photo is in the album"), guest `pass` ("Your pass was updated": seating or times changed, from E1's wallet update queue).
- `notify.tsx`: append the keys to `couplePrefs` and `guestPrefs` with labels in `src/i18n/en.ts` / `es.ts` (`notify.album`, `notify.team`, `notify.pass` plus details).
- `push.ts SECTIONS`: add `album`, `thankyou` to couple; `album`, `pass` to guest. `routeFor` then accepts `/couple/album`, `/guest/album`, `/guest/pass`.
- The settings preference center (section 1) shows the same keys as its Push column and writes both `/me/prefs` and `savePushPrefs`.
- Test: extend `scripts/tests/` with a `push-routes.test.ts` that imports a pure copy of `routeFor` (move it to `lib/pushRoutes.ts` first, no React Native imports).

## 10. Wallet pass button

Depends on E1: `/api/wallet/apple/[slug]?g=` (pkpass) and the Google save link; the pass page `/pass/[slug]` already exists on the web.
- Guest API: extend GET `/guest/home` with `pass: { apple_url: string|null, google_url: string|null, web_url: string }` (null when E1 has no credentials: the button hides).
- App: `src/features/guest/WalletButton.tsx` on the guest Invitation tab under the paper RSVP card once the guest is attending, and on Day-of. iOS: the official "Add to Apple Wallet" badge artwork (Apple's asset, not redrawn) opening `apple_url` with `Linking.openURL` (Safari hands the pkpass to Wallet). Android: "Save to Google Wallet" opening `google_url`. A native PassKit module is out of scope (8.1).
- Copy: "Add to Apple Wallet" stays in Apple's artwork; our caption under it "Your pass for the door, also offline." / "Tu pase para la puerta, también sin conexión."

## 11. Referral share sheet

Depends on D1: `tenants.referral_code`, public `/r/[code]`.
- GET `/couple/referral` -> `{ code, url, joined: number, paid: number, reward_line: string|null }`.
- App: `src/features/referral/{copy.ts,hooks.ts,ReferralCard.tsx}`; a row in `settings.tsx` (Your wedding group) and a card on Home after the wedding (`countdown.passed`). Share with `Share.share` (the `useShareInvite` pattern in `features/couple/ui.tsx`) with a message in the couple's language. No reward copy until D1's terms are approved by Nicolas.

## 12. Home: API needs found by the craft pass

The wedding-first Home (`src/app/couple/index.tsx`) uses only what `GET /couple/home` and `GET /couple/rsvps?filter=all` return today. To match the web dashboard exactly, `/couple/home` needs these additive fields (portal, `src/lib/mobile/couple-views.ts coupleHome`):

1. `setup: { key, done, label, path }[]` from B1's `setupStatus(tenantId)` (section 4.4: date and city, 10+ guests, 6 Brain sections, website published, RSVP opened, WhatsApp sender live, reminders on, first broadcast, passes sent). Today Home derives five steps from the payload (date, guest list, invitations out = any reply, concierge live = tenant status, budget priced); the real list replaces them one to one.
2. `activity: { kind, text, at, target }[]`: the last 10 events from `events_log` / B4's `guest_events` (RSVP received or changed, guest message, request, payment, broadcast sent), already localized. Today Home shows the last five answered RSVPs from the RSVP list.
3. `rsvp_deadline` on `/couple/home` itself, so Home stops loading the whole RSVP list for one date.
4. `hero_image_url` and focal point for the couple (the guest home has them), so the couple's own photo can stand where the night motif is.
5. `funnel.opened`: parties that opened their personal link (B4 `link_opened`), to add the "Opened" step between Invited and Replied.
6. `today.events`: the day's tasks due and vendor payments due with times, so Today is a day plan, not only alerts.
7. A wedding date editor. Today no app screen and no mobile route can change `tenants.wedding_date` (`POST /couple/settings` takes reminders and the two email switches only), and `/web` refuses `/dashboard` on purpose (`SIGNED_IN_PATHS` in `src/features/webview/bridge.ts`, D-019). So the Home "Wedding date" step only reports (no chevron, not tappable; "Not set yet" / "Todavía sin fecha" when empty). When Settings > General ships (section 1: `GET`/`POST /couple/settings/general` with `wedding_date`), give the step `onPress: () => router.push("/couple/settings/general")`, and do the same for a step that B1's `setup[].path` maps to that screen. Never add `/dashboard` to the web allow-list for this.

## 13. Order of work for the second half

1. Portal `hh/f-app-api` from main after A2, D1, D2, E1, E2 merged: the routes above with contract tests, deployed before any app build (gate 8.2).
2. App, one commit each: settings index and General, Profile, Preferences (with push keys), Team, Billing, Connections, Album (guest then couple), Thank-you, Wallet button, Referral, Home API needs (setup, activity, deadline, hero).
3. Checks: `npx tsc --noEmit`, `npm test`, `npx expo-doctor`, then a dev build (the contacts module from this wave and any new native code need one) and simulator screenshots at iPhone 16 Pro and the Duo sizes in `docs/duo-v2/MEDIDAS.md`.

# Guest-ly mobile build log

Started 5 Sep 2026 from the master execution prompt. Portal work lives on branch `feat/mobile-v1` (worktree `~/Desktop/guestly-mobile-api`); the app lives in `guest-ly/guestly-mobile/`.

## Decisions and conflicts (document vs design artifact vs portal code)

1. **Fonts and colours.** The prompt named Playfair Display + Inter and navy `#0D1B2A`, ivory `#FAF6F0`, gold `#B8965A`. The design artifact and the portal's `globals.css` use Cormorant Garamond + Jost and night `#0d1117`, ivory `#f7f3ec`, gold `#c9a96e`. Nico confirmed the artifact look on 5 Sep 2026 and the web product ships those exact values, so the app uses them. Deliberate deviation from "document wins". One file to flip: `src/ui/tokens.ts`.
2. **Trademark line.** Shipped as `Guest-ly is a trademark of ZC Ventures LLC.` Nicolas switched it from his own name to the LLC on the first device test (Sep 7 2026).
3. **Biometric label.** `Biometric unlock` everywhere in copy (document). The only "Face ID" strings are Apple's own Info.plist key name and the config plugin option, which must keep their names.
4. **NFC tap-in.** Out of scope for v1 (document). The artifact screen is not built. Door check-in is camera QR plus name search.
5. **Planner scrubbing.** Mobile planner payloads never carry phone or email and free text is scrubbed (document). The web widened planner read scope on Aug 12 2026 (`authz.ts`); the app is stricter on purpose.
6. **Messages table.** The app thread rides the bot transcript tables (`conversations` + `messages`) with `app` added to the channel enum and `guest_id`, `direction`, `needs_couple`, `author`, `replied_at` columns. One conversation per guest, identifier `app:{guestId}`.
7. **Check-ins.** `guests.checked_in_at` alone could not carry seats or an idempotency key, so `checkins` was added. The stamp still goes through the existing `checkInGuest` action.
8. **WhatsApp replies.** The portal has no free-form WhatsApp send path (the engine owns WhatsApp; the portal sends approved templates only). A couple reply on a WhatsApp thread returns a `wa.me` link the app opens; app threads are stored and pushed.
9. **Session injection.** The portal's mutation actions all call `getSession()` (cookies). `lib/mobile/store.ts` injects a Bearer-verified session through AsyncLocalStorage and `getSession()` returns it first, so saveGuest, saveManualRsvp, sendRsvpReminders, approveRequest, declineRequest, createRequest, cancelRequest, plannerUpdateTask and checkInGuest run unchanged.
10. **Cache storage.** SecureStore caps values at 2 KB on iOS, so the home payload cache lives in AsyncStorage; tokens stay in SecureStore.
11. **Reading a missing column.** PostgREST answers a filter on a column that does not exist with raw `42703`, not `PGRST204`. `lib/mobile/tenant.ts` treats both as "pending migration" (verified locally: `/auth/guest/open` returns `pending_db` before the migration).
12. **"upgrade" grep gate.** The document asks for an upgrade banner and also forbids the word in `src/`. Identifiers and copy say "update"; the server field stays `update_required`.
13. **Photos.** Higgsfield placeholders (walk, suite, bluehour table, hands, courtyard, ceremony, toast, dance). Two generations were rejected for garbled lettering. Real venue photography still needed.

## Workstreams

| # | Workstream | Status |
|---|---|---|
| 1 | Mobile API (36 routes, push lib, triggers, migration, invite links, well-known) | Built, typechecks, auth paths smoke-tested locally |
| 2 | App scaffold and design system (tokens, Text, 50-icon set, kit, floating tab bar, i18n EN/ES) | Built, typechecks |
| 3 | Guest side (entrance, invite, find, notify, home, RSVP flow, schedule, concierge, day-of, messages, more) | Built |
| 4 | Couple side (home, guests, detail, new guest, RSVPs, record, messages, reply, more, day-of, check-in, requests, settings) | Built |
| 5 | Planner side (home, guests, requests, detail, new request, tasks, budget, more) | Built |
| 6 | Push (registration, delivery, bell hook, guest triggers, tap routing) | Built |
| 7 | Web touchpoints (dashboard invite card, gated store links, /i redirect, app-link files) | Built |
| 8 | Store readiness (config, privacy manifest, metadata, review notes, screenshot script, Play guide, credentials checklist) | Built; builds and uploads blocked on Expo login and Xcode |

## Blocked on Nico (cannot be done from this Mac today)

- `npx eas login` and `npx eas init` (no Expo session on this machine).
- Xcode.app is not installed (Command Line Tools only): no iOS Simulator, so the screenshot script and the simulator screen audit cannot run here.
- No Android SDK or emulator: the APK builds in the cloud and can be sideloaded on a device.
- `docs/migrations/mobile-v1.sql` has not been applied (by design, Nico runs it). Until then every mobile route answers `pending_db` and the functional smoke (RSVP submit, concierge, replies, check-in replay) cannot run end to end.
- App Store Connect API key, Google service account, Firebase project for FCM.

## Log

- 5 Sep 2026 evening: survey, conflicts listed, portal worktree `feat/mobile-v1` from origin/main 2334c21. Session injection, respond envelope, guest tokens, push lib, all routes, migration, triggers, dashboard card, site link, well-known, `/i/{code}`. Portal `tsc` clean.
- 5 Sep 2026 night: Expo SDK 57 scaffold, tokens, i18n, kit, tab bar, session store, query cache, offline queue, biometric, all screens for the three surfaces, settings, deep link landing, auth callback. App `tsc` clean. Local smoke of the API: 401 on missing or bad Bearer and Guest tokens, `pending_db` on the invite code before the migration, `/.well-known` files served, `/i/{code}` redirects.
- 7 Sep 2026: Expo login (nzamoras-team). EAS project @nzamoras-team/guestly (1c6ed3fa-7393-40e1-be3d-6fd64f0e1056). Public env vars set for production, preview, development. First Android builds failed on `npm ci` (lock out of sync, TypeScript 6 vs a nested 5.9 requirement): pinned typescript ~5.9.2. Android preview APK and production AAB FINISHED. `.easignore` at the repo root (214 MB upload became 2.3 MB). Apple: ASC API keys ZU8D4U79LL (Developer) and NN6585S6RY (App Manager, used by EAS); credentials created interactively in Terminal with the API key (Team 3F998LXJ33, individual). iOS build b332c5cc FINISHED (build number 6). App Store Connect app record created (Apple ID 6809618039). `eas submit` uploaded the build to App Store Connect; Apple processing pending. Open on Apple's side: the Account Holder must accept the updated Program License Agreement (blocks App Store review submission, not TestFlight) and the EU trader status question.

## Sep 7 2026, evening: full smoke against the real database

Local portal (feat/mobile-v1, worktree ~/Desktop/guestly-mobile-api) on :3117 with
MOBILE_GUEST_TOKEN_SECRET set; migration mobile-v1.sql applied; demo users created.

Guest side (invite CAMAND): open, identify, session, home (ES), schedule, rsvp GET
and POST, dayof, messages, push register and delete, invalid_code, bad_request,
guest token rejected on couple routes. All pass.

Couple side (review@guest-ly.com): auth/me, home, guests (search, detail, add,
edit), rsvps (pending filter, record manual answer), inbox and reply (delivered
to the app thread, guest sees role "couple"), more, dayof, check-in with seats
plus idempotent replay (already true, replayed true), request approve with
party size executed. All pass.

Planner side (planner-review@guest-ly.com): auth/me, home, weddings guests
(40 guests, no phone or email keys in the payload), file plus_one request,
comment, cancel-after-resolution rejected. All pass.

Security: planner on couple route 403, couple on planner route 403, planner
write 403, x-gl-tenant header cannot switch a couple to another tenant.

Fixed during the smoke
- App sent plus_one as add_seats; the portal validates additional_seats.
  Corrected in planner/requests/new.tsx (clamped 1 to 5).
- Portal actions return one localized error string; the app now gets both
  languages through failAction() in src/lib/mobile/respond.ts (commit b54f895).

Not verifiable locally
- /guest/concierge returned engine_unavailable because the local .env has no
  BOT_ENGINE_KEY. Production Netlify has it; the same handler serves the web
  bot today. Verify on TestFlight after the portal deploy.
- Reminders: demo guests have no phone, so remind correctly returns
  "no one to remind". Nothing was sent to anyone.

Demo tenant restored to seed state after the run (smoke guest, check-in,
planner request removed; Sofía and Diego reset). TestFlight internal group
"Guest-ly team" created, Nicolas added as tester. Apple build 6 VALID.

## Sep 7 2026, night: portal deployed, mobile API live

- feat/mobile-v1 merged into portal main (8d16fb4). Main had gained two
  Session fields since the branch (contactAccess, memberLang, wave 12);
  the mobile resolver now fills them with the same wide/narrow tenant_users
  select as getSession() (085ef06).
- Netlify env set on guestly-portal: MOBILE_GUEST_TOKEN_SECRET (secret,
  production + previews), MOBILE_MIN_VERSION=1.0.0, APPLE_TEAM_ID=3F998LXJ33.
- Deploys 6a9f49c7 (API) and 6a9f4ac0 (invite redirect fix, dba3179).
  Verified live: /login 200, apple-app-site-association and assetlinks.json
  served, /i/CAMAND redirects to app.guest-ly.com/rsvp/demo-review (was the
  unique Netlify deploy host before the fix), guest open/identify/session/
  home/schedule, concierge, couple auth/me, home, planner guest scrub,
  401 without auth, web portal and web bot unaffected.
- Concierge root cause: the seeded demo-review wedding_facts row had no
  generated prompts and the engine requires them (it answered with its
  technical-problem fallback, on the web bot too). Republished the same
  facts through the portal's publish_wedding_facts RPC (version 2). The
  engine now answers from the demo facts. No engine code touched.
- Undone: the local smoke had called /auth/delete-account as the demo
  planner, which flagged the auth user and emailed the operator. Flag and
  event removed. Ignore that email.
- Still with Nicolas: Supabase Authentication, URL configuration, add
  guestly://auth/callback to the redirect allow-list (magic link and Google
  sign-in from the app; password sign-in works without it). The API change
  was blocked by the session's permission classifier.

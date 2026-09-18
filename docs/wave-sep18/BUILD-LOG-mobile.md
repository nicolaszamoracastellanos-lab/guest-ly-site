# BUILD LOG: Guest-ly mobile, Part 9 wave (Sep 18 2026)

Branch `mobile/part9-audit`. Plan: `docs/wave-sep18/PLAN-mobile.md`. One entry per step, newest last.
Agents commit locally and never push (plan C12).

---

## Step 1, harness (Sep 18 2026, finished 18:45 CDT after one interruption)

**Seed applied at: NOT YET.** The demo seed was built and dry-run only; pass A1 (empty states) must
be captured first. demo-review was not written to by this step, except the reads and the sign-ins
below and one guest session for Sofía Rojas per guest walk.

### What exists now

- The app runs on simulators from an EAS cloud build, profile `sim-dev`, build
  `d267d22f-c9fd-4f44-bc3b-6751541f44d4` (commit 9a38dfd, queue 5 s, build 9 min). JS comes from a
  local Metro on port 8097, so no fix needs a rebuild. **1 of the 3 allowed simulator builds is
  used.** No production build, no submit, no update, no deploy, no SQL, no push.
- Simulators: S = iPhone SE 3rd gen created for the wave (375 pt), M = iPhone 17e, L = iPhone 17
  Pro Max, T = iPad mini, P = iPad Pro 13. UDIDs in `guestly-mobile/scripts/part9/env.sh`.
- Java 17 (brew) and Maestro 2.10.0 (official installer). Maestro DOES drive iOS 26.5.
- `guestly-mobile/scripts/part9/`: `env.sh`, `sim.sh`, `lib.mjs`, `inject-session.mjs`,
  `resolve-ids.mjs`, `routes.json` (102 rows), `walk.mjs`, `sheet.mjs`, `flow.mjs`,
  `tap-targets.mjs`, `proxy.mjs`, `seed-demo.mjs`, `web-rig.mjs`, `gates.sh`, `copy-parity.mjs`.
- `guestly-mobile/.maestro/`: `prep`, `launch`, `signin-ui`, `invite-ui`, `scroll-shots`,
  `open-sheet`, `keyboard`, `tap-point`.
- Product code touched: `testID` props only (11 files), plus `src/lib/secure.ts` (re-export of
  expo-secure-store, native behaviour identical) and `src/lib/secure.web.ts` (localStorage, web
  rig only, never in a native bundle). `session.tsx` imports from `@/lib/secure`.
- Every exact command, version, UDID, gotcha and deviation: `guestly-mobile/docs/PART9-HARNESS.md`.
- Demo passwords: `guestly-mobile/credentials/demo-accounts.env` (gitignored, easignored, mode
  600). Both logins answer HTTP 200. They were NOT reset.

### Resume note

The first builder of this step was cut off by a usage limit at about 15:01 CDT with everything
uncommitted. The second builder reviewed that tree, kept it, and found and fixed these before
committing:

1. `gates.sh` token gate failed on the web export, which inlines the PUBLIC Supabase anon key. The
   gate now filters exactly that value (read at run time) and prints file names only. Self-tested
   with a fake JWT: still caught.
2. The web rig had only ever run the signed-out set. Guest, couple and planner paths were broken:
   the invite screen opens by itself on the sixth character (the rig and `invite-ui.yaml` tapped a
   button that was already gone, and would have called `/auth/guest/open` twice); `/notify` never
   shows on web; the More walk tried to click buttons of tab screens that stay mounted but
   covered, so the couple walk crawled. All three fixed; the language toggle on guest More is
   excluded so a walk cannot flip its own language.
3. `signin-ui.yaml` timed out behind the iOS Save Password sheet. It now declines first.
4. `sheet.mjs` left an empty band under every contact sheet; default is now 3 per row as planned.

### Evidence (every image listed was opened and looked at)

- Gates: `bash guestly-mobile/scripts/part9/gates.sh` clean: tsc 0 errors, eslint 0 errors and 9
  warnings (the baseline, unchanged), all grep gates empty, feature copy parity 16 files 0 problems.
  expo-doctor: 19 of 21 checks pass. The 2 that fail are pre-existing (`package.json` is
  untouched in this wave): `eas-cli` is listed in the project dependencies, and 34 packages are
  behind the SDK 57 patch set. No dependency or SDK change is allowed in this wave (plan D5), so
  both are left and reported.
- Production JS export: `npx expo export -p ios` (5.8 MB hbc) and `-p android` (6 MB hbc) both exit
  0; output deleted. The project has no unit test script (`package.json` has only `lint`).
- Walks (captured / skipped): S none EN 9/0, S couple ES 71/12, L couple EN 4/0, L planner ES
  15/5, L planner EN 3/0, T guest EN 14/0, T guest ES 14/0. Skips are empty lists before the seed
  (no id to open) plus S08 to S10, which need a person, the proxy or Maestro. Shots under
  `guestly-mobile/.part9/shots/<device>/<lang>/<role>/` (gitignored).
- Entrance seen on S, L and T. Couple, planner and guest each reached home in EN and in ES.
- Maestro: `signin-ui.yaml` passed in ES on S (real UI sign-in as the demo couple; the run folder
  was deleted; iOS was told not to save the password). `invite-ui.yaml` passed on S (CAMAND, "Sof",
  Sofía Rojas). `scroll-shots`, `open-sheet`, `keyboard` proven on S.
- Injection calibrated against that real sign-in: same key, same MD5 file naming, same JSON fields.
  Switching one simulator guest to couple by injection works (guest meta removed, fresh grant).
- Proxy: `pass`, `fail`, `pass` on `/couple/guests` changed and restored the screen
  (`.part9/probe/px-*.png`). Metro is back on the direct base.
- Seed: `--dry-run` clean (tenant fence ok for both accounts, task reminders off, every target list
  empty). Portal routes it calls all exist; shared board task creation sends nothing.
- Web rig: WEB_RIG_LOG

### Leads handed to the audit step (seen while proving the harness, not yet filed)

- **H29 (new). The notification pre-prompt never shows when a guest enters by code and name.**
  `find.tsx` asks for `/notify`, but the session gate in `_layout.tsx` counts `/find` as an entrance
  and replaces the route with `/guest` the moment the guest session exists. Seen with Maestro on S
  (`invite-ui.yaml`) and again on the web rig. The invite LINK path (`/i/[code]`) does show
  `/notify`, because `i` is not in the entrance list. Guests who type their code are therefore
  never asked for push permission unless they find the toggle in More. Couples and planners are
  only asked from Settings by design (`sign-in.tsx` never routes to `/notify`); the audit should
  confirm that this is intended.
- H11 confirmed once: with the API failing, `/couple/guests` shows its EMPTY state, not an error.
- `/couple/guests/[id]` prints `[object Object]: attending` for per-event answers (S, ES, C03).
- Raw ISO date `2027-03-21` on find, planner home and guest home header (H10).
- The assistant bubble covers status badges on list rows and sits beside the guests FAB (H22).
- Web rig at 1440: every surface stretches edge to edge (H12 family).
- S06 `guestly:///web?path=//example.com` rendered a portal page inside the web view rather than
  the refused state; S07 (`?url=`) was refused. Not a foreign origin, but the audit should decide
  whether `//host` paths must be refused outright (H25).
- demo-review is being used by someone else at the same time: the guest count read 42, 41 and 40
  parties across the afternoon. This step created no guest.

### Decisions

- Session injection over a dev-login route: zero product code, no password typed into a UI.
- The seed waits for the audit step (A1 before seeding).
- The rig serves the web export itself with an SPA fallback instead of `python3 -m http.server`.
- iPad: on iPadOS 26.5 the phone-only app runs in a compatibility WINDOW. Audited as such; the
  phone-only decision (D4) is recorded by the fix step in `guestly-mobile/BUILD-LOG.md`.

### Not done, and why

- `sim-release` build: belongs to the end of the fix step by plan. The `GL_BINARY=release` branch
  of the scripts has therefore not run yet.
- M and P simulators not booted yet (two simulators at a time; nothing in the harness done-bar
  needs them). The app installs the same way.
- No real write by `seed-demo.mjs` yet, so its field-level payloads are unproven. It stops at the
  first non-2xx and saves its ledger after every row.
- Not testable on this Mac: Sign in with Apple and Google end to end, real push delivery, QR
  scanning with a real camera, biometric hardware, Android on any device, a real iPad.

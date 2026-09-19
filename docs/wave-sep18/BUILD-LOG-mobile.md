# BUILD LOG: Guest-ly mobile, Part 9 wave (Sep 18 2026)

Branch `mobile/part9-audit`. Plan: `docs/wave-sep18/PLAN-mobile.md`. One entry per step, newest last.
Agents commit locally and never push (plan C12).

---

## Step 1, harness (Sep 18 2026, finished 18:33 CDT after one interruption)

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
   covered, so the couple walk crawled; and one live page was resized from width to width, which
   produced false overflow numbers (see Evidence). All fixed; the language toggle on guest More is
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
- Web rig: guest, couple and planner each walked end to end at 360 and 1440 in ES by clicking
  (89 screenshots, 6 min), signed-out set at 360. That run exposed a RIG artifact: resizing one live
  page left the assistant bubble at its old x, which read as 16 px of horizontal overflow on every
  screen at 360. The rig now reloads after each width change; the planner rerun gave 24 screenshots
  and 0 overflow. The misleading shots were deleted. Full six-width run = audit pass A9.

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
- Web rig at 1440: every surface stretches edge to edge (H12 family). Web rig at 360: the entrance
  is 420 px wider than the window (the 780 px photo keeps its intrinsic width), the only real
  horizontal overflow seen so far.
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

---

## Step 2, audit (Sep 18 2026, 18:35 to 20:35 CDT)

**Seed applied at 2026-09-18T23:50:52Z (18:50 CDT)**, after pass A1. Retitled to ES at 19:05 and back
to EN at 19:30 CDT. `seed-demo.mjs --verify` at the end: English seed, one open request, reminders
off. `emailSent=false`. The seed payloads are now proven by a real write (no non-2xx).

No product code was changed (the step is find, not fix). No resume work was found: the tree was
clean and `docs/PART9-AUDIT.md` did not exist, so the step started from zero.

### What exists now

- `guestly-mobile/docs/PART9-AUDIT.md`: header, the matrix (102 rows x S, L, T x EN, ES), the other
  passes, the defect register (43 defects: 4 P0, 28 P1, 10 P2, 1 P3), the hypotheses table (H1 to
  H29), the writes made on demo-review, the seed ledger ids, notes for the fix step.
- `guestly-mobile/docs/part9/audit-notes.md`: the raw reading notes, 30 batches, written to disk
  and committed batch by batch (plan C11).
- `guestly-mobile/docs/part9/evidence/`: 47 JPEG at 1000 px, 3.7 MB. The capture that shows a real
  tenant (D-001) is deliberately NOT in git, and the real names were removed from the notes.
- `guestly-mobile/.maestro/alert-cancel.yaml`: opens an alert by testID and taps cancel; used for
  the delete-account confirmation so that nothing ever taps by the destructive words.
- `guestly-mobile/scripts/part9/routes.json`: four audit notes (C13, C34, S01, S02).

### The four P0s

1. D-001: the broadcast template preview shows another, REAL couple's wedding on demo-review
   (hard-coded template bodies in the portal). App side fix plus a portal fix by the lead.
2. D-002: on `/invite` the keyboard hides the six code boxes on the SE, on the iPhone 17e (390x844),
   and in both iPad windows. Only the Pro Max is clean.
3. D-003: primary actions behind the floating tab bar. The guest RSVP button cannot be reached on
   the SE or in the iPad mini window (the screen does not scroll); the door check-in name field is
   hidden on every device, which strands a user who denies the camera.
4. D-004 (data, not code): demo-review is not review-ready: site unpublished (six empty guest
   pages), fallback message in the demo thread, QA leftovers from other work. Agents may not publish.

### Decisions

- Reading method: S four or five per contact sheet at about 1x instead of one image at a time
  (plan C11), so that all findings fit one agent context; single images opened whenever a sheet
  raised a doubt. T read nine or ten per sheet because the iPad mini window IS the SE layout.
- A matrix cell is FAIL for any defect of any severity on that screen, so 382 of 612 cells fail.
  Most of them flip with ten kit fixes in `src/ui` (listed in section 8 of the audit).
- No AI question, no RSVP edit and no throwaway rows: the allowed writes of plan 8.4 were not used,
  because the tenant was busy with someone else's QA and nothing was worth the email risk. The cost:
  no success states and no after-question states were seen. Said in the audit.
- A3 ran on a SECOND Metro (port 8098) pointed at the proxy, so the direct Metro on 8097 never
  stopped. Both the proxy and the second Metro are stopped again; S was relaunched on the direct
  base and a real data screen was confirmed.
- Full-size PNGs were deleted at the end (2.1 GB to 168 MB); the 1400 px JPEG twins stay for the
  fix step's before and after comparison. The 523 MB of web rig PNGs were deleted after reading.

### Evidence

- Walks: A1 218 captures, A2 714 (S, L, T x EN, ES x couple 79, planner 20, guest 14, signed out 9),
  A3 61, A5 27, A6 9, A10 13, A11 21, plus 46 Maestro captures and 581 web rig screenshots with
  overflow numbers (8 overflows, all on the entrance). Proxy log: 54 forced 500 or 502 answers.
- Tap targets measured with `maestro hierarchy` on 28 screens. Contrast computed for 20 token pairs.
- Gates: `bash guestly-mobile/scripts/part9/gates.sh` exit 0: tsc 0 errors, eslint 0 errors and the
  same 9 baseline warnings, all grep gates empty (em dash, brand spelling, purchase wording, Face ID,
  real tenant names, tokens, demo passwords), copy parity 16 files 0 problems. expo-doctor: the same
  2 pre-existing failures as in step 1 (eas-cli in dependencies, 34 packages behind the SDK 57 patch
  set), untouched because the wave forbids dependency changes. The project has no unit test script.
- Production JS export: `npx expo export -p ios` and `-p android` both exit 0; output deleted.
- `~/.maestro/tests` is empty. No password was typed into any UI in this step (sessions by
  injection only). Simulator build budget unchanged: 1 of 3 used.

### Not done, and why

- Secondary states (wrong code, find results, password mode and sign-in error on a simulator,
  after-question states, filter applied, dry-run preview, success states), the biometric lock
  overlay, the bubble dragged, 17 of the 18 sheet and modal files: not captured. Listed in the audit.
- A4 on L in EN was not run; four Maestro flows missed their field (P05, C10, C30, E07).
- A3 covered 18 couple, 6 planner and 8 guest screens in `fail`, a sample in `slow` and `offline`.
- Not testable on this Mac: Sign in with Apple and Google, real push, QR with a real camera,
  biometric hardware, Android, a real iPad, VoiceOver by ear, cold-start deep links.

### For the lead

- demo-review was being used by someone else all evening (party count 40 to 54, a QA guest with a
  phone number, a second planner request, junk Coordinator sessions on the demo planner). Freeze it
  before App Review and before the store captures.
- State left: S booted (couple session, EN, dark, text size large), L, M, T, P shut down with the
  dev client installed. Metro runs on 8097 on the direct base. Disk: 15 GB free;
  `~/Library/Developer/CoreSimulator/Devices` holds 16 GB and shrinks at teardown.

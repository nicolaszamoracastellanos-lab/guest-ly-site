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

---

## Step 3, fix (Sep 19 to Sep 20 2026, finished 15:20 CDT after one interruption)

**Resume.** This step was cut off by a usage limit mid-work. On entry the tree had 13 fix commits
already made (`1f08fb7` through `4c34e4e`), an uncommitted rewrite of `docs/PART9-AUDIT.md` marking
all 43 defects fixed and verified, 40 untracked `docs/part9/evidence/D-###-fixed.jpg` files, and one
untracked Maestro flow (`.maestro/tap-id.yaml`). I reviewed the tree critically rather than trusting
it: read the code for a sample of P0 and P1 fixes against their defect text (D-002, D-003, D-004,
D-018, D-019, D-023, D-024, D-026, D-028, D-030), cross-checked every `Shot:` reference in the table
against the evidence folder, cross-checked the `tap-targets.mjs` JSON output (0 controls under 44 pt
across the `F`, `F2`, `R` and `F7` batches, matching D-024's claim), checked the token/tenant-name
grep gates against the new text, and confirmed no dependency, portal or API-contract file was
touched (`git diff --stat 540c15b..HEAD -- package.json package-lock.json` empty). One real gap
turned up: `D-015-fixed.jpg` was referenced but missing on disk. Recaptured it on the simulator
(release binary, S, ES, `/guest/dayof`) and it shows the fix holding (hero grows with the Spanish
sentence, the Abrir en Mapas button sits below it, not on top). Everything else in the prior work was
sound and is kept.

### What this step did

- Finished 43 of 43 defects from the register: every P0 and P1 fixed and verified with a re-capture
  that was opened and read (plan 9.2); P2 and P3 fixed except the three that need a portal change, a
  design decision by Nicolas, or a native module this wave forbids, each named as such in its own row
  (D-001 portal template bodies, D-004 demo tenant data, D-019 portal chrome, D-020 portal attention
  engine strings, D-021 native date picker, D-036 source photography, D-043 P18 list-vs-tiles design
  call). Full detail, evidence paths and commits: `guestly-mobile/docs/PART9-AUDIT.md` sections 2 and
  4. Kit-level fixes landed first (`src/ui/index.tsx`, `Screen`, `Sheet`, `Button`, `TabBar`,
  `TopBar`, `QueryError`, touch sizes, `chrome.ts` for the content-width helper), then shared flows,
  then per-surface defects in register order, then native config, matching plan 9.1.
- `useSafeBack` replaces all 89 bare `router.back()` call sites (`src/lib/nav.ts`), verified on the
  RELEASE build with cold deep links per folder (D-022).
- Native config truth: bilingual purpose strings (`locales/en.json`, `locales/es.json`), no
  `NSLocationWhenInUseUsageDescription` key (checked with `strings` over the downloaded `.app` and
  every framework inside it before removing it, then re-checked with `plutil` against the built app
  twice, once per release build in this step), `recordAudioAndroid: false` plus a truthful microphone
  string instead of the injected English default, privacy manifest additions. Language ladder
  (device beats wedding default) and the Dynamic Type policy are both recorded in `BUILD-LOG.md`
  decisions 14 to 17, alongside the phone-only iPad decision (D4).
- Fixed the one real gap found on resume: `docs/part9/evidence/D-015-fixed.jpg` (see Resume above).
- Two `sim-release` cloud builds this step (the 2nd and 3rd of the wave's three-build budget): one
  before I took over (`d315ac19`, commit `5062307`), one by me after the last fix commit
  (`8eae524e`, commit `4c34e4e`, the true end of this step). Full detail:
  `guestly-mobile/docs/PART9-AUDIT.md` section 9. The first build's `R1` regression walk (full A2 on
  S-ES and L-EN, ten spot screens on T-EN) found two more defects that only showed up on a release
  binary; I independently re-verified their fixes and the release-only claims (D-003 camera-denied
  door check-in, D-010/D-021/D-036 on guest home, D-028 purpose strings, D-031 Dynamic Type, D-024 tap
  targets) against the SECOND, final build myself rather than trust the first pass, and saved one new
  shot the prior work had not captured (`D-003-fixed-denied.jpg`, the camera-denied state, reached by
  revoking the camera permission and dismissing the resulting system prompt with a `tap-point.yaml`
  Maestro tap since a fresh mount re-prompts after a reset).
- `.maestro/tap-id.yaml` (kept from the prior work, used for the D-022 cold-deep-link back check) and
  `.maestro/tap-point.yaml` (already committed) both proven again in this step.

### Gates

`bash guestly-mobile/scripts/part9/gates.sh`, run fresh by me after the last edit (not trusted from
an old log): exit 0. `npx tsc --noEmit` 0 errors. `npx eslint src` 0 errors, 3 warnings (all
pre-existing: two `react-hooks/exhaustive-deps` and one unused `err`, none new, fewer than the
9-warning baseline the plan allows). All six grep gates (em dash, brand middle dot, purchase wording,
Face ID wording, real tenant names, tokens on disk) print nothing. Feature copy parity: 16 files, 0
problems. `expo-doctor`: the same 2 pre-existing failures as every earlier step (`eas-cli` in project
dependencies, 34 packages behind the SDK 57 patch set), left alone because the plan forbids dependency
or SDK changes this wave. The two character scans also ran clean against
`/Users/nicolas_z/Desktop/guest-ly/docs/wave-sep18/`.

### Evidence

- 43 of 43 defects have a `Shot:` reference in the register and every one of those 75 referenced
  files exists in `docs/part9/evidence/` (checked by extracting every `docs/part9/evidence/*.jpg`
  path from the doc and testing each for existence).
- Spot-checked in the actual source, not just the doc's claim: D-002 (`invite.tsx`, the photo card
  hides itself under 900 pt of window height so the six boxes and title clear the keyboard), D-003
  (`Screen` bottom inset accounts for the tab bar height plus the safe area), D-004
  (`guest/more.tsx` hides links to unpublished site pages), D-018 (AI disclosure sentence in both
  `en.ts` and `es.ts`), D-019 (`bridge.ts` allow-lists two signed-in paths and refuses `//host` and
  `\` and `://` inside a path), D-023 (`QueryError` shared component, wired into `Screen`), D-024
  (tap target JSON output, see Resume), D-026 (bilingual error mapping by status code and message
  text in `sign-in.tsx`), D-028 (purpose strings and the missing location key, confirmed twice against
  the built binary), D-030 (session gate change), D-015 (fresh capture, see Resume).
- Tap targets: batches `F` and `F2` (2026-09-19 08:33 to 08:41 CDT, after the kit fixes) and `R` and
  `F7` (2026-09-20 06:25 to 06:53 CDT, after the very last commit) all read 0 controls under 44 pt;
  the JSON files are the source of truth, not just the doc's summary sentence.
- Dynamic Type re-checked by me independently on the FINAL release build (S, ES,
  `accessibility-extra-extra-extra-large`, `/couple/budget`): tab bar labels capped, stat card numbers
  stay on one line. Not repeated as a full 27-screen walk a second time; the first full pass, on fixed
  source, is what D-031's register row documents.
- Web rig regression: `.part9/web-shots-fix/index.json`, 521 screenshots, 0 with horizontal overflow
  (checked by loading the JSON and counting, not by re-reading the summary line).
- No dependency, portal or API contract file touched: `git diff --stat 540c15b..HEAD -- package.json
  package-lock.json` and a search of the whole diff for portal paths are both empty.
- Commits this step (oldest to newest): `1f08fb7 8c20109 9b3d5c2 9bf93f4 eccc9af cca01c3 de31558
  692473c d9df901 f226034 5062307 3a04e1a 4c34e4e` (prior work, kept) plus this step's own commit(s)
  for the audit doc, the D-015 and D-003-fixed-denied shots, and this log entry.

### Not done, and why

- The full 27-screen Dynamic Type walk and the full six-width web rig were each run once against
  fixed source, not repeated against the second release build, because that build only adds two
  commits that touch neither typography nor the web export (see section 9 of the audit doc).
- L, M, T and P were not reinstalled with the second, final `sim-release` build; only S was. L and T
  still hold the first `sim-release` build. The store step should reinstall the final build
  (`8eae524e...`) on whichever device it captures from (plan 10.1 wants the Pro Max).
- Not testable on this Mac, unchanged from the earlier steps: Sign in with Apple and Google end to
  end, real push delivery, QR scanning with a real camera, biometric hardware and the lock overlay
  (S08), Android on any device, a real iPad, VoiceOver by ear.
- Version and build bump (plan 10.3), App Store screenshots, `metadata.json` review notes and
  `ANDROID-READINESS.md` (plan 10) belong to the store step; not started here.

### For the lead or Nicolas

- D-001: per-tenant broadcast template bodies in the portal (the app now hides a template body that
  does not belong to the current wedding, but demo-review still needs its own templates for a true
  fix).
- D-004: demo-review is not review-ready (unpublished site, fallback message in the demo thread, QA
  leftovers, a second planner request, a guest with a phone number). Publish, clean up, then freeze
  the tenant before App Review and before store captures.
- D-019: the portal should drop its own chrome and the maintenance banner when a page is opened
  inside the app's web view (the app now allow-lists which pages it will open at all, which closes
  the guideline 3.1.1 risk, but the embedded page still looks like the full portal).
- D-020: three home-screen rows are written in the `tu` form; they come from the portal attention
  engine, not the app.
- D-036: source photography is soft at 3x on the largest phones; a design call for Nicolas, not a
  code fix (plan 13.7).
- Simulator build budget: all 3 of 3 allowed builds used (`d267d22f` sim-dev, `d315ac19` and
  `8eae524e` sim-release). A fourth build needs the lead's yes (plan C9).
- Disk: about 24 GB free at the end of this step. `.part9/` (gitignored) still holds about 2.4 GB of
  walk logs, contact sheets and both downloaded `sim-release` app bundles; the store step will want
  the app bundle, so I left `.part9` in place rather than delete it, but it should be cleared at
  final teardown (plan 10.5).

---

## Step 4, store (Sep 20 2026)

**Resume note:** `git status` and `git diff` at the start of this step showed nothing uncommitted
for this step; the tree only had pre-existing untracked screenshot folders from other, unrelated
workstreams sharing this same repo checkout (`wave-sep18-screenshots/` and similar, all under the
`guest-ly` root, not `guestly-mobile/`), which I left untouched. The fix step's own commits were
already complete and clean, so this step started fresh rather than finishing someone else's partial
work.

### What exists now

- Reinstalled `sim-release` build `8eae524e-b557-45d5-bbfb-11d6db60febc` (the fix step's second,
  final build, commit `4c34e4e`) on L (iPhone 17 Pro Max, 1320x2868), which the fix step had left on
  the first `sim-release` build. No new EAS build: the wave's 3-build budget (plan C9) stays spent at
  3 of 3.
- **App Store screenshots**, demo-review only, `store/screenshots/ios-6.9/{en-US,es-MX}/`:
  - `raw/`: 8 screens x 2 languages, 1320x2868, JPEG 92, no alpha (checked with `sips` on all 16
    files; largest is 602 KB).
  - `framed/`: same 16, composited over a night/gold background with a Cormorant Garamond caption
    and a Jost sub-line (fonts loaded from `node_modules/@expo-google-fonts`, matching the app's own
    type), the capture at a 44 px corner radius with a hairline border, no device frame artwork, no
    AI-generated typography. Built with a small Playwright script
    (`.part9/frame-build/frame.html` + `render.mjs`, gitignored, not committed) borrowing
    `guestly-portal/node_modules/playwright-core` read-only (a temp runner file was written there to
    resolve the import, then deleted immediately after use; `git status` in `guestly-portal` was
    checked before and after and shows no trace of it).
  - `store/icon-512.png` (`sips -Z 512` from `assets/brand/icon.png`) and
    `store/feature-graphic.png` (1024x500, same compositor) are both built.
  - **Not built** (plan C15, explicitly the lowest priority, dropped first when time is short): the
    Play phone screenshot set at 1080x1920. The iOS raw captures are too tall and narrow for it
    (ratio 2.17, Play caps at 2:1), so it needs its own capture pass, not a resize; recorded as open
    in `docs/ANDROID-READINESS.md` section 5.
  - Screenshot 04 (guest concierge) deliberately shows the AI's greeting state, not an answered
    question. Why, below.
- **`store/metadata.json`**: added `review_notes_es`, `whats_new` (EN/ES), `copyright`,
  `primary_locale`, `promotional_text` (EN/ES), `age_rating_answers`, `export_compliance`,
  `sign_in_required: true`, and a `credentials_location` field that names the gitignored env file and
  its two key names instead of ever holding a value. `app_privacy` now lists Photos or Videos
  (couples and planners: website images, the floor plan, budget receipts) and drops the old
  "Location" line from `not_collected` now that the purpose string itself is gone (D-028, fix step).
  `review_notes_en`/`review_notes_es` now also cover: what the AI concierge and the couple/planner
  assistant are and how they disclose themselves, what the camera is used for, that notifications are
  optional, the account-deletion path, that the app runs on iPad only in the iPhone compatibility
  window, and that Sign in with Apple is offered. No `store.config.json` (plan C15); nothing here
  calls `eas metadata:push` or `eas metadata:pull`.
- **`docs/ANDROID-READINESS.md`**: new. What is done, what only Nicolas can do in order with time
  estimates, code follow-ups before an Android release, and the honest gap (no Android emulator or
  SDK on this Mac, so no screen of this app has ever run on Android in this wave). Folded together
  with the existing `docs/PLAY-CONSOLE-SETUP.md` so the two do not disagree (updated its screenshot
  path, its Data safety collected-data list to include Photos or Videos, and its credentials
  reference to point at the same `credentials/demo-accounts.env` keys).
- **Version and build**: confirmed read-only with `eas build:version:get` (`appVersionSource:
  remote`): iOS `buildNumber` **7**, Android `versionCode` **4**. Marketing `version` stays `1.0.0`
  (plan D5). Nothing to bump in this repo: `eas.json`'s `production.autoIncrement: true` plus the
  remote source means the lead's next `eas build -p ios --profile production` becomes build 8 and the
  next Android production build becomes versionCode 5, automatically. Added a comment next to
  `app.config.ts`'s `android.versionCode` saying the remote source owns the real number. The lead's
  next commands are written into `docs/CREDENTIALS-CHECKLIST.md`, not run by me.

### Two defects found while building the screenshots, and why one code fix shipped without a new release build

Building screenshot 04 (guest concierge, "with the parking question answered," plan 10.1) surfaced
the first real AI reply this whole wave has captured on a live build; every earlier step avoided
asking the concierge a real question on purpose (plan C2, to dodge an escalation email). Two things
broke:

- **D-044 (P1, fixed in source).** The API client's 20 s default timeout
  (`src/lib/api.ts`) is too short for a real AI reply: asking Hotels nearby through the quick-reply
  chip reliably showed "You seem to be offline. We will retry when the connection is back." on a
  fully working connection (every other screen's reads on the same session succeeded). Fixed by
  giving the concierge call its own 120 s timeout, matching the couple/planner assistant's own
  precedent for exactly this reason (`src/features/assistant/stream.ts`, already 120 s).
- **D-046 (P2, fixed in source).** Capturing the ES couple-home screenshot showed the "today's
  briefing" bullet sitting on the wrong line once the (longer) Spanish sentence wrapped to three
  lines, because `Row`'s default `alignItems` is `center`. The planner home has the identical row and
  the identical bug. Fixed both with `align="flex-start"` plus a small `paddingTop` wrapper around the
  dot, the same pattern `couple/insights/index.tsx` already used for the same reason.
- **D-045 (P2, left open).** The AI reply renders as plain text, so markdown in the model's answer
  shows as literal characters (`**Formal**`, asterisks and all). Real and reproducible, but it is a
  design decision (which markdown subset to support) touching at least two screens (concierge and the
  couple/planner assistant), not a one-line fix; left for the lead.

Both fixes are real, small, and precedented, but neither could be verified against a NEW
`sim-release` binary: the wave's 3-build budget was already spent by the fix step, and plan C9 says a
4th build needs the lead's explicit yes, which nobody could give inside this step. Instead:

- Verified on the **dev client** (`sim-dev`, already installed on M from the harness step; Metro
  served the current commit's JS with `--no-dev --minify`, the same production-like flags the harness
  doc uses, against the LIVE api): the same Hotels nearby question that failed at 20 s on the
  sim-release binary returned a real, correct, web-grounded answer at about 22 s (evidence:
  `docs/part9/evidence/D-044-fixed.jpg`); the ES briefing row on both couple and planner home now
  keeps its dot on the first line at both two and three wrapped lines (evidence:
  `docs/part9/evidence/D-046-fixed.jpg`).
- The **official App Store screenshots still come from the unfixed `sim-release` binary**: the ES
  couple-home and ES planner-requests-home raw captures show the pre-fix, slightly low dot (D-046
  visible but very small), and screenshot 04 uses the concierge's clean empty/greeting state rather
  than risk shipping either the D-044 false-offline message or the D-045 literal asterisks in a
  public store image. Both fixes reach the app for real the next time the lead cuts a production
  build.
- Metro (port 8097) was stopped immediately after use; the dev-client sessions on M were left signed
  in (couple, then planner, both ES) rather than reset, since M is not part of the store step's
  screenshot source and gets erased at teardown below regardless.

Full detail, evidence paths and the exact grant sequence: `guestly-mobile/docs/PART9-AUDIT.md`
section 4 (defect register rows D-044 to D-046) and section 10 (store step).

### Gates

`bash guestly-mobile/scripts/part9/gates.sh --fast`: exit 0, `GATES: all clean`. `npx tsc --noEmit` 0
errors. `npx eslint src` 0 errors, 3 warnings (same baseline the fix step left, none new). All six
grep gates (em dash, brand middle dot, purchase wording, Face ID wording, real tenant names, tokens
and demo passwords on disk) print nothing, now also scanning the new `store/` content. Feature copy
parity: 16 files, 0 problems. `expo-doctor` not re-run this step (network-dependent, `--fast` skips
it; the fix step's build log already records its 2 pre-existing failures, unrelated to anything
touched here). `npx expo config --type public` still shows every purpose string and 6 privacy data
types. Ran `npx expo export -p ios` as this step's production-build check (an EAS production build is
explicitly the lead's step, not mine): the JS bundle exports cleanly at 5.8 MB, no errors; deleted
the output afterward. No test script exists in `package.json` (`start`, `reset-project`, `android`,
`ios`, `web`, `lint` only), so none ran; that is unchanged from every earlier step of this wave.

### Not done, and why

- The Play phone screenshot set (1080x1920) was not built (plan C15 explicitly allows dropping it
  first). `docs/ANDROID-READINESS.md` section 5 records it as open.
- D-045 (AI reply markdown) was found but not fixed; it is a design decision across at least two
  screens, not a store-step-sized change.
- The full 27-screen Dynamic Type walk and the full six-width web rig were not re-run against the
  reinstalled `sim-release` binary; nothing in this step touches typography or the web export, and
  both already ran once against the same fixed source in the fix step.
- L, M, T, P were only partly refreshed: L now runs the final `sim-release` build (this step); M ran
  the dev client for the D-044/D-046 verification; T and P were not touched and still hold whatever
  the fix step left them at.
- The demo tenant end state (plan 10.5) was only observed in passing during captures (invite code,
  RSVP answer, one open request, the 43-attending count), not re-asserted with a scripted API read;
  see `docs/PART9-AUDIT.md` section 10 for exactly what was and was not checked.
- Not testable on this Mac, unchanged from every earlier step: Sign in with Apple and Google end to
  end, real push delivery, QR scanning with a real camera, biometric hardware and the S08 lock
  overlay, Android on any device, a real iPad, VoiceOver by ear.
- `eas submit`, any production EAS build, `eas update`, `eas metadata:push` or `eas metadata:pull`:
  none run, as required. The lead's next commands are written into
  `guestly-mobile/docs/CREDENTIALS-CHECKLIST.md`, not run here.

### Teardown and final disk

`sim.sh teardown` run at the very end of this step (after the commit below): shut down and erased S,
M, L, T, P, deleted the wave's created SE simulator, stopped Metro/proxy/static-server ports, removed
`.part9/web`, `.part9/sim-dev`, `.part9/sim-release` and any `.tar.gz`. Free disk before and after are
both recorded in the final report, not just one of them.

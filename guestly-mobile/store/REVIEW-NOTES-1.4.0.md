# Guest-ly 1.4.0: App Review notes and App Privacy label

Written Nov 5 2026 (Master Wave, Lane 8 step 5), rewritten Nov 7 2026 after Nicolas's answer c-mic
(Nov 6): the Coordinator mic is not in this wave, so 1.4.0 has no mic button, no recording code and
no Audio Data. Nothing here is submitted. The text to paste is `review_notes_en` in
store/metadata.json; it is repeated below so the 1.4.0 cut (step 6) and Nicolas can read it in one
place. Re-read it against the build before pressing submit.

## What changed for review in 1.4.0

1. Guideline 5.1.2(i), AI data sharing. Before the first use the app shows a permission sheet that
   names the company, what is sent and why, with "Allow and continue" and "Not now":
   - Coordinator and planner assistant (#5): Anthropic (Claude API); the person's messages and the
     wedding details the chat reads.
   - Meeting brief recap (#32): Anthropic; the brief's figures. The brief screen ships later by OTA
     on the 1.4.0 runtime; the permission is asked before "Write the recap", its only model call.
   Answers are kept per signed-in person and deleted on sign-out. "Not now" sends nothing.
2. Preview the day. Wedding-day screens only run on the wedding day. On demo weddings only, Tools >
   Day-of offers "Preview the day": pick a moment and the screen runs as it would then, with a banner.
   Nothing done in the preview is saved or sent. Shown when the tenant is a demo
   (`tenant.is_demo` in /auth/me when the portal sends it, else the slugs demo-valentina-and-mateo
   and demo-review), never on a client wedding.
3. The microphone purpose string is the 1.3.0 text, unchanged (app.config.ts, locales/en.json,
   locales/es.json). It stays because the camera library links the audio capture API (an upload
   without it can be refused, ITMS-90683); the app never asks for the microphone:

   > Guest-ly does not record audio. iOS shows this text only if a video with sound is ever captured, which the app does not do.

## App Store Connect, App Privacy (to change by hand at submission)

Add one data type:
- Product Interaction (Usage Data): collected, linked to the user, App Functionality, not used for
  tracking. Who: guests. Each app open is stored against the guest and shown to the couple as Seen
  (K21, #37). The portal already records opens from 1.3.0 (GET /guest/home), so the label on the
  store is out of date today: this entry goes in with the next submission.

Update the wording you keep for:
- Other User Content: also couple and planner messages to the Coordinator (already collected, App
  Functionality; the change is only that the permission sheet now names Anthropic in the app).

Unchanged: Name, Email Address, Phone Number, Device ID, Photos or Videos; no tracking; no ads.
No Audio Data: the app records nothing. The privacy manifest (app.config.ts ios.privacyManifests)
now lists NSPrivacyCollectedDataTypeProductInteraction (linked, not tracking, App Functionality).
This is native config: it is in the 1.4.0 fingerprint.

## What's new in 1.4.0 (store/metadata.json whats_new, the launch kit draft Nicolas approved, a-notes)

EN: Your wedding day, live: see what is happening now and what comes next. Works even with no signal at the venue. Locked timeline with change requests, places with directions, hair and makeup schedule, final guest count, your road to the wedding, and clearer messages when something goes wrong.

ES: Tu boda en vivo: mira lo que está pasando ahora y lo que viene después. Funciona incluso sin señal en el lugar. Cronograma cerrado con solicitudes de cambio, lugares con cómo llegar, horario de peinado y maquillaje, conteo final de invitados, tu camino a la boda y mensajes más claros cuando algo sale mal.

## Open before submit

- Confirm the App Review wedding's slug. The notes say "Camila & Andrés"; the app treats
  demo-review as a demo slug. If the review tenant has another slug, add it to
  PREVIEW_DEMO_SLUGS (src/features/dayof/previewClock.ts) or have /auth/me send tenant.is_demo.
- Feature flags. Every 1.4 screen the notes and What's new name shows only when the portal sends it,
  and each sits behind its own flag. demo-review is a live, non-demo tenant, so a global release gives
  it an off row like any client wedding: turn each flag on for the review wedding in /ops/flags
  before submitting, and keep them on in production when 1.4.0 goes live. If one cannot be on, take
  its words out of What's new and review_notes_en first.
  - MW_LIVE_DAY: Now and Next, Mark done, Preview the day (needs the server's live payload).
  - MW_DAY_PACK: the day saved on the phone, "works even with no signal at the venue".
  - MW_PLAN_CARD: Coordinator plans ("Run N actions").
  - MW_RUNSHEET_LOCK: locked timeline and change requests.
  - MW_PLACES: places with directions (Apple Maps and Google Maps links).
  - MW_HMU: hair and makeup schedule.
  - MW_FINAL_COUNT: final guest count.
  - MW_KNOW_BEFORE: the know-before-you-go card.
  - MW_SEEN: "Seen" status.
  - MW_ROAD: the road-to-the-wedding card.
  Leave MW_REVIEW_ASK as it is: the #20 review card is not built in this binary.
- MW_TRAVEL_WINDOWS stays off, for the review wedding and in production. It is blocked in the
  portal flag registry (F144 releaseBlocker): the app guest login still hands out guest ids, so a
  name and an invite code would show that guest's flight and times. /ops refuses to release it,
  and a per-wedding on does nothing without the release. Never release it with SQL
  (mw_flag_release does not read the blocker). So the notes and What's new say nothing about
  guest travel. The words and this flag go back on the list above only in the commit that removes
  the F144 blocker (review-notes.test reads the registry and fails on a blocked flag's words).
- expo-audio and expo-store-review are installed but nothing imports them (the #20 review card and
  its rating prompt are not built, so the notes do not mention a rating prompt). Removing either
  package changes the native module set: decide both before the Nov 15 cut and re-run
  check-prebuilt-symbols after npm ci. If the #20 card ships in this binary, put a RATINGS line back
  in review_notes_en (review-notes.test allows it only once a src file imports expo-store-review).
- Check the current text of guideline 5.1.2(i) the day of submission.

## review_notes_en (paste as is)

Guest-ly is the free companion app to a wedding service couples set up at guest-ly.com. Couples can also create their account in the app; planner accounts are created by their agency. The app has no In-App Purchase, subscription or price.

DEMO WEDDING (all data fictional): Camila & Andrés, 21 March 2027.
GUEST: tap "Open my invitation", enter code CAMAND, type Whit and pick Whitney Adler, then allow notifications or tap Not now. You can RSVP, read the schedule, ask the Concierge (try the Dress code chip) and open the day-of screen.
COUPLE: on the entrance tap "I'm the couple or the planner" and sign in with review@guest-ly.com (password in the Sign-in information fields). Tabs: Home, Guests, Guest Messages (Conversations / Broadcasts switch), Coordinator and Tools (wedding site, budget, tasks, seating, door check-in). Settings is the gear on Home and the last row of Tools. Sign in with Apple and Google are offered next to the emailed link.

AI: the guest Concierge and the couple/planner Coordinator are AI features, labelled as AI. Questions the AI cannot answer go to the couple; nothing is guessed. Before a couple or planner first sends anything to the Coordinator, a permission screen names Anthropic (Claude API), says what is sent (their messages and the wedding details the chat reads to answer) and why, with "Allow and continue" and "Not now"; "Not now" sends nothing (guideline 5.1.2(i)). Services: Anthropic (Claude API) for the AI, Supabase for database and sign-in, Resend for email, Netlify for the backend, Expo push for optional notifications, and a backend we operate for opt-in WhatsApp messages (WhatsApp Business API). No payment processor is integrated.
CAMERA: only to scan a guest's QR pass at door check-in and, for couples and planners, to photograph a floor plan or a receipt. No audio or video is recorded. NOTIFICATIONS are optional.
ACCOUNT DELETION: Settings > Delete account deletes the account immediately. The shared demo logins are protected so every reviewer can use them; to test deletion, create an account with "Getting married? Create your account".
PLANS are sold only on the web. On the United States storefront only, the locked home of a new account shows "Choose your plan", which opens guest-ly.com in Safari (guideline 3.1.1(a)). On every other storefront the app shows no price, purchase wording or link.

NEW IN 1.2
LAYOUT: Home, Guests, Guest Messages, Coordinator, Tools. Broadcasts (WhatsApp announcements from approved templates) live in Guest Messages; the demo wedding is a simulation, nothing is delivered to any phone. "Request a template" goes to Guest-ly staff and sends nothing to guests.
COORDINATOR TAB: AI chat for the couple. On a wedding without it, the tab shows examples and an email button, never a price.
EMAILED SIGN-IN: a link that opens the app plus an 8-digit code usable on any device.
WIDGETS AND LIVE ACTIVITIES (countdown, replies, today, weddings, day-of; wedding-day schedule, door check-in): they show data the app already holds, make no network requests and need no extra permission. Live Activities update only while the app is open; no push token is collected.
WIDE SCREENS (iPhone Duo inner display, outer display sideways, split window): lists and records sit side by side. Other iPhones are unchanged.
DOOR CHECK-IN: couples, and planners granted the Check-in tool, can check guests in. On an iPhone Duo an optional welcome ("Welcome, <name>. Table <n>") can face the guest on the outer display; it has an off switch on the same screen.
PLANNER TOOLS: Today, Weddings, Check-in and Messages (read-only). Check-in and Messages work only when the agency grants them for a wedding, so they are locked by default. Planners never receive a guest's phone or email through them. A planner demo login is available on request through the contact details above.
INVITATION: on an iPhone Duo the guest's invitation opens like an envelope as the phone opens; a tap, or Reduce Motion, opens it without animation.
IPAD: iPhone-only app; it runs in the iPhone compatibility window on iPad.

NEW IN 1.4
WEDDING-DAY SCREENS: on the wedding day, Tools > Day-of shows Now and Next with the minutes left and Mark done, and the day's runsheet, guest list and door search are saved on the phone so they work without signal. A normal day shows the day's plan only. To see the wedding-day screens on any day, the demo wedding's Day-of screen has "Preview the day": pick a moment of the day and the screen runs as it would at that time, with a banner saying it is a preview. Nothing done in the preview is saved. This control exists only on demo weddings.
COORDINATOR PLANS: one message can produce one card with several changes (for example add a task, a vendor and a budget line), shown as a checklist. Nothing changes until the person taps "Run N actions"; any line can be unticked first; a line the plan added can be undone for 30 minutes. Sends to guests are never part of a plan and keep their own typed confirmation.
Other 1.4 additions are wedding planning screens that show data the couple or planner already entered on the web (timeline lock and change requests, places with Apple Maps and Google Maps links that open those apps, final guest count, a know-before-you-go card, "Seen" status, a road-to-the-wedding card). None of them needs a new permission.

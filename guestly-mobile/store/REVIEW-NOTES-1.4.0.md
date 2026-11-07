# Guest-ly 1.4.0: App Review notes and App Privacy label

Written Nov 5 2026 (Master Wave, Lane 8 step 5). Nothing here is submitted. The text to paste is
`review_notes_en` in store/metadata.json; it is repeated below so the 1.4.0 cut (step 6) and
Nicolas can read it in one place. Re-read it against the build before pressing submit.

## What changed for review in 1.4.0

1. Microphone (D5). expo-audio is in the binary. The mic button sits in the Coordinator's message
   box and shows only on weddings where voice notes are switched on (MW_MIC) and the speech service
   answers. Purpose string (app.config.ts, locales/en.json, locales/es.json):

   > Guest-ly uses the microphone only when you tap the mic button in the Coordinator, to turn what you say into text. It never records at any other time.

   No background audio: the expo-audio plugin has background recording and playback off, so there is
   no UIBackgroundModes audio entry.
2. Guideline 5.1.2(i), AI data sharing. Before the first use the app shows a permission sheet that
   names the company, what is sent and why, with "Allow and continue" and "Not now":
   - Coordinator and planner assistant (#5): Anthropic (Claude API); the person's messages and the
     wedding details the chat reads.
   - Mic (D5): AssemblyAI; the recording, deleted on both sides once the text is ready. The mic asks
     for the Coordinator permission too, because the text then goes to the chat.
   - Meeting brief recap (#32): Anthropic; the brief's figures. The brief screen ships later by OTA
     on the 1.4.0 runtime; the permission is asked before "Write the recap", its only model call.
   Answers are kept per signed-in person and deleted on sign-out. "Not now" sends nothing.
3. Preview the day. Wedding-day screens only run on the wedding day. On demo weddings only, Tools >
   Day-of offers "Preview the day": pick a moment and the screen runs as it would then, with a banner.
   Nothing done in the preview is saved or sent. Shown when the tenant is a demo
   (`tenant.is_demo` in /auth/me when the portal sends it, else the slugs demo-valentina-and-mateo
   and demo-review), never on a client wedding.
4. In-app rating prompt (#20): Apple's own SKStoreReviewController through expo-store-review.

## App Store Connect, App Privacy (to change by hand at submission)

Add two data types:
- Audio Data: collected, linked to the user, App Functionality, not used for tracking.
  Who: couples and planners recording a Coordinator voice note.
- Product Interaction (Usage Data): collected, linked to the user, App Functionality, not used for
  tracking. Who: guests. Each app open is stored against the guest and shown to the couple as Seen
  (K21, #37). The portal already records opens from 1.3.0 (GET /guest/home), so the label on the
  store is out of date today: this entry goes in with the next submission.

Update the wording you keep for:
- Other User Content: also couple and planner messages to the Coordinator (already collected, App
  Functionality; the change is only that the permission sheet now names Anthropic in the app).

Unchanged: Name, Email Address, Phone Number, Device ID, Photos or Videos; no tracking; no ads.
The privacy manifest (app.config.ts ios.privacyManifests) now lists NSPrivacyCollectedDataTypeAudioData
and NSPrivacyCollectedDataTypeProductInteraction (both linked, not tracking, App Functionality). This is native config: it is in the 1.4.0 fingerprint.

Play Data safety (when Android ships): Audio, Voice or sound recordings, collected, App functionality.

## Open before submit

- Confirm the App Review wedding's slug. The notes say "Camila & Andrés"; the app treats
  demo-review as a demo slug. If the review tenant has another slug, add it to
  PREVIEW_DEMO_SLUGS (src/features/dayof/previewClock.ts) or have /auth/me send tenant.is_demo.
- MW_LIVE_DAY (and MW_DAY_PACK if wanted) must be on for the review wedding, or "Preview the day" has
  nothing to show (it needs the server's live payload).
- If the mic stays dark at submission (no AssemblyAI key), the notes already say the mic may not
  appear; keep that sentence. If Nicolas says no to the mic (D5), rewrite the purpose string back to
  "does not record" and drop the MICROPHONE paragraph and Audio Data before the cut.
- Check the current text of guideline 5.1.2(i) the day of submission.

## review_notes_en (paste as is)

Guest-ly is the free companion app to a wedding service couples set up at guest-ly.com. Couples can also create their account in the app; planner accounts are created by their agency. The app has no In-App Purchase, subscription or price.

DEMO WEDDING (all data fictional): Camila & Andrés, 21 March 2027.
GUEST: tap "Open my invitation", enter code CAMAND, type Whit and pick Whitney Adler, then allow notifications or tap Not now. You can RSVP, read the schedule, ask the Concierge (try the Dress code chip) and open the day-of screen.
COUPLE: on the entrance tap "I'm the couple or the planner" and sign in with review@guest-ly.com (password in the Sign-in information fields). Tabs: Home, Guests, Guest Messages (Conversations / Broadcasts switch), Coordinator and Tools (wedding site, budget, tasks, seating, door check-in). Settings is the gear on Home and the last row of Tools. Sign in with Apple and Google are offered next to the emailed link.

AI: the guest Concierge and the couple/planner Coordinator are AI features, labelled as AI. Questions the AI cannot answer go to the couple; nothing is guessed. Before a couple or planner first sends anything to the Coordinator, a permission screen names Anthropic (Claude API), says what is sent (their messages and the wedding details the chat reads to answer) and why, with "Allow and continue" and "Not now"; "Not now" sends nothing (guideline 5.1.2(i)). Services: Anthropic (Claude API) for the AI, AssemblyAI for speech to text (Coordinator voice notes only), Supabase for database and sign-in, Resend for email, Netlify for the backend, Expo push for optional notifications, and a backend we operate for opt-in WhatsApp messages (WhatsApp Business API). No payment processor is integrated.
MICROPHONE: only when a couple or planner taps the mic button in the Coordinator chat. A permission screen names AssemblyAI before the first recording. The recording goes to our backend and to AssemblyAI to become text; both copies are deleted as soon as the text is ready, and the text lands in the message box for the person to read, edit and send. Nothing records at any other time and there is no background audio. Voice notes are switched on per wedding: if the mic is not on the demo wedding's Coordinator, it is not switched on there yet, and nothing else in the app uses the microphone.
CAMERA: only to scan a guest's QR pass at door check-in and, for couples and planners, to photograph a floor plan or a receipt. No video is recorded. NOTIFICATIONS are optional.
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
RATINGS: after a wedding the app may show Apple's own rating prompt (SKStoreReviewController), at most as often as iOS allows.
Other 1.4 additions are wedding planning screens that show data the couple or planner already entered on the web (timeline lock and change requests, places with Apple Maps and Google Maps links that open those apps, final guest count, guest travel times, a know-before-you-go card, "Seen" status, a road-to-the-wedding card). None of them needs a new permission.

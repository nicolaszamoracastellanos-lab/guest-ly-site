# Part 9 audit, raw reading notes (working file)

Written batch by batch while reading screenshots (plan C11), so that nothing lives only in an
agent's context. The clean result is `docs/PART9-AUDIT.md`. Shot paths are under the gitignored
`.part9/shots/`.

## Batch 1: A1, S (375x667), ES, couple, BEFORE the seed (walk of 14:38 CDT, 71 shots, read as 18 four-up sheets at 1x)

- C01 home: third stat card shows a lone dot as its value and "del presupuest" cut (no budget yet). Concierge status pill wraps to two lines. Hero photo starts 54 pt below the top, leaving a dark band above it on the SE (no notch).
- C02 guests: about 100 pt of empty space between status bar and wordmark on the SE (tab screens C02, C06, C09 start at y 177; C11, C12 start at y 127: inconsistent). Assistant bubble covers the ASISTIRAN badge of row 1; FAB covers the badge of row 3 (H22).
- C03 guest detail: "[object Object]: attending . [object Object]: attending". Raw object AND raw English enum inside the ES screen. P1.
- C04 add guest: fields have placeholders only; the party size field shows a bare "1" with no label. Keyboard opens by itself and covers the phone field (check in A4).
- C05 import: multi-line input drawn with the full pill radius, looks like a blob (systemic, every multi-line Input: C05, C20, C39-*, C40, C47-*).
- C06 RSVPs: stat label "PENDIENTES" breaks mid word ("PENDIENT / ES"). Floating buttons "Registrar una..." and "Recordar a 16..." are both truncated with an ellipsis (H4) and float over list rows with no backdrop (row text shows between them). "3 of 3 . 7 sept . por usted": English "of" in ES.
- C08 questions empty: good.
- C09 messages empty: good apart from the top gap.
- C10 thread: composer ("Escriba su respuesta" + Responder) sits UNDER the floating tab bar, half covered. P1. Bubble covers message text. Demo content: the first concierge message is the technical-problem fallback without accents ("Perdon, tuve un problema tecnico"); bad for App Review.
- C11 More: tile sublabels truncated ("Pregunte lo...", "El dia, minut..."). "Mesas / 1 planos" plural error. Bubble covers the "Guion del dia" tile title.
- C12 day-of: copy says "Todavia no hay cronograma. Creelo en app.guest-ly.com/runsheet" although the app has its own run sheet builder; bubble covers the sentence.
- C13 check-in: helper text and the name field are under the tab bar (letters visible left and right of the bar). Bubble covers the scanner frame corner.
- C14 requests empty: back button with no parent label (other pushed screens show one).
- C16 tasks empty: tiles "Lista de la..." and "Recordat..." truncated. The gold primary button at the bottom is under the tab bar. "0 de 0 listas" reads oddly. Bubble covers the last chip.
- C18 new task, C20 new shared task, C37 new block, C44 new broadcast: no large title, the first field label sits right under the top bar; C37 shows the title twice (breadcrumb and heading).
- C22 people: member row prints the email twice and the raw role "viewer" in ES. (A `viewer-w12@test.guest-ly.com` member exists on demo-review: another workstream.)
- C23 reminders: the private calendar URL with its token is on screen (never commit this shot as evidence). Raw tz id "America/La_Paz".
- C24, C27, C28, C35, C40: bubble covers the right end of the primary button or body text (H22, systemic).
- C30 new vendor: form labels are sentence case grey here and uppercase gold on task forms (inconsistent). Bubble covers the "Vestuario" chip.
- C31 seating empty: button "Sugerir distri..." truncated. Bubble covers "Agregar una".
- C34 floor plan: button "Elegir de la g..." truncated.
- C37 new block: raw ISO date in the day field, time fields are free text "HH:MM" (no picker); placeholder "Un nombre, por ejemplo el padrino o la..." truncated.
- C39 brain sections: date as free text "(AAAA-MM-DD)"; empty multi-line fields have no placeholder; hotels: the bubble sits exactly on the "Recomendado" toggle (P1, control covered).
- C42 insights: stat cards of uneven height, "4 mensajes de invitados" wraps to three lines; bubble covers "conversaciones tensas".
- C44 new broadcast: P0 for store and review: the preview text reads "Alexandra Schuab y Nicolas Zamora para organizar tu asistencia" on demo-review (real couple's names inside the approved template). Template names are English ("Invitation", "RSVP reminder") inside ES. The three-way language segmented control wraps to two lines and the selected pill clips its text. "Mensaje personalizado" touches the pill edge.
- C46 website: heading "app.guest-ly.com/demo-r..." truncated; button "Cambiar di..." truncated and covered by the bubble.
- C49 invite code: "CAMAND" wraps to "CAMAN / D" on 375 pt. P1. Button "Copiar . Codi..." truncated.
- C50 email notifications: bubble covers the second toggle completely. P1.
- S01 settings: bubble covers the Modo del dia control. Account name shows as lowercase "review".
- S03 assistant empty: good. The bubble hides itself here.
- S05 web guide: the portal guide is in ENGLISH while the app is in Spanish, and the portal's own header, bell, bottom nav and search button render inside the app's web view (double chrome).
- S06 `/web?path=//example.com`: shows a portal page, not the refused state. Not a foreign origin, but it should be refused.
- S07 refused: good copy; the button says "Intentar de nuevo", which cannot help on a refused page.

## Batch 2: S, signed out, EN and ES (9 + 9 shots, five-up sheets, E07 opened singly)

- E01 entrance: the gold gem of the wordmark disappears against the bright sky (reads "Guest  ly"), EN and ES. Trademark line and language toggle fit on one line at 375 (H13 is a 360 px problem only).
- E02 invite: the keyboard opens by itself and on the 667 pt phone it covers the code field completely; in ES it also cuts the title "Su codigo de invitacion". The user types blind. P1 (H6).
- E03 find: "Camila & Andres . 2027-03-21" raw ISO date (H10), EN and ES.
- E04 to E06 notify: the Allow button is cut by the bottom edge on E05 and "Not now" / "Ahora no" is below the fold (ES) or touches the bottom edge (EN) on the SE. Confirm in A4 that the screen scrolls. E04 opened without a wedding in memory ends its title on a dangling "Hear from" / "Reciba noticias de" (deep link artifact, but the sentence should not dangle).
- E07 sign-in: on the SE the photo takes half the screen, the email field is below the fold ("OR WITH EMAIL" is the last thing visible). The Google button uses a generic circle glyph, not the Google "G".
- E08 expired link, E09 bad code: good in both languages.
- Code checks done while the walks ran: 89 `router.back()` and 0 `canGoBack` (H7); `sign-in.tsx:41` shows `err.message` (H8); `sign-in.tsx:103` alert names env vars; `IconButton` label falls back to the icon name and `Sheet` scrim says "Close" (H9); `getLastNotificationResponseAsync` unguarded (H21); "tell the couple" has no onPress (H27); no `locales`, location string present, no Photos or Phone privacy types, no `recordAudioAndroid` (H16, H17, H26).
- Contrast (script, WCAG): ivory 17.1, ivory90 13.9, ivory70 12.7, ivory55 9.6, ivory40 6.6 (6.3 on a glass card), gold 8.5, goldLight 11.6, greenText 13.1, amber 11.8, red 9.4 on night; ink on gold 8.4; muted on cream 4.8, muted on ivory 4.4 (FAILS 4.5 for small text), goldDim on night 3.9 and gold on cream 2.2 (no text usage found in src), goldDim on cream 4.8. Disabled primary button (opacity 0.4) is about 1.8:1 (exempt, but hard to read).
- Portal source of the P0 above: `guestly-portal-deploy/src/app/(portal)/broadcasts/templates.ts:24,42` hard-codes the real couple's names in the approved template bodies. Portal is read-only in this wave: the app must not render that body for other tenants, and the lead needs a portal fix.

## Batch 3: T (iPad mini) signed out EN and ES; A1 S couple EN (71 shots, five-up sheets)

- iPad: on iPadOS 26.5 the phone-only app runs in a 375x667 pt compatibility window (rounded, left of the wallpaper, resize handle bottom right). Layout is therefore the SE layout. Every S defect also shows on the iPad, which is the device App Review often uses.
- T E02 invite (opened singly): the keyboard covers the code field on the iPad too. Because the guest code is App Review flow 1, this is filed as P0.
- T E01, E03 to E09: render correctly, same findings as S (raw ISO date, notify buttons at the bottom edge, email field below the fold).
- S couple EN confirms that the truncations are NOT Spanish-only: C06 "ATTENDIN / G" breaks mid word and "Remind 16 pe..." is cut; C11 "The day, min..."; C16 "Wedding...", "Reminder..."; C34 "Choose from..."; C44 "Each guest's own" clipped in the segmented control, template preview shows the real couple's names in EN too; C46 "Change ad..."; C49 "CAMAN / D". C03 prints "[object Object]: attending" in EN as well.
- C31 EN: "+ Add a table" runs to the screen edge under the bubble. C33: a toggle sits at the bottom left with its label hidden behind the tab bar. C50: the footnote is covered by the bubble.
- S05 EN: portal chrome inside the web view (own header, bell with a 14 badge, bottom nav, search button).

## Batch 4: A1 S planner ES (15 shots, five-up) and EN (15 shots, eight-up)

- P01 home: "Buenos tardes," is wrong Spanish (Buenas tardes). "1 bodas" / "1 weddings" plural error. Raw ISO date "2027-03-21" on the wedding card (H10). Stat card "Asistiran . Camila & Andres" wraps awkwardly; bubble covers the second stat card.
- P02 guests: good (contact-details lock note shows). Top gap differs from P03 (same inconsistency as the couple tabs).
- P03 requests empty: the empty state repeats the subtitle sentence word for word.
- P05 new request, P06 tasks empty, P08 new shared task, P09 budget empty, P12 import, P13 vendors, P15 run sheet, P16 seating: render; read-only notes show; bubble covers the primary button end on P09 and P12 and the empty title on P06.
- P17 reminders: button "Pedir a la pareja que envie recorda..." truncated (ES). "1 invitados con telefono" / "1 guests with a phone" plural error. NOTE for the lead: one demo guest now HAS a phone number (it was 0 at plan time). Nobody may press send or remind on demo-review.
- P18 More: list rows here, tiles on the couple More (inconsistent pattern, P3). "Coordinador / Bot de WhatsApp".
- S02 settings planner: "Plan: standard. Se administra en la web." No purchase call to action (H20 cleared), but "standard" is a raw tier value.
- S04 planner assistant: NOT empty any more. It opens a session full of test junk ("Contenido largo de prueba" x12, "MOCK:SLOW", "Listo, tarde un poco."), created by someone else on demo-review today. App Review would see it. Also a real layout defect on the same screen: the message list scrolls UNDER the header block and overlaps the intro sentence. P1.

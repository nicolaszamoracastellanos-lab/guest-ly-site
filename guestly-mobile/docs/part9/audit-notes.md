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

## Batch 5: A1 S guest ES and EN (14 + 14 shots, five-up; G06 EN opened singly). Seed applied after this batch.

**Seed applied at 2026-09-18T23:50:52Z (18:50 CDT)**: 8 tasks, 2 board tasks, 5 vendors, 1 budget (5 categories, 12 lines, 3 payments, 2 vendor links), 6 tables with 22 of 43 seated, 8 run sheet blocks, 1 optional RSVP question, 1 open planner request, `emailSent=false`. Ledger in `.part9/seed-ledger.json`.

- G01 home: header "TARIJA, BOLIVIA . 2027-03-21" raw ISO date (H10). The assistant bubble covers the venue name in the date line.
- G02 RSVP: the gold primary button is hidden behind the floating tab bar (same systemic defect as C16). Bubble covers the "ACOMPANANTE" / "PARTY MEMBER" badge.
- G03 confirm: the ivory answer card is cut by the tab bar. The title sits on the brightest part of the photo (weak scrim), EN and ES.
- G04 schedule: ES header "DOMINGO, 21 DE MARZO DE 2027" runs into the calendar icon (EN fits). "Abrir en Mapas" touches the right edge under the bubble.
- G05 concierge: subtitle "Conoce la boda. Una persona interviene cuando hace falta." / "Knows the wedding. A person steps in when needed." never says the concierge is an AI (H18 confirmed). EN greeting mixes languages: "Hola Sofia. I know the schedule...".
- G06 day-of EN (single): the body text is five lines and the two buttons sit on top of the fifth line ("leaves at 2:00 am" hidden). P1 overlap. ES fits by luck of line breaks.
- G07 messages: demo thread shows the unaccented technical-problem fallback message ("Perdon, tuve un problema tecnico"). Bad demo content for review.
- G08 More: fine. G09 to G14 site pages: ALL six say "Todavia no esta publicado" / "Not published yet" because the demo-review website is a draft. App Review flow 1 would walk into six empty pages. Agents may not publish; the lead or Nicolas must publish the demo-review site. The More menu still links to pages that are not published. "Intentar de nuevo" is left aligned under centered text.

## Batch 6: A2 S couple EN after the seed (79 shots; the 20 screens the seed changed read five-up, the rest equal to batch 3)

Note: demo-review keeps moving under us. Guests header read 48 parties / 88 people at 18:53 CDT (40 / 73 at 14:38). This wave created no guest. RSVP pending count went 16 to 24.

- C01 home populated: good briefing rows.
- C08 RSVP questions: row carries two 32 pt icon buttons plus a chevron, crowded, under 44 pt.
- C12 day-of with a run sheet: the 01:30 "Last song and farewell" block sorts FIRST (before 09:00) and every block shows DONE with strike-through today; after-midnight blocks need to sort after the evening. P2.
- C14 requests: the row title is squeezed to one word per line ("Add / seats") by the wide AWAITING THE COUPLE badge; email cut "planner-review@...". P1.
- C15 request detail: the meta line "2m . planner-review@gues" runs off the right edge with no ellipsis. The CHANGES row shows only "+1" with an empty label on the left. P1.
- C16 tasks populated: the gold "Add a task" button floats in the MIDDLE of the list (y 490 of 667) on top of the first task row and its HIGH badge. P1 overlap.
- C17 edit task, C36 edit block, C39 couple: dates are raw ISO text fields.
- C24 budget: stat cards break numbers: "$5,89 / 0.00" and "USD / 28.4 / K" on three lines; formats mix "USD 34.3K" and "$5,890.00". P1.
- C25 category: reorder arrows are about 24 pt. C29 vendor: "+ Link a budget line" is a small text link; empty quoted price prints a lone dot.
- C28 vendors: stat cards of uneven height.
- C32 table: "Remove from table" text links (small targets), the last one under the bubble.
- C35 run sheet: the time column is too narrow for the display font: "09:00" breaks into "09:0 / 0". P1. Badge CONFIRMED under the bubble.

## Batch 7: A2 L (iPhone 17 Pro Max, 440x956) couple EN, all 79 shots read six-up (14 sheets)

- The Pro Max cures most SE problems: keyboards leave the fields visible, RSVP stat labels fit, "Remind 24 pending" fits, the thread composer (C10) sits ABOVE the tab bar, C49 "CAMAND" fits on one line, C15 meta line fits.
- Still broken on L: C03 "[object Object]"; C11 sublabels "The day, minute...", "Gaps, escalations...", "guest-ly.com/de..."; C13 helper text under the tab bar; C16 tiles "Wedding ch...", "Reminders a..." and the floating "Add a task" on top of a task row; C24 "$5,890. / 00" still wraps; C35 "09:0 / 0" and "16:0 / 0" still wrap; C36 and C37 Save button hidden behind the tab bar (gold edge peeks out); C17 Save overlaps the "Category: Vendors" footnote; C15 CHANGES row has an empty label; C33 shows a toggle with NO label at all (there is room on L, so the label is missing, not hidden); C47-registry three-way segmented control ("Link to a registry | A page on this site | Only the note") is crammed and wraps.
- C44 on L shows the whole approved template: the real couple's names, their real date ("Viernes 27 de noviembre de 2026"), their programme and `https://app.guest-ly.com/alexnico`, inside demo-review. P0 confirmed at full size. Evidence is kept out of git on purpose.
- C12: run sheet order and DONE state as on S. C42: fine on L.
- S05, S06: the web view modal shows a thin brown sliver of the screen behind it at both top corners. Portal chrome inside the web view as on S.
- Bubble (H22) on L still covers: C02 badge, C06 badge, C10 message text, C11 tile, C12 badge, C16 HIGH badge, C24 amount, C32 "Remove from table", C47-schedule toggle, S01 chevron.

## Batch 8: A2 S planner EN after the seed (13 changed screens, five-up)

- P01 populated: good rows; "1 weddings . 4 things need you" plural error; Requests tab shows a badge 1.
- P03 requests: same squeezed row as C14 ("Add / seats", "Adriana Tejerina..." cut).
- P04 request detail (planner): the CHANGES row reads "Adriana Tejerina +1" here, so the EMPTY label on the couple side (C15) is a couple-screen bug, not data. "Reply to the couple" appears twice, once as the field placeholder and once as a disabled button under it.
- P06 board: floating "Add to the board" covers the second task row. Same systemic floating-button defect as C16.
- P07 board task: third status segment under the bubble. P09 to P11 budget: same number wrapping as C24. P13, P14 vendors, P15 run sheet ("09:0 / 0" again), P16 seating read-only: render, read-only notes present.
- S04 planner assistant: a DIFFERENT junk session than an hour ago ("MOCK:REQUEST", a "Confirm change" card marked CANCELLED). Someone is testing the planner Coordinator with mock prompts on demo-review while this audit runs. The lead must make sure those sessions are deleted before App Review. No agent of this step wrote to the Coordinator.

## Batch 9: A2 L planner EN (20 shots, seven-up) and S guest EN G02 (single)

- L planner: P01 to P18 render well on the Pro Max. Still broken: P05 "New request" primary hidden behind the tab bar; P09 "$5,890. / 00"; P15 "09:0 / 0", "16:0 / 0"; P06 floating button (no overlap at this list length, but it floats mid-screen).
- L S04 planner assistant: a third junk session, this time with a LIVE action card ("replaced: QA-PC- Contenido largo de prueba..." with Confirm and Cancel buttons). Not touched. The overlap of the message list with the header block is confirmed on L.
- S G02 RSVP (single, full size): the gold Continue button is almost entirely behind the floating tab bar, its label cannot be read. This is step 2 of the guest RSVP, App Review flow 1, and the iPad compatibility window has the same 375x667 layout. P0.
- Sofia Rojas RSVP as found (not changed by this step): Sofia ceremony attending, reception attending; Martin ceremony attending, reception declined.

## Batch 10: A2 L guest EN (14, seven-up) and L signed out EN (9, nine-up). ES retitle ran at 19:05 CDT (exit 0).

- L guest: G01 to G07 are good on the Pro Max (RSVP button visible, day-of text fits, schedule header fits). G01 raw ISO date in the header (H10). G05 no AI wording (H18). G07 fallback message in the demo thread. G09 to G14 "Not published yet" (demo data).
- L G08 More: the assistant bubble sits exactly on the language toggle (the ES half is hidden). P1, H22 family.
- L signed out: E01 to E09 good. E02 code boxes visible above the keyboard on L (so E02 is an S and iPad problem). E03 raw ISO date. E07 whole form visible on L.

## Batch 11: A2 S couple ES after the seed (17 changed screens, six-up; everything else equals batch 1)

- C01: briefing row "1 solicitud del planner espera tu respuesta" uses "tu" while the app speaks usted everywhere else. Check the copy file.
- C14 ES: row title breaks mid word and is cut: "Agreg / ar lu...". P1.
- C15 ES: meta line "16m . planner-review@g" runs off the edge; CHANGES label empty. The planner's note stays English by design of the seed.
- C16 ES: "1 de 8 listas". Floating "Agregar una tarea" covers the first overdue task.
- C24 ES: "USD / 5.890 / ,00" and "USD / 28,4 / K" on three lines each. P1.
- C28 ES: stat labels break mid word ("Proveedore / s", "Contratado / s . USD 15,7K"); vendor row name cut to "Flor de..." by the PRESELECCIONADO badge. P1.
- C29 ES: "+ Vincular una linea del" runs off the right edge (no wrap, no ellipsis). P1.
- C31 ES "Sugerir distri..."; C35 ES "09:0 / 0"; C36 ES placeholder cut "Un nombre, por ejemplo el padrino o la...".
- C17, C19, C25, C26, C32: render, same findings as EN.

## Batch 12: A2 L couple ES, all 79 shots read seven-up (12 sheets)

- L-ES still truncates: C06 "Registrar una resp..." and "Recordar a 16 pen..."; C11 "Pregunte lo que...", "El dia, minuto a...", "Vacios, escalacio..."; C16 "Lista de la bo...", "Recordatorio..."; C24 "Importar desde ar..." and "USD 5.890,0 / 0"; C46 "Cambiar direcci...".
- L-ES runs off the right edge (no wrap, no ellipsis): C15 meta "16m . planner-review@guest-ly.com"; C29 "+ Vincular una linea del presupuest".
- L-ES C44: the three-way language control has no padding left ("El de cada invitado|Espanol para todos|Ingles para todos" touch each other). Preview shows "Hi QA! ... wedding of Alexandra Schuab & Nicolas Zamora" (a guest called QA with a phone now exists on demo-review; not ours).
- L-ES C47-registry: three-way control wraps to two lines per segment. C36, C37: Save behind the tab bar. C35: "09:0 / 0", "16:0 / 0".
- C39 sections, C47 sections, C48, C49 (one line on L), C50, C51, S01, S03, S05 (English guide inside the Spanish app), S06, S07: render; findings as on S.
- demo-review count drift seen again: 42 parties / 76 people in this walk.

## Batch 13: A2 S planner ES after the seed (12 changed screens, six-up)

- P01 ES: "Buenos noches," (and "Buenos tardes," earlier): the greeting uses "Buenos" for every part of the day; tardes and noches need "Buenas". P1 copy. The briefing rows speak in tu form ("1 de tus solicitudes...", "asignada a ti") while the rest of the app uses usted. "1 bodas".
- P03 ES: rows squeezed: "Otra / cosa", "Agreg / ar lu...", "Adriana Tejerin...". NOTE: a SECOND planner request ("Otra cosa", 2 minutes old at 19:14 CDT) exists. This step did not create it; the seed created exactly one at 18:50. Someone else is writing to demo-review as the demo planner.
- P04, P06 (floating button over the second task), P07, P09 to P11 (number wrapping), P13 ("Proveedore / s", "Flor de..."), P14, P15 ("09:0 / 0"), P16: as EN.

## Batch 14: A2 L planner ES (20 shots, seven-up)

- Renders well. Known items repeat on L-ES: greeting "Buenos noches", tu form rows, "1 bodas", "1 invitados con telefono", P05 primary behind the tab bar, P09 "USD 5.890,0 / 0" and "Importar desde ar...", P15 "09:0 / 0", S04 junk session with a live Confirm card and the list overlapping the header.

## Batch 15: A2 L guest ES (14, seven-up), L signed out ES (9, nine-up), S guest ES after the seed (sheet 1; sheet 2 equals batch 5)

- L-ES G03: both buttons truncated: "Agregar al calenda..." and "Cambiar resp...". P1.
- L-ES G01, G02 ("Actualizar mi respuesta" visible), G04 (header fits on L), G05, G06, G07, G08 (bubble on the language toggle), G09 to G14 (not published): as EN.
- L-ES signed out: E01 four-line headline fits; E02 boxes visible; E03 raw ISO date; E04 dangling "Reciba noticias de"; E05 to E09 good.
- S-ES guest after the seed: identical to batch 5 (the optional RSVP question shows only in step 3, which is never submitted in this audit).

## Batch 16: A5 Dynamic Type at accessibility-extra-extra-extra-large, S, ES: signed out (E01, E02, E03, E07) and guest (G01, G02, G04, G05, G08), five-up

- TAB BAR, every tab screen: the labels scale without any cap (raw `Text` in `src/ui/TabBar.tsx`, H1), grow to about 2.5x, overlap into one unreadable string ("IniciRSVProgConMas") and push the icons out. Navigation cannot be read at the largest text size. P1, systemic.
- E01: the headline grows to five lines, runs up under the status bar and ON TOP of the wordmark; "Soy de la pareja o el plan..." is truncated; the trademark line is cut at the right edge.
- E02, E03: title cut by the keyboard / search field hidden by the keyboard (worse than at the default size).
- E07: fits (photo shrinks the visible form further; first button only).
- G01: date line cut at the right edge ("domingo, 21 de marzo de 202"), countdown cut ("41" half visible).
- G02: "No asistira" wraps to two lines and spills out of the segmented pill; badge ACOMPANANTE leaves the card on the right.
- G04: the intro sentence overlaps the first time label ("4:00" sits on "invitado. Las horas son locales."); header date runs into the calendar icon; "Abrir e..." cut.
- G05: fine (chips rail, bubble text). G08: rows fine, "Preguntas y respuestas" wraps cleanly.
- The 1.3 cap of `src/ui/Text.tsx` holds for body text; what breaks is fixed-height or fixed-width containers and the uncapped raw `Text` nodes.

## Batch 17: A5 Dynamic Type, S, ES, couple (C01, C02, C03, C06, C09, C11, C14, C16, C24, C28, C31, C35, C49, S01), five-up

- Tab bar unreadable on all of them (see batch 16).
- C01: the couple's names wrap to two lines and "Andres" is cut in half by the fixed-height hero.
- C02: the search placeholder is drawn at about 28 pt: `TextInput` has no `maxFontSizeMultiplier` (H2), so inputs ignore the 1.3 cap that text obeys. Same in every Input.
- C03: "Editar inv..." truncated. C06: stat labels "ASISTIR / AN", "PENDIEN / TES"; both floating buttons cut to "Registrar..." and "Recordar...".
- C11: tile titles break mid word ("Presupue / sto", "Proveedor / es").
- C14: request row titles collapse to ONE LETTER PER LINE next to the badge. P1.
- C16: "Lista d...", "Recor"; floating button over the first task.
- C24, C28: stat cards wrap letter by letter ("US / D / 34,3 / K", "Proveed / ores", "US / D / 19,5 / K").
- C31: "Sugerir di...", "Plano de" cut by the bubble. C35: "09: / 00", block title broken into syllables ("Peina / do y / maqui / llaje"). C49: "CAMA / ND".
- C09, S01: acceptable (S01 rows wrap cleanly; the AUTO control stays 44 pt wide).

## Batch 18: A5 Dynamic Type, S, ES, planner (P01, P03, P06, P18), four-up

- Tab bar unreadable. P03: request titles one letter per line. P06: stat label "Complet / a", floating button over the first board task. P01 and P18: text wraps cleanly.

## Batch 19: A9 web rig, guest ES at 360 (13 shots, seven-up) and at 1440 (first 3 of 13, three-up)

- 1440: every guest surface stretches edge to edge: hero photo 1440 wide, "Cambiar respuesta" and "Actualizar mi respuesta" buttons about 1400 px wide, RSVP rows with the answer control 1000 px away from its label, tab bar the full width (H12 confirmed for the guest surface).
- 360: tabs fit with no horizontal overflow reported by the rig. RSVP: the bubble sits on the "No asistira" segment of the last row. Schedule: the two links wrap to two lines each ("Agregar al / calendario", "Abrir en / Mapas") and the header date still runs into the icon.
- 360, pushed guest screens (site pages, messages): the whole card is drawn about 24 px to the left, the back chevron is cut and a strip of the previous screen shows on the right. The rig reports overflow 0, and the simulators do not show it, so this is a React Native Web stack artifact, not a phone defect. Logged so the fix step re-checks it after the width helper lands.

## Batch 20: A2 T (iPad mini, compatibility window) couple ES, all 79 shots read nine-up (9 sheets), C13 singly

- No crash, no blank screen, no letterbox surprise: every couple screen renders inside the 375x667 window, in Spanish, with the seed.
- Because the window IS the SE layout, every S finding repeats on the iPad: C03 "[object Object]", C06 "PENDIENT / ES" and cut buttons, C10 composer under the tab bar, C11 and C16 truncated tiles, C14 squeezed row, C15 meta off the edge, C16 floating button over a row, C24 and C28 broken numbers and labels, C29 link off the edge, C31, C34, C46 truncated buttons, C35 "09:0 / 0", C36 and C37 Save behind the tab bar, C44 real names, C49 "CAMAN / D", C50 toggle under the bubble.
- C13 (single): the name-search field at the bottom of door check-in is hidden behind the tab bar (only "C...bre" shows at the two ends). At a real door with a dead camera, the fallback cannot be reached. P1.

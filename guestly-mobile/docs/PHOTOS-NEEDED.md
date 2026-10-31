# Photos needed (Guest-ly app)

Oct 30 2026, HH craft pass. The eight bundled photos in `assets/photos` were generated placeholders (README, BUILD-LOG decision 13, audit D-036: 780 px sources upscaled about 1.7x, soft on device). They are deleted. Every screen that showed one now shows the night surface with the diamond motif (`src/ui/NightMotif.tsx`), and a couple's own photo still wins wherever the portal sends one (guest home hero, the story card on the guest Info tab).

To bring photography back, supply real photos and put them back screen by screen through `PhotoHero` (`source={require(...)}`) or the `Image` the screen had. Rules for every shot:

- Real weddings only, never generated. Written consent from every recognisable person (couple and guests), kept with the file.
- At least 2400 px on the long side, JPEG quality 85, sRGB. Portrait 9:16 unless noted.
- Leave the lower 40 percent calm (text and a gradient sit there) and the subject in the upper half.
- No logos, signage or visible text.

| # | Screen (file) | Was | Shot needed |
|---|---|---|---|
| 1 | Entrance (`src/app/index.tsx`) | walk.jpg | A couple walking away or toward camera at golden hour, full figures in the middle band, sky or trees above. |
| 2 | Sign in (`src/app/sign-in.tsx`) and Invitation code card (`src/app/invite.tsx`) | suite.jpg | A real invitation suite on a table: envelope, card, wax seal, natural light, top-down or 30 degrees. |
| 3 | Waiting for your wedding (`src/app/pending.tsx`) | ceremony.jpg | A ceremony setting before guests arrive: aisle, chairs, arch or altar. |
| 4 | Notifications prompt (`src/app/notify.tsx`) | bluehour.jpg | A venue exterior at blue hour, warm windows, no people needed. |
| 5 | Sign up (`src/app/sign-up/index.tsx`) and guest Day-of (`src/features/guest/DayOfView.tsx`) | courtyard.jpg | A venue courtyard or garden with string lights, empty or with soft-focus guests. |
| 6 | Couple Home hero (`src/app/couple/index.tsx`) | hands.jpg | Optional. Home is now wedding-first and uses the couple's own photo once the portal sends one (see SCREENS-PLAN.md, API needs). |
| 7 | Guest Schedule (`src/app/guest/schedule.tsx`) | ceremony.jpg | Same as 3, landscape crop works. |
| 8 | Guest RSVP confirmed (`src/app/guest/(index)/rsvp/confirm.tsx`) | toast.jpg | Guests raising glasses, hands and glasses in focus, faces soft or out of frame. |
| 9 | Planner Tools header (`src/app/planner/(tools)/tools.tsx`) | four stock photos by slug | Better: the wedding's own cover photo from the portal (API need), not stock. |
| 10 | Guest Info story card fallback (`src/app/guest/(more)/more.tsx`) | walk.jpg | None: the couple's story photo is used when present, the motif otherwise. |

App Store screenshot art in `store/screenshots/src/assets/photos` is separate (marketing frames, generated, no people) and is not covered here.

// Guest-ly app design tokens. Direction A, The Invitation.
//
// Values are the portal's globals.css verbatim so the app and the web share
// one palette and type. Changing the look means changing this file only.
// scripts/tests/token-parity.test.ts holds the shared colours to the portal's
// file (PORTAL_TOKENS below names the portal variable of each).
// The master prompt named Playfair Display + Inter and a navy/ivory/gold set
// (#0D1B2A / #FAF6F0 / #B8965A); Nico confirmed the artifact look on
// 5 Sep 2026, so the artifact and portal values ship. See BUILD-LOG.md.

import { Platform } from "react-native";

export const colors = {
  night: "#0d1117",
  nightDeep: "#080b10",
  navy: "#16213a",
  navySoft: "#1f2a44",
  ivory: "#f7f3ec",
  cream: "#fffdf9",
  gold: "#c9a96e",
  goldLight: "#e2c892",
  /** Gold for text on a light surface: the portal's --color-gold-text (5.1:1 on
   *  ivory). Was #8a6d3e, the portal's value before wave 13 (K17). */
  goldDim: "#7f6337",
  ink: "#14110c",
  /** Secondary text on light: the portal's --color-muted (5.4:1 on ivory).
   *  Was #79705f (K17). */
  muted: "#6a6253",
  border: "#ddd6c7",
  green: "#34d399",
  greenText: "#9ae6c4",
  amber: "#f3c66b",
  red: "#f0a2a2",
  ivory90: "rgba(247,243,236,0.9)",
  ivory70: "rgba(247,243,236,0.86)",
  ivory55: "rgba(247,243,236,0.74)",
  ivory40: "rgba(247,243,236,0.6)",
  ivory25: "rgba(247,243,236,0.25)",
  ivory14: "rgba(247,243,236,0.14)",
  ivory09: "rgba(247,243,236,0.09)",
  glassFill: "rgba(13,17,23,0.66)",
  glassSolidFill: "rgba(247,243,236,0.055)",
  goldBorder: "rgba(201,169,110,0.35)",
  scrim: "rgba(8,11,16,0.62)",
  /** The Done bar over a numeric keyboard and the form keyboard toolbar:
   *  close to the dark iOS keyboard. A hex string (the toolbar appends alpha). */
  keyboardBar: "#1f2329",
  /** Soft gold wash: the pill behind the active tab (plan v1.2 c). */
  goldWash: "rgba(201,169,110,0.16)",
  /** Toast surface: a lighter navy than the sheets so it reads over both. */
  toast: "#26324f",
} as const;

/** The colours this app shares with the portal, and the portal's variable for
 *  each (src/app/globals.css). The rest are app-only: night-surface states
 *  (green, amber, red, their text tints), ivory alphas and glass. */
export const PORTAL_TOKENS = {
  night: "--color-night",
  nightDeep: "--color-night-deep",
  navy: "--color-navy",
  navySoft: "--color-navy-soft",
  ivory: "--color-ivory",
  cream: "--color-cream",
  gold: "--color-gold",
  goldLight: "--color-gold-lt",
  goldDim: "--color-gold-text",
  ink: "--color-ink",
  muted: "--color-muted",
  border: "--color-border-l",
} as const satisfies Partial<Record<keyof typeof colors, `--color-${string}`>>;

/** 4-point grid. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  screen: 24,
  card: 20,
} as const;

export const radius = {
  chip: 14,
  tile: 16,
  card: 18,
  pass: 20,
  widget: 24,
  sheet: 28,
  pill: 9999,
} as const;

// The six faces are embedded in the binary by the expo-font config plugin
// (app.config.ts), so nothing loads them at runtime and first paint never waits
// on them. iOS names an embedded font by its PostScript name; Android by its
// file name. Web still loads them with useFonts under the file names.
// Always use these constants, never a family string: "Jost_500Medium" does not
// exist on iOS and would fall back to the system font.
const IOS = Platform.OS === "ios";
export const fonts = {
  display: IOS ? "CormorantGaramond-Medium" : "CormorantGaramond_500Medium",
  displayItalic: IOS ? "CormorantGaramond-Italic" : "CormorantGaramond_400Regular_Italic",
  displaySemibold: IOS ? "CormorantGaramond-SemiBold" : "CormorantGaramond_600SemiBold",
  body: IOS ? "Jost-Regular" : "Jost_400Regular",
  bodyMedium: IOS ? "Jost-Medium" : "Jost_500Medium",
  bodySemibold: IOS ? "Jost-SemiBold" : "Jost_600SemiBold",
} as const;

/** Type scale. Screens pick a step by name and never pass a size (HH craft
 *  pass, Oct 30 2026); only the kit's responsive pieces (Button, Avatar,
 *  Countdown, the tour's scaled mockups, the guest home names) compute one.
 *  Body copy never renders below 16, captions never below 14.
 *  Sep 7 2026 device pass: Cormorant and Jost both have a small x-height,
 *  so the whole scale sits two points above the artboards and the muted
 *  ivories run brighter than the web values. Names keep their old numbers. */
export const type = {
  /** The big countdown on the couple's day-of screen. */
  numeral80: { fontFamily: fonts.display, fontSize: 80, lineHeight: 78 },
  display60: { fontFamily: fonts.display, fontSize: 64, lineHeight: 62 },
  display44: { fontFamily: fonts.display, fontSize: 48, lineHeight: 50 },
  title42: { fontFamily: fonts.display, fontSize: 46, lineHeight: 48 },
  /** Screen titles (BigTitle's default and the tab headers). HH Oct 30: the
   *  ramp step for what used to be `title42` with an inline 40 or 42. */
  screen: { fontFamily: fonts.display, fontSize: 42, lineHeight: 44 },
  title34: { fontFamily: fonts.display, fontSize: 38, lineHeight: 40 },
  title30: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36 },
  title26: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32 },
  name24: { fontFamily: fonts.display, fontSize: 27, lineHeight: 30 },
  /** Times in a timeline column (day-of, schedule). */
  time20: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24 },
  button17: { fontFamily: fonts.bodyMedium, fontSize: 18, lineHeight: 24 },
  body16: { fontFamily: fonts.body, fontSize: 18, lineHeight: 25 },
  body15: { fontFamily: fonts.body, fontSize: 17, lineHeight: 24 },
  meta13: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20 },
  /** The caption floor (MIN_CAPTION): small print in dense rows. */
  caption14: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19 },
  label11: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, letterSpacing: 1.6, textTransform: "uppercase" as const },
} as const;

export const MIN_BODY = 16;
export const MIN_CAPTION = 14;
export const HIT_TARGET = 44;
export const BUTTON_HEIGHT = 58;
export const TAB_BAR_HEIGHT = 62;
/** @deprecated Build 11 floated the bar `insets.bottom + 24` above the bottom
 *  edge. v1.2 tucks it into the home indicator strip: use `tabBarOffset()` or
 *  `useTabBarTop()` from the kit. Kept so old call sites still compile; with it
 *  they place things a little higher than needed, never under the bar. */
export const TAB_BAR_BOTTOM = 24;
/** Distance from the bottom edge of the window to the bottom of the floating
 *  tab bar (v1.2, plan c and the prototype): 12 pt into the home indicator
 *  strip, like the system bar, and never closer than 8 pt to the edge. On a
 *  34 pt inset that is 22 pt (build 11: 58 pt). */
export function tabBarOffset(insetBottom: number): number {
  return Math.max(insetBottom - 12, 8);
}
export const TOP_SAFE_MIN = 54;
/** Air between the floating tab bar and the last control of a scrolling
 *  screen. Clearance = tabBarOffset + TAB_BAR_HEIGHT + TAB_CLEARANCE. */
export const TAB_CLEARANCE = 16;
/** The floating Coordinator button (v1.2, AssistiveTouch style). It floats
 *  and moves wherever the person drags it, so screens no longer reserve a band
 *  for it (audit I9, I11). It snaps to the nearest side with this inset. */
export const BUBBLE_SIZE = 56;
export const BUBBLE_MARGIN = 8;
/** Opacity of the bubble after a few seconds untouched. */
export const BUBBLE_IDLE_OPACITY = 0.55;
export const BUBBLE_IDLE_MS = 3000;

/** Default focal point of a photo: the faces of people usually sit in the
 *  upper third (plan v1.2, section c). Fractions of width and height. */
export const PHOTO_FOCAL = { x: 0.5, y: 0.3 } as const;

/** Large-screen rule (BUILD-LOG decision 15). Android tablets and foldables get
 *  no phone lock, so content sits in one centered column and nothing stretches. */
export const MAX_CONTENT_WIDTH = 560;
export const WIDE_BREAKPOINT = 700;
export const SHEET_MAX_WIDTH = 640;
export const TAB_BAR_MAX_WIDTH = 520;
/** Centered content column. Spread into a style: full width up to the max. */
export const COLUMN = { width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" } as const;

/** Fill the parent. Not StyleSheet.absoluteFill: a local require() image
 *  carries its intrinsic width and height as default style, and Yoga lets an
 *  explicit width win over left+right insets, so absoluteFill left the photos
 *  at their pixel size, spilling over whole screens. Percent sizes override
 *  the intrinsic ones. */
export const FILL = { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" } as const;

/** Cover the parent's whole box, padding included. For views and gradients
 *  (nothing with an intrinsic size). React Native resolves the percent sizes of
 *  FILL against the parent's CONTENT box, so inside a padded parent FILL stops
 *  short by the padding: the docked action bar's backdrop ended above its own
 *  bottom padding and list rows showed through under the buttons. A photo inside
 *  a padded parent goes in a COVER view, with FILL on the image itself. */
export const COVER = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const;

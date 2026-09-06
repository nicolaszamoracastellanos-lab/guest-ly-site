// Guest-ly app design tokens. Direction A, The Invitation.
//
// Values are the portal's globals.css verbatim so the app and the web share
// one palette and type. Changing the look means changing this file only.
// The master prompt named Playfair Display + Inter and a navy/ivory/gold set
// (#0D1B2A / #FAF6F0 / #B8965A); Nico confirmed the artifact look on
// 5 Sep 2026, so the artifact and portal values ship. See BUILD-LOG.md.

export const colors = {
  night: "#0d1117",
  nightDeep: "#080b10",
  navy: "#16213a",
  navySoft: "#1f2a44",
  ivory: "#f7f3ec",
  cream: "#fffdf9",
  gold: "#c9a96e",
  goldLight: "#e2c892",
  goldDim: "#8a6d3e",
  ink: "#14110c",
  muted: "#79705f",
  border: "#ddd6c7",
  green: "#34d399",
  greenText: "#9ae6c4",
  amber: "#f3c66b",
  red: "#f0a2a2",
  ivory90: "rgba(247,243,236,0.9)",
  ivory70: "rgba(247,243,236,0.7)",
  ivory55: "rgba(247,243,236,0.55)",
  ivory40: "rgba(247,243,236,0.4)",
  ivory25: "rgba(247,243,236,0.25)",
  ivory14: "rgba(247,243,236,0.14)",
  ivory09: "rgba(247,243,236,0.09)",
  glassFill: "rgba(13,17,23,0.42)",
  glassSolidFill: "rgba(247,243,236,0.055)",
  goldBorder: "rgba(201,169,110,0.35)",
  scrim: "rgba(8,11,16,0.62)",
} as const;

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

export const fonts = {
  display: "CormorantGaramond_500Medium",
  displayItalic: "CormorantGaramond_400Regular_Italic",
  displaySemibold: "CormorantGaramond_600SemiBold",
  body: "Jost_400Regular",
  bodyMedium: "Jost_500Medium",
  bodySemibold: "Jost_600SemiBold",
} as const;

/** Type scale. Body copy never renders below 15, captions never below 13. */
export const type = {
  display60: { fontFamily: fonts.display, fontSize: 60, lineHeight: 56 },
  display44: { fontFamily: fonts.display, fontSize: 44, lineHeight: 44 },
  title42: { fontFamily: fonts.display, fontSize: 42, lineHeight: 44 },
  title34: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36 },
  title30: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32 },
  title26: { fontFamily: fonts.display, fontSize: 26, lineHeight: 28 },
  name24: { fontFamily: fonts.display, fontSize: 24, lineHeight: 26 },
  button17: { fontFamily: fonts.bodyMedium, fontSize: 17, lineHeight: 22 },
  body16: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  body15: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  meta13: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17 },
  label11: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 14, letterSpacing: 1.8, textTransform: "uppercase" as const },
} as const;

export const MIN_BODY = 15;
export const MIN_CAPTION = 13;
export const HIT_TARGET = 44;
export const BUTTON_HEIGHT = 58;
export const TAB_BAR_HEIGHT = 62;
export const TAB_BAR_BOTTOM = 24;
export const TOP_SAFE_MIN = 54;

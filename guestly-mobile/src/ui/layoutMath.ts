// Pure layout math for the iPhone Duo (and every other size). No React, no
// native imports, so scripts/tests/layout.test.ts can run it with plain Node.
//
// The Duo has two size classes only (outer = compact width, inner = regular
// width) and NO idiom of its own. React Native has no size-class API, so we
// use the window width in points as the stand-in, with thresholds set by
// content (two useful columns), never by device model. See
// ~/Desktop/Guest-ly Docs/iphone-duo-v2-oct23/05-SISTEMA-DE-DISENO-DUO.md.

export type Bucket = "narrow" | "compact" | "regular" | "wide";
export type Pose = "closed" | "flat" | "book" | "table" | "tent";
export type HingeStatus = "closed" | "partiallyOpen" | "fullyOpen" | "unknown";
export type HingeLike = { angle: number; status: HingeStatus } | null | undefined;

/** Lower bounds, in points, of each bucket above "narrow". */
export const BREAKPOINTS = { compact: 400, regular: 600, wide: 900 } as const;

/** narrow < 400 (Split View portrait ~335, accessibility type), compact 400..599
 *  (outer portrait 466, any iPhone, Split View landscape ~475), regular 600..899
 *  (inner portrait 669, outer landscape 678), wide >= 900 (inner landscape 951). */
export function bucketFor(width: number): Bucket {
  if (width < BREAKPOINTS.compact) return "narrow";
  if (width < BREAKPOINTS.regular) return "compact";
  if (width < BREAKPOINTS.wide) return "regular";
  return "wide";
}

/** Accessibility sizes start around 1.35x (iOS "AX1" is 1.65x on the body
 *  scale; the large standard sizes stay under 1.35x). */
export const LARGE_TEXT_SCALE = 1.35;

/** Two panes when the window can hold a useful list AND a useful detail. At
 *  regular width with large accessibility type there is no room for both, so
 *  only "wide" keeps two panes (rule 05, section 1). */
export function twoPaneFor(bucket: Bucket, largeText: boolean): boolean {
  if (bucket === "wide") return true;
  return bucket === "regular" && !largeText;
}

/** Even column counts at regular and wide so a grid never straddles the fold. */
export function columnsFor(bucket: Bucket, largeText: boolean): 1 | 2 | 4 {
  if (largeText) return 1;
  if (bucket === "wide") return 4;
  if (bucket === "regular") return 2;
  return bucket === "compact" ? 2 : 1;
}

/** Width of the list pane in a two pane layout. */
export function listWidthFor(bucket: Bucket): number {
  return bucket === "wide" ? 320 : 300;
}

/** The pose, inferred. Apple: "There's no single system-provided pose value.
 *  Infer pose from hinge status, angle, orientation, and size class together."
 *  A pose only changes ARRANGEMENT inside the same function, never what the
 *  person can do.
 *
 *  - no hinge info (any other iPhone, iOS before 27.1, Android): "flat"
 *  - closed: "closed"
 *  - fully open: "flat"
 *  - partly open and landscape, inner width (>= 900): "book" (vertical hinge)
 *  - partly open and portrait on the inner display: "table" (horizontal hinge,
 *    content up, controls down; the laptop pose)
 *  - partly open and landscape on the outer display (< 900): "tent" */
export function poseFor(hinge: HingeLike, width: number, height: number): Pose {
  if (!hinge) return "flat";
  if (hinge.status === "closed") return "closed";
  if (hinge.status === "fullyOpen") return "flat";
  if (hinge.status !== "partiallyOpen") return "flat";
  if (width >= BREAKPOINTS.wide) return "book";
  if (height > width && width >= BREAKPOINTS.regular) return "table";
  if (width > height) return "tent";
  return "flat";
}

/** Hinge angle (0 closed, 180 flat) mapped to 0..1 between two stops, for
 *  effects only (the guest invitation, the gem). */
export function openness(hinge: HingeLike, from = 20, to = 160): number {
  if (!hinge) return 1;
  const t = (hinge.angle - from) / (to - from);
  return Math.min(1, Math.max(0, t));
}

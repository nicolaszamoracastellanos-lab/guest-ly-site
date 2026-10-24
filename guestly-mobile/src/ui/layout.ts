// useLayout(): the one place that turns window size, safe areas and the Duo
// hinge into layout decisions. Nobody else reads Dimensions or compares with a
// device model (Apple: no breakpoints tied to a device, no orientation checks).
// Pure math lives in layoutMath.ts and is unit tested.

import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHinge } from "expo-hinge";
import { useDevOpenness, useDevPose } from "./devPose";
import { LARGE_TEXT_SCALE, bucketFor, columnsFor, listWidthFor, openness, poseFor, twoPaneFor, type Bucket, type HingeLike, type Pose } from "./layoutMath";

export type { Bucket, Pose } from "./layoutMath";

/** A side inset this big is the iPhone Duo's status column (84 pt measured on
 *  the closed display) or a vertical system bar: the system bars then sit on
 *  the side, so nothing needs room at the bottom for them. */
const SIDE_COLUMN_MIN = 48;

export type Layout = {
  width: number;
  height: number;
  bucket: Bucket;
  /** List and detail side by side. */
  twoPane: boolean;
  /** Even column count for tile grids (1 with large accessibility type). */
  columns: 1 | 2 | 4;
  listWidth: number;
  /** Inferred pose. Changes arrangement only, never what the person can do. */
  pose: Pose;
  /** Live hinge, or null on any other phone / OS before 27.1. Effects only. */
  hinge: { angle: number; status: string } | null;
  /** 0 closed .. 1 flat, for effects. 1 when there is no hinge. */
  openness: number;
  largeText: boolean;
  /** The system tab bar and toolbars are in a vertical rail at the side. */
  sideBar: boolean;
};

export function useLayout(): Layout {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const hinge = useHinge() as HingeLike;
  const devPose = useDevPose();
  const devOpen = useDevOpenness();
  return useMemo(() => {
    const bucket = bucketFor(width);
    const largeText = fontScale >= LARGE_TEXT_SCALE;
    return {
      width,
      height,
      bucket,
      twoPane: twoPaneFor(bucket, largeText),
      columns: columnsFor(bucket, largeText),
      listWidth: listWidthFor(bucket),
      pose: devPose ?? poseFor(hinge, width, height),
      hinge: hinge ?? null,
      openness: devOpen ?? openness(hinge),
      largeText,
      sideBar: Math.max(insets.left, insets.right) >= SIDE_COLUMN_MIN,
    };
  }, [width, height, fontScale, insets.left, insets.right, hinge, devPose, devOpen]);
}

/** Left and right padding equal to the safe area, for a screen that does not
 *  go through <Screen> (which applies it itself). On the iPhone Duo's outer
 *  display the status column and the vertical bar rail take 84 pt at the right:
 *  nothing of ours may sit under it. Zero on a phone without side insets. */
export function useSideInsetsStyle(): { paddingLeft: number; paddingRight: number } {
  const insets = useSafeAreaInsets();
  return useMemo(() => ({ paddingLeft: insets.left, paddingRight: insets.right }), [insets.left, insets.right]);
}

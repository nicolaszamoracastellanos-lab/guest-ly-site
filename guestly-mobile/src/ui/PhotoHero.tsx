// One photo header for every screen that opens on a photo (plan v1.2 section
// c; audit I1 to I8, I16, I20). Before it, nine screens drew their own, with
// four different ways of handling the top safe area (two applied it twice),
// a centered crop that hid the subject, and fixed heights that pushed the main
// action under the tab bar on a 667 pt phone.
//
// - expo-image, contentFit cover, with a focal point (default 50% across, 30%
//   down: faces sit in the upper third). The image keeps that point in view
//   whatever the box shape.
// - Height: fixed `height`, or `aspect` (width / height) from the window width,
//   or `flow` (grows with its children). `minHeight` is a floor and
//   `maxHeightFraction` a cap as a fraction of the window height; the cap wins,
//   so on an iPhone SE the actions below still sit above the tab bar.
// - A bottom gradient over at least the lower half, ending in the night color.
//   Put the screen on a plain night background (`<Screen backdrop={false}>`) so
//   the photo has no seam where it ends (I8).
// - Edge to edge from the top of the window, behind the status bar. The top
//   inset is applied once, here, to the `top` slot (and to the flow spacing).
//   The Screen must not add its own: `<Screen topInset={false} padded={false}>`
//   with the hero as its first child, no `header`.

import React, { type ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { Image, type ImageProps } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, space, COVER, FILL, PHOTO_FOCAL } from "./tokens";

export type PhotoFocal = { x: number; y: number };

export type PhotoHeroProps = {
  /** A bundled photo (`require(...)`) or a remote one (`{ uri }`). */
  source: ImageProps["source"];
  /** Point to keep in view, as fractions (0 to 1) of the photo's width and
   *  height. Default `{ x: 0.5, y: 0.3 }`. Values out of range are clamped;
   *  `null`/`undefined` from the server falls back to the default. */
  focal?: Partial<PhotoFocal> | null;
  /** Fixed height in points. Wins over `aspect`. */
  height?: number;
  /** Width / height of the box, e.g. `4 / 5` on a home, `3 / 2` on a card. */
  aspect?: number;
  /** Grow with the children (names that wrap push the photo taller). The
   *  height is then at least `minHeight` and never over the cap. */
  flow?: boolean;
  /** Floor in points. */
  minHeight?: number;
  /** Cap as a fraction of the window height (e.g. 0.5). Wins over the floor. */
  maxHeightFraction?: number;
  /** Share of the box, from the bottom, that the gradient covers. At least 0.5. */
  gradient?: number;
  /** A light shade under the status bar so the clock stays readable. */
  topShade?: boolean;
  /** A row drawn under the status bar (wordmark, bell, back). */
  top?: ReactNode;
  /** Space kept above the children in `flow` mode, under the top inset.
   *  Default 64 (room for the `top` row). */
  flowTopSpace?: number;
  /** Bottom overlay: names, date, labels. Aligned to the bottom of the box. */
  children?: ReactNode;
  /** Horizontal padding of `top` and `children`. Default the screen gutter. */
  gutter?: number;
  /** Space under the children. Default 20. */
  bottomPadding?: number;
  /** Stable cache key for a signed or rotating URL (the couple photo), so it
   *  is not downloaded again on every open (I17). */
  cacheKey?: string;
  /** Shown while the remote photo loads (e.g. a bundled stock photo). */
  placeholder?: ImageProps["placeholder"];
  /** Describes the photo for VoiceOver. Without it the photo is decorative. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** expo-image's `contentPosition` from a focal point. */
export function focalPosition(focal?: Partial<PhotoFocal> | null): { left: `${number}%`; top: `${number}%` } {
  const fx = typeof focal?.x === "number" && Number.isFinite(focal.x) ? clamp01(focal.x) : PHOTO_FOCAL.x;
  const fy = typeof focal?.y === "number" && Number.isFinite(focal.y) ? clamp01(focal.y) : PHOTO_FOCAL.y;
  return { left: `${Math.round(fx * 100)}%`, top: `${Math.round(fy * 100)}%` };
}

/** Top padding under the status bar, the same rule as the kit's useTopInset. */
function topInsetOf(insetTop: number): number {
  return insetTop >= 40 ? Math.max(insetTop, 54) : insetTop + 16;
}

export function PhotoHero({
  source,
  focal,
  height,
  aspect,
  flow = false,
  minHeight,
  maxHeightFraction,
  gradient = 0.55,
  topShade = true,
  top,
  flowTopSpace = 64,
  children,
  gutter = space.screen,
  bottomPadding = 20,
  cacheKey,
  placeholder,
  accessibilityLabel,
  style,
  testID,
}: PhotoHeroProps) {
  const { width, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const topInset = topInsetOf(insets.top);

  const cap = maxHeightFraction ? Math.round(windowHeight * maxHeightFraction) : Number.POSITIVE_INFINITY;
  const floor = minHeight ?? 0;
  const base = height ?? (aspect ? width / aspect : undefined);
  // Fixed box: the base between floor and cap (the cap wins). Flow: content
  // decides, between the same bounds.
  const fixed = !flow && base !== undefined ? Math.round(Math.min(Math.max(base, floor), cap)) : undefined;
  const box: ViewStyle = fixed !== undefined ? { height: fixed } : { minHeight: Math.min(floor, cap), maxHeight: Number.isFinite(cap) ? cap : undefined };

  const g = Math.min(1, Math.max(0.5, gradient));
  const start = 1 - g;
  const mid = start + g * 0.45;

  const img = typeof source === "string" ? { uri: source } : source;
  const src = cacheKey && img && typeof img === "object" && !Array.isArray(img) && "uri" in img ? { ...img, cacheKey } : img;

  return (
    <View testID={testID} style={[styles.hero, box, flow && { paddingTop: topInset + flowTopSpace }, style]}>
      <View style={COVER} pointerEvents="none">
        <Image
          source={src}
          placeholder={placeholder}
          style={FILL}
          contentFit="cover"
          contentPosition={focalPosition(focal)}
          transition={reduceMotion ? 0 : 200}
          accessible={!!accessibilityLabel}
          accessibilityLabel={accessibilityLabel}
          accessibilityIgnoresInvertColors
        />
        {topShade ? <LinearGradient colors={["rgba(8,11,16,0.55)", "rgba(8,11,16,0)"]} style={[styles.topShade, { height: insets.top + 56 }]} /> : null}
        <LinearGradient colors={["rgba(13,17,23,0)", "rgba(13,17,23,0.55)", colors.night]} locations={[start, mid, 1]} style={COVER} />
      </View>
      {top ? <View style={[styles.top, { top: topInset, paddingHorizontal: gutter }]}>{top}</View> : null}
      {children ? <View style={{ paddingHorizontal: gutter, paddingBottom: bottomPadding }}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: "100%", overflow: "hidden", justifyContent: "flex-end", backgroundColor: colors.night },
  topShade: { position: "absolute", top: 0, left: 0, right: 0 },
  top: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
});

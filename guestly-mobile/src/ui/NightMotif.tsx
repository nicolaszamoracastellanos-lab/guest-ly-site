// The surface that stands where a photo used to (HH craft pass, Oct 30 2026).
//
// The eight bundled photos were generated placeholders (README, BUILD-LOG
// decision 13; audit D-036: 780 px sources upscaled and soft). Until Nicolas
// supplies real venue and guest photography (docs/PHOTOS-NEEDED.md), every
// hero and card that showed one shows this instead: plain night, a faint
// diamond lattice and the brand gem drawn once, outlined in gold. A couple's
// own photo (a remote `uri`) still wins wherever the portal sends one.
//
// `variant` moves the gem so neighbouring screens do not read as copies; it
// is a placement, never a different look. Decorative: hidden from VoiceOver.

import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path, Rect, G } from "react-native-svg";
import { colors } from "./tokens";

/** Where the gem sits, as fractions of the 400 x 400 drawing. */
const PLACES = [
  { x: 0.74, y: 0.34, s: 1 },
  { x: 0.26, y: 0.3, s: 0.85 },
  { x: 0.62, y: 0.22, s: 1.15 },
  { x: 0.5, y: 0.38, s: 0.9 },
] as const;

/** The lattice: diagonals 40 apart both ways, so the cells are diamonds. */
function lattice(): string {
  const parts: string[] = [];
  for (let i = -400; i <= 800; i += 40) {
    parts.push(`M${i} 0L${i + 400} 400`);
    parts.push(`M${i} 400L${i + 400} 0`);
  }
  return parts.join("");
}
const LATTICE = lattice();

export function NightMotif({ variant = 0, style, testID }: { variant?: number; style?: StyleProp<ViewStyle>; testID?: string }) {
  const place = PLACES[Math.abs(Math.trunc(variant)) % PLACES.length];
  const size = 92 * place.s;
  const cx = 400 * place.x;
  const cy = 400 * place.y;
  return (
    <View testID={testID} style={[{ backgroundColor: colors.night, overflow: "hidden" }, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
        <Rect x={0} y={0} width={400} height={400} fill={colors.night} />
        <Path d={LATTICE} stroke={colors.ivory} strokeOpacity={0.035} strokeWidth={0.75} fill="none" />
        <G transform={`rotate(45 ${cx} ${cy})`}>
          <Rect x={cx - size / 2} y={cy - size / 2} width={size} height={size} rx={size * 0.08} stroke={colors.gold} strokeOpacity={0.32} strokeWidth={1} fill={colors.navy} fillOpacity={0.35} />
          <Rect x={cx - size * 0.09} y={cy - size * 0.09} width={size * 0.18} height={size * 0.18} rx={size * 0.02} fill={colors.gold} fillOpacity={0.7} />
        </G>
      </Svg>
    </View>
  );
}

/** A stable variant for a string (a wedding slug), so one wedding always gets
 *  the same placement. */
export function motifVariant(key: string): number {
  return [...key].reduce((n, ch) => n + ch.charCodeAt(0), 0) % PLACES.length;
}

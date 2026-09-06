// The one Text component. Variants map to the type scale; sizes below the
// minimums are clamped (and warned about in development) so no screen can
// ship unreadable copy by accident.

import React from "react";
import { Text as RNText, type TextProps, type TextStyle, StyleSheet } from "react-native";
import { colors, type, MIN_BODY, MIN_CAPTION } from "./tokens";

type Variant = keyof typeof type;

type Props = TextProps & {
  v?: Variant;
  color?: string;
  center?: boolean;
  /** Explicit override; clamped to the floor for its class. */
  size?: number;
  italic?: boolean;
};

const CAPTION_VARIANTS: Variant[] = ["meta13", "label11"];

export function T({ v = "body15", color = colors.ivory, center, size, italic, style, children, ...rest }: Props) {
  const base = type[v] as TextStyle;
  let fontSize = size ?? base.fontSize ?? MIN_BODY;
  const floor = v === "label11" ? 11 : CAPTION_VARIANTS.includes(v) ? MIN_CAPTION : MIN_BODY;
  if (fontSize < floor) {
    if (__DEV__) console.warn(`[Text] ${fontSize}px is below the ${floor}px floor for ${v}; clamped.`);
    fontSize = floor;
  }
  const lineHeight = size && base.lineHeight ? Math.round(size * ((base.lineHeight as number) / (base.fontSize as number))) : base.lineHeight;
  const family = italic && v.startsWith("display") ? "CormorantGaramond_400Regular_Italic" : base.fontFamily;
  return (
    <RNText
      {...rest}
      allowFontScaling
      maxFontSizeMultiplier={1.3}
      style={[styles.base, base, { fontSize, lineHeight, fontFamily: family, color }, center && styles.center, style]}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: { includeFontPadding: false },
  center: { textAlign: "center" },
});

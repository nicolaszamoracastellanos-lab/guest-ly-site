// Entrance. The photo above, the tagline and two doors below it.

import React, { useState } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCopy, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { COPY as SIGNUP_COPY } from "@/features/signup/copy";
import { T, Button, Wordmark, LangToggle, Row, Stack, PhotoHero, useTopInset } from "@/ui";
import { colors, COLUMN } from "@/ui/tokens";

const hero = require("../../assets/photos/walk.jpg");
// walk.jpg is 780 x 1386; the couple stands between 43% and 74% of its height
// (centre about 59%), a little right of the middle.
const WALK = { w: 780, h: 1386, coupleY: 0.59, x: 0.55 };
// How far the tagline reaches up onto the photo.
const OVERLAP = 32;

/** Object position that puts the couple in the middle of the photo band that
 *  stays visible between the wordmark and the tagline (I20). Before, the photo
 *  filled the whole window and the couple stood under the tagline. */
function coupleFocal(width: number, boxH: number, topInset: number): { x: number; y: number } {
  if (!width || !boxH) return { x: WALK.x, y: 0.7 };
  const scale = Math.max(width / WALK.w, boxH / WALK.h);
  const imgH = WALK.h * scale;
  const slack = imgH - boxH;
  if (slack < 1) return { x: WALK.x, y: 0.5 };
  const visibleTop = topInset + 40; // under the wordmark
  const visibleBottom = boxH - OVERLAP - 24; // above the tagline
  const target = (visibleTop + visibleBottom) / 2;
  const y = (WALK.coupleY * imgH - target) / slack;
  return { x: WALK.x, y: Math.min(1, Math.max(0, y)) };
}

export default function Entrance() {
  const copy = useCopy();
  const signup = useFeatureCopy(SIGNUP_COPY).signUp;
  const { lang, setLang } = useLang();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [first, second, third] = splitTagline(copy.entrance.tagline);
  const top = useTopInset();
  const [heroH, setHeroH] = useState(0);
  return (
    <View style={styles.bg}>
      {/* The photo takes the room the text leaves, so the couple is always in
          view above the tagline, on a 667 pt phone too. */}
      <View style={styles.heroBox} onLayout={(e) => setHeroH(Math.round(e.nativeEvent.layout.height))}>
        <PhotoHero source={hero} focal={coupleFocal(width, heroH, top)} gradient={0.5} topShade={false} style={styles.fill} />
        {/* The top scrim keeps the wordmark and its gold gem readable on a bright sky (D-036). */}
        <LinearGradient pointerEvents="none" colors={["rgba(8,11,16,0.62)", "rgba(8,11,16,0.18)", "rgba(8,11,16,0)"]} locations={[0, 0.6, 1]} style={styles.topScrim} />
        <View style={[styles.top, { top: top + 8 }]} pointerEvents="none">
          <Wordmark height={22} />
        </View>
      </View>
      <View style={[styles.bottom, COLUMN, { paddingBottom: Math.max(insets.bottom, 24) + 16 }]}>
        <Stack gap={14}>
          <View style={{ marginBottom: 10 }}>
            <T v="display44" size={50} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ lineHeight: 49 }}>
              {first}
            </T>
            <T v="display44" size={50} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ lineHeight: 49 }}>
              {second}
            </T>
            <T v="display44" size={50} italic color={colors.goldLight} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6} style={{ lineHeight: 49 }}>
              {third}
            </T>
          </View>
          <Button testID="entrance-guest" label={copy.entrance.openInvitation} onPress={() => router.push("/invite")} />
          <Button testID="entrance-couple" label={copy.entrance.coupleOrPlanner} kind="glass" onPress={() => router.push("/sign-in")} />
          <Button testID="entrance-create" label={signup.entrance} kind="text" small full={false} haptic={false} onPress={() => router.push("/sign-up")} style={{ alignSelf: "center", marginTop: -4 }} />
          <Row gap={12} style={{ justifyContent: "space-between" }}>
            <LangToggle value={lang} onChange={setLang} />
            <T v="meta13" color={colors.ivory40} numberOfLines={2} style={{ flex: 1, textAlign: "right" }}>
              {copy.common.footerTrademark}
            </T>
          </Row>
        </Stack>
      </View>
    </View>
  );
}

/** Splits the tagline on its commas into three display lines. */
function splitTagline(t: string): [string, string, string] {
  const parts = t.split(",").map((s) => s.trim());
  if (parts.length >= 3) return [`${parts[0]},`, `${parts[1]},`, parts.slice(2).join(", ")];
  return [t, "", ""];
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.night, overflow: "hidden" },
  heroBox: { flex: 1, minHeight: 200, marginBottom: -OVERLAP },
  fill: { flex: 1 },
  topScrim: { position: "absolute", top: 0, left: 0, width: "100%", height: 190 },
  top: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  bottom: { paddingHorizontal: 28 },
});

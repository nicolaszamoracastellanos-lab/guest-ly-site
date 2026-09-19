// Entrance. Full-bleed photography, the tagline, two doors.

import React from "react";
import { View, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCopy, useLang } from "@/i18n";
import { T, Button, Wordmark, LangToggle, Row, Stack, useTopInset } from "@/ui";
import { colors, FILL, COLUMN } from "@/ui/tokens";

const hero = require("../../assets/photos/walk.jpg");

export default function Entrance() {
  const copy = useCopy();
  const { lang, setLang } = useLang();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [first, second, third] = splitTagline(copy.entrance.tagline);
  const top = useTopInset();
  // A plain View with a FILL image, not ImageBackground: a local require()
  // keeps its pixel width there, so the 780 px photo stuck out of a 360 px
  // window and stopped short on a wide one (Part 9 audit, D-027).
  return (
    <View style={styles.bg}>
      <Image source={hero} style={FILL} resizeMode="cover" />
      {/* The top scrim keeps the wordmark and its gold gem readable on a bright sky (D-036). */}
      <LinearGradient colors={["rgba(8,11,16,0.62)", "rgba(8,11,16,0.18)", "rgba(8,11,16,0)"]} locations={[0, 0.6, 1]} style={styles.topScrim} />
      <LinearGradient
        colors={["rgba(8,11,16,0)", "rgba(8,11,16,0.1)", "rgba(8,11,16,0.72)", "rgba(13,17,23,0.98)"]}
        locations={[0, 0.34, 0.6, 1]}
        style={FILL}
      />
      <View style={[styles.top, { top: top + 8 }]}>
        <Wordmark height={22} />
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
  bg: { flex: 1, backgroundColor: colors.night, justifyContent: "flex-end", overflow: "hidden" },
  topScrim: { position: "absolute", top: 0, left: 0, width: "100%", height: 190 },
  top: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  bottom: { paddingHorizontal: 28 },
});

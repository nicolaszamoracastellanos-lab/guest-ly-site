// Entrance. Full-bleed photography, the tagline, two doors.

import React from "react";
import { View, StyleSheet, ImageBackground } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCopy, useLang } from "@/i18n";
import { T, Button, Wordmark, LangToggle, Row, Stack } from "@/ui";
import { colors } from "@/ui/tokens";

const hero = require("../../assets/photos/walk.jpg");

export default function Entrance() {
  const copy = useCopy();
  const { lang, setLang } = useLang();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [first, second, third] = splitTagline(copy.entrance.tagline);
  return (
    <ImageBackground source={hero} style={styles.bg} imageStyle={{ resizeMode: "cover" }}>
      <LinearGradient
        colors={["rgba(8,11,16,0.05)", "rgba(8,11,16,0.05)", "rgba(8,11,16,0.62)", "rgba(13,17,23,0.98)"]}
        locations={[0, 0.38, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.top, { top: Math.max(insets.top, 54) + 12 }]}>
        <Wordmark height={22} />
      </View>
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 24) + 22 }]}>
        <Stack gap={14}>
          <View style={{ marginBottom: 10 }}>
            <T v="display44" size={50} style={{ lineHeight: 49 }}>
              {first}
            </T>
            <T v="display44" size={50} style={{ lineHeight: 49 }}>
              {second}
            </T>
            <T v="display44" size={50} italic color={colors.goldLight} style={{ lineHeight: 49 }}>
              {third}
            </T>
          </View>
          <Button label={copy.entrance.openInvitation} onPress={() => router.push("/invite")} />
          <Button label={copy.entrance.coupleOrPlanner} kind="glass" onPress={() => router.push("/sign-in")} />
          <Row style={{ justifyContent: "space-between", marginTop: 6 }}>
            <LangToggle value={lang} onChange={setLang} />
            <T v="meta13" size={11} color={colors.ivory40}>
              {copy.common.footerTrademark}
            </T>
          </Row>
        </Stack>
      </View>
    </ImageBackground>
  );
}

/** Splits the tagline on its commas into three display lines. */
function splitTagline(t: string): [string, string, string] {
  const parts = t.split(",").map((s) => s.trim());
  if (parts.length >= 3) return [`${parts[0]},`, `${parts[1]},`, parts.slice(2).join(", ")];
  return [t, "", ""];
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.night, justifyContent: "flex-end" },
  top: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  bottom: { paddingHorizontal: 28 },
});

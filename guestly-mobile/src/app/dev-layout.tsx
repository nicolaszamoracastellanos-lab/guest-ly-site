// Development probe (T1.1): prints what useLayout and the safe area report, so
// the Duo's closed, open, book, table and tent poses can be measured in Device
// Hub. Not linked from anywhere; a release build redirects it away.

import React from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHinge } from "expo-hinge";
import { useLayout } from "@/ui/layout";
import { useReservedRegions } from "@/lib/duo";
import { T } from "@/ui";
import { colors } from "@/ui/tokens";

export default function DevLayout() {
  const l = useLayout();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const hinge = useHinge();
  const regions = useReservedRegions();
  if (!__DEV__ && process.env.EXPO_PUBLIC_DUO_PROBE !== "1") return <Redirect href="/" />;
  const rows: [string, string][] = [
    ["window", `${win.width} x ${win.height} pt, scale ${win.scale}, font ${win.fontScale}`],
    ["insets", `top ${insets.top}  right ${insets.right}  bottom ${insets.bottom}  left ${insets.left}`],
    ["bucket", l.bucket],
    ["twoPane / columns", `${l.twoPane} / ${l.columns}`],
    ["pose", l.pose],
    ["hinge", hinge ? `${hinge.status} ${Math.round(hinge.angle)} deg` : "null"],
    ["sideBar", String(l.sideBar)],
    ["fold", regions.division ? `x ${Math.round(regions.division.x)} y ${Math.round(regions.division.y)} w ${Math.round(regions.division.width)} h ${Math.round(regions.division.height)} ${regions.division.active ? "active" : "inactive"}` : "none"],
    ["occlusions", String(regions.occlusions.length)],
  ];
  return (
    <ScrollView style={{ backgroundColor: colors.night }} contentContainerStyle={styles.body}>
      <T v="title30">Duo layout probe</T>
      {rows.map(([k, v]) => (
        <View key={k} style={styles.row}>
          <T v="label11" color={colors.goldLight}>{k}</T>
          <T v="body16">{v}</T>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24, paddingTop: 80, gap: 14 },
  row: { gap: 2 },
});

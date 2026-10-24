// The invitation that opens with the phone (iPhone Duo only).
//
// A guest who opens the app on the Duo sees a sealed envelope with the gem. As
// the phone opens, the hinge angle (expo-hinge, iOS 27.1) lifts the flap and
// the couple's names appear; fully open, the envelope goes and the invitation is
// underneath. A tap opens it too, and so does Reduce Motion (no tilt, a fade).
// It shows once per launch. Hinge data is an EFFECT here, never layout and never
// a gate: the RSVP button lives below and is reachable without the envelope.
// Without a hinge (every other phone) this renders nothing.

import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLayout, useSideInsetsStyle, T, Gem } from "@/ui";
import { useReduceMotion } from "@/lib/duo";
import { colors } from "@/ui/tokens";

let openedThisLaunch = false;

/** Probe build only: show the envelope again. */
export function resetEnvelope() {
  openedThisLaunch = false;
}

export function InviteEnvelope({ names, date, hint, ready }: { names: string; date: string; hint: string; ready: boolean }) {
  const { hinge, openness, width } = useLayout();
  const side = useSideInsetsStyle();
  const reduce = useReduceMotion();
  const [dismissed, setDismissed] = useState(openedThisLaunch);
  const fully = hinge?.status === "fullyOpen";

  useEffect(() => {
    if (fully) {
      openedThisLaunch = true;
      setDismissed(true);
    }
  }, [fully]);

  if (!hinge || dismissed || !ready) return null;
  const t = reduce ? 0 : openness;
  const w = Math.min(width - side.paddingLeft - side.paddingRight - 48, 420);
  const h = Math.round(w / 1.5);
  const flapH = Math.round(h * 0.56);
  const tap = () => {
    openedThisLaunch = true;
    setDismissed(true);
  };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={hint} onPress={tap} style={[styles.cover, side]} testID="invite-envelope">
      <View style={{ width: w, height: h }}>
        <View style={[styles.body, { width: w, height: h }]}>
          <View style={[styles.names, { opacity: Math.max(0, t * 1.4 - 0.2) }]}>
            <T v="label11" color={colors.goldLight}>{date}</T>
            <T v="title34" center numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>{names}</T>
          </View>
        </View>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            borderLeftWidth: w / 2,
            borderRightWidth: w / 2,
            borderTopWidth: flapH,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderTopColor: colors.navySoft,
            transformOrigin: "50% 0%",
            transform: [{ perspective: 900 }, { rotateX: `${-t * 168}deg` }],
          }}
        />
        <View pointerEvents="none" style={[styles.seal, { top: flapH - 16, left: w / 2 - 16, opacity: 1 - Math.min(1, t * 2.2) }]}>
          <Gem size={14} followHinge />
        </View>
      </View>
      <T v="body15" color={colors.ivory70} center style={{ marginTop: 28, opacity: 1 - Math.min(1, t * 3) }}>
        {hint}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cover: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.night, alignItems: "center", justifyContent: "center", zIndex: 20 },
  body: { borderRadius: 14, backgroundColor: colors.navy, borderWidth: 1, borderColor: colors.goldBorder, alignItems: "center", justifyContent: "flex-end", paddingBottom: 18, overflow: "hidden" },
  names: { alignItems: "center", gap: 6, paddingHorizontal: 20 },
  seal: { position: "absolute", width: 32, height: 32, borderRadius: 16, backgroundColor: colors.nightDeep, borderWidth: 1, borderColor: colors.goldBorder, alignItems: "center", justifyContent: "center" },
});

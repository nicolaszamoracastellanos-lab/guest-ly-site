// The cover drawn over content while the biometric lock is on, or while the
// app is in the app switcher with biometric unlock enabled.
//
// It is drawn by every presented surface (the root layout, each Screen, each
// Sheet, the web view), because a native modal or an RN <Modal> sits above the
// root view and a single root overlay could not hide it (core review P0-3).
// Surfaces under another cover simply draw an identical one underneath.
//
// Locked: the gem, a "Biometric unlock" button and "Sign out".
// App switcher only: the gem on night, nothing to tap.

import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useCopy } from "@/i18n";
import { useLockSnapshot, requestUnlock, requestLockSignOut } from "@/lib/lock";
import { T } from "./Text";
import { colors } from "./tokens";

function Gem({ size }: { size: number }) {
  return <View style={{ width: size, height: size, backgroundColor: colors.gold, transform: [{ rotate: "45deg" }] }} />;
}

export function LockCover() {
  const { locked, privacy } = useLockSnapshot();
  const copy = useCopy();
  if (!locked && !privacy) return null;
  return (
    <View style={styles.cover} accessibilityViewIsModal importantForAccessibility="yes" testID="lock-cover">
      <View style={styles.inner}>
        <Gem size={20} />
        {locked ? (
          <>
            <T v="title30" center style={{ marginTop: 18 }}>
              {copy.settings.biometric}
            </T>
            <Pressable
              testID="lock-unlock"
              onPress={requestUnlock}
              accessibilityRole="button"
              accessibilityLabel={copy.settings.biometric}
              style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
            >
              <T v="button17" color={colors.night}>
                {copy.settings.biometric}
              </T>
            </Pressable>
            <Pressable onPress={requestLockSignOut} accessibilityRole="button" style={styles.link}>
              <T v="body15" color={colors.ivory55}>
                {copy.settings.signOut}
              </T>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: colors.night,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: { alignItems: "center", paddingHorizontal: 32, width: "100%", maxWidth: 480 },
  button: {
    marginTop: 18,
    minHeight: 52,
    alignSelf: "stretch",
    borderRadius: 999,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  link: { marginTop: 10, minHeight: 44, minWidth: 44, justifyContent: "center", paddingHorizontal: 12 },
});

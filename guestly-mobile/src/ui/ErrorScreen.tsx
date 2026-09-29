// The branded recovery screen for expo-router error boundaries (core review
// P1-11). A render error anywhere below a layout lands here instead of
// closing the app, and is reported (lib/telemetry) without personal data.
//
// Context-free on purpose: the root boundary renders OUTSIDE the providers
// (language, session, query), so the copy is picked from the device language
// here and nothing reads a context that may be what crashed.
//
// Use from a layout:  export { ErrorBoundary } from "@/ui/ErrorScreen";

import React, { useEffect } from "react";
import { View, Pressable, StyleSheet, ScrollView } from "react-native";
import { getLocales } from "expo-localization";
import { router } from "expo-router";
import { reportError } from "@/lib/telemetry";
import { T } from "./Text";
import { colors } from "./tokens";

const COPY = {
  en: {
    title: "Something went wrong",
    body: "This screen hit a problem. Your information is safe. Try again, or go back to the start.",
    retry: "Try again",
    home: "Back to the start",
  },
  es: {
    title: "Algo salió mal",
    body: "Esta pantalla tuvo un problema. Tu información está a salvo. Inténtalo de nuevo o vuelve al inicio.",
    retry: "Intentar de nuevo",
    home: "Volver al inicio",
  },
};

function lang(): "en" | "es" {
  try {
    return getLocales()[0]?.languageCode?.toLowerCase() === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}

export type ErrorBoundaryProps = { error: Error; retry: () => Promise<void> };

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const c = COPY[lang()];
  useEffect(() => {
    void reportError(error, "boundary");
  }, [error]);
  return (
    <View style={styles.screen} accessibilityViewIsModal>
      <ScrollView contentContainerStyle={styles.body} bounces={false}>
        <View style={styles.gem} />
        <T v="title30" center style={{ marginTop: 20 }} accessibilityRole="header">
          {c.title}
        </T>
        <T v="body15" color={colors.ivory70} center style={{ marginTop: 10 }}>
          {c.body}
        </T>
        <Pressable
          testID="error-retry"
          onPress={() => void retry().catch(() => {})}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
        >
          <T v="button17" color={colors.night}>
            {c.retry}
          </T>
        </Pressable>
        <Pressable
          testID="error-home"
          onPress={() => {
            try {
              router.replace("/");
            } catch {
              void retry().catch(() => {});
            }
          }}
          accessibilityRole="button"
          style={styles.link}
        >
          <T v="body15" color={colors.ivory55}>
            {c.home}
          </T>
        </Pressable>
        {__DEV__ ? (
          <T v="meta13" color={colors.ivory40} style={{ marginTop: 24 }}>
            {String(error?.message ?? error)}
          </T>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  body: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingVertical: 60, maxWidth: 520, alignSelf: "center", width: "100%" },
  gem: { width: 20, height: 20, backgroundColor: colors.gold, transform: [{ rotate: "45deg" }] },
  primary: {
    marginTop: 28,
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

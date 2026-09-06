// Root layout: fonts, providers, session gating, biometric lock, update
// gate, push tap routing. Every screen below inherits the night background.

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_400Regular_Italic,
  CormorantGaramond_500Medium,
  CormorantGaramond_600SemiBold,
} from "@expo-google-fonts/cormorant-garamond";
import { Jost_400Regular, Jost_500Medium, Jost_600SemiBold } from "@expo-google-fonts/jost";
import { LangProvider, useCopy } from "@/i18n";
import { QueryProvider } from "@/lib/query";
import { SessionProvider, useSession } from "@/lib/session";
import { biometricPrompt } from "@/lib/biometric";
import { routeFor } from "@/lib/push";
import { drainQueue } from "@/lib/queue";
import { colors } from "@/ui/tokens";
import { T, Button, Gem, Stack as VStack } from "@/ui";

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_400Regular_Italic,
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
    Jost_400Regular,
    Jost_500Medium,
    Jost_600SemiBold,
  });
  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.night }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.night }}>
      <SafeAreaProvider>
        <LangProvider>
          <QueryProvider>
            <SessionProvider>
              <StatusBar style="light" />
              <Gate />
            </SessionProvider>
          </QueryProvider>
        </LangProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Gate() {
  const { state, locked, unlock, updateRequired, signOut } = useSession();
  const router = useRouter();
  const segments = useSegments();
  const copy = useCopy();
  const routedOnce = useRef(false);

  // Route by session state. Entrance screens live at the root; each surface
  // owns a folder. A signed-in user who lands on an entrance screen is moved.
  useEffect(() => {
    if (state.status === "loading") return;
    const head = (segments[0] as string | undefined) ?? "";
    const inSurface = head === "guest" || head === "couple" || head === "planner";
    const onEntrance = head === "" || head === "sign-in" || head === "invite" || head === "find";
    if (state.status === "none" && (inSurface || head === "settings")) router.replace("/");
    if (state.status === "guest" && (onEntrance || head === "couple" || head === "planner")) router.replace("/guest");
    if (state.status === "user") {
      const want = state.me.surface === "planner" ? "planner" : "couple";
      const wrongSurface = inSurface && head !== want;
      if (onEntrance || wrongSurface || head === "guest") router.replace(`/${want}`);
    }
    routedOnce.current = true;
  }, [state, segments, router]);

  // Push taps route to the right screen.
  useEffect(() => {
    const surface = state.status === "guest" ? "guest" : state.status === "user" ? state.me.surface : "guest";
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      const data = res.notification.request.content.data as Record<string, unknown> | undefined;
      router.push(routeFor(data, surface) as never);
    });
    Notifications.getLastNotificationResponseAsync().then((res) => {
      if (res && state.status !== "loading") {
        const data = res.notification.request.content.data as Record<string, unknown> | undefined;
        router.push(routeFor(data, surface) as never);
      }
    });
    return () => sub.remove();
  }, [state, router]);

  // Replay queued door check-ins whenever a couple session is active.
  useEffect(() => {
    if (state.status === "user" && state.me.surface === "couple") void drainQueue();
  }, [state]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night }, animation: "fade" }} />
      {locked && state.status !== "none" && state.status !== "loading" ? (
        <LockOverlay
          onUnlock={async () => {
            const ok = await biometricPrompt(copy.settings.biometric, copy.common.cancel);
            if (ok) unlock();
          }}
          onSignOut={signOut}
        />
      ) : null}
      {updateRequired ? <UpdateOverlay /> : null}
    </View>
  );
}

function LockOverlay({ onUnlock, onSignOut }: { onUnlock: () => void; onSignOut: () => void }) {
  const copy = useCopy();
  useEffect(() => {
    onUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={styles.overlay}>
      <VStack gap={18} style={{ alignItems: "center", paddingHorizontal: 32 }}>
        <Gem size={26} />
        <T v="title30" center>
          {copy.settings.biometric}
        </T>
        <Button label={copy.settings.biometric} onPress={onUnlock} icon="lock" />
        <Pressable onPress={onSignOut} hitSlop={10}>
          <T v="body15" color={colors.ivory55}>
            {copy.settings.signOut}
          </T>
        </Pressable>
      </VStack>
    </View>
  );
}

function UpdateOverlay() {
  const copy = useCopy();
  return (
    <View style={styles.overlay}>
      <VStack gap={14} style={{ alignItems: "center", paddingHorizontal: 32 }}>
        <Gem size={26} />
        <T v="title30" center>
          {copy.common.updateTitle}
        </T>
        <T v="body15" color={colors.ivory55} center>
          {copy.common.updateBody}
        </T>
      </VStack>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, backgroundColor: colors.night, alignItems: "center", justifyContent: "center" },
});

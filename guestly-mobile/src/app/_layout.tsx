// Root layout: providers, session gating, biometric lock, update gate, push
// tap routing, error boundary. Every screen below inherits the night background.
//
// Launch: the splash stays up until the session is known, so a signed-in
// person never sees (or taps) the entrance first (core review P1-8). Fonts are
// embedded natively and never gate it; a safety timer hides it regardless.

import React, { useCallback, useEffect, useRef } from "react";
import { View, StyleSheet, Platform, Linking, Alert, AppState } from "react-native";
import { Stack, useRouter, useSegments, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { onlineManager } from "@tanstack/react-query";
import { useAppFonts } from "@/lib/useAppFonts";
import { LangProvider, useCopy } from "@/i18n";
import { QueryProvider } from "@/lib/query";
import { SessionProvider, can, useSession } from "@/lib/session";
import { biometricPrompt } from "@/lib/biometric";
import { routeFor, tenantOf } from "@/lib/push";
import { drainQueue } from "@/lib/queue";
import { setLockHandlers } from "@/lib/lock";
import { flushPendingReports, installGlobalErrorHandlers, setTelemetryRoute } from "@/lib/telemetry";
import { colors } from "@/ui/tokens";
import { T, Button, Gem, Stack as VStack, LockCover } from "@/ui";
import AssistantBubble from "@/ui/AssistantBubble";
import { pathShowsBubble, useBubbleHiddenByScreen } from "@/ui/chrome";
import { TourHost, useTourOnScreen } from "@/features/tour";
import * as ExpoLinking from "expo-linking";

void SplashScreen.preventAutoHideAsync().catch(() => {});
installGlobalErrorHandlers();
void flushPendingReports();

/** A render error below this layout shows the branded recovery screen and is
 *  reported, instead of closing the app (core review P1-11). */
export { ErrorBoundary } from "@/ui/ErrorScreen";

/** The splash never outlives this, whatever happens during the boot. */
const SPLASH_MAX_MS = 6_000;

function hideSplash() {
  void SplashScreen.hideAsync().catch(() => {});
}

export default function RootLayout() {
  // Native: always loaded (embedded fonts). Web: loaded, or failed (the
  // system font stands in); never a hang.
  const [loaded] = useAppFonts();
  useEffect(() => {
    const t = setTimeout(hideSplash, SPLASH_MAX_MS);
    return () => clearTimeout(t);
  }, []);
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
  const { state, locked, unlock, updateRequired, signOut, switchTenant, notice, clearNotice } = useSession();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const copy = useCopy();
  const routedOnce = useRef(false);

  // expo-router reads its start route from expo-linking's getLinkingURL(),
  // which on iOS is a process-wide value overwritten by EVERY deep link the
  // app receives, not just the launch link. Any later JS reload (Cmd+R in
  // development, an expo-updates reload in release) therefore restarted at
  // the last link opened, e.g. /assistant before the session was known.
  // Once the first route is resolved, and after each incoming link, forget it.
  useEffect(() => {
    ExpoLinking.clearInitialURL();
    const sub = ExpoLinking.addEventListener("url", () => setTimeout(() => ExpoLinking.clearInitialURL(), 0));
    return () => sub.remove();
  }, []);

  // The splash comes down once the session is known.
  useEffect(() => {
    if (state.status !== "loading") hideSplash();
  }, [state.status]);

  // Crash reports say which screen (ids masked).
  useEffect(() => {
    setTelemetryRoute(pathname);
  }, [pathname]);

  // A session that ended on its own says so, once.
  useEffect(() => {
    if (!notice) return;
    Alert.alert(copy.core.sessionEndedTitle, notice === "guest_ended" ? copy.core.guestEnded : copy.core.userEnded);
    clearNotice();
  }, [notice, clearNotice, copy]);

  // Biometric lock: every presented surface draws a cover (lib/lock); these
  // are what its buttons do. The prompt opens by itself once per lock.
  const promptOpen = useRef(false);
  const unlockNow = useCallback(() => {
    if (promptOpen.current) return;
    promptOpen.current = true;
    void biometricPrompt(copy.settings.biometric, copy.common.cancel)
      .then((ok) => {
        if (ok) unlock();
      })
      .finally(() => {
        promptOpen.current = false;
      });
  }, [copy, unlock]);
  useEffect(() => {
    setLockHandlers({ unlock: unlockNow, signOut: () => void signOut() });
  }, [unlockNow, signOut]);
  const signedIn = state.status === "guest" || state.status === "user";
  useEffect(() => {
    if (locked && signedIn) unlockNow();
    // Once per lock: not again when the language (and so unlockNow) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, signedIn]);

  // A different kind of session (none, couple, planner, onboarding) starts
  // from a clean root stack: the entrance and sign-in screens it came through
  // are dismissed, so back never walks through them (guest review 15). A new
  // guest is the exception: the find screen goes on to the notification step,
  // which clears the stack itself when it finishes.
  const sessionKind = state.status === "user" ? `user:${state.me.surface}` : state.status;
  const lastKind = useRef(sessionKind);
  useEffect(() => {
    const prev = lastKind.current;
    lastKind.current = sessionKind;
    if (prev === sessionKind || prev === "loading" || sessionKind === "loading" || sessionKind === "guest") return;
    try {
      if (router.canDismiss()) router.dismissAll();
    } catch {
      // nothing presented
    }
  }, [sessionKind, router]);

  // The floating assistant: concierge for guests, Coordinator for couples and
  // planners. Mounted once here so it rides above every signed-in screen and
  // keeps its position; hidden on the chat screens themselves and behind the
  // lock and update overlays.
  const bubbleSurface = state.status === "guest" ? "guest" : state.status === "user" ? (state.me.surface === "planner" ? "planner" : "couple") : null;
  const hiddenByScreen = useBubbleHiddenByScreen();
  const tourOnScreen = useTourOnScreen();
  const bubbleHidden =
    !pathShowsBubble(pathname) ||
    hiddenByScreen ||
    locked ||
    updateRequired ||
    // The welcome tour covers the screen: no floating control under it.
    tourOnScreen ||
    (state.status === "user" && state.me.locked === true) ||
    // A planner whose Coordinator is switched off gets no bubble for it.
    (state.status === "user" && !can(state.me, "coordinator"));

  // Route by session state. Entrance screens live at the root; each surface
  // owns a folder. A signed-in user who lands on an entrance screen is moved.
  useEffect(() => {
    if (state.status === "loading") return;
    const head = (segments[0] as string | undefined) ?? "";
    const inSurface = head === "guest" || head === "couple" || head === "planner";
    // "auth" (the emailed-link callback) counts as an entrance, so a person
    // who has just signed in there is moved on instead of left on its spinner.
    const onEntrance = head === "" || head === "sign-in" || head === "sign-up" || head === "invite" || head === "find" || head === "auth";
    // Couple self-serve signup: /setup (account, no wedding yet) and /pending
    // (wedding created, locked until activated) belong to one state each.
    const signupOnly = head === "setup" || head === "pending";
    // Couple and planner only: the Coordinator chat, the signed-in web view
    // and Settings. A guest (or nobody) who lands there is moved before a
    // screen can call a couple endpoint.
    const accountOnly = head === "assistant" || head === "web" || head === "settings";
    if (state.status === "none" && (inSurface || accountOnly || signupOnly)) router.replace("/");
    // "find" is left alone for guests: it has just created the session and is
    // about to show the notification step. Moving the guest to /guest first
    // meant people who typed their code were never asked (Part 9 audit, D-030).
    if (state.status === "guest" && ((onEntrance && head !== "find") || head === "couple" || head === "planner" || accountOnly || signupOnly)) router.replace("/guest");
    if (state.status === "onboarding" && head !== "setup") router.replace("/setup");
    if (state.status === "user" && state.me.locked) {
      if (head !== "pending" && head !== "tour") router.replace("/pending");
    } else if (state.status === "user") {
      const want = state.me.surface === "planner" ? "planner" : "couple";
      const wrongSurface = inSurface && head !== want;
      if (onEntrance || wrongSurface || head === "guest" || signupOnly) router.replace(`/${want}`);
    }
    routedOnce.current = true;
  }, [state, segments, router]);

  // Push taps route to the right screen, each tap exactly once (core review
  // P1-9): the launch response is read once the session is known, every
  // response is remembered by id and cleared after routing, and a push for
  // another of a planner's weddings switches to it first (P1-10).
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const handled = useRef(new Set<string>());
  const pendingTap = useRef<Notifications.NotificationResponse | null>(null);
  const routeTap = useCallback(
    (res: Notifications.NotificationResponse) => {
      const id = res.notification.request.identifier;
      if (handled.current.has(id)) return;
      const s = stateRef.current;
      if (s.status === "loading") {
        pendingTap.current = res;
        return;
      }
      handled.current.add(id);
      if (Platform.OS !== "web") void Notifications.clearLastNotificationResponseAsync().catch(() => {});
      if (s.status !== "guest" && s.status !== "user") return;
      const data = res.notification.request.content.data as Record<string, unknown> | undefined;
      const surface = s.status === "guest" ? "guest" : s.me.surface === "planner" ? "planner" : "couple";
      void (async () => {
        const tenant = tenantOf(data);
        if (s.status === "user" && tenant && tenant !== s.me.tenant.slug && s.me.tenants.some((t) => t.slug === tenant)) {
          await switchTenant(tenant);
        }
        router.push(routeFor(data, surface) as never);
      })();
    },
    [router, switchTenant]
  );
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(routeTap);
    return () => sub.remove();
  }, [routeTap]);
  const ready = state.status !== "loading";
  useEffect(() => {
    if (!ready) return;
    const pending = pendingTap.current;
    pendingTap.current = null;
    if (pending) routeTap(pending);
    // Not available on web (it rejects there), and a rejection must never surface.
    if (Platform.OS !== "web") {
      Notifications.getLastNotificationResponseAsync()
        .then((res) => {
          if (res) routeTap(res);
        })
        .catch(() => {});
    }
    // Once, when the session is first known: routeTap changing must not replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Replay queued door check-ins while a couple session is open: at once,
  // when the app comes back to the foreground, and when the connection returns.
  const coupleOpen = state.status === "user" && state.me.surface === "couple";
  useEffect(() => {
    if (!coupleOpen) return;
    void drainQueue().catch(() => {});
    const app = AppState.addEventListener("change", (s) => {
      if (s === "active") void drainQueue().catch(() => {});
    });
    const net = onlineManager.subscribe((online) => {
      if (online) void drainQueue().catch(() => {});
    });
    return () => {
      app.remove();
      net();
    };
  }, [coupleOpen]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night }, animation: "fade" }}>
        <Stack.Screen name="assistant" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="web" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        {/* /tour only asks for the welcome tour and steps back; it is never seen. */}
        <Stack.Screen name="tour" options={{ presentation: "transparentModal", animation: "none", contentStyle: { backgroundColor: "transparent" } }} />
      </Stack>
      {bubbleSurface ? <AssistantBubble surface={bubbleSurface} hidden={bubbleHidden} /> : null}
      {/* Welcome tour: after a fresh sign-in, account creation or a guest's
          first open, and on replay from Settings. Under the lock and update
          screens, above everything else. */}
      <TourHost blocked={locked || updateRequired} />
      {updateRequired ? <UpdateOverlay /> : null}
      {/* Last, so it covers the update screen and the tour too. */}
      <LockCover />
    </View>
  );
}

// Public store pages. The API sends no store URL, and the overlay can only show
// once a newer version is in the store, so these are live whenever it is seen.
const STORE_URL = Platform.OS === "android" ? "https://play.google.com/store/apps/details?id=com.zcventures.guestly" : "https://apps.apple.com/app/id6809618039";

function UpdateOverlay() {
  const copy = useCopy();
  return (
    <View style={styles.overlay}>
      <VStack gap={14} style={{ alignItems: "center", paddingHorizontal: 32, width: "100%", maxWidth: 480 }}>
        <Gem size={26} />
        <T v="title30" center>
          {copy.common.updateTitle}
        </T>
        <T v="body15" color={colors.ivory55} center>
          {copy.common.updateBody}
        </T>
        {/* Without a button this screen was a dead end (Part 9 audit, D-029). */}
        <Button label={copy.common.updateAction} onPress={() => void Linking.openURL(STORE_URL).catch(() => {})} style={{ marginTop: 8 }} />
      </VStack>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, backgroundColor: colors.night, alignItems: "center", justifyContent: "center" },
});

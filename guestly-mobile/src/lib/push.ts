// Expo push registration and tap routing.

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { post } from "@/lib/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type Surface = "guest" | "couple" | "planner";

export async function ensureAndroidChannels(labels: { general: string; dayof: string }) {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: labels.general,
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: "#c9a96e",
  });
  await Notifications.setNotificationChannelAsync("dayof", {
    name: labels.dayof,
    importance: Notifications.AndroidImportance.MAX,
    lightColor: "#c9a96e",
  });
}

/** Asks the OS (after our own pre-prompt) and returns the Expo token or null. */
export async function requestPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    const res = await Notifications.requestPermissionsAsync();
    status = res.status;
  }
  if (status !== "granted") return null;
  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
  try {
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return token.data;
  } catch {
    return null;
  }
}

/** Upserts the token with the right route for the surface. */
export async function registerPush(
  surface: Surface,
  token: string,
  prefs: Record<string, boolean>
): Promise<boolean> {
  const path = surface === "guest" ? "/guest/push" : surface === "planner" ? "/planner/push" : "/couple/push";
  try {
    const r = await post<{ saved: boolean }>(path, {
      expo_token: token,
      platform: Platform.OS === "android" ? "android" : "ios",
      prefs,
    });
    return r.saved;
  } catch {
    return false;
  }
}

/** Where a tapped notification should land, from its data payload. */
export function routeFor(data: Record<string, unknown> | undefined, surface: Surface): string {
  const route = typeof data?.route === "string" ? data.route : "";
  if (route.startsWith("/guest/") || route.startsWith("/couple/") || route.startsWith("/planner/")) return route;
  // Web hrefs from the bell map to app tabs.
  const map: Record<string, string> = {
    "/rsvps": "/couple/rsvps",
    "/conversations": "/couple/messages",
    "/requests": "/couple/requests",
    "/tasks": "/couple/more",
    "/planner/requests": "/planner/requests",
    "/planner": "/planner",
  };
  if (route && map[route]) return map[route];
  return surface === "guest" ? "/guest" : surface === "planner" ? "/planner" : "/couple";
}

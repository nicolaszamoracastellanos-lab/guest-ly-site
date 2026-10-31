// Expo push registration and tap routing.

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { post, del } from "@/lib/api";
import type { Surface } from "./pushRoutes";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type { Surface } from "./pushRoutes";

export async function ensureAndroidChannels(labels: { general: string; dayof: string }) {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: labels.general,
    // eslint-disable-next-line import/namespace -- exported by `export *`; the lint rule cannot follow it (eslint-config-expo 58)
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: "#c9a96e",
  });
  await Notifications.setNotificationChannelAsync("dayof", {
    name: labels.dayof,
    // eslint-disable-next-line import/namespace -- see above
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

const K_PREFS = "gl.push.prefs";

function pushPath(surface: Surface): string {
  return surface === "guest" ? "/guest/push" : surface === "planner" ? "/planner/push" : "/couple/push";
}

/** The preferences chosen on the pre-prompt, kept so a re-registration
 *  (language change, wedding switch) sends the same ones. */
export async function savePushPrefs(prefs: Record<string, boolean>) {
  await AsyncStorage.setItem(K_PREFS, JSON.stringify(prefs)).catch(() => {});
}

export async function loadPushPrefs(): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(K_PREFS);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

/** Deletes the token server-side with the credential the session holds now.
 *  Best effort: false when the server could not be told. */
export async function unregisterPush(surface: Surface, token: string): Promise<boolean> {
  try {
    await del(pushPath(surface), { expo_token: token });
    return true;
  } catch {
    return false;
  }
}

/** Upserts the token with the right route for the surface. */
export async function registerPush(
  surface: Surface,
  token: string,
  prefs: Record<string, boolean>
): Promise<boolean> {
  try {
    const r = await post<{ saved: boolean }>(pushPath(surface), {
      expo_token: token,
      platform: Platform.OS === "android" ? "android" : "ios",
      prefs,
    });
    return r.saved;
  } catch {
    return false;
  }
}

export { routeFor, tenantOf, PUSH_KEYS } from "./pushRoutes";

// Expo push registration and tap routing.

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { post, del } from "@/lib/api";

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

// Screens that exist in each surface. A push route is used as is only when
// its first segment is one of these; anything else (a web-only page, a typo)
// lands on the surface home instead of the "Unmatched route" page.
const SECTIONS: Record<Surface, string[]> = {
  guest: ["rsvp", "schedule", "concierge", "messages", "dayof", "more", "site"],
  couple: ["guests", "rsvps", "messages", "plan", "more", "requests", "tasks", "budget", "vendors", "seating", "runsheet", "brain", "insights", "broadcasts", "website", "dayof", "checkin", "settings"],
  planner: ["guests", "requests", "tasks", "wedding", "budget", "vendors", "seating", "runsheet", "broadcasts", "more"],
};

// Web bell hrefs (root-relative, one per surface) and where they live in the app.
const WEB_MAP: Record<Surface, Record<string, string>> = {
  guest: {},
  couple: {
    "/rsvps": "/couple/rsvps",
    "/guests": "/couple/guests",
    "/conversations": "/couple/messages",
    "/messages": "/couple/messages",
    "/requests": "/couple/requests",
    "/tasks": "/couple/tasks",
    "/budget": "/couple/budget",
    "/vendors": "/couple/vendors",
    "/seating": "/couple/seating",
    "/runsheet": "/couple/runsheet",
    "/broadcasts": "/couple/broadcasts",
  },
  planner: {
    // Rows for audience "all" carry the couple's href; a planner opens the
    // planner twin of that screen (review P1-10).
    "/rsvps": "/planner/guests",
    "/guests": "/planner/guests",
    "/requests": "/planner/requests",
    "/tasks": "/planner/tasks",
    "/budget": "/planner/budget",
    "/vendors": "/planner/vendors",
    "/seating": "/planner/seating",
    "/runsheet": "/planner/runsheet",
    "/broadcasts": "/planner/broadcasts",
  },
};

/** Where a tapped notification should land, from its data payload and the
 *  surface of the session that is open. */
export function routeFor(data: Record<string, unknown> | undefined, surface: Surface): string {
  const home = `/${surface}`;
  // The portal says which audience a push was for. A push meant for another
  // surface than the session on this phone opens its home, never a screen
  // of the wrong surface.
  const meant = data?.surface;
  if ((meant === "guest" || meant === "couple" || meant === "planner") && meant !== surface) return home;
  const raw = typeof data?.route === "string" ? data.route.trim() : "";
  const route = raw.split(/[?#]/)[0].replace(/\/+$/, "");
  if (!route || route === home) return home;
  const seg = route.split("/").filter(Boolean);
  // An app route for this surface: only when its section exists.
  if (seg[0] === surface) return seg.length === 1 || SECTIONS[surface].includes(seg[1]) ? route : home;
  // The planner web portal lives under /planner too: /planner/requests etc.
  // For any other surface a route into a different surface goes home.
  if (seg[0] === "guest" || seg[0] === "couple" || seg[0] === "planner") return home;
  const mapped = WEB_MAP[surface][`/${seg[0]}`];
  return mapped ?? home;
}

/** The wedding a push belongs to (the portal adds `tenant`), or null. */
export function tenantOf(data: Record<string, unknown> | undefined): string | null {
  const t = data?.tenant;
  return typeof t === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/.test(t) ? t : null;
}

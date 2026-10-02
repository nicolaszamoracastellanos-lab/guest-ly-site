// Turning guest notifications on without leaving the screen (build 12: the
// soft ask moved from onboarding to the RSVP confirmation, N24 / B7). Same
// steps as the /notify screen: Android channels, the OS permission (Settings
// when iOS will not ask again), the Expo token, then the server. "On" is set
// only when the server really saved the token.

import { Alert, Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { ensureAndroidChannels, registerPush, requestPushToken, savePushPrefs } from "@/lib/push";
import type { Copy } from "@/i18n/en";

/** Every guest notification kind on: the confirmation asks for all of them. */
export const GUEST_PUSH_PREFS = { dayof: true, replies: true, rsvp_reminder: true };

export type EnableResult = "on" | "blocked" | "declined" | "failed";

function askForSettings(copy: Copy): Promise<void> {
  return new Promise((resolve) => {
    Alert.alert(copy.notify.blockedTitle, copy.notify.blockedBody, [
      { text: copy.notify.notNow, style: "cancel", onPress: () => resolve() },
      {
        text: copy.notify.openSettings,
        onPress: () => {
          Linking.openSettings().catch(() => {});
          resolve();
        },
      },
    ]);
  });
}

/** Asks the OS and registers the token. Never throws. `onToken` receives the
 *  token once the server has saved it (the session's setPushToken). */
export async function enableGuestNotifications(copy: Copy, onToken: (token: string) => void): Promise<EnableResult> {
  try {
    await ensureAndroidChannels({ general: copy.push.generalChannel, dayof: copy.push.dayofChannel });
    if (Platform.OS !== "web") {
      const perm = await Notifications.getPermissionsAsync();
      if (perm.status !== "granted" && perm.canAskAgain === false) {
        await askForSettings(copy);
        return "blocked";
      }
    }
    const token = await requestPushToken();
    if (!token) return "declined";
    const saved = await registerPush("guest", token, GUEST_PUSH_PREFS);
    if (!saved) return "failed";
    onToken(token);
    await savePushPrefs(GUEST_PUSH_PREFS);
    return "on";
  } catch {
    return "failed";
  }
}

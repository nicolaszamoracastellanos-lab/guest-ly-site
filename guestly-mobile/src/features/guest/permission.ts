// Guest notification permission (Oct 7 2026, in-app delivery fix).
//
// iOS asks for notifications once. When the guest said no, the couple's
// messages still arrive in Ask (the server merges them into the thread),
// but nothing tells the guest a new one is there. Two things happen here:
//
//  1. The permission state is reported to the server whenever it changes
//     (on open and when the app comes back to the foreground), so the
//     couple's send status can say "notifications are off on their phone"
//     instead of "no device".
//  2. Once per guest on this phone, when iOS will not ask again, a plain
//     explanation with a button to the app's page in Settings. Never again
//     after that: no nagging.

import { useEffect } from "react";
import { Alert, AppState, Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { post } from "@/lib/api";
import { scopedStorageKey } from "@/lib/scope";
import { useGuestSession } from "@/lib/session";
import type { Copy } from "@/i18n/en";

type Reported = "granted" | "denied" | "undetermined";

function toReported(p: Notifications.NotificationPermissionsStatus): Reported {
  if (p.status === "granted") return "granted";
  if (p.status === "denied") return "denied";
  return "undetermined";
}

export function useGuestPermissionCheck(copy: Copy) {
  const session = useGuestSession();
  const scope = session ? `${session.tenant.slug}:${session.guest.id}` : null;

  useEffect(() => {
    if (!scope || Platform.OS === "web") return;
    const reportedKey = `${scopedStorageKey("gl.scoped.guestPermReported")}:${scope}`;
    const explainedKey = `${scopedStorageKey("gl.scoped.guestPermExplained")}:${scope}`;
    let busy = false;

    const check = async () => {
      if (busy) return;
      busy = true;
      try {
        const perm = await Notifications.getPermissionsAsync();
        const now = toReported(perm);
        const last = await AsyncStorage.getItem(reportedKey).catch(() => null);
        if (last !== now) {
          // Best effort: a failed report is retried on the next foreground.
          const ok = await post<{ saved: boolean }>("/guest/push", { permission: now })
            .then(() => true)
            .catch(() => false);
          if (ok) await AsyncStorage.setItem(reportedKey, now).catch(() => {});
        }
        if (now === "denied" && perm.canAskAgain === false) {
          const explained = await AsyncStorage.getItem(explainedKey).catch(() => null);
          if (!explained) {
            await AsyncStorage.setItem(explainedKey, "1").catch(() => {});
            Alert.alert(copy.notify.deniedTitle, copy.notify.deniedBody, [
              { text: copy.notify.notNow, style: "cancel" },
              { text: copy.notify.openSettings, onPress: () => void Linking.openSettings().catch(() => {}) },
            ]);
          }
        }
      } catch {
        // Permission APIs unavailable (simulator edge cases): nothing to do.
      } finally {
        busy = false;
      }
    };

    void check();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void check();
    });
    return () => sub.remove();
  }, [scope, copy]);
}

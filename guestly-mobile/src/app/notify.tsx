// Pre-prompt before the OS notification dialog (both platforms). The
// preferences chosen here become the push prefs on the server.

import React, { useState } from "react";
import { View, StyleSheet, Image, useWindowDimensions, Alert, Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { fmt, useCopy } from "@/i18n";
import { useSession } from "@/lib/session";
import { ensureAndroidChannels, registerPush, requestPushToken, savePushPrefs } from "@/lib/push";
import { useSafeBack } from "@/lib/nav";
import { Screen, T, Button, Card, Toggle, Stack, Icon, Row } from "@/ui";
import { colors, FILL } from "@/ui/tokens";

const photo = require("../../assets/photos/bluehour.jpg");

export default function NotifyAsk() {
  const copy = useCopy();
  const router = useRouter();
  const { state, setPushToken } = useSession();
  const { surface: raw, from } = useLocalSearchParams<{ surface?: string; from?: string }>();
  const back = useSafeBack();
  const surface = raw === "couple" || raw === "planner" ? raw : "guest";
  const guestPrefs = ["dayof", "replies", "rsvp_reminder"] as const;
  const couplePrefs = ["rsvps", "escalations", "tasks"] as const;
  const plannerPrefs = ["approvals", "tasks"] as const;
  const keys: readonly string[] = surface === "guest" ? guestPrefs : surface === "planner" ? plannerPrefs : couplePrefs;
  const [prefs, setPrefs] = useState<Record<string, boolean>>(Object.fromEntries(keys.map((k) => [k, true])));
  const [busy, setBusy] = useState(false);

  const labels: Record<string, [string, string]> = {
    dayof: [copy.notify.dayof, copy.notify.dayofDetail],
    replies: [copy.notify.replies, copy.notify.repliesDetail],
    rsvp_reminder: [copy.notify.reminder, copy.notify.reminderDetail],
    rsvps: [copy.notify.rsvps, ""],
    escalations: [copy.notify.escalations, ""],
    tasks: [copy.notify.tasks, ""],
    approvals: [copy.notify.approvals, ""],
  };
  const couple = state.status === "guest" ? state.tenant.couple_names : state.status === "user" ? state.me.tenant.couple_names : "";
  const dest = surface === "guest" ? "/guest" : surface === "planner" ? "/planner" : "/couple";

  // From More or Settings this screen was pushed on top: go back to it, never
  // replace (a replace stacked a second tab navigator over the first). After
  // signing in it clears the entrance flow and opens the surface, so back
  // never walks through invite and find again.
  function finish() {
    if (from === "more" || from === "settings") return back();
    try {
      if (router.canDismiss()) router.dismissAll();
    } catch {
      // nothing to dismiss
    }
    router.replace(dest as never);
  }

  /** iOS will not ask twice: once declined, only Settings can turn it on. */
  function askForSettings(): Promise<void> {
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

  async function allow() {
    if (busy) return;
    setBusy(true);
    try {
      await ensureAndroidChannels({ general: copy.push.generalChannel, dayof: copy.push.dayofChannel });
      if (Platform.OS !== "web") {
        const perm = await Notifications.getPermissionsAsync();
        if (perm.status !== "granted" && perm.canAskAgain === false) {
          await askForSettings();
          return;
        }
      }
      const token = await requestPushToken();
      // The switch on More reads the token: set it only when the server
      // really saved it, so "on" always means pushes arrive.
      const saved = token ? await registerPush(surface, token, prefs) : false;
      if (saved && token) {
        setPushToken(token);
        await savePushPrefs(prefs);
      }
    } catch {
      // Permission or channel errors: carry on without notifications.
    } finally {
      setBusy(false);
      finish();
    }
  }

  // Photo as a share of the window: on a 667 pt phone Allow and Not now are both
  // on screen without scrolling (Part 9 audit, D-035).
  const { height } = useWindowDimensions();
  const compact = height < 700;
  // The photo fades into the night colour, and the screen background only
  // reaches that colour about half way down, so the photo must end there or its
  // lower edge shows as a band. The text simply starts higher on the photo.
  const heroH = Math.max(300, Math.round(height * 0.5));
  const overlap = heroH - (compact ? 96 : 130);

  return (
    <Screen bottomInset={16} padded={false} topInset={false}>
      <View style={[styles.hero, { height: heroH }]}>
        <Image source={photo} style={FILL} resizeMode="cover" />
        <LinearGradient colors={["rgba(13,17,23,0.2)", "rgba(13,17,23,0.7)", colors.night]} style={FILL} />
      </View>
      <View style={{ paddingHorizontal: 28, marginTop: -overlap }}>
        <View style={styles.bellWrap}>
          <Icon name="bell" size={26} color={colors.night} />
        </View>
        <Stack gap={8} style={{ marginTop: compact ? 14 : 20 }}>
          <T v="title42" size={compact ? 32 : 38}>
            {surface === "guest" && couple ? fmt(copy.notify.title, { couple }) : copy.notify.coupleTitle}
          </T>
          <T v="body15" color={colors.ivory55}>
            {surface === "guest" ? copy.notify.intro : surface === "planner" ? copy.notify.plannerIntro : copy.notify.coupleIntro}
          </T>
        </Stack>
      </View>
      <View style={{ paddingHorizontal: 20, marginTop: compact ? 18 : 28 }}>
        <Card kind="solid" padding={4} style={{ paddingHorizontal: 18 }}>
          {keys.map((k, i) => (
            <Row key={k} style={[styles.prefRow, i === keys.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="body16">{labels[k][0]}</T>
                {labels[k][1] ? (
                  <T v="meta13" color={colors.ivory55}>
                    {labels[k][1]}
                  </T>
                ) : null}
              </View>
              <Toggle value={prefs[k]} onChange={(v) => setPrefs((p) => ({ ...p, [k]: v }))} label={labels[k][0]} />
            </Row>
          ))}
        </Card>
      </View>
      <Stack gap={compact ? 6 : 14} style={{ paddingHorizontal: 24, marginTop: compact ? 18 : 40 }}>
        <Button testID="notify-allow" label={copy.notify.allow} onPress={allow} loading={busy} />
        <Button testID="notify-skip" label={copy.notify.notNow} kind="text" onPress={finish} />
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { overflow: "hidden", opacity: 0.85 },
  bellWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  prefRow: { minHeight: 60, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.ivory09, gap: 12 },
});

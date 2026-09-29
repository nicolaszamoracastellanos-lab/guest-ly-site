// Settings: wedding switcher, language, notifications, day-of mode,
// biometric unlock, plan line (no link), legal, delete account, sign out.

import React, { useCallback, useEffect, useState } from "react";
import { View, Alert, Linking, Platform, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { unregisterPush } from "@/lib/push";
import { fmt, useCopy, useLang, shortDate } from "@/i18n";
import { useSession, useUserSession } from "@/lib/session";
import { biometricAvailable, biometricPrompt } from "@/lib/biometric";
import { Screen, TopBar, T, Avatar, Row, Card, ListRow, Icon, LangToggle, Toggle, Badge, Footer, Stack, Sheet } from "@/ui";
import { colors } from "@/ui/tokens";
import { useSafeBack } from "@/lib/nav";
import { useFeatureCopy } from "@/i18n/feature";
import { DeleteCancelled, deleteMyAccount } from "@/features/signup/account";
import { TOUR_COPY, startTour } from "@/features/tour";

/** The plan arrives as the raw tier id ("standard"). Known ids read from the copy;
 *  an unknown one is shown with a capital, never as a bare lowercase id. */
function tierLabel(tier: string | null | undefined, labels: Record<string, string>): string {
  if (!tier) return "";
  return labels[tier] ?? tier.charAt(0).toUpperCase() + tier.slice(1).replace(/_/g, " ");
}

export default function Settings() {
  const copy = useCopy();
  const { lang, setLang } = useLang();
  const router = useRouter();
  const back = useSafeBack();
  const tour = useFeatureCopy(TOUR_COPY);
  const user = useUserSession();
  const { signOut, switchTenant, switchingTenant, biometricEnabled, setBiometricEnabled, dayOfManual, setDayOfManual, pushToken, setPushToken } = useSession();
  const [bioAvailable, setBioAvailable] = useState(false);
  const [switching, setSwitching] = useState(false);
  useEffect(() => {
    biometricAvailable().then(setBioAvailable);
  }, []);
  const me = user?.me;
  const roleLabel = me?.role === "owner" ? copy.settings.owner : me?.role === "admin" ? copy.settings.admin : me?.role === "planner" ? copy.settings.planner : copy.settings.viewer;
  const initials = (me?.user.email ?? "?").slice(0, 2).toUpperCase();
  const surface = me?.surface ?? "couple";

  async function toggleBio(v: boolean) {
    if (v) {
      const ok = await biometricPrompt(copy.settings.biometric, copy.common.cancel);
      if (!ok) return;
    }
    await setBiometricEnabled(v);
  }

  // The switch shows what really happens: on only while this device's token
  // is registered AND the OS still allows notifications (re-read on focus, so
  // a revoke in iOS Settings shows here). Off deletes the token server-side.
  const [osPush, setOsPush] = useState(true);
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "web") return;
      Notifications.getPermissionsAsync()
        .then((p) => setOsPush(p.status === "granted"))
        .catch(() => {});
    }, [])
  );
  async function togglePush(on: boolean) {
    if (on) {
      router.push({ pathname: "/notify", params: { surface, from: "settings" } });
      return;
    }
    if (!pushToken) return;
    const ok = await unregisterPush(surface, pushToken);
    if (ok) setPushToken(null);
    else Alert.alert(copy.common.error, copy.core.pushOffFailed);
  }

  // Nothing changes unless the new wedding answered; the sheet stays open
  // with an explanation otherwise (core review P0-4).
  async function pickWedding(slug: string) {
    if (switchingTenant) return;
    if (slug === me?.tenant.slug) return setSwitching(false);
    const ok = await switchTenant(slug);
    if (ok) setSwitching(false);
    else Alert.alert(copy.common.error, copy.core.switchFailed);
  }

  function deleteAccount() {
    Alert.alert(copy.settings.deleteAccount, copy.settings.deleteConfirm, [
      { text: copy.common.cancel, style: "cancel" },
      {
        text: copy.settings.deleteAccount,
        style: "destructive",
        onPress: async () => {
          // Deletes for real (portal lib/account-deletion); Sign in with
          // Apple accounts are asked for a fresh Apple code first so the
          // Apple token can be revoked. Cancelling that sheet deletes nothing.
          try {
            await deleteMyAccount();
            await signOut();
            Alert.alert(copy.settings.deleteAccount, copy.settings.deleteRequested);
          } catch (err) {
            if (!(err instanceof DeleteCancelled)) Alert.alert(copy.common.error);
          }
        },
      },
    ]);
  }

  return (
    <Screen header={<TopBar onBack={back} title={copy.settings.title} />} bottomInset={40}>
      <Row gap={14} style={{ marginTop: 8 }}>
        <Avatar initials={initials} size={56} />
        <View style={{ flex: 1, gap: 3 }}>
          <T v="title30" size={26}>
            {me?.user.email.split("@")[0] ?? ""}
          </T>
          <T v="meta13" color={colors.ivory55}>
            {me?.user.email} · {roleLabel}
          </T>
        </View>
      </Row>
      <Stack gap={12} style={{ marginTop: 22 }}>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
          <ListRow
            leading={<Icon name="star" size={22} color={colors.goldLight} />}
            title={copy.settings.wedding}
            sub={me?.tenant.couple_names}
            trailing={(me?.tenants.length ?? 0) > 1 ? <T v="meta13" color={colors.goldLight}>{copy.settings.switchWedding}</T> : undefined}
            chevron={false}
            onPress={(me?.tenants.length ?? 0) > 1 ? () => setSwitching(true) : undefined}
          />
          <ListRow leading={<Icon name="globe" size={22} color={colors.goldLight} />} title={copy.settings.language} sub={lang === "es" ? "Español" : "English"} trailing={<LangToggle value={lang} onChange={setLang} />} chevron={false} />
          <ListRow
            leading={<Icon name="bell" size={22} color={colors.goldLight} />}
            title={copy.settings.notifications}
            sub={copy.settings.notificationsDetail}
            trailing={<Toggle value={!!pushToken && osPush} onChange={(v) => void togglePush(v)} label={copy.settings.notifications} />}
            chevron={false}
          />
          {surface === "couple" ? (
            <ListRow
              leading={<Icon name="clock" size={22} color={colors.goldLight} />}
              title={copy.settings.dayOfMode}
              sub={dayOfManual ? copy.settings.dayOfOn : fmt(copy.settings.dayOfAuto, { date: shortDate(me?.tenant.wedding_date, lang) })}
              trailing={dayOfManual ? <Toggle value onChange={(v) => void setDayOfManual(v)} /> : <Badge label={copy.settings.auto} kind="gold" />}
              chevron={false}
              onPress={() => void setDayOfManual(!dayOfManual)}
            />
          ) : null}
          {bioAvailable ? (
            <ListRow leading={<Icon name="lock" size={22} color={colors.goldLight} />} title={copy.settings.biometric} sub={copy.settings.biometricDetail} trailing={<Toggle value={biometricEnabled} onChange={toggleBio} />} chevron={false} last />
          ) : null}
        </Card>
        {surface === "couple" ? (
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
            <ListRow leading={<Icon name="mail" size={22} color={colors.goldLight} />} title={copy.settings.emailNotifications} sub={copy.settings.emailNotificationsDetail} onPress={() => router.push("/couple/settings/notifications" as never)} />
            <ListRow leading={<Icon name="clock" size={22} color={colors.goldLight} />} title={copy.settings.reminders} sub={copy.settings.remindersDetail} onPress={() => router.push("/couple/settings/reminders" as never)} />
            <ListRow leading={<Icon name="qr" size={22} color={colors.goldLight} />} title={copy.settings.invite} sub={copy.settings.inviteDetail} onPress={() => router.push("/couple/settings/invite" as never)} last />
          </Card>
        ) : null}
        <T v="meta13" color={colors.ivory55} style={{ paddingHorizontal: 4 }}>
          {fmt(copy.settings.plan, { tier: tierLabel(me?.tenant.tier, copy.settings.tiers) })}
        </T>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
          <ListRow testID="settings-tour" leading={<Icon name="sparkle" size={22} color={colors.goldLight} />} title={tour.replay} sub={tour.replayDetail} onPress={() => startTour()} />
          <ListRow leading={<Icon name="lock" size={22} color={colors.goldLight} />} title={copy.settings.privacy} onPress={() => Linking.openURL("https://guest-ly.com/privacy")} />
          <ListRow leading={<Icon name="book" size={22} color={colors.goldLight} />} title={copy.settings.terms} onPress={() => Linking.openURL("https://guest-ly.com/terms")} />
          <ListRow testID="settings-delete" leading={<Icon name="warning" size={22} color={colors.goldLight} />} title={copy.settings.deleteAccount} onPress={deleteAccount} chevron={false} />
          <ListRow testID="settings-signout" leading={<Icon name="signout" size={22} color={colors.goldLight} />} title={copy.settings.signOut} onPress={() => void signOut()} chevron={false} last />
        </Card>
      </Stack>
      <Footer version={copy.common.footerVersion} trademark={copy.common.footerTrademark} />
      <Sheet visible={switching} onClose={() => setSwitching(false)} top={360}>
        <T v="title30">{copy.settings.wedding}</T>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18, marginTop: 14 }}>
          {(me?.tenants ?? []).map((t, i, arr) => (
            <ListRow
              key={t.slug}
              title={t.couple_names}
              trailing={switchingTenant === t.slug ? <ActivityIndicator color={colors.goldLight} /> : t.slug === me?.tenant.slug ? <Badge label={copy.planner.current} kind="gold" /> : undefined}
              onPress={() => void pickWedding(t.slug)}
              last={i === arr.length - 1}
              chevron={false}
            />
          ))}
        </Card>
      </Sheet>
    </Screen>
  );
}

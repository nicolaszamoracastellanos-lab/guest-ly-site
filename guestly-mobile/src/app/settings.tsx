// Settings: wedding switcher, language, notifications, day-of mode,
// biometric unlock, plan line (no link), legal, delete account, sign out.

import React, { useEffect, useState } from "react";
import { View, Alert, Linking } from "react-native";
import { useRouter } from "expo-router";
import { fmt, useCopy, useLang, shortDate } from "@/i18n";
import { post } from "@/lib/api";
import { useSession, useUserSession } from "@/lib/session";
import { biometricAvailable, biometricPrompt } from "@/lib/biometric";
import { Screen, TopBar, T, Avatar, Row, Card, ListRow, Icon, LangToggle, Toggle, Badge, Footer, Stack, Sheet } from "@/ui";
import { colors } from "@/ui/tokens";

export default function Settings() {
  const copy = useCopy();
  const { lang, setLang } = useLang();
  const router = useRouter();
  const user = useUserSession();
  const { signOut, switchTenant, biometricEnabled, setBiometricEnabled, dayOfManual, setDayOfManual, pushToken } = useSession();
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

  function deleteAccount() {
    Alert.alert(copy.settings.deleteAccount, copy.settings.deleteConfirm, [
      { text: copy.common.cancel, style: "cancel" },
      {
        text: copy.settings.deleteAccount,
        style: "destructive",
        onPress: async () => {
          try {
            await post("/auth/delete-account", {});
            Alert.alert(copy.settings.deleteAccount, copy.settings.deleteRequested);
            await signOut();
          } catch {
            Alert.alert(copy.common.error);
          }
        },
      },
    ]);
  }

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={copy.settings.title} />} bottomInset={40}>
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
            trailing={<Toggle value={!!pushToken} onChange={(v) => v && router.push({ pathname: "/notify", params: { surface } })} />}
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
          {fmt(copy.settings.plan, { tier: me?.tenant.tier ?? "" })}
        </T>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
          <ListRow leading={<Icon name="lock" size={22} color={colors.goldLight} />} title={copy.settings.privacy} onPress={() => Linking.openURL("https://guest-ly.com/privacy")} />
          <ListRow leading={<Icon name="book" size={22} color={colors.goldLight} />} title={copy.settings.terms} onPress={() => Linking.openURL("https://guest-ly.com/terms")} />
          <ListRow leading={<Icon name="warning" size={22} color={colors.goldLight} />} title={copy.settings.deleteAccount} onPress={deleteAccount} chevron={false} />
          <ListRow leading={<Icon name="signout" size={22} color={colors.goldLight} />} title={copy.settings.signOut} onPress={() => void signOut()} chevron={false} last />
        </Card>
      </Stack>
      <Footer version={copy.common.footerVersion} trademark={copy.common.footerTrademark} />
      <Sheet visible={switching} onClose={() => setSwitching(false)} top={360}>
        <T v="title30">{copy.settings.wedding}</T>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18, marginTop: 14 }}>
          {(me?.tenants ?? []).map((t, i, arr) => (
            <ListRow key={t.slug} title={t.couple_names} sub={t.status} trailing={t.slug === me?.tenant.slug ? <Badge label={copy.planner.current} kind="gold" /> : undefined} onPress={async () => { await switchTenant(t.slug); setSwitching(false); }} last={i === arr.length - 1} chevron={false} />
          ))}
        </Card>
      </Sheet>
    </Screen>
  );
}

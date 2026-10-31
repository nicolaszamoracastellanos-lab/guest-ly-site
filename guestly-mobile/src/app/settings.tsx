// Settings index (HH wave F): the avatar row opens Profile, then three groups.
//   Your wedding: wedding switcher, Wedding details, Team, Plan, Connections,
//     (couple) reminders, invitation code and the referral link;
//   You: Profile, Notifications (the preference center), push on this phone,
//     language, day-of mode, biometric unlock;
//   App: tour, privacy, terms, delete account, sign out.
// Rows carry a live line (team count, plan name, "2 need setup"). Planners see
// Team and Plan only when they own the agency (the routes answer 403 else).

import React, { useCallback, useEffect, useState } from "react";
import { View, Alert, Linking, Platform, ActivityIndicator, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { unregisterPush } from "@/lib/push";
import { fmt, plural, useCopy, useLang, shortDate } from "@/i18n";
import { useSession, useUserSession } from "@/lib/session";
import { biometricAvailable, biometricPrompt } from "@/lib/biometric";
import { Screen, TopBar, T, Avatar, Row, Card, ListRow, Icon, LangToggle, Toggle, Badge, Footer, Stack, Sheet, SectionLabel, toast, type IconName } from "@/ui";
import { colors } from "@/ui/tokens";
import { useSafeBack } from "@/lib/nav";
import { useFeatureCopy } from "@/i18n/feature";
import { DeleteCancelled, deleteMyAccount } from "@/features/signup/account";
import { TOUR_COPY, startTour } from "@/features/tour";
import { HH_COPY } from "@/features/settings/copy";
import { useBilling, useConnections, usePlannerBilling, usePlannerTeam, useProfile, useTeam } from "@/features/settings/hooks";
import { avatarInitials, connectionsSummary, needSetup, openInvites, personLabel } from "@/features/settings/logic";
import { referralLine, useShareReferral } from "@/features/referral/ReferralCard";

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
  const surface = me?.surface ?? "couple";
  const hh = useFeatureCopy(HH_COPY);
  const couple = surface === "couple";
  // Live lines. Planner-only reads are owner-only on the server: a 403 hides the row.
  const profile = useProfile();
  const team = useTeam({ enabled: couple });
  const billing = useBilling({ enabled: couple });
  const connections = useConnections(couple ? "couple" : "planner");
  const plannerTeam = usePlannerTeam({ enabled: !couple });
  const plannerBilling = usePlannerBilling({ enabled: !couple });
  const referral = useShareReferral({ enabled: couple });
  const shareReferral = referral.share;

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
    const names = me?.tenants.find((t) => t.slug === slug)?.couple_names ?? "";
    const ok = await switchTenant(slug);
    if (ok) {
      setSwitching(false);
      // Same confirmation as the planner's wedding pill (F1).
      if (names) toast(fmt(copy.planner.b12.nowShowing, { names }), { icon: "rings" });
    } else Alert.alert(copy.common.error, copy.core.switchFailed);
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

  const isCouple = surface === "couple";
  const base = surface === "planner" ? "/planner/settings" : "/couple/settings";
  const go = (path: string) => router.push(`${base}/${path}` as never);
  // The name, or the full address with one neutral letter: never the address's local part as a name.
  const person = personLabel(profile.data?.first_name, profile.data?.last_name, me?.user.email);
  const name = person.label;
  const initials = avatarInitials(person.label, person.named);
  const teamLine = team.data ? [plural(team.data.members.length, hh.index.teamSub), openInvites(team.data.invites) ? plural(openInvites(team.data.invites), hh.index.teamInvites) : null].filter(Boolean).join(" · ") : hh.index.teamInvite;
  const need = needSetup(connections.data?.items);
  // The server's sentence, the same one the web page shows; an older server gets the local count.
  const connLine = connections.data ? (connectionsSummary(connections.data) ?? (need ? plural(need, hh.index.connectionsNeed) : hh.index.connectionsOk)) : hh.index.connectionsSub;
  const planLine = isCouple ? (billing.data?.tier_label ?? (me?.tenant.tier ? tierLabel(me.tenant.tier, copy.settings.tiers) : hh.index.billingSub)) : hh.index.plannerBillingSub;
  const refLine = referralLine(referral.data, hh.referral.joined);
  const ico = (n: IconName) => <Icon name={n} size={22} color={colors.ivory70} />;

  return (
    <Screen header={<TopBar onBack={back} title={copy.settings.title} />} bottomInset={40}>
      <Pressable onPress={() => go("profile")} accessibilityRole="button" accessibilityLabel={`${hh.index.profile}, ${name}`} testID="settings-profile-head" style={({ pressed }) => [{ marginTop: 8 }, pressed && { opacity: 0.8 }]}>
        <Row gap={14}>
          <Avatar initials={initials} size={56} />
          <View style={{ flex: 1, gap: 3 }}>
            <T v={person.named ? "name24" : "body16"}>{name}</T>
            {person.named ? (
              <T v="meta13" color={colors.ivory55}>
                {me?.user.email} · {roleLabel}
              </T>
            ) : (
              <T v="meta13" color={colors.ivory55}>
                {roleLabel} · <T v="meta13" color={colors.goldLight}>{hh.team.addName}</T>
              </T>
            )}
          </View>
          <Icon name="chev" size={18} color={colors.ivory40} />
        </Row>
      </Pressable>
      <Stack gap={12} style={{ marginTop: 22 }}>
        <SectionLabel>{hh.index.yourWedding}</SectionLabel>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
          <ListRow
            leading={ico("rings")}
            title={copy.settings.wedding}
            sub={me?.tenant.couple_names}
            trailing={(me?.tenants.length ?? 0) > 1 ? <T v="meta13" color={colors.goldLight}>{copy.settings.switchWedding}</T> : undefined}
            chevron={false}
            onPress={(me?.tenants.length ?? 0) > 1 ? () => setSwitching(true) : undefined}
          />
          <ListRow leading={ico("calendar")} title={hh.index.general} sub={hh.index.generalSub} onPress={() => go("general")} testID="settings-general" />
          {isCouple || plannerTeam.data ? <ListRow leading={ico("guests")} title={hh.index.team} sub={isCouple ? teamLine : plannerTeam.data?.agency.name} onPress={() => go("team")} testID="settings-team" /> : null}
          {isCouple || plannerBilling.data ? <ListRow leading={ico("wallet")} title={isCouple ? hh.index.billing : hh.index.planner} sub={planLine} onPress={() => go("billing")} testID="settings-billing" /> : null}
          <ListRow leading={ico("globe")} title={hh.index.connections} sub={connLine} onPress={() => go("connections")} testID="settings-connections" last={!isCouple} />
          {isCouple ? (
            <>
              <ListRow leading={ico("clock")} title={copy.settings.reminders} sub={copy.settings.remindersDetail} onPress={() => go("reminders")} />
              <ListRow leading={ico("qr")} title={copy.settings.invite} sub={copy.settings.inviteDetail} onPress={() => go("invite")} last={!refLine} />
              {refLine ? <ListRow leading={ico("share")} title={hh.index.referral} sub={refLine} onPress={() => void shareReferral()} chevron={false} testID="settings-referral" last /> : null}
            </>
          ) : null}
        </Card>

        <SectionLabel style={{ marginTop: 10 }}>{hh.index.you}</SectionLabel>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
          <ListRow leading={ico("edit")} title={hh.index.profile} sub={hh.index.profileSub} onPress={() => go("profile")} testID="settings-profile" />
          <ListRow leading={ico("mail")} title={hh.index.notifications} sub={hh.index.notificationsSub} onPress={() => go("notifications")} testID="settings-notifications" />
          <ListRow
            leading={ico("bell")}
            title={hh.index.push}
            sub={hh.index.pushSub}
            trailing={<Toggle value={!!pushToken && osPush} onChange={(v) => void togglePush(v)} label={hh.index.push} />}
            chevron={false}
          />
          <ListRow leading={ico("globe")} title={copy.settings.language} sub={lang === "es" ? "Español" : "English"} trailing={<LangToggle value={lang} onChange={setLang} />} chevron={false} />
          {isCouple ? (
            <ListRow
              leading={ico("clock")}
              title={copy.settings.dayOfMode}
              sub={dayOfManual ? copy.settings.dayOfOn : fmt(copy.settings.dayOfAuto, { date: shortDate(me?.tenant.wedding_date, lang) })}
              trailing={dayOfManual ? <Toggle value onChange={(v) => void setDayOfManual(v)} /> : <Badge label={copy.settings.auto} kind="gold" />}
              chevron={false}
              onPress={() => void setDayOfManual(!dayOfManual)}
              last={!bioAvailable}
            />
          ) : null}
          {bioAvailable ? (
            <ListRow leading={ico("lock")} title={copy.settings.biometric} sub={copy.settings.biometricDetail} trailing={<Toggle value={biometricEnabled} onChange={toggleBio} />} chevron={false} last />
          ) : null}
        </Card>

        <SectionLabel style={{ marginTop: 10 }}>{hh.index.app}</SectionLabel>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
          <ListRow testID="settings-tour" leading={ico("replay")} title={tour.replay} sub={tour.replayDetail} onPress={() => startTour()} />
          <ListRow leading={ico("lock")} title={copy.settings.privacy} onPress={() => Linking.openURL("https://guest-ly.com/privacy")} />
          <ListRow leading={ico("book")} title={copy.settings.terms} onPress={() => Linking.openURL("https://guest-ly.com/terms")} />
          <ListRow testID="settings-delete" leading={ico("warning")} title={copy.settings.deleteAccount} onPress={deleteAccount} chevron={false} />
          <ListRow testID="settings-signout" leading={ico("signout")} title={copy.settings.signOut} onPress={() => void signOut()} chevron={false} last />
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


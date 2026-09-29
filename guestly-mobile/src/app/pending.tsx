// The "almost ready" home: a couple's self-serve wedding exists but is not
// activated yet, so the workspace is locked (the portal refuses every write
// with workspace_locked). The Gate keeps a locked account here.
//
// App Store rule (guidelines 3.1.1 / 3.1.3), owner decision Sep 29 2026:
//   US storefront (StoreKit says "USA")  a "Choose your plan" button opens
//                                        the web activation page in the
//                                        external browser (Linking.openURL).
//   Every other storefront, or unknown   no price, no purchase wording, no
//                                        link: the details were emailed,
//                                        with Resend email and Refresh.
// The portal only sends activation_url when the app reports "USA", so the
// non-US build of this screen never even holds the link.
//
// Activation is noticed on its own: on returning to the app, every 30 s
// while this screen is open, and with Refresh. Once /auth/me says unlocked,
// the Gate moves the couple to their full home.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, Image, Alert, AppState, Linking, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmt, longDate, plural, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure } from "@/lib/api";
import { useSession, useUserSession } from "@/lib/session";
import { getStorefront, type StorefrontAnswer } from "@/lib/storefront";
import { openProductPreview, productPreviewAvailable } from "@/lib/preview";
import { Screen, T, Row, Stack, Wordmark, Card, Button, Icon, ListRow, SectionLabel, Skeleton, LangToggle } from "@/ui";
import { colors, FILL } from "@/ui/tokens";
import { COPY } from "@/features/signup/copy";
import { resendActivationEmail, useSignupStatus } from "@/features/signup/api";
import { DeleteCancelled, deleteMyAccount } from "@/features/signup/account";

const photo = require("../../assets/photos/ceremony.jpg");
const POLL_MS = 30_000;

function daysUntil(dateOnly: string | null | undefined): number | null {
  if (!dateOnly) return null;
  const target = new Date(`${dateOnly.slice(0, 10)}T12:00:00`).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime();
  if (Number.isNaN(target)) return null;
  return Math.round((target - today) / 86_400_000);
}

export default function PendingHome() {
  const c = useFeatureCopy(COPY);
  const p = c.pending;
  const { lang, setLang } = useLang();
  const user = useUserSession();
  const { refreshMe, signOut } = useSession();
  const insets = useSafeAreaInsets();
  const [store, setStore] = useState<StorefrontAnswer | null>(null);
  const status = useSignupStatus(store?.countryCode ?? null, store !== null);
  const [refreshing, setRefreshing] = useState(false);
  const [stillPending, setStillPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendNote, setResendNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    void getStorefront().then((s) => alive && setStore(s));
    return () => {
      alive = false;
    };
  }, []);

  const check = useCallback(
    async (manual: boolean) => {
      if (busy.current) return;
      busy.current = true;
      if (manual) {
        setRefreshing(true);
        setStillPending(false);
      }
      try {
        const [me] = await Promise.all([refreshMe(), status.refetch()]);
        if (me && !me.locked) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return; // the Gate takes the couple to their home
        }
        if (manual) setStillPending(true);
      } finally {
        busy.current = false;
        if (manual) setRefreshing(false);
      }
    },
    [refreshMe, status]
  );

  // Back from the browser or the mail app, and every 30 s while open.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void check(false);
    });
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void check(false);
    }, POLL_MS);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [check]);

  // The status endpoint can see the activation before /auth/me does.
  useEffect(() => {
    if (status.data?.stage !== "active") return;
    const t = setTimeout(() => void check(false), 0);
    return () => clearTimeout(t);
  }, [status.data?.stage, check]);

  async function resend() {
    setResending(true);
    setResendNote(null);
    try {
      await resendActivationEmail();
      setResendNote({ ok: true, text: p.resent });
      void status.refetch();
    } catch (err) {
      setResendNote({ ok: false, text: err instanceof ApiFailure && err.code !== "offline" && err.code !== "server_error" ? err.messages[lang] : p.resendError });
    } finally {
      setResending(false);
    }
  }

  function confirmDelete() {
    Alert.alert(p.deleteAccount, p.deleteConfirm, [
      { text: p.deleteCancel, style: "cancel" },
      {
        text: p.deleteAccount,
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteMyAccount();
            await signOut();
            Alert.alert(p.deleteAccount, p.deleted);
          } catch (err) {
            if (!(err instanceof DeleteCancelled)) Alert.alert(p.deleteAccount, p.deleteError);
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  const wedding = status.data?.wedding;
  const names = wedding?.couple_names ?? user?.me.tenant.couple_names ?? "";
  const date = wedding?.wedding_date ?? user?.me.tenant.wedding_date ?? null;
  const where = [wedding?.city, wedding?.country].filter(Boolean).join(", ");
  const days = daysUntil(date);
  const email = status.data?.email ?? user?.me.user.email ?? "";
  const sentAt = status.data?.activation_email_at
    ? new Date(status.data.activation_email_at).toLocaleString(lang === "es" ? "es-BO" : "en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : null;
  const activationUrl = store?.isUS ? status.data?.activation_url : undefined;

  return (
    <Screen padded={false} topInset={false} bottomInset={32}>
      <View style={styles.hero}>
        <Image source={photo} style={FILL} resizeMode="cover" />
        <LinearGradient colors={["rgba(8,11,16,0.55)", "rgba(8,11,16,0.1)", "rgba(13,17,23,0.78)", colors.night]} locations={[0, 0.3, 0.72, 1]} style={FILL} />
        <Row style={[styles.top, { top: Math.max(insets.top, 54) }]}>
          <Wordmark height={20} />
          <LangToggle value={lang} onChange={setLang} />
        </Row>
        <View style={styles.headline}>
          <SectionLabel color={colors.goldLight}>{p.label}</SectionLabel>
          <T v="title42" style={{ marginTop: 8 }} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
            {names}
          </T>
          <T v="body15" color={colors.ivory70} style={{ marginTop: 4 }}>
            {date ? longDate(date, lang) : p.dateTbd}
            {where ? ` · ${where}` : ""}
          </T>
          {days !== null && days >= 0 ? (
            <View style={styles.pill}>
              <View style={styles.pillGem} />
              <T v="meta13" color={colors.goldLight}>
                {days === 0 ? p.today : plural(days, p.daysToGo)}
              </T>
            </View>
          ) : null}
        </View>
      </View>

      <Stack gap={18} style={{ paddingHorizontal: 20, marginTop: 8 }}>
        <Card kind="glass" padding={20} border={colors.goldBorder}>
          <T v="title26">{p.title}</T>
          {store === null || (status.isLoading && !status.data) ? (
            <Stack gap={10} style={{ marginTop: 14 }}>
              <Skeleton h={18} w="90%" />
              <Skeleton h={52} r={26} />
            </Stack>
          ) : activationUrl ? (
            <Stack gap={10} style={{ marginTop: 14 }}>
              <Button testID="pending-choose-plan" label={c.us.cta} onPress={() => void Linking.openURL(activationUrl).catch(() => {})} />
              <T v="meta13" color={colors.ivory55} center>
                {c.us.note}
              </T>
            </Stack>
          ) : (
            <Stack gap={10} style={{ marginTop: 10 }}>
              <T v="body15" color={colors.ivory70}>
                {fmt(p.emailed, { email })}
              </T>
              {sentAt ? (
                <T v="meta13" color={colors.ivory40}>
                  {fmt(p.emailedAgo, { when: sentAt })}
                </T>
              ) : null}
              <Button testID="pending-resend" label={p.resend} kind="glass" icon="mail" onPress={() => void resend()} loading={resending} style={{ marginTop: 4 }} />
              {resendNote ? (
                <T v="meta13" color={resendNote.ok ? colors.greenText : colors.red} center accessibilityRole="alert">
                  {resendNote.text}
                </T>
              ) : null}
            </Stack>
          )}
          <Button
            testID="pending-refresh"
            kind="ghost"
            label={refreshing ? p.refreshing : p.refresh}
            loading={refreshing}
            onPress={() => void check(true)}
            style={{ marginTop: 10 }}
            small
          />
          {stillPending ? (
            <T v="meta13" color={colors.ivory55} center style={{ marginTop: 8 }} accessibilityRole="alert">
              {p.stillPending}
            </T>
          ) : null}
        </Card>

        {productPreviewAvailable() ? (
          <Pressable testID="pending-tour" onPress={() => openProductPreview()} accessibilityRole="button" accessibilityLabel={p.preview}>
            {({ pressed }) => (
              <Card kind="solid" padding={16} style={{ opacity: pressed ? 0.85 : 1 }}>
                <Row gap={14}>
                  <View style={styles.tourIcon}>
                    <Icon name="sparkle" size={22} color={colors.goldLight} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T v="body16" color={colors.ivory}>
                      {p.preview}
                    </T>
                    <T v="meta13" color={colors.ivory55}>
                      {p.previewBody}
                    </T>
                  </View>
                  <Icon name="chev" size={18} color={colors.ivory40} />
                </Row>
              </Card>
            )}
          </Pressable>
        ) : null}

        <View>
          <SectionLabel style={{ marginBottom: 8, paddingHorizontal: 4 }}>{p.unlocksTitle}</SectionLabel>
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
            {p.unlocks.map((u, i, arr) => (
              <ListRow
                key={u.title}
                leading={<Icon name={u.icon} size={22} color={colors.goldLight} />}
                title={u.title}
                sub={u.body}
                trailing={<Icon name="lock" size={16} color={colors.ivory40} />}
                chevron={false}
                last={i === arr.length - 1}
              />
            ))}
          </Card>
        </View>

        <View>
          <SectionLabel style={{ marginBottom: 8, paddingHorizontal: 4 }}>{p.account}</SectionLabel>
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
            <ListRow leading={<Icon name="mail" size={22} color={colors.goldLight} />} title={email} chevron={false} />
            <ListRow testID="pending-signout" leading={<Icon name="signout" size={22} color={colors.goldLight} />} title={p.signOut} onPress={() => void signOut()} chevron={false} />
            <ListRow
              testID="pending-delete"
              leading={<Icon name="warning" size={22} color={colors.goldLight} />}
              title={deleting ? `${p.deleteAccount}...` : p.deleteAccount}
              onPress={deleting ? undefined : confirmDelete}
              chevron={false}
              last
            />
          </Card>
        </View>
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { overflow: "hidden", height: 380 },
  top: { position: "absolute", left: 24, right: 20, justifyContent: "space-between" },
  headline: { position: "absolute", left: 24, right: 24, bottom: 22 },
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: "rgba(13,17,23,0.45)",
  },
  pillGem: { width: 6, height: 6, backgroundColor: colors.gold, transform: [{ rotate: "45deg" }] },
  tourIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(201,169,110,0.12)" },
});

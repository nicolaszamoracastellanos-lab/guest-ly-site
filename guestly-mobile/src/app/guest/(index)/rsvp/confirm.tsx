// Confirmation, the guest's peak moment (build 12, prototype M5).
//
// The toast photo edge to edge behind the status bar, about 30% of the window
// (176 to 240 pt) so the actions are on screen without scrolling (I6, I7).
// A gold check lands with a soft spring and a success haptic, only here, once
// the reply has been saved (S16). "You're on the list, Whitney." Then the
// paper summary (who goes to what, the couple's questions with the meal, the
// note), "Add to calendar" (primary) and "Change reply". On a short phone or
// with a long summary the actions go above the summary. Last, the soft
// notification ask, moved here from onboarding (N24, B7): "Yes, remind me"
// turns them on in place; "Not now" is remembered and points to Info.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { ZoomIn, useReducedMotion } from "react-native-reanimated";
import { fmt, useCopy, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { useGuestSession, useSession } from "@/lib/session";
import { useGuestRsvp, useGuestSchedule } from "@/lib/hooks";
import { Screen, T, Card, Button, Row, Stack, Icon, IconButton, PhotoHero } from "@/ui";
import { colors, fonts } from "@/ui/tokens";
import { useSafeBack } from "@/lib/nav";
import { answerRows, bi } from "@/features/guest/rsvp";
import { openUrlSafe } from "@/features/guest/links";
import { joinTitles } from "@/features/guest/format";
import { GUEST_COPY } from "@/features/guest/copy";
import { useNotifLater } from "@/features/guest/state";
import { enableGuestNotifications } from "@/features/guest/notifications";

const photo = require("../../../../assets/photos/toast.jpg");
const PAPER_GREEN = "#03694c";
const PAPER_LINE = "rgba(20,17,12,0.1)";

export default function RsvpConfirm() {
  const copy = useCopy();
  const g = useFeatureCopy(GUEST_COPY);
  const { lang } = useLang();
  const router = useRouter();
  const navigation = useNavigation();
  const back = useSafeBack();
  const session = useGuestSession();
  const { pushToken, setPushToken } = useSession();
  const reduced = useReducedMotion();
  const { status: statusParam } = useLocalSearchParams<{ status?: string }>();
  const { data } = useGuestRsvp();
  const { data: schedule } = useGuestSchedule();
  const { later, setLater } = useNotifLater();
  const [notifBusy, setNotifBusy] = useState(false);
  const [justOn, setJustOn] = useState(false);
  const payload = data?.payload;
  const first = session?.guest.name.split(" ")[0] ?? "";
  const couple = session?.tenant.couple_names ?? "";
  const status = statusParam ?? data?.summary.status;
  const declined = status === "declined";
  const roster = payload?.existing?.companions?.length
    ? payload.existing.companions
    : [{ name: payload?.displayName ?? "", attending: !declined, events: payload?.existing?.answers ?? {} }];
  // Never an internal event id on the card: a title in either language, or nothing.
  const eventIds = (payload?.events ?? []).map((e) => e.id);
  const eventTitle = (id: string) => bi(payload?.events.find((e) => e.id === id)?.title, lang);
  const rows = answerRows(payload?.questions ?? [], payload?.existing?.questionAnswers, lang);
  const note = payload?.existing?.notes?.trim() || null;

  // The success haptic once, as the check lands.
  const buzzed = useRef(false);
  useEffect(() => {
    if (buzzed.current) return;
    buzzed.current = true;
    const t = setTimeout(() => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), reduced ? 0 : 260);
    return () => clearTimeout(t);
  }, [reduced]);

  // One calendar with every event when the portal offers it; a single dated
  // event can use its own link; several without an "all" link go to the
  // schedule, where each has its own button.
  const invitedDated = (schedule?.events ?? []).filter((e) => e.invited && e.date);
  const allUrl = (schedule as { ics_all_url?: string | null } | undefined)?.ics_all_url ?? (invitedDated.length === 1 ? invitedDated[0].ics_url : null);
  const addToCalendar = () => (allUrl ? openUrlSafe(allUrl, copy.common.linkFailed) : router.navigate("/guest/schedule"));

  // Leaving: take the RSVP stack back to the form first, so the next visit
  // opens the form and not this card.
  const leave = useCallback(() => {
    if (router.canDismiss()) router.dismissAll();
    router.navigate("/guest");
  }, [router]);
  // The same when the guest leaves through the tab bar instead of Done.
  useFocusEffect(
    useCallback(() => {
      return () => {
        try {
          const nav = navigation as unknown as { getState?: () => { index?: number } | undefined; popToTop?: () => void };
          if ((nav.getState?.()?.index ?? 0) > 0) nav.popToTop?.();
        } catch {
          // The stack is already gone (signed out): nothing to reset.
        }
      };
    }, [navigation])
  );

  async function turnOn() {
    if (notifBusy) return;
    setNotifBusy(true);
    const r = await enableGuestNotifications(copy, (t) => setPushToken(t));
    setNotifBusy(false);
    if (r === "on") setJustOn(true);
    else if (r === "declined") setLater();
  }

  const { height: windowH } = useWindowDimensions();
  const heroH = Math.round(Math.min(240, Math.max(176, windowH * 0.3)));
  // A short phone or a long summary: the actions go first (I7).
  const actionsFirst = windowH < 720 || roster.length + rows.length > 2;

  const actions = (
    <Stack gap={10}>
      {declined ? null : <Button testID="confirm-calendar" label={g.confirm.addCalendar} icon="calendar-plus" onPress={addToCalendar} disabled={!schedule} />}
      <Button testID="confirm-change" label={g.confirm.changeReply} kind="ghost" onPress={() => back()} />
    </Stack>
  );

  const summary = (
    <Card kind="paper" padding={16} style={{ paddingBottom: 4 }}>
      <T v="label11" color={colors.muted}>
        {g.confirm.yourReply}
      </T>
      {roster.map((p, i) => {
        const yes = Object.entries(p.events ?? {})
          .filter(([, v]) => v === "attending")
          .map(([k]) => k);
        const attending = yes.length > 0 || (p.attending && !p.events);
        const you = i === 0;
        const all = attending && eventIds.length > 0 && eventIds.every((id) => yes.includes(id));
        const sub = !attending
          ? you ? g.confirm.youCantGo : g.confirm.otherCantGo
          : all || !yes.length
            ? you ? g.confirm.youEverything : g.confirm.otherEverything
            : fmt(you ? g.confirm.youGoingTo : g.confirm.otherGoingTo, { events: joinTitles(yes.map(eventTitle), g.confirm.and).replace(/^./, (ch) => ch.toLowerCase()) });
        const name = p.name || (you ? payload?.displayName : "") || fmt(copy.rsvp.guestN, { n: i + 1 });
        return (
          <Row key={i} gap={12} align="flex-start" style={[styles.sumRow, i > 0 && styles.sumLine]}>
            <View style={[styles.sumIcon, !attending && { backgroundColor: colors.muted }]}>
              <Icon name={attending ? "check" : "x"} size={16} color={colors.cream} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <T v="body15" color={colors.ink} style={{ fontFamily: fonts.bodyMedium }}>
                {name}
              </T>
              <T v="meta13" color={colors.muted}>
                {sub}
              </T>
            </View>
          </Row>
        );
      })}
      {/* One row per answered question (the meal among them), under its own label. */}
      {rows.map((r) => (
        <View key={r.id} style={[styles.sumRow, styles.sumLine, { gap: 2 }]}>
          <T v="meta13" color={colors.muted}>
            {r.label}
          </T>
          <T v="body15" color={colors.ink}>
            {r.value}
          </T>
        </View>
      ))}
      {note ? (
        <View style={[styles.sumRow, styles.sumLine]}>
          <T v="meta13" color={colors.muted} italic>
            {`"${note}"`}
          </T>
        </View>
      ) : null}
    </Card>
  );

  const notifOn = !!pushToken;
  const notif = declined ? null : justOn ? (
    <Row gap={12} style={{ paddingHorizontal: 4 }}>
      <Icon name="bell" size={22} color={colors.goldLight} />
      <T v="body15" color={colors.ivory70} style={{ flex: 1 }}>
        {g.confirm.notifOn}
      </T>
    </Row>
  ) : notifOn ? null : later ? (
    <Row gap={12} style={{ paddingHorizontal: 4 }}>
      <Icon name="bell" size={22} color={colors.ivory55} />
      <T v="meta13" color={colors.ivory55} style={{ flex: 1 }}>
        {g.confirm.notifLater}
      </T>
    </Row>
  ) : (
    <Card kind="solid" padding={16}>
      <Row gap={12} align="flex-start">
        <Icon name="bell" size={24} color={colors.goldLight} />
        <T v="body15" style={{ flex: 1 }}>
          {g.confirm.notifAsk}
        </T>
      </Row>
      <Row gap={8} style={{ marginTop: 12 }}>
        <View style={{ flex: 1 }}>
          <Button testID="confirm-notif-yes" label={g.confirm.notifYes} kind="glass" small onPress={() => void turnOn()} loading={notifBusy} />
        </View>
        <View style={{ flex: 1 }}>
          <Button testID="confirm-notif-no" label={g.confirm.notifNo} kind="text" small onPress={setLater} />
        </View>
      </Row>
    </Card>
  );

  return (
    // Edge to edge: no header band, the photo starts at the top of the window.
    <Screen padded={false} topInset={false} backdrop={false} bottomInset={40}>
      <PhotoHero
        source={photo}
        focal={{ x: 0.5, y: 0.34 }}
        height={heroH}
        gradient={0.55}
        top={<IconButton name="x" onPress={leave} label={copy.common.close} style={{ marginLeft: -2 }} />}
      />
      <View style={styles.headline}>
        <Animated.View entering={reduced ? undefined : ZoomIn.springify().damping(13).stiffness(180)} style={styles.checkRing} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.check}>
            <Icon name="check" size={32} color={colors.ink} strokeWidth={2.2} />
          </View>
        </Animated.View>
        <T v="title42" size={windowH < 720 ? 32 : 38} style={{ marginTop: 12 }} accessibilityRole="header">
          {fmt(declined ? g.confirm.thanks : g.confirm.onTheList, { name: first })}
        </T>
        <T v="body15" color={colors.ivory70} style={{ marginTop: 6 }}>
          {fmt(declined ? g.confirm.willMiss : g.confirm.haveReply, { couple })}
        </T>
      </View>
      <Stack gap={16} style={{ paddingHorizontal: 16, marginTop: 20 }}>
        {actionsFirst ? actions : summary}
        {actionsFirst ? summary : actions}
        {notif}
        <Button label={copy.common.done} kind="text" onPress={leave} />
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The check overlaps the bottom of the photo, ringed in night.
  headline: { paddingHorizontal: 20, marginTop: -34 },
  checkRing: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.night, alignItems: "center", justifyContent: "center", marginLeft: -6 },
  check: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  sumRow: { paddingVertical: 12 },
  sumLine: { borderTopWidth: 1, borderTopColor: PAPER_LINE },
  sumIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: PAPER_GREEN, alignItems: "center", justifyContent: "center", marginTop: -1 },
});

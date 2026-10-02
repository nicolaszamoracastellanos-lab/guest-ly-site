// Confirmation: the one paper card on the guest side.
//
// v1.2 (I6, I7, I8): the toast photo runs edge to edge behind the status bar
// (it started under a solid header band that sliced the glasses), it is lower
// (about 30% of the window, at most 240 pt) and the screen is plain night, so
// the photo ends without a seam. "Add to calendar" and "Change answer" sit
// right under the headline when the summary is long or the phone is short, so
// they are on screen without scrolling, above the tab bar.

import React, { useCallback } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { fmt, useCopy, useLang } from "@/i18n";
import { useGuestSession } from "@/lib/session";
import { useGuestRsvp, useGuestSchedule } from "@/lib/hooks";
import { Screen, T, Card, Button, Row, Stack, Icon, IconButton, PhotoHero } from "@/ui";
import { colors } from "@/ui/tokens";
import { useSafeBack } from "@/lib/nav";
import { answerRows, bi } from "@/features/guest/rsvp";
import { openUrlSafe } from "@/features/guest/links";

const photo = require("../../../../assets/photos/toast.jpg");

export default function RsvpConfirm() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const navigation = useNavigation();
  const back = useSafeBack();
  const session = useGuestSession();
  const { status: statusParam } = useLocalSearchParams<{ status?: string }>();
  const { data } = useGuestRsvp();
  const { data: schedule } = useGuestSchedule();
  const payload = data?.payload;
  const first = session?.guest.name.split(" ")[0] ?? "";
  const status = statusParam ?? data?.summary.status;
  const declined = status === "declined";
  const roster = payload?.existing?.companions?.length
    ? payload.existing.companions
    : [{ name: payload?.displayName ?? "", attending: !declined, events: payload?.existing?.answers ?? {} }];
  // Never an internal event id on the card: a title in either language, or nothing.
  const eventTitle = (id: string) => bi(payload?.events.find((e) => e.id === id)?.title, lang);
  const rows = answerRows(payload?.questions ?? [], payload?.existing?.questionAnswers, lang);

  // One calendar with every event when the portal offers it; a single dated
  // event can use its own link; several without an "all" link go to the
  // schedule, where each has its own button.
  const invitedDated = (schedule?.events ?? []).filter((e) => e.invited && e.date);
  const allUrl = (schedule as { ics_all_url?: string | null } | undefined)?.ics_all_url ?? (invitedDated.length === 1 ? invitedDated[0].ics_url : null);
  const addToCalendar = () => (allUrl ? openUrlSafe(allUrl, copy.common.linkFailed) : router.navigate("/guest/schedule"));

  // Leaving: take the RSVP stack back to the form first, so the next visit to
  // the RSVP tab opens the form and not this card (REPLACE from a nested
  // stack only jumps tabs and left [form, confirm] behind).
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

  const { height: windowH } = useWindowDimensions();
  const heroH = Math.round(Math.min(240, Math.max(176, windowH * 0.3)));
  // A short phone or a long summary: the actions go first so they are on
  // screen without scrolling (I7).
  const actionsFirst = windowH < 760 || roster.length + rows.length > 2;

  const actions = (
    <Stack gap={10}>
      {declined ? null : <Button label={copy.rsvp.addCalendar} icon="calendar-plus" onPress={addToCalendar} disabled={!schedule} />}
      <Button label={copy.guestHome.changeAnswer} small kind="ghost" onPress={() => back()} />
    </Stack>
  );

  const summary = (
    <Card kind="paper" padding={18}>
      {roster.map((p, i) => {
        const attending = Object.values(p.events ?? {}).some((v) => v === "attending") || (p.attending && !p.events);
        const evs = Object.entries(p.events ?? {})
          .filter(([, v]) => v === "attending")
          .map(([k]) => eventTitle(k))
          .filter(Boolean)
          .join(" · ");
        const name = p.name || (i === 0 ? payload?.displayName : "") || fmt(copy.rsvp.guestN, { n: i + 1 });
        return (
          <Row key={i} style={[styles.paperRow, i === roster.length - 1 && !rows.length && { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
              <T v="body16" color={colors.ink}>
                {name}
              </T>
              <T v="meta13" color={colors.muted}>
                {evs || copy.rsvp.declined}
              </T>
            </View>
            <View style={[styles.pill, { backgroundColor: attending ? "rgba(5,150,105,0.1)" : "rgba(20,17,12,0.06)", borderColor: attending ? "rgba(5,150,105,0.3)" : colors.border }]}>
              <T v="label11" color={attending ? "#047857" : colors.muted} style={{ letterSpacing: 1 }}>
                {attending ? copy.rsvp.attending : copy.rsvp.declined}
              </T>
            </View>
          </Row>
        );
      })}
      {/* One row per answered question, under its own label. */}
      {rows.map((r, i) => (
        <View key={r.id} style={[styles.answerRow, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
          <T v="meta13" color={colors.muted}>
            {r.label}
          </T>
          <T v="body15" color={colors.ink}>
            {r.value}
          </T>
        </View>
      ))}
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
        <View style={styles.checkRing}>
          <View style={styles.check}>
            <Icon name="check" size={26} color={colors.night} strokeWidth={2} />
          </View>
        </View>
        <T v="title42" style={{ marginTop: 12 }} accessibilityRole="header">
          {fmt(declined ? copy.rsvp.declinedTitle : copy.rsvp.onTheList, { name: first })}
        </T>
        <T v="body15" color="rgba(247,243,236,0.8)" style={{ marginTop: 8 }}>
          {/* No confirmation email is sent to guests, so the card never claims one. */}
          {fmt(copy.rsvp.confirmBodyNoEmail, { couple: session?.tenant.couple_names ?? "" })}
        </T>
      </View>
      <Stack gap={14} style={{ paddingHorizontal: 20, marginTop: 20 }}>
        {actionsFirst ? actions : summary}
        {actionsFirst ? summary : actions}
        <Button label={copy.common.done} kind="text" onPress={leave} />
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The check overlaps the bottom of the photo, ringed in night.
  headline: { paddingHorizontal: 24, marginTop: -34 },
  checkRing: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.night, alignItems: "center", justifyContent: "center", marginLeft: -4 },
  check: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  paperRow: { minHeight: 52, justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8 },
  answerRow: { minHeight: 48, justifyContent: "center", gap: 2, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8 },
  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
});

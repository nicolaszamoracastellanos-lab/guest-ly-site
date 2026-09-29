// Confirmation: the one paper card on the guest side.

import React, { useCallback } from "react";
import { View, StyleSheet, Image } from "react-native";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { fmt, useCopy, useLang } from "@/i18n";
import { useGuestSession } from "@/lib/session";
import { useGuestRsvp, useGuestSchedule } from "@/lib/hooks";
import { Screen, TopBar, T, Card, Button, Row, Stack, Icon, SectionLabel } from "@/ui";
import { colors, FILL, COVER } from "@/ui/tokens";
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

  return (
    <Screen padded={false} bottomInset={40} header={<TopBar onBack={leave} title={copy.guestHome.tabs.rsvp} />}>
      <View style={styles.hero}>
        {/* COVER wrapper: the hero has padding (see tokens.ts). */}
        <View style={COVER}>
          <Image source={photo} style={FILL} resizeMode="cover" />
        {/* Darker behind the headline: it sat on the brightest part of the photo (D-036). */}
        <LinearGradient colors={["rgba(8,11,16,0.62)", "rgba(8,11,16,0.5)", "rgba(13,17,23,0.7)", colors.night]} locations={[0, 0.35, 0.65, 1]} style={COVER} />
        </View>
        <View style={styles.headline}>
          <View style={styles.check}>
            <Icon name="check" size={26} color={colors.night} strokeWidth={2} />
          </View>
          <T v="title42" style={{ marginTop: 14 }} accessibilityRole="header">
            {fmt(declined ? copy.rsvp.declinedTitle : copy.rsvp.onTheList, { name: first })}
          </T>
          <T v="body15" color="rgba(247,243,236,0.8)" style={{ marginTop: 8 }}>
            {/* No confirmation email is sent to guests, so the card never claims one. */}
            {fmt(copy.rsvp.confirmBodyNoEmail, { couple: session?.tenant.couple_names ?? "" })}
          </T>
        </View>
      </View>
      <View style={{ paddingHorizontal: 20, marginTop: -30 }}>
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
        <Card kind="solid" padding={16} style={{ marginTop: 14 }}>
          {declined ? null : (
            <>
              <SectionLabel color={colors.goldLight}>{copy.rsvp.nextLabel}</SectionLabel>
              <T v="body16" style={{ marginTop: 6 }}>
                {copy.rsvp.addCalendarBody}
              </T>
            </>
          )}
          {/* Stacked: side by side both Spanish labels were cut with an ellipsis (D-006). */}
          <Stack gap={8} style={{ marginTop: declined ? 0 : 12 }}>
            {declined ? null : <Button label={copy.rsvp.addCalendar} small icon="calendar-plus" onPress={addToCalendar} disabled={!schedule} />}
            <Button label={copy.guestHome.changeAnswer} small kind="ghost" onPress={() => back()} />
          </Stack>
        </Card>
        <Stack style={{ marginTop: 20 }}>
          <Button label={copy.common.done} kind="text" onPress={leave} />
        </Stack>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { overflow: "hidden", minHeight: 360, paddingTop: 40, paddingBottom: 64 },
  headline: { paddingHorizontal: 24 },
  check: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  paperRow: { minHeight: 52, justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8 },
  answerRow: { minHeight: 48, justifyContent: "center", gap: 2, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8 },
  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
});

// Confirmation: the one paper card on the guest side.

import React from "react";
import { View, StyleSheet, Image, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { fmt, useCopy, useLang } from "@/i18n";
import { useGuestSession } from "@/lib/session";
import { useGuestRsvp, useGuestSchedule } from "@/lib/hooks";
import { Screen, TopBar, T, Card, Button, Row, Stack, Icon, SectionLabel } from "@/ui";
import { colors } from "@/ui/tokens";

const photo = require("../../../../assets/photos/toast.jpg");

export default function RsvpConfirm() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const session = useGuestSession();
  const { status, hasContact } = useLocalSearchParams<{ status?: string; hasContact?: string }>();
  const { data } = useGuestRsvp();
  const { data: schedule } = useGuestSchedule();
  const payload = data?.payload;
  const first = session?.guest.name.split(" ")[0] ?? "";
  const declined = status === "declined";
  const roster = payload?.existing?.companions?.length
    ? payload.existing.companions
    : [{ name: payload?.displayName ?? "", attending: !declined, events: payload?.existing?.answers ?? {} }];
  const eventTitle = (id: string) => payload?.events.find((e) => e.id === id)?.title[lang] ?? id;
  const dietary = Object.values(payload?.existing?.questionAnswers ?? {}).filter(Boolean).join(", ");
  const ics = schedule?.events.find((e) => e.invited)?.ics_url;

  return (
    <Screen padded={false} bottomInset={40} header={<TopBar onBack={() => router.replace("/guest")} title={copy.guestHome.tabs.rsvp} />}>
      <View style={styles.hero}>
        <Image source={photo} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient colors={["rgba(8,11,16,0.28)", "rgba(8,11,16,0.06)", "rgba(13,17,23,0.55)", colors.night]} locations={[0, 0.28, 0.6, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.headline}>
          <View style={styles.check}>
            <Icon name="check" size={26} color={colors.night} strokeWidth={2} />
          </View>
          <T v="title42" style={{ marginTop: 14 }}>
            {fmt(declined ? copy.rsvp.declinedTitle : copy.rsvp.onTheList, { name: first })}
          </T>
          <T v="body15" color="rgba(247,243,236,0.8)" style={{ marginTop: 8 }}>
            {fmt(hasContact === "1" ? copy.rsvp.confirmBody : copy.rsvp.confirmBodyNoEmail, { couple: session?.tenant.couple_names ?? "" })}
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
              .join(" · ");
            return (
              <Row key={i} style={[styles.paperRow, i === roster.length - 1 && !dietary && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <T v="body16" color={colors.ink}>
                    {p.name ?? ""}
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
          {dietary ? (
            <Row style={{ minHeight: 48, justifyContent: "space-between" }}>
              <T v="meta13" size={14} color={colors.muted}>
                {copy.rsvp.dietary}
              </T>
              <T v="body15" color={colors.ink}>
                {dietary}
              </T>
            </Row>
          ) : null}
        </Card>
        <Card kind="solid" padding={16} style={{ marginTop: 14 }}>
          <SectionLabel color={colors.goldLight}>{copy.rsvp.nextLabel}</SectionLabel>
          <T v="body16" style={{ marginTop: 6 }}>
            {copy.rsvp.addCalendarBody}
          </T>
          <Row gap={8} style={{ marginTop: 12 }}>
            <View style={{ flex: 1.25 }}>
              <Button label={copy.rsvp.addCalendar} small icon="calendar-plus" onPress={() => ics && Linking.openURL(ics)} disabled={!ics} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={copy.guestHome.changeAnswer} small kind="ghost" onPress={() => router.back()} />
            </View>
          </Row>
        </Card>
        <Stack style={{ marginTop: 20 }}>
          <Button label={copy.common.done} kind="text" onPress={() => router.replace("/guest")} />
        </Stack>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { height: 430 },
  headline: { position: "absolute", left: 24, right: 24, top: 60 },
  check: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  paperRow: { minHeight: 52, justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8 },
  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
});

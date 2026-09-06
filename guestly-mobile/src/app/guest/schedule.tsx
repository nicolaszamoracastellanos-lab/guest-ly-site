// The day: a timeline of every event the guest is invited to, with one
// calendar link per event (ICS from the portal).

import React from "react";
import { View, StyleSheet, Image, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useCopy, useLang, longDate } from "@/i18n";
import { useGuestSchedule } from "@/lib/hooks";
import { useGuestSession } from "@/lib/session";
import { Screen, T, Row, Gem, IconButton, Stack, Skeleton, SectionLabel } from "@/ui";
import { colors } from "@/ui/tokens";

const photo = require("../../../assets/photos/ceremony.jpg");

export default function GuestSchedule() {
  const copy = useCopy();
  const { lang } = useLang();
  const session = useGuestSession();
  const { data, isLoading } = useGuestSchedule();
  const events = data?.events ?? [];

  return (
    <Screen padded={false}>
      <View style={styles.hero}>
        <Image source={photo} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient colors={["rgba(8,11,16,0.55)", "rgba(8,11,16,0.05)", "rgba(13,17,23,0.6)", colors.night]} locations={[0, 0.3, 0.7, 1]} style={StyleSheet.absoluteFill} />
        <Row style={styles.top}>
          <Row gap={8}>
            <Gem />
            <T v="label11" color="rgba(247,243,236,0.85)" style={{ letterSpacing: 2 }}>
              {longDate(data?.wedding_date ?? session?.tenant.wedding_date, lang)}
            </T>
          </Row>
          {events.length ? <IconButton name="calendar-plus" onPress={() => Linking.openURL(events[0].ics_url)} label={copy.schedule.addAll} /> : null}
        </Row>
        <View style={styles.title}>
          <T v="title42">{copy.schedule.title}</T>
          <T v="body15" color={colors.ivory55}>
            {copy.schedule.intro}
          </T>
        </View>
      </View>
      <View style={{ paddingHorizontal: 20, marginTop: -16 }}>
        {isLoading && !data ? (
          <Stack gap={14}>
            <Skeleton h={80} />
            <Skeleton h={80} />
            <Skeleton h={80} />
          </Stack>
        ) : null}
        {events.map((e, i) => (
          <Row key={e.id} gap={16} align="flex-start">
            <View style={{ width: 56, alignItems: "flex-end", paddingTop: 2 }}>
              <T v="title26" size={22} color={colors.goldLight}>
                {clockLabel(e.time)}
              </T>
            </View>
            <View style={{ width: 12, alignItems: "center", alignSelf: "stretch" }}>
              <View style={{ marginTop: 8 }}>
                <Gem size={8} />
              </View>
              <View style={{ flex: 1, width: 1, backgroundColor: i === events.length - 1 ? "transparent" : colors.ivory09, marginTop: 6 }} />
            </View>
            <View style={{ flex: 1, paddingBottom: 22, gap: 2 }}>
              <T v="body16" size={17}>
                {e.title}
              </T>
              {e.location ? (
                <T v="meta13" color={colors.ivory55} onPress={() => e.maps_url && Linking.openURL(e.maps_url)}>
                  {e.location}
                </T>
              ) : null}
              {e.notes || e.address_note ? (
                <T v="meta13" size={14} color={colors.ivory70} style={{ marginTop: 4 }}>
                  {e.notes ?? e.address_note}
                </T>
              ) : null}
              {e.dress_code ? (
                <T v="meta13" size={14} color={colors.ivory70}>
                  {e.dress_code}
                </T>
              ) : null}
              <Row gap={16} style={{ marginTop: 8 }}>
                <T v="meta13" size={14} color={colors.goldLight} onPress={() => Linking.openURL(e.ics_url)}>
                  {copy.rsvp.addCalendar}
                </T>
                {e.maps_url ? (
                  <T v="meta13" size={14} color={colors.goldLight} onPress={() => Linking.openURL(e.maps_url!)}>
                    {copy.dayof.openMaps}
                  </T>
                ) : null}
              </Row>
            </View>
          </Row>
        ))}
        {data?.arrival_advice ? (
          <Stack gap={6} style={{ marginTop: 8 }}>
            <SectionLabel>{copy.schedule.arrive}</SectionLabel>
            <T v="body15" color={colors.ivory70}>
              {data.arrival_advice}
            </T>
          </Stack>
        ) : null}
      </View>
    </Screen>
  );
}

/** "4:00 pm" to "4:00"; "16:30" stays. Unknown stays as written. */
export function clockLabel(time: string | null): string {
  if (!time) return "";
  const m = time.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!m) return time;
  return `${m[1]}:${m[2] ?? "00"}`;
}

const styles = StyleSheet.create({
  hero: { height: 330 },
  top: { position: "absolute", left: 24, right: 20, top: 54, justifyContent: "space-between" },
  title: { position: "absolute", left: 24, right: 24, top: 196, gap: 6 },
});

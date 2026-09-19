// The day: a timeline of every event the guest is invited to, with one
// calendar link per event (ICS from the portal).

import React from "react";
import { View, StyleSheet, Image, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useCopy, useLang, longDate } from "@/i18n";
import { useGuestSchedule } from "@/lib/hooks";
import { useGuestSession } from "@/lib/session";
import { Screen, T, Row, Gem, IconButton, Stack, Skeleton, SectionLabel, useTopInset, Button } from "@/ui";
import { colors, FILL } from "@/ui/tokens";

const photo = require("../../../assets/photos/ceremony.jpg");

export default function GuestSchedule() {
  const copy = useCopy();
  const { lang } = useLang();
  const session = useGuestSession();
  const top = useTopInset();
  const mainQuery = useGuestSchedule();
  const { data, isLoading } = mainQuery;
  const events = data?.events ?? [];

  return (
    <Screen query={mainQuery} padded={false} topInset={false}>
      {/* Flow layout: the title block pushes the hero taller instead of sitting at
          a fixed offset where large text ran into the first event (D-016, D-031).
          The scrim is darker behind the title, which sat on the brightest part of
          the photo (D-036). */}
      <View style={[styles.hero, { paddingTop: top + 64 }]}>
        <Image source={photo} style={FILL} resizeMode="cover" />
        <LinearGradient colors={["rgba(8,11,16,0.6)", "rgba(8,11,16,0.2)", "rgba(13,17,23,0.78)", colors.night]} locations={[0, 0.28, 0.62, 1]} style={FILL} />
        <Row style={[styles.top, { top }]}>
          <Row gap={8} align="flex-start" style={{ flex: 1, minWidth: 0 }}>
            <View style={{ marginTop: 4 }}>
              <Gem />
            </View>
            <T v="label11" color="rgba(247,243,236,0.85)" numberOfLines={2} style={{ letterSpacing: 2, flexShrink: 1 }}>
              {longDate(data?.wedding_date ?? session?.tenant.wedding_date, lang)}
            </T>
          </Row>
          {events.length ? <IconButton name="calendar-plus" onPress={() => Linking.openURL(events[0].ics_url)} label={copy.schedule.addAll} /> : null}
        </Row>
        <View style={styles.title}>
          <T v="title42">{copy.schedule.title}</T>
          <T v="body15" color={colors.ivory70}>
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
            <View style={{ width: 62, alignItems: "flex-end", paddingTop: 2 }}>
              <T v="title26" size={22} color={colors.goldLight} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
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
                <T v="meta13" color={colors.ivory70} style={{ marginTop: 4 }}>
                  {e.notes ?? e.address_note}
                </T>
              ) : null}
              {e.dress_code ? (
                <T v="meta13" color={colors.ivory70}>
                  {e.dress_code}
                </T>
              ) : null}
              {/* 44 pt buttons, not 20 pt text links (D-024). */}
              <Row gap={4} style={{ marginTop: 2, flexWrap: "wrap", marginLeft: -8 }}>
                <Button label={copy.rsvp.addCalendar} kind="text" small full={false} haptic={false} onPress={() => Linking.openURL(e.ics_url)} />
                {e.maps_url ? <Button label={copy.dayof.openMaps} kind="text" small full={false} haptic={false} onPress={() => Linking.openURL(e.maps_url!)} /> : null}
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
  hero: { overflow: "hidden", minHeight: 330, paddingBottom: 40, justifyContent: "flex-end" },
  top: { position: "absolute", left: 24, right: 14, gap: 8, justifyContent: "space-between", alignItems: "flex-start" },
  title: { paddingHorizontal: 24, gap: 6 },
});

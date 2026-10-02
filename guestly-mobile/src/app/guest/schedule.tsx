// The day: a timeline of every event the guest is invited to, with one
// calendar link per event (ICS from the portal).

import React from "react";
import { View, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useCopy, useLang, longDate } from "@/i18n";
import { useGuestSchedule, type ScheduleEvent } from "@/lib/hooks";
import { useGuestSession } from "@/lib/session";
import { Screen, ScreenBannerSlot, T, Row, Gem, IconButton, Stack, Skeleton, SectionLabel, useTopInset, Button } from "@/ui";
import { colors, FILL, COVER } from "@/ui/tokens";
import { clockLabel } from "@/features/guest/format";
import { openMaps, openUrlSafe } from "@/features/guest/links";

// Fields the portal may add (guest-authorised calendar links, an ISO start).
// Read tolerantly so the screen works before and after that deploy.
type ScheduleData = { events: ScheduleEvent[]; ics_all_url?: string | null };

const photo = require("../../../assets/photos/ceremony.jpg");

export default function GuestSchedule() {
  const copy = useCopy();
  const { lang } = useLang();
  const session = useGuestSession();
  const top = useTopInset();
  const mainQuery = useGuestSchedule();
  const { data, isLoading } = mainQuery;
  const events = data?.events ?? [];
  // "Add all" must add all: one calendar with every dated event. Until the
  // portal sends that link, a single dated event can use its own; otherwise
  // the button stays hidden rather than adding only the first event.
  const dated = events.filter((e) => e.date);
  const allUrl = (data as ScheduleData | undefined)?.ics_all_url ?? (dated.length === 1 ? dated[0].ics_url : null);
  // Events on more than one day get a date line above each new day.
  const multiDay = new Set(dated.map((e) => e.date!.slice(0, 10))).size > 1;
  const failLink = copy.common.linkFailed;

  return (
    // backdrop={false}: plain night behind the photo. Its gradient ends in night;
    // over the lighter backdrop image that end showed as a straight line across
    // the first event (I8).
    <Screen query={mainQuery} padded={false} topInset={false} backdrop={false} refresh>
      {/* Flow layout: the title block pushes the hero taller instead of sitting at
          a fixed offset where large text ran into the first event (D-016, D-031).
          The scrim is darker behind the title, which sat on the brightest part of
          the photo (D-036). */}
      <View style={[styles.hero, { paddingTop: top + 64 }]}>
        {/* COVER, not FILL, on the wrapper: the hero has padding, and FILL's percent
            sizes stop short of a padded parent's edge (see tokens.ts). */}
        <View style={COVER}>
          <Image source={photo} style={FILL} resizeMode="cover" />
          <LinearGradient colors={["rgba(8,11,16,0.6)", "rgba(8,11,16,0.2)", "rgba(13,17,23,0.78)", colors.night]} locations={[0, 0.28, 0.62, 1]} style={COVER} />
        </View>
        <Row style={[styles.top, { top }]}>
          <Row gap={8} align="flex-start" style={{ flex: 1, minWidth: 0 }}>
            <View style={{ marginTop: 4 }}>
              <Gem />
            </View>
            <T v="label11" color="rgba(247,243,236,0.85)" numberOfLines={2} style={{ letterSpacing: 2, flexShrink: 1 }}>
              {longDate(data?.wedding_date ?? session?.tenant.wedding_date, lang)}
            </T>
          </Row>
          {allUrl ? <IconButton name="calendar-plus" onPress={() => openUrlSafe(allUrl, failLink)} label={copy.schedule.addAll} /> : null}
        </Row>
        <View style={styles.title}>
          <T v="title42">{copy.schedule.title}</T>
          <T v="body15" color={colors.ivory70}>
            {copy.schedule.intro}
          </T>
        </View>
      </View>
      <View style={{ paddingHorizontal: 20, marginTop: -16 }}>
        {/* The connection banner goes under the photo, not above it. */}
        <ScreenBannerSlot />
        {isLoading && !data ? (
          <Stack gap={14}>
            <Skeleton h={80} />
            <Skeleton h={80} />
            <Skeleton h={80} />
          </Stack>
        ) : null}
        {events.map((e, i) => {
          const day = e.date?.slice(0, 10) ?? null;
          const newDay = multiDay && day && day !== events[i - 1]?.date?.slice(0, 10);
          return (
          <View key={e.id}>
          {newDay ? (
            <SectionLabel color={colors.goldLight} style={{ marginBottom: 12, marginTop: i === 0 ? 0 : 4 }}>
              {longDate(day, lang)}
            </SectionLabel>
          ) : null}
          <Row gap={16} align="flex-start">
            {/* English times carry am/pm, so the column is wider than the
                24-hour Spanish one. */}
            <View style={{ width: lang === "en" ? 78 : 62, alignItems: "flex-end", paddingTop: 2 }}>
              <T v="title26" size={22} color={colors.goldLight} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {clockLabel(e.start_minutes, e.time, lang)}
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
                <T v="meta13" color={colors.ivory55} onPress={e.maps_url ? () => openMaps(e.maps_url, failLink) : undefined}>
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
                {/* A dateless event has no calendar entry to make. */}
                {e.date && e.ics_url ? <Button label={copy.rsvp.addCalendar} kind="text" small full={false} haptic={false} onPress={() => openUrlSafe(e.ics_url, failLink)} /> : null}
                {e.maps_url ? <Button label={copy.dayof.openMaps} kind="text" small full={false} haptic={false} onPress={() => openMaps(e.maps_url, failLink)} /> : null}
              </Row>
            </View>
          </Row>
          </View>
          );
        })}
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

const styles = StyleSheet.create({
  hero: { overflow: "hidden", minHeight: 330, paddingBottom: 40, justifyContent: "flex-end" },
  top: { position: "absolute", left: 24, right: 14, gap: 8, justifyContent: "space-between", alignItems: "flex-start" },
  title: { paddingHorizontal: 24, gap: 6 },
});

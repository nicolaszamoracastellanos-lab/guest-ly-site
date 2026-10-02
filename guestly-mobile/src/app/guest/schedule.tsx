// Schedule tab (build 12, prototype G.schedule).
//
// The ceremony photo with the date and "Schedule", then every event as a row
// (time, name, place, dress code). An event the guest said no to reads "You
// are not going to this one". A row opens its sheet: Open in Maps and Add to
// calendar for that event. Under the list, "Add it all to your calendar" (the
// portal's all-events calendar, with the day-before reminder, B8), then
// arrival advice and the dress code.

import React, { useState } from "react";
import { View, StyleSheet, Pressable, useWindowDimensions } from "react-native";
import { useCopy, useLang, longDate } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { useGuestHome, useGuestSchedule, type ScheduleEvent } from "@/lib/hooks";
import { useGuestSession } from "@/lib/session";
import { Screen, ScreenBannerSlot, T, Row, Stack, Skeleton, SectionLabel, Button, Card, ListRow, Icon, Sheet, PhotoHero } from "@/ui";
import { colors, fonts } from "@/ui/tokens";
import { clockLabel } from "@/features/guest/format";
import { openMaps, openUrlSafe } from "@/features/guest/links";
import { DressCodeSheet } from "@/features/guest/DressCodeSheet";
import { DirectionsSheet } from "@/features/guest/sheets";
import { GUEST_COPY } from "@/features/guest/copy";

// Fields the portal may add (guest-authorised calendar links). Read
// tolerantly so the screen works before and after that deploy.
type ScheduleData = { events: ScheduleEvent[]; ics_all_url?: string | null };

const photo = require("../../../assets/photos/ceremony.jpg");

export default function GuestSchedule() {
  const copy = useCopy();
  const g = useFeatureCopy(GUEST_COPY);
  const { lang } = useLang();
  const session = useGuestSession();
  const { height: windowH } = useWindowDimensions();
  const mainQuery = useGuestSchedule();
  const { data, isLoading } = mainQuery;
  const { data: home } = useGuestHome();
  const [open, setOpen] = useState<ScheduleEvent | null>(null);
  const [dressOpen, setDressOpen] = useState(false);
  const [dirOpen, setDirOpen] = useState(false);
  const events = data?.events ?? [];
  // "Add all" must add all: one calendar with every dated event. Until the
  // portal sends that link, a single dated event can use its own; otherwise
  // the button stays hidden rather than adding only the first event.
  const dated = events.filter((e) => e.date);
  const allUrl = (data as ScheduleData | undefined)?.ics_all_url ?? (dated.length === 1 ? dated[0].ics_url : null);
  // Events on more than one day get a date line above each new day.
  const multiDay = new Set(dated.map((e) => e.date!.slice(0, 10))).size > 1;
  const failLink = copy.common.linkFailed;
  const rsvp = home?.rsvp;
  const answered = !!rsvp && rsvp.status !== "pending";
  const skipped = (e: ScheduleEvent) => answered && rsvp?.answers?.[e.id] === "declined";
  const dress = home?.dress_code ?? events.find((e) => e.dress_code)?.dress_code ?? null;
  const heroH = Math.round(Math.max(220, windowH * 0.32));

  return (
    // backdrop={false}: plain night behind the photo, no seam (I8).
    <Screen query={mainQuery} padded={false} topInset={false} backdrop={false} refresh>
      <PhotoHero source={photo} focal={{ x: 0.5, y: 0.46 }} flow minHeight={heroH} gradient={0.6} flowTopSpace={40} bottomPadding={16}>
        <T v="label11" color="rgba(247,243,236,0.86)" numberOfLines={2}>
          {longDate(data?.wedding_date ?? session?.tenant.wedding_date, lang)}
        </T>
        <T v="title42" size={40} accessibilityRole="header" style={{ marginTop: 4 }}>
          {g.schedule.title}
        </T>
      </PhotoHero>
      <Stack gap={16} style={{ paddingHorizontal: 16, marginTop: 4 }}>
        {/* The connection banner goes under the photo, not above it. */}
        <ScreenBannerSlot />
        {isLoading && !data ? (
          <Stack gap={12}>
            <Skeleton h={64} />
            <Skeleton h={64} />
            <Skeleton h={64} />
          </Stack>
        ) : null}
        {data && !events.length ? (
          <T v="body15" color={colors.ivory70}>
            {g.schedule.empty}
          </T>
        ) : null}
        {events.length ? (
          <Card kind="solid" padding={4} style={{ paddingHorizontal: 0 }}>
            {events.map((e, i) => {
              const day = e.date?.slice(0, 10) ?? null;
              const newDay = multiDay && day && day !== events[i - 1]?.date?.slice(0, 10);
              const skip = skipped(e);
              const [hm, ampm] = splitClock(clockLabel(e.start_minutes, e.time, lang));
              return (
                <View key={e.id}>
                  {newDay ? (
                    <SectionLabel color={colors.goldLight} style={{ paddingHorizontal: 16, paddingTop: i === 0 ? 12 : 16, paddingBottom: 4 }}>
                      {longDate(day, lang)}
                    </SectionLabel>
                  ) : null}
                  <Pressable
                    testID={`schedule-row-${i}`}
                    onPress={() => setOpen(e)}
                    accessibilityRole="button"
                    accessibilityLabel={[clockLabel(e.start_minutes, e.time, lang), e.title, skip ? g.schedule.notGoing : e.location].filter(Boolean).join(". ")}
                    style={({ pressed }) => [styles.row, i > 0 && !newDay && styles.rowLine, pressed && { backgroundColor: colors.ivory09 }]}
                  >
                    <View style={styles.time}>
                      <T v="title26" size={24} color={skip ? colors.ivory55 : colors.ivory} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                        {hm}
                      </T>
                      {ampm ? (
                        <T v="meta13" color={colors.ivory70}>
                          {ampm}
                        </T>
                      ) : null}
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <T v="body16" color={skip ? colors.ivory55 : colors.ivory} style={{ fontFamily: fonts.bodyMedium }}>
                        {e.title}
                      </T>
                      {skip ? (
                        <T v="meta13" color={colors.ivory55}>
                          {g.schedule.notGoing}
                        </T>
                      ) : (
                        <>
                          {e.location ? (
                            <T v="meta13" color={colors.ivory70}>
                              {e.location}
                            </T>
                          ) : null}
                          {e.dress_code ? (
                            <Row gap={6}>
                              <Icon name="hanger" size={15} color={colors.goldLight} />
                              <T v="meta13" color={colors.ivory70} numberOfLines={1} style={{ flexShrink: 1 }}>
                                {e.dress_code}
                              </T>
                            </Row>
                          ) : null}
                        </>
                      )}
                    </View>
                    <Icon name="chev" size={18} color={colors.ivory55} />
                  </Pressable>
                </View>
              );
            })}
          </Card>
        ) : null}
        {allUrl ? (
          <Stack gap={8}>
            <Button testID="schedule-add-all" label={g.schedule.addAll} icon="calendar-plus" onPress={() => openUrlSafe(allUrl, failLink)} />
            <T v="meta13" color={colors.ivory55} center>
              {g.schedule.calendarNote}
            </T>
          </Stack>
        ) : null}
        {data?.arrival_advice || dress ? (
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
            {data?.arrival_advice ? <ListRow leading={<Icon name="bus" size={22} color={colors.goldLight} />} title={g.schedule.arrival} sub={data.arrival_advice} onPress={() => setDirOpen(true)} last={!dress} /> : null}
            {dress ? <ListRow leading={<Icon name="hanger" size={22} color={colors.goldLight} />} title={g.schedule.dressCode} sub={dress} onPress={() => setDressOpen(true)} last /> : null}
          </Card>
        ) : null}
      </Stack>
      <EventSheet event={open} onClose={() => setOpen(null)} onDress={() => {
          setOpen(null);
          // One sheet (a native modal) at a time: open the next once this one is gone.
          setTimeout(() => setDressOpen(true), 350);
        }} />
      <DressCodeSheet visible={dressOpen} onClose={() => setDressOpen(false)} />
      <DirectionsSheet visible={dirOpen} onClose={() => setDirOpen(false)} />
    </Screen>
  );
}

/** "5:00 pm" -> ["5:00", "pm"]; "17:00" -> ["17:00", ""]. */
function splitClock(label: string): [string, string] {
  const m = label.match(/^(\S+)\s*(am|pm|a\.\s?m\.|p\.\s?m\.)$/i);
  return m ? [m[1], m[2]] : [label, ""];
}

function EventSheet({ event, onClose, onDress }: { event: ScheduleEvent | null; onClose: () => void; onDress: () => void }) {
  const copy = useCopy();
  const g = useFeatureCopy(GUEST_COPY);
  const { lang } = useLang();
  const e = event;
  const fail = copy.common.linkFailed;
  return (
    <Sheet visible={!!e} onClose={onClose} top={260}>
      {e ? (
        <>
          <T v="label11" color={colors.goldLight}>
            {[e.date ? longDate(e.date, lang) : null, clockLabel(e.start_minutes, e.time, lang) || null].filter(Boolean).join(" · ")}
          </T>
          <T v="title30" style={{ marginTop: 4 }} accessibilityRole="header">
            {e.title}
          </T>
          {e.location ? (
            <T v="body15" color={colors.ivory70} style={{ marginTop: 4 }} selectable>
              {[e.location, e.address_note].filter(Boolean).join(", ")}
            </T>
          ) : null}
          {e.notes ? (
            <T v="body15" color={colors.ivory90} style={{ marginTop: 12 }}>
              {e.notes}
            </T>
          ) : null}
          {e.dress_code ? (
            <Card kind="paper" padding={16} style={{ marginTop: 16 }}>
              <T v="label11" color={colors.muted}>
                {g.schedule.dressCode}
              </T>
              <T v="body16" color={colors.ink} style={{ marginTop: 4 }}>
                {e.dress_code}
              </T>
              {/* Ink, never gold, on paper (plan c). */}
              <Pressable accessibilityRole="button" onPress={onDress} hitSlop={8} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, marginTop: 4 }, pressed && { opacity: 0.6 }]}>
                <T v="body15" color={colors.ink} style={{ textDecorationLine: "underline" }}>
                  {g.home.dressCode}
                </T>
                <Icon name="chev" size={16} color={colors.ink} />
              </Pressable>
            </Card>
          ) : null}
          <Stack gap={10} style={{ marginTop: 20 }}>
            {e.maps_url ? <Button label={g.directions.openMaps} icon="map" onPress={() => openMaps(e.maps_url, fail)} /> : null}
            {/* A dateless event has no calendar entry to make. */}
            {e.date && e.ics_url ? <Button label={g.schedule.addOne} icon="calendar-plus" kind="ghost" onPress={() => openUrlSafe(e.ics_url, fail)} /> : null}
          </Stack>
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 12, paddingHorizontal: 16 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.ivory09 },
  time: { width: 76 },
});

// Guest home: the invitation. Full-bleed photo, the names at 60px, the
// countdown as type, one glass card for the RSVP, four quick actions.
//
// v1.2:
// - The photo fits the phone (I5). It was 560 pt on every phone, so "Answer
//   now" sat half under the tab bar and the shortcuts were behind it; on a
//   667 pt iPhone SE the button was off screen. The photo now takes what is
//   left above the RSVP card and one row of shortcuts, measured, so both end
//   above the tab bar on every iPhone. On a short phone the countdown moves
//   into the date line and the names step down a size.
// - The couple's photo keeps its subject in view (focal point, I1) and is
//   cached under a stable key, with no stock photo flashing first (I17).
// - On the wedding day Home IS the day view (N1).
// - Dress code opens a sheet with the full text (N8).

import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmt, useCopy, useLang, longDate, shortDate, mediumDate } from "@/i18n";
import { useGuestSession } from "@/lib/session";
import { useGuestHome } from "@/lib/hooks";
import { useOnline } from "@/lib/query";
import { T, Card, Button, Badge, Countdown, ActionTile, Row, Gem, IconButton, Banner, Skeleton, Stack, SectionLabel, QueryError, OfflineState, StaleBanner, useQueryBlocked, retryConnection, useBottomClearance, COLUMN, StatusScrim, useScrimScroll, PhotoHero, type PhotoFocal } from "@/ui";
import { colors, TAB_BAR_BOTTOM, TAB_BAR_HEIGHT } from "@/ui/tokens";
import { splitNames } from "@/features/guest/format";
import { openMaps } from "@/features/guest/links";
import { GuestDayOfView } from "@/features/guest/DayOfView";
import { DressCodeSheet } from "@/features/guest/DressCodeSheet";

const fallback = require("../../../assets/photos/bluehour.jpg");

export default function GuestHome() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const session = useGuestSession();
  const { clearance } = useBottomClearance();
  const online = useOnline();
  const mainQuery = useGuestHome();
  const { data, isLoading, refetch } = mainQuery;
  // Pull to refresh. Its own flag, not isRefetching, so a background refetch
  // never shows the spinner.
  const [pulling, setPulling] = useState(false);
  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  }, [refetch]);

  const couple = data?.couple_names ?? session?.tenant.couple_names ?? "";
  const [n1, n2] = splitNames(couple);
  const hero = data?.hero_image_url ?? session?.tenant.hero_image_url ?? null;
  // Focal point of the couple's photo when the portal sends one (not yet: plan
  // f.4 is deferred). Read tolerantly; PhotoHero falls back to faces in the
  // upper third. The bundled photo keeps its table and lights in view.
  const extra = data as { hero_focal_x?: number | null; hero_focal_y?: number | null } | undefined;
  const focal: Partial<PhotoFocal> | null = hero ? { x: extra?.hero_focal_x ?? undefined, y: extra?.hero_focal_y ?? undefined } : { x: 0.5, y: 0.4 };
  const scrim = useScrimScroll();
  const failed = mainQuery.isError && !data;
  // Offline with nothing cached the query is paused, not failed: the RSVP card
  // would default to "Awaiting" for a guest who already answered (S1).
  const blocked = useQueryBlocked(mainQuery);
  const when = data?.wedding_date ?? session?.tenant.wedding_date ?? null;
  const city = data?.city ?? session?.tenant.city ?? "";
  const rsvp = data?.rsvp;
  const seats = rsvp ? (rsvp.max_party === 1 ? copy.guestHome.seatsOne : fmt(copy.guestHome.seatsMany, { n: rsvp.max_party })) : "";
  const deadline = rsvp?.deadline ? shortDate(rsvp.deadline, lang) : null;
  const name = data?.guest.name.split(" ")[0] ?? session?.guest.name.split(" ")[0] ?? "";
  const status = rsvp?.status ?? "pending";
  const rsvpText =
    status === "pending"
      ? fmt(deadline ? copy.guestHome.rsvpPrompt : copy.guestHome.rsvpPromptNoDeadline, { name, deadline, seats })
      : fmt(deadline ? copy.guestHome.rsvpDone : copy.guestHome.rsvpDoneNoDeadline, { deadline });
  const married = !!data?.countdown?.passed && !data.day_of;
  const directions = data?.quick_links.directions_url ?? null;
  const [dressOpen, setDressOpen] = useState(false);

  // Photo height (I5): what is left between the top of the window and the tab
  // bar once the RSVP card and one row of shortcuts are placed under it. The
  // block under the photo is measured (text size, banners, a long RSVP line),
  // with an estimate for the first frame.
  const { height: windowH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = windowH < 740;
  const [below, setBelow] = useState(0);
  const tabBarTop = windowH - (insets.bottom + TAB_BAR_BOTTOM + TAB_BAR_HEIGHT);
  const room = tabBarTop - 12 - (below || (compact ? 300 : 290));
  const heroH = Math.round(Math.min(Math.max(room, compact ? 240 : 340), 560, windowH * 0.62));
  const days = data?.countdown && !married && !data.countdown.passed ? data.countdown.days : null;
  const dateLine = [
    longDate(data?.wedding_date ?? session?.tenant.wedding_date, lang),
    // Short phone: the venue is one tap away (Schedule, Directions); the line stays short.
    compact ? null : data?.next_event?.location ?? null,
    // Short phone: the countdown rides in the date line instead of its own row.
    compact && days ? (days === 1 ? copy.guestHome.daysToGoOne : fmt(copy.guestHome.daysToGo, { n: days })) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const nameSize = (n: string) => (compact ? (n.length > 14 ? 36 : 44) : n.length > 14 ? 48 : 60);

  // The wedding day: Home is the day view for as long as the server says so,
  // so a tap on Home never brings the countdown back (N1).
  if (data?.day_of) return <GuestDayOfView />;

  return (
    <View style={styles.root}>
      <ScrollView
        {...scrim.listProps}
        contentContainerStyle={{ paddingBottom: clearance }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={colors.goldLight} colors={[colors.gold]} progressBackgroundColor={colors.night} />}
      >
        <PhotoHero
          source={hero ? { uri: hero } : fallback}
          // Signed URLs change on every request; the path does not (I17).
          cacheKey={hero ? `guest-hero-${hero.split("?")[0]}` : undefined}
          focal={focal}
          // At least the computed height; taller only when the names and the
          // date need it (large text, long names), never cut at the top.
          flow
          minHeight={heroH}
          maxHeightFraction={0.8}
          flowTopSpace={52}
          gradient={0.62}
          bottomPadding={compact ? 18 : 84}
          top={
            <>
              <Row gap={8} style={{ flex: 1, minWidth: 0 }}>
                <Gem />
                <T v="label11" color="rgba(247,243,236,0.85)" numberOfLines={2} style={{ letterSpacing: 2, flexShrink: 1 }}>
                  {[city, mediumDate(when, lang)].filter(Boolean).join(" · ")}
                </T>
              </Row>
              <View style={{ marginRight: -10 }}>
                <IconButton name="bell" onPress={() => router.push("/guest/messages")} label={copy.messages.title} />
              </View>
            </>
          }
        >
          <View style={COLUMN}>
            <SectionLabel color={colors.goldLight}>{copy.guestHome.invited}</SectionLabel>
            <T v="display60" size={nameSize(n1)} numberOfLines={2} adjustsFontSizeToFit style={{ marginTop: compact ? 6 : 10 }}>
              {n1}
            </T>
            {n2 ? (
              <T v="display60" size={nameSize(n2)} numberOfLines={2} adjustsFontSizeToFit>
                {n2}
              </T>
            ) : null}
            <T v="body15" color="rgba(247,243,236,0.8)" style={{ marginTop: compact ? 6 : 10 }}>
              {dateLine}
            </T>
          </View>
        </PhotoHero>

        {/* Everything down to the first row of shortcuts, measured for the photo height. */}
        <View
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            if (Math.abs(h - below) > 4) setBelow(h);
          }}
        >
        <View style={[COLUMN, { paddingHorizontal: 24, marginTop: compact ? (married ? 8 : 0) : -60 }]}>
          {married ? (
            <View accessible accessibilityRole="text">
              <T v="display44" color={colors.goldLight}>
                {copy.guestHome.married}
              </T>
              <T v="body15" color={colors.ivory70} style={{ marginTop: 4 }}>
                {copy.guestHome.marriedBody}
              </T>
            </View>
          ) : compact ? null : data?.countdown ? (
            <Countdown days={data.countdown.days} hours={data.countdown.hours} minutes={data.countdown.minutes} labels={{ days: copy.common.days, hours: copy.common.hours, min: copy.common.min }} />
          ) : isLoading && !compact ? (
            <Skeleton w={220} h={44} />
          ) : null}
        </View>

        {!online && !blocked ? (
          <View style={[COLUMN, { paddingHorizontal: 20, marginTop: 16 }]}>
            <Banner icon="wifi-off" title={copy.common.offline} body={copy.common.offlineDetail} />
          </View>
        ) : mainQuery.isError && data ? (
          <View style={[COLUMN, { paddingHorizontal: 20, marginTop: 16 }]}>
            <StaleBanner onRetry={() => void refetch()} />
          </View>
        ) : null}

        {/* With the API failing and nothing saved, say so. Never tell a guest who
            has answered that the RSVP is still pending (Part 9 audit, D-023). */}
        {failed ? (
          <View style={[COLUMN, { paddingHorizontal: 20, marginTop: 20 }]}>
            <QueryError onRetry={() => void refetch()} compact />
          </View>
        ) : blocked ? (
          <View style={[COLUMN, { paddingHorizontal: 20, marginTop: 20 }]}>
            <Card kind="glass" blur padding={8}>
              <OfflineState compact onRetry={() => retryConnection(refetch)} />
            </Card>
          </View>
        ) : (
        <View style={[COLUMN, { paddingHorizontal: 20, marginTop: 20 }]}>
          <Card kind="glass" blur padding={18}>
            <Row style={{ justifyContent: "space-between" }}>
              <SectionLabel color={colors.goldLight}>{copy.guestHome.yourRsvp}</SectionLabel>
              <Badge
                label={status === "attending" ? copy.guestHome.attending : status === "declined" ? copy.guestHome.declined : copy.guestHome.awaiting}
                kind={status === "attending" ? "green" : status === "declined" ? "mute" : "amber"}
              />
            </Row>
            {isLoading && !data ? (
              <Stack gap={8} style={{ marginTop: 12 }}>
                <Skeleton />
                <Skeleton w="70%" />
              </Stack>
            ) : (
              <T v="body16" color={colors.ivory90} style={{ marginTop: 12 }}>
                {rsvpText}
              </T>
            )}
            <Button
              label={status === "pending" ? copy.guestHome.answerNow : copy.guestHome.changeAnswer}
              small
              style={{ marginTop: 14, minHeight: 50 }}
              onPress={() => router.push("/guest/rsvp")}
              disabled={rsvp ? !rsvp.can_edit && status !== "pending" : false}
            />
          </Card>
        </View>
        )}

        <Row gap={8} align="stretch" style={[COLUMN, { paddingHorizontal: 20, marginTop: 12 }]}>
          <ActionTile icon="calendar" label={copy.guestHome.schedule} onPress={() => router.push("/guest/schedule")} />
          {directions ? <ActionTile icon="pin" label={copy.guestHome.directions} onPress={() => openMaps(directions, copy.common.linkFailed)} /> : null}
          <ActionTile icon="hanger" label={copy.guestHome.dressCode} onPress={() => setDressOpen(true)} />
          <ActionTile icon="sparkle" label={copy.guestHome.concierge} onPress={() => router.push("/guest/concierge")} />
        </Row>
        </View>
      </ScrollView>
      <StatusScrim y={scrim.scrollY} />
      <DressCodeSheet visible={dressOpen} onClose={() => setDressOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
});

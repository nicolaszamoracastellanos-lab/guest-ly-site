// Guest Invitation tab (Home), build 12 (prototype M3).
//
// The couple's photo at about half the screen (focal point kept in view),
// "You're invited to the wedding of", the names and the date. Under it the
// RSVP is the main card while it is pending ("Reply now"; "Finish reply" for a
// half-done draft), and once answered a paper card "You're going, party of
// 2 · Change". Four shortcuts open sheets over the invitation (Directions,
// Dress code, Hotels, Gifts), then the countdown. On the wedding day the tab
// IS the day view (N1). No bell: couple replies land in Ask.
//
// Wave 1 kept: offline and failed states never claim "pending" for a guest who
// answered (S1, D-023), the couple photo's stable cache key (I17).

import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { fmt, useCopy, useLang, longDate } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { useGuestSession } from "@/lib/session";
import { useGuestHome } from "@/lib/hooks";
import { useOnline } from "@/lib/query";
import { T, Card, Button, Row, Icon, Banner, Skeleton, Stack, QueryError, OfflineState, StaleBanner, useQueryBlocked, retryConnection, useBottomClearance, COLUMN, StatusScrim, useScrimScroll, PhotoHero, type PhotoFocal, type IconName } from "@/ui";
import { colors } from "@/ui/tokens";
import { splitNames, dayMonth } from "@/features/guest/format";
import { GuestDayOfView } from "@/features/guest/DayOfView";
import { DressCodeSheet } from "@/features/guest/DressCodeSheet";
import { DirectionsSheet, SiteSectionSheet } from "@/features/guest/sheets";
import { GUEST_COPY } from "@/features/guest/copy";
import { useRsvpDraft } from "@/features/guest/state";

const fallback = require("../../../assets/photos/bluehour.jpg");

type SheetName = "directions" | "dress" | "hotels" | "gifts" | null;

export default function GuestHome() {
  const copy = useCopy();
  const g = useFeatureCopy(GUEST_COPY);
  const { lang } = useLang();
  const router = useRouter();
  const session = useGuestSession();
  const { clearance } = useBottomClearance();
  const online = useOnline();
  const mainQuery = useGuestHome();
  const { data, isLoading, refetch } = mainQuery;
  const { draft } = useRsvpDraft();
  const [sheet, setSheet] = useState<SheetName>(null);
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
  // splitNames returns "& Andrés"; the gold italic "&" is drawn separately.
  const [n1, n2Raw] = splitNames(couple);
  const n2 = n2Raw.replace(/^&\s*/, "");
  const hero = data?.hero_image_url ?? session?.tenant.hero_image_url ?? null;
  // Focal point of the couple's photo when the portal sends one (read
  // tolerantly; PhotoHero falls back to faces in the upper third).
  const extra = data as { hero_focal_x?: number | null; hero_focal_y?: number | null; replied_count?: number | null } | undefined;
  const focal: Partial<PhotoFocal> | null = hero ? { x: extra?.hero_focal_x ?? undefined, y: extra?.hero_focal_y ?? undefined } : { x: 0.5, y: 0.4 };
  const scrim = useScrimScroll();
  const failed = mainQuery.isError && !data;
  const blocked = useQueryBlocked(mainQuery);
  const when = data?.wedding_date ?? session?.tenant.wedding_date ?? null;
  const rsvp = data?.rsvp;
  const status = rsvp?.status ?? "pending";
  const married = !!data?.countdown?.passed && !data.day_of;
  const days = data?.countdown && !married && !data.countdown.passed ? data.countdown.days : null;

  // About half the screen, never so tall that "Reply now", the shortcuts or
  // the countdown fall under the tab bar (prototype M3, I5). Taller only when
  // the names need it (flow), capped at 62% of the window.
  const { height: windowH, width: windowW, fontScale } = useWindowDimensions();
  // Larger text on a narrow phone: the four tiles go 2 x 2 so "Código de
  // vestimenta" never breaks mid-word (the D-031 rule of build 11).
  const twoByTwo = windowW < 380 && fontScale > 1.15;
  const compact = windowH < 720;
  const heroH = Math.round(Math.max(260, Math.min(windowH * 0.46, windowH - 524)));
  const venue = data?.next_event?.location ?? data?.city ?? session?.tenant.city ?? null;
  const daysLine = days != null ? (days === 1 ? copy.guestHome.daysToGoOne : fmt(copy.guestHome.daysToGo, { n: days })) : null;
  const nameSize = (n: string) => (compact ? (n.length > 14 ? 34 : 40) : n.length > 14 ? 46 : 60);

  // The wedding day: Home is the day view for as long as the server says so,
  // so a tap on Home never brings the countdown back (N1).
  if (data?.day_of) return <GuestDayOfView />;

  // A draft only counts while the reply is still pending and the draft was
  // made for this invitation (a reply sent elsewhere makes it stale).
  const hasDraft = status === "pending" && !!draft && draft.seats.some((s) => Object.keys(s).length > 0);
  const deadline = rsvp?.deadline ?? null;
  const replied = typeof extra?.replied_count === "number" && extra.replied_count >= 20 ? extra.replied_count : null;
  const party = rsvp?.party_size ?? null;
  const canEdit = rsvp ? rsvp.can_edit : true;
  const openRsvp = () => router.push("/guest/rsvp");

  const rsvpCard =
    status === "pending" ? (
      <Card kind="glass" blur padding={20} border={colors.goldBorder}>
        <Stack gap={4}>
          <T v="title30" accessibilityRole="header">
            {g.home.willYouCome}
          </T>
          {isLoading && !data ? (
            <Skeleton w="70%" />
          ) : hasDraft ? (
            <Row gap={8}>
              <View style={styles.draftDot} />
              <T v="body15" color={colors.goldLight} style={{ flex: 1 }}>
                {g.home.draftLine}
              </T>
            </Row>
          ) : (
            <T v="body15" color={colors.ivory70}>
              {deadline ? fmt(g.home.replyBy, { date: dayMonth(deadline, lang) }) : g.home.replyAnyTime}
            </T>
          )}
        </Stack>
        <Button testID="guest-reply-now" label={hasDraft ? g.home.finishReply : g.home.replyNow} onPress={openRsvp} style={{ marginTop: 16 }} />
        {replied ? (
          <Row gap={6} style={{ justifyContent: "center", marginTop: 12 }}>
            <Icon name="guests" size={16} color={colors.goldLight} />
            <T v="meta13" color={colors.ivory70}>
              {fmt(g.home.repliedCount, { n: replied })}
            </T>
          </Row>
        ) : null}
      </Card>
    ) : (
      <Card kind="paper" padding={16}>
        <Row gap={12}>
          <View style={[styles.doneIcon, status === "declined" && { backgroundColor: colors.muted }]}>
            <Icon name={status === "declined" ? "x" : "check"} size={22} color={colors.cream} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <T v="label11" color={colors.muted}>
              {g.home.yourReply}
            </T>
            <T v="name24" color={colors.ink}>
              {status === "declined" ? g.home.notGoing : party && party > 1 ? fmt(g.home.goingParty, { n: party }) : g.home.goingOne}
            </T>
            <T v="meta13" color={colors.muted}>
              {status === "declined" ? g.home.coupleKnows : !canEdit ? g.home.closed : deadline ? fmt(g.home.changeUntil, { date: dayMonth(deadline, lang) }) : g.home.changeAnyTime}
            </T>
          </View>
          {canEdit ? <Button testID="guest-change-reply" label={g.home.change} kind="text" onPaper small full={false} onPress={openRsvp} style={{ marginRight: -6 }} /> : null}
        </Row>
      </Card>
    );

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
          flow
          minHeight={heroH}
          maxHeightFraction={0.62}
          flowTopSpace={44}
          gradient={0.6}
          bottomPadding={20}
          top={
            <T v="label11" color="rgba(247,243,236,0.86)" numberOfLines={1} style={{ letterSpacing: 2, flexShrink: 1, paddingTop: 6 }}>
              {g.home.invitedTo}
            </T>
          }
        >
          <View style={COLUMN} accessible accessibilityRole="header" accessibilityLabel={[g.home.invitedTo, couple, longDate(when, lang)].filter(Boolean).join(". ")}>
            <T v="display60" size={nameSize(n1)} numberOfLines={2} adjustsFontSizeToFit>
              {n1}
            </T>
            {n2 ? (
              <T v="display60" size={nameSize(n2)} numberOfLines={2} adjustsFontSizeToFit>
                <T v="display60" size={nameSize(n2)} italic color={colors.goldLight}>
                  &amp;{" "}
                </T>
                {n2}
              </T>
            ) : null}
            <T v="body15" color="rgba(247,243,236,0.86)" style={{ marginTop: 8 }}>
              {[cap(longDate(when, lang)), venue].filter(Boolean).join("\n")}
              {compact && daysLine ? `\n${daysLine}` : ""}
            </T>
          </View>
        </PhotoHero>

        <Stack gap={16} style={[COLUMN, { paddingHorizontal: 16, marginTop: 4 }]}>
          {married ? (
            <View accessible accessibilityRole="text" style={{ paddingHorizontal: 4 }}>
              <T v="display44" color={colors.goldLight}>
                {copy.guestHome.married}
              </T>
              <T v="body15" color={colors.ivory70} style={{ marginTop: 4 }}>
                {copy.guestHome.marriedBody}
              </T>
            </View>
          ) : null}

          {!online && !blocked ? (
            <Banner icon="wifi-off" title={copy.common.offline} body={copy.common.offlineDetail} />
          ) : mainQuery.isError && data ? (
            <StaleBanner onRetry={() => void refetch()} />
          ) : null}

          {/* With the API failing and nothing saved, say so. Never tell a guest who
              has answered that the RSVP is still pending (D-023, S1). */}
          {failed ? (
            <QueryError onRetry={() => void refetch()} compact />
          ) : blocked ? (
            <Card kind="glass" blur padding={8}>
              <OfflineState compact onRetry={() => retryConnection(refetch)} />
            </Card>
          ) : married && status === "pending" ? null : (
            rsvpCard
          )}

          <View accessibilityRole="menu" accessibilityLabel={g.home.shortcuts} style={[styles.tiles, twoByTwo && styles.tilesWrap]}>
            <Tile icon="map" label={g.home.directions} onPress={() => setSheet("directions")} wide={twoByTwo} />
            <Tile icon="hanger" label={g.home.dressCode} onPress={() => setSheet("dress")} wide={twoByTwo} />
            <Tile icon="bed" label={g.home.hotels} onPress={() => setSheet("hotels")} wide={twoByTwo} />
            <Tile icon="gift" label={g.home.gifts} onPress={() => setSheet("gifts")} wide={twoByTwo} />
          </View>

          {!compact && days != null ? (
            <Row gap={16} style={{ paddingHorizontal: 4, paddingTop: 4 }}>
              <T v="display60" size={60} accessibilityElementsHidden importantForAccessibility="no">
                {days}
              </T>
              <View style={styles.countText} accessible accessibilityLabel={daysLine ?? undefined}>
                <T v="body16" style={{ fontWeight: "500" }}>
                  {days === 1 ? g.home.day : g.home.days}
                </T>
                <T v="meta13" color={colors.ivory70}>
                  {fmt(g.home.until, { date: dayMonth(when, lang) })}
                </T>
              </View>
            </Row>
          ) : isLoading && !data && !compact ? (
            <Skeleton w={200} h={60} />
          ) : null}
        </Stack>
      </ScrollView>
      <StatusScrim y={scrim.scrollY} />
      <DirectionsSheet visible={sheet === "directions"} onClose={() => setSheet(null)} />
      <DressCodeSheet visible={sheet === "dress"} onClose={() => setSheet(null)} />
      <SiteSectionSheet kind="hotels" visible={sheet === "hotels"} onClose={() => setSheet(null)} />
      <SiteSectionSheet kind="gifts" visible={sheet === "gifts"} onClose={() => setSheet(null)} />
    </View>
  );
}

/** A long date starts with the weekday: capitalised for a line of its own. */
function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function Tile({ icon, label, onPress, wide }: { icon: IconName; label: string; onPress: () => void; wide?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.tile, wide && styles.tileHalf, pressed && styles.tilePressed]}>
      <Icon name={icon} size={24} color={colors.goldLight} />
      <T v="meta13" size={14} color={colors.ivory70} center numberOfLines={2} style={{ minHeight: 36 }}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  draftDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
  doneIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#03694c", alignItems: "center", justifyContent: "center" },
  tiles: { flexDirection: "row", gap: 8 },
  tilesWrap: { flexWrap: "wrap", justifyContent: "space-between", columnGap: 0, rowGap: 8 },
  tileHalf: { flex: 0, width: "48.5%" },
  tile: { flex: 1, minWidth: 0, minHeight: 84, borderRadius: 16, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: colors.ivory14, alignItems: "center", gap: 8, paddingTop: 16, paddingBottom: 8, paddingHorizontal: 4 },
  tilePressed: { transform: [{ scale: 0.97 }], backgroundColor: colors.ivory09 },
  countText: { gap: 2, paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: colors.ivory14 },
});

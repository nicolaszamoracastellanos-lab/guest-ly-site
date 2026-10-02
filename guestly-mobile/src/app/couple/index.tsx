// Couple home: photo header, today's briefing, three stat tiles, the
// Coordinador.

import React, { useCallback, useState } from "react";
import { View, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCopy } from "@/i18n";
import { useUserSession, useSession } from "@/lib/session";
import { useCoupleHome } from "@/lib/hooks";
import { Screen, T, Row, Wordmark, IconButton, Badge, Icon, StatTile, Card, Banner, Skeleton, SectionLabel, BriefingRow, PhotoHero, ScreenBannerSlot } from "@/ui";
import { colors } from "@/ui/tokens";

const photo = require("../../../assets/photos/hands.jpg");
// Where the clasped hands and the ring sit in hands.jpg, as expo-image's
// object position: 90% down keeps them in the upper half of the box, above
// the names, instead of the centered crop that showed two sleeves (I2).
const HANDS_FOCAL = { x: 0.5, y: 0.9 };

export default function CoupleHome() {
  const copy = useCopy();
  const router = useRouter();
  const user = useUserSession();
  const { dayOfManual } = useSession();
  const mainQuery = useCoupleHome();
  const { data, isLoading } = mainQuery;
  const couple = data?.couple_names ?? user?.me.tenant.couple_names ?? "";
  const days = data?.countdown ? data.countdown.days : null;
  const dayOf = (data?.day_of ?? false) || dayOfManual;
  // "% paid" for the budget the Budget screen has open (it remembers the last
  // one viewed under "budget-selected"), so the two numbers agree (B3). An
  // older portal sends only the first budget's percent: use that.
  const [budgetId, setBudgetId] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      AsyncStorage.getItem("budget-selected")
        .then((v) => {
          if (alive) setBudgetId(v);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );
  const byId = data?.budget_percent_paid_by_id;
  const paid = budgetId && byId && Object.prototype.hasOwnProperty.call(byId, budgetId) ? byId[budgetId] : data?.budget_percent_paid;

  return (
    // The photo starts at the top edge, behind the clock: no Screen top inset
    // on top of the hero's own (the double margin of I2), plain night under
    // it so the fade has no seam (I8). Pull down to refresh (S2).
    <Screen query={mainQuery} padded={false} topInset={false} backdrop={false} refresh>
      {/* Flow layout: the names push the photo taller instead of sitting at a
          fixed offset, where a two-line couple name ran over the status badge
          and under the briefing (Sep 30, iPhone screenshot). */}
      <PhotoHero
        source={photo}
        focal={HANDS_FOCAL}
        flow
        minHeight={360}
        maxHeightFraction={0.55}
        gradient={0.6}
        top={
          <>
            <Wordmark height={20} />
            <IconButton name="bell" badge={(data?.needs_you ?? 0) > 0} onPress={() => router.push("/couple/messages")} label={copy.coupleHome.tabs.messages} />
          </>
        }
      >
        <SectionLabel color={colors.goldLight}>
          {copy.coupleHome.yourWedding}
          {days !== null ? ` · ${days} ${copy.common.days}` : ""}
        </SectionLabel>
        <T v="title42" style={{ marginTop: 8 }}>
          {couple}
        </T>
        <View style={{ alignSelf: "flex-start", marginTop: 8 }}>
          <Badge label={data?.concierge_live ?? user?.me.tenant.status === "live" ? copy.coupleHome.live : copy.coupleHome.building} kind={data?.concierge_live ? "green" : "mute"} dot />
        </View>
      </PhotoHero>

      <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
        {/* The one connection banner of this screen, under the photo (S4). */}
        <ScreenBannerSlot />
        {dayOf ? (
          <Pressable onPress={() => router.push("/couple/dayof")} accessibilityRole="button" accessibilityLabel={`${copy.coupleDayOf.title}, ${copy.coupleHome.dayOfBanner}`} style={{ marginBottom: 12 }}>
            <Banner icon="clock" title={copy.coupleDayOf.title} body={copy.coupleHome.dayOfBanner} kind="gold" action={<Icon name="chev" size={18} color={colors.ivory40} />} />
          </Pressable>
        ) : null}
        <SectionLabel style={{ marginBottom: 6 }}>{copy.coupleHome.briefing}</SectionLabel>
        {isLoading && !data ? (
          <>
            <Skeleton h={58} style={{ marginBottom: 8 }} />
            <Skeleton h={58} style={{ marginBottom: 8 }} />
          </>
        ) : null}
        {data && !data.briefing.length ? (
          <T v="body15" color={colors.ivory55} style={{ paddingVertical: 14 }}>
            {copy.coupleHome.briefingEmpty}
          </T>
        ) : null}
        {(data?.briefing ?? []).map((b, i) => (
          <BriefingRow key={i} text={b.text} tone={b.tone} onPress={() => open(b)} />
        ))}
      </View>

      <View>
        <Row gap={8} style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <StatTile value={String(data?.totals.attending_seats ?? "")} label={copy.coupleHome.attending} />
          <StatTile value={String(data?.needs_you ?? "")} label={copy.coupleHome.needYou} color={colors.goldLight} />
          <StatTile value={paid !== null && paid !== undefined ? `${paid}%` : "·"} label={copy.coupleHome.budgetPaid} />
        </Row>

        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <Pressable onPress={() => router.push("/assistant" as never)} accessibilityRole="button" accessibilityLabel={copy.coupleHome.ask}>
            {/* At least 52 high, and it grows with large text instead of
                cutting the line off at the right edge. */}
            <Card kind="glass" padding={0} radiusKey="pill" style={{ minHeight: 52, paddingVertical: 12, justifyContent: "center", paddingHorizontal: 18 }}>
              <Row gap={10}>
                <Icon name="sparkle" size={20} color={colors.goldLight} />
                <T v="body15" color={colors.ivory55} style={{ flex: 1 }}>
                  {copy.coupleHome.ask}
                </T>
              </Row>
            </Card>
          </Pressable>
        </View>
      </View>
    </Screen>
  );

  // The portal's stable row kind (v1.2, N13) opens the exact screen; a row
  // without one (production portal before v1.2) or of a kind this build does
  // not know falls back to its web link.
  function open(row: { href: string; kind?: unknown; target_id?: unknown; filter?: unknown }) {
    const kind = typeof row.kind === "string" ? row.kind : null;
    const target = typeof row.target_id === "string" && row.target_id ? row.target_id : null;
    if (kind === "requests_open" && target) return void router.push({ pathname: "/couple/requests/[id]", params: { id: target } } as never);
    if (kind === "escalation_open" && target) return void router.push({ pathname: "/couple/messages/[id]", params: { id: target } } as never);
    if (kind === "rsvp_pace" || kind === "new_rsvps") {
      const filter = row.filter === "pending" || row.filter === "changed" ? row.filter : null;
      return void router.push((filter ? { pathname: "/couple/rsvps", params: { filter } } : "/couple/rsvps") as never);
    }
    go(row.href);
  }

  function go(href: string) {
    const map: [string, string][] = [
      ["/rsvps", "/couple/rsvps"],
      ["/conversations", "/couple/messages"],
      ["/requests", "/couple/requests"],
      ["/guests", "/couple/guests"],
      ["/checkin", "/couple/checkin"],
      ["/tasks", "/couple/tasks"],
      ["/budget", "/couple/budget"],
      ["/vendors", "/couple/vendors"],
      ["/seating", "/couple/seating"],
      ["/runsheet", "/couple/runsheet"],
      ["/broadcasts", "/couple/broadcasts"],
      ["/brain", "/couple/brain"],
      ["/website", "/couple/website"],
      ["/dashboard", "/couple/insights"],
    ];
    const hit = map.find(([web]) => href.startsWith(web));
    router.push((hit ? hit[1] : "/couple/more") as never);
  }
}

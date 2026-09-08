// Couple home: photo header, today's briefing, three stat tiles, the brain.

import React from "react";
import { View, StyleSheet, Image, Linking, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmt, useCopy } from "@/i18n";
import { useUserSession, useSession } from "@/lib/session";
import { useCoupleHome } from "@/lib/hooks";
import { useOnline } from "@/lib/query";
import { Screen, T, Row, Gem, Wordmark, IconButton, Badge, Hairline, Icon, StatTile, Card, Banner, Skeleton, SectionLabel } from "@/ui";
import { colors, FILL } from "@/ui/tokens";

const photo = require("../../../assets/photos/hands.jpg");

export default function CoupleHome() {
  const copy = useCopy();
  const router = useRouter();
  const user = useUserSession();
  const { dayOfManual } = useSession();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const { data, isLoading } = useCoupleHome();
  const top = Math.max(insets.top, 54);
  const couple = data?.couple_names ?? user?.me.tenant.couple_names ?? "";
  const days = data?.countdown ? data.countdown.days : null;
  const dayOf = (data?.day_of ?? false) || dayOfManual;

  return (
    <Screen padded={false}>
      <View style={styles.hero}>
        <Image source={photo} style={FILL} resizeMode="cover" />
        <LinearGradient colors={["rgba(8,11,16,0.3)", "rgba(8,11,16,0.05)", "rgba(13,17,23,0.7)", colors.night]} locations={[0, 0.35, 0.7, 1]} style={FILL} />
        <Row style={[styles.top, { top }]}>
          <Wordmark height={20} />
          <IconButton name="bell" badge={(data?.needs_you ?? 0) > 0} onPress={() => router.push("/couple/messages")} />
        </Row>
        <View style={styles.headline}>
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
        </View>
      </View>

      <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
        {!online ? <Banner icon="wifi-off" title={copy.common.offline} body={copy.common.offlineDetail} /> : null}
        {dayOf ? (
          <Pressable onPress={() => router.push("/couple/dayof")} style={{ marginBottom: 12 }}>
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
          <Pressable key={i} onPress={() => go(b.href)} accessibilityRole="button">
            <Row gap={14} style={styles.briefRow}>
              <Gem size={6} color={b.tone === "info" ? colors.gold : colors.amber} />
              <T v="body16" color={colors.ivory90} style={{ flex: 1 }}>
                {b.text}
              </T>
              <Icon name="chev" size={18} color={colors.ivory40} />
            </Row>
          </Pressable>
        ))}
      </View>

      <Row gap={8} style={{ paddingHorizontal: 20, marginTop: 22 }}>
        <StatTile value={String(data?.totals.attending_seats ?? "")} label={copy.coupleHome.attending} />
        <StatTile value={String(data?.needs_you ?? "")} label={copy.coupleHome.needYou} color={colors.goldLight} />
        <StatTile value={data?.budget_percent_paid !== null && data?.budget_percent_paid !== undefined ? `${data.budget_percent_paid}%` : "·"} label={copy.coupleHome.budgetPaid} />
      </Row>

      <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
        <Pressable onPress={() => user && Linking.openURL(`https://app.guest-ly.com/brain`)} accessibilityRole="button">
          <Card kind="glass" padding={0} radiusKey="pill" style={{ height: 52, justifyContent: "center", paddingHorizontal: 18 }}>
            <Row gap={10}>
              <Icon name="sparkle" size={20} color={colors.goldLight} />
              <T v="body15" color={colors.ivory55}>
                {copy.coupleHome.ask}
              </T>
            </Row>
          </Card>
        </Pressable>
      </View>
    </Screen>
  );

  function go(href: string) {
    if (href.startsWith("/rsvps")) return router.push("/couple/rsvps");
    if (href.startsWith("/conversations")) return router.push("/couple/messages");
    if (href.startsWith("/requests")) return router.push("/couple/requests");
    if (href.startsWith("/guests")) return router.push("/couple/guests");
    if (href.startsWith("/checkin")) return router.push("/couple/checkin");
    return Linking.openURL(`https://app.guest-ly.com${href}`);
  }
}

const styles = StyleSheet.create({
  hero: { overflow: "hidden", height: 330 },
  top: { position: "absolute", left: 24, right: 20, justifyContent: "space-between" },
  headline: { position: "absolute", left: 24, right: 24, top: 196 },
  briefRow: { minHeight: 58, borderBottomWidth: 1, borderBottomColor: colors.ivory09, paddingVertical: 8 },
});

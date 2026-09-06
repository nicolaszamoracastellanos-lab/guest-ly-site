// Planner home: greeting, needs you, two tiles, the weddings list.

import React from "react";
import { View, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { fmt, useCopy } from "@/i18n";
import { usePlannerHome } from "@/lib/hooks";
import { useSession, useUserSession } from "@/lib/session";
import { Screen, TopBar, Wordmark, IconButton, Badge, T, Row, Gem, Icon, StatTile, SectionLabel, Skeleton, Stack, Card, ListRow } from "@/ui";
import { colors } from "@/ui/tokens";

export default function PlannerHome() {
  const copy = useCopy();
  const router = useRouter();
  const user = useUserSession();
  const { switchTenant } = useSession();
  const { data, isLoading } = usePlannerHome();
  const hour = new Date().getHours();
  const part = hour < 12 ? copy.planner.morning : hour < 19 ? copy.planner.afternoon : copy.planner.evening;
  const name = data?.greeting_name ?? user?.me.user.email.split("@")[0] ?? "";
  const needs = (data?.briefing.length ?? 0) + (data?.weddings.reduce((s, w) => s + w.open_requests, 0) ?? 0);

  return (
    <Screen header={<TopBar left={<Row gap={8}><Wordmark height={20} /><Badge label={copy.settings.planner} kind="gold" /></Row>} right={<IconButton name="bell" badge={needs > 0} onPress={() => router.push("/planner/requests")} />} />}>
      <View style={{ marginTop: 18 }}>
        <T v="title42" size={38}>
          {fmt(copy.planner.greeting, { part, name: cap(name) })}
        </T>
        <T v="body15" color={colors.ivory55} style={{ marginTop: 6 }}>
          {fmt(copy.planner.subtitle, { weddings: data?.weddings.length ?? user?.me.tenants.length ?? 0, needs })}
        </T>
      </View>
      <SectionLabel style={{ marginTop: 26, marginBottom: 6 }}>{copy.planner.needsYou}</SectionLabel>
      {isLoading && !data ? <Skeleton h={58} /> : null}
      {data && !data.briefing.length ? (
        <T v="body15" color={colors.ivory55} style={{ paddingVertical: 12 }}>
          {copy.coupleHome.briefingEmpty}
        </T>
      ) : null}
      {(data?.briefing ?? []).map((b, i) => (
        <Pressable key={i} onPress={() => go(b.href)}>
          <Row gap={14} style={{ minHeight: 58, borderBottomWidth: 1, borderBottomColor: colors.ivory09, paddingVertical: 8 }}>
            <Gem size={6} color={b.tone === "info" ? colors.gold : colors.amber} />
            <T v="body16" color={colors.ivory90} style={{ flex: 1 }}>
              {b.text}
            </T>
            <Icon name="chev" size={18} color={colors.ivory40} />
          </Row>
        </Pressable>
      ))}
      <Row gap={8} style={{ marginTop: 22 }}>
        <StatTile value={String(data?.totals.attending_seats ?? "·")} label={`${copy.rsvps.tiles.attending} · ${user?.me.tenant.couple_names ?? ""}`} />
        <StatTile value={String(data?.totals.pending_parties ?? "·")} label={copy.rsvps.tiles.pending} color={colors.amber} />
      </Row>
      <Row style={{ justifyContent: "space-between", marginTop: 26 }}>
        <SectionLabel>{copy.planner.yourWeddings}</SectionLabel>
      </Row>
      <Card kind="solid" padding={2} style={{ paddingHorizontal: 18, marginTop: 8 }}>
        {(data?.weddings ?? []).map((w, i, arr) => (
          <ListRow
            key={w.slug}
            title={`${w.couple_names}${w.wedding_date ? ` · ${w.wedding_date}` : ""}`}
            sub={w.current ? `${copy.planner.current}${w.days_to_go !== null ? ` · ${w.days_to_go} ${copy.common.days}` : ""}` : w.days_to_go !== null && w.days_to_go < 30 ? `${copy.planner.nextUp} · ${w.days_to_go} ${copy.common.days}` : copy.planner.quiet}
            trailing={<Badge label={fmt(copy.planner.open, { n: w.open_requests })} kind={w.open_requests ? "amber" : "mute"} />}
            onPress={async () => { if (!w.current) await switchTenant(w.slug); }}
            chevron={!w.current}
            last={i === arr.length - 1}
          />
        ))}
      </Card>
    </Screen>
  );

  function go(href: string) {
    if (href.includes("requests")) return router.push("/planner/requests");
    if (href.includes("guests")) return router.push("/planner/guests");
    return Linking.openURL(`https://app.guest-ly.com${href}`);
  }
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

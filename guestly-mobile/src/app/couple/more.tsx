// Everything else. Entries whose tables do not exist in this wedding come
// back available:false and render as Coming soon chips, never as links.

import React from "react";
import { View, Pressable, Linking, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { fmt, useCopy } from "@/i18n";
import { useMore } from "@/lib/hooks";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, Wordmark, IconButton, BigTitle, T, Icon, SectionLabel, Badge, Stack, Footer, type IconName } from "@/ui";
import { colors, radius } from "@/ui/tokens";

type Item = { key: string; icon: IconName; label: string; sub: string; web?: string; route?: string; available: boolean };

export default function MoreSheet() {
  const copy = useCopy();
  const router = useRouter();
  const user = useUserSession();
  const { data } = useMore();
  const e = data?.entries ?? {};
  const n = (k: string) => e[k]?.count ?? 0;
  const av = (k: string) => e[k]?.available ?? false;
  const base = "https://app.guest-ly.com";

  const planning: Item[] = [
    { key: "tasks", icon: "tasks", label: copy.more.items.tasks, sub: fmt(copy.more.subs.tasksOpen, { n: n("tasks") }), web: `${base}/tasks`, available: av("tasks") },
    { key: "seating", icon: "grid", label: copy.more.items.seating, sub: fmt(copy.more.subs.seatingPlans, { n: n("seating") }), web: `${base}/seating`, available: av("seating") },
    { key: "budget", icon: "coins", label: copy.more.items.budget, sub: copy.more.subs.openWeb, web: `${base}/budget`, available: av("budget") },
    { key: "brain", icon: "sparkle", label: copy.more.items.brain, sub: copy.more.subs.brainAsk, web: `${base}/brain`, available: true },
    { key: "vendors", icon: "store", label: copy.more.items.vendors, sub: fmt(copy.more.subs.vendors, { n: n("vendors") }), web: `${base}/vendors`, available: av("vendors") },
    { key: "dayof", icon: "clock", label: copy.more.items.dayof, sub: copy.more.subs.dayof, route: "/couple/dayof", available: true },
  ];
  const communication: Item[] = [
    { key: "broadcasts", icon: "megaphone", label: copy.more.items.broadcasts, sub: fmt(copy.more.subs.broadcasts, { n: n("broadcasts") }), web: `${base}/broadcasts`, available: av("broadcasts") },
    { key: "requests", icon: "tasks", label: copy.more.items.requests, sub: fmt(copy.more.subs.requests, { n: n("requests") }), route: "/couple/requests", available: av("requests") },
    { key: "coordinator", icon: "chat", label: copy.more.items.coordinator, sub: copy.more.subs.coordinator, web: `${base}/coordinator`, available: true },
  ];
  const eventDay: Item[] = [
    { key: "checkin", icon: "qr", label: copy.more.items.checkin, sub: copy.more.subs.checkin, route: "/couple/checkin", available: true },
    { key: "website", icon: "globe", label: copy.more.items.website, sub: `guest-ly.com/${data?.site_slug ?? user?.me.tenant.slug ?? ""}`, web: `${base}/${data?.site_slug ?? user?.me.tenant.slug ?? ""}`, available: true },
    { key: "guide", icon: "book", label: copy.more.items.guide, sub: copy.more.subs.openWeb, web: `${base}/guide`, available: true },
    { key: "settings", icon: "gear", label: copy.more.items.settings, sub: "", route: "/settings", available: true },
  ];

  function open(item: Item) {
    if (!item.available) return;
    if (item.route) return router.push(item.route as never);
    if (item.web) return Linking.openURL(item.web);
  }

  const grid = (items: Item[]) => (
    <View style={styles.grid}>
      {items.map((it) => (
        <Pressable key={it.key} onPress={() => open(it)} disabled={!it.available} accessibilityRole="button" style={({ pressed }) => [styles.tile, pressed && { opacity: 0.75 }, !it.available && { opacity: 0.55 }]}>
          <Icon name={it.icon} size={22} color={colors.goldLight} />
          <View style={{ flex: 1, gap: 1 }}>
            <T v="body15">{it.label}</T>
            {it.available ? (
              it.sub ? (
                <T v="meta13" color={colors.ivory55} numberOfLines={1}>
                  {it.sub}
                </T>
              ) : null
            ) : (
              <Badge label={copy.common.comingSoon} kind="mute" />
            )}
          </View>
        </Pressable>
      ))}
    </View>
  );

  return (
    <Screen header={<TopBar left={<Wordmark height={20} />} right={<IconButton name="gear" onPress={() => router.push("/settings")} />} />}>
      <View style={{ marginTop: 18 }}>
        <BigTitle title={copy.more.title} sub={user?.me.tenant.couple_names} />
      </View>
      <Stack gap={8} style={{ marginTop: 20 }}>
        <SectionLabel>{copy.more.planning}</SectionLabel>
        {grid(planning)}
        <SectionLabel style={{ marginTop: 10 }}>{copy.more.communication}</SectionLabel>
        {grid(communication)}
        <SectionLabel style={{ marginTop: 10 }}>{copy.more.eventDay}</SectionLabel>
        {grid(eventDay)}
      </Stack>
      <Footer version={copy.common.footerVersion} trademark={copy.common.footerTrademark} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "48.5%", minHeight: 60, borderRadius: radius.tile, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: "rgba(247,243,236,0.12)", flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
});

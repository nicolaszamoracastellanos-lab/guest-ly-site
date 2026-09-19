// Day-of: the critical fact in the top 320px, then the runsheet for guests.

import React from "react";
import { View, StyleSheet, Image, Linking, Platform } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { fmt, useCopy } from "@/i18n";
import { useGuestDayOf } from "@/lib/hooks";
import { Screen, T, Row, Gem, IconButton, Card, Button, Badge, Icon, Stack, Skeleton, SectionLabel, useTopInset } from "@/ui";
import { colors, FILL } from "@/ui/tokens";
import { clockLabel } from "./schedule";

const photo = require("../../../assets/photos/courtyard.jpg");

export default function GuestDayOf() {
  const copy = useCopy();
  const router = useRouter();
  const top = useTopInset();
  const mainQuery = useGuestDayOf();
  const { data, isLoading } = mainQuery;
  const now = data?.now_local;
  const focus = data?.current ?? data?.next ?? data?.events[0] ?? null;

  function openMaps(url: string | null) {
    if (!url) return;
    if (Platform.OS === "ios" && url.includes("google.com/maps")) {
      const q = new URL(url).searchParams.get("query");
      if (q) return Linking.openURL(`maps://?q=${encodeURIComponent(q)}`);
    }
    return Linking.openURL(url);
  }

  return (
    <Screen query={mainQuery} padded={false} topInset={false}>
      {/* The hero grows with its text. It had a fixed height with the text pinned
          inside, so a five-line sentence ran under the buttons (Part 9 audit, D-015). */}
      <View style={[styles.hero, { paddingTop: top + 64 }]}>
        <Image source={photo} style={FILL} resizeMode="cover" />
        <LinearGradient colors={["rgba(8,11,16,0.28)", "rgba(8,11,16,0.06)", "rgba(13,17,23,0.55)", colors.night]} locations={[0, 0.28, 0.6, 1]} style={FILL} />
        <Row style={[styles.top, { top }]}>
          <Row gap={8} style={{ flex: 1, minWidth: 0 }}>
            <Gem />
            <T v="label11" color="rgba(247,243,236,0.85)" numberOfLines={1} style={{ letterSpacing: 2, flexShrink: 1 }}>
              {copy.common.today} · {now ? `${now.hour}:${String(now.minute).padStart(2, "0")}` : ""}
            </T>
          </Row>
          <IconButton name="bell" label={copy.messages.title} onPress={() => router.push("/guest/messages")} />
        </Row>
        <View style={styles.headline}>
          <SectionLabel color={colors.goldLight}>{copy.dayof.rightNow}</SectionLabel>
          {isLoading && !data ? (
            <Skeleton w={260} h={44} style={{ marginTop: 8 }} />
          ) : focus ? (
            <>
              <T v="display44" style={{ marginTop: 8 }}>
                {fmt(copy.dayof.headTo, { event: focus.title })}
              </T>
              <T v="body15" color="rgba(247,243,236,0.85)" style={{ marginTop: 8 }}>
                {[focus.location, focus.time ? `${clockLabel(focus.time)}` : null, focus.notes].filter(Boolean).join(". ")}
              </T>
            </>
          ) : (
            <T v="body15" color={colors.ivory70} style={{ marginTop: 8 }}>
              {copy.dayof.notYet}
            </T>
          )}
        </View>
      </View>
      {/* One action. The Shuttle button next to it did nothing when pressed; the
          shuttle details are in the Getting there card right below. */}
      <View style={{ paddingHorizontal: 24, marginTop: -24 }}>
        <Button label={copy.dayof.openMaps} small icon="map" onPress={() => openMaps(focus?.maps_url ?? null)} disabled={!focus?.maps_url} />
      </View>
      <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
          {(data?.events ?? []).map((e, i) => (
            <Row key={e.id} gap={14} style={[styles.runRow, i === (data?.events.length ?? 0) - 1 && { borderBottomWidth: 0 }]}>
              <T v="title26" size={19} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} color={e.state === "now" ? colors.goldLight : colors.ivory55} style={{ width: 66 }}>
                {clockLabel(e.time)}
              </T>
              <T
                v="body15"
                color={e.state === "now" ? colors.ivory : e.state === "done" ? colors.ivory40 : colors.ivory70}
                style={[{ flex: 1 }, e.state === "done" && { textDecorationLine: "line-through" }]}
              >
                {e.title}
                {e.location ? ` · ${e.location}` : ""}
              </T>
              {e.state === "now" ? <Badge label={copy.common.now} kind="gold" /> : null}
            </Row>
          ))}
        </Card>
        {data?.getting_there ? (
          <Card kind="solid" padding={12} style={{ marginTop: 12 }}>
            <Row gap={12}>
              <Icon name="bus" size={22} color={colors.goldLight} />
              <View style={{ flex: 1, gap: 1 }}>
                <SectionLabel>{copy.dayof.gettingThere}</SectionLabel>
                <T v="body15" color={colors.ivory90}>
                  {data.getting_there}
                </T>
              </View>
            </Row>
          </Card>
        ) : null}
        {data?.dress_code ? (
          <Card kind="solid" padding={12} style={{ marginTop: 12 }}>
            <Row gap={12}>
              <Icon name="hanger" size={22} color={colors.goldLight} />
              <View style={{ flex: 1, gap: 1 }}>
                <SectionLabel>{copy.dayof.dressCode}</SectionLabel>
                <T v="body15" color={colors.ivory90}>
                  {data.dress_code}
                </T>
              </View>
            </Row>
          </Card>
        ) : null}
        {data?.planner_whatsapp ? (
          <Stack style={{ marginTop: 12 }}>
            <Button label={copy.dayof.planner} kind="ghost" small icon="phone" onPress={() => Linking.openURL(`https://wa.me/${data.planner_whatsapp!.replace(/\D/g, "")}`)} />
          </Stack>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { overflow: "hidden", minHeight: 400, paddingBottom: 56, justifyContent: "flex-end" },
  top: { position: "absolute", left: 24, right: 14, gap: 8, justifyContent: "space-between" },
  headline: { paddingHorizontal: 24 },
  runRow: { minHeight: 46, borderBottomWidth: 1, borderBottomColor: colors.ivory09, paddingVertical: 6 },
});

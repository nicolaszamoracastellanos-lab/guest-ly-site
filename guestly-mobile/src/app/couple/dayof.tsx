// Day-of mode for the couple: parties in, the runsheet, escalations.

import React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { fmt, useCopy } from "@/i18n";
import { useCoupleDayOf } from "@/lib/hooks";
import { Screen, TopBar, Wordmark, IconButton, Badge, T, Row, Button, Card, SectionLabel, Stack, Skeleton, Icon } from "@/ui";
import { colors } from "@/ui/tokens";

export default function CoupleDayOf() {
  const copy = useCopy();
  const router = useRouter();
  const { data, isLoading } = useCoupleDayOf();
  const pct = data && data.parties_total ? Math.min(100, Math.round((data.parties_in / data.parties_total) * 100)) : 0;

  return (
    <Screen header={<TopBar left={<Wordmark height={20} />} right={<Row gap={8}><Badge label={copy.coupleDayOf.title} kind="green" /><IconButton name="bell" onPress={() => router.push("/couple/messages")} /></Row>} />}>
      <Row gap={24} align="flex-end" style={{ marginTop: 16 }}>
        <View>
          <SectionLabel color={colors.goldLight}>{copy.coupleDayOf.partiesIn}</SectionLabel>
          <Row gap={6} align="baseline">
            <T v="display60" size={80} style={{ lineHeight: 78, letterSpacing: -1 }}>
              {data ? data.parties_in : "·"}
            </T>
            <T v="title26" size={28} color={colors.ivory55}>
              / {data?.parties_total ?? "·"}
            </T>
          </Row>
        </View>
        <View style={{ paddingBottom: 10 }}>
          <SectionLabel>{copy.coupleDayOf.seats}</SectionLabel>
          <Row gap={4} align="baseline">
            <T v="title34">{data?.seats_in ?? "·"}</T>
            <T v="meta13" color={colors.ivory55}>
              / {data?.seats_total ?? "·"}
            </T>
          </Row>
        </View>
      </Row>
      <View style={{ height: 3, borderRadius: 2, backgroundColor: "rgba(247,243,236,0.1)", marginTop: 12 }}>
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: colors.gold, borderRadius: 2 }} />
      </View>
      <Button label={copy.coupleDayOf.checkIn} icon="qr" onPress={() => router.push("/couple/checkin")} style={{ marginTop: 18 }} />

      <Row style={{ justifyContent: "space-between", marginTop: 28 }}>
        <SectionLabel>{copy.coupleDayOf.runsheet}</SectionLabel>
        <Pressable onPress={() => router.push("/couple/runsheet")}>
          <T v="meta13" color={colors.goldLight}>
            {copy.coupleDayOf.open}
          </T>
        </Pressable>
      </Row>
      <Card kind="solid" padding={2} style={{ marginTop: 8, paddingHorizontal: 18 }}>
        {isLoading && !data ? (
          <Stack gap={10} style={{ paddingVertical: 12 }}>
            <Skeleton h={40} />
            <Skeleton h={40} />
          </Stack>
        ) : null}
        {data && !data.runsheet.length ? (
          <T v="body15" color={colors.ivory55} style={{ paddingVertical: 14 }}>
            {copy.coupleDayOf.noRunsheet}
          </T>
        ) : null}
        {(data?.runsheet ?? []).map((b, i, arr) => (
          <Row key={b.id} gap={14} style={{ minHeight: 48, paddingVertical: 6, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: colors.ivory09 }}>
            <T v="title26" size={19} color={b.state === "now" ? colors.goldLight : colors.ivory55} style={{ width: 58 }}>
              {b.starts_at.slice(0, 5)}
            </T>
            <View style={{ flex: 1 }}>
              <T v="body15" color={b.state === "now" ? colors.ivory : b.state === "done" ? colors.ivory40 : colors.ivory70} style={b.state === "done" && { textDecorationLine: "line-through" }}>
                {b.title}
              </T>
              {b.location || b.owner ? (
                <T v="meta13" color={colors.ivory55}>
                  {[b.location, b.owner].filter(Boolean).join(" · ")}
                </T>
              ) : null}
            </View>
            {b.state === "done" ? <Badge label={copy.common.doneLabel} kind="mute" /> : b.state === "now" ? <Badge label={copy.common.now} kind="gold" /> : null}
          </Row>
        ))}
      </Card>

      {data?.escalations.length ? (
        <Card kind="solid" padding={14} style={{ marginTop: 14 }} border="rgba(245,158,11,0.35)">
          <Row style={{ justifyContent: "space-between" }}>
            <Badge label={fmt(copy.coupleDayOf.escalated, { n: data.escalations.length })} kind="amber" />
            <Pressable onPress={() => router.push("/couple/messages")}>
              <T v="meta13" color={colors.goldLight}>
                {copy.coupleDayOf.answerBoth}
              </T>
            </Pressable>
          </Row>
          <T v="body15" color={colors.ivory90} style={{ marginTop: 8 }}>
            {data.escalations.map((e) => e.text).join(" ")}
          </T>
        </Card>
      ) : null}
      {data && !data.day_of ? (
        <Row gap={10} style={{ marginTop: 16 }}>
          <Icon name="info" size={18} color={colors.ivory55} />
          <T v="meta13" color={colors.ivory55} style={{ flex: 1 }}>
            {copy.coupleDayOf.notToday}
          </T>
        </Row>
      ) : null}
    </Screen>
  );
}

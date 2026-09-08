// One broadcast: counts, delivery states and the recipient names.

import React from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fmt, longDate, relTime, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { Screen, TopBar, BigTitle, Card, ListRow, Badge, StatTile, Row, Skeleton, SectionLabel, T, EmptyState } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/broadcasts/copy";
import { useBroadcast } from "@/features/broadcasts/hooks";

export default function BroadcastDetail() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useBroadcast(id);
  const g = data?.group;

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={c.detail} />}>
      {isLoading && !data ? <Skeleton h={160} r={18} /> : null}
      {g && g.groupKind === "campaign" ? (
        <>
          <BigTitle title={g.label} sub={`${longDate(g.ts, lang)} · ${relTime(g.ts, lang)}`} size={34} />
          {g.customMessage ? (
            <Card kind="glass" padding={16} style={{ marginTop: 16 }}>
              <T v="body15" color={colors.ivory90}>
                {g.customMessage}
              </T>
            </Card>
          ) : null}
          <Row gap={8} style={{ marginTop: 18 }}>
            <StatTile value={String(g.audience)} label={c.recipients.replace("{n} ", "")} />
            <StatTile value={String(g.sent)} label={c.ok} color={colors.greenText} />
            <StatTile value={String(g.failed)} label={c.notOk} color={g.failed ? colors.red : colors.ivory} />
          </Row>
          {g.delivery ? (
            <Row gap={8} style={{ marginTop: 8 }}>
              <StatTile value={String(g.delivery.delivered)} label={fmt(c.delivered, { n: "" }).trim()} />
              <StatTile value={String(g.delivery.read)} label={fmt(c.read, { n: "" }).trim()} />
              <StatTile value={String(g.delivery.pending)} label={fmt(c.pending, { n: "" }).trim()} />
            </Row>
          ) : null}
          {g.langBreakdown ? (
            <T v="meta13" color={colors.ivory55} style={{ marginTop: 12 }}>
              {(["es", "en"] as const)
                .filter((l) => g.langBreakdown?.[l])
                .map((l) => `${l.toUpperCase()} ${g.langBreakdown![l]!.sent}/${g.langBreakdown![l]!.total}`)
                .join(" · ")}
            </T>
          ) : null}
          <SectionLabel style={{ marginTop: 24, marginBottom: 8 }}>{c.recipientList}</SectionLabel>
          {g.recipients?.length ? (
            <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
              {g.recipients.map((r, i) => (
                <ListRow key={`${r.id ?? r.name}-${i}`} title={r.name} sub={r.lang.toUpperCase()} trailing={<Badge label={r.ok ? c.ok : c.notOk} kind={r.ok ? "green" : "red"} />} chevron={false} last={i === g.recipients!.length - 1} />
              ))}
            </Card>
          ) : (
            <View>
              <EmptyState title={fmt(c.recipients, { n: g.audience })} />
            </View>
          )}
        </>
      ) : null}
      {g && g.groupKind === "aggregate" ? <BigTitle title={g.label ?? c.unknownBatch} sub={fmt(c.messages, { n: g.count })} size={34} /> : null}
    </Screen>
  );
}

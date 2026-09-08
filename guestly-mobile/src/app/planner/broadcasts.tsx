// Planner reminders: read-only history and audience sizes. Sends go through
// the couple; the planner files a send_reminders request.

import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { fmt, relTime, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { Screen, TopBar, BigTitle, Card, ListRow, Badge, Button, EmptyState, Skeleton, Stack, SectionLabel, T, Chip, ChipRow } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/broadcasts/copy";
import { usePlannerBroadcasts } from "@/features/broadcasts/hooks";
import { deliveryLine, groupTitle } from "@/app/couple/broadcasts/index";

export default function PlannerBroadcasts() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const { data, isLoading } = usePlannerBroadcasts();
  const history = data?.history ?? [];

  return (
    <Screen header={<TopBar onBack={() => router.back()} />}>
      <BigTitle title={c.plannerTitle} sub={c.plannerSubtitle} />
      <Button label={c.plannerRequest} icon="megaphone" onPress={() => router.push({ pathname: "/planner/requests/new", params: { kind: "send_reminders" } })} style={{ marginTop: 18 }} />
      {data ? (
        <View style={{ marginTop: 24 }}>
          <SectionLabel style={{ marginBottom: 8 }}>{c.plannerAudiences}</SectionLabel>
          <T v="meta13" color={colors.ivory55} style={{ marginBottom: 10 }}>
            {fmt(c.plannerPhones, { with: data.guests_with_phone, without: data.guests_without_phone })}
          </T>
          <ChipRow>
            {data.audiences.map((a) => (
              <Chip key={a.key} label={`${a.label[lang]} ${a.count}`} />
            ))}
          </ChipRow>
        </View>
      ) : null}
      <SectionLabel style={{ marginTop: 28, marginBottom: 8 }}>{c.history}</SectionLabel>
      <Stack gap={10}>
        {isLoading && !data ? <Skeleton h={72} r={18} /> : null}
        {data && !history.length ? <EmptyState title={c.historyEmpty} /> : null}
        {history.length ? (
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
            {history.map((g, i) => (
              <ListRow
                key={g.id}
                title={groupTitle(g, c.unknownBatch)}
                sub={`${deliveryLine(g, c)} · ${relTime(g.ts, lang)}`}
                trailing={g.groupKind === "campaign" ? <Badge label={fmt(c.recipients, { n: g.audience })} kind={g.failed ? "amber" : "green"} /> : undefined}
                chevron={false}
                last={i === history.length - 1}
              />
            ))}
          </Card>
        ) : null}
      </Stack>
    </Screen>
  );
}

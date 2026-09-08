// Broadcasts: sent history with delivery counts, and the way to a new one.

import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { fmt, relTime, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, BigTitle, Card, ListRow, Badge, Banner, Button, EmptyState, Skeleton, Stack, SectionLabel, T } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/broadcasts/copy";
import { useBroadcasts, type HistoryGroup } from "@/features/broadcasts/hooks";

export function groupTitle(g: HistoryGroup, unknown: string): string {
  if (g.groupKind === "campaign") return g.label;
  return g.label ?? unknown;
}

export function deliveryLine(g: HistoryGroup, c: (typeof COPY)["en"]): string {
  if (g.groupKind === "campaign") {
    const parts = [fmt(c.sentOf, { sent: g.sent, total: g.audience })];
    if (g.failed) parts.push(fmt(c.failed, { n: g.failed }));
    if (g.delivery) parts.push(fmt(c.delivered, { n: g.delivery.delivered }));
    return parts.join(" · ");
  }
  const parts = [fmt(c.messages, { n: g.count })];
  if (g.delivery) parts.push(fmt(c.delivered, { n: g.delivery.delivered }));
  return parts.join(" · ");
}

export default function Broadcasts() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const user = useUserSession();
  const { data, isLoading } = useBroadcasts();
  const canSend = (data?.can_send ?? user?.me.can_edit) ?? false;
  const history = data?.history ?? [];
  const anyPhone = (data?.guests ?? []).some((g) => g.has_phone);

  return (
    <Screen header={<TopBar onBack={() => router.back()} />}>
      <BigTitle title={c.title} sub={c.subtitle} />
      <View style={{ marginTop: 20 }}>
        {!canSend ? <Banner icon="lock" title={c.readOnly} /> : null}
        {canSend && data && !anyPhone ? <Banner icon="phone" title={c.noPhones} /> : null}
        {canSend ? <Button label={c.newBroadcast} icon="megaphone" onPress={() => router.push("/couple/broadcasts/new")} disabled={!!data && !anyPhone} style={{ marginTop: 12 }} /> : null}
      </View>
      <SectionLabel style={{ marginTop: 28, marginBottom: 8 }}>{c.history}</SectionLabel>
      <Stack gap={10}>
        {isLoading && !data ? (
          <>
            <Skeleton h={72} r={18} />
            <Skeleton h={72} r={18} />
          </>
        ) : null}
        {data && !history.length ? <EmptyState title={c.historyEmpty} body={c.historyEmptyBody} /> : null}
        {history.length ? (
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
            {history.map((g, i) => (
              <ListRow
                key={g.id}
                title={groupTitle(g, c.unknownBatch)}
                sub={`${deliveryLine(g, c)} · ${relTime(g.ts, lang)}`}
                trailing={g.groupKind === "campaign" ? <Badge label={g.failed ? fmt(c.failed, { n: g.failed }) : fmt(c.recipients, { n: g.audience })} kind={g.failed ? "amber" : "green"} /> : undefined}
                onPress={g.groupKind === "campaign" ? () => router.push({ pathname: "/couple/broadcasts/[id]", params: { id: g.id } }) : undefined}
                chevron={g.groupKind === "campaign"}
                last={i === history.length - 1}
              />
            ))}
          </Card>
        ) : null}
        {data?.ledger_available === false && history.length ? (
          <T v="meta13" color={colors.ivory40}>
            {lang === "es" ? "Los estados de entrega no están disponibles en este momento." : "Delivery states are not available right now."}
          </T>
        ) : null}
      </Stack>
    </Screen>
  );
}

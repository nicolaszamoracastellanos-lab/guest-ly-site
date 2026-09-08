// Inbox: every conversation guests have with the concierge, on every channel.
// Needs you first; filters by channel; sentiment and gap badges per row.

import React, { useState } from "react";
import { View, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLang, relTime } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { Screen, TopBar, Wordmark, IconButton, BigTitle, Chip, ChipRow, ListRow, Avatar, Badge, Row, T, EmptyState, Skeleton, Stack, useTopInset } from "@/ui";
import { colors, TAB_BAR_HEIGHT, TAB_BAR_BOTTOM } from "@/ui/tokens";
import { COPY } from "@/features/inbox/copy";
import { useInboxList } from "@/features/inbox/hooks";

const FILTERS = ["needs_you", "all", "whatsapp", "web", "app"] as const;

export default function Inbox() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("needs_you");
  const { data, isLoading } = useInboxList(filter);

  const header = (
    <View style={{ paddingHorizontal: 24 }}>
      <TopBar left={<Wordmark height={20} />} right={<IconButton name="sparkle" onPress={() => router.push("/couple/insights")} label={c.title} />} />
      <View style={{ marginTop: 18 }}>
        <BigTitle title={c.title} sub={c.subtitle} />
      </View>
      <View style={{ marginTop: 18 }}>
        <ChipRow>
          {FILTERS.map((f) => (
            <Chip key={f} label={f === "needs_you" ? `${c.filters.needs_you} · ${data?.needs_you ?? 0}` : c.filters[f]} on={filter === f} onPress={() => setFilter(f)} />
          ))}
        </ChipRow>
      </View>
    </View>
  );

  return (
    <Screen scroll={false} padded={false} bottomInset={0} contentStyle={{ flex: 1 }}>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={<View style={{ paddingTop: top - 4 }}>{header}</View>}
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + insets.bottom + 20 }}
        ListEmptyComponent={
          isLoading && !data ? (
            <Stack gap={10} style={{ paddingHorizontal: 24, marginTop: 16 }}>
              <Skeleton h={66} />
              <Skeleton h={66} />
            </Stack>
          ) : (
            <EmptyState title={filter === "needs_you" ? c.emptyNeedsYou : c.empty} />
          )
        }
        renderItem={({ item: m }) => (
          <View style={{ paddingHorizontal: 24 }}>
            <ListRow
              leading={<Avatar initials={m.initials} gem={m.channel === "app"} />}
              title={m.name}
              sub={m.preview || c.messages(m.message_count)}
              trailing={
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <T v="meta13" color={colors.ivory40}>
                    {relTime(m.last_at, lang)}
                  </T>
                  <Row gap={6}>
                    <Badge label={c.channel[m.channel] ?? m.channel} kind={m.channel === "app" ? "gold" : "mute"} />
                    {m.sentiment === "frustrated" ? <Badge label={c.frustrated} kind="red" /> : m.sentiment === "negative" ? <Badge label={c.upset} kind="red" /> : null}
                    {m.has_gap ? <Badge label={c.gap} kind="amber" /> : null}
                    {m.needs_you ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber }} /> : null}
                  </Row>
                </View>
              }
              chevron={false}
              onPress={() => router.push({ pathname: "/couple/messages/[id]", params: { id: m.id } })}
            />
          </View>
        )}
      />
    </Screen>
  );
}

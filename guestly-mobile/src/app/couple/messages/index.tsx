// Inbox: what guests are asking the concierge. Needs you first.

import React, { useState } from "react";
import { View, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCopy, useLang, relTime } from "@/i18n";
import { useInbox } from "@/lib/hooks";
import { Screen, TopBar, Wordmark, IconButton, BigTitle, Chip, ChipRow, ListRow, Avatar, Badge, Row, T, EmptyState, Skeleton, Stack, useTopInset } from "@/ui";
import { colors, TAB_BAR_HEIGHT, TAB_BAR_BOTTOM } from "@/ui/tokens";

const FILTERS = ["needs_you", "all", "whatsapp", "web", "app"] as const;

export default function Inbox() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("needs_you");
  const { data, isLoading } = useInbox(filter);

  const header = (
    <View style={{ paddingHorizontal: 24 }}>
      <TopBar left={<Wordmark height={20} />} right={<IconButton name="bell" badge={(data?.needs_you ?? 0) > 0} />} />
      <View style={{ marginTop: 18 }}>
        <BigTitle title={copy.inbox.title} sub={copy.inbox.subtitle} />
      </View>
      <View style={{ marginTop: 18 }}>
        <ChipRow>
          {FILTERS.map((f) => (
            <Chip key={f} label={f === "needs_you" ? `${copy.inbox.filters.needs_you} · ${data?.needs_you ?? 0}` : copy.inbox.filters[f]} on={filter === f} onPress={() => setFilter(f)} />
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
            <EmptyState title={copy.inbox.empty} />
          )
        }
        renderItem={({ item: m }) => (
          <View style={{ paddingHorizontal: 24 }}>
            <ListRow
              leading={<Avatar initials={m.initials} />}
              title={m.name}
              sub={m.preview}
              trailing={
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <T v="meta13" color={colors.ivory40}>
                    {relTime(m.last_at, lang)}
                  </T>
                  <Row gap={6}>
                    {m.upset ? <Badge label={copy.inbox.upset} kind="red" /> : null}
                    {m.needs_you ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber }} /> : null}
                  </Row>
                </View>
              }
              chevron={false}
              onPress={() => router.push({ pathname: "/couple/messages/[id]", params: { id: m.id, name: m.name, channel: m.channel, preview: m.preview, guest: m.guest_id ?? "" } })}
            />
          </View>
        )}
      />
    </Screen>
  );
}

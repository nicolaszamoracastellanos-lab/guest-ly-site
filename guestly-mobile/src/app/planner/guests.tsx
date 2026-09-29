// Planner guests: names, parties, answers. Contact details never arrive.

import React, { useCallback, useState } from "react";
import { View, FlatList, RefreshControl } from "react-native";
import { fmt, useCopy } from "@/i18n";
import { usePlannerGuests } from "@/lib/hooks";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, Wordmark, BigTitle, Input, ListRow, Avatar, Badge, T, Skeleton, Stack, useTopInset, Icon, Row, useBottomClearance, COLUMN, QueryError, EmptyState, useScrimScroll } from "@/ui";
import { colors } from "@/ui/tokens";

export default function PlannerGuests() {
  const copy = useCopy();
  const user = useUserSession();
  const { clearance } = useBottomClearance();
  const top = useTopInset();
  const scrim = useScrimScroll();
  const [q, setQ] = useState("");
  const guestsQuery = usePlannerGuests(user?.me.tenant.slug ?? "");
  const { data, isLoading } = guestsQuery;
  const [pulling, setPulling] = useState(false);
  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await guestsQuery.refetch();
    } finally {
      setPulling(false);
    }
  }, [guestsQuery]);
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const items = (data?.guests ?? []).filter((g) => (q ? fold(g.name).includes(fold(q)) : true));

  return (
    <Screen scroll={false} padded={false} topInset={false} contentStyle={{ flex: 1 }} scrollY={scrim.scrollY}>
      <FlatList
        {...scrim.listProps}
        data={items}
        keyExtractor={(g) => g.id}
        ListHeaderComponent={
          <View style={{ paddingTop: top, paddingHorizontal: 24 }}>
            <TopBar left={<Wordmark height={20} />} />
            <View style={{ marginTop: 18 }}>
              <BigTitle title={copy.planner.guestsTitle} sub={`${user?.me.tenant.couple_names ?? ""} · ${data?.count ?? ""}`} />
            </View>
            <Row gap={8} style={{ marginTop: 10 }}>
              <Icon name="lock" size={16} color={colors.ivory55} />
              <T v="meta13" color={colors.ivory55} style={{ flex: 1 }}>
                {copy.planner.guestsNote}
              </T>
            </Row>
            <Input accessibilityLabel={copy.guests.search} icon="search" value={q} onChangeText={setQ} placeholder={copy.guests.search} autoCorrect={false} style={{ marginTop: 14, marginBottom: 6 }} />
          </View>
        }
        contentContainerStyle={[COLUMN, { paddingBottom: clearance }]}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={colors.goldLight} colors={[colors.gold]} progressBackgroundColor={colors.night} />}
        ListEmptyComponent={
          isLoading ? (
            <Stack gap={10} style={{ paddingHorizontal: 24 }}>
              <Skeleton h={60} />
              <Skeleton h={60} />
            </Stack>
          ) : guestsQuery.isError ? (
            <QueryError onRetry={() => void guestsQuery.refetch()} />
          ) : q ? (
            <EmptyState title={copy.core.pickerEmpty} />
          ) : (
            // A wedding with no guests yet used to render nothing (P2-32).
            <EmptyState title={copy.core.guestsEmpty} body={copy.core.guestsEmptyBody} />
          )
        }
        renderItem={({ item: g }) => (
          <View style={{ paddingHorizontal: 24 }}>
            <ListRow
              leading={<Avatar initials={g.initials} />}
              title={g.name}
              sub={[fmt(copy.guests.partyOf, { n: g.party_size }), g.members.length ? g.members.join(", ") : null, g.notes].filter(Boolean).join(" · ")}
              trailing={<Badge label={g.status === "attending" ? copy.guests.filters.attending : g.status === "declined" ? copy.guests.filters.declined : copy.guests.filters.pending} kind={g.status === "attending" ? "green" : g.status === "pending" ? "amber" : "mute"} />}
              chevron={false}
            />
          </View>
        )}
      />
    </Screen>
  );
}

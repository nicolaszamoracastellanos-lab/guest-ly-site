// Planner guests: names, parties, answers. Contact details never arrive.

import React, { useState } from "react";
import { View, FlatList } from "react-native";
import { fmt, useCopy } from "@/i18n";
import { usePlannerGuests } from "@/lib/hooks";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, Wordmark, BigTitle, Input, ListRow, Avatar, Badge, T, Skeleton, Stack, useTopInset, Icon, Row, useBottomClearance, COLUMN, QueryError, EmptyState } from "@/ui";
import { colors } from "@/ui/tokens";

export default function PlannerGuests() {
  const copy = useCopy();
  const user = useUserSession();
  const { clearance } = useBottomClearance();
  const top = useTopInset();
  const [q, setQ] = useState("");
  const guestsQuery = usePlannerGuests(user?.me.tenant.slug ?? "");
  const { data, isLoading } = guestsQuery;
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const items = (data?.guests ?? []).filter((g) => (q ? fold(g.name).includes(fold(q)) : true));

  return (
    <Screen scroll={false} padded={false} topInset={false} contentStyle={{ flex: 1 }}>
      <FlatList
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
            <Input icon="search" value={q} onChangeText={setQ} placeholder={copy.guests.search} autoCorrect={false} style={{ marginTop: 14, marginBottom: 6 }} />
          </View>
        }
        contentContainerStyle={[COLUMN, { paddingBottom: clearance }]}
        ListEmptyComponent={isLoading ? <Stack gap={10} style={{ paddingHorizontal: 24 }}><Skeleton h={60} /><Skeleton h={60} /></Stack> : guestsQuery.isError ? <QueryError onRetry={() => void guestsQuery.refetch()} /> : q ? <EmptyState title={copy.common.search} body={copy.find.moreLetters} /> : null}
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

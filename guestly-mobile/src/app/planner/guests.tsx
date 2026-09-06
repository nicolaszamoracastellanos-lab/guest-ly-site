// Planner guests: names, parties, answers. Contact details never arrive.

import React, { useState } from "react";
import { View, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmt, useCopy } from "@/i18n";
import { usePlannerGuests } from "@/lib/hooks";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, Wordmark, BigTitle, Input, ListRow, Avatar, Badge, T, Skeleton, Stack, useTopInset, Icon, Row } from "@/ui";
import { colors, TAB_BAR_HEIGHT, TAB_BAR_BOTTOM } from "@/ui/tokens";

export default function PlannerGuests() {
  const copy = useCopy();
  const user = useUserSession();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const [q, setQ] = useState("");
  const { data, isLoading } = usePlannerGuests(user?.me.tenant.slug ?? "");
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const items = (data?.guests ?? []).filter((g) => (q ? fold(g.name).includes(fold(q)) : true));

  return (
    <Screen scroll={false} padded={false} bottomInset={0} contentStyle={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(g) => g.id}
        ListHeaderComponent={
          <View style={{ paddingTop: top - 4, paddingHorizontal: 24 }}>
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
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + insets.bottom + 20 }}
        ListEmptyComponent={isLoading ? <Stack gap={10} style={{ paddingHorizontal: 24 }}><Skeleton h={60} /><Skeleton h={60} /></Stack> : null}
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

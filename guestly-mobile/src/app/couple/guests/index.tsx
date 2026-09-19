// Guests: search, filters, the list, the add button.

import React, { useState } from "react";
import { View, Pressable, StyleSheet, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { fmt, useCopy, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure } from "@/lib/api";
import { COPY as TOOLS } from "@/features/exports/copy";
import { exportGuests, type ExportPreset } from "@/features/exports/download";
import { useCoupleGuests } from "@/lib/hooks";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, Wordmark, IconButton, BigTitle, Input, Chip, ChipRow, ListRow, Avatar, Badge, Icon, EmptyState, Button, Skeleton, Stack, Sheet, Card, T, Row, useTopInset, useBottomClearance, useBubbleHide, COLUMN, QueryError, useTabBarTop } from "@/ui";
import { colors } from "@/ui/tokens";

const FILTERS = ["all", "attending", "pending", "declined"] as const;

export default function CoupleGuests() {
  const copy = useCopy();
  const router = useRouter();
  const user = useUserSession();
  const { clearance } = useBottomClearance();
  const tabTop = useTabBarTop();
  const top = useTopInset();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const tools = useFeatureCopy(TOOLS);
  const { lang } = useLang();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [exporting, setExporting] = useState<ExportPreset | null>(null);
  const [toolsError, setToolsError] = useState<string | null>(null);
  const guestsQuery = useCoupleGuests(q, filter);
  const { data, isLoading } = guestsQuery;
  const items = data?.items ?? [];
  const totals = data?.totals;
  const canEdit = user?.me.can_edit ?? false;
  // The add button floats where the assistant bubble would rest, so the bubble
  // moves up by the button and its gap while this list is on screen.
  // One floating circle per screen: with the add button up, the bubble steps aside.
  useBubbleHide(canEdit);

  const header = (
    <View style={{ paddingHorizontal: 24 }}>
      <TopBar
        left={<Wordmark height={20} />}
        right={
          <Row gap={8}>
            <IconButton name="more" label={tools.menu} onPress={() => { setToolsError(null); setToolsOpen(true); }} />
            <IconButton name="bell" label={copy.coupleHome.tabs.messages} onPress={() => router.push("/couple/messages")} />
          </Row>
        }
      />
      <View style={{ marginTop: 18 }}>
        <BigTitle title={copy.guests.title} sub={totals ? fmt(copy.guests.subtitle, { parties: totals.parties, people: totals.people_expected }) : ""} />
      </View>
      <Input icon="search" value={q} onChangeText={setQ} placeholder={copy.guests.search} autoCorrect={false} style={{ marginTop: 18 }} />
      <View style={{ marginTop: 12 }}>
        <ChipRow>
          {FILTERS.map((f) => (
            <Chip
              key={f}
              label={f === "all" ? `${copy.guests.filters.all}${totals ? ` ${totals.parties}` : ""}` : f === "pending" ? `${copy.guests.filters.pending}${totals ? ` ${totals.pending_parties}` : ""}` : copy.guests.filters[f]}
              on={filter === f}
              onPress={() => setFilter(f)}
            />
          ))}
        </ChipRow>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <Screen scroll={false} padded={false} topInset={false} contentStyle={{ flex: 1 }}>
        <FlatList
          data={items}
          keyExtractor={(g) => g.id}
          ListHeaderComponent={<View style={{ paddingTop: top }}>{header}</View>}
          contentContainerStyle={[COLUMN, { paddingBottom: clearance + (canEdit ? FAB_SIZE + 14 : 0) }]}
          ListEmptyComponent={
            isLoading ? (
              <Stack gap={10} style={{ paddingHorizontal: 24, marginTop: 16 }}>
                <Skeleton h={60} />
                <Skeleton h={60} />
                <Skeleton h={60} />
              </Stack>
            ) : guestsQuery.isError ? (
              <QueryError onRetry={() => void guestsQuery.refetch()} />
            ) : q || filter !== "all" ? (
              <EmptyState title={copy.common.search} body={copy.find.moreLetters} />
            ) : (
              <EmptyState title={copy.guests.emptyTitle} body={copy.guests.emptyBody} action={canEdit ? <Button label={copy.guests.add} small onPress={() => router.push("/couple/guests/new")} /> : undefined} />
            )
          }
          renderItem={({ item: g }) => (
            <View style={{ paddingHorizontal: 24 }}>
              <ListRow
                leading={<Avatar initials={g.initials} />}
                title={g.name}
                sub={`${fmt(copy.guests.partyOf, { n: g.party_size })}${g.tags.length ? ` · ${g.tags.slice(0, 2).join(", ")}` : ""}`}
                trailing={<Badge label={statusLabel(g.status)} kind={g.status === "attending" ? "green" : g.status === "pending" ? "amber" : "mute"} />}
                onPress={() => router.push({ pathname: "/couple/guests/[id]", params: { id: g.id } })}
              />
            </View>
          )}
        />
      </Screen>
      <Sheet visible={toolsOpen} onClose={() => (exporting ? null : setToolsOpen(false))} top={200}>
        <View style={{ paddingHorizontal: 20 }}>
          <T v="title26">{tools.menu}</T>
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 18, marginTop: 14 }}>
            {canEdit ? <ListRow leading={<Icon name="list" size={22} color={colors.goldLight} />} title={tools.import} sub={tools.importSub} onPress={() => { setToolsOpen(false); router.push("/couple/guests/import"); }} /> : null}
            {canEdit ? <ListRow leading={<Icon name="edit" size={22} color={colors.goldLight} />} title={tools.questions} sub={tools.questionsSub} onPress={() => { setToolsOpen(false); router.push("/couple/rsvps/questions"); }} /> : null}
            <ListRow leading={<Icon name="share" size={22} color={colors.goldLight} />} title={tools.export} sub={tools.exportSub} chevron={false} last />
          </Card>
          <View style={{ marginTop: 12 }}>
            <ChipRow>
              {(["full", "attending", "pending", "declined", "contacts", "per_person", "dietary", "seating"] as ExportPreset[]).map((p) => (
                <Chip key={p} label={exporting === p ? tools.preparing : tools.presets[p]} on={exporting === p} onPress={() => void runExport(p)} />
              ))}
            </ChipRow>
          </View>
          {toolsError ? (
            <T v="body15" color={colors.red} style={{ marginTop: 10 }}>
              {toolsError}
            </T>
          ) : null}
        </View>
      </Sheet>
      {canEdit ? (
        <Pressable
          testID="fab-add"
          accessibilityRole="button"
          accessibilityLabel={copy.guests.add}
          onPress={() => router.push("/couple/guests/new")}
          style={[styles.fab, { bottom: tabTop + 14 }]}
        >
          <Icon name="plus" size={24} color={colors.night} strokeWidth={2} />
        </Pressable>
      ) : null}
    </View>
  );

  async function runExport(preset: ExportPreset) {
    if (exporting) return;
    setExporting(preset);
    setToolsError(null);
    try {
      await exportGuests({ preset, lang });
      setToolsOpen(false);
    } catch (err) {
      setToolsError(err instanceof ApiFailure ? err.messages[lang] : tools.failed);
    } finally {
      setExporting(null);
    }
  }

  function statusLabel(s: string) {
    return s === "attending" ? copy.guests.filters.attending : s === "declined" ? copy.guests.filters.declined : copy.guests.filters.pending;
  }
}

const FAB_SIZE = 56;

const styles = StyleSheet.create({
  fab: { position: "absolute", right: 14, width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", shadowColor: colors.gold, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
});

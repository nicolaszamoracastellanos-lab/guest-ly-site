// Guests: search, filters, the list, the add button.

import React, { useCallback, useState } from "react";
import { View, Pressable, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { fmt, useCopy, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { errorText } from "@/features/shared/requests";
import { COPY as TOOLS } from "@/features/exports/copy";
import { exportGuests, type ExportPreset } from "@/features/exports/download";
import { useGuestPages } from "@/features/guests/hooks";
import type { GuestListItem } from "@/lib/hooks";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, Wordmark, IconButton, BigTitle, Input, Chip, ChipRow, ListRow, Avatar, Badge, Icon, EmptyState, Button, Skeleton, Stack, Sheet, Card, T, Row, useTopInset, useBottomClearance, useBubbleHide, COLUMN, QueryError, useTabBarTop, useScrimScroll, StaleBanner } from "@/ui";
import { useOnline } from "@/lib/query";
import { colors } from "@/ui/tokens";

const FILTERS = ["all", "attending", "pending", "declined"] as const;

export default function CoupleGuests() {
  const copy = useCopy();
  const router = useRouter();
  const user = useUserSession();
  const { clearance } = useBottomClearance();
  const tabTop = useTabBarTop();
  const top = useTopInset();
  const scrim = useScrimScroll();
  const online = useOnline();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const tools = useFeatureCopy(TOOLS);
  const { lang } = useLang();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [exporting, setExporting] = useState<ExportPreset | null>(null);
  const [exportAbort, setExportAbort] = useState<AbortController | null>(null);
  const [toolsError, setToolsError] = useState<string | null>(null);
  // Every page, not only the first 60 parties; the search is debounced.
  const guestsQuery = useGuestPages(q, filter);
  const { items, totals, isLoading, loadMore, isFetchingNextPage } = guestsQuery;
  const openGuest = useCallback((id: string) => router.push({ pathname: "/couple/guests/[id]", params: { id } }), [router]);
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
      {/* Saved rows shown offline say so (QA Sep 29). */}
      {items.length && (!online || guestsQuery.isError) ? (
        <View style={{ marginTop: 14 }}>
          <StaleBanner onRetry={() => void guestsQuery.refetch()} />
        </View>
      ) : null}
      <Input accessibilityLabel={copy.guests.search} icon="search" value={q} onChangeText={setQ} placeholder={copy.guests.search} autoCorrect={false} style={{ marginTop: 18 }} />
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
      <Screen scroll={false} padded={false} topInset={false} contentStyle={{ flex: 1 }} scrollY={scrim.scrollY}>
        <FlatList
          {...scrim.listProps}
          data={items}
          keyExtractor={(g) => g.id}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.goldLight} style={{ marginVertical: 18 }} /> : null}
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
            ) : guestsQuery.term ? (
              <EmptyState title={copy.guests.noMatchTitle} body={copy.guests.noMatchBody} />
            ) : filter !== "all" ? (
              <EmptyState title={copy.guests.noMatchTitle} body={copy.guests.filterEmptyBody} />
            ) : (
              <EmptyState title={copy.guests.emptyTitle} body={copy.guests.emptyBody} action={canEdit ? <Button label={copy.guests.add} small onPress={() => router.push("/couple/guests/new")} /> : undefined} />
            )
          }
          renderItem={({ item: g }) => <GuestRow guest={g} sub={`${fmt(copy.guests.partyOf, { n: g.party_size })}${g.tags.length ? ` · ${g.tags.slice(0, 2).join(", ")}` : ""}`} status={statusLabel(g.status)} onOpen={openGuest} />}
        />
      </Screen>
      <Sheet visible={toolsOpen} onClose={closeTools} top={200}>
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
        // Anchored to the content column, not to the window: on a 1440 px window
        // the button sat 400 px away from the list it adds to (D-027).
        <View pointerEvents="box-none" style={[styles.fabHost, { bottom: tabTop + 14 }]}>
          <View pointerEvents="box-none" style={[COLUMN, { alignItems: "flex-end", paddingRight: 14 }]}>
            <Pressable testID="fab-add" accessibilityRole="button" accessibilityLabel={copy.guests.add} onPress={() => router.push("/couple/guests/new")} style={styles.fab}>
              <Icon name="plus" size={24} color={colors.night} strokeWidth={2} />
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );

  // Closing the sheet while an export runs cancels it, so a stalled download
  // never traps the person in the sheet.
  function closeTools() {
    exportAbort?.abort();
    setToolsOpen(false);
  }

  async function runExport(preset: ExportPreset) {
    if (exporting) return;
    const controller = new AbortController();
    setExportAbort(controller);
    setExporting(preset);
    setToolsError(null);
    try {
      await exportGuests({ preset, lang, signal: controller.signal });
      setToolsOpen(false);
    } catch (err) {
      if (!controller.signal.aborted) setToolsError(errorText(err, lang, tools.failed));
    } finally {
      setExporting(null);
      setExportAbort(null);
    }
  }

  function statusLabel(s: string) {
    return s === "attending" ? copy.guests.filters.attending : s === "declined" ? copy.guests.filters.declined : copy.guests.filters.pending;
  }
}

const GuestRow = React.memo(function GuestRow({ guest: g, sub, status, onOpen }: { guest: GuestListItem; sub: string; status: string; onOpen: (id: string) => void }) {
  return (
    <View style={{ paddingHorizontal: 24 }}>
      <ListRow
        leading={<Avatar initials={g.initials} />}
        title={g.name}
        sub={sub}
        trailing={<Badge label={status} kind={g.status === "attending" ? "green" : g.status === "pending" ? "amber" : "mute"} />}
        onPress={() => onOpen(g.id)}
      />
    </View>
  );
});

const FAB_SIZE = 56;

const styles = StyleSheet.create({
  fabHost: { position: "absolute", left: 0, right: 0 },
  fab: { width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", shadowColor: colors.gold, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
});

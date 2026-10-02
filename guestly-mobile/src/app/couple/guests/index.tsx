// Invitados (build 12, F3 + M8): Guests and RSVPs are one list. Search with a
// clear button, chips with counts (All, Pending, Going, Not going, Changed),
// the "Remind N with a phone" bar while Pending is on, a visible "Send
// reminder" top right (opens the announcement composer aimed at pending
// guests), "+" to add and a header menu (Import, Export, RSVP questions,
// Automatic reminders, Share invitation). A row opens the guest card.

import React, { useCallback, useMemo, useState } from "react";
import { View, Pressable, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, plural, useCopy, useLang, relTime } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { get } from "@/lib/api";
import { errorText, newSendKey, outcomeUnknown, postOnce } from "@/features/shared/requests";
import { COPY as TOOLS } from "@/features/exports/copy";
import { exportGuests, type ExportPreset } from "@/features/exports/download";
import { useGuestPages } from "@/features/guests/hooks";
import { useCoupleSettings } from "@/features/settings/hooks";
import { useCoupleHome, useCoupleRsvps } from "@/lib/hooks";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, IconButton, BigTitle, Input, Chip, Avatar, Badge, Icon, EmptyState, Button, Skeleton, Stack, Sheet, SheetActions, Card, T, Row, useTopInset, useBottomClearance, COLUMN, QueryError, OfflineState, retryConnection, usePullRefresh, useScrimScroll, StaleBanner, ChipRow, ListRow, toast } from "@/ui";
import { useOnline } from "@/lib/query";
import { colors, radius } from "@/ui/tokens";
import { useCoupleCopy, FadedChipRow, guestStatusText, statusIcon, statusColor, useShareInvite, dayMonth, MenuRow, MenuCard } from "@/features/couple/ui";

const FILTERS = ["all", "pending", "attending", "declined", "changed"] as const;
type Filter = (typeof FILTERS)[number];
type Row_ = { id: string; guest_id: string | null; name: string; initials: string; status: string; party: number; sub?: string; changed?: boolean };
/** Reminder reach the v1.2 portal adds to GET /couple/rsvps (B2). */
type Reach = { pending_with_phone?: number; pending_without_phone?: number; pending_remindable?: number };

function asFilter(v: unknown): Filter | null {
  return FILTERS.find((f) => f === v) ?? null;
}

export default function CoupleGuests() {
  const copy = useCopy();
  const c = useCoupleCopy();
  const tools = useFeatureCopy(TOOLS);
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useUserSession();
  const shareInvite = useShareInvite();
  const { clearance } = useBottomClearance();
  const top = useTopInset();
  const scrim = useScrimScroll();
  const online = useOnline();
  const canEdit = user?.me.can_edit ?? false;

  // Home's numbers and reminder rows (and the old /couple/rsvps links) open
  // this list on a filter.
  const params = useLocalSearchParams<{ filter?: string }>();
  const [filter, setFilter] = useState<Filter>(asFilter(params.filter) ?? "all");
  const [seenParam, setSeenParam] = useState(params.filter);
  if (params.filter !== seenParam) {
    setSeenParam(params.filter);
    const f = asFilter(params.filter);
    if (f) setFilter(f);
  }
  const [q, setQ] = useState("");

  const home = useCoupleHome();
  const pages = useGuestPages(q, filter === "changed" ? "all" : filter, { enabled: filter !== "changed" });
  // The list keeps the old rows while a search refetches (no flicker), but a
  // new filter chip must never show the previous filter's rows under it
  // (seen on the sims: Pending lit over "Going" rows): skeletons until the
  // filter's own page arrives.
  const [dataFilter, setDataFilter] = useState(filter);
  if (filter !== "changed" && !pages.isPlaceholderData && pages.data && dataFilter !== filter) setDataFilter(filter);
  const filterLoading = filter !== "changed" && pages.isPlaceholderData && dataFilter !== filter;
  const changed = useCoupleRsvps("changed");
  const pendingRsvps = useCoupleRsvps("pending");
  const settings = useCoupleSettings();

  // One set of numbers everywhere: the wedding totals Home shows.
  const totals = home.data?.totals ?? pages.totals;
  const changedCount = changed.data?.items.length;
  const counts: Record<Filter, number | undefined> = {
    all: totals?.parties,
    pending: totals?.pending_parties,
    attending: totals?.attending_parties,
    declined: totals?.declined_parties,
    changed: changedCount,
  };
  const replied = totals ? totals.attending_parties + totals.declined_parties : 0;

  const rows: Row_[] = useMemo(() => {
    if (filter === "changed") {
      const term = q.trim().toLowerCase();
      return (changed.data?.items ?? [])
        .filter((r) => !term || r.name.toLowerCase().includes(term))
        .map((r) => {
          const via = r.channel ? fmt(copy.rsvps.via, { channel: (copy.rsvps.channelNames as Record<string, string>)[r.source ?? r.channel] ?? r.channel }) : "";
          return { id: r.id, guest_id: r.guest_id, name: r.name, initials: r.initials, status: r.status, party: r.party_size ?? 1, sub: [r.updated_at ? relTime(r.updated_at, lang) : "", via].filter(Boolean).join(" · "), changed: true };
        });
    }
    if (filterLoading) return [];
    return pages.items.map((g) => ({ id: g.id, guest_id: g.id, name: g.name, initials: g.initials, status: g.status, party: g.party_size }));
  }, [filter, q, changed.data, pages.items, copy.rsvps, lang, filterLoading]);

  const listQuery = filter === "changed" ? changed : pages;
  const isLoading = filter === "changed" ? changed.isLoading : pages.isLoading || filterLoading;
  const pull = usePullRefresh(() => Promise.all([listQuery.refetch(), home.refetch(), pendingRsvps.refetch(), changed.refetch()]));
  const openGuest = useCallback((id: string) => router.push({ pathname: "/couple/guests/[id]", params: { id } }), [router]);

  // ---- reminder bar (Pending): who one Remind actually reaches (B2)
  const reach = (pendingRsvps.data ?? {}) as Reach;
  const hasReach = typeof reach.pending_remindable === "number";
  const pendingParties = pendingRsvps.data?.totals.pending_parties ?? totals?.pending_parties ?? 0;
  const remindN = hasReach ? (reach.pending_remindable ?? 0) : pendingParties;
  const withoutPhone = typeof reach.pending_without_phone === "number" ? reach.pending_without_phone : 0;
  const remindedRecently = hasReach && typeof reach.pending_with_phone === "number" ? Math.max(0, reach.pending_with_phone - remindN) : 0;
  const deadline = pendingRsvps.data?.deadline ? dayMonth(pendingRsvps.data.deadline, lang) : "";
  const noPhoneGuests = useMemo(() => (pendingRsvps.data?.items ?? []).filter((i) => (i as { has_phone?: boolean }).has_phone === false && i.guest_id), [pendingRsvps.data]);

  const [remindOpen, setRemindOpen] = useState(false);
  const [noPhoneOpen, setNoPhoneOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendKey, setSendKey] = useState("");
  const [remindError, setRemindError] = useState<string | null>(null);

  function openRemind() {
    setSendKey(newSendKey());
    setRemindError(null);
    setRemindOpen(true);
  }

  async function remindAll() {
    if (busy || !sendKey) return;
    setBusy(true);
    setRemindError(null);
    try {
      const pendingList = await get<{ items: { guest_id: string | null; has_phone?: boolean }[] }>("/couple/rsvps?filter=pending");
      // Guests the portal says have no phone are left out (it would skip them).
      const ids = pendingList.items.filter((i) => i.has_phone !== false).map((i) => i.guest_id).filter((x): x is string => !!x);
      // The approved template, the count on the button and this sheet are the
      // confirmation: no typed SEND (N21). The portal asks for the word in the
      // body for more than one guest, so the app sends it.
      const r = await postOnce<{ sent?: number; failed?: number; skipped?: number }>("/couple/rsvps/remind", { guest_ids: ids, confirm: "send" }, sendKey);
      setRemindOpen(false);
      toast(fmt(copy.rsvps.remindSent, { n: r.sent ?? ids.length, failed: r.failed ?? 0, skipped: r.skipped ?? 0 }));
      await qc.invalidateQueries({ queryKey: ["couple-rsvps"] });
    } catch (err) {
      if (outcomeUnknown(err)) {
        // The run may have gone out: never leave the sheet armed for a second one.
        setRemindOpen(false);
        toast(copy.rsvps.remindUnknownTitle, { icon: "warning", ms: 8000 });
        void qc.invalidateQueries({ queryKey: ["couple-rsvps"] });
      } else {
        setRemindError(errorText(err, lang, copy.common.errorBody));
      }
    } finally {
      setBusy(false);
    }
  }

  // ---- header menu and export
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<ExportPreset | null>(null);
  const [exportAbort, setExportAbort] = useState<AbortController | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  function closeExport() {
    exportAbort?.abort();
    setExportOpen(false);
  }

  async function runExport(preset: ExportPreset) {
    if (exporting) return;
    const controller = new AbortController();
    setExportAbort(controller);
    setExporting(preset);
    setExportError(null);
    try {
      await exportGuests({ preset, lang, signal: controller.signal });
      setExportOpen(false);
    } catch (err) {
      if (!controller.signal.aborted) setExportError(errorText(err, lang, tools.failed));
    } finally {
      setExporting(null);
      setExportAbort(null);
    }
  }

  function menu(action: () => void) {
    setMenuOpen(false);
    // Let the menu sheet close before the next screen or sheet opens.
    setTimeout(action, 260);
  }

  const term = q.trim();
  const header = (
    <View>
      <View style={{ paddingHorizontal: 24 }}>
        <TopBar
          right={
            <Row gap={4}>
              {canEdit ? (
                <Button
                  label={c.guests.sendReminder}
                  icon="bell"
                  kind="ghost"
                  small
                  full={false}
                  onPress={() => router.push({ pathname: "/couple/broadcasts/new", params: { audience: "pending", template: "rsvp_reminder" } } as never)}
                  testID="guests-send-reminder"
                />
              ) : null}
              <IconButton name="more" label={c.guests.moreOptions} onPress={() => setMenuOpen(true)} testID="guests-menu" />
              {canEdit ? <IconButton name="plus" label={c.guests.add} onPress={() => router.push("/couple/guests/new")} testID="fab-add" /> : null}
            </Row>
          }
        />
        <View style={{ marginTop: 10 }}>
          <BigTitle title={c.guests.title} sub={totals ? c.guests.subtitle(totals.parties, replied) : ""} />
        </View>
        {/* Saved rows shown offline say so (QA Sep 29). */}
        {rows.length && (!online || listQuery.isError) ? (
          <View style={{ marginTop: 14 }}>
            <StaleBanner onRetry={() => retryConnection(listQuery.refetch)} />
          </View>
        ) : null}
        <Input accessibilityLabel={c.guests.search} icon="search" value={q} onChangeText={setQ} placeholder={c.guests.search} autoCorrect={false} style={{ marginTop: 18 }} />
      </View>
      <View style={{ marginTop: 12 }}>
        <FadedChipRow selected={FILTERS.indexOf(filter)}>
          {FILTERS.map((f) => (
            <Chip key={f} label={counts[f] !== undefined ? `${c.guests.filters[f]} ${counts[f]}` : c.guests.filters[f]} on={filter === f} onPress={() => setFilter(f)} testID={`guests-filter-${f}`} />
          ))}
        </FadedChipRow>
      </View>
      {filter === "pending" && canEdit && pendingParties > 0 ? (
        <View style={{ paddingHorizontal: 24, marginTop: 12 }}>
          <Card kind="solid" padding={16} radiusKey="tile" border={colors.goldBorder}>
            <Row gap={12} align="flex-start">
              <Icon name="bell" size={22} color={colors.goldLight} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="body16">{c.guests.remindTitle(pendingParties)}</T>
                <T v="meta13" color={colors.ivory70}>
                  {deadline ? c.guests.remindDeadline(deadline) : c.guests.remindNoDeadline}
                </T>
              </View>
            </Row>
            <Button label={hasReach ? c.guests.remindWithPhone(remindN) : c.guests.remindPending(remindN)} icon="phone" small onPress={openRemind} disabled={!remindN || !online} style={{ marginTop: 12 }} testID="guests-remind" />
            {withoutPhone > 0 ? (
              <Row gap={6} style={{ justifyContent: "center", marginTop: 6 }}>
                <T v="meta13" color={colors.ivory70}>
                  {c.guests.withoutPhone(withoutPhone)} ·
                </T>
                <Pressable onPress={() => setNoPhoneOpen(true)} accessibilityRole="button" accessibilityLabel={`${c.guests.addPhones}, ${c.guests.withoutPhone(withoutPhone)}`} style={{ minHeight: 44, justifyContent: "center" }}>
                  <T v="meta13" color={colors.goldLight}>
                    {c.guests.addPhones}
                  </T>
                </Pressable>
              </Row>
            ) : null}
          </Card>
        </View>
      ) : null}
      <View style={{ height: 8 }} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <Screen scroll={false} padded={false} topInset={false} contentStyle={{ flex: 1 }} scrollY={scrim.scrollY}>
        <FlatList
          {...scrim.listProps}
          data={rows}
          keyExtractor={(g) => g.id}
          onEndReached={filter === "changed" ? undefined : pages.loadMore}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          // Search results scroll clear of the keyboard (K9 to K12).
          automaticallyAdjustKeyboardInsets
          refreshControl={pull.control ?? undefined}
          ListFooterComponent={filter !== "changed" && pages.isFetchingNextPage ? <ActivityIndicator color={colors.goldLight} style={{ marginVertical: 18 }} /> : null}
          ListHeaderComponent={<View style={{ paddingTop: top }}>{header}</View>}
          contentContainerStyle={[COLUMN, { paddingBottom: clearance }]}
          ListEmptyComponent={
            isLoading ? (
              <Stack gap={10} style={{ paddingHorizontal: 24, marginTop: 8 }}>
                <Skeleton h={60} />
                <Skeleton h={60} />
                <Skeleton h={60} />
              </Stack>
            ) : listQuery.isError && !listQuery.data ? (
              <QueryError onRetry={() => void listQuery.refetch()} />
            ) : !online && !listQuery.data ? (
              // Offline with nothing saved: never "Start with the people..." (S1).
              <OfflineState onRetry={() => retryConnection(listQuery.refetch)} />
            ) : term ? (
              <EmptyState title={c.guests.noResultTitle(term)} body={c.guests.noResultBody} action={canEdit ? <Button label={c.guests.addNamed(term)} kind="ghost" icon="plus" small onPress={() => router.push({ pathname: "/couple/guests/new", params: { name: term } } as never)} /> : undefined} />
            ) : filter !== "all" ? (
              <EmptyState title={c.guests.filterEmpty} body={copy.guests.filterEmptyBody} />
            ) : (
              <EmptyState title={copy.guests.emptyTitle} body={copy.guests.emptyBody} action={canEdit ? <Button label={c.guests.add} small onPress={() => router.push("/couple/guests/new")} /> : undefined} />
            )
          }
          renderItem={({ item }) => <GuestRow row={item} status={guestStatusText(c, item.status, item.party)} changedLabel={c.guests.changed} onOpen={openGuest} />}
        />
      </Screen>

      {/* Header menu: the guest list tools in one place (M8). */}
      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} top={260}>
        <T v="title26">{c.guests.menuTitle}</T>
        <MenuCard style={{ marginTop: 14 }}>
          {canEdit ? <MenuRow icon="list" title={c.guests.menu.import} sub={c.guests.menu.importSub} onPress={() => menu(() => router.push("/couple/guests/import"))} /> : null}
          <MenuRow
            icon="share"
            title={c.guests.menu.export}
            sub={c.guests.menu.exportSub}
            onPress={() =>
              menu(() => {
                setExportError(null);
                setExportOpen(true);
              })
            }
          />
          {canEdit ? <MenuRow icon="edit" title={c.guests.menu.questions} sub={c.guests.menu.questionsSub} onPress={() => menu(() => router.push("/couple/rsvps/questions"))} /> : null}
          <MenuRow icon="bell" title={c.guests.menu.auto} sub={settings.data ? (settings.data.reminders.enabled ? c.guests.menu.autoOn : c.guests.menu.autoOff) : undefined} onPress={() => menu(() => router.push("/couple/settings/reminders"))} />
          <MenuRow icon="mail" title={c.guests.menu.share} sub={c.guests.menu.shareSub} onPress={() => menu(() => void shareInvite())} last />
        </MenuCard>
      </Sheet>

      <Sheet visible={exportOpen} onClose={closeExport} top={300}>
        <T v="title26">{c.guests.exportTitle}</T>
        <T v="body15" color={colors.ivory70} style={{ marginTop: 6 }}>
          {tools.exportSub}
        </T>
        <View style={{ marginTop: 12 }}>
          <ChipRow>
            {(["full", "attending", "pending", "declined", "contacts", "per_person", "dietary", "seating"] as ExportPreset[]).map((p) => (
              <Chip key={p} label={exporting === p ? tools.preparing : tools.presets[p]} on={exporting === p} onPress={() => void runExport(p)} />
            ))}
          </ChipRow>
        </View>
        {exportError ? (
          <T v="body15" color={colors.red} style={{ marginTop: 10 }}>
            {exportError}
          </T>
        ) : null}
      </Sheet>

      {/* Remind the pending guests who have a phone: the approved template,
          no typing (B2, N21). */}
      <Sheet
        visible={remindOpen}
        onClose={() => !busy && setRemindOpen(false)}
        top={320}
        footer={<SheetActions onCancel={() => !busy && setRemindOpen(false)} onSave={remindAll} saving={busy} disabled={busy || !remindN} saveLabel={fmt(copy.rsvps.remindSendTo, { n: remindN })} saveTestID="guests-remind-send" />}
      >
        <T v="title30">{hasReach ? c.guests.remindWithPhone(remindN) : copy.rsvps.remindOne}</T>
        <T v="body15" color={colors.ivory70} style={{ marginTop: 8 }}>
          {!remindN ? copy.rsvps.remindNoneReachable : hasReach ? plural(remindN, copy.rsvps.remindSheetBody) : fmt(copy.rsvps.remindSheetLegacy, { n: remindN })}
        </T>
        {withoutPhone > 0 ? (
          <T v="meta13" color={colors.ivory55} style={{ marginTop: 10 }}>
            {plural(withoutPhone, copy.rsvps.remindNoPhone)}
          </T>
        ) : null}
        {remindedRecently > 0 ? (
          <T v="meta13" color={colors.ivory55} style={{ marginTop: 6 }}>
            {plural(remindedRecently, copy.rsvps.remindRecent)}
          </T>
        ) : null}
        {remindError ? (
          <T v="body15" color={colors.red} style={{ marginTop: 10 }}>
            {remindError}
          </T>
        ) : null}
      </Sheet>

      {/* Pending guests without a phone: tap one to open their card and add it. */}
      <Sheet visible={noPhoneOpen} onClose={() => setNoPhoneOpen(false)} top={200}>
        <T v="title26">{c.guests.noPhoneTitle(withoutPhone)}</T>
        <T v="body15" color={colors.ivory70} style={{ marginTop: 6, marginBottom: 8 }}>
          {c.guests.noPhoneBody}
        </T>
        {noPhoneGuests.map((g, i) => (
          <ListRow
            key={g.id}
            leading={<Avatar initials={g.initials} />}
            title={g.name}
            trailing={
              <T v="meta13" color={colors.goldLight}>
                {c.guests.addPhones}
              </T>
            }
            chevron={false}
            onPress={() => {
              setNoPhoneOpen(false);
              setTimeout(() => openGuest(g.guest_id!), 260);
            }}
            last={i === noPhoneGuests.length - 1}
          />
        ))}
      </Sheet>
    </View>
  );
}

const GuestRow = React.memo(function GuestRow({ row, status, changedLabel, onOpen }: { row: Row_; status: string; changedLabel: string; onOpen: (id: string) => void }) {
  const tone = statusColor(row.status);
  return (
    <View style={{ paddingHorizontal: 24 }}>
      <Pressable
        onPress={row.guest_id ? () => onOpen(row.guest_id!) : undefined}
        disabled={!row.guest_id}
        accessibilityRole="button"
        accessibilityLabel={`${row.name}, ${status}${row.changed ? `, ${changedLabel}` : ""}`}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
      >
        <Avatar initials={row.initials} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <T v="body16" color={colors.ivory90} numberOfLines={1}>
            {row.name}
          </T>
          <Row gap={6}>
            <Icon name={statusIcon(row.status)} size={14} color={tone} />
            <T v="meta13" color={colors.ivory70} numberOfLines={1} style={{ flexShrink: 1 }}>
              {status}
              {row.sub ? ` · ${row.sub}` : ""}
            </T>
          </Row>
        </View>
        {row.changed ? <Badge label={changedLabel} kind="gold" /> : null}
        {row.guest_id ? <Icon name="chev" size={18} color={colors.ivory40} /> : null}
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.ivory09, borderRadius: radius.chip },
});

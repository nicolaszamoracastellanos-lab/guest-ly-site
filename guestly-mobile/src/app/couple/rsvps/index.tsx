// RSVPs: three tiles, filters, the list, record and remind.

import React, { useState } from "react";
import { View, FlatList, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, plural, useCopy, useLang, relTime, shortDate } from "@/i18n";
import { get } from "@/lib/api";
import { useOnline } from "@/lib/query";
import { errorText, newSendKey, outcomeUnknown, postOnce } from "@/features/shared/requests";
import { useCoupleRsvps } from "@/lib/hooks";
import { useUserSession } from "@/lib/session";
import {
  Screen,
  TopBar,
  Wordmark,
  IconButton,
  BigTitle,
  Chip,
  ChipRow,
  ListRow,
  Avatar,
  Badge,
  Button,
  Card,
  T,
  Skeleton,
  Stack,
  Sheet,
  SheetActions,
  useTopInset,
  useBottomClearance,
  COLUMN,
  QueryError,
  EmptyState,
  DockedActions,
  ButtonRow,
  StatRow,
  labelLines,
  useScrimScroll,
  StaleBanner,
  OfflineState,
  usePullRefresh,
  retryConnection,
} from "@/ui";
import { colors } from "@/ui/tokens";

const FILTERS = ["all", "pending", "changed", "attending", "declined"] as const;

export default function CoupleRsvps() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useUserSession();
  const { clearance } = useBottomClearance();
  const [dock, setDock] = useState(0);
  const top = useTopInset();
  const scrim = useScrimScroll();
  // Home's briefing rows may open this list on a filter (v1.2, N13).
  const params = useLocalSearchParams<{ filter?: string }>();
  const initial = FILTERS.find((f) => f === params.filter) ?? "all";
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(initial);
  const [seenParam, setSeenParam] = useState(params.filter);
  if (params.filter !== seenParam) {
    setSeenParam(params.filter);
    if (params.filter) setFilter(initial);
  }
  const rsvps = useCoupleRsvps(filter);
  const { data, isLoading } = rsvps;
  const [remindOpen, setRemindOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // One key per send attempt (the sheet opening), reused if Remind is tapped
  // again in the same sheet, so the portal can refuse a duplicate run.
  const [sendKey, setSendKey] = useState("");
  const canEdit = user?.me.can_edit ?? false;
  const totals = data?.totals;
  const online = useOnline();
  // Offline with nothing saved for this filter the counts are unknown: say
  // so, never "0 parties still to answer" or "Remind 0 pending" (QA Sep 29).
  const known = totals !== undefined;
  const pending = totals?.pending_parties ?? 0;
  const troubled = !online || rsvps.isError;
  // Who one Remind actually reaches (B2). A portal from v1.2 on sends it; the
  // portal before that does not, and then the button keeps the old count.
  const reach = (data ?? {}) as Reach;
  const hasReach = typeof reach.pending_remindable === "number";
  const remindN = hasReach ? (reach.pending_remindable ?? 0) : pending;
  const withoutPhone = typeof reach.pending_without_phone === "number" ? reach.pending_without_phone : 0;
  const remindedRecently = hasReach && typeof reach.pending_with_phone === "number" ? Math.max(0, reach.pending_with_phone - remindN) : 0;
  const remindLabel = !known ? copy.rsvps.remindOne : hasReach ? plural(remindN, copy.rsvps.remindWithPhone) : fmt(copy.rsvps.remind, { n: pending });
  // Pull down to refresh the list and the counts (S2).
  const pull = usePullRefresh(() => rsvps.refetch());

  // The API sends "3 of 3" in English; show it in the app language.
  const seatsLabel = (v: string) => {
    const m = /^(\d+) of (\d+)$/.exec(v.trim());
    return m ? fmt(copy.rsvps.seatsOf, { a: m[1], b: m[2] }) : v;
  };

  function openRemind() {
    setSendKey(newSendKey());
    setRemindOpen(true);
  }

  function closeRemind() {
    if (busy) return;
    setRemindOpen(false);
  }

  async function remindAll() {
    if (busy || !sendKey) return;
    setBusy(true);
    try {
      const pendingList = await get<{ items: { guest_id: string | null; has_phone?: boolean }[] }>("/couple/rsvps?filter=pending");
      // Guests the portal says have no phone are left out (it would skip them).
      const ids = pendingList.items
        .filter((i) => i.has_phone !== false)
        .map((i) => i.guest_id)
        .filter((x): x is string => !!x);
      const r = await postOnce<{
        sent?: number;
        failed?: number;
        skipped?: number;
        outcomes?: unknown[];
      }>(
        "/couple/rsvps/remind",
        // The approved template, the count on the button and this sheet are
        // the confirmation: no typed SEND (N21). The portal asks for the word
        // in the body for more than one guest, so the app sends it.
        { guest_ids: ids, confirm: "send" },
        sendKey,
      );
      setRemindOpen(false);
      Alert.alert(
        copy.rsvps.remindOne,
        fmt(copy.rsvps.remindSent, {
          n: r.sent ?? ids.length,
          failed: r.failed ?? 0,
          skipped: r.skipped ?? 0,
        }),
      );
      await qc.invalidateQueries({ queryKey: ["couple-rsvps"] });
    } catch (err) {
      if (outcomeUnknown(err)) {
        // The run may have gone out: never leave the sheet armed for a second one.
        setRemindOpen(false);
        Alert.alert(copy.rsvps.remindUnknownTitle, copy.rsvps.remindUnknownBody);
        void qc.invalidateQueries({ queryKey: ["couple-rsvps"] });
      } else {
        Alert.alert(copy.common.error, errorText(err, lang, copy.common.errorBody));
      }
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <View style={{ paddingHorizontal: 24 }}>
      <TopBar
        left={<Wordmark height={20} />}
        right={
          <IconButton name="bell" label={copy.coupleHome.tabs.messages} onPress={() => router.push("/couple/messages")} />
        }
      />
      <View style={{ marginTop: 18 }}>
        <BigTitle
          title={copy.rsvps.title}
          sub={
            !known
              ? troubled
                ? copy.rsvps.countsOffline
                : undefined
              : data?.deadline
                ? fmt(copy.rsvps.subtitle, {
                    deadline: shortDate(data.deadline, lang),
                    pending,
                  })
                : fmt(copy.rsvps.subtitleNoDeadline, { pending })
          }
        />
      </View>
      {known && troubled ? (
        <View style={{ marginTop: 14 }}>
          <StaleBanner onRetry={() => void rsvps.refetch()} />
        </View>
      ) : null}
      <StatRow style={{ marginTop: 18 }}>
        <Tile
          label={copy.rsvps.tiles.attending}
          n={totals?.attending_seats}
          unit={copy.rsvps.tiles.seats}
          color={colors.goldLight}
          highlight
        />
        <Tile
          label={copy.rsvps.tiles.declined}
          n={totals?.declined_seats}
          unit={copy.rsvps.tiles.seats}
        />
        <Tile
          label={copy.rsvps.tiles.pending}
          n={totals?.pending_parties}
          unit={copy.rsvps.tiles.parties}
          color={colors.amber}
        />
      </StatRow>
      <View style={{ marginTop: 14 }}>
        <ChipRow>
          {FILTERS.map((f) => (
            <Chip
              key={f}
              label={copy.rsvps.filters[f]}
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
          refreshControl={pull.control ?? undefined}
          data={data?.items ?? []}
          keyExtractor={(r) => r.id}
          ListHeaderComponent={
            <View style={{ paddingTop: top }}>{header}</View>
          }
          contentContainerStyle={[COLUMN, { paddingBottom: clearance + (canEdit ? dock : 0) }]}
          ListEmptyComponent={
            isLoading ? (
              <Stack gap={10} style={{ paddingHorizontal: 24, marginTop: 16 }}>
                <Skeleton h={60} />
                <Skeleton h={60} />
              </Stack>
            ) : rsvps.isError ? (
              <QueryError onRetry={() => void rsvps.refetch()} />
            ) : !online && !data ? (
              // Offline with nothing saved: "we cannot look", never "no answers yet" (S1).
              <OfflineState onRetry={() => retryConnection(rsvps.refetch)} />
            ) : (
              <EmptyState title={copy.rsvps.emptyTitle} body={copy.rsvps.emptyBody} />
            )
          }
          renderItem={({ item: r }) => (
            <View style={{ paddingHorizontal: 24 }}>
              <ListRow
                leading={<Avatar initials={r.initials} />}
                title={r.name}
                sub={`${seatsLabel(r.seats_answered)}${r.updated_at ? ` · ${relTime(r.updated_at, lang)}` : ""}${r.channel ? ` · ${fmt(copy.rsvps.via, { channel: (copy.rsvps.channelNames as Record<string, string>)[r.source ?? r.channel] ?? r.channel })}` : ""}`}
                trailing={
                  <Badge
                    label={
                      r.status === "attending"
                        ? copy.rsvps.filters.attending
                        : r.status === "declined"
                          ? copy.rsvps.filters.declined
                          : copy.rsvps.filters.pending
                    }
                    kind={
                      r.status === "attending"
                        ? "green"
                        : r.status === "pending"
                          ? "amber"
                          : "mute"
                    }
                  />
                }
                onPress={
                  r.guest_id
                    ? () =>
                        router.push({
                          pathname: "/couple/guests/[id]",
                          params: { id: r.guest_id! },
                        })
                    : undefined
                }
                chevron={false}
              />
            </View>
          )}
        />
      </Screen>
      {canEdit ? (
        <DockedActions onHeight={setDock}>
          <ButtonRow>
            <Button label={copy.rsvps.record} small icon="plus" onPress={() => router.push("/couple/rsvps/record")} />
            <Button label={remindLabel} small kind="glass" onPress={openRemind} disabled={!known || !remindN || !online} />
          </ButtonRow>
        </DockedActions>
      ) : null}
      <Sheet
        visible={remindOpen}
        onClose={closeRemind}
        top={320}
        footer={<SheetActions onCancel={closeRemind} onSave={remindAll} saving={busy} disabled={busy || !remindN} saveLabel={fmt(copy.rsvps.remindSendTo, { n: remindN })} />}
      >
        <T v="title30">{copy.rsvps.remindOne}</T>
        <T v="body15" color={colors.ivory70} style={{ marginTop: 8 }}>
          {!remindN ? copy.rsvps.remindNoneReachable : hasReach ? plural(remindN, copy.rsvps.remindSheetBody) : fmt(copy.rsvps.remindSheetLegacy, { n: pending })}
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
      </Sheet>
    </View>
  );
}

/** Reminder reach fields the v1.2 portal adds to GET /couple/rsvps (B2). */
type Reach = {
  pending?: number;
  pending_with_phone?: number;
  pending_without_phone?: number;
  pending_remindable?: number;
};

function Tile({
  label,
  n,
  unit,
  color = colors.ivory,
  highlight,
}: {
  label: string;
  n?: number;
  unit: string;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <Card
      kind="glass"
      radiusKey="tile"
      padding={12}
      style={{ flex: 1, minWidth: 0, gap: 2 }}
      border={highlight ? "rgba(201,169,110,0.5)" : undefined}
    >
      {/* One word shrinks to fit instead of breaking mid word ("PENDIENT / ES"). */}
      <View style={{ minHeight: 32, justifyContent: "flex-end" }}>
        <T v="label11" color={colors.ivory55} numberOfLines={labelLines(label)} adjustsFontSizeToFit minimumFontScale={0.7} style={{ letterSpacing: 1 }}>
          {label}
        </T>
      </View>
      <T v="title34" color={color} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
        {n ?? "·"}
      </T>
      <T v="meta13" color={colors.ivory55} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {unit}
      </T>
    </Card>
  );
}

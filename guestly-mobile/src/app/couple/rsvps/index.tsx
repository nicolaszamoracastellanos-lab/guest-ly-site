// RSVPs: three tiles, filters, the list, record and remind.

import React, { useState } from "react";
import { View, FlatList, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useCopy, useLang, relTime, shortDate } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
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
  Input,
  useTopInset,
  useBottomClearance,
  COLUMN,
  QueryError,
  EmptyState,
  DockedActions,
  ButtonRow,
  StatRow,
  labelLines,
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
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const rsvps = useCoupleRsvps(filter);
  const { data, isLoading } = rsvps;
  const [remindOpen, setRemindOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const canEdit = user?.me.can_edit ?? false;
  const totals = data?.totals;
  const pending = totals?.pending_parties ?? 0;

  // The API sends "3 of 3" in English; show it in the app language.
  const seatsLabel = (v: string) => {
    const m = /^(\d+) of (\d+)$/.exec(v.trim());
    return m ? fmt(copy.rsvps.seatsOf, { a: m[1], b: m[2] }) : v;
  };

  async function remindAll() {
    setBusy(true);
    try {
      const pendingList = await (
        await import("@/lib/api")
      ).get<{ items: { guest_id: string | null }[] }>(
        "/couple/rsvps?filter=pending",
      );
      const ids = pendingList.items
        .map((i) => i.guest_id)
        .filter((x): x is string => !!x);
      const r = await post<{
        sent?: number;
        skipped?: number;
        outcomes?: unknown[];
      }>("/couple/rsvps/remind", { guest_ids: ids, confirm });
      setRemindOpen(false);
      Alert.alert(
        copy.rsvps.remindOne,
        fmt(copy.rsvps.remindSent, {
          n: r.sent ?? ids.length,
          skipped: r.skipped ?? 0,
        }),
      );
      await qc.invalidateQueries({ queryKey: ["couple-rsvps"] });
    } catch (err) {
      Alert.alert(
        copy.common.error,
        err instanceof ApiFailure ? err.messages[lang] : "",
      );
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
            data?.deadline
              ? fmt(copy.rsvps.subtitle, {
                  deadline: shortDate(data.deadline, lang),
                  pending,
                })
              : fmt(copy.rsvps.subtitleNoDeadline, { pending })
          }
        />
      </View>
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
      <Screen scroll={false} padded={false} topInset={false} contentStyle={{ flex: 1 }}>
        <FlatList
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
            <Button label={fmt(copy.rsvps.remind, { n: pending })} small kind="glass" onPress={() => setRemindOpen(true)} disabled={!pending} />
          </ButtonRow>
        </DockedActions>
      ) : null}
      <Sheet
        visible={remindOpen}
        onClose={() => setRemindOpen(false)}
        top={320}
      >
        <T v="title30">{copy.rsvps.remindOne}</T>
        <T v="body15" color={colors.ivory70} style={{ marginTop: 8 }}>
          {fmt(copy.rsvps.remindConfirm, { n: pending })}
        </T>
        <Input
          value={confirm}
          onChangeText={setConfirm}
          placeholder={copy.rsvps.remindTyped}
          autoCapitalize="characters"
          style={{ marginTop: 16 }}
        />
        <Button
          label={fmt(copy.rsvps.remind, { n: pending })}
          onPress={remindAll}
          loading={busy}
          disabled={!["send", "enviar"].includes(confirm.trim().toLowerCase())}
          style={{ marginTop: 14 }}
        />
      </Sheet>
    </View>
  );
}

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

// RSVPs: three tiles, filters, the list, record and remind.

import React, { useState } from "react";
import { View, FlatList, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useCopy, useLang, relTime, shortDate } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { useCoupleRsvps } from "@/lib/hooks";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, Wordmark, IconButton, BigTitle, Chip, ChipRow, ListRow, Avatar, Badge, Button, Row, Card, T, Skeleton, Stack, Sheet, Input, useTopInset } from "@/ui";
import { colors, TAB_BAR_HEIGHT, TAB_BAR_BOTTOM } from "@/ui/tokens";

const FILTERS = ["all", "pending", "changed", "attending", "declined"] as const;

export default function CoupleRsvps() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useUserSession();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const { data, isLoading } = useCoupleRsvps(filter);
  const [remindOpen, setRemindOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const canEdit = user?.me.can_edit ?? false;
  const totals = data?.totals;
  const pending = totals?.pending_parties ?? 0;

  async function remindAll() {
    setBusy(true);
    try {
      const pendingList = await (await import("@/lib/api")).get<{ items: { guest_id: string | null }[] }>("/couple/rsvps?filter=pending");
      const ids = pendingList.items.map((i) => i.guest_id).filter((x): x is string => !!x);
      const r = await post<{ sent?: number; skipped?: number; outcomes?: unknown[] }>("/couple/rsvps/remind", { guest_ids: ids, confirm });
      setRemindOpen(false);
      Alert.alert(copy.rsvps.remindOne, fmt(copy.rsvps.remindSent, { n: r.sent ?? ids.length, skipped: r.skipped ?? 0 }));
      await qc.invalidateQueries({ queryKey: ["couple-rsvps"] });
    } catch (err) {
      Alert.alert(copy.common.error, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <View style={{ paddingHorizontal: 24 }}>
      <TopBar left={<Wordmark height={20} />} right={<IconButton name="bell" onPress={() => router.push("/couple/messages")} />} />
      <View style={{ marginTop: 18 }}>
        <BigTitle title={copy.rsvps.title} sub={data?.deadline ? fmt(copy.rsvps.subtitle, { deadline: shortDate(data.deadline, lang), pending }) : fmt(copy.rsvps.subtitleNoDeadline, { pending })} />
      </View>
      <Row gap={8} style={{ marginTop: 18 }}>
        <Tile label={copy.rsvps.tiles.attending} n={totals?.attending_seats} unit={copy.rsvps.tiles.seats} color={colors.goldLight} highlight />
        <Tile label={copy.rsvps.tiles.declined} n={totals?.declined_seats} unit={copy.rsvps.tiles.seats} />
        <Tile label={copy.rsvps.tiles.pending} n={totals?.pending_parties} unit={copy.rsvps.tiles.parties} color={colors.amber} />
      </Row>
      <View style={{ marginTop: 14 }}>
        <ChipRow>
          {FILTERS.map((f) => (
            <Chip key={f} label={copy.rsvps.filters[f]} on={filter === f} onPress={() => setFilter(f)} />
          ))}
        </ChipRow>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <Screen scroll={false} padded={false} bottomInset={0} contentStyle={{ flex: 1 }}>
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(r) => r.id}
          ListHeaderComponent={<View style={{ paddingTop: top - 4 }}>{header}</View>}
          contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + insets.bottom + 90 }}
          ListEmptyComponent={
            isLoading ? (
              <Stack gap={10} style={{ paddingHorizontal: 24, marginTop: 16 }}>
                <Skeleton h={60} />
                <Skeleton h={60} />
              </Stack>
            ) : null
          }
          renderItem={({ item: r }) => (
            <View style={{ paddingHorizontal: 24 }}>
              <ListRow
                leading={<Avatar initials={r.initials} />}
                title={r.name}
                sub={`${r.seats_answered}${r.updated_at ? ` · ${relTime(r.updated_at, lang)}` : ""}${r.channel ? ` · ${fmt(copy.rsvps.via, { channel: (copy.rsvps.channelNames as Record<string, string>)[r.source ?? r.channel] ?? r.channel })}` : ""}`}
                trailing={<Badge label={r.status === "attending" ? copy.rsvps.filters.attending : r.status === "declined" ? copy.rsvps.filters.declined : copy.rsvps.filters.pending} kind={r.status === "attending" ? "green" : r.status === "pending" ? "amber" : "mute"} />}
                onPress={r.guest_id ? () => router.push({ pathname: "/couple/guests/[id]", params: { id: r.guest_id! } }) : undefined}
                chevron={false}
              />
            </View>
          )}
        />
      </Screen>
      {canEdit ? (
        <Row gap={8} style={{ position: "absolute", left: 20, right: 20, bottom: TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + insets.bottom + 14 }}>
          <View style={{ flex: 1 }}>
            <Button label={copy.rsvps.record} small icon="plus" onPress={() => router.push("/couple/rsvps/record")} style={{ minHeight: 50 }} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={fmt(copy.rsvps.remind, { n: pending })} small kind="glass" onPress={() => setRemindOpen(true)} disabled={!pending} style={{ minHeight: 50 }} />
          </View>
        </Row>
      ) : null}
      <Sheet visible={remindOpen} onClose={() => setRemindOpen(false)} top={320}>
        <T v="title30">{copy.rsvps.remindOne}</T>
        <T v="body15" color={colors.ivory70} style={{ marginTop: 8 }}>
          {fmt(copy.rsvps.remindConfirm, { n: pending })}
        </T>
        <Input value={confirm} onChangeText={setConfirm} placeholder={copy.rsvps.remindTyped} autoCapitalize="characters" style={{ marginTop: 16 }} />
        <Button label={fmt(copy.rsvps.remind, { n: pending })} onPress={remindAll} loading={busy} disabled={!["send", "enviar"].includes(confirm.trim().toLowerCase())} style={{ marginTop: 14 }} />
      </Sheet>
    </View>
  );
}

function Tile({ label, n, unit, color = colors.ivory, highlight }: { label: string; n?: number; unit: string; color?: string; highlight?: boolean }) {
  return (
    <Card kind="glass" radiusKey="tile" padding={12} style={{ flex: 1, gap: 2 }} border={highlight ? "rgba(201,169,110,0.5)" : undefined}>
      <T v="label11" size={10} color={colors.ivory55}>
        {label}
      </T>
      <T v="title34" color={color}>
        {n ?? "·"}
      </T>
      <T v="meta13" color={colors.ivory55}>
        {unit}
      </T>
    </Card>
  );
}

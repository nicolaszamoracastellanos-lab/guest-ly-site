// Vendor directory: search, status filter, three stats, rows.

import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { useOnline } from "@/lib/query";
import { Screen, TopBar, BigTitle, Card, T, Row, Stack, Button, IconButton, Input, ListRow, StatTile, Badge, Chip, ChipRow, Banner, EmptyState, Skeleton, Avatar } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "../copy";
import { useVendors, useVendorsBase, type VendorStatus } from "../hooks";
import { formatMoneyShort, formatMoney } from "../../budget/money";

const STATUS_ORDER: VendorStatus[] = ["shortlist", "contacted", "quoted", "booked", "done", "cancelled"];

export function statusKind(s: VendorStatus): "green" | "amber" | "gold" | "mute" | "red" {
  return s === "booked" || s === "done" ? "green" : s === "quoted" ? "gold" : s === "contacted" ? "amber" : "mute";
}

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function VendorsListScreen() {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const online = useOnline();
  const base = useVendorsBase();
  const routePrefix = base.startsWith("/planner") ? "/planner/vendors" : "/couple/vendors";
  const { data, isLoading } = useVendors();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<VendorStatus | null>(null);

  const vendors = data?.vendors ?? [];
  const canEdit = (data?.can_edit ?? false) && online;
  const currency = data?.base_currency ?? "USD";

  const filtered = useMemo(() => {
    const term = fold(q.trim());
    return vendors.filter((v) => (!status || v.status === status) && (!term || fold(`${v.name} ${v.contact_name} ${v.notes} ${copy.categories[v.category] ?? ""}`).includes(term)));
  }, [vendors, q, status, copy.categories]);

  const booked = vendors.filter((v) => v.status === "booked" || v.status === "done");
  const quotedTotal = vendors.reduce((s, v) => s + (v.price_quoted ?? 0), 0);
  const bookedTotal = booked.reduce((s, v) => s + (v.price_quoted ?? 0), 0);

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={copy.title} right={canEdit ? <IconButton name="plus" label={copy.add} onPress={() => router.push({ pathname: "/couple/vendors/new" as never })} /> : undefined} />}>
      <BigTitle title={copy.title} sub={copy.subtitle} size={38} />
      {!online ? (
        <View style={{ marginTop: 14 }}>
          <Banner icon="wifi-off" title={copy.offline} />
        </View>
      ) : null}
      {data?.pending ? (
        <View style={{ marginTop: 14 }}>
          <Banner icon="clock" title={copy.pending} />
        </View>
      ) : null}
      {data && !data.can_edit ? (
        <T v="meta13" color={colors.ivory55} style={{ marginTop: 10 }}>
          {copy.readOnly}
        </T>
      ) : null}

      {isLoading && !data ? (
        <Stack gap={10} style={{ marginTop: 20 }}>
          <Skeleton h={90} r={18} />
          <Skeleton h={200} r={18} />
        </Stack>
      ) : null}

      {data && vendors.length === 0 && !data.pending ? (
        <View style={{ marginTop: 24 }}>
          <EmptyState title={copy.emptyTitle} body={copy.emptyBody} action={canEdit ? <Button label={copy.add} icon="plus" onPress={() => router.push({ pathname: "/couple/vendors/new" as never })} /> : undefined} />
        </View>
      ) : null}

      {vendors.length ? (
        <>
          <Row gap={8} style={{ marginTop: 18 }}>
            <StatTile value={String(vendors.length)} label={copy.statVendors} />
            <StatTile value={`${booked.length}`} label={`${copy.statBooked} · ${formatMoneyShort(bookedTotal, currency, lang)}`} color={colors.green} />
            <StatTile value={formatMoneyShort(quotedTotal, currency, lang)} label={copy.statQuoted} color={colors.goldLight} />
          </Row>
          <View style={{ marginTop: 14 }}>
            <Input icon="search" value={q} onChangeText={setQ} placeholder={copy.search} autoCorrect={false} />
          </View>
          <View style={{ marginTop: 10 }}>
            <ChipRow>
              <Chip label={copy.all} on={status === null} onPress={() => setStatus(null)} />
              {STATUS_ORDER.map((s) => (
                <Chip key={s} label={copy.statuses[s]} on={status === s} onPress={() => setStatus(status === s ? null : s)} />
              ))}
            </ChipRow>
          </View>
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 18, marginTop: 14 }}>
            {filtered.length === 0 ? (
              <View style={{ paddingVertical: 16 }}>
                <T v="body15" color={colors.ivory55}>
                  {copy.noMatches}
                </T>
              </View>
            ) : null}
            {filtered.map((v, i) => (
              <ListRow
                key={v.id}
                leading={<Avatar initials={v.name.slice(0, 2).toUpperCase()} />}
                title={v.name}
                sub={`${copy.categories[v.category] ?? v.category}${v.price_quoted !== null ? ` · ${formatMoney(v.price_quoted, v.currency ?? currency, lang)}` : ""}${v.rating ? ` · ${"★".repeat(v.rating)}` : ""}`}
                trailing={<Badge label={copy.statuses[v.status] ?? v.status} kind={statusKind(v.status)} />}
                onPress={() => router.push({ pathname: `${routePrefix}/[id]` as never, params: { id: v.id } as never })}
                last={i === filtered.length - 1}
              />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

// One vendor: contact actions, quote, rating, linked budget lines, tasks.

import React, { useState } from "react";
import { View, Pressable, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { useOnline } from "@/lib/query";
import { Screen, TopBar, BigTitle, Card, T, Row, Stack, Button, IconButton, Badge, Sheet, ListRow, Skeleton, SectionLabel, Icon, Hairline, ActionTile } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "../copy";
import { useVendors, useVendorWrites, useVendorsBase, waDigits, websiteHref, instagramHref } from "../hooks";
import { statusKind } from "./List";
import { formatMoney } from "../../budget/money";
import { ConfirmSheet, KeyValue, useAction } from "../../budget/ui";

export function VendorDetailScreen() {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const online = useOnline();
  const base = useVendorsBase();
  const params = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useVendors();
  const writes = useVendorWrites();
  const { busy, act } = useAction();
  const [linkOpen, setLinkOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const vendor = data?.vendors.find((v) => v.id === params.id) ?? null;
  const canEdit = (data?.can_edit ?? false) && online && !base.startsWith("/planner");
  const currency = data?.base_currency ?? "USD";
  const linked = (data?.items ?? []).filter((i) => i.vendor_id === params.id);
  const unlinked = (data?.items ?? []).filter((i) => !i.vendor_id);
  const tasks = (data?.tasks ?? []).filter((t) => t.vendor_id === params.id);

  const tel = vendor?.phone ? `tel:${vendor.phone.replace(/[^\d+]/g, "")}` : null;
  const wa = vendor?.phone && waDigits(vendor.phone) ? `https://wa.me/${waDigits(vendor.phone)}` : null;
  const mail = vendor?.email ? `mailto:${vendor.email}` : null;
  const web = vendor ? websiteHref(vendor.website) : null;
  const ig = vendor ? instagramHref(vendor.instagram) : null;

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={copy.title} right={canEdit && vendor ? <IconButton name="edit" label={copy.edit} onPress={() => router.push({ pathname: "/couple/vendors/new" as never, params: { id: vendor.id } as never })} /> : undefined} />}>
      {isLoading && !data ? (
        <Stack gap={10} style={{ marginTop: 8 }}>
          <Skeleton h={60} r={18} />
          <Skeleton h={160} r={18} />
        </Stack>
      ) : null}
      {vendor ? (
        <>
          <BigTitle title={vendor.name} sub={copy.categories[vendor.category] ?? vendor.category} size={34} />
          <Row gap={8} style={{ marginTop: 8 }}>
            <Badge label={copy.statuses[vendor.status] ?? vendor.status} kind={statusKind(vendor.status)} />
            {vendor.rating ? (
              <T v="body15" color={colors.goldLight}>
                {"★".repeat(vendor.rating)}
                <T v="body15" color={colors.ivory25}>
                  {"★".repeat(5 - vendor.rating)}
                </T>
              </T>
            ) : null}
          </Row>

          <Row gap={8} style={{ marginTop: 16 }}>
            {tel ? <ActionTile icon="phone" label={copy.call} onPress={() => Linking.openURL(tel)} /> : null}
            {wa ? <ActionTile icon="chat" label={copy.whatsapp} onPress={() => Linking.openURL(wa)} /> : null}
            {mail ? <ActionTile icon="mail" label={copy.mail} onPress={() => Linking.openURL(mail)} /> : null}
            {web ? <ActionTile icon="globe" label={copy.open} onPress={() => Linking.openURL(web)} /> : null}
          </Row>

          <Card kind="solid" padding={16} style={{ marginTop: 14 }}>
            {vendor.contact_name ? <KeyValue label={copy.contactName} value={vendor.contact_name} /> : null}
            {vendor.phone ? <KeyValue label={copy.phone} value={vendor.phone} /> : null}
            {vendor.email ? <KeyValue label={copy.email} value={vendor.email} /> : null}
            {vendor.instagram && ig ? (
              <Pressable onPress={() => Linking.openURL(ig)} accessibilityRole="link">
                <KeyValue label={copy.instagram} value={vendor.instagram} color={colors.goldLight} />
              </Pressable>
            ) : null}
            {vendor.address ? <KeyValue label={copy.address} value={vendor.address} /> : null}
            <KeyValue label={copy.priceQuoted} value={vendor.price_quoted === null ? "·" : formatMoney(vendor.price_quoted, vendor.currency ?? currency, lang)} color={colors.goldLight} />
            {vendor.notes ? (
              <T v="body15" color={colors.ivory70} style={{ marginTop: 10 }}>
                {vendor.notes}
              </T>
            ) : null}
          </Card>

          <Row style={{ justifyContent: "space-between", marginTop: 22, marginBottom: 8 }}>
            <SectionLabel>{copy.linkedItems}</SectionLabel>
            {canEdit ? (
              <Pressable onPress={() => setLinkOpen(true)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
                <T v="meta13" color={colors.goldLight}>
                  + {copy.linkItem}
                </T>
              </Pressable>
            ) : null}
          </Row>
          <Card kind="solid" padding={14}>
            {linked.length === 0 ? (
              <T v="body15" color={colors.ivory55}>
                {copy.noLinked}
              </T>
            ) : null}
            {linked.map((it, i) => (
              <View key={it.id}>
                <Row style={{ justifyContent: "space-between", minHeight: 48 }}>
                  <View style={{ flex: 1 }}>
                    <T v="body16">{it.title}</T>
                    <T v="meta13" color={colors.ivory55}>
                      {it.budget_name}
                      {it.total_base !== null ? ` · ${formatMoney(it.total_base, it.base_currency, lang)}` : ""}
                    </T>
                  </View>
                  {canEdit ? (
                    <Pressable onPress={() => act(() => writes.unlink(vendor.id, it.id))} accessibilityRole="button" accessibilityLabel={copy.unlink} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                      <Icon name="x" size={18} color={colors.ivory55} />
                    </Pressable>
                  ) : null}
                </Row>
                {i < linked.length - 1 ? <Hairline /> : null}
              </View>
            ))}
          </Card>

          {tasks.length ? (
            <>
              <SectionLabel style={{ marginTop: 22, marginBottom: 8 }}>{copy.tasks}</SectionLabel>
              <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
                {tasks.map((t, i) => (
                  <ListRow key={t.id} title={t.title} chevron={false} trailing={<Badge label={copy.taskStatus[t.status] ?? t.status} kind={t.status === "done" ? "green" : t.status === "in_progress" ? "amber" : "mute"} />} last={i === tasks.length - 1} />
                ))}
              </Card>
            </>
          ) : null}

          {canEdit ? (
            <View style={{ marginTop: 18 }}>
              <Button label={copy.delete} kind="text" small onPress={() => setDeleteOpen(true)} />
            </View>
          ) : null}

          <Sheet visible={linkOpen} onClose={() => setLinkOpen(false)} top={140}>
            <View style={{ paddingHorizontal: 24, gap: 12, flex: 1 }}>
              <T v="title26">{copy.linkItem}</T>
              {unlinked.length === 0 ? (
                <T v="body15" color={colors.ivory55}>
                  {copy.noUnlinked}
                </T>
              ) : null}
              <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
                {unlinked.slice(0, 40).map((it, i) => (
                  <ListRow key={it.id} title={it.title} sub={`${it.budget_name}${it.vendor_text ? ` · ${it.vendor_text}` : ""}`} onPress={() => act(() => writes.link(vendor.id, it.id), () => setLinkOpen(false))} last={i === Math.min(unlinked.length, 40) - 1} />
                ))}
              </Card>
            </View>
          </Sheet>

          <ConfirmSheet visible={deleteOpen} title={copy.delete} body={copy.deleteBody} confirmLabel={copy.confirm} cancelLabel={copy.cancel} busy={busy} onClose={() => setDeleteOpen(false)} onConfirm={() => act(() => writes.remove(vendor.id), () => router.back())} />
        </>
      ) : null}
    </Screen>
  );
}

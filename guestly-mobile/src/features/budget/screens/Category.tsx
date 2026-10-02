// One category: its lines with amounts and paid state, add, reorder, rename.
// id "none" is the group without a category. "Add line" opens the shared
// AddLineSheet with this category picked (v1.2, N15).

import React, { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { useOnline } from "@/lib/query";
import { Screen, TopBar, BigTitle, Card, T, Row, Stack, Button, IconButton, Sheet, SheetActions, Skeleton, EmptyState, Icon } from "@/ui";
import { AddLineSheet } from "../AddLineSheet";
import { colors } from "@/ui/tokens";
import { COPY } from "../copy";
import { useBudgetSurface, useBudgetWrites, useBudgetBase, type ComputedItem } from "../hooks";
import { formatMoney } from "../money";
import { StatusBadge, TextField, ConfirmSheet, useAction } from "../ui";
import { useSafeBack } from "@/lib/nav";
import { VendorChip, useLineVendorOf } from "../VendorLink";

export function BudgetCategoryScreen() {
  const copy = useFeatureCopy(COPY);
  const vendorOf = useLineVendorOf();
  const { lang } = useLang();
  const router = useRouter();
  const back = useSafeBack();
  const online = useOnline();
  const base = useBudgetBase();
  const routePrefix = base.startsWith("/planner") ? "/planner/budget" : "/couple/budget";
  const params = useLocalSearchParams<{ id: string; b?: string; add?: string }>();
  const mainQuery = useBudgetSurface(params.b ?? null);
  const { data, isLoading } = mainQuery;
  const writes = useBudgetWrites();
  const { busy, act } = useAction();

  const active = data?.active ?? null;
  const currency = active?.budget.currency ?? "USD";
  const canEdit = (data?.can_edit ?? false) && online;
  const group = useMemo(() => active?.computed.groups.find((g) => (g.category?.id ?? "none") === params.id) ?? null, [active, params.id]);
  const category = group?.category ?? null;
  const title = category?.name ?? copy.uncategorized;

  const [addOpen, setAddOpen] = useState(params.add === "1");
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState("");

  async function move(index: number, dir: -1 | 1) {
    if (!active || !group) return;
    const ids = group.items.map((i) => i.row.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    await act(() => writes.reorderItems(active.budget.id, ids));
  }

  function amountOf(it: ComputedItem): string {
    return it.totalBase === null ? copy.noPrice : formatMoney(it.totalBase, currency, lang);
  }

  return (
    <Screen query={mainQuery} refresh
      header={
        <TopBar
          onBack={back}
          title={active?.budget.name ?? copy.title}
          right={
            canEdit && category ? (
              <IconButton
                name="edit"
                label={copy.renameCategory}
                onPress={() => {
                  setName(category.name);
                  setRenameOpen(true);
                }}
              />
            ) : undefined
          }
        />
      }
    >
      <BigTitle title={title} sub={group ? `${formatMoney(group.totalBase, currency, lang)} · ${copy.paid.toLowerCase()} ${formatMoney(group.paidBase, currency, lang)}` : undefined} size={36} />

      {isLoading && !data ? (
        <Stack gap={10} style={{ marginTop: 20 }}>
          <Skeleton h={72} r={18} />
          <Skeleton h={72} r={18} />
        </Stack>
      ) : null}

      {data && (!group || group.items.length === 0) ? (
        <View style={{ marginTop: 20 }}>
          <EmptyState title={copy.items} action={canEdit ? <Button label={copy.addItem} icon="plus" onPress={() => setAddOpen(true)} /> : undefined} />
        </View>
      ) : null}

      {group && group.items.length ? (
        <Stack gap={8} style={{ marginTop: 18 }}>
          {group.items.map((it, index) => (
            <Pressable key={it.row.id} onPress={() => router.push({ pathname: `${routePrefix}/item/[id]` as never, params: { id: it.row.id, b: active!.budget.id } as never })} accessibilityRole="button">
              <Card kind="solid" padding={14}>
                <Row style={{ justifyContent: "space-between" }} align="flex-start">
                  <View style={{ flex: 1, gap: 4 }}>
                    <T v="body16">{it.row.title}</T>
                    {/* The line's vendor (F5: vendors live inside Budget): a
                        linked one opens its details and contact. */}
                    {vendorOf(it.row.id, it.row.vendor_id) ? (
                      <VendorChip id={vendorOf(it.row.id, it.row.vendor_id)!} fallback={it.row.vendor} />
                    ) : it.row.vendor ? (
                      <T v="meta13" color={colors.ivory55}>
                        {it.row.vendor}
                      </T>
                    ) : null}
                    <Row gap={8} style={{ marginTop: 4 }}>
                      <StatusBadge status={it.row.status} labels={copy.statuses} />
                      {it.children.length ? (
                        <T v="meta13" color={colors.ivory55}>
                          +{it.children.length}
                        </T>
                      ) : null}
                    </Row>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <T v="body16" color={it.unpriced ? colors.amber : colors.ivory}>
                      {amountOf(it)}
                    </T>
                    {it.paidBase > 0 ? (
                      <T v="meta13" color={colors.green}>
                        {copy.paid} {formatMoney(it.paidBase, currency, lang)}
                      </T>
                    ) : null}
                    {canEdit ? (
                      <Row gap={2} style={{ marginTop: 2 }}>
                        <Pressable onPress={() => move(index, -1)} accessibilityRole="button" accessibilityLabel={copy.moveUp} disabled={index === 0} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", opacity: index === 0 ? 0.3 : 1 }}>
                          <View style={{ transform: [{ rotate: "180deg" }] }}>
                            <Icon name="down" size={18} color={colors.ivory55} />
                          </View>
                        </Pressable>
                        <Pressable onPress={() => move(index, 1)} accessibilityRole="button" accessibilityLabel={copy.moveDown} disabled={index === group.items.length - 1} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", opacity: index === group.items.length - 1 ? 0.3 : 1 }}>
                          <Icon name="down" size={18} color={colors.ivory55} />
                        </Pressable>
                      </Row>
                    ) : null}
                  </View>
                </Row>
              </Card>
            </Pressable>
          ))}
        </Stack>
      ) : null}

      {canEdit && group && group.items.length ? (
        <View style={{ marginTop: 16 }}>
          <Button label={copy.addItem} icon="plus" kind="glass" onPress={() => setAddOpen(true)} />
        </View>
      ) : null}
      {canEdit && category ? (
        <View style={{ marginTop: 8 }}>
          <Button label={copy.deleteCategory} kind="text" small onPress={() => setDeleteOpen(true)} />
        </View>
      ) : null}

      {active ? (
        // The same sheet as on the summary, with this category picked; the line
        // can still go to another one (N15).
        <AddLineSheet visible={addOpen && canEdit} onClose={() => setAddOpen(false)} budgetId={active.budget.id} categories={active.categories} categoryId={category?.id ?? null} />
      ) : null}

      <Sheet
        visible={renameOpen}
        onClose={() => setRenameOpen(false)}
        top={380}
        footer={<SheetActions onCancel={() => setRenameOpen(false)} onSave={() => category && act(() => writes.renameCategory(category.id, name.trim()), () => setRenameOpen(false))} saving={busy} disabled={!name.trim()} cancelLabel={copy.cancel} saveLabel={copy.save} />}
      >
        <View style={{ gap: 12 }}>
          <T v="title26">{copy.renameCategory}</T>
          <TextField label={copy.categoryName} value={name} onChange={setName} autoCapitalize="sentences" />
        </View>
      </Sheet>

      <ConfirmSheet visible={deleteOpen} title={copy.deleteCategory} body={copy.deleteCategoryBody} confirmLabel={copy.delete} cancelLabel={copy.cancel} busy={busy} onClose={() => setDeleteOpen(false)} onConfirm={() => category && act(() => writes.deleteCategory(category.id), () => back())} />
    </Screen>
  );
}

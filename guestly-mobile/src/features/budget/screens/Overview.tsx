// Budget overview: totals, progress, categories, upcoming months. Couple and
// planner share it; the surface decides the route prefix.

import React, { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLang, fmt } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { useOnline } from "@/lib/query";
import { Screen, TopBar, BigTitle, Card, T, Row, Stack, Button, IconButton, ListRow, StatTile, Sheet, Banner, EmptyState, Skeleton, SectionLabel, Chip, ChipRow, Hairline } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "../copy";
import { useBudgetSurface, useBudgetWrites, useBudgetBase, type BudgetRow } from "../hooks";
import { formatMoney, formatMoneyShort, formatMonth, parseAmount, numText } from "../money";
import { ProgressBar, TextField, ConfirmSheet, useAction } from "../ui";

const SELECTED_KEY = "budget-selected";

export function BudgetOverviewScreen() {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const online = useOnline();
  const base = useBudgetBase();
  const routePrefix = base.startsWith("/planner") ? "/planner/budget" : "/couple/budget";
  const [selected, setSelected] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const { data, isLoading, refetch } = useBudgetSurface(restored ? selected : undefined);
  const writes = useBudgetWrites();
  const { busy, act } = useAction();

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(SELECTED_KEY)
      .then((v) => {
        if (alive) setSelected(v);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setRestored(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  function choose(id: string) {
    setSelected(id);
    AsyncStorage.setItem(SELECTED_KEY, id).catch(() => {});
  }

  const [budgetSheet, setBudgetSheet] = useState<"create" | "edit" | null>(null);
  const [categorySheet, setCategorySheet] = useState(false);
  const [archiveSheet, setArchiveSheet] = useState(false);
  const [form, setForm] = useState({ name: "", currency: "USD", alt_currency: "", fx_rate: "1", guest_count: "", notes: "" });
  const [categoryName, setCategoryName] = useState("");

  const active = data?.active ?? null;
  const computed = active?.computed;
  const totals = computed?.totals;
  const currency = active?.budget.currency ?? "USD";
  const canEdit = (data?.can_edit ?? false) && online;

  function openEdit(b: BudgetRow) {
    setForm({ name: b.name, currency: b.currency, alt_currency: b.alt_currency ?? "", fx_rate: numText(b.fx_rate) || "1", guest_count: numText(b.guest_count), notes: b.notes ?? "" });
    setBudgetSheet("edit");
  }
  function openCreate() {
    setForm({ name: "", currency: currency || "USD", alt_currency: "", fx_rate: "1", guest_count: "", notes: "" });
    setBudgetSheet("create");
  }
  async function saveBudget() {
    const body = {
      name: form.name.trim(),
      currency: form.currency.trim().toUpperCase(),
      alt_currency: form.alt_currency.trim() ? form.alt_currency.trim().toUpperCase() : null,
      fx_rate: parseAmount(form.fx_rate) ?? 1,
      guest_count: form.guest_count.trim() ? parseAmount(form.guest_count) : null,
      notes: form.notes,
    };
    await act(async () => {
      if (budgetSheet === "edit" && active) await writes.updateBudget(active.budget.id, body);
      else {
        const r = await writes.createBudget(body);
        choose(r.id);
      }
    }, () => setBudgetSheet(null));
  }

  const months = (computed?.months ?? []).filter((m) => m.plannedBase > 0).slice(0, 4);

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={copy.title} right={active && canEdit ? <IconButton name="gear" label={copy.settings} onPress={() => openEdit(active.budget)} /> : undefined} />}>
      <BigTitle title={active ? active.budget.name : copy.title} sub={copy.subtitle} size={38} />

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
          <Skeleton h={160} r={18} />
        </Stack>
      ) : null}

      {data && !data.pending && data.budgets.length === 0 ? (
        <View style={{ marginTop: 24 }}>
          <EmptyState
            title={copy.emptyTitle}
            body={copy.emptyBody}
            action={
              data.can_edit ? (
                <Stack gap={8} style={{ width: "100%" }}>
                  <Button label={copy.createBudget} icon="plus" onPress={openCreate} disabled={!online} />
                  <Button label={copy.importBudget} kind="glass" icon="camera" onPress={() => router.push({ pathname: `${routePrefix}/import` as never })} disabled={!online} />
                </Stack>
              ) : undefined
            }
          />
        </View>
      ) : null}

      {data && data.budgets.length > 1 ? (
        <View style={{ marginTop: 16 }}>
          <SectionLabel>{copy.switchBudget}</SectionLabel>
          <View style={{ marginTop: 8 }}>
            <ChipRow>
              {data.budgets.map((b) => (
                <Chip key={b.id} label={b.name} on={active?.budget.id === b.id} onPress={() => choose(b.id)} />
              ))}
            </ChipRow>
          </View>
        </View>
      ) : null}

      {active && totals ? (
        <>
          <Row gap={8} style={{ marginTop: 18 }}>
            <StatTile value={formatMoneyShort(totals.totalBase, currency, lang)} label={copy.total} />
            <StatTile value={formatMoneyShort(totals.paidBase, currency, lang)} label={copy.paid} color={colors.green} />
            <StatTile value={formatMoneyShort(totals.balanceBase, currency, lang)} label={copy.remaining} color={colors.goldLight} />
          </Row>
          <Card kind="solid" padding={16} style={{ marginTop: 10 }}>
            <Row style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <T v="meta13" color={colors.ivory55}>
                {copy.paid} {Math.round(totals.paidFraction * 100)}%
              </T>
              {totals.perGuestBase !== null ? (
                <T v="meta13" color={colors.ivory55}>
                  {formatMoney(totals.perGuestBase, currency, lang)} {copy.perGuest}
                </T>
              ) : null}
            </Row>
            <ProgressBar fraction={totals.paidFraction} />
            {totals.plannedBase > 0 ? (
              <T v="meta13" color={colors.ivory55} style={{ marginTop: 10 }}>
                {copy.planned}: {formatMoney(totals.plannedBase, currency, lang)}
              </T>
            ) : null}
            {totals.unpricedCount > 0 ? (
              <T v="meta13" color={colors.amber} style={{ marginTop: 6 }}>
                {fmt(copy.unpriced, { n: totals.unpricedCount })}
              </T>
            ) : null}
            {computed?.hasForeignCurrency ? (
              <T v="meta13" color={colors.amber} style={{ marginTop: 6 }}>
                {copy.foreign}
              </T>
            ) : null}
          </Card>

          <Row style={{ justifyContent: "space-between", marginTop: 22, marginBottom: 8 }}>
            <SectionLabel>{copy.categories}</SectionLabel>
            {canEdit ? (
              <Pressable onPress={() => setCategorySheet(true)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
                <T v="meta13" color={colors.goldLight}>
                  + {copy.addCategory}
                </T>
              </Pressable>
            ) : null}
          </Row>
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
            {computed!.groups.map((g, i) => {
              const id = g.category?.id ?? "none";
              const name = g.category?.name ?? copy.uncategorized;
              const sub = `${g.items.length} ${copy.items.toLowerCase()} · ${copy.paid.toLowerCase()} ${formatMoneyShort(g.paidBase, currency, lang)}`;
              return (
                <ListRow
                  key={id}
                  title={name}
                  sub={sub}
                  trailing={
                    <T v="body16" color={g.unpricedCount ? colors.amber : colors.ivory}>
                      {formatMoneyShort(g.totalBase, currency, lang)}
                    </T>
                  }
                  onPress={() => router.push({ pathname: `${routePrefix}/category/[id]` as never, params: { id, b: active.budget.id } as never })}
                  last={i === computed!.groups.length - 1}
                />
              );
            })}
            {computed!.groups.length === 0 ? (
              <View style={{ paddingVertical: 16 }}>
                <T v="body15" color={colors.ivory55}>
                  {copy.emptyBody}
                </T>
              </View>
            ) : null}
          </Card>

          {canEdit ? (
            <Row gap={8} style={{ marginTop: 14 }}>
              <View style={{ flex: 1 }}>
                <Button label={copy.addItem} small icon="plus" onPress={() => router.push({ pathname: `${routePrefix}/category/[id]` as never, params: { id: "none", b: active.budget.id, add: "1" } as never })} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label={copy.importBudget} small kind="glass" icon="camera" onPress={() => router.push({ pathname: `${routePrefix}/import` as never, params: { b: active.budget.id } as never })} />
              </View>
            </Row>
          ) : null}

          {months.length ? (
            <View style={{ marginTop: 22 }}>
              <SectionLabel>{copy.months}</SectionLabel>
              <Card kind="glass" padding={14} style={{ marginTop: 8 }}>
                {months.map((m, i) => (
                  <View key={m.key}>
                    <Row style={{ justifyContent: "space-between", minHeight: 36 }}>
                      <T v="body15" color={colors.ivory70}>
                        {formatMonth(m.key, lang)}
                      </T>
                      <T v="body15">{formatMoney(m.plannedBase, currency, lang)}</T>
                    </Row>
                    {i < months.length - 1 ? <Hairline /> : null}
                  </View>
                ))}
              </Card>
            </View>
          ) : null}

          {canEdit ? (
            <View style={{ marginTop: 18 }}>
              <Button label={copy.createBudget} kind="text" small onPress={openCreate} />
            </View>
          ) : null}
        </>
      ) : null}

      <Sheet visible={budgetSheet !== null} onClose={() => setBudgetSheet(null)} top={90}>
        <View style={{ paddingHorizontal: 24, gap: 12 }}>
          <T v="title26">{budgetSheet === "edit" ? copy.settings : copy.createBudget}</T>
          <TextField label={copy.name} value={form.name} onChange={(v) => setForm({ ...form, name: v })} autoCapitalize="sentences" />
          <Row gap={8}>
            <View style={{ flex: 1 }}>
              <TextField label={copy.currency} value={form.currency} onChange={(v) => setForm({ ...form, currency: v.toUpperCase().slice(0, 3) })} autoCapitalize="characters" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label={copy.altCurrency} value={form.alt_currency} onChange={(v) => setForm({ ...form, alt_currency: v.toUpperCase().slice(0, 3) })} autoCapitalize="characters" />
            </View>
          </Row>
          {form.alt_currency ? <TextField label={copy.fxRate} value={form.fx_rate} onChange={(v) => setForm({ ...form, fx_rate: v })} keyboardType="decimal-pad" /> : null}
          <TextField label={copy.guestCount} value={form.guest_count} onChange={(v) => setForm({ ...form, guest_count: v.replace(/\D/g, "") })} keyboardType="number-pad" />
          <TextField label={copy.notes} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} multiline />
          <Row gap={8} style={{ marginTop: 4 }}>
            <View style={{ flex: 1 }}>
              <Button label={copy.cancel} kind="ghost" onPress={() => setBudgetSheet(null)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={copy.save} onPress={saveBudget} loading={busy} disabled={!form.name.trim() || form.currency.trim().length !== 3} />
            </View>
          </Row>
          {budgetSheet === "edit" ? (
            <Button
              label={copy.archive}
              kind="text"
              small
              onPress={() => {
                setBudgetSheet(null);
                setArchiveSheet(true);
              }}
            />
          ) : null}
        </View>
      </Sheet>

      <Sheet visible={categorySheet} onClose={() => setCategorySheet(false)} top={380}>
        <View style={{ paddingHorizontal: 24, gap: 12 }}>
          <T v="title26">{copy.addCategory}</T>
          <TextField label={copy.categoryName} value={categoryName} onChange={setCategoryName} autoCapitalize="sentences" />
          <Row gap={8}>
            <View style={{ flex: 1 }}>
              <Button label={copy.cancel} kind="ghost" onPress={() => setCategorySheet(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={copy.save}
                loading={busy}
                disabled={!categoryName.trim() || !active}
                onPress={() =>
                  active &&
                  act(() => writes.createCategory(active.budget.id, categoryName.trim()), () => {
                    setCategoryName("");
                    setCategorySheet(false);
                  })
                }
              />
            </View>
          </Row>
        </View>
      </Sheet>

      <ConfirmSheet
        visible={archiveSheet}
        title={copy.archive}
        body={copy.archiveBody}
        confirmLabel={copy.confirm}
        cancelLabel={copy.cancel}
        busy={busy}
        onClose={() => setArchiveSheet(false)}
        onConfirm={() =>
          active &&
          act(() => writes.archiveBudget(active.budget.id), () => {
            setArchiveSheet(false);
            setSelected(null);
            AsyncStorage.removeItem(SELECTED_KEY).catch(() => {});
            void refetch();
          })
        }
      />
    </Screen>
  );
}

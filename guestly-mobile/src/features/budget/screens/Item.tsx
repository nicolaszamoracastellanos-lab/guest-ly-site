// One budget line: fields, status, sub-lines, payments, comments, delete.

import React, { useState } from "react";
import { View, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLang, relTime } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { useOnline } from "@/lib/query";
import { Screen, TopBar, BigTitle, Card, T, Row, Stack, Button, Sheet, Skeleton, SectionLabel, Toggle, Input, Icon, Hairline, ListRow, Avatar } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "../copy";
import { useBudgetSurface, useBudgetWrites, useBudgetBase, findComputedItem, type ItemStatus, type PaymentKind, type ItemRow } from "../hooks";
import { formatMoney, formatDay, parseAmount, numText, todayIso, isIsoDate } from "../money";
import { StatusBadge, TextField, Options, ConfirmSheet, KeyValue, useAction } from "../ui";

const STATUSES: ItemStatus[] = ["quoted", "confirmed", "pending", "cancelled"];
const KINDS: PaymentKind[] = ["paid", "planned"];

function formFrom(row: ItemRow) {
  return {
    title: row.title,
    vendor: row.vendor ?? "",
    qty: numText(row.qty),
    unit_price: numText(row.unit_price),
    unit_label: row.unit_label ?? "",
    amount_override: numText(row.amount_override),
    currency: row.currency ?? "",
    status: row.status,
    note: row.note ?? "",
  };
}

export function BudgetItemScreen() {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const online = useOnline();
  const base = useBudgetBase();
  const routePrefix = base.startsWith("/planner") ? "/planner/budget" : "/couple/budget";
  const params = useLocalSearchParams<{ id: string; b?: string }>();
  const { data, isLoading } = useBudgetSurface(params.b ?? null);
  const writes = useBudgetWrites();
  const { busy, act } = useAction();

  const active = data?.active ?? null;
  const currency = active?.budget.currency ?? "USD";
  const canEdit = (data?.can_edit ?? false) && online;
  const found = findComputedItem(active?.computed, params.id);
  const item = found?.item ?? null;
  const row = item?.row ?? null;

  // Seed the form once per row; state adjusted during render, keyed on the
  // row identity, so a refetch never wipes an edit in progress.
  const [form, setForm] = useState<ReturnType<typeof formFrom> | null>(null);
  const [seeded, setSeeded] = useState<string | null>(null);
  if (row && seeded !== row.id) {
    setForm(formFrom(row));
    setSeeded(row.id);
  }

  const [payOpen, setPayOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pay, setPay] = useState({ amount: "", paid_on: todayIso(), kind: "paid" as PaymentKind, method: "", paid_by: "", reimbursable: false, note: "" });
  const [sub, setSub] = useState({ title: "", qty: "", unit_price: "", amount_override: "" });
  const [comment, setComment] = useState("");

  async function save() {
    if (!active || !row || !form) return;
    const body = {
      budget_id: active.budget.id,
      title: form.title.trim(),
      category_id: row.category_id,
      parent_id: row.parent_id,
      qty: form.qty.trim() ? parseAmount(form.qty) : null,
      unit_price: form.unit_price.trim() ? parseAmount(form.unit_price) : null,
      unit_label: form.unit_label.trim(),
      amount_override: form.amount_override.trim() ? parseAmount(form.amount_override) : null,
      currency: form.currency.trim() ? form.currency.trim().toUpperCase() : null,
      status: form.status,
      vendor: form.vendor.trim(),
      note: form.note.trim(),
    };
    await act(() => writes.updateItem(row.id, body));
  }

  async function addPayment() {
    if (!active || !row) return;
    await act(
      () =>
        writes.createPayment({
          budget_id: active.budget.id,
          item_id: row.id,
          amount: parseAmount(pay.amount),
          paid_on: pay.paid_on.trim(),
          kind: pay.kind,
          method: pay.method.trim(),
          paid_by: pay.paid_by.trim(),
          reimbursable: pay.reimbursable,
          note: pay.note.trim(),
          currency: null,
        }),
      () => {
        setPay({ amount: "", paid_on: todayIso(), kind: "paid", method: "", paid_by: "", reimbursable: false, note: "" });
        setPayOpen(false);
      }
    );
  }

  async function addSub() {
    if (!active || !row) return;
    await act(
      () =>
        writes.createItem({
          budget_id: active.budget.id,
          title: sub.title.trim(),
          category_id: row.category_id,
          parent_id: row.id,
          qty: sub.qty.trim() ? parseAmount(sub.qty) : null,
          unit_price: sub.unit_price.trim() ? parseAmount(sub.unit_price) : null,
          amount_override: sub.amount_override.trim() ? parseAmount(sub.amount_override) : null,
          status: "quoted",
          vendor: "",
          note: "",
          unit_label: "",
          currency: null,
        }),
      () => {
        setSub({ title: "", qty: "", unit_price: "", amount_override: "" });
        setSubOpen(false);
      }
    );
  }

  const payments = item?.payments ?? [];
  const comments = row?.comments ?? [];

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={found?.group.category?.name ?? copy.uncategorized} />} keyboard>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {isLoading && !data ? (
          <Stack gap={10} style={{ marginTop: 8 }}>
            <Skeleton h={60} r={18} />
            <Skeleton h={200} r={18} />
          </Stack>
        ) : null}

        {row && item && form ? (
          <>
            <BigTitle title={row.title} sub={item.totalBase === null ? copy.noPrice : formatMoney(item.totalBase, currency, lang)} size={34} />
            <Row gap={8} style={{ marginTop: 8 }}>
              <StatusBadge status={row.status} labels={copy.statuses} />
            </Row>

            <Card kind="solid" padding={16} style={{ marginTop: 16 }}>
              <KeyValue label={copy.subtotal} value={item.subtotalBase === null ? copy.noPrice : formatMoney(item.subtotalBase, currency, lang)} />
              <KeyValue label={copy.paid} value={formatMoney(item.paidBase, currency, lang)} color={colors.green} />
              <KeyValue label={copy.planned} value={formatMoney(item.plannedBase, currency, lang)} />
              <KeyValue label={copy.remaining} value={item.balanceBase === null ? copy.noPrice : formatMoney(item.balanceBase, currency, lang)} color={colors.goldLight} />
            </Card>

            <SectionLabel style={{ marginTop: 22, marginBottom: 8 }}>{copy.items}</SectionLabel>
            <Stack gap={10}>
              <TextField label={copy.itemTitle} value={form.title} onChange={(v) => setForm({ ...form, title: v })} autoCapitalize="sentences" />
              <TextField label={copy.vendor} value={form.vendor} onChange={(v) => setForm({ ...form, vendor: v })} autoCapitalize="words" />
              <Row gap={8}>
                <View style={{ flex: 1 }}>
                  <TextField label={copy.qty} value={form.qty} onChange={(v) => setForm({ ...form, qty: v })} keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField label={copy.unitPrice} value={form.unit_price} onChange={(v) => setForm({ ...form, unit_price: v })} keyboardType="decimal-pad" />
                </View>
              </Row>
              <Row gap={8}>
                <View style={{ flex: 1 }}>
                  <TextField label={copy.unitLabel} value={form.unit_label} onChange={(v) => setForm({ ...form, unit_label: v })} />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField label={copy.currency} value={form.currency} onChange={(v) => setForm({ ...form, currency: v.toUpperCase().slice(0, 3) })} autoCapitalize="characters" />
                </View>
              </Row>
              <TextField label={copy.amountOverride} value={form.amount_override} onChange={(v) => setForm({ ...form, amount_override: v })} keyboardType="decimal-pad" />
              <View style={{ gap: 6 }}>
                <T v="meta13" color={colors.ivory55}>
                  {copy.status}
                </T>
                <Options<ItemStatus> value={form.status} options={STATUSES.map((s) => ({ value: s, label: copy.statuses[s] }))} onChange={(v) => setForm({ ...form, status: v })} />
              </View>
              <TextField label={copy.note} value={form.note} onChange={(v) => setForm({ ...form, note: v })} multiline />
              {canEdit ? <Button label={copy.save} onPress={save} loading={busy} disabled={!form.title.trim()} /> : null}
            </Stack>

            {item.children.length || canEdit ? (
              <>
                <Row style={{ justifyContent: "space-between", marginTop: 22, marginBottom: 8 }}>
                  <SectionLabel>{copy.addSubItem}</SectionLabel>
                  {canEdit && !row.parent_id ? (
                    <Pressable onPress={() => setSubOpen(true)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
                      <T v="meta13" color={colors.goldLight}>
                        + {copy.addItem}
                      </T>
                    </Pressable>
                  ) : null}
                </Row>
                {item.children.length ? (
                  <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
                    {item.children.map((c, i) => (
                      <ListRow key={c.row.id} title={c.row.title} sub={copy.statuses[c.row.status]} trailing={<T v="body16">{c.totalBase === null ? copy.noPrice : formatMoney(c.totalBase, currency, lang)}</T>} onPress={() => router.push({ pathname: `${routePrefix}/item/[id]` as never, params: { id: c.row.id, b: active!.budget.id } as never })} last={i === item.children.length - 1} />
                    ))}
                  </Card>
                ) : null}
              </>
            ) : null}

            <Row style={{ justifyContent: "space-between", marginTop: 22, marginBottom: 8 }}>
              <SectionLabel>{copy.payments}</SectionLabel>
              {canEdit ? (
                <Pressable onPress={() => setPayOpen(true)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
                  <T v="meta13" color={colors.goldLight}>
                    + {copy.addPayment}
                  </T>
                </Pressable>
              ) : null}
            </Row>
            <Card kind="solid" padding={14}>
              {payments.length === 0 ? (
                <T v="body15" color={colors.ivory55}>
                  {copy.noPayments}
                </T>
              ) : null}
              {payments.map((p, i) => (
                <View key={p.id}>
                  <Row style={{ justifyContent: "space-between", minHeight: 52 }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T v="body16" color={p.kind === "paid" ? colors.green : colors.ivory}>
                        {formatMoney(p.amount, p.currency ?? currency, lang)}
                      </T>
                      <T v="meta13" color={colors.ivory55}>
                        {copy.kinds[p.kind]} · {formatDay(p.paid_on, lang)}
                        {p.method ? ` · ${p.method}` : ""}
                        {p.paid_by ? ` · ${p.paid_by}` : ""}
                        {p.reimbursable ? ` · ${copy.reimbursable}` : ""}
                      </T>
                    </View>
                    {canEdit ? (
                      <Pressable onPress={() => act(() => writes.deletePayment(p.id))} accessibilityRole="button" accessibilityLabel={copy.deletePayment} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                        <Icon name="x" size={18} color={colors.ivory55} />
                      </Pressable>
                    ) : null}
                  </Row>
                  {i < payments.length - 1 ? <Hairline /> : null}
                </View>
              ))}
            </Card>

            <SectionLabel style={{ marginTop: 22, marginBottom: 8 }}>{copy.comments}</SectionLabel>
            <Card kind="solid" padding={14}>
              {comments.map((c, i) => (
                <View key={c.id}>
                  <Row gap={10} align="flex-start" style={{ paddingVertical: 6 }}>
                    <Avatar initials={c.author_email.slice(0, 2).toUpperCase()} size={32} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <T v="meta13" color={colors.ivory55}>
                        {c.author_email} · {relTime(c.created_at, lang)}
                      </T>
                      <T v="body15">{c.body}</T>
                    </View>
                  </Row>
                  {i < comments.length - 1 ? <Hairline /> : null}
                </View>
              ))}
              {canEdit ? (
                <Row gap={8} style={{ marginTop: comments.length ? 10 : 0 }}>
                  <View style={{ flex: 1 }}>
                    <Input value={comment} onChangeText={setComment} placeholder={copy.commentPlaceholder} />
                  </View>
                  <Button
                    label={copy.send}
                    small
                    full={false}
                    kind="glass"
                    loading={busy}
                    disabled={!comment.trim()}
                    onPress={() => act(() => writes.addComment(row.id, comment.trim(), []), () => setComment(""))}
                  />
                </Row>
              ) : null}
            </Card>

            {canEdit ? (
              <View style={{ marginTop: 18 }}>
                <Button label={copy.deleteItem} kind="text" small onPress={() => setDeleteOpen(true)} />
              </View>
            ) : null}
          </>
        ) : null}
      </KeyboardAvoidingView>

      <Sheet visible={payOpen} onClose={() => setPayOpen(false)} top={90}>
        <View style={{ paddingHorizontal: 24, gap: 12 }}>
          <T v="title26">{copy.addPayment}</T>
          <Row gap={8}>
            <View style={{ flex: 1 }}>
              <TextField label={copy.amount} value={pay.amount} onChange={(v) => setPay({ ...pay, amount: v })} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label={copy.paidOn} value={pay.paid_on} onChange={(v) => setPay({ ...pay, paid_on: v })} keyboardType="numeric" />
            </View>
          </Row>
          <Options<PaymentKind> value={pay.kind} options={KINDS.map((k) => ({ value: k, label: copy.kinds[k] }))} onChange={(v) => setPay({ ...pay, kind: v })} />
          <TextField label={copy.method} value={pay.method} onChange={(v) => setPay({ ...pay, method: v })} />
          <TextField label={copy.paidBy} value={pay.paid_by} onChange={(v) => setPay({ ...pay, paid_by: v })} autoCapitalize="words" />
          <Toggle value={pay.reimbursable} onChange={(v) => setPay({ ...pay, reimbursable: v })} label={copy.reimbursable} />
          <Row gap={8} style={{ marginTop: 4 }}>
            <View style={{ flex: 1 }}>
              <Button label={copy.cancel} kind="ghost" onPress={() => setPayOpen(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={copy.save} onPress={addPayment} loading={busy} disabled={!(parseAmount(pay.amount) ?? 0) || !isIsoDate(pay.paid_on.trim())} />
            </View>
          </Row>
        </View>
      </Sheet>

      <Sheet visible={subOpen} onClose={() => setSubOpen(false)} top={160}>
        <View style={{ paddingHorizontal: 24, gap: 12 }}>
          <T v="title26">{copy.addSubItem}</T>
          <TextField label={copy.itemTitle} value={sub.title} onChange={(v) => setSub({ ...sub, title: v })} autoCapitalize="sentences" />
          <Row gap={8}>
            <View style={{ flex: 1 }}>
              <TextField label={copy.qty} value={sub.qty} onChange={(v) => setSub({ ...sub, qty: v })} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label={copy.unitPrice} value={sub.unit_price} onChange={(v) => setSub({ ...sub, unit_price: v })} keyboardType="decimal-pad" />
            </View>
          </Row>
          <TextField label={copy.amountOverride} value={sub.amount_override} onChange={(v) => setSub({ ...sub, amount_override: v })} keyboardType="decimal-pad" />
          <Row gap={8} style={{ marginTop: 4 }}>
            <View style={{ flex: 1 }}>
              <Button label={copy.cancel} kind="ghost" onPress={() => setSubOpen(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={copy.save} onPress={addSub} loading={busy} disabled={!sub.title.trim()} />
            </View>
          </Row>
        </View>
      </Sheet>

      <ConfirmSheet visible={deleteOpen} title={copy.deleteItem} body={copy.deleteItemBody} confirmLabel={copy.delete} cancelLabel={copy.cancel} busy={busy} onClose={() => setDeleteOpen(false)} onConfirm={() => row && act(() => writes.deleteItem(row.id), () => router.back())} />
    </Screen>
  );
}

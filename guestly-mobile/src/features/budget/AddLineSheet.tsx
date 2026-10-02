// "Add line" as a sheet over the screen you are on (v1.2, audit N15).
//
// Before, "Add line" on the budget overview pushed the empty "No category"
// screen with its add form on top: every line made there stayed without a
// category for good, and Cancel left you stranded on that empty screen. Now
// the sheet opens where you are, asks for the category (the last one you used
// comes first and is picked), and Cancel leaves you exactly where you were.
// The category screen uses the same sheet with its own category picked.

import React, { useEffect, useState } from "react";
import { View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fmt } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { T, Row, Sheet, SheetActions, Field } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "./copy";
import { useBudgetWrites, type CategoryRow, type ItemStatus } from "./hooks";
import { parseAmount } from "./money";
import { TextField, Options, useAction } from "./ui";

const STATUSES: ItemStatus[] = ["quoted", "confirmed", "pending", "cancelled"];
/** The value for "no category" in the picker; sent as null. */
export const NO_CATEGORY = "none";

const lastKey = (budgetId: string) => `budget-last-category:${budgetId}`;

/** The category last used for a new line in this budget, or null. Storage
 *  failures read as "none remembered". */
export async function readLastCategory(budgetId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(lastKey(budgetId));
  } catch {
    return null;
  }
}

export function rememberCategory(budgetId: string, categoryId: string) {
  AsyncStorage.setItem(lastKey(budgetId), categoryId).catch(() => {});
}

/** The category picker: the budget's categories (the remembered one first)
 *  and "No category" last. */
export function CategoryOptions({ categories, value, onChange, first, disabled }: { categories: CategoryRow[]; value: string; onChange: (id: string) => void; first?: string | null; disabled?: boolean }) {
  const copy = useFeatureCopy(COPY);
  const sorted = [...categories].sort((a, b) => (a.id === first ? -1 : b.id === first ? 1 : a.sort_order - b.sort_order));
  return <Options<string> value={value} options={[...sorted.map((c) => ({ value: c.id, label: c.name })), { value: NO_CATEGORY, label: copy.uncategorized }]} onChange={onChange} disabled={disabled} />;
}

const EMPTY = { title: "", vendor: "", qty: "", unit_price: "", amount_override: "", status: "quoted" as ItemStatus };

export function AddLineSheet({
  visible,
  onClose,
  budgetId,
  categories,
  categoryId,
  onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  budgetId: string;
  categories: CategoryRow[];
  /** Pick this category (the category screen). Omitted: the last one used. */
  categoryId?: string | null;
  onAdded?: (categoryId: string | null) => void;
}) {
  const copy = useFeatureCopy(COPY);
  const writes = useBudgetWrites();
  const { busy, act } = useAction();
  const [form, setForm] = useState(EMPTY);
  const [category, setCategory] = useState<string>(NO_CATEGORY);
  const [remembered, setRemembered] = useState<string | null>(null);

  // Each opening starts clean, with the category picked: the screen's own,
  // else the last used (if it still exists), else the first one. Seeded while
  // rendering the opening, so the sheet never shows the previous line.
  const exists = (id: string | null | undefined): id is string => !!id && categories.some((c) => c.id === id);
  const fallback = [...categories].sort((a, b) => a.sort_order - b.sort_order)[0]?.id ?? NO_CATEGORY;
  const [opened, setOpened] = useState(false);
  if (visible !== opened) {
    setOpened(visible);
    if (visible) {
      setForm(EMPTY);
      setRemembered(null);
      setCategory(categoryId !== undefined ? (exists(categoryId) ? categoryId : NO_CATEGORY) : fallback);
    }
  }
  useEffect(() => {
    if (!visible || categoryId !== undefined) return;
    let alive = true;
    void readLastCategory(budgetId).then((last) => {
      if (!alive || !exists(last)) return;
      // Only while the person has not picked one yet.
      setCategory((cur) => (cur === fallback ? last : cur));
      setRemembered(last);
    });
    return () => {
      alive = false;
    };
    // Read once per opening, not when a refetch hands new arrays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const rememberedName = remembered && remembered === category ? categories.find((c) => c.id === remembered)?.name : null;

  async function save() {
    const chosen = category === NO_CATEGORY ? null : category;
    const body = {
      budget_id: budgetId,
      title: form.title.trim(),
      category_id: chosen,
      parent_id: null,
      qty: form.qty.trim() ? parseAmount(form.qty) : null,
      unit_price: form.unit_price.trim() ? parseAmount(form.unit_price) : null,
      amount_override: form.amount_override.trim() ? parseAmount(form.amount_override) : null,
      status: form.status,
      vendor: form.vendor.trim(),
      note: "",
      unit_label: "",
      currency: null,
    };
    await act(() => writes.createItem(body), () => {
      if (chosen) rememberCategory(budgetId, chosen);
      setForm(EMPTY);
      onClose();
      onAdded?.(chosen);
    });
  }

  return (
    <Sheet visible={visible} onClose={onClose} top={70} footer={<SheetActions onCancel={onClose} onSave={save} saving={busy} disabled={!form.title.trim()} saveTestID="budget-add-line-save" />}>
      <View style={{ gap: 12 }}>
        <T v="title26">{copy.addItem}</T>
        <TextField label={copy.itemTitle} value={form.title} onChange={(v) => setForm({ ...form, title: v })} autoCapitalize="sentences" />
        <Field label={copy.category} hint={rememberedName ? fmt(copy.lastUsedCategory, { name: rememberedName }) : null}>
          <CategoryOptions categories={categories} value={category} onChange={setCategory} first={remembered} />
        </Field>
        <TextField label={copy.vendor} value={form.vendor} onChange={(v) => setForm({ ...form, vendor: v })} autoCapitalize="words" />
        <Row gap={8}>
          <View style={{ flex: 1 }}>
            <TextField label={copy.qty} value={form.qty} onChange={(v) => setForm({ ...form, qty: v })} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label={copy.unitPrice} value={form.unit_price} onChange={(v) => setForm({ ...form, unit_price: v })} keyboardType="decimal-pad" />
          </View>
        </Row>
        <TextField label={copy.amountOverride} value={form.amount_override} onChange={(v) => setForm({ ...form, amount_override: v })} keyboardType="decimal-pad" />
        <View style={{ gap: 6 }}>
          <T v="meta13" color={colors.ivory55}>
            {copy.status}
          </T>
          <Options<ItemStatus> value={form.status} options={STATUSES.map((s) => ({ value: s, label: copy.statuses[s] }))} onChange={(v) => setForm({ ...form, status: v })} />
        </View>
      </View>
    </Sheet>
  );
}

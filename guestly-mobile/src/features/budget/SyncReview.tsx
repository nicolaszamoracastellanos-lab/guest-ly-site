// The review step of "Update from Excel". Everything the comparison found is
// listed with a tick. Changes, new lines and new payments start ticked (that
// is what the person came to do); lines that vanished from the file start
// UNticked, because removing one also removes its payments and a file going
// quiet about a line is not the same as wanting it gone; planned payments the
// file now shows as paid start unticked too. Same rules as the portal's
// budget/sync-review.tsx and import-wizard.tsx.

import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useLang } from "@/i18n";
import { Banner, Card, Icon, SectionLabel, Stack, T } from "@/ui";
import { colors } from "@/ui/tokens";
import type { BudgetCopy } from "./copy";
import { formatMoney } from "./money";
import type { SyncFieldChange, SyncPlan, SyncSelection } from "./hooks";

export type SyncUi = {
  skipUpdates: Set<string>;
  skipAdds: Set<string>;
  skipPayments: Set<number>;
  skipConverts: Set<string>;
  remove: Set<string>;
};

export const emptySyncUi = (plan?: SyncPlan): SyncUi => ({
  skipUpdates: new Set(),
  skipAdds: new Set(),
  skipPayments: new Set(),
  skipConverts: new Set((plan?.paymentConverts ?? []).map((p) => p.paymentId)),
  remove: new Set(),
});

function flip<T>(set: Set<T>, v: T): Set<T> {
  const next = new Set(set);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
}

/** The proposal filtered by the ticks. Unticking a new parent takes its
 *  sub-lines and their payments with it (or they would be re-parented to
 *  nothing and inflate the budget). */
export function buildSelection(plan: SyncPlan, ui: SyncUi): SyncSelection {
  const droppedAdds = new Set(ui.skipAdds);
  for (const a of plan.additions) if (a.parentKey && droppedAdds.has(a.parentKey)) droppedAdds.add(a.key);
  return {
    updates: plan.updates.filter((u) => !ui.skipUpdates.has(u.itemId)).map((u) => ({ itemId: u.itemId, patch: u.patch })),
    additions: plan.additions.filter((a) => !droppedAdds.has(a.key)),
    paymentAdds: plan.paymentAdds.filter((p, i) => !ui.skipPayments.has(i) && !(p.itemKey && droppedAdds.has(p.itemKey))),
    paymentConverts: plan.paymentConverts.filter((p) => !ui.skipConverts.has(p.paymentId)).map((p) => ({ paymentId: p.paymentId, paid_on: p.paid_on })),
    removeItemIds: [...ui.remove],
  };
}

export function selectedCount(plan: SyncPlan, ui: SyncUi): number {
  const s = buildSelection(plan, ui);
  return s.updates.length + s.additions.length + s.paymentAdds.length + s.paymentConverts.length + s.removeItemIds.length;
}

export function isEmptyPlan(p: SyncPlan): boolean {
  return !p.updates.length && !p.additions.length && !p.paymentAdds.length && !p.paymentConverts.length && !p.missing.length;
}

export function SyncReview({ c, currency, plan, nameMatchSkipped, ui, setUi }: { c: BudgetCopy; currency: string; plan: SyncPlan; nameMatchSkipped: boolean; ui: SyncUi; setUi: React.Dispatch<React.SetStateAction<SyncUi>> }) {
  const { lang } = useLang();
  const money = (n: number) => formatMoney(n, currency, lang);
  const show = (ch: SyncFieldChange, v: string | number | null): string => {
    if (v === null || v === "") return c.syncEmptyValue;
    if (ch.field === "status") return c.syncStatus[String(v)] ?? String(v);
    if ((ch.field === "unit_price" || ch.field === "amount_override") && typeof v === "number") return money(v);
    return String(v);
  };

  return (
    <Stack gap={4}>
      <T v="meta13" color={colors.ivory70}>
        {c.syncSummary(plan.updates.length, plan.additions.length, plan.missing.length, plan.unchanged)}
      </T>

      {plan.warnings.length > 0 || nameMatchSkipped ? (
        <Card kind="glass" padding={12} style={{ marginTop: 8 }}>
          {nameMatchSkipped ? (
            <T v="meta13" color={colors.amber} style={{ marginBottom: 4 }}>
              {c.syncSkippedNames}
            </T>
          ) : null}
          {plan.warnings.map((w, i) => (
            <T key={i} v="meta13" color={colors.amber} style={{ marginTop: 4 }}>
              {w}
            </T>
          ))}
        </Card>
      ) : null}

      {isEmptyPlan(plan) ? (
        <View style={{ marginTop: 12 }}>
          <Banner icon="check" kind="gold" title={c.syncNothing} />
        </View>
      ) : null}

      {plan.updates.length > 0 ? (
        <Block title={c.syncChanged} count={plan.updates.length}>
          {plan.updates.map((u) => (
            <Tick key={u.itemId} on={!ui.skipUpdates.has(u.itemId)} onToggle={() => setUi((s) => ({ ...s, skipUpdates: flip(s.skipUpdates, u.itemId) }))} title={u.title} sub={u.parentTitle ? c.syncAddedUnder(u.parentTitle) : undefined}>
              {u.changes.map((ch) => (
                <T key={ch.field} v="meta13" color={colors.ivory55}>
                  {c.syncFields[ch.field] ?? ch.field}: {show(ch, ch.from)} → <T v="meta13" color={colors.ivory}>{show(ch, ch.to)}</T>
                </T>
              ))}
            </Tick>
          ))}
        </Block>
      ) : null}

      {plan.additions.length > 0 ? (
        <Block title={c.syncAdded} count={plan.additions.length} hint={plan.newCategories.length ? c.syncNewCategories(plan.newCategories) : undefined}>
          {plan.additions.map((a) => {
            const total = a.item.amount_override ?? (a.item.qty !== null && a.item.unit_price !== null ? a.item.qty * a.item.unit_price : null);
            const parentSkipped = a.parentKey ? ui.skipAdds.has(a.parentKey) : false;
            return <Tick key={a.key} on={!ui.skipAdds.has(a.key) && !parentSkipped} disabled={parentSkipped} onToggle={() => setUi((s) => ({ ...s, skipAdds: flip(s.skipAdds, a.key) }))} title={a.item.title} sub={a.parentTitle ? c.syncAddedUnder(a.parentTitle) : (a.item.category ?? undefined)} right={total !== null ? money(total) : undefined} />;
          })}
        </Block>
      ) : null}

      {plan.paymentAdds.length > 0 || plan.paymentConverts.length > 0 ? (
        <Block title={c.syncPayments} count={plan.paymentAdds.length + plan.paymentConverts.length} hint={plan.paymentConverts.length > 0 ? c.syncConvertHint : undefined}>
          {plan.paymentConverts.map((p) => (
            <Tick key={p.paymentId} on={!ui.skipConverts.has(p.paymentId)} onToggle={() => setUi((s) => ({ ...s, skipConverts: flip(s.skipConverts, p.paymentId) }))} title={c.syncPaymentConvert(p.itemTitle)} right={money(p.amount)} />
          ))}
          {plan.paymentAdds.map((p, i) => {
            const rowSkipped = p.itemKey ? ui.skipAdds.has(p.itemKey) : false;
            return <Tick key={`${p.itemId ?? p.itemKey}-${i}`} on={!ui.skipPayments.has(i) && !rowSkipped} disabled={rowSkipped} onToggle={() => setUi((s) => ({ ...s, skipPayments: flip(s.skipPayments, i) }))} title={c.syncPaymentNew(p.itemTitle)} sub={p.paid_on} right={money(p.amount)} />;
          })}
        </Block>
      ) : null}

      {plan.missing.length > 0 ? (
        <Block title={c.syncMissing} count={plan.missing.length} hint={c.syncMissingHint}>
          {plan.missing.map((m) => (
            <Tick key={m.itemId} on={ui.remove.has(m.itemId)} danger onToggle={() => setUi((s) => ({ ...s, remove: flip(s.remove, m.itemId) }))} title={m.title} sub={[m.parentTitle ? c.syncAddedUnder(m.parentTitle) : null, c.syncRemoveWarn(m.payments, m.children) || null].filter(Boolean).join(" · ") || undefined} right={m.total !== null ? money(m.total) : undefined} />
          ))}
        </Block>
      ) : null}
    </Stack>
  );
}

function Block({ title, count, hint, children }: { title: string; count: number; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      <SectionLabel style={{ marginBottom: 6 }}>{`${title} · ${count}`}</SectionLabel>
      {hint ? (
        <T v="meta13" color={colors.ivory55} style={{ marginBottom: 8 }}>
          {hint}
        </T>
      ) : null}
      <Card kind="solid" padding={2} style={{ paddingHorizontal: 14 }}>
        {children}
      </Card>
    </View>
  );
}

function Tick({ on, disabled, danger, onToggle, title, sub, right, children }: { on: boolean; disabled?: boolean; danger?: boolean; onToggle: () => void; title: string; sub?: string; right?: string; children?: React.ReactNode }) {
  const tint = danger ? colors.red : colors.gold;
  return (
    <Pressable onPress={disabled ? undefined : onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: !!disabled }} accessibilityLabel={title} style={({ pressed }) => [styles.row, disabled && { opacity: 0.4 }, pressed && { opacity: 0.8 }]}>
      <View style={[styles.box, on && { backgroundColor: tint, borderColor: tint }]}>{on ? <Icon name="check" size={16} color={colors.night} /> : null}</View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T v="body15">{title}</T>
        {sub ? (
          <T v="meta13" color={colors.ivory55}>
            {sub}
          </T>
        ) : null}
        {children}
      </View>
      {right ? (
        <T v="meta13" color={colors.ivory90}>
          {right}
        </T>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, minHeight: 52, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.ivory09 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.ivory40, alignItems: "center", justifyContent: "center", marginTop: 1 },
});

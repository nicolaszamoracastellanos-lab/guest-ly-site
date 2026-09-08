// Small budget-only pieces built from the shared kit.

import React, { useState } from "react";
import { View, Pressable, Alert } from "react-native";
import { ApiFailure } from "@/lib/api";
import { useLang } from "@/i18n";
import { T, Row, Badge, Button, Sheet, Stack, Input } from "@/ui";
import { colors } from "@/ui/tokens";
import type { ItemStatus } from "./hooks";

export function ProgressBar({ fraction, color = colors.gold }: { fraction: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.ivory09, overflow: "hidden" }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      <View style={{ width: `${pct * 100}%`, height: 6, backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

export function StatusBadge({ status, labels }: { status: ItemStatus; labels: Record<string, string> }) {
  const kind = status === "confirmed" ? "green" : status === "cancelled" ? "mute" : status === "pending" ? "amber" : "gold";
  return <Badge label={labels[status] ?? status} kind={kind} />;
}

export function KeyValue({ label, value, color = colors.ivory }: { label: string; value: string; color?: string }) {
  return (
    <Row style={{ justifyContent: "space-between", minHeight: 30 }}>
      <T v="meta13" color={colors.ivory55}>
        {label}
      </T>
      <T v="body16" color={color}>
        {value}
      </T>
    </Row>
  );
}

/** A destructive confirmation as a bottom sheet. */
export function ConfirmSheet({ visible, title, body, confirmLabel, cancelLabel, onConfirm, onClose, busy }: { visible: boolean; title: string; body?: string; confirmLabel: string; cancelLabel: string; onConfirm: () => void; onClose: () => void; busy?: boolean }) {
  return (
    <Sheet visible={visible} onClose={onClose} top={420}>
      <View style={{ paddingHorizontal: 24, gap: 12 }}>
        <T v="title26">{title}</T>
        {body ? (
          <T v="body15" color={colors.ivory70}>
            {body}
          </T>
        ) : null}
        <Row gap={8} style={{ marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Button label={cancelLabel} kind="ghost" onPress={onClose} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={confirmLabel} onPress={onConfirm} loading={busy} />
          </View>
        </Row>
      </View>
    </Sheet>
  );
}

/** A labelled input so forms read as a list of fields. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack gap={6}>
      <T v="meta13" color={colors.ivory55}>
        {label}
      </T>
      {children}
    </Stack>
  );
}

export function TextField({ label, value, onChange, placeholder, keyboardType, multiline, autoCapitalize }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; keyboardType?: "default" | "numeric" | "decimal-pad" | "number-pad" | "email-address" | "url" | "phone-pad"; multiline?: boolean; autoCapitalize?: "none" | "sentences" | "words" | "characters" }) {
  return (
    <Field label={label}>
      <Input value={value} onChangeText={onChange} placeholder={placeholder ?? label} keyboardType={keyboardType} multiline={multiline} autoCapitalize={autoCapitalize} style={multiline ? { borderRadius: 18, minHeight: 88 } : undefined} />
    </Field>
  );
}

/** Row of selectable options (status, kind, category). */
export function Options<TValue extends string>({ value, options, onChange }: { value: TValue | null; options: { value: TValue; label: string }[]; onChange: (v: TValue) => void }) {
  return (
    <Row gap={8} style={{ flexWrap: "wrap" }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 999, justifyContent: "center", borderWidth: 1, borderColor: on ? colors.gold : colors.ivory14, backgroundColor: on ? "rgba(201,169,110,0.16)" : "transparent" }}>
            <T v="body15" color={on ? colors.goldLight : colors.ivory70}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </Row>
  );
}

/** Runs a write, surfaces the bilingual server error, reports busy state. */
export function useAction() {
  const { lang } = useLang();
  const [busy, setBusy] = useState(false);
  async function act(fn: () => Promise<unknown>, onDone?: () => void, fallback = "") {
    setBusy(true);
    try {
      await fn();
      onDone?.();
      return true;
    } catch (err) {
      Alert.alert(err instanceof ApiFailure ? err.messages[lang] : fallback);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, act };
}

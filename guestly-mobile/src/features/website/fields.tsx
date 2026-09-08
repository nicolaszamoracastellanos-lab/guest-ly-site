// Editor building blocks: a labelled field, a bilingual field (EN and ES
// inputs side by side), a photo field that picks and uploads, and the
// up / down / remove controls for lists.

import React, { useState } from "react";
import { View, Image, Pressable, ActivityIndicator, Alert } from "react-native";
import { useLang } from "@/i18n";
import { ApiFailure } from "@/lib/api";
import { Input, T, Row, Icon, Button } from "@/ui";
import { colors, radius, FILL } from "@/ui/tokens";
import { useFeatureCopy } from "@/i18n/feature";
import { COPY } from "./copy";
import { pickAndUpload, type Bilingual } from "./hooks";

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <T v="label11" color={colors.ivory55}>
        {label}
      </T>
      {children}
      {hint ? (
        <T v="meta13" color={colors.ivory40}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

export function TextField({ label, value, onChange, placeholder, multiline, hint, keyboardType }: { label: string; value: string | null; onChange: (v: string | null) => void; placeholder?: string; multiline?: boolean; hint?: string; keyboardType?: "default" | "url" | "phone-pad" | "email-address" }) {
  return (
    <Field label={label} hint={hint}>
      <Input
        value={value ?? ""}
        onChangeText={(t) => onChange(t.length ? t : null)}
        placeholder={placeholder}
        placeholderTextColor={colors.ivory40}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === "url" || keyboardType === "email-address" ? "none" : "sentences"}
        autoCorrect={keyboardType !== "url"}
        style={multiline ? { minHeight: 110, alignItems: "flex-start", paddingTop: 12 } : undefined}
      />
    </Field>
  );
}

/** EN and ES inputs for one bilingual value. The site falls back across languages. */
export function BiField({ label, value, onChange, multiline, placeholder }: { label: string; value: Bilingual; onChange: (v: Bilingual) => void; multiline?: boolean; placeholder?: Bilingual }) {
  const c = useFeatureCopy(COPY);
  return (
    <Field label={label}>
      <View style={{ gap: 8 }}>
        <Row gap={8} align="flex-start">
          <View style={{ width: 30, paddingTop: 16 }}>
            <T v="label11" color={colors.goldLight}>
              EN
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <Input value={value.en ?? ""} onChangeText={(t) => onChange({ ...value, en: t.length ? t : null })} placeholder={placeholder?.en ?? c.en} placeholderTextColor={colors.ivory40} multiline={multiline} style={multiline ? { minHeight: 96, alignItems: "flex-start", paddingTop: 12 } : undefined} />
          </View>
        </Row>
        <Row gap={8} align="flex-start">
          <View style={{ width: 30, paddingTop: 16 }}>
            <T v="label11" color={colors.goldLight}>
              ES
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <Input value={value.es ?? ""} onChangeText={(t) => onChange({ ...value, es: t.length ? t : null })} placeholder={placeholder?.es ?? c.es} placeholderTextColor={colors.ivory40} multiline={multiline} style={multiline ? { minHeight: 96, alignItems: "flex-start", paddingTop: 12 } : undefined} />
          </View>
        </Row>
      </View>
    </Field>
  );
}

/** One photo: shows the current picture, picks and uploads a new one, or clears it. */
export function PhotoField({ label, path, uri, onChange, height = 160 }: { label: string; path: string | null; uri: string | null; onChange: (path: string | null, signedUrl?: string) => void; height?: number }) {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const [busy, setBusy] = useState(false);
  async function pick() {
    setBusy(true);
    try {
      const picked = await pickAndUpload();
      if (picked && picked[0]) onChange(picked[0].path, picked[0].url);
    } catch (err) {
      Alert.alert(c.fields.photo, err instanceof ApiFailure ? err.messages[lang] : c.errors.pickFailed);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Field label={label}>
      <View style={{ height, borderRadius: radius.tile, overflow: "hidden", backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: colors.ivory14, alignItems: "center", justifyContent: "center" }}>
        {uri ? <Image source={{ uri }} style={FILL} resizeMode="cover" /> : <Icon name="photo" size={32} color={colors.ivory40} />}
        {busy ? (
          <View style={[FILL, { alignItems: "center", justifyContent: "center", backgroundColor: colors.scrim }]}>
            <ActivityIndicator color={colors.goldLight} />
          </View>
        ) : null}
      </View>
      <Row gap={8} style={{ marginTop: 4 }}>
        <View style={{ flex: 1 }}>
          <Button label={path ? c.fields.replacePhoto : c.fields.choosePhoto} small kind="glass" icon="photo" onPress={pick} loading={busy} />
        </View>
        {path ? (
          <View style={{ flex: 1 }}>
            <Button label={c.fields.removePhoto} small kind="ghost" icon="x" onPress={() => onChange(null)} disabled={busy} />
          </View>
        ) : null}
      </Row>
    </Field>
  );
}

/** Up, down and remove for a row in an ordered list. */
export function RowControls({ onUp, onDown, onRemove }: { onUp?: () => void; onDown?: () => void; onRemove: () => void }) {
  const c = useFeatureCopy(COPY);
  const btn = (name: "down" | "x" | "back", label: string, onPress?: () => void, rotate?: string) => (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: !onPress ? 0.25 : pressed ? 0.6 : 1 })}>
      <View style={rotate ? { transform: [{ rotate }] } : undefined}>
        <Icon name={name} size={20} color={name === "x" ? colors.red : colors.ivory70} />
      </View>
    </Pressable>
  );
  return (
    <Row gap={0} style={{ justifyContent: "flex-end" }}>
      {btn("down", c.up, onUp, "180deg")}
      {btn("down", c.down, onDown)}
      {btn("x", c.remove, onRemove)}
    </Row>
  );
}

export function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function SwitchRow({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }} style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="body15">{label}</T>
        {hint ? (
          <T v="meta13" color={colors.ivory55}>
            {hint}
          </T>
        ) : null}
      </View>
      <View style={{ width: 50, height: 30, borderRadius: 15, backgroundColor: value ? colors.gold : colors.ivory14, padding: 3, justifyContent: "center" }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: value ? colors.night : colors.ivory70, alignSelf: value ? "flex-end" : "flex-start" }} />
      </View>
    </Pressable>
  );
}

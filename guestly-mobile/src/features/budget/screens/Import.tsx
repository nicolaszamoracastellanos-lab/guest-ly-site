// Read a budget from a paste, a spreadsheet or a photo, review every line,
// then save into a new or an existing budget. Nothing is written before the
// review step.

import React, { useState } from "react";
import { View, Pressable, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { readAsStringAsync } from "expo-file-system/legacy";
import { useLang, fmt } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure } from "@/lib/api";
import { useOnline } from "@/lib/query";
import { Screen, TopBar, BigTitle, Card, T, Row, Stack, Button, Input, Banner, Icon, Hairline, Chip, ChipRow } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "../copy";
import { useBudgetSurface, useBudgetWrites, type ExtractedBudget, type ExtractedItem } from "../hooks";
import { formatMoney, parseAmount } from "../money";

function lineTotal(it: ExtractedItem): number | null {
  if (it.amount_override !== null && it.amount_override !== undefined) return it.amount_override;
  if (it.qty !== null && it.unit_price !== null) return it.qty * it.unit_price;
  return null;
}

export function BudgetImportScreen() {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const online = useOnline();
  const params = useLocalSearchParams<{ b?: string }>();
  const { data } = useBudgetSurface(params.b ?? null);
  const writes = useBudgetWrites();

  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedBudget | null>(null);
  const [target, setTarget] = useState<string | null>(params.b ?? null);

  function fail(err: unknown) {
    Alert.alert(err instanceof ApiFailure ? err.messages[lang] : copy.nothingRead);
  }

  async function read(body: { text?: string; file_base64?: string; filename?: string; mime?: string }) {
    setReading(true);
    try {
      const r = await writes.extract(body);
      if (!r.extracted.items.length) Alert.alert(copy.nothingRead);
      else setExtracted(r.extracted);
    } catch (err) {
      fail(err);
    } finally {
      setReading(false);
    }
  }

  async function fromCamera(library: boolean) {
    const perm = library ? await ImagePicker.requestMediaLibraryPermissionsAsync() : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(copy.permission);
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.8, base64: true, allowsEditing: false };
    const res = library ? await ImagePicker.launchImageLibraryAsync(opts) : await ImagePicker.launchCameraAsync(opts);
    if (res.canceled || !res.assets?.[0]?.base64) return;
    const asset = res.assets[0];
    const mime = asset.mimeType ?? "image/jpeg";
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    await read({ file_base64: asset.base64!, filename: `photo.${ext}`, mime });
  }

  async function fromFile() {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: ["text/csv", "text/tab-separated-values", "text/plain", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel.sheet.macroEnabled.12", "image/*"] });
    if (res.canceled || !res.assets?.[0]) return;
    const f = res.assets[0];
    try {
      const base64 = await readAsStringAsync(f.uri, { encoding: "base64" });
      await read({ file_base64: base64, filename: f.name, mime: f.mimeType ?? undefined });
    } catch (err) {
      fail(err);
    }
  }

  function update(i: number, patch: Partial<ExtractedItem>) {
    if (!extracted) return;
    const items = extracted.items.map((it, j) => (j === i ? { ...it, ...patch } : it));
    setExtracted({ ...extracted, items });
  }
  function remove(i: number) {
    if (!extracted) return;
    setExtracted({ ...extracted, items: extracted.items.filter((_, j) => j !== i) });
  }

  async function commit() {
    if (!extracted) return;
    setSaving(true);
    try {
      const r = await writes.commit(extracted, target);
      Alert.alert(fmt(copy.imported, { items: r.items, payments: r.payments }));
      router.back();
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  }

  const currency = extracted?.base_currency ?? data?.active?.budget.currency ?? "USD";
  const budgets = data?.budgets ?? [];

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={copy.title} />} keyboard>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <BigTitle title={extracted ? copy.previewTitle : copy.importTitle} sub={extracted ? copy.previewBody : copy.importIntro} size={34} />
        {!online ? (
          <View style={{ marginTop: 14 }}>
            <Banner icon="wifi-off" title={copy.offline} />
          </View>
        ) : null}

        {!extracted ? (
          <Stack gap={10} style={{ marginTop: 20 }}>
            <Input value={text} onChangeText={setText} placeholder={copy.pastePlaceholder} multiline style={{ borderRadius: 18, minHeight: 140 }} />
            <Button label={reading ? copy.reading : copy.read} onPress={() => read({ text })} loading={reading} disabled={!text.trim() || !online} />
            <Row gap={8} style={{ marginTop: 6 }}>
              <View style={{ flex: 1 }}>
                <Button label={copy.takePhoto} small kind="glass" icon="camera" onPress={() => fromCamera(false)} disabled={reading || !online} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label={copy.choosePhoto} small kind="glass" icon="photo" onPress={() => fromCamera(true)} disabled={reading || !online} />
              </View>
            </Row>
            <Button label={copy.chooseFile} small kind="glass" icon="list" onPress={fromFile} disabled={reading || !online} />
          </Stack>
        ) : (
          <Stack gap={10} style={{ marginTop: 18 }}>
            {extracted.warnings.length ? (
              <Card kind="glass" padding={12}>
                <T v="meta13" color={colors.amber}>
                  {copy.warnings}
                </T>
                {extracted.warnings.map((w, i) => (
                  <T key={i} v="meta13" color={colors.ivory70} style={{ marginTop: 4 }}>
                    {w}
                  </T>
                ))}
              </Card>
            ) : null}
            <Card kind="solid" padding={12}>
              {extracted.items.map((it, i) => (
                <View key={it.key || String(i)}>
                  <Row gap={8} align="flex-start" style={{ paddingVertical: 6 }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Input value={it.title} onChangeText={(v) => update(i, { title: v })} style={{ minHeight: 44 }} />
                      <Row gap={8}>
                        <View style={{ flex: 1 }}>
                          <Input value={lineTotal(it) === null ? "" : String(lineTotal(it))} onChangeText={(v) => update(i, { amount_override: v.trim() ? parseAmount(v) : null, qty: null, unit_price: null })} placeholder={copy.amount} keyboardType="decimal-pad" style={{ minHeight: 44 }} />
                        </View>
                        <View style={{ flex: 1, justifyContent: "center" }}>
                          <T v="meta13" color={colors.ivory55} numberOfLines={2}>
                            {[it.category, it.vendor].filter(Boolean).join(" · ")}
                          </T>
                        </View>
                      </Row>
                    </View>
                    <Pressable onPress={() => remove(i)} accessibilityRole="button" accessibilityLabel={copy.removeLine} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                      <Icon name="x" size={18} color={colors.ivory55} />
                    </Pressable>
                  </Row>
                  {i < extracted.items.length - 1 ? <Hairline /> : null}
                </View>
              ))}
            </Card>
            <Row style={{ justifyContent: "space-between" }}>
              <T v="meta13" color={colors.ivory55}>
                {copy.total}
              </T>
              <T v="body16">{formatMoney(extracted.items.reduce((s, it) => s + (lineTotal(it) ?? 0), 0), currency, lang)}</T>
            </Row>

            <T v="meta13" color={colors.ivory55} style={{ marginTop: 8 }}>
              {copy.target}
            </T>
            <ChipRow>
              <Chip label={copy.newBudget} on={target === null} onPress={() => setTarget(null)} />
              {budgets.map((b) => (
                <Chip key={b.id} label={fmt(copy.intoExisting, { name: b.name })} on={target === b.id} onPress={() => setTarget(b.id)} />
              ))}
            </ChipRow>

            <Row gap={8} style={{ marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Button label={copy.cancel} kind="ghost" onPress={() => setExtracted(null)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label={fmt(copy.commit, { n: extracted.items.length })} onPress={commit} loading={saving} disabled={!extracted.items.length || !online} />
              </View>
            </Row>
          </Stack>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

// Import guests: paste or pick a file, review what was recognized, confirm.

import React, { useState } from "react";
import { View, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure } from "@/lib/api";
import { Screen, TopBar, BigTitle, Card, Segmented, Input, Button, Badge, Banner, Stack, SectionLabel, T, ListRow, Avatar, Row } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/import/copy";
import { commitImport, parseImport, type ParsePreview } from "@/features/import/hooks";

type Way = "paste" | "file";

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export default function ImportGuests() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const [way, setWay] = useState<Way>("paste");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileB64, setFileB64] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsePreview | null>(null);
  const [kept, setKept] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; rsvpsRecorded: number } | null>(null);

  async function pickFile() {
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({
      type: ["text/csv", "text/comma-separated-values", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "*/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    try {
      const file = new File(asset.uri);
      const b64 = await file.base64();
      setFileB64(b64);
      setFileName(asset.name);
    } catch {
      setError(c.error);
    }
  }

  async function parse() {
    setBusy(true);
    setError(null);
    try {
      const p = way === "paste" ? await parseImport({ text }) : await parseImport({ file_base64: fileB64 ?? "", filename: fileName ?? "list.csv" });
      setPreview(p);
      setKept(new Set(p.guests.map((g, i) => (g.duplicate ? -1 : i)).filter((i) => i >= 0)));
    } catch (err) {
      setError(err instanceof ApiFailure ? err.messages[lang] : c.error);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!preview) return;
    const guests = preview.guests.filter((_, i) => kept.has(i)).map(({ duplicate: _d, ...g }) => g);
    if (!guests.length) {
      setError(c.nothingKept);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await commitImport(guests);
      setResult({ imported: r.imported, rsvpsRecorded: r.rsvpsRecorded });
      await qc.invalidateQueries({ queryKey: ["couple-guests"] });
      await qc.invalidateQueries({ queryKey: ["couple-home"] });
      await qc.invalidateQueries({ queryKey: ["couple-rsvps"] });
    } catch (err) {
      setError(err instanceof ApiFailure ? err.messages[lang] : c.error);
    } finally {
      setBusy(false);
    }
  }

  function toggle(i: number) {
    setKept((p) => {
      const n = new Set(p);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }

  if (result) {
    return (
      <Screen header={<TopBar onBack={() => router.back()} title={c.title} />}>
        <BigTitle label={c.doneTitle} title={fmt(c.preview, { n: result.imported })} sub={fmt(c.doneBody, { guests: result.imported, rsvps: result.rsvpsRecorded })} size={38} />
        <Button label={c.done} onPress={() => router.replace("/couple/guests")} style={{ marginTop: 28 }} />
      </Screen>
    );
  }

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={c.title} />} bottomInset={40} keyboard>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {!preview ? (
          <>
            <BigTitle title={c.title} sub={c.subtitle} size={38} />
            <View style={{ marginTop: 20 }}>
              <Segmented<Way> value={way} options={[{ value: "paste", label: c.paste }, { value: "file", label: c.pickFile }]} onChange={setWay} />
            </View>
            {way === "paste" ? (
              <View style={{ marginTop: 14 }}>
                <T v="meta13" color={colors.ivory55}>
                  {c.pasteHint}
                </T>
                <Input value={text} onChangeText={setText} placeholder={c.pastePlaceholder} multiline autoCorrect={false} style={{ minHeight: 160, alignItems: "flex-start", paddingTop: 12, marginTop: 10 }} />
              </View>
            ) : (
              <View style={{ marginTop: 14 }}>
                <T v="meta13" color={colors.ivory55}>
                  {c.fileHint}
                </T>
                <Button label={fileName ?? c.pickFile} kind="glass" icon="list" onPress={pickFile} style={{ marginTop: 10 }} />
              </View>
            )}
            {error ? <Banner icon="warning" title={error} kind="red" /> : null}
            <Button label={busy ? c.reading : c.parse} onPress={parse} loading={busy} disabled={busy || (way === "paste" ? !text.trim() : !fileB64)} style={{ marginTop: 18 }} />
          </>
        ) : (
          <>
            <BigTitle title={fmt(c.preview, { n: preview.guests.length })} sub={[preview.skipped ? fmt(c.previewSkipped, { n: preview.skipped }) : null, preview.duplicates ? fmt(c.duplicates, { n: preview.duplicates }) : null].filter(Boolean).join(" · ")} size={34} />
            {preview.truncated ? <Banner icon="info" title={c.truncated} /> : null}
            {Object.keys(preview.mapping).length ? (
              <View style={{ marginTop: 14 }}>
                <SectionLabel>{c.mapping}</SectionLabel>
                <Row gap={6} style={{ flexWrap: "wrap", marginTop: 6 }}>
                  {Object.entries(preview.mapping).map(([col, field]) => (
                    <Badge key={col} label={`${col} → ${field}`} kind="mute" />
                  ))}
                </Row>
              </View>
            ) : null}
            <Card kind="solid" padding={2} style={{ paddingHorizontal: 18, marginTop: 16 }}>
              {preview.guests.map((g, i) => (
                <Pressable key={`${g.name}-${i}`} onPress={() => toggle(i)} accessibilityRole="checkbox" accessibilityState={{ checked: kept.has(i) }}>
                  <ListRow
                    leading={<Avatar initials={initials(g.name)} />}
                    title={g.name}
                    sub={[g.party_size > 1 ? fmt(c.party, { n: g.party_size }) : null, g.phone ?? c.noPhone, g.rsvp ? `${c.rsvp}: ${g.rsvp}` : null, g.duplicate ? c.alreadyOnList : null].filter(Boolean).join(" · ")}
                    trailing={<Badge label={kept.has(i) ? c.keep : ""} kind={kept.has(i) ? "gold" : "mute"} />}
                    chevron={false}
                    last={i === preview.guests.length - 1}
                  />
                </Pressable>
              ))}
            </Card>
            {error ? <Banner icon="warning" title={error} kind="red" /> : null}
            <Stack gap={8} style={{ marginTop: 18 }}>
              <Button label={busy ? c.importing : fmt(c.import, { n: kept.size })} onPress={commit} loading={busy} disabled={busy || !kept.size} />
              <Button label={c.startOver} kind="text" onPress={() => { setPreview(null); setError(null); }} disabled={busy} />
            </Stack>
          </>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

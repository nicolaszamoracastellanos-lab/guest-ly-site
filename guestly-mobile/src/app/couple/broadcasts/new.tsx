// New broadcast: audience, message, preview, then a typed confirmation.
// Phones never reach the app; the server resolves the audience.

import React, { useEffect, useMemo, useState } from "react";
import { View, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure } from "@/lib/api";
import { Screen, TopBar, BigTitle, Card, Chip, ChipRow, Segmented, Input, Button, Badge, Banner, Sheet, Skeleton, Stack, SectionLabel, T, ListRow, Avatar, Hairline } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/broadcasts/copy";
import { previewBroadcast, sendBroadcast, useBroadcasts, type AudienceFilter, type Composition, type Preview, type SendResult } from "@/features/broadcasts/hooks";

type Mode = "template" | "custom";
type LangMode = "auto" | "es" | "en";

export default function NewBroadcast() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const { data, isLoading } = useBroadcasts();

  const [audienceKey, setAudienceKey] = useState<string>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pickOpen, setPickOpen] = useState(false);
  const [pickQuery, setPickQuery] = useState("");
  const [mode, setMode] = useState<Mode>("template");
  const [templateKey, setTemplateKey] = useState<string>("invite");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState("");
  const [langMode, setLangMode] = useState<LangMode>("auto");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const audiences = data?.audiences ?? [];
  const templates = data?.templates ?? [];
  const template = templates.find((t) => t.key === templateKey) ?? templates[0] ?? null;
  const guests = data?.guests ?? [];

  const audience: AudienceFilter | null = useMemo(() => {
    if (audienceKey === "picked") return picked.size ? { type: "guests", guest_ids: [...picked] } : null;
    return audiences.find((a) => a.key === audienceKey)?.filter ?? null;
  }, [audienceKey, audiences, picked]);

  const composition: Composition | null = useMemo(() => {
    if (!audience) return null;
    if (mode === "template" && !template) return null;
    if (mode === "custom" && !custom.trim()) return null;
    return {
      audience,
      template_key: mode === "template" ? template!.key : null,
      custom_message: mode === "custom" ? custom.trim() : null,
      lang: langMode,
      template_vars: vars,
    };
  }, [audience, mode, template, custom, langMode, vars]);

  const compositionKey = JSON.stringify(composition);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      if (!composition) {
        setPreview(null);
        return;
      }
      try {
        const p = await previewBroadcast(composition);
        if (alive) {
          setPreview(p);
          setPreviewError(null);
        }
      } catch (err) {
        if (alive) {
          setPreview(null);
          setPreviewError(err instanceof ApiFailure ? err.messages[lang] : null);
        }
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // The key captures every field of the composition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compositionKey, lang]);

  const shownGuests = guests.filter((g) => (pickQuery ? g.name.toLowerCase().includes(pickQuery.toLowerCase()) : true)).slice(0, 80);
  const canReview = !!composition && !!preview && preview.recipients_count > 0 && !busy;
  const confirmOk = typed.trim().toUpperCase() === "SEND" || typed.trim().toUpperCase() === "ENVIAR";

  async function send() {
    if (!composition || !confirmOk) return;
    setBusy(true);
    setSendError(null);
    try {
      const r = await sendBroadcast(composition, typed.trim().toUpperCase());
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult(r);
      setConfirmOpen(false);
      await qc.invalidateQueries({ queryKey: ["broadcasts"] });
    } catch (err) {
      setSendError(err instanceof ApiFailure ? err.messages[lang] : c.confirmTitle);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <Screen header={<TopBar onBack={() => router.back()} title={c.title} />}>
        <BigTitle label={c.sentTitle} title={fmt(c.sentOf, { sent: result.summary.sent, total: result.summary.total })} sub={fmt(c.sentBody, { sent: result.summary.sent, total: result.summary.total, failed: result.summary.failed })} size={38} />
        {result.failed_batches.length ? (
          <Stack gap={8} style={{ marginTop: 16 }}>
            {result.failed_batches.map((b) => (
              <Banner key={b.lang} icon="warning" title={`${b.lang.toUpperCase()} · ${b.count}`} body={b.error} kind="red" />
            ))}
          </Stack>
        ) : null}
        <Button label={c.done} onPress={() => router.replace("/couple/broadcasts")} style={{ marginTop: 28 }} />
      </Screen>
    );
  }

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={c.newBroadcast} />} bottomInset={40} keyboard>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {isLoading && !data ? (
          <Stack gap={12}>
            <Skeleton h={120} r={18} />
            <Skeleton h={200} r={18} />
          </Stack>
        ) : null}
        {data ? (
          <>
            <SectionLabel color={colors.goldLight}>{c.stepAudience}</SectionLabel>
            <View style={{ marginTop: 10 }}>
              <ChipRow>
                {audiences.map((a) => (
                  <Chip key={a.key} label={`${a.label[lang]} ${a.count}`} on={audienceKey === a.key} onPress={() => setAudienceKey(a.key)} />
                ))}
                <Chip label={picked.size ? fmt(c.pickedGuests, { n: picked.size }) : c.pickGuests} on={audienceKey === "picked"} onPress={() => { setAudienceKey("picked"); setPickOpen(true); }} />
              </ChipRow>
            </View>
            {audienceKey === "picked" ? <Button label={c.pickGuests} kind="glass" small onPress={() => setPickOpen(true)} style={{ marginTop: 10 }} /> : null}
            {preview ? (
              <T v="meta13" color={colors.ivory55} style={{ marginTop: 10 }}>
                {fmt(c.withPhone, { n: preview.recipients_count })}
                {preview.skipped_no_phone ? ` · ${fmt(c.withoutPhone, { n: preview.skipped_no_phone })}` : ""}
              </T>
            ) : null}

            <SectionLabel color={colors.goldLight} style={{ marginTop: 28 }}>{c.stepMessage}</SectionLabel>
            <View style={{ marginTop: 10 }}>
              <Segmented<Mode> value={mode} options={[{ value: "template", label: c.template }, { value: "custom", label: c.custom }]} onChange={setMode} />
            </View>
            {mode === "template" ? (
              <View style={{ marginTop: 12 }}>
                <ChipRow>
                  {templates.map((t) => (
                    <Chip key={t.key} label={t.label} on={template?.key === t.key} onPress={() => setTemplateKey(t.key)} />
                  ))}
                </ChipRow>
                {template?.vars.length ? (
                  <Stack gap={8} style={{ marginTop: 12 }}>
                    {template.vars.map((v) => (
                      <Input key={v} value={vars[v] ?? ""} onChangeText={(t) => setVars((p) => ({ ...p, [v]: t }))} placeholder={`${c.fillIn}: ${v}`} />
                    ))}
                  </Stack>
                ) : null}
              </View>
            ) : (
              <View style={{ marginTop: 12 }}>
                <Input value={custom} onChangeText={(t) => setCustom(t.slice(0, 1500))} placeholder={c.custom} multiline style={{ minHeight: 120, alignItems: "flex-start", paddingTop: 12 }} />
                <T v="meta13" color={colors.amber} style={{ marginTop: 8 }}>
                  {c.customHint}
                </T>
              </View>
            )}
            <SectionLabel style={{ marginTop: 18 }}>{c.language}</SectionLabel>
            <View style={{ marginTop: 8 }}>
              <Segmented<LangMode> value={langMode} options={[{ value: "auto", label: c.langAuto }, { value: "es", label: c.langEs }, { value: "en", label: c.langEn }]} onChange={setLangMode} />
            </View>

            <SectionLabel color={colors.goldLight} style={{ marginTop: 28 }}>{c.stepReview}</SectionLabel>
            {previewError ? <Banner icon="warning" title={previewError} kind="red" /> : null}
            {preview ? (
              <Card kind="glass" padding={16} style={{ marginTop: 10 }}>
                <T v="meta13" color={colors.ivory55}>
                  {fmt(c.perLang, { es: preview.by_lang.es, en: preview.by_lang.en })}
                </T>
                {(Object.keys(preview.sample) as ("en" | "es")[]).map((l) => (
                  <View key={l} style={{ marginTop: 12 }}>
                    <Badge label={l.toUpperCase()} kind="gold" />
                    <T v="body15" color={colors.ivory90} style={{ marginTop: 6 }}>
                      {preview.sample[l]}
                    </T>
                  </View>
                ))}
              </Card>
            ) : null}
            {preview && preview.recipients_count === 0 ? <Banner icon="phone" title={c.noRecipients} /> : null}
            <Button label={preview ? fmt(c.sendTo, { n: preview.recipients_count }) : c.review} onPress={() => { setTyped(""); setSendError(null); setConfirmOpen(true); }} disabled={!canReview} style={{ marginTop: 20 }} />
          </>
        ) : null}
      </KeyboardAvoidingView>

      <Sheet visible={pickOpen} onClose={() => setPickOpen(false)} top={90}>
        <View style={{ paddingHorizontal: 20, flex: 1 }}>
          <Input icon="search" value={pickQuery} onChangeText={setPickQuery} placeholder={c.searchGuests} autoCorrect={false} />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <Chip label={c.selectAll} onPress={() => setPicked((p) => new Set([...p, ...shownGuests.filter((g) => g.has_phone).map((g) => g.id)]))} />
            <Chip label={c.clear} onPress={() => setPicked(new Set())} />
          </View>
          <ScrollView style={{ marginTop: 10 }} keyboardShouldPersistTaps="handled">
            {shownGuests.map((g, i) => (
              <ListRow
                key={g.id}
                leading={<Avatar initials={g.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")} />}
                title={g.name}
                sub={`${g.lang.toUpperCase()}${g.has_phone ? "" : ` · ${c.noPhone}`}${g.tags.length ? ` · ${g.tags.slice(0, 2).join(", ")}` : ""}`}
                trailing={<Badge label={picked.has(g.id) ? "✓" : ""} kind={picked.has(g.id) ? "gold" : "mute"} />}
                chevron={false}
                onPress={
                  g.has_phone
                    ? () =>
                        setPicked((p) => {
                          const n = new Set(p);
                          if (n.has(g.id)) n.delete(g.id);
                          else n.add(g.id);
                          return n;
                        })
                    : undefined
                }
                last={i === shownGuests.length - 1}
              />
            ))}
          </ScrollView>
          <Button label={fmt(c.pickedGuests, { n: picked.size })} onPress={() => setPickOpen(false)} style={{ marginTop: 8 }} />
        </View>
      </Sheet>

      <Sheet visible={confirmOpen} onClose={() => (busy ? null : setConfirmOpen(false))} top={230}>
        <View style={{ paddingHorizontal: 20 }}>
          <T v="title26">{c.confirmTitle}</T>
          <T v="body15" color={colors.ivory70} style={{ marginTop: 8 }}>
            {c.confirmBody}
          </T>
          <Hairline gold style={{ marginVertical: 14 }} />
          <T v="meta13" color={colors.ivory55}>
            {preview ? fmt(c.sendTo, { n: preview.recipients_count }) : ""}
          </T>
          <Input value={typed} onChangeText={setTyped} placeholder={c.confirmPlaceholder} autoCapitalize="characters" autoCorrect={false} style={{ marginTop: 12 }} />
          {sendError ? (
            <T v="body15" color={colors.red} style={{ marginTop: 10 }}>
              {sendError}
            </T>
          ) : null}
          <Button label={busy ? c.sending : c.send} onPress={send} loading={busy} disabled={!confirmOk || busy} style={{ marginTop: 16 }} />
          <Button label={c.cancel} kind="text" onPress={() => setConfirmOpen(false)} disabled={busy} style={{ marginTop: 6 }} />
        </View>
      </Sheet>
    </Screen>
  );
}

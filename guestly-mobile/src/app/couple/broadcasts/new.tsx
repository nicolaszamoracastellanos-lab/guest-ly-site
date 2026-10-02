// New broadcast: audience, message, preview, then a typed confirmation.
// Phones never reach the app; the server resolves the audience.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, FlatList } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { fmt, useCopy, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure } from "@/lib/api";
import { errorText, newSendKey, outcomeUnknown } from "@/features/shared/requests";
import { Screen, TopBar, BigTitle, Card, Chip, ChipRow, Segmented, Input, Button, Badge, Banner, Sheet, Skeleton, Stack, SectionLabel, T, ListRow, Avatar, Hairline } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/broadcasts/copy";
import { previewBroadcast, sendBroadcast, useBroadcasts, type AudienceFilter, type BroadcastGuest, type Composition, type Preview, type SendResult } from "@/features/broadcasts/hooks";
import { useSafeBack } from "@/lib/nav";
import { useUserSession } from "@/lib/session";

type Mode = "template" | "custom";
type LangMode = "auto" | "es" | "en";

export default function NewBroadcast() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const copyCommonError = useCopy().common.error;
  const back = useSafeBack();
  const user = useUserSession();
  const qc = useQueryClient();
  const mainQuery = useBroadcasts();
  const { data, isLoading } = mainQuery;

  const [audienceKey, setAudienceKey] = useState<string>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pickOpen, setPickOpen] = useState(false);
  const [pickQuery, setPickQuery] = useState("");
  const [mode, setMode] = useState<Mode>("template");
  const [templateKey, setTemplateKey] = useState<string>("invite");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState("");
  const [langMode, setLangMode] = useState<LangMode>("auto");
  // Each preview (and preview error) remembers the composition it was made
  // for. One that no longer matches what is on screen is never shown as the
  // count, and Send waits for the new one (B1: switching from Pending 30 to
  // All 180 and confirming fast said 30 and sent 180).
  const [previewState, setPreviewState] = useState<{ key: string; data: Preview } | null>(null);
  const [previewErrorState, setPreviewErrorState] = useState<{ key: string; text: string } | null>(null);
  // Bumped to ask for a fresh preview (after the server said the audience changed).
  const [previewNonce, setPreviewNonce] = useState(0);
  // What the confirm sheet showed, frozen when it opened: exactly this is sent.
  const [confirmed, setConfirmed] = useState<{ composition: Composition; recipients: number } | null>(null);
  const [recipientsChanged, setRecipientsChanged] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  // One key per send attempt: minted when the confirm sheet opens, reused if
  // Send is tapped again in the same sheet.
  const [sendKey, setSendKey] = useState<string>("");
  // The request left the phone but no answer came back: the send may have gone
  // out, so Send is not armed again from this screen.
  const [unknownOutcome, setUnknownOutcome] = useState(false);

  const audiences = useMemo(() => data?.audiences ?? [], [data?.audiences]);
  const templates = data?.templates ?? [];
  const template = templates.find((t) => t.key === templateKey) ?? templates[0] ?? null;
  const guests = useMemo(() => data?.guests ?? [], [data?.guests]);

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
  const preview = composition && previewState?.key === compositionKey ? previewState.data : null;
  const previewError = composition && previewErrorState?.key === compositionKey ? previewErrorState.text : null;
  // The composition changed and its preview is on the way.
  const updating = !!composition && !preview && !previewError;

  // Part 9 audit, D-001 (P0). The approved template bodies live in the portal
  // and were written for one wedding. Until they are per wedding, a template
  // preview that does not name THIS couple is never shown and never sent: it
  // would put a stranger's names, date and links in front of the person, and
  // send them to their guests. The portal fix is the lead's; this is the fence.
  const coupleNames = user?.me.tenant.couple_names ?? "";
  const templateMismatch = useMemo(() => {
    if (mode !== "template" || !preview) return false;
    const fold = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const names = coupleNames.split(/\s*(?:&|\sy\s|\sand\s)\s*/i).map((n) => fold(n.trim().split(/\s+/)[0] ?? "")).filter((n) => n.length > 1);
    if (!names.length) return true;
    return Object.values(preview.sample).some((body) => !names.every((n) => fold(body ?? "").includes(n)));
  }, [mode, preview, coupleNames]);

  useEffect(() => {
    let alive = true;
    const key = compositionKey;
    const t = setTimeout(async () => {
      if (!composition) return;
      try {
        const p = await previewBroadcast(composition);
        if (alive) {
          setPreviewState({ key, data: p });
          setPreviewErrorState(null);
        }
      } catch (err) {
        if (alive) setPreviewErrorState({ key, text: errorText(err, lang, copyCommonError) });
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // The key captures every field of the composition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compositionKey, lang, previewNonce]);

  const shownGuests = useMemo(() => {
    const q = pickQuery.trim().toLowerCase();
    return q ? guests.filter((g) => g.name.toLowerCase().includes(q)) : guests;
  }, [guests, pickQuery]);
  const canReview = !!composition && !!preview && preview.recipients_count > 0 && !busy && !unknownOutcome;
  const confirmOk = typed.trim().toUpperCase() === "SEND" || typed.trim().toUpperCase() === "ENVIAR";

  const togglePick = useCallback((id: string) => {
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  function openConfirm() {
    if (!composition || !preview) return;
    setConfirmed({ composition, recipients: preview.recipients_count });
    setRecipientsChanged(null);
    setTyped("");
    setSendError(null);
    setSendKey(newSendKey());
    setConfirmOpen(true);
  }

  async function send() {
    if (!confirmed || !confirmOk || busy || !sendKey) return;
    setBusy(true);
    setSendError(null);
    try {
      // The frozen composition and the count the person confirmed. A portal
      // that knows `expected_recipients` refuses (409) when the live audience
      // no longer matches; an older one ignores it.
      const r = await sendBroadcast(confirmed.composition, typed.trim().toUpperCase(), sendKey, confirmed.recipients);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult(r);
      setConfirmOpen(false);
      setTyped("");
      await qc.invalidateQueries({ queryKey: ["broadcasts"] });
    } catch (err) {
      if (outcomeUnknown(err)) {
        setUnknownOutcome(true);
        setConfirmOpen(false);
        setTyped("");
        void qc.invalidateQueries({ queryKey: ["broadcasts"] });
      } else if (err instanceof ApiFailure && err.code === "recipients_changed") {
        // Nothing was sent. Close the sheet, fetch the new count, and let the
        // person look at it and confirm again.
        setConfirmOpen(false);
        setTyped("");
        setConfirmed(null);
        setRecipientsChanged(errorText(err, lang, c.recipientsChanged));
        setPreviewState(null);
        setPreviewNonce((n) => n + 1);
        void qc.invalidateQueries({ queryKey: ["broadcasts"] });
      } else {
        setSendError(errorText(err, lang, c.confirmTitle));
      }
    } finally {
      setBusy(false);
    }
  }

  // Leaving the result screen clears the whole composition, so the next
  // "New broadcast" always starts from an empty composer.
  function finish() {
    setResult(null);
    setUnknownOutcome(false);
    setPicked(new Set());
    setPickQuery("");
    setCustom("");
    setVars({});
    setTyped("");
    setSendKey("");
    setPreviewState(null);
    setPreviewErrorState(null);
    setConfirmed(null);
    setRecipientsChanged(null);
    setAudienceKey("all");
    back();
  }

  if (unknownOutcome) {
    return (
      <Screen header={<TopBar onBack={finish} title={c.title} />}>
        <Banner icon="warning" title={c.sendUnknownTitle} body={c.sendUnknownBody} kind="amber" />
        <Button label={c.viewSent} onPress={finish} style={{ marginTop: 28 }} />
      </Screen>
    );
  }

  if (result) {
    return (
      <Screen query={mainQuery} header={<TopBar onBack={finish} title={c.title} />}>
        <BigTitle label={c.sentTitle} title={fmt(c.sentOf, { sent: result.summary.sent, total: result.summary.total })} sub={fmt(c.sentBody, { sent: result.summary.sent, total: result.summary.total, failed: result.summary.failed })} size={38} />
        {result.failed_batches.length ? (
          <Stack gap={8} style={{ marginTop: 16 }}>
            {result.failed_batches.map((b) => (
              <Banner key={b.lang} icon="warning" title={`${b.lang.toUpperCase()} · ${b.count}`} body={b.error} kind="red" />
            ))}
          </Stack>
        ) : null}
        <Button label={c.done} onPress={finish} style={{ marginTop: 28 }} />
      </Screen>
    );
  }

  return (
    <Screen header={<TopBar onBack={back} title={c.newBroadcast} />} bottomInset={40} keyboard>
      <>
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
            ) : updating ? (
              <T v="meta13" color={colors.ivory40} style={{ marginTop: 10 }}>
                {c.updatingPreview}
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
                    <Chip key={t.key} label={(c.templateNames as Record<string, string>)[t.key] ?? t.label} on={template?.key === t.key} onPress={() => setTemplateKey(t.key)} />
                  ))}
                </ChipRow>
                {template?.vars.length ? (
                  <Stack gap={8} style={{ marginTop: 12 }}>
                    {template.vars.map((v) => (
                      <Input accessibilityLabel={`${c.fillIn}: ${v}`} key={v} value={vars[v] ?? ""} onChangeText={(t) => setVars((p) => ({ ...p, [v]: t }))} placeholder={`${c.fillIn}: ${v}`} />
                    ))}
                  </Stack>
                ) : null}
              </View>
            ) : (
              <View style={{ marginTop: 12 }}>
                <Input accessibilityLabel={c.custom} value={custom} onChangeText={(t) => setCustom(t.slice(0, 1500))} placeholder={c.custom} multiline style={{ minHeight: 120, alignItems: "flex-start", paddingTop: 12 }} />
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
            {recipientsChanged ? (
              <View style={{ marginTop: 10 }}>
                <Banner icon="warning" title={recipientsChanged} kind="amber" />
              </View>
            ) : null}
            {previewError ? <Banner icon="warning" title={previewError} kind="red" /> : null}
            {templateMismatch ? (
              <View style={{ marginTop: 10 }}>
                <Banner icon="info" title={c.templateNotYours} kind="gold" />
              </View>
            ) : null}
            {preview && !templateMismatch ? (
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
            <Button label={preview ? fmt(c.sendTo, { n: preview.recipients_count }) : updating ? c.updatingPreview : c.review} onPress={openConfirm} disabled={!canReview || templateMismatch} style={{ marginTop: 20 }} />
          </>
        ) : null}
      </>

      <Sheet visible={pickOpen} onClose={() => setPickOpen(false)} top={90} scroll={false}>
        <View style={{ paddingHorizontal: 20, flex: 1 }}>
          <Input accessibilityLabel={c.searchGuests} icon="search" value={pickQuery} onChangeText={setPickQuery} placeholder={c.searchGuests} autoCorrect={false} />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <Chip label={c.selectAll} onPress={() => setPicked((p) => new Set([...p, ...shownGuests.filter((g) => g.has_phone).map((g) => g.id)]))} />
            <Chip label={c.clear} onPress={() => setPicked(new Set())} />
          </View>
          <FlatList
            style={{ marginTop: 10 }}
            data={shownGuests}
            keyExtractor={(g) => g.id}
            extraData={picked}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            initialNumToRender={16}
            windowSize={7}
            renderItem={({ item, index }) => (
              <PickRow guest={item} on={picked.has(item.id)} noPhone={c.noPhone} onToggle={togglePick} last={index === shownGuests.length - 1} />
            )}
          />
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
            {confirmed ? fmt(c.sendTo, { n: confirmed.recipients }) : ""}
          </T>
          <Input accessibilityLabel={c.confirmPlaceholder} value={typed} onChangeText={setTyped} placeholder={c.confirmPlaceholder} autoCapitalize="characters" autoCorrect={false} style={{ marginTop: 12 }} />
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

const PickRow = React.memo(function PickRow({ guest: g, on, noPhone, onToggle, last }: { guest: BroadcastGuest; on: boolean; noPhone: string; onToggle: (id: string) => void; last: boolean }) {
  return (
    <ListRow
      leading={<Avatar initials={g.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")} />}
      title={g.name}
      sub={`${g.lang.toUpperCase()}${g.has_phone ? "" : ` · ${noPhone}`}${g.tags.length ? ` · ${g.tags.slice(0, 2).join(", ")}` : ""}`}
      trailing={<Badge label={on ? "✓" : ""} kind={on ? "gold" : "mute"} />}
      chevron={false}
      onPress={g.has_phone ? () => onToggle(g.id) : undefined}
      last={last}
    />
  );
});

// RSVP questions: list, reorder, add, edit in a sheet, delete. Saves the
// whole list through the portal's sanitizer each time.

import React, { useState } from "react";
import { View, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure } from "@/lib/api";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, BigTitle, Card, ListRow, Badge, Button, Banner, EmptyState, Skeleton, Stack, SectionLabel, Segmented, Input, Toggle, Chip, ChipRow, Sheet, T, Row, IconButton } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/rsvp-questions/copy";
import { saveRsvpQuestions, slug, useRsvpQuestions, type RsvpQuestion } from "@/features/rsvp-questions/hooks";

type Draft = RsvpQuestion;

function blank(): Draft {
  return { id: "", kind: "select", label: { en: "", es: "" }, options: [{ id: "", label: { en: "", es: "" } }, { id: "", label: { en: "", es: "" } }], event_id: null, required: false };
}

export default function RsvpQuestions() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useUserSession();
  const canEdit = user?.me.can_edit ?? false;
  const { data, isLoading } = useRsvpQuestions();
  const questions = data?.questions ?? [];
  const events = data?.events ?? [];
  const [editing, setEditing] = useState<{ index: number | null; draft: Draft } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(false);

  async function persist(next: RsvpQuestion[]) {
    setBusy(true);
    setError(null);
    try {
      const r = await saveRsvpQuestions(next);
      qc.setQueryData(["rsvp-questions"], { questions: r.questions, events });
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1500);
      return true;
    } catch (err) {
      setError(err instanceof ApiFailure ? err.messages[lang] : c.needLabel);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    [next[i], next[j]] = [next[j], next[i]];
    void persist(next);
  }

  async function saveDraft() {
    if (!editing) return;
    const d = editing.draft;
    const en = d.label.en?.trim() ?? "";
    const es = d.label.es?.trim() ?? "";
    if (!en && !es) {
      setError(c.needLabel);
      return;
    }
    const options =
      d.kind === "select"
        ? d.options
            .map((o) => ({ ...o, label: { en: o.label.en?.trim() || null, es: o.label.es?.trim() || null } }))
            .filter((o) => o.label.en || o.label.es)
            .map((o) => ({ id: o.id || slug(o.label.en ?? o.label.es ?? ""), label: o.label }))
        : [];
    if (d.kind === "select" && options.length < 2) {
      setError(c.needOptions);
      return;
    }
    const clean: RsvpQuestion = { id: d.id || slug(en || es), kind: d.kind, label: { en: en || null, es: es || null }, options, event_id: d.event_id, required: d.required };
    const next = [...questions];
    if (editing.index === null) next.push(clean);
    else next[editing.index] = clean;
    if (next.length > 20) {
      setError(c.max);
      return;
    }
    if (await persist(next)) setEditing(null);
  }

  async function remove() {
    if (!editing || editing.index === null) return;
    const next = questions.filter((_, i) => i !== editing.index);
    if (await persist(next)) setEditing(null);
  }

  const d = editing?.draft ?? null;
  const setD = (patch: Partial<Draft>) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e));

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={c.title} right={savedTick ? <Badge label={c.saved} kind="green" /> : undefined} />}>
      <BigTitle title={c.title} sub={c.subtitle} size={38} />
      {error && !editing ? <Banner icon="warning" title={error} kind="red" /> : null}
      <Stack gap={10} style={{ marginTop: 18 }}>
        {isLoading && !data ? <Skeleton h={100} r={18} /> : null}
        {data && !questions.length ? <EmptyState title={c.empty} body={c.emptyBody} /> : null}
        {questions.length ? (
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
            {questions.map((q, i) => (
              <ListRow
                key={q.id}
                title={q.label[lang] || q.label.en || q.label.es || q.id}
                sub={[q.kind === "select" ? fmt(c.optionsCount, { n: q.options.length }) : c.freeText, q.event_id ? events.find((e) => e.id === q.event_id)?.title[lang] ?? q.event_id : c.general, q.required ? c.required : null].filter(Boolean).join(" · ")}
                trailing={
                  canEdit ? (
                    <Row gap={2}>
                      <IconButton name="undo" label={c.moveUp} onPress={() => move(i, -1)} />
                      <IconButton name="down" label={c.moveDown} onPress={() => move(i, 1)} />
                    </Row>
                  ) : undefined
                }
                onPress={canEdit ? () => { setError(null); setEditing({ index: i, draft: JSON.parse(JSON.stringify(q)) as Draft }); } : undefined}
                last={i === questions.length - 1}
              />
            ))}
          </Card>
        ) : null}
        {canEdit ? <Button label={c.add} icon="plus" kind="glass" onPress={() => { setError(null); setEditing({ index: null, draft: blank() }); }} disabled={busy || questions.length >= 20} /> : null}
      </Stack>

      <Sheet visible={!!editing} onClose={() => (busy ? null : setEditing(null))} top={70}>
        {d ? (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
              <T v="title26">{c.edit}</T>
              <Stack gap={10} style={{ marginTop: 14 }}>
                <Input value={d.label.en ?? ""} onChangeText={(t) => setD({ label: { ...d.label, en: t.slice(0, 160) } })} placeholder={c.labelEn} />
                <Input value={d.label.es ?? ""} onChangeText={(t) => setD({ label: { ...d.label, es: t.slice(0, 160) } })} placeholder={c.labelEs} />
              </Stack>
              <SectionLabel style={{ marginTop: 16 }}>{c.kind}</SectionLabel>
              <View style={{ marginTop: 8 }}>
                <Segmented<"select" | "text"> value={d.kind} options={[{ value: "select", label: c.select }, { value: "text", label: c.text }]} onChange={(k) => setD({ kind: k })} />
              </View>
              {d.kind === "select" ? (
                <View style={{ marginTop: 14 }}>
                  <SectionLabel>{c.options}</SectionLabel>
                  <Stack gap={10} style={{ marginTop: 8 }}>
                    {d.options.map((o, i) => (
                      <Row key={i} gap={8}>
                        <View style={{ flex: 1 }}>
                          <Input value={o.label.en ?? ""} onChangeText={(t) => setD({ options: d.options.map((x, j) => (j === i ? { ...x, label: { ...x.label, en: t.slice(0, 80) } } : x)) })} placeholder={c.optionEn} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Input value={o.label.es ?? ""} onChangeText={(t) => setD({ options: d.options.map((x, j) => (j === i ? { ...x, label: { ...x.label, es: t.slice(0, 80) } } : x)) })} placeholder={c.optionEs} />
                        </View>
                        <IconButton name="x" label={c.delete} onPress={() => setD({ options: d.options.filter((_, j) => j !== i) })} />
                      </Row>
                    ))}
                    <Button label={c.addOption} kind="ghost" small onPress={() => setD({ options: [...d.options, { id: "", label: { en: "", es: "" } }] })} disabled={d.options.length >= 12} />
                  </Stack>
                </View>
              ) : null}
              <SectionLabel style={{ marginTop: 16 }}>{c.scope}</SectionLabel>
              <View style={{ marginTop: 8 }}>
                <ChipRow>
                  <Chip label={c.everyone} on={d.event_id === null} onPress={() => setD({ event_id: null })} />
                  {events.map((e) => (
                    <Chip key={e.id} label={e.title[lang]} on={d.event_id === e.id} onPress={() => setD({ event_id: e.id })} />
                  ))}
                </ChipRow>
              </View>
              <View style={{ marginTop: 16 }}>
                <Toggle value={d.required} onChange={(v) => setD({ required: v })} label={c.required} />
              </View>
              {error ? (
                <T v="body15" color={colors.red} style={{ marginTop: 10 }}>
                  {error}
                </T>
              ) : null}
              <Button label={busy ? c.saving : c.save} onPress={saveDraft} loading={busy} disabled={busy} style={{ marginTop: 18 }} />
              {editing?.index !== null ? <Button label={c.delete} kind="text" onPress={remove} disabled={busy} style={{ marginTop: 6 }} /> : null}
            </ScrollView>
          </KeyboardAvoidingView>
        ) : null}
      </Sheet>
    </Screen>
  );
}

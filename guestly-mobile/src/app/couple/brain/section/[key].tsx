// One brain section. Edits land in the shared draft and auto-save.

import React, { useState } from "react";
import { View, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFeatureCopy } from "@/i18n/feature";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, BigTitle, Card, T, Input, Button, Toggle, Row, Stack, Hairline, Banner } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/brain/copy";
import { useDraft, setPath, getPath, replaceFacts } from "@/features/brain/draft";
import { SECTIONS, EVENT_FIELDS, type Field } from "@/features/brain/sections";
import type { ItineraryEvent, WeddingFacts } from "@/features/brain/hooks";

export default function BrainSection() {
  const c = useFeatureCopy(COPY);
  const router = useRouter();
  const { key, gap } = useLocalSearchParams<{ key: string; gap?: string }>();
  const user = useUserSession();
  const canEdit = user?.me.can_edit ?? false;
  const draft = useDraft();
  const section = SECTIONS.find((s) => s.key === key) ?? SECTIONS[0];
  const title = c.section[section.key] ?? section.key;
  const status = draft.status === "saving" ? c.saving : draft.status === "saved" ? c.saved : draft.status === "error" ? c.saveFailed : null;

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={c.title} />} bottomInset={60} keyboard>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <BigTitle title={title} size={36} />
        {!canEdit ? (
          <T v="meta13" color={colors.ivory55} style={{ marginTop: 8 }}>
            {c.readOnly}
          </T>
        ) : null}
        {gap ? <View style={{ marginTop: 14 }}><Banner icon="warning" title={c.gapBanner} kind="amber" /></View> : null}
        <Stack gap={14} style={{ marginTop: 20 }}>
          {section.kind === "itinerary" ? <ItineraryEditor facts={draft.facts} disabled={!canEdit} /> : null}
          {section.kind === "hotels" ? <HotelsEditor facts={draft.facts} disabled={!canEdit} /> : null}
          {section.kind === "faq" ? <FaqEditor facts={draft.facts} disabled={!canEdit} prefill={gap} /> : null}
          {section.fields.map((f) => (
            <FieldEditor key={f.path} field={f} facts={draft.facts} disabled={!canEdit} />
          ))}
        </Stack>
        {status ? (
          <T v="meta13" color={draft.status === "error" ? colors.red : colors.ivory55} style={{ marginTop: 16 }}>
            {status}
          </T>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function FieldEditor({ field, facts, disabled, base }: { field: Field; facts: WeddingFacts; disabled: boolean; base?: string }) {
  const c = useFeatureCopy(COPY);
  const path = base ? `${base}.${field.path}` : field.path;
  const raw = getPath(facts, path);
  const value = field.kind === "list" ? (Array.isArray(raw) ? (raw as string[]).join("\n") : "") : typeof raw === "string" ? raw : "";
  return (
    <View style={{ gap: 6 }}>
      <T v="meta13" color={colors.goldLight}>
        {c.fields[field.label] ?? field.label}
      </T>
      <Input
        value={value}
        editable={!disabled}
        onChangeText={(t) => setPath(path, field.kind === "list" ? t.split("\n").map((s) => s.trim()).filter(Boolean) : t)}
        multiline={field.kind !== "text"}
        keyboardType={field.keyboard === "url" ? "url" : field.keyboard === "phone" ? "phone-pad" : "default"}
        autoCapitalize={field.keyboard ? "none" : "sentences"}
        placeholder={field.kind === "list" ? c.oneEntryPerLine : undefined}
        style={field.kind === "text" ? undefined : { minHeight: 96, alignItems: "flex-start", paddingVertical: 12 }}
      />
      {field.hint ? (
        <T v="meta13" color={colors.ivory55}>
          {c.fields[field.hint] ?? ""}
        </T>
      ) : field.kind === "list" ? (
        <T v="meta13" color={colors.ivory40}>
          {c.listHint}
        </T>
      ) : null}
    </View>
  );
}

function ItineraryEditor({ facts, disabled }: { facts: WeddingFacts; disabled: boolean }) {
  const c = useFeatureCopy(COPY);
  const events = facts.itinerary ?? [];
  const [open, setOpen] = useState<number | null>(events.length ? 0 : null);
  function update(next: ItineraryEvent[]) {
    replaceFacts({ ...facts, itinerary: next });
  }
  function remove(i: number) {
    Alert.alert(c.removeConfirm, "", [
      { text: c.cancel, style: "cancel" },
      { text: c.remove, style: "destructive", onPress: () => update(events.filter((_, j) => j !== i)) },
    ]);
  }
  return (
    <Stack gap={12}>
      {events.map((e, i) => (
        <Card key={i} kind="solid" padding={14}>
          <Row style={{ justifyContent: "space-between" }}>
            <T v="name24" onPress={() => setOpen(open === i ? null : i)}>
              {e.name || c.event(i + 1)}
            </T>
            <Row gap={8}>
              {!disabled ? <Button label={c.remove} kind="text" small full={false} onPress={() => remove(i)} /> : null}
              <Button label={open === i ? "–" : "+"} kind="glass" small full={false} onPress={() => setOpen(open === i ? null : i)} />
            </Row>
          </Row>
          {open === i ? (
            <Stack gap={12} style={{ marginTop: 12 }}>
              {EVENT_FIELDS.map((f) => (
                <FieldEditor key={f.path} field={f} facts={facts} disabled={disabled} base={`itinerary.${i}`} />
              ))}
            </Stack>
          ) : (
            <T v="meta13" color={colors.ivory55} style={{ marginTop: 4 }}>
              {[e.date, e.time, e.location].filter(Boolean).join(" · ")}
            </T>
          )}
        </Card>
      ))}
      {!disabled ? (
        <Button
          label={c.addEvent}
          kind="glass"
          icon="plus"
          onPress={() => {
            update([...events, {}]);
            setOpen(events.length);
          }}
        />
      ) : null}
      <Hairline />
    </Stack>
  );
}

function HotelsEditor({ facts, disabled }: { facts: WeddingFacts; disabled: boolean }) {
  const c = useFeatureCopy(COPY);
  const hotels = facts.hotels ?? [];
  function update(next: NonNullable<WeddingFacts["hotels"]>) {
    replaceFacts({ ...facts, hotels: next });
  }
  return (
    <Stack gap={12}>
      {hotels.map((h, i) => (
        <Card key={i} kind="solid" padding={14}>
          <Stack gap={10}>
            <Row style={{ justifyContent: "space-between" }}>
              <T v="meta13" color={colors.goldLight}>
                {c.fields.hotel}
              </T>
              {!disabled ? <Button label={c.remove} kind="text" small full={false} onPress={() => update(hotels.filter((_, j) => j !== i))} /> : null}
            </Row>
            <Input value={h.name ?? ""} editable={!disabled} placeholder={c.fields.name} onChangeText={(t) => update(hotels.map((x, j) => (j === i ? { ...x, name: t } : x)))} />
            <Input
              value={h.notes ?? ""}
              editable={!disabled}
              placeholder={c.fields.notes}
              multiline
              style={{ minHeight: 80, alignItems: "flex-start", paddingVertical: 12 }}
              onChangeText={(t) => update(hotels.map((x, j) => (j === i ? { ...x, notes: t } : x)))}
            />
            <Row style={{ justifyContent: "space-between" }}>
              <T v="body15">{c.fields.recommended}</T>
              <Toggle value={h.recommended === true} onChange={(v) => !disabled && update(hotels.map((x, j) => (j === i ? { ...x, recommended: v } : x)))} />
            </Row>
          </Stack>
        </Card>
      ))}
      {!disabled ? <Button label={c.addHotel} kind="glass" icon="plus" onPress={() => update([...hotels, { name: "" }])} /> : null}
      <Hairline />
    </Stack>
  );
}

function FaqEditor({ facts, disabled, prefill }: { facts: WeddingFacts; disabled: boolean; prefill?: string }) {
  const c = useFeatureCopy(COPY);
  const faq = facts.custom_faq ?? [];
  const [seeded, setSeeded] = useState(false);
  if (prefill && !seeded && !disabled) {
    setSeeded(true);
    if (!faq.some((q) => q.question.trim().toLowerCase() === prefill.trim().toLowerCase())) {
      replaceFacts({ ...facts, custom_faq: [{ question: prefill, answer: "" }, ...faq] });
    }
  }
  function update(next: { question: string; answer: string }[]) {
    replaceFacts({ ...facts, custom_faq: next });
  }
  return (
    <Stack gap={12}>
      {faq.map((q, i) => (
        <Card key={i} kind="solid" padding={14}>
          <Stack gap={10}>
            <Row style={{ justifyContent: "space-between" }}>
              <T v="meta13" color={colors.goldLight}>
                {c.fields.question}
              </T>
              {!disabled ? <Button label={c.remove} kind="text" small full={false} onPress={() => update(faq.filter((_, j) => j !== i))} /> : null}
            </Row>
            <Input value={q.question} editable={!disabled} multiline style={{ minHeight: 56, alignItems: "flex-start", paddingVertical: 12 }} onChangeText={(t) => update(faq.map((x, j) => (j === i ? { ...x, question: t } : x)))} />
            <T v="meta13" color={colors.goldLight}>
              {c.fields.answer}
            </T>
            <Input value={q.answer} editable={!disabled} multiline style={{ minHeight: 96, alignItems: "flex-start", paddingVertical: 12 }} onChangeText={(t) => update(faq.map((x, j) => (j === i ? { ...x, answer: t } : x)))} />
          </Stack>
        </Card>
      ))}
      {!disabled ? <Button label={c.addQa} kind="glass" icon="plus" onPress={() => update([{ question: "", answer: "" }, ...faq])} /> : null}
    </Stack>
  );
}

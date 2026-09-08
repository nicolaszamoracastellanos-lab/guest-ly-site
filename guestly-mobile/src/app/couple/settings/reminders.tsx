// Automatic RSVP reminder settings: switch, days before, send window, gap.

import React, { useState } from "react";
import { View, Alert, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useLang } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { useFeatureCopy } from "@/i18n/feature";
import { Screen, TopBar, BigTitle, Card, T, Stack, Skeleton, Button, Input, Row, SectionLabel, EmptyState, Chip } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/settings/copy";
import { useCoupleSettings, SETTINGS_KEY, type CoupleSettings, type Reminders } from "@/features/settings/hooks";
import { SwitchRow } from "@/features/website/fields";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function ReminderSettings() {
  const c = useFeatureCopy(COPY).reminders;
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const { data, isLoading } = useCoupleSettings();
  const [draft, setDraft] = useState<Reminders | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [newDay, setNewDay] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  if (data && !seeded) {
    setSeeded(true);
    setDraft(data.reminders);
  }

  const dirty = !!draft && !!data && JSON.stringify(draft) !== JSON.stringify(data.reminders);

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      const r = await post<{ reminders: Reminders }>("/couple/settings", { reminders: { ...draft, last_run_day: undefined } });
      qc.setQueryData<CoupleSettings>(SETTINGS_KEY, (old) => (old ? { ...old, reminders: r.reminders } : old));
      setDraft(r.reminders);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      Alert.alert(c.title, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setBusy(false);
    }
  }

  function addDay() {
    const n = parseInt(newDay, 10);
    if (!draft || !Number.isInteger(n) || n < 1 || n > 365) return;
    setDraft({ ...draft, offsets_days: [...new Set([...draft.offsets_days, n])].sort((a, b) => b - a) });
    setNewDay("");
  }

  const hourPicker = (value: number, onChange: (h: number) => void) => (
    <Row gap={6} style={{ flexWrap: "wrap" }}>
      {HOURS.filter((h) => h >= 6 && h <= 22).map((h) => (
        <Chip key={h} label={`${h}:00`} on={h === value} onPress={() => onChange(h)} />
      ))}
    </Row>
  );

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={c.title} />} bottomInset={60} keyboard>
      <BigTitle title={c.title} sub={c.subtitle} size={38} />
      <Stack gap={14} style={{ marginTop: 20 }}>
        {isLoading && !data ? <Skeleton h={200} r={18} /> : null}
        {data?.reminders_pending ? <EmptyState title={c.pending} /> : null}
        {data && !data.can_edit ? (
          <T v="meta13" color={colors.amber}>
            {c.readOnly}
          </T>
        ) : null}
        {draft && data ? (
          <>
            <Card kind="solid" padding={16}>
              <SwitchRow label={c.enabled} hint={c.enabledHint} value={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} />
              <T v="meta13" color={colors.ivory55} style={{ marginTop: 6 }}>
                {draft.last_run_day ? fmt(c.lastRun, { day: draft.last_run_day }) : c.neverRun}
              </T>
            </Card>
            <SectionLabel>{c.offsets}</SectionLabel>
            <Card kind="solid" padding={16}>
              <T v="meta13" color={colors.ivory55}>
                {c.offsetsHint}
              </T>
              <Row gap={8} style={{ flexWrap: "wrap", marginTop: 10 }}>
                {draft.offsets_days.map((d) => (
                  <Pressable key={d} onPress={() => setDraft({ ...draft, offsets_days: draft.offsets_days.filter((x) => x !== d) })} accessibilityRole="button">
                    <Chip label={`${d}`} on />
                  </Pressable>
                ))}
              </Row>
              <Row gap={8} style={{ marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Input value={newDay} onChangeText={setNewDay} placeholder={c.dayPlaceholder} placeholderTextColor={colors.ivory40} keyboardType="number-pad" onSubmitEditing={addDay} />
                </View>
                <Button label={c.addDay} small kind="glass" icon="plus" full={false} onPress={addDay} disabled={!newDay} />
              </Row>
            </Card>
            <SectionLabel>{c.window}</SectionLabel>
            <Card kind="solid" padding={16}>
              <T v="meta13" color={colors.ivory55}>
                {fmt(c.windowHint, { tz: draft.tz })}
              </T>
              <T v="label11" color={colors.goldLight} style={{ marginTop: 12, marginBottom: 6 }}>
                {c.from}
              </T>
              {hourPicker(draft.send_hour_start, (h) => setDraft({ ...draft, send_hour_start: h }))}
              <T v="label11" color={colors.goldLight} style={{ marginTop: 12, marginBottom: 6 }}>
                {c.to}
              </T>
              {hourPicker(draft.send_hour_end, (h) => setDraft({ ...draft, send_hour_end: h }))}
            </Card>
            <Card kind="solid" padding={16}>
              <T v="body15">{c.minGap}</T>
              <Row gap={6} style={{ flexWrap: "wrap", marginTop: 10 }}>
                {[1, 2, 3, 5, 7, 10, 14].map((n) => (
                  <Chip key={n} label={`${n}`} on={draft.min_gap_days === n} onPress={() => setDraft({ ...draft, min_gap_days: n })} />
                ))}
              </Row>
            </Card>
            <Button label={saved ? c.saved : c.save} onPress={() => void save()} loading={busy} disabled={!dirty || !data.can_edit} />
          </>
        ) : null}
      </Stack>
    </Screen>
  );
}

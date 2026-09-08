// The wedding checklist: pick template tasks, dated from the wedding day.

import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useLang, shortDate } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post } from "@/lib/api";
import { useOnline } from "@/lib/query";
import { Screen, TopBar, BigTitle, Button, Stack, Banner, Skeleton, Card, T, Row, Icon, Badge, Chip, ChipRow, SectionLabel } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/tasks/copy";
import { useTasksBoard, TASK_INVALIDATE, type TaskCategory } from "@/features/tasks/hooks";
import { errorText, priorityKind } from "@/features/tasks/ui";

export default function Checklists() {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const online = useOnline();
  const { data: board, isLoading } = useTasksBoard();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<TaskCategory | "all">("all");
  const [busy, setBusy] = useState(false);
  const templates = (board?.templates ?? []).filter((t) => (category === "all" ? true : t.category === category));
  const open = templates.filter((t) => !t.applied);
  const categories = Array.from(new Set((board?.templates ?? []).map((t) => t.category)));

  function toggle(key: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  async function apply() {
    if (!selected.size) return;
    setBusy(true);
    try {
      const r = await post<{ created: number }>("/couple/tasks/checklist", { template_keys: Array.from(selected) });
      for (const k of TASK_INVALIDATE) await qc.invalidateQueries({ queryKey: [k] });
      setSelected(new Set());
      Alert.alert(fmt(copy.checklistAddedToast, { n: r.created }));
      router.back();
    } catch (err) {
      Alert.alert(copy.error, errorText(err, lang, ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={copy.title} />} bottomInset={120}>
      <BigTitle title={copy.checklist} sub={copy.checklistIntro} size={34} />
      {!online ? <Banner icon="wifi-off" title={copy.offline} /> : null}
      <View style={{ marginTop: 16 }}>
        <ChipRow>
          <Chip label={copy.filters.all} on={category === "all"} onPress={() => setCategory("all")} />
          {categories.map((c) => (
            <Chip key={c} label={copy.categories[c]} on={category === c} onPress={() => setCategory(c)} />
          ))}
        </ChipRow>
      </View>
      <Row gap={16} style={{ marginTop: 12 }}>
        <Pressable onPress={() => setSelected(new Set(open.map((t) => t.template_key)))} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
          <T v="meta13" color={colors.goldLight}>
            {copy.selectAll}
          </T>
        </Pressable>
        <Pressable onPress={() => setSelected(new Set())} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
          <T v="meta13" color={colors.ivory55}>
            {copy.clearAll}
          </T>
        </Pressable>
      </Row>
      <Stack gap={10} style={{ marginTop: 6 }}>
        {isLoading && !board ? (
          <>
            <Skeleton h={90} r={18} />
            <Skeleton h={90} r={18} />
          </>
        ) : null}
        {templates.map((t) => {
          const on = selected.has(t.template_key);
          return (
            <Pressable key={t.template_key} onPress={() => !t.applied && toggle(t.template_key)} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: t.applied }} disabled={t.applied}>
              <Card kind="solid" padding={14} border={on ? colors.goldBorder : undefined} style={t.applied ? { opacity: 0.55 } : undefined}>
                <Row gap={12} align="flex-start">
                  <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: on ? colors.gold : colors.ivory25, backgroundColor: on ? colors.gold : "transparent", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                    {on || t.applied ? <Icon name="check" size={14} color={on ? colors.night : colors.ivory55} strokeWidth={2.4} /> : null}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <T v="body16">{t.title}</T>
                    <T v="meta13" color={colors.ivory55} numberOfLines={3}>
                      {t.notes}
                    </T>
                    <Row gap={8} style={{ marginTop: 4, flexWrap: "wrap" }}>
                      <Badge label={copy.categories[t.category]} kind="mute" />
                      {t.priority === "high" ? <Badge label={copy.priorities.high} kind={priorityKind(t.priority)} /> : null}
                      <T v="meta13" color={t.past ? colors.amber : colors.ivory55}>
                        {t.applied ? copy.checklistApplied : t.past ? copy.checklistPast : shortDate(t.due_date, lang)}
                      </T>
                    </Row>
                  </View>
                </Row>
              </Card>
            </Pressable>
          );
        })}
      </Stack>
      <SectionLabel style={{ marginTop: 20 }} color={colors.ivory40}>
        {open.length} · {copy.filters.open}
      </SectionLabel>
      <Button label={fmt(copy.checklistApply, { n: selected.size })} onPress={apply} loading={busy} disabled={!selected.size || !online} style={{ marginTop: 16 }} />
    </Screen>
  );
}

// One task on the couple's list: edit everything, change status, delete.

import React, { useState } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post, del } from "@/lib/api";
import { useOnline } from "@/lib/query";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, Button, Stack, Banner, Skeleton, Row, Badge, T } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/tasks/copy";
import { useTasksBoard, TASK_INVALIDATE, type TaskView } from "@/features/tasks/hooks";
import { TaskForm, formFromTask, errorText, dueLabel, dueColor, ConfirmSheet, type TaskFormValue } from "@/features/tasks/ui";

export default function TaskDetail() {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const online = useOnline();
  const user = useUserSession();
  const canEdit = user?.me.can_edit ?? false;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: board, isLoading } = useTasksBoard();
  const task = board?.tasks.find((t) => t.id === id) ?? null;
  const [form, setForm] = useState<TaskFormValue | null>(null);
  const [seededAt, setSeededAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (task && seededAt !== task.updated_at) {
    setSeededAt(task.updated_at);
    setForm(formFromTask(task));
  }

  async function invalidate() {
    for (const k of TASK_INVALIDATE) await qc.invalidateQueries({ queryKey: [k] });
  }

  async function save() {
    if (!form || !task) return;
    if (!form.title.trim()) {
      Alert.alert(copy.errorTitle);
      return;
    }
    setBusy(true);
    try {
      await post(`/couple/tasks/${task.id}`, form);
      await invalidate();
      router.back();
    } catch (err) {
      Alert.alert(copy.error, errorText(err, lang, ""));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: "done" | "todo") {
    if (!task) return;
    setBusy(true);
    try {
      const r = await post<{ task: TaskView; clone: TaskView | null }>(`/couple/tasks/${task.id}/status`, { status });
      await invalidate();
      if (r.clone?.due_date) Alert.alert(fmt(copy.repeatCloned, { date: r.clone.due_date }));
    } catch (err) {
      Alert.alert(copy.error, errorText(err, lang, ""));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!task) return;
    setBusy(true);
    try {
      await del(`/couple/tasks/${task.id}`);
      await invalidate();
      setConfirm(false);
      router.back();
    } catch (err) {
      Alert.alert(copy.error, errorText(err, lang, ""));
    } finally {
      setBusy(false);
    }
  }

  const due = task ? dueLabel(task, copy, lang) : null;

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={copy.editTask} />} bottomInset={40} keyboard>
      {isLoading && !board ? <Skeleton h={200} r={18} /> : null}
      {task && form ? (
        <Stack gap={18}>
          {!online ? <Banner icon="wifi-off" title={copy.offline} /> : null}
          <Row gap={8} style={{ flexWrap: "wrap" }}>
            <Badge label={copy.statuses[task.status]} kind={task.status === "done" ? "green" : task.status === "blocked" ? "amber" : "gold"} />
            {task.template_key ? <Badge label={copy.checklist} kind="mute" /> : null}
            {due ? (
              <T v="meta13" color={dueColor(task)}>
                {due}
              </T>
            ) : null}
          </Row>
          {canEdit ? (
            <Button label={task.status === "done" ? copy.reopen : copy.markDone} kind={task.status === "done" ? "glass" : "primary"} icon={task.status === "done" ? "undo" : "check"} onPress={() => setStatus(task.status === "done" ? "todo" : "done")} loading={busy} disabled={!online} />
          ) : null}
          <TaskForm board={board} value={form} onChange={setForm} showStatus />
          {canEdit ? <Button label={copy.save} onPress={save} loading={busy} disabled={!online} style={{ marginTop: 8 }} /> : null}
          {canEdit ? <Button label={copy.delete} kind="ghost" onPress={() => setConfirm(true)} /> : null}
          <T v="meta13" color={colors.ivory40} center>
            {copy.fields.category}: {copy.categories[task.category]}
          </T>
        </Stack>
      ) : null}
      <ConfirmSheet visible={confirm} title={copy.deleteConfirmTitle} body={copy.deleteConfirmBody} confirmLabel={copy.delete} onConfirm={remove} onClose={() => setConfirm(false)} busy={busy} />
    </Screen>
  );
}

// One task on the couple's list: edit everything, change status, delete.

import React, { useState } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post, del } from "@/lib/api";
import { useOnline } from "@/lib/query";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, Button, Stack, Skeleton, Row, Badge, T, EmptyState } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/tasks/copy";
import { useTasksBoard, TASK_INVALIDATE, type TaskView } from "@/features/tasks/hooks";
import { TaskForm, formFromTask, errorText, dueLabel, dueColor, ConfirmSheet, type TaskFormValue } from "@/features/tasks/ui";
import { useSafeBack } from "@/lib/nav";
import { useUnsavedGuard } from "@/lib/unsaved";

export default function TaskDetail() {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const back = useSafeBack();
  const qc = useQueryClient();
  const online = useOnline();
  const user = useUserSession();
  const canEdit = user?.me.can_edit ?? false;
  const { id } = useLocalSearchParams<{ id: string }>();
  const mainQuery = useTasksBoard();
  const { data: board, isLoading } = mainQuery;
  const task = board?.tasks.find((t) => t.id === id) ?? null;
  const [form, setForm] = useState<TaskFormValue | null>(null);
  const [valid, setValid] = useState(true);
  // Seeded per task id AND version. Checklist tasks are inserted with one
  // shared updated_at, so the timestamp alone let task 2 open (and save)
  // with task 1's fields.
  const [seedKey, setSeedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const key = task ? `${task.id}:${task.updated_at}` : null;
  if (task && key !== seedKey) {
    setSeedKey(key);
    setForm(formFromTask(task));
    setValid(true);
  }

  async function invalidate() {
    for (const k of TASK_INVALIDATE) await qc.invalidateQueries({ queryKey: [k] });
  }

  async function save() {
    if (!form || !task || busy || !valid) return;
    if (!form.title.trim()) {
      Alert.alert(copy.errorTitle);
      return;
    }
    setBusy(true);
    try {
      await post(`/couple/tasks/${task.id}`, form);
      await invalidate();
      leave.release();
      back();
    } catch (err) {
      Alert.alert(copy.error, errorText(err, lang, copy.error));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: "done" | "todo") {
    if (!task || busy) return;
    setBusy(true);
    try {
      const r = await post<{ task: TaskView; clone: TaskView | null }>(`/couple/tasks/${task.id}/status`, { status });
      await invalidate();
      if (r.clone?.due_date) Alert.alert(fmt(copy.repeatCloned, { date: r.clone.due_date }));
    } catch (err) {
      Alert.alert(copy.error, errorText(err, lang, copy.error));
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
      leave.release();
      back();
    } catch (err) {
      Alert.alert(copy.error, errorText(err, lang, copy.error));
    } finally {
      setBusy(false);
    }
  }

  const due = task ? dueLabel(task, copy, lang) : null;
  // Typed changes not saved yet ask before leaving (lib/unsaved).
  const dirty = !!(canEdit && task && form && JSON.stringify(form) !== JSON.stringify(formFromTask(task)));
  const leave = useUnsavedGuard(dirty);

  return (
    <Screen query={mainQuery} header={<TopBar onBack={() => leave(back)} title={copy.editTask} />} bottomInset={40} keyboard>
      {isLoading && !board ? <Skeleton h={200} r={18} /> : null}
      {board && !task ? <EmptyState title={copy.notFound} /> : null}
      {task && form ? (
        <Stack gap={18}>
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
          <TaskForm board={board} value={form} onChange={setForm} showStatus disabled={!canEdit} onValidityChange={setValid} />
          {canEdit ? <Button label={copy.save} onPress={save} loading={busy} disabled={!online || !valid} style={{ marginTop: 8 }} /> : null}
          {!canEdit ? (
            <T v="meta13" color={colors.ivory55} center>
              {copy.readOnly}
            </T>
          ) : null}
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

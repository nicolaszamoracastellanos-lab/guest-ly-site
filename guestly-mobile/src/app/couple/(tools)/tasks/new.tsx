// New task on the couple's list.

import React, { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post } from "@/lib/api";
import { useOnline } from "@/lib/query";
import { Screen, TopBar, Button, Stack, Banner } from "@/ui";
import { COPY } from "@/features/tasks/copy";
import { useTasksBoard, TASK_INVALIDATE } from "@/features/tasks/hooks";
import { TaskForm, emptyForm, errorText, type TaskFormValue } from "@/features/tasks/ui";
import { useSafeBack } from "@/lib/nav";
import { useUnsavedGuard } from "@/lib/unsaved";

export default function NewTask() {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const back = useSafeBack();
  const qc = useQueryClient();
  const online = useOnline();
  const { data: board } = useTasksBoard();
  const [form, setForm] = useState<TaskFormValue | null>(null);
  const [busy, setBusy] = useState(false);
  const [valid, setValid] = useState(true);
  const value = form ?? emptyForm(board);
  // Every visit starts from a blank task: a stack root reached by a link
  // stays mounted when left, and used to reopen with the discarded draft.
  useFocusEffect(useCallback(() => () => setForm(null), []));
  // Anything typed asks before leaving (lib/unsaved).
  const leave = useUnsavedGuard(form !== null && JSON.stringify(form) !== JSON.stringify(emptyForm(board)));

  async function submit() {
    if (busy || !valid) return;
    if (!value.title.trim()) {
      Alert.alert(copy.errorTitle);
      return;
    }
    setBusy(true);
    try {
      await post("/couple/tasks", value);
      for (const k of TASK_INVALIDATE) await qc.invalidateQueries({ queryKey: [k] });
      setForm(null);
      leave.release();
      back();
    } catch (err) {
      Alert.alert(copy.error, errorText(err, lang, copy.error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header={<TopBar onBack={() => leave(back)} title={copy.newTask} />} bottomInset={40} keyboard>
      <Stack gap={18}>
        {!online ? <Banner icon="wifi-off" title={copy.offline} /> : null}
        <TaskForm board={board} value={value} onChange={setForm} onValidityChange={setValid} />
        <Button label={copy.create} onPress={submit} loading={busy} disabled={!online || !valid} style={{ marginTop: 8 }} />
      </Stack>
    </Screen>
  );
}

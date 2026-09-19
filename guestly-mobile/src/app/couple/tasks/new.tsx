// New task on the couple's list.

import React, { useState } from "react";
import { Alert } from "react-native";
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

export default function NewTask() {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const back = useSafeBack();
  const qc = useQueryClient();
  const online = useOnline();
  const { data: board } = useTasksBoard();
  const [form, setForm] = useState<TaskFormValue | null>(null);
  const [busy, setBusy] = useState(false);
  const value = form ?? emptyForm(board);

  async function submit() {
    if (!value.title.trim()) {
      Alert.alert(copy.errorTitle);
      return;
    }
    setBusy(true);
    try {
      await post("/couple/tasks", value);
      for (const k of TASK_INVALIDATE) await qc.invalidateQueries({ queryKey: [k] });
      back();
    } catch (err) {
      Alert.alert(copy.error, errorText(err, lang, ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header={<TopBar onBack={back} title={copy.newTask} />} bottomInset={40} keyboard>
      <Stack gap={18}>
        {!online ? <Banner icon="wifi-off" title={copy.offline} /> : null}
        <TaskForm board={board} value={value} onChange={setForm} />
        <Button label={copy.create} onPress={submit} loading={busy} disabled={!online} style={{ marginTop: 8 }} />
      </Stack>
    </Screen>
  );
}

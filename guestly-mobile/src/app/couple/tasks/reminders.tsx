// Reminder email switch and the subscribable calendar feed.

import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post } from "@/lib/api";
import { useOnline } from "@/lib/query";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, BigTitle, Button, Stack, Banner, Skeleton, Card, T, Row, Toggle, SectionLabel } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/tasks/copy";
import { useTasksBoard, TASK_INVALIDATE } from "@/features/tasks/hooks";
import { errorText, ConfirmSheet } from "@/features/tasks/ui";

export default function Reminders() {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const online = useOnline();
  const user = useUserSession();
  const canEdit = user?.me.can_edit ?? false;
  const { data: board, isLoading } = useTasksBoard();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);

  async function invalidate() {
    for (const k of TASK_INVALIDATE) await qc.invalidateQueries({ queryKey: [k] });
  }

  async function setEnabled(enabled: boolean) {
    setBusy(true);
    try {
      await post("/couple/tasks/reminders", { enabled });
      await invalidate();
    } catch (err) {
      Alert.alert(copy.error, errorText(err, lang, ""));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!board?.feed_url) return;
    await Clipboard.setStringAsync(board.feed_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function rotate() {
    setBusy(true);
    try {
      await post("/couple/tasks/feed/rotate", {});
      await invalidate();
      setConfirmRotate(false);
    } catch (err) {
      Alert.alert(copy.error, errorText(err, lang, ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={copy.title} />} bottomInset={60}>
      <BigTitle title={copy.reminders} size={34} />
      {!online ? <Banner icon="wifi-off" title={copy.offline} /> : null}
      <Stack gap={16} style={{ marginTop: 20 }}>
        {isLoading && !board ? <Skeleton h={120} r={18} /> : null}
        {board ? (
          <>
            <Card kind="solid" padding={16}>
              <Row style={{ justifyContent: "space-between", minHeight: 44 }}>
                <T v="body16">{copy.remindersSwitch}</T>
                <Toggle value={board.settings.reminders_enabled} onChange={(v) => canEdit && !busy && setEnabled(v)} label={copy.remindersSwitch} />
              </Row>
              <T v="meta13" color={colors.ivory55} style={{ marginTop: 8 }}>
                {copy.remindersBody} ({board.tz})
              </T>
            </Card>
            <Card kind="solid" padding={16}>
              <SectionLabel color={colors.goldLight}>{copy.feedTitle}</SectionLabel>
              <T v="body15" color={colors.ivory70} style={{ marginTop: 8 }}>
                {copy.feedBody}
              </T>
              {board.feed_url ? (
                <View style={{ marginTop: 12, gap: 10 }}>
                  <T v="meta13" color={colors.ivory55} numberOfLines={2}>
                    {board.feed_url}
                  </T>
                  <Button label={copied ? copy.copied : copy.copyLink} icon="share" small kind="glass" onPress={copyLink} />
                  {canEdit ? <Button label={copy.rotate} small kind="ghost" onPress={() => setConfirmRotate(true)} /> : null}
                </View>
              ) : (
                <T v="meta13" color={colors.amber} style={{ marginTop: 10 }}>
                  {copy.pending}
                </T>
              )}
            </Card>
          </>
        ) : null}
      </Stack>
      <ConfirmSheet visible={confirmRotate} title={copy.rotate} body={copy.rotateBody} confirmLabel={copy.rotate} onConfirm={rotate} onClose={() => setConfirmRotate(false)} busy={busy} />
    </Screen>
  );
}

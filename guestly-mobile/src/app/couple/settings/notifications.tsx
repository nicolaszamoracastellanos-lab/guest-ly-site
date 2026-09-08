// Email notification switches (RSVP emails, Monday digest).

import React, { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { useFeatureCopy } from "@/i18n/feature";
import { Screen, TopBar, BigTitle, Card, T, Stack, Skeleton } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/settings/copy";
import { useCoupleSettings, SETTINGS_KEY, type CoupleSettings } from "@/features/settings/hooks";
import { SwitchRow } from "@/features/website/fields";

export default function NotificationSettings() {
  const c = useFeatureCopy(COPY).notifications;
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const { data, isLoading } = useCoupleSettings();
  const [busy, setBusy] = useState(false);

  async function set(key: "rsvp_email" | "weekly_digest", v: boolean) {
    if (busy) return;
    setBusy(true);
    const prev = data;
    qc.setQueryData<CoupleSettings>(SETTINGS_KEY, (old) => (old ? { ...old, notifications: { ...old.notifications, [key]: v } } : old));
    try {
      await post("/couple/settings", { [key]: v });
    } catch (err) {
      qc.setQueryData(SETTINGS_KEY, prev);
      Alert.alert(c.title, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={c.title} />} bottomInset={40}>
      <BigTitle title={c.title} sub={c.subtitle} size={38} />
      <Stack gap={12} style={{ marginTop: 20 }}>
        {isLoading && !data ? <Skeleton h={140} r={18} /> : null}
        {data ? (
          <Card kind="solid" padding={16}>
            <SwitchRow label={c.rsvpEmail} hint={c.rsvpEmailHint} value={data.notifications.rsvp_email} onChange={(v) => void set("rsvp_email", v)} />
            <SwitchRow label={c.weeklyDigest} hint={c.weeklyDigestHint} value={data.notifications.weekly_digest} onChange={(v) => void set("weekly_digest", v)} />
          </Card>
        ) : null}
        <T v="meta13" color={colors.ivory55}>
          {c.pushNote}
        </T>
      </Stack>
    </Screen>
  );
}

// Version history with restore (republish an older version).

import React, { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useFeatureCopy } from "@/i18n/feature";
import { relTime, useLang } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, BigTitle, Card, T, Badge, Button, ListRow, EmptyState, Skeleton, Stack } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/brain/copy";
import { useBrain } from "@/features/brain/hooks";

export default function BrainVersions() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const user = useUserSession();
  const canEdit = user?.me.can_edit ?? false;
  const { data, isLoading, refetch } = useBrain();
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function restore(version: number) {
    Alert.alert(c.restore, c.restoreConfirm(version), [
      { text: c.cancel, style: "cancel" },
      {
        text: c.yes,
        onPress: async () => {
          setBusy(version);
          try {
            await post("/couple/brain/rollback", { version });
            setNotice(c.restored(version));
            await refetch();
          } catch (err) {
            Alert.alert(c.publishFailed, err instanceof ApiFailure ? err.messages[lang] : "");
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={c.title} />} bottomInset={40}>
      <BigTitle title={c.versionsTitle} size={36} />
      {notice ? (
        <T v="body15" color={colors.greenText} style={{ marginTop: 10 }}>
          {notice}
        </T>
      ) : null}
      <Card kind="solid" padding={4} style={{ marginTop: 20, paddingHorizontal: 18 }}>
        {isLoading && !data ? (
          <Stack gap={10} style={{ paddingVertical: 12 }}>
            <Skeleton h={48} />
            <Skeleton h={48} />
          </Stack>
        ) : !data?.versions.length ? (
          <EmptyState title={c.noVersions} />
        ) : (
          data.versions.map((v, i) => (
            <ListRow
              key={v.version}
              title={`v${v.version}`}
              sub={v.published ? c.publishedAgo(relTime(v.published_at, lang)) : relTime(v.updated_at, lang)}
              trailing={
                v.published ? (
                  <Badge label={c.liveBadge} kind="green" dot />
                ) : canEdit && i !== 0 ? (
                  <Button label={c.restore} kind="glass" small full={false} loading={busy === v.version} onPress={() => restore(v.version)} />
                ) : canEdit && data.published_version && v.version !== data.published_version ? (
                  <Button label={c.restore} kind="glass" small full={false} loading={busy === v.version} onPress={() => restore(v.version)} />
                ) : (
                  <Badge label={c.draftBadge} kind="mute" />
                )
              }
              chevron={false}
              last={i === data.versions.length - 1}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}

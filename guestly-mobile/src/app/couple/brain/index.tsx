// Wedding brain: live status, sections with completeness, publish.

import React, { useEffect, useState } from "react";
import { View, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useFeatureCopy } from "@/i18n/feature";
import { relTime, useLang } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, BigTitle, Card, T, Badge, Button, ListRow, Row, Stack, Skeleton, SectionLabel, Gem, Icon } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/brain/copy";
import { useBrain, BRAIN_KEY } from "@/features/brain/hooks";
import { initDraft, useDraft, isDirty, saveNow, setSavedListener } from "@/features/brain/draft";
import { SECTIONS, sectionFill } from "@/features/brain/sections";

export default function BrainHome() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useUserSession();
  const canEdit = user?.me.can_edit ?? false;
  const { data, isLoading, refetch } = useBrain();
  const draft = useDraft();
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (data) initDraft(data.facts, data.head_version);
  }, [data]);

  useEffect(() => {
    setSavedListener(() => void qc.invalidateQueries({ queryKey: BRAIN_KEY }));
    return () => setSavedListener(null);
  }, [qc]);

  const dirty = isDirty();
  const differs = dirty || draft.status === "saving" || (data?.draft_differs ?? false);

  async function publish() {
    setPublishing(true);
    setNotice(null);
    try {
      await saveNow();
      const r = await post<{ version: number }>("/couple/brain/publish", { facts: draft.facts });
      setNotice(c.published(r.version));
      await refetch();
    } catch (err) {
      Alert.alert(c.publishFailed, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setPublishing(false);
    }
  }

  const facts = draft.facts as Record<string, unknown>;

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={c.title} />} bottomInset={40}>
      <BigTitle title={c.title} sub={c.subtitle} size={38} />

      <Card kind="glass" padding={16} style={{ marginTop: 20 }}>
        {isLoading && !data ? (
          <Skeleton h={40} />
        ) : (
          <Stack gap={8}>
            <Row style={{ justifyContent: "space-between" }}>
              <Row gap={8}>
                <Gem />
                <T v="body16">{data?.published_version ? c.live(data.published_version) : c.nothingLive}</T>
              </Row>
              {data?.published_version ? <Badge label={differs ? c.draftBadge : c.liveBadge} kind={differs ? "amber" : "green"} dot /> : null}
            </Row>
            {data?.published_at ? (
              <T v="meta13" color={colors.ivory55}>
                {c.publishedAgo(relTime(data.published_at, lang))}
              </T>
            ) : null}
            <T v="meta13" color={differs ? colors.amber : colors.ivory55}>
              {draft.status === "saving" ? c.saving : draft.status === "error" ? c.saveFailed : differs ? c.draftNotLive : c.inSync}
            </T>
            {notice ? (
              <T v="body15" color={colors.greenText}>
                {notice}
              </T>
            ) : null}
            {canEdit ? <Button label={publishing ? c.publishing : c.publish} onPress={publish} loading={publishing} disabled={!differs && !!data?.published_version} style={{ marginTop: 6 }} /> : null}
            {!canEdit ? (
              <T v="meta13" color={colors.ivory55}>
                {c.readOnly}
              </T>
            ) : null}
          </Stack>
        )}
      </Card>

      <SectionLabel style={{ marginTop: 26, marginBottom: 6 }}>{c.sections}</SectionLabel>
      <Card kind="solid" padding={4} style={{ paddingHorizontal: 18 }}>
        {SECTIONS.map((s, i) => {
          const fill = sectionFill(s, facts);
          const sub = fill.count !== null ? c.items(fill.count) : fill.filled === 0 ? c.empty : fill.filled === fill.total ? c.complete : `${fill.filled}/${fill.total}`;
          const done = fill.count !== null ? fill.count > 0 : fill.filled > 0;
          return (
            <ListRow
              key={s.key}
              leading={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: done ? colors.gold : colors.ivory25 }} />}
              title={c.section[s.key] ?? s.key}
              sub={sub}
              onPress={() => router.push({ pathname: "/couple/brain/section/[key]", params: { key: s.key } })}
              last={i === SECTIONS.length - 1}
            />
          );
        })}
      </Card>

      <Stack gap={10} style={{ marginTop: 22 }}>
        <ListRow leading={<Icon name="sparkle" size={22} color={colors.goldLight} />} title={c.preview} sub={c.previewSub} onPress={() => router.push("/couple/brain/preview")} last />
        <ListRow leading={<Icon name="undo" size={22} color={colors.goldLight} />} title={c.versions} sub={data ? c.items(data.versions.length) : ""} onPress={() => router.push("/couple/brain/versions")} last />
      </Stack>
    </Screen>
  );
}

// The day-of runsheet: blocks by day, status chips that cycle on tap, add,
// template seed when empty, and the calendar file.

import React, { useState } from "react";
import { View, Linking, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post, ApiFailure } from "@/lib/api";
import { useOnline } from "@/lib/query";
import {
  Screen,
  TopBar,
  BigTitle,
  T,
  Button,
  Row,
  Stack,
  Skeleton,
  EmptyState,
  IconButton,
} from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/runsheet/copy";
import {
  useCoupleRunsheet,
  nextStatus,
  RUNSHEET_KEY,
  type RunsheetBlock,
  type RunsheetSurface,
} from "@/features/runsheet/hooks";
import { RunsheetList } from "@/features/runsheet/list";

export default function CoupleRunsheet() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const online = useOnline();
  const { data, isLoading, error } = useCoupleRunsheet();
  const [seeding, setSeeding] = useState(false);

  async function cycle(b: RunsheetBlock) {
    const status = nextStatus(b.status);
    qc.setQueryData<RunsheetSurface>(RUNSHEET_KEY, (cur) =>
      cur
        ? {
            ...cur,
            days: cur.days.map((d) => ({
              ...d,
              blocks: d.blocks.map((x) =>
                x.id === b.id ? { ...x, status } : x,
              ),
            })),
          }
        : cur,
    );
    try {
      await post(`/couple/runsheet/${b.id}/status`, { status });
    } catch (err) {
      Alert.alert(c.error, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      void qc.invalidateQueries({ queryKey: RUNSHEET_KEY });
    }
  }

  async function seed() {
    setSeeding(true);
    try {
      const next = await post<RunsheetSurface>("/couple/runsheet/seed", {});
      qc.setQueryData(RUNSHEET_KEY, next);
    } catch (err) {
      Alert.alert(c.error, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setSeeding(false);
    }
  }

  const canEdit = data?.can_edit ?? false;

  return (
    <Screen
      header={
        <TopBar
          onBack={() => router.back()}
          title={c.title}
          right={
            <Row gap={8}>
              {data?.blocks_total ? (
                <IconButton
                  name="calendar-plus"
                  label={c.addCalendar}
                  onPress={() => Linking.openURL(data.ics_url)}
                />
              ) : null}
              {canEdit ? (
                <IconButton
                  name="plus"
                  label={c.addBlock}
                  onPress={() => router.push("/couple/runsheet/new")}
                />
              ) : null}
            </Row>
          }
        />
      }
      bottomInset={40}
    >
      <BigTitle title={c.title} sub={c.intro} size={38} />
      {error instanceof ApiFailure ? (
        <T v="body15" color={colors.ivory55} style={{ marginTop: 16 }}>
          {error.messages[lang]}
        </T>
      ) : null}
      {isLoading && !data ? (
        <Stack gap={10} style={{ marginTop: 20 }}>
          <Skeleton h={56} />
          <Skeleton h={56} />
          <Skeleton h={56} />
        </Stack>
      ) : null}
      {data?.pending ? (
        <T v="body15" color={colors.ivory55} style={{ marginTop: 16 }}>
          {c.pendingDb}
        </T>
      ) : null}
      {data && !data.pending && !data.blocks_total ? (
        <View style={{ marginTop: 24 }}>
          <EmptyState
            title={c.emptyTitle}
            body={c.emptyHint}
            action={
              canEdit ? (
                <Button
                  label={c.template}
                  icon="sparkle"
                  onPress={seed}
                  loading={seeding}
                  disabled={!online}
                />
              ) : undefined
            }
          />
          {canEdit ? (
            <Button
              label={c.addBlock}
              kind="glass"
              icon="plus"
              onPress={() => router.push("/couple/runsheet/new")}
              style={{ marginTop: 8 }}
            />
          ) : null}
        </View>
      ) : null}
      {data && data.blocks_total ? (
        <>
          <T v="meta13" color={colors.ivory55} style={{ marginTop: 10 }}>
            {data.blocks_total === 1
              ? c.block
              : fmt(c.blocks, { n: data.blocks_total })}
            {canEdit ? ` · ${c.tapStatus}` : ` · ${c.readOnly}`}
          </T>
          <RunsheetList
            data={data}
            canEdit={canEdit && online}
            onStatus={cycle}
            onOpen={
              canEdit
                ? (b) =>
                    router.push({
                      pathname: "/couple/runsheet/[id]",
                      params: { id: b.id },
                    })
                : undefined
            }
          />
          {canEdit ? (
            <Button
              label={c.addBlock}
              kind="glass"
              icon="plus"
              onPress={() => router.push("/couple/runsheet/new")}
              style={{ marginTop: 22 }}
            />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

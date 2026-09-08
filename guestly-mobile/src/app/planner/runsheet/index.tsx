// The planner's runsheet: the couple's day, read-only, as on the web.

import React from "react";
import { Linking } from "react-native";
import { useRouter } from "expo-router";
import { useLang, fmt } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure } from "@/lib/api";
import {
  Screen,
  TopBar,
  BigTitle,
  T,
  Skeleton,
  Stack,
  EmptyState,
  IconButton,
} from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/runsheet/copy";
import { usePlannerRunsheet } from "@/features/runsheet/hooks";
import { RunsheetList } from "@/features/runsheet/list";

export default function PlannerRunsheet() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const { data, isLoading, error } = usePlannerRunsheet();
  return (
    <Screen
      header={
        <TopBar
          onBack={() => router.back()}
          title={c.title}
          right={
            data?.blocks_total ? (
              <IconButton
                name="calendar-plus"
                label={c.addCalendar}
                onPress={() => Linking.openURL(data.ics_url)}
              />
            ) : undefined
          }
        />
      }
      bottomInset={40}
    >
      <BigTitle title={c.title} sub={c.readOnly} size={38} />
      {error instanceof ApiFailure ? (
        <T v="body15" color={colors.ivory55} style={{ marginTop: 16 }}>
          {error.messages[lang]}
        </T>
      ) : null}
      {isLoading && !data ? (
        <Stack gap={10} style={{ marginTop: 20 }}>
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
        <EmptyState title={c.emptyTitle} />
      ) : null}
      {data && data.blocks_total ? (
        <>
          <T v="meta13" color={colors.ivory55} style={{ marginTop: 10 }}>
            {data.blocks_total === 1
              ? c.block
              : fmt(c.blocks, { n: data.blocks_total })}
          </T>
          <RunsheetList data={data} canEdit={false} />
        </>
      ) : null}
    </Screen>
  );
}

// The planner's runsheet: the couple's day, read-only, as on the web.

import React from "react";
import { Linking } from "react-native";
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
  Row,
} from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/runsheet/copy";
import { usePlannerRunsheet } from "@/features/runsheet/hooks";
import { RunsheetList } from "@/features/runsheet/list";
import { useSafeBack } from "@/lib/nav";
import { useRouter } from "expo-router";
import { can, useUserSession } from "@/lib/session";
import { DAYOF_COPY } from "@/features/dayof/copy";
import { useDayPack, useDayPackFlag } from "@/features/dayof/hooks";

export default function PlannerRunsheet() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const back = useSafeBack();
  const mainQuery = usePlannerRunsheet();
  const { data, isLoading, error } = mainQuery;
  // #30: with the open wedding's Day pack saved, the live day-of view is one tap away.
  const router = useRouter();
  const me = useUserSession()?.me;
  const live = useFeatureCopy(DAYOF_COPY);
  const packOn = useDayPackFlag() && can(me, "runsheet", "view");
  const pack = useDayPack("planner", me?.tenant.slug, packOn);
  const liveButton = packOn && pack.entry ? <IconButton name="clock" label={live.openLive} onPress={() => router.push("/planner/dayof" as never)} testID="runsheet-open-live" /> : null;
  return (
    <Screen query={mainQuery} refresh
      header={
        <TopBar
          onBack={back}
          title={c.title}
          right={
            data?.blocks_total || liveButton ? (
              <Row gap={8}>
                {liveButton}
                {data?.blocks_total ? (
                  <IconButton
                    name="calendar-plus"
                    label={c.addCalendar}
                    onPress={() => Linking.openURL(data.ics_url)}
                  />
                ) : null}
              </Row>
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

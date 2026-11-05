// #26 the planner's arrivals and departures for one wedding (1.4.0,
// MW_TRAVEL_WINDOWS, logistics view): /planner/weddings/arrivals?slug=. The
// wedding summary shows the entry only while the route answers.

import React from "react";
import { useLocalSearchParams } from "expo-router";
import { useFeatureCopy } from "@/i18n/feature";
import { useSafeBack } from "@/lib/nav";
import { Screen, TopBar, BigTitle, Skeleton, Stack } from "@/ui";
import { TRAVEL_COPY } from "@/features/travel/copy";
import { usePlannerArrivals } from "@/features/travel/hooks";
import { ArrivalsBoard } from "@/features/travel/Board";

export default function PlannerArrivals() {
  const c = useFeatureCopy(TRAVEL_COPY);
  const back = useSafeBack();
  const { slug, names } = useLocalSearchParams<{ slug?: string; names?: string }>();
  const q = usePlannerArrivals(slug);
  return (
    <Screen query={q} refresh header={<TopBar onBack={back} title={c.boardTitle} />}>
      <BigTitle title={c.boardTitle} sub={names || c.boardIntro} size={34} />
      {q.isLoading && !q.data ? (
        <Stack gap={10} style={{ marginTop: 20 }}>
          <Skeleton h={44} r={22} />
          <Skeleton h={160} r={18} />
        </Stack>
      ) : q.data ? (
        <ArrivalsBoard data={q.data} planner />
      ) : null}
    </Screen>
  );
}

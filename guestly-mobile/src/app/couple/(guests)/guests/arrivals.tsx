// #26 the couple's arrivals and departures, read only (1.4.0,
// MW_TRAVEL_WINDOWS). Opened from the guest list menu, which shows the row
// only while GET /couple/arrivals answers; a 404 here goes back.

import React from "react";
import { useFeatureCopy } from "@/i18n/feature";
import { useSafeBack } from "@/lib/nav";
import { Screen, TopBar, BigTitle, Skeleton, Stack } from "@/ui";
import { TRAVEL_COPY } from "@/features/travel/copy";
import { useCoupleArrivals } from "@/features/travel/hooks";
import { ArrivalsBoard } from "@/features/travel/Board";

export default function CoupleArrivals() {
  const c = useFeatureCopy(TRAVEL_COPY);
  const back = useSafeBack();
  const q = useCoupleArrivals();
  return (
    <Screen query={q} refresh header={<TopBar onBack={back} title={c.boardTitle} />}>
      <BigTitle title={c.boardTitle} sub={c.boardIntro} size={34} />
      {q.isLoading && !q.data ? (
        <Stack gap={10} style={{ marginTop: 20 }}>
          <Skeleton h={44} r={22} />
          <Skeleton h={160} r={18} />
          <Skeleton h={160} r={18} />
        </Stack>
      ) : q.data ? (
        <ArrivalsBoard data={q.data} />
      ) : null}
    </Screen>
  );
}

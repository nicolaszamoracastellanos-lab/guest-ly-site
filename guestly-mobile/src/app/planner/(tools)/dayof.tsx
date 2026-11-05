// The planner's wedding-day view (#30): the open wedding's Day pack, live and
// offline, the same view as the couple's. Without the pack (flag off, or a
// portal that answers 404) the runsheet opens instead.

import React from "react";
import { Redirect } from "expo-router";
import { LiveDay } from "@/features/dayof/LiveDay";
import { useDayPack, useDayPackFlag } from "@/features/dayof/hooks";
import { can, useUserSession } from "@/lib/session";

export default function PlannerDayOf() {
  const me = useUserSession()?.me;
  const flag = useDayPackFlag() && can(me, "runsheet", "view");
  const slug = me?.tenant.slug ?? null;
  const { status } = useDayPack("planner", slug, flag);
  if (!flag || !slug || status.missing) return <Redirect href={"/planner/runsheet" as never} />;
  return <LiveDay role="planner" slug={slug} />;
}

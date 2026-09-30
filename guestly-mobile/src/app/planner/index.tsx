// Planner home: greeting, needs you, two tiles, the weddings list.

import React, { useRef } from "react";
import { View, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { fmt, plural, useCopy, useLang, mediumDate } from "@/i18n";
import { usePlannerHome } from "@/lib/hooks";
import { can, useSession, useUserSession } from "@/lib/session";
import { Screen, TopBar, Wordmark, IconButton, Badge, T, Row, StatTile, SectionLabel, Skeleton, Card, ListRow, BriefingRow, useBubbleAvoid } from "@/ui";
import { colors } from "@/ui/tokens";

export default function PlannerHome() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const user = useUserSession();
  const { switchTenant, switchingTenant } = useSession();
  const mainQuery = usePlannerHome();
  const { data, isLoading } = mainQuery;
  const hour = new Date().getHours();
  const part = hour < 12 ? copy.planner.morning : hour < 19 ? copy.planner.afternoon : copy.planner.evening;
  // Never derived from the email: without a profile name the greeting has no name.
  const name = (data?.greeting_name ?? "").trim();
  const needs = needsPlanner(data);
  // Same fixer-round-3 fix as couple/index.tsx: the stat tiles and the
  // weddings list can sit right where the bubble rests at some window
  // heights (390 pt wide) even though the screen's own scroll ends clear.
  const afterBriefing = useRef<View>(null);
  const bubbleAvoid = useBubbleAvoid(afterBriefing);

  return (
    <Screen query={mainQuery} refresh header={<TopBar left={<Row gap={8}><Wordmark height={20} /><Badge label={copy.settings.planner} kind="gold" /></Row>} right={<IconButton name="bell" badge={needs > 0} onPress={() => router.push("/planner/requests")} label={copy.planner.tabs.requests} />} />}>
      <View style={{ marginTop: 18 }}>
        <T v="title42" size={38}>
          {name ? fmt(copy.planner.greeting, { part, name: cap(name) }) : fmt(copy.planner.greetingNoName, { part })}
        </T>
        <T v="body15" color={colors.ivory55} style={{ marginTop: 6 }}>
          {fmt(copy.planner.subtitle, { weddings: plural(data?.weddings.length ?? user?.me.tenants.length ?? 0, copy.planner.weddingsCount), needs: plural(needs, copy.planner.needsCount) })}
        </T>
      </View>
      <SectionLabel style={{ marginTop: 26, marginBottom: 6 }}>{copy.planner.needsYou}</SectionLabel>
      {isLoading && !data ? <Skeleton h={58} /> : null}
      {data && !data.briefing.length ? (
        <T v="body15" color={colors.ivory55} style={{ paddingVertical: 12 }}>
          {copy.coupleHome.briefingEmpty}
        </T>
      ) : null}
      {(data?.briefing ?? []).map((b, i) => (
        <BriefingRow key={i} text={b.text} tone={b.tone} onPress={() => go(b.href)} />
      ))}
      <View ref={afterBriefing} {...bubbleAvoid}>
        <Row gap={8} style={{ marginTop: 22 }}>
          <StatTile value={String(data?.totals.attending_seats ?? "·")} label={`${copy.rsvps.tiles.attending} · ${user?.me.tenant.couple_names ?? ""}`} />
          <StatTile value={String(data?.totals.pending_parties ?? "·")} label={copy.rsvps.tiles.pending} color={colors.amber} />
        </Row>
        <Row style={{ justifyContent: "space-between", marginTop: 26 }}>
          <SectionLabel>{copy.planner.yourWeddings}</SectionLabel>
        </Row>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18, marginTop: 8 }}>
          {(data?.weddings ?? []).map((w, i, arr) => (
            <ListRow
              key={w.slug}
              title={`${w.couple_names}${w.wedding_date ? ` · ${mediumDate(w.wedding_date, lang)}` : ""}`}
              sub={w.current ? `${copy.planner.current}${w.days_to_go !== null ? ` · ${w.days_to_go} ${copy.common.days}` : ""}` : w.days_to_go !== null && w.days_to_go < 30 ? `${copy.planner.nextUp} · ${w.days_to_go} ${copy.common.days}` : copy.planner.quiet}
              trailing={switchingTenant === w.slug ? <ActivityIndicator color={colors.goldLight} /> : <Badge label={plural(w.open_requests, copy.planner.open)} kind={w.open_requests ? "amber" : "mute"} />}
              onPress={() => void openWedding(w.slug, w.current)}
              chevron={!w.current}
              last={i === arr.length - 1}
            />
          ))}
        </Card>
      </View>
    </Screen>
  );

  // Switching commits only when the new wedding answered; the screen then
  // refetches everything for it (core review P0-2, P0-4).
  async function openWedding(slug: string, current: boolean) {
    if (current || switchingTenant) return;
    const ok = await switchTenant(slug);
    if (!ok) Alert.alert(copy.common.error, copy.core.switchFailed);
  }

  function go(href: string) {
    const map: [string, string][] = [
      ["requests", "/planner/requests"],
      ["guests", "/planner/guests"],
      ["tasks", "/planner/tasks"],
      ["budget", "/planner/budget"],
      ["runsheet", "/planner/runsheet"],
      ["vendors", "/planner/vendors"],
      ["broadcasts", "/planner/broadcasts"],
      ["seating", "/planner/seating"],
      ["assistant", "/assistant"],
    ];
    const hit = map.find(([web]) => href.includes(web));
    // A tool that is off for this planner opens More instead of a refusal.
    const tool = hit ? (hit[0] === "assistant" ? "coordinator" : hit[0] === "requests" ? null : hit[0]) : null;
    router.push((hit && (!tool || can(user?.me, tool)) ? hit[1] : "/planner/more") as never);
  }
}

/**
 * What waits on the planner, counted in one unit (briefing rows), never rows
 * plus open requests (core review P2-31). Requests waiting on the couple do
 * not count. The portal's planner rows about requests and due tasks both link
 * to /planner/requests, so those are replaced by one row for the planner's own
 * open tasks. A row the portal marks `needs_you` is trusted as is.
 */
function needsPlanner(data: { briefing: { href: string; needs_you?: boolean }[]; open_tasks: number } | undefined): number {
  if (!data) return 0;
  if (data.briefing.some((b) => typeof b.needs_you === "boolean")) return data.briefing.filter((b) => b.needs_you).length;
  const other = data.briefing.filter((b) => !b.href.includes("/planner/requests")).length;
  return other + (data.open_tasks > 0 ? 1 : 0);
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// Weddings tab: the planner's portfolio. The list shows every wedding with its
// health, seats and what waits on the planner; the summary is one wedding's
// numbers, what the couple shared, and the way into its tools. Beside each
// other on a window with room for two panes (MasterDetail), one at a time
// otherwise.

import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { fmt, plural, useLang, longDate } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { usePlannerPortfolio, type PlannerPortfolioWedding } from "@/lib/hooks";
import { useUserSession } from "@/lib/session";
import { useSafeBack } from "@/lib/nav";
import { usePane } from "@/ui/MasterDetail";
import { Screen, TopBar, BigTitle, Stack, Skeleton, Card, Row, T, Icon, Button, StatTile, SectionLabel, Chip, EmptyState, ListRow } from "@/ui";
import { TRAVEL_COPY } from "@/features/travel/copy";
import { usePlannerArrivals } from "@/features/travel/hooks";
import { colors } from "@/ui/tokens";
import { PlannerTop } from "@/app/planner/_layout";
import { COPY } from "./copy";
import { HealthDot, SeatsBar, WeddingCard, daysLabel, useWorkOnWedding } from "./Cockpit";

export function WeddingsList() {
  const l = useFeatureCopy(COPY);
  const pane = usePane();
  const router = useRouter();
  const q = usePlannerPortfolio();
  const rows = q.data?.weddings ?? [];
  return (
    <Screen query={q} refresh header={<PlannerTop />}>
      <BigTitle title={l.tabs.weddings} sub={rows.length ? plural(rows.length, l.weddingsSub) : ""} />
      <Stack gap={12} style={{ marginTop: 20 }}>
        {q.isLoading && !q.data ? (
          <>
            <Skeleton h={120} r={18} />
            <Skeleton h={120} r={18} />
          </>
        ) : null}
        {rows.map((w) => (
          <WeddingCard
            key={w.slug}
            w={w}
            selected={pane.selected === w.slug}
            onPress={() => pane.open(w.slug, () => router.push({ pathname: "/planner/weddings/[slug]", params: { slug: w.slug } } as never))}
          />
        ))}
        {q.data && !rows.length ? <EmptyState title={l.tabs.weddings} body={l.needsEmptyBody} /> : null}
      </Stack>
    </Screen>
  );
}

const TOOL_LINKS = [
  { key: "guests", path: "/planner/guests", label: "openGuests" },
  { key: "tasks", path: "/planner/requests", label: "openTasks" },
  { key: "runsheet", path: "/planner/runsheet", label: "openRunsheet" },
  { key: "budget", path: "/planner/budget", label: "openBudget" },
] as const;

export function WeddingSummary({ slug }: { slug: string }) {
  const l = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const back = useSafeBack();
  const pane = usePane();
  const me = useUserSession()?.me;
  const q = usePlannerPortfolio();
  const work = useWorkOnWedding();
  const w: PlannerPortfolioWedding | undefined = q.data?.weddings.find((x) => x.slug === slug);
  const current = !!me && w?.slug === me.tenant.slug;
  const travel = useFeatureCopy(TRAVEL_COPY);
  const arrivals = usePlannerArrivals(w?.slug ?? slug);

  async function openTool(path: string) {
    if (!w) return;
    if (await work(w.slug, w.couple_names)) router.navigate(path as never);
  }

  return (
    <Screen query={q} refresh header={<TopBar onBack={pane.embedded ? undefined : back} title={l.summary} />}>
      {!w ? (
        q.isLoading ? <Skeleton h={200} r={18} /> : null
      ) : (
        <Stack gap={16}>
          <View style={{ gap: 4 }}>
            <Row gap={8}>
              <HealthDot health={w.health} />
              <T v="label11" color={colors.goldLight}>
                {l.health[w.health]}
              </T>
            </Row>
            <T v="title30">{w.couple_names}</T>
            <T v="body15" color={colors.ivory70}>
              {[w.wedding_date ? longDate(w.wedding_date, lang) : "", daysLabel(w, l)].filter(Boolean).join(" · ")}
            </T>
          </View>

          {w.seats ? (
            <Card kind="solid" padding={16}>
              <Stack gap={12}>
                <Row gap={8}>
                  <StatTile value={String(w.seats.invited)} label={l.invited} />
                  <StatTile value={String(w.seats.attending)} label={l.going} color={colors.greenText} />
                </Row>
                <Row gap={8}>
                  <StatTile value={String(w.seats.declined)} label={l.notGoing} />
                  <StatTile value={String(w.seats.pending)} label={l.noReply} color={w.seats.pending ? colors.amber : colors.ivory} />
                </Row>
                <SeatsBar attending={w.seats.attending} declined={w.seats.declined} invited={w.seats.invited} />
                <T v="meta13" color={colors.ivory70}>
                  {fmt(l.seatsAnswered, { done: w.seats.attending + w.seats.declined, total: w.seats.invited })}
                </T>
              </Stack>
            </Card>
          ) : (
            <Card kind="solid" padding={16}>
              <Row gap={10}>
                <Icon name="lock" size={20} color={colors.ivory40} />
                <T v="body15" color={colors.ivory55}>
                  {l.notShared}
                </T>
              </Row>
            </Card>
          )}

          <Card kind="solid" padding={16}>
            <Stack gap={8}>
              {w.open_requests !== null ? <T v="body16">{plural(w.open_requests, l.openRequests)}</T> : null}
              {w.asks_planner ? <T v="body16" color={colors.amber}>{plural(w.asks_planner, l.asksYou)}</T> : null}
              {w.tasks ? <T v="body16">{plural(w.tasks.open, l.tasksOpen)}</T> : null}
              {w.tasks?.overdue ? <T v="body16" color={colors.red}>{plural(w.tasks.overdue, l.tasksOverdue)}</T> : null}
            </Stack>
          </Card>

          {/* #26: only while the wedding's arrivals answer (MW_TRAVEL_WINDOWS, logistics view). */}
          {arrivals.data ? (
            <Card kind="solid" padding={2} style={{ paddingHorizontal: 16 }}>
              <ListRow testID="planner-arrivals" leading={<Icon name="bus" size={22} color={colors.goldLight} />} title={travel.boardTitle} sub={`${travel.tabArrivals} · ${travel.tabDepartures}`} onPress={() => router.push({ pathname: "/planner/weddings/arrivals", params: { slug: w.slug, names: w.couple_names } } as never)} last />
            </Card>
          ) : null}

          <View style={{ gap: 8 }}>
            <SectionLabel color={colors.goldLight}>{l.access}</SectionLabel>
            <Row gap={8} style={{ flexWrap: "wrap" }}>
              {TOOL_LINKS.map((t) => (
                <Chip key={t.key} label={`${w.access[t.key] ? "" : "· "}${l[t.label]}`} on={w.access[t.key]} onPress={w.access[t.key] ? () => void openTool(t.path) : undefined} />
              ))}
            </Row>
          </View>

          <Button label={current ? fmt(l.working, { names: w.couple_names }) : l.workHere} kind={current ? "ghost" : "primary"} disabled={current} onPress={() => void work(w.slug, w.couple_names)} testID="planner-work-here" />
          {q.isError ? <Button label={l.retry} kind="text" onPress={() => void q.refetch()} /> : null}
        </Stack>
      )}
    </Screen>
  );
}

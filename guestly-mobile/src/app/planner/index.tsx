// Planner Hoy / Today (build 12, M12): the wedding pill, greeting, the gold
// "New request", "Needs you (N)" with exactly N rows, "Waiting on the couple",
// today's tasks with "Overdue" in red, and the Coordinator.
//
// "Needs you" holds only the rows the portal flags as the planner's to do;
// rows marked `needs_you: false` (requests waiting on the couple, new RSVPs)
// are not repeated here: what waits on the couple has its own card, built from
// the requests themselves (v1.2, B3; core review P2-31). A portal without the
// flag: every row is "Needs you", as before.

import React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { fmt, plural, useCopy, useLang, relTime } from "@/i18n";
import { usePlannerHome } from "@/lib/hooks";
import { can, useTenantKey, useUserSession } from "@/lib/session";
import { Screen, T, Row, SectionLabel, Skeleton, Card, ListRow, BriefingRow, Button, Icon, Stack } from "@/ui";
import { colors, fonts, radius } from "@/ui/tokens";
import { requestTitle } from "@/app/couple/requests/index";
import { PlannerTop, IconDisc, TaskCheckRow, usePlannerBoardQ, usePlannerRequestsQ, useTaskToggle, asksPlanner, dueOf, todayIso, daysToGo, kindIcon } from "@/app/planner/_layout";

export default function PlannerToday() {
  // A wedding switch remounts the body: nothing of the last wedding stays.
  return <PlannerTodayBody key={useTenantKey()} />;
}

function PlannerTodayBody() {
  const copy = useCopy();
  const c = copy.planner.b12;
  const { lang } = useLang();
  const router = useRouter();
  const me = useUserSession()?.me;
  const canTasks = can(me, "tasks");
  const canTasksEdit = can(me, "tasks", "edit");
  const canCoordinator = can(me, "coordinator");
  const home = usePlannerHome();
  const reqs = usePlannerRequestsQ(canTasks);
  const board = usePlannerBoardQ(canTasks);
  const toggle = useTaskToggle();
  const data = home.data;

  // Never derived from the email: without a profile name there is no name.
  const name = (data?.greeting_name ?? "").trim().split(/\s+/)[0] ?? "";
  const days = daysToGo(me, data?.weddings);
  const parties = data?.totals.parties ?? 0;
  const replied = parties - (data?.totals.pending_parties ?? 0);
  const sub = [days === null ? null : days === 0 ? c.weddingDay : plural(days, c.daysToGo), data && parties ? fmt(c.replied, { n: replied, total: parties }) : null].filter(Boolean).join(" · ");

  // Guest questions are the couple's to answer (M12): those rows never show
  // on the planner's Hoy, even from a portal that still sends them. Without a
  // kind (production today) they are the rows that link to Hoy itself
  // ("/planner") or to the Brain.
  const needs = (data?.briefing ?? []).filter((b) => b.needs_you !== false && !coupleOnlyRow(b));
  const waiting = (reqs.data?.requests ?? []).filter((r) => r.status === "open" && !asksPlanner(r));

  // Today's tasks: mine, open. With due dates (newer portals) only the ones
  // due today or late, late first; without them every open task of mine.
  // (A task ticked here stays, struck through, until the list refreshes, so
  // Undo has something to undo.)
  const mineOpen = (board.data?.tasks ?? []).filter((t) => t.assigned_to === "planner" && t.status !== "done");
  const dated = mineOpen.some((t) => dueOf(t));
  const today = todayIso();
  const tasks = (dated ? mineOpen.filter((t) => (dueOf(t) ?? "9999") <= today).sort((a, b) => (dueOf(a) ?? "").localeCompare(dueOf(b) ?? "")) : mineOpen).slice(0, 5);

  return (
    <Screen query={home} refresh={() => Promise.all([home.refetch(), canTasks ? reqs.refetch() : null, canTasks ? board.refetch() : null])} header={<PlannerTop />}>
      <View style={{ marginTop: 10 }}>
        <Row style={{ justifyContent: "space-between", minHeight: 44 }}>
          <SectionLabel color={colors.goldLight} style={{ flexShrink: 1 }}>
            {new Date().toLocaleDateString(lang === "es" ? "es-BO" : "en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </SectionLabel>
          {canCoordinator ? (
            <Pressable accessibilityRole="button" accessibilityLabel={c.coordinator} onPress={() => router.push("/assistant" as never)} hitSlop={4} style={({ pressed }) => [{ height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.goldBorder, flexDirection: "row", alignItems: "center", gap: 6 }, pressed && { opacity: 0.8 }]}>
              <Icon name="sparkle" size={18} color={colors.goldLight} />
              <T v="body15" color={colors.goldLight} style={{ fontFamily: fonts.bodyMedium }}>
                {c.coordinator}
              </T>
            </Pressable>
          ) : null}
        </Row>
        <T v="title42" size={40} style={{ marginTop: 4 }}>
          {name ? fmt(c.hello, { name: cap(name) }) : c.helloNoName}
        </T>
        {sub ? (
          <T v="body15" color={colors.ivory70} style={{ marginTop: 4 }}>
            {sub}
          </T>
        ) : null}
      </View>

      {canTasks ? <Button label={copy.planner.newRequest} icon="plus" onPress={() => router.push("/planner/requests/new")} style={{ marginTop: 20 }} testID="planner-new-request" /> : null}

      <Stack gap={14} style={{ marginTop: 20 }}>
        {/* Needs you: the count in the label is the number of rows (B3). */}
        <Card kind="solid" padding={16}>
          <SectionLabel color={colors.goldLight} style={{ marginBottom: 4 }}>
            {fmt(c.needsYou, { n: needs.length })}
          </SectionLabel>
          {home.isLoading && !data ? <Skeleton h={58} /> : null}
          {data && !needs.length ? (
            <View>
              <Row gap={12} style={{ paddingVertical: 10 }}>
                <IconDisc name="check" />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="body16">{c.nothingNeeds}</T>
                  <T v="meta13" color={colors.ivory55}>
                    {c.nothingNeedsBody}
                  </T>
                </View>
              </Row>
              {canTasks ? <Button label={c.seeTodo} kind="text" small full={false} onPress={() => router.navigate("/planner/requests")} style={{ alignSelf: "center" }} /> : null}
            </View>
          ) : null}
          {needs.map((b, i) => (
            <BriefingRow key={`n${i}`} text={b.text} tone={b.tone} onPress={() => open(b)} />
          ))}
        </Card>

        {canTasks ? (
          <Card kind="solid" padding={16}>
            <SectionLabel color={colors.goldLight} style={{ marginBottom: 4 }}>
              {fmt(c.waiting, { n: waiting.length })}
            </SectionLabel>
            {reqs.isLoading && !reqs.data ? <Skeleton h={58} /> : null}
            {reqs.data && !waiting.length ? (
              <T v="body15" color={colors.ivory55} style={{ paddingVertical: 8 }}>
                {c.waitingEmpty}
              </T>
            ) : null}
            {waiting.slice(0, 5).map((r, i, arr) => (
              <ListRow
                key={r.id}
                leading={<IconDisc name={kindIcon(r.kind)} />}
                title={requestTitle(r, copy.planner.kinds)}
                sub={[(r.guest_names ?? []).slice(0, 2).join(", "), relTime(r.created_at, lang)].filter(Boolean).join(" · ")}
                onPress={() => router.push({ pathname: "/planner/requests/[id]", params: { id: r.id } })}
                last={i === arr.length - 1}
              />
            ))}
          </Card>
        ) : null}

        {canTasks ? (
          <Card kind="solid" padding={16}>
            <SectionLabel color={colors.goldLight} style={{ marginBottom: 4 }}>
              {fmt(dated ? c.todayTasks : c.yourTasks, { n: tasks.length })}
            </SectionLabel>
            {board.isLoading && !board.data ? <Skeleton h={58} /> : null}
            {board.data && !tasks.length ? (
              <T v="body15" color={colors.ivory55} style={{ paddingVertical: 8 }}>
                {c.tasksEmpty}
              </T>
            ) : null}
            {tasks.map((t, i) => (
              <TaskCheckRow
                key={t.id}
                task={t}
                status={toggle.statusOf(t)}
                canEdit={canTasksEdit}
                onToggle={() => void toggle.toggle(t)}
                onCycle={() => void toggle.cycle(t)}
                onPress={() => router.push({ pathname: "/planner/tasks/[id]", params: { id: t.id } })}
                last={i === tasks.length - 1}
              />
            ))}
            <Button label={c.seeAllTodo} kind="text" small full={false} onPress={() => router.navigate("/planner/requests")} style={{ alignSelf: "center", marginTop: 4 }} />
          </Card>
        ) : null}

        {canCoordinator ? (
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 16 }}>
            <ListRow leading={<IconDisc name="sparkle" />} title={c.askCoordinator} sub={c.askCoordinatorSub} onPress={() => router.push("/assistant" as never)} last />
          </Card>
        ) : null}
      </Stack>
    </Screen>
  );

  // The portal's stable row kind (v1.2, N13) opens the exact screen; a row
  // without one (production portal before v1.2) or of a kind this build does
  // not know falls back to its web link.
  function open(row: { href: string; kind?: unknown; target_id?: unknown; filter?: unknown }) {
    const kind = typeof row.kind === "string" ? row.kind : null;
    const target = typeof row.target_id === "string" && row.target_id ? row.target_id : null;
    if (kind === "planner_waiting" && canTasks) {
      router.push((target ? { pathname: "/planner/requests/[id]", params: { id: target } } : "/planner/requests") as never);
      return;
    }
    if (kind === "planner_tasks" && canTasks) {
      router.push((target ? { pathname: "/planner/tasks/[id]", params: { id: target } } : "/planner/requests") as never);
      return;
    }
    if ((kind === "rsvp_pace" || kind === "new_rsvps") && can(me, "guests")) {
      const filter = typeof row.filter === "string" && row.filter === "pending" ? "pending" : undefined;
      return void router.navigate((filter ? { pathname: "/planner/guests", params: { filter } } : "/planner/guests") as never);
    }
    if ((kind === "budget_over" || kind === "vendor_unpaid") && can(me, "budget")) return void router.push("/planner/budget" as never);
    go(row.href);
  }

  function go(href: string) {
    const map: [string, string][] = [
      ["requests", "/planner/requests"],
      ["guests", "/planner/guests"],
      ["tasks", "/planner/requests"],
      ["budget", "/planner/budget"],
      ["runsheet", "/planner/runsheet"],
      // Vendors live inside the budget now (F5); the route stays for links.
      ["vendors", "/planner/budget"],
      ["broadcasts", "/planner/broadcasts"],
      ["seating", "/planner/seating"],
      ["assistant", "/assistant"],
    ];
    const hit = map.find(([web]) => href.includes(web));
    // A tool that is off for this planner opens the Wedding tab, where it
    // says "Not shared with you", instead of a refusal.
    const tool = hit ? (hit[0] === "assistant" ? "coordinator" : hit[0] === "requests" ? "tasks" : hit[0] === "vendors" ? "budget" : hit[0]) : null;
    router.push((hit && (!tool || can(me, tool)) ? hit[1] : "/planner/wedding") as never);
  }
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

const COUPLE_ONLY_KINDS = new Set(["open_gaps", "gap_repeat", "escalation_open"]);
function coupleOnlyRow(b: { kind?: unknown; href?: unknown }): boolean {
  if (typeof b.kind === "string" && COUPLE_ONLY_KINDS.has(b.kind)) return true;
  return typeof b.href === "string" && (/^\/planner\/?$/.test(b.href) || /^\/brain(\/|$|\?)/.test(b.href));
}

// Planner Pendientes / To do (build 12, plan b; prototype P.todo).
//
// One place for what is still open: my tasks (the board shared with the
// couple) and my requests to the couple, in two sections, with the same two
// filters over both: Open / Done, and Mine / All / The couple's. "Overdue" in
// red when a task has a past due date. The tab badge counts what waits on
// me: my open tasks and the requests the couple answered with a question.
//
// This screen took over the task board (build 11 had tasks in three places,
// N10): the box marks a task done or open again, the row opens it, holding a
// row moves it to the next status, "Add a task" files a new one. The old
// board route (/planner/tasks) redirects here.

import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { fmt, useCopy, useLang, relTime } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { can, useTenantKey, useUserSession } from "@/lib/session";
import { Screen, BigTitle, Card, ListRow, Skeleton, Stack, SectionLabel, T, Chip, ChipRow, Segmented, Button, IconButton, Banner, Badge } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY as TASKS_COPY } from "@/features/tasks/copy";
import { requestTitle } from "@/app/couple/requests/index";
import { PlannerTop, IconDisc, NotShared, TaskCheckRow, usePlannerBoardQ, usePlannerRequestsQ, useTaskToggle, asksPlanner, kindIcon } from "@/app/planner/_layout";
import type { RequestRow } from "@/lib/hooks";

type Who = "me" | "all" | "couple";
type Status = "open" | "done";

export default function PlannerTodo() {
  // A wedding switch remounts the body: filters start over (F1).
  return <PlannerTodoBody key={useTenantKey()} />;
}

function PlannerTodoBody() {
  const copy = useCopy();
  const c = copy.planner.b12;
  const tc = useFeatureCopy(TASKS_COPY);
  const { lang } = useLang();
  const router = useRouter();
  const me = useUserSession()?.me;
  const canTasks = can(me, "tasks");
  // "view" on tasks: the lists read, nothing writes (capabilities).
  const canEdit = can(me, "tasks", "edit");
  const reqs = usePlannerRequestsQ(canTasks);
  const board = usePlannerBoardQ(canTasks);
  const toggle = useTaskToggle();
  const [status, setStatus] = useState<Status>("open");
  const [who, setWho] = useState<Who>("me");

  const sets = useMemo(() => {
    const build = (st: Status) => {
      // Tasks keep the status they had when the list loaded: one ticked
      // here stays (struck through) until the list refreshes, for Undo.
      const tasks = (board.data?.tasks ?? []).filter((t) => (st === "open" ? t.status !== "done" : t.status === "done"));
      const requests = (reqs.data?.requests ?? []).filter((r) => (st === "open" ? r.status === "open" : r.status !== "open"));
      return {
        all: { tasks, requests },
        me: { tasks: tasks.filter((t) => t.assigned_to === "planner"), requests: requests.filter(asksPlanner) },
        couple: { tasks: tasks.filter((t) => t.assigned_to === "couple"), requests: requests.filter((r) => !asksPlanner(r)) },
      };
    };
    return { open: build("open"), done: build("done") };
  }, [board.data, reqs.data]);
  const cur = sets[status][who];
  const count = (st: Status, w: Who) => sets[st][w].tasks.length + sets[st][w].requests.length;
  const loading = (board.isLoading && !board.data) || (reqs.isLoading && !reqs.data);

  const statusLabel = (r: RequestRow) =>
    r.status === "open" ? (asksPlanner(r) ? c.asksYou : c.waitingShort) : r.status === "approved" ? copy.planner.approved : r.status === "declined" ? copy.planner.declined : copy.planner.cancelled;

  if (!canTasks) {
    return (
      <Screen header={<PlannerTop />}>
        <BigTitle title={c.todoTitle} />
        <NotShared />
      </Screen>
    );
  }

  return (
    <Screen
      // The requests decide whether the screen can show anything at all.
      query={reqs}
      refresh={() => Promise.all([reqs.refetch(), board.refetch()])}
      header={<PlannerTop right={<IconButton name="plus" label={copy.planner.newRequest} onPress={() => router.push("/planner/requests/new")} testID="planner-todo-new" />} />}
    >
      <BigTitle title={c.todoTitle} />
      <View style={{ marginTop: 18 }}>
        <Segmented<Status>
          value={status}
          options={[
            { value: "open", label: fmt(c.openN, { n: count("open", "all") }) },
            { value: "done", label: fmt(c.doneN, { n: count("done", "all") }) },
          ]}
          onChange={setStatus}
        />
      </View>
      <View style={{ marginTop: 10 }}>
        <ChipRow>
          {(["me", "all", "couple"] as const).map((w) => (
            <Chip key={w} label={`${w === "me" ? c.mine : w === "all" ? c.all : c.couples} ${count(status, w)}`} on={who === w} onPress={() => setWho(w)} testID={`planner-todo-${w}`} />
          ))}
        </ChipRow>
      </View>
      {board.data?.pending ? (
        <View style={{ marginTop: 12 }}>
          <Banner icon="info" title={tc.pending} kind="gold" />
        </View>
      ) : null}

      <Stack gap={10} style={{ marginTop: 18 }}>
        <SectionLabel color={colors.goldLight}>{fmt(c.tasksN, { n: cur.tasks.length })}</SectionLabel>
        {loading ? <Skeleton h={64} r={18} /> : null}
        {!loading && !cur.tasks.length ? (
          <T v="body15" color={colors.ivory55}>
            {c.nothingHere}
          </T>
        ) : null}
        {cur.tasks.length ? (
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 16 }}>
            {cur.tasks.map((t, i) => (
              <TaskCheckRow
                key={t.id}
                task={t}
                status={toggle.statusOf(t)}
                canEdit={canEdit}
                onToggle={() => void toggle.toggle(t)}
                onCycle={() => void toggle.cycle(t)}
                onPress={() => router.push({ pathname: "/planner/tasks/[id]", params: { id: t.id } })}
                last={i === cur.tasks.length - 1}
              />
            ))}
          </Card>
        ) : null}
        {canEdit ? <Button label={c.addTask} icon="plus" kind="glass" small full={false} onPress={() => router.push("/planner/tasks/new")} testID="planner-todo-add-task" /> : null}

        <SectionLabel color={colors.goldLight} style={{ marginTop: 16 }}>
          {fmt(c.requestsN, { n: cur.requests.length })}
        </SectionLabel>
        {loading ? <Skeleton h={64} r={18} /> : null}
        {!loading && !cur.requests.length ? (
          <T v="body15" color={colors.ivory55}>
            {c.nothingHere}
          </T>
        ) : null}
        {cur.requests.length ? (
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 16 }}>
            {cur.requests.map((r, i) => (
              <ListRow
                key={r.id}
                leading={<IconDisc name={kindIcon(r.kind)} />}
                title={requestTitle(r, copy.planner.kinds)}
                sub={[asksPlanner(r) ? null : statusLabel(r), (r.guest_names ?? []).slice(0, 2).join(", "), relTime(r.updated_at || r.created_at, lang)].filter(Boolean).join(" · ")}
                below={asksPlanner(r) ? <Badge label={c.asksYou} kind="gold" /> : undefined}
                onPress={() => router.push({ pathname: "/planner/requests/[id]", params: { id: r.id } })}
                last={i === cur.requests.length - 1}
              />
            ))}
          </Card>
        ) : null}
        <T v="meta13" color={colors.ivory40} center style={{ marginTop: 10 }}>
          {copy.planner.footer}
        </T>
      </Stack>
    </Screen>
  );
}

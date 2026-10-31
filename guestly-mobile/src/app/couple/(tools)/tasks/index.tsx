// Tasks: the couple's own list grouped by date, plus the board shared with
// the planner. Web parity for /tasks and the tasks half of /requests.

import React, { useMemo, useRef, useState } from "react";
import { View, FlatList, Alert, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post } from "@/lib/api";
import { useOnline } from "@/lib/query";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, BigTitle, Segmented, Chip, ChipRow, Card, Button, Skeleton, Stack, SectionLabel, T, Row, Icon, Banner, useTopInset, useBottomClearance, COLUMN, QueryError, OfflineState, StaleBanner, retryConnection, usePullRefresh, DockedActions, useScrimScroll } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/tasks/copy";
import { useTasksBoard, useSharedBoard, KEYS, TASK_INVALIDATE, type Board, type TaskGroup, type TaskView, type BoardTask } from "@/features/tasks/hooks";
import { TaskRowItem, SharedTaskRow, EmptyList, errorText } from "@/features/tasks/ui";
import { useSafeBack } from "@/lib/nav";

type Segment = "ours" | "board";
type Row_ = { kind: "header"; key: string; label: string; count: number } | { kind: "task"; key: string; task: TaskView; last: boolean } | { kind: "shared"; key: string; task: BoardTask; last: boolean };

export default function CoupleTasks() {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const back = useSafeBack();
  const qc = useQueryClient();
  const { clearance } = useBottomClearance();
  const [dock, setDock] = useState(0);
  const top = useTopInset();
  const scrim = useScrimScroll();
  const online = useOnline();
  const user = useUserSession();
  const canEdit = user?.me.can_edit ?? false;
  const [segment, setSegment] = useState<Segment>("ours");
  const [group, setGroup] = useState<TaskGroup | "all">("all");
  const [boardFilter, setBoardFilter] = useState<"all" | "open" | "done">("open");
  const board = useTasksBoard();
  const shared = useSharedBoard("couple");
  const data = board.data;
  // The list on screen: the couple's own, or the board shared with the planner.
  const current = segment === "ours" ? board : shared;
  // Pull to refresh (S2): both lists, so switching segment shows fresh data.
  const pull = usePullRefresh(() => Promise.all([board.refetch(), shared.refetch()]));

  const rows = useMemo<Row_[]>(() => {
    if (segment === "board") {
      const tasks = (shared.data?.tasks ?? []).filter((t) => (boardFilter === "all" ? true : boardFilter === "done" ? t.status === "done" : t.status !== "done"));
      return tasks.map((t, i) => ({ kind: "shared", key: t.id, task: t, last: i === tasks.length - 1 }));
    }
    if (!data) return [];
    const out: Row_[] = [];
    const order = group === "all" ? data.group_order.filter((g) => g !== "done") : [group];
    for (const g of order) {
      const list = data.groups[g] ?? [];
      if (!list.length) continue;
      out.push({ kind: "header", key: `h-${g}`, label: copy.groups[g], count: list.length });
      list.forEach((t, i) => out.push({ kind: "task", key: t.id, task: t, last: i === list.length - 1 }));
    }
    return out;
  }, [segment, data, group, shared.data, boardFilter, copy]);

  // One status change per task at a time. A double tap sent two "done"
  // requests and the portal cloned a repeating task twice.
  const inFlight = useRef(new Set<string>());

  async function toggle(task: TaskView) {
    if (!canEdit || inFlight.current.has(task.id)) return;
    inFlight.current.add(task.id);
    const next = task.status === "done" ? "todo" : "done";
    const before = { status: task.status, completed_at: task.completed_at };
    // Tick the box at once; the refetch below regroups the list.
    await qc.cancelQueries({ queryKey: KEYS.board });
    qc.setQueryData<Board>(KEYS.board, (b) => (b ? patchTask(b, task.id, { status: next, completed_at: next === "done" ? new Date().toISOString() : null }) : b));
    try {
      const r = await post<{ task: TaskView; clone: TaskView | null }>(`/couple/tasks/${task.id}/status`, { status: next });
      for (const k of TASK_INVALIDATE) void qc.invalidateQueries({ queryKey: [k] });
      if (r.clone?.due_date) Alert.alert(fmt(copy.repeatCloned, { date: r.clone.due_date }));
    } catch (err) {
      qc.setQueryData<Board>(KEYS.board, (b) => (b ? patchTask(b, task.id, before) : b));
      Alert.alert(copy.error, errorText(err, lang, copy.error));
    } finally {
      inFlight.current.delete(task.id);
    }
  }

  const progress = data?.progress;
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const counts = (g: TaskGroup) => data?.groups[g]?.length ?? 0;
  const groupChips: (TaskGroup | "all")[] = ["all", "overdue", "today", "week", "later", "undated", "done"];

  const header = (
    <View style={{ paddingHorizontal: 24 }}>
      <TopBar onBack={back} right={canEdit ? <Pressable onPress={() => router.push(segment === "ours" ? "/couple/tasks/new" : "/couple/tasks/board/new")} accessibilityRole="button" accessibilityLabel={copy.add} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Icon name="plus" size={24} color={colors.goldLight} /></Pressable> : undefined} />
      <View style={{ marginTop: 10 }}>
        <BigTitle title={copy.title} sub={progress ? fmt(copy.progress, { done: progress.done, total: progress.total }) : copy.subtitle} />
      </View>
      {progress && progress.total ? (
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.ivory09, marginTop: 14, overflow: "hidden" }}>
          <View style={{ width: `${pct}%`, height: 6, backgroundColor: colors.gold }} />
        </View>
      ) : null}
      <View style={{ marginTop: 16 }}>
        <Segmented<Segment>
          value={segment}
          options={[
            { value: "ours", label: copy.segments.ours },
            { value: "board", label: copy.segments.board },
          ]}
          onChange={setSegment}
        />
      </View>
      {/* One connection banner, only over saved tasks (S4); with nothing
          saved the list itself says offline (S1). */}
      {current.data !== undefined && (!online || current.isError) ? (
        <View style={{ marginTop: 12 }}>
          <StaleBanner onRetry={() => retryConnection(current.refetch)} />
        </View>
      ) : null}
      {data?.pending || shared.data?.pending ? (
        <View style={{ marginTop: 12 }}>
          <Banner icon="info" title={copy.pending} kind="gold" />
        </View>
      ) : null}
      {segment === "ours" ? (
        <>
          <Row gap={8} align="stretch" style={{ marginTop: 14 }}>
            <QuickAction icon="list" label={copy.checklist} onPress={() => router.push("/couple/tasks/checklists")} />
            <QuickAction icon="contacts" label={copy.collaborators} onPress={() => router.push("/couple/tasks/collaborators")} />
            <QuickAction icon="bell" label={copy.reminders} onPress={() => router.push("/couple/tasks/reminders")} />
          </Row>
          <View style={{ marginTop: 14 }}>
            <ChipRow>
              {groupChips.map((g) => (
                <Chip key={g} label={g === "all" ? copy.filters.all : `${copy.groups[g]}${counts(g) ? ` ${counts(g)}` : ""}`} on={group === g} onPress={() => setGroup(g)} />
              ))}
            </ChipRow>
          </View>
        </>
      ) : (
        <View style={{ marginTop: 14 }}>
          <ChipRow>
            {(["open", "all", "done"] as const).map((f) => (
              <Chip key={f} label={copy.filters[f]} on={boardFilter === f} onPress={() => setBoardFilter(f)} />
            ))}
          </ChipRow>
        </View>
      )}
    </View>
  );

  const loading = segment === "ours" ? board.isLoading && !data : shared.isLoading && !shared.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <Screen scroll={false} padded={false} topInset={false} contentStyle={{ flex: 1 }} scrollY={scrim.scrollY}>
        <FlatList
          {...scrim.listProps}
          data={rows}
          keyExtractor={(r) => r.key}
          refreshControl={pull.control ?? undefined}
          ListHeaderComponent={<View style={{ paddingTop: top }}>{header}</View>}
          contentContainerStyle={[COLUMN, { paddingBottom: clearance + (canEdit && rows.length ? dock : 0) }]}
          ListEmptyComponent={
            loading ? (
              <Stack gap={10} style={{ paddingHorizontal: 24, marginTop: 16 }}>
                <Skeleton h={64} />
                <Skeleton h={64} />
                <Skeleton h={64} />
              </Stack>
            ) : current.isError && current.data === undefined ? (
              <QueryError onRetry={() => void current.refetch()} />
            ) : !online && current.data === undefined ? (
              // Offline with nothing saved: never "start your list" (S1).
              <OfflineState onRetry={() => retryConnection(current.refetch)} />
            ) : segment === "ours" ? (
              <EmptyList
                title={group === "done" ? copy.emptyDone : copy.emptyTitle}
                body={group === "all" ? copy.emptyBody : undefined}
                action={canEdit && group === "all" ? <Button label={copy.checklist} small onPress={() => router.push("/couple/tasks/checklists")} /> : undefined}
              />
            ) : (
              <EmptyList title={copy.emptyBoardTitle} body={copy.emptyBoardBody} action={canEdit ? <Button label={copy.addBoard} small onPress={() => router.push("/couple/tasks/board/new")} /> : undefined} />
            )
          }
          renderItem={({ item }) =>
            item.kind === "header" ? (
              <View style={{ paddingHorizontal: 24, marginTop: 18, marginBottom: 2 }}>
                <SectionLabel color={item.label === copy.groups.overdue ? colors.red : colors.ivory55}>
                  {item.label} · {item.count}
                </SectionLabel>
              </View>
            ) : item.kind === "task" ? (
              <View style={{ paddingHorizontal: 24 }}>
                <TaskRowItem task={item.task} last={item.last} readOnly={!canEdit} onToggle={() => void toggle(item.task)} onPress={() => router.push({ pathname: "/couple/tasks/[id]", params: { id: item.task.id } })} />
              </View>
            ) : (
              <View style={{ paddingHorizontal: 24 }}>
                <SharedTaskRow task={item.task} last={item.last} onPress={() => router.push({ pathname: "/couple/tasks/board/[id]", params: { id: item.task.id } })} />
              </View>
            )
          }
        />
      </Screen>
      {canEdit && rows.length ? (
        <DockedActions onHeight={setDock}>
          <Button label={segment === "ours" ? copy.add : copy.addBoard} icon="plus" small onPress={() => router.push(segment === "ours" ? "/couple/tasks/new" : "/couple/tasks/board/new")} />
        </DockedActions>
      ) : null}
    </View>
  );
}

/** The board with one task's status changed everywhere it is listed, and the
 *  progress count kept in step. */
function patchTask(b: Board, id: string, patch: Pick<TaskView, "status" | "completed_at">): Board {
  const was = b.tasks.find((t) => t.id === id);
  if (!was) return b;
  const map = (t: TaskView) => (t.id === id ? { ...t, ...patch } : t);
  const delta = (patch.status === "done" ? 1 : 0) - (was.status === "done" ? 1 : 0);
  const groups = Object.fromEntries(Object.entries(b.groups).map(([g, list]) => [g, list.map(map)])) as Board["groups"];
  return { ...b, tasks: b.tasks.map(map), groups, progress: { ...b.progress, done: Math.max(0, b.progress.done + delta) } };
}

function QuickAction({ icon, label, onPress }: { icon: "list" | "contacts" | "bell"; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ flex: 1, minWidth: 0 }}>
      <Card kind="solid" padding={10} style={{ flex: 1, minHeight: 72, justifyContent: "center", alignItems: "center", gap: 6 }}>
        <Icon name={icon} size={20} color={colors.goldLight} />
        <T v="meta13" center numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
          {label}
        </T>
      </Card>
    </Pressable>
  );
}

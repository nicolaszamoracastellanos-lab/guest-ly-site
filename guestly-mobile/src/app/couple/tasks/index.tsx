// Tasks: the couple's own list grouped by date, plus the board shared with
// the planner. Web parity for /tasks and the tasks half of /requests.

import React, { useMemo, useState } from "react";
import { View, FlatList, Alert, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post } from "@/lib/api";
import { useOnline } from "@/lib/query";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, BigTitle, Segmented, Chip, ChipRow, Card, Button, Skeleton, Stack, SectionLabel, T, Row, Icon, Banner, useTopInset } from "@/ui";
import { colors, TAB_BAR_HEIGHT, TAB_BAR_BOTTOM } from "@/ui/tokens";
import { COPY } from "@/features/tasks/copy";
import { useTasksBoard, useSharedBoard, TASK_INVALIDATE, type TaskGroup, type TaskView, type BoardTask } from "@/features/tasks/hooks";
import { TaskRowItem, SharedTaskRow, EmptyList, errorText } from "@/features/tasks/ui";

type Segment = "ours" | "board";
type Row_ = { kind: "header"; key: string; label: string; count: number } | { kind: "task"; key: string; task: TaskView; last: boolean } | { kind: "shared"; key: string; task: BoardTask; last: boolean };

export default function CoupleTasks() {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const online = useOnline();
  const user = useUserSession();
  const canEdit = user?.me.can_edit ?? false;
  const [segment, setSegment] = useState<Segment>("ours");
  const [group, setGroup] = useState<TaskGroup | "all">("all");
  const [boardFilter, setBoardFilter] = useState<"all" | "open" | "done">("open");
  const board = useTasksBoard();
  const shared = useSharedBoard("couple");
  const data = board.data;

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

  async function toggle(task: TaskView) {
    if (!canEdit) return;
    try {
      const r = await post<{ task: TaskView; clone: TaskView | null }>(`/couple/tasks/${task.id}/status`, { status: task.status === "done" ? "todo" : "done" });
      for (const k of TASK_INVALIDATE) void qc.invalidateQueries({ queryKey: [k] });
      if (r.clone?.due_date) Alert.alert(fmt(copy.repeatCloned, { date: r.clone.due_date }));
    } catch (err) {
      Alert.alert(copy.error, errorText(err, lang, ""));
    }
  }

  const progress = data?.progress;
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const counts = (g: TaskGroup) => data?.groups[g]?.length ?? 0;
  const groupChips: (TaskGroup | "all")[] = ["all", "overdue", "today", "week", "later", "undated", "done"];

  const header = (
    <View style={{ paddingHorizontal: 24 }}>
      <TopBar onBack={() => router.back()} right={canEdit ? <Pressable onPress={() => router.push(segment === "ours" ? "/couple/tasks/new" : "/couple/tasks/board/new")} accessibilityRole="button" accessibilityLabel={copy.add} hitSlop={8} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Icon name="plus" size={24} color={colors.goldLight} /></Pressable> : undefined} />
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
      {!online ? (
        <View style={{ marginTop: 12 }}>
          <Banner icon="wifi-off" title={copy.offline} />
        </View>
      ) : null}
      {data?.pending || shared.data?.pending ? (
        <View style={{ marginTop: 12 }}>
          <Banner icon="info" title={copy.pending} kind="gold" />
        </View>
      ) : null}
      {segment === "ours" ? (
        <>
          <Row gap={8} style={{ marginTop: 14 }}>
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
      <Screen scroll={false} padded={false} bottomInset={0} contentStyle={{ flex: 1 }}>
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          ListHeaderComponent={<View style={{ paddingTop: top - 4 }}>{header}</View>}
          contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + insets.bottom + 96 }}
          ListEmptyComponent={
            loading ? (
              <Stack gap={10} style={{ paddingHorizontal: 24, marginTop: 16 }}>
                <Skeleton h={64} />
                <Skeleton h={64} />
                <Skeleton h={64} />
              </Stack>
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
                <TaskRowItem task={item.task} last={item.last} onToggle={() => toggle(item.task)} onPress={() => router.push({ pathname: "/couple/tasks/[id]", params: { id: item.task.id } })} />
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
        <View style={{ position: "absolute", left: 24, right: 24, bottom: TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + insets.bottom + 14 }}>
          <Button label={segment === "ours" ? copy.add : copy.addBoard} icon="plus" small onPress={() => router.push(segment === "ours" ? "/couple/tasks/new" : "/couple/tasks/board/new")} />
        </View>
      ) : null}
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: "list" | "contacts" | "bell"; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ flex: 1 }}>
      <Card kind="solid" padding={12} style={{ minHeight: 64, justifyContent: "center", alignItems: "center", gap: 6 }}>
        <Icon name={icon} size={20} color={colors.goldLight} />
        <T v="meta13" center numberOfLines={1}>
          {label}
        </T>
      </Card>
    </Pressable>
  );
}

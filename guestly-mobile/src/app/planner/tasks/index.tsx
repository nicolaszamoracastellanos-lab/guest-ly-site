// Planner tasks: the board shared with the couple, filterable by who owns
// what and by status, with quick status changes and full detail.

import React, { useCallback, useMemo, useState } from "react";
import { View, FlatList, Alert, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useLang, useCopy } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post } from "@/lib/api";
import { useOnline } from "@/lib/query";
import { can, useUserSession } from "@/lib/session";
import { Screen, TopBar, BigTitle, Chip, ChipRow, Button, Skeleton, Stack, Banner, Icon, StatTile, useTopInset, useBottomClearance, COLUMN, QueryState, StaleBanner, useQueryBlocked, retryConnection, DockedActions, StatRow, ListRowLongPress, useScrimScroll } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/tasks/copy";
import { useSharedBoard, TASK_INVALIDATE, type BoardStatus, type BoardTask } from "@/features/tasks/hooks";
import { SharedTaskRow, EmptyList, errorText } from "@/features/tasks/ui";
import { useSafeBack } from "@/lib/nav";

const NEXT: Record<BoardStatus, BoardStatus> = { open: "in_progress", in_progress: "done", done: "open" };

export default function PlannerTasks() {
  const copy = useFeatureCopy(COPY);
  const app = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const back = useSafeBack();
  const qc = useQueryClient();
  const { clearance } = useBottomClearance();
  const [dock, setDock] = useState(0);
  const top = useTopInset();
  const scrim = useScrimScroll();
  const online = useOnline();
  // "view" on tasks: the board reads, nothing writes (capabilities).
  const canEdit = can(useUserSession()?.me, "tasks", "edit");
  const [who, setWho] = useState<"all" | "planner" | "couple">("all");
  const [status, setStatus] = useState<"open" | "all" | "done">("open");
  const boardQuery = useSharedBoard("planner");
  const { data, isLoading } = boardQuery;
  const blocked = useQueryBlocked(boardQuery);
  const [pulling, setPulling] = useState(false);
  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await boardQuery.refetch();
    } finally {
      setPulling(false);
    }
  }, [boardQuery]);
  const tasks = useMemo(() => (data?.tasks ?? []).filter((t) => (who === "all" ? true : t.assigned_to === who)).filter((t) => (status === "all" ? true : status === "done" ? t.status === "done" : t.status !== "done")), [data, who, status]);
  const all = data?.tasks ?? [];
  const mine = all.filter((t) => t.assigned_to === "planner" && t.status !== "done").length;
  const theirs = all.filter((t) => t.assigned_to === "couple" && t.status !== "done").length;

  async function cycle(t: BoardTask) {
    if (!online || !canEdit) return;
    try {
      await post(`/planner/tasks/${t.id}/status`, { status: NEXT[t.status] });
      for (const k of TASK_INVALIDATE) void qc.invalidateQueries({ queryKey: [k] });
    } catch (err) {
      Alert.alert(copy.error, errorText(err, lang, ""));
    }
  }

  const header = (
    <View style={{ paddingHorizontal: 24 }}>
      <TopBar onBack={back} right={canEdit ? <Pressable onPress={() => router.push("/planner/tasks/new")} accessibilityRole="button" accessibilityLabel={copy.addBoard} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Icon name="plus" size={24} color={colors.goldLight} /></Pressable> : undefined} />
      <View style={{ marginTop: 10 }}>
        <BigTitle title={copy.planner.title} sub={copy.planner.subtitle} />
      </View>
      {/* One connection banner, only over cached tasks (S4). With nothing
          cached the list itself says offline or failed (S1). */}
      {data !== undefined && (!online || boardQuery.isError) ? (
        <View style={{ marginTop: 12 }}>
          <StaleBanner onRetry={() => retryConnection(boardQuery.refetch)} />
        </View>
      ) : null}
      {data?.pending ? (
        <View style={{ marginTop: 12 }}>
          <Banner icon="info" title={copy.pending} kind="gold" />
        </View>
      ) : null}
      <StatRow style={{ marginTop: 16 }}>
        <StatTile value={String(mine)} label={copy.planner.mine} color={colors.goldLight} />
        <StatTile value={String(theirs)} label={copy.planner.theirs} />
        <StatTile value={String(all.filter((t) => t.status === "done").length)} label={copy.boardStatuses.done} />
      </StatRow>
      <View style={{ marginTop: 14 }}>
        <ChipRow>
          {(["all", "planner", "couple"] as const).map((w) => (
            <Chip key={w} label={w === "all" ? copy.filters.all : copy.assignedTo[w]} on={who === w} onPress={() => setWho(w)} />
          ))}
          {(["open", "done"] as const).map((s) => (
            <Chip key={s} label={copy.filters[s]} on={status === s} onPress={() => setStatus(status === s ? "all" : s)} />
          ))}
        </ChipRow>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <Screen scroll={false} padded={false} topInset={false} contentStyle={{ flex: 1 }} scrollY={scrim.scrollY}>
        <FlatList
          {...scrim.listProps}
          data={tasks}
          keyExtractor={(t) => t.id}
          ListHeaderComponent={<View style={{ paddingTop: top }}>{header}</View>}
          contentContainerStyle={[COLUMN, { paddingBottom: clearance + (tasks.length ? dock : 0) }]}
          refreshControl={<RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={colors.goldLight} colors={[colors.gold]} progressBackgroundColor={colors.night} />}
          ListEmptyComponent={
            isLoading && !data ? (
              <Stack gap={10} style={{ paddingHorizontal: 24, marginTop: 16 }}>
                <Skeleton h={64} />
                <Skeleton h={64} />
              </Stack>
            ) : blocked ? (
              <QueryState query={boardQuery} />
            ) : (
              <EmptyList title={copy.emptyBoardTitle} body={copy.emptyBoardBody} action={canEdit ? <Button label={copy.addBoard} small onPress={() => router.push("/planner/tasks/new")} /> : undefined} />
            )
          }
          renderItem={({ item, index }) => (
            <View style={{ paddingHorizontal: 24 }}>
              {/* Hold a row to move it to the next status. An outer Pressable never
                  got the long press (the row's own Pressable took the touch),
                  so the row reads it from context; VoiceOver gets it as a
                  named action (core review P2-23). */}
              <ListRowLongPress.Provider value={canEdit ? { onLongPress: () => void cycle(item), label: app.core.cycleStatus } : null}>
                <SharedTaskRow task={item} last={index === tasks.length - 1} onPress={() => router.push({ pathname: "/planner/tasks/[id]", params: { id: item.id } })} />
              </ListRowLongPress.Provider>
            </View>
          )}
        />
      </Screen>
      {tasks.length && canEdit ? (
        <DockedActions onHeight={setDock}>
          <Button label={copy.addBoard} icon="plus" small onPress={() => router.push("/planner/tasks/new")} />
        </DockedActions>
      ) : null}
    </View>
  );
}

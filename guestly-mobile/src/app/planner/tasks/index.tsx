// Planner tasks: the board shared with the couple, filterable by who owns
// what and by status, with quick status changes and full detail.

import React, { useMemo, useState } from "react";
import { View, FlatList, Alert, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post } from "@/lib/api";
import { useOnline } from "@/lib/query";
import { Screen, TopBar, BigTitle, Chip, ChipRow, Button, Skeleton, Stack, Banner, Icon, StatTile, Row, useTopInset } from "@/ui";
import { colors, TAB_BAR_HEIGHT, TAB_BAR_BOTTOM } from "@/ui/tokens";
import { COPY } from "@/features/tasks/copy";
import { useSharedBoard, TASK_INVALIDATE, type BoardStatus, type BoardTask } from "@/features/tasks/hooks";
import { SharedTaskRow, EmptyList, errorText } from "@/features/tasks/ui";

const NEXT: Record<BoardStatus, BoardStatus> = { open: "in_progress", in_progress: "done", done: "open" };

export default function PlannerTasks() {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const online = useOnline();
  const [who, setWho] = useState<"all" | "planner" | "couple">("all");
  const [status, setStatus] = useState<"open" | "all" | "done">("open");
  const { data, isLoading } = useSharedBoard("planner");
  const tasks = useMemo(() => (data?.tasks ?? []).filter((t) => (who === "all" ? true : t.assigned_to === who)).filter((t) => (status === "all" ? true : status === "done" ? t.status === "done" : t.status !== "done")), [data, who, status]);
  const all = data?.tasks ?? [];
  const mine = all.filter((t) => t.assigned_to === "planner" && t.status !== "done").length;
  const theirs = all.filter((t) => t.assigned_to === "couple" && t.status !== "done").length;

  async function cycle(t: BoardTask) {
    try {
      await post(`/planner/tasks/${t.id}/status`, { status: NEXT[t.status] });
      for (const k of TASK_INVALIDATE) void qc.invalidateQueries({ queryKey: [k] });
    } catch (err) {
      Alert.alert(copy.error, errorText(err, lang, ""));
    }
  }

  const header = (
    <View style={{ paddingHorizontal: 24 }}>
      <TopBar onBack={() => router.back()} right={<Pressable onPress={() => router.push("/planner/tasks/new")} accessibilityRole="button" accessibilityLabel={copy.addBoard} hitSlop={8} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Icon name="plus" size={24} color={colors.goldLight} /></Pressable>} />
      <View style={{ marginTop: 10 }}>
        <BigTitle title={copy.planner.title} sub={copy.planner.subtitle} />
      </View>
      {!online ? (
        <View style={{ marginTop: 12 }}>
          <Banner icon="wifi-off" title={copy.offline} />
        </View>
      ) : null}
      {data?.pending ? (
        <View style={{ marginTop: 12 }}>
          <Banner icon="info" title={copy.pending} kind="gold" />
        </View>
      ) : null}
      <Row gap={8} style={{ marginTop: 16 }}>
        <StatTile value={String(mine)} label={copy.planner.mine} color={colors.goldLight} />
        <StatTile value={String(theirs)} label={copy.planner.theirs} />
        <StatTile value={String(all.filter((t) => t.status === "done").length)} label={copy.boardStatuses.done} />
      </Row>
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
      <Screen scroll={false} padded={false} bottomInset={0} contentStyle={{ flex: 1 }}>
        <FlatList
          data={tasks}
          keyExtractor={(t) => t.id}
          ListHeaderComponent={<View style={{ paddingTop: top - 4 }}>{header}</View>}
          contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + insets.bottom + 96 }}
          ListEmptyComponent={
            isLoading && !data ? (
              <Stack gap={10} style={{ paddingHorizontal: 24, marginTop: 16 }}>
                <Skeleton h={64} />
                <Skeleton h={64} />
              </Stack>
            ) : (
              <EmptyList title={copy.emptyBoardTitle} body={copy.emptyBoardBody} action={<Button label={copy.addBoard} small onPress={() => router.push("/planner/tasks/new")} />} />
            )
          }
          renderItem={({ item, index }) => (
            <View style={{ paddingHorizontal: 24 }}>
              <Pressable onLongPress={() => cycle(item)} delayLongPress={350}>
                <SharedTaskRow task={item} last={index === tasks.length - 1} onPress={() => router.push({ pathname: "/planner/tasks/[id]", params: { id: item.id } })} />
              </Pressable>
            </View>
          )}
        />
      </Screen>
      {tasks.length ? (
        <View style={{ position: "absolute", left: 24, right: 24, bottom: TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + insets.bottom + 14 }}>
          <Button label={copy.addBoard} icon="plus" small onPress={() => router.push("/planner/tasks/new")} />
        </View>
      ) : null}
    </View>
  );
}

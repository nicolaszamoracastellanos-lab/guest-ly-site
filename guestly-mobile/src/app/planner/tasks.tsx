// Planner tasks with a status cycle: open, in progress, done.

import React from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCopy, useLang } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { usePlannerTasks } from "@/lib/hooks";
import { Screen, TopBar, BigTitle, Card, ListRow, Badge, EmptyState, Skeleton } from "@/ui";

const NEXT: Record<string, "open" | "in_progress" | "done"> = { open: "in_progress", in_progress: "done", done: "open" };

export default function PlannerTasks() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const { data, isLoading } = usePlannerTasks();
  const tasks = data?.tasks ?? [];

  async function cycle(id: string, status: string) {
    try {
      await post(`/planner/tasks/${id}/status`, { status: NEXT[status] ?? "open" });
      await qc.invalidateQueries({ queryKey: ["planner-tasks"] });
      await qc.invalidateQueries({ queryKey: ["planner-requests"] });
    } catch (err) {
      Alert.alert(copy.common.error, err instanceof ApiFailure ? err.messages[lang] : "");
    }
  }

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={copy.planner.requests} />}>
      <BigTitle title={copy.planner.tasks} />
      {isLoading && !data ? <Skeleton h={120} r={18} style={{ marginTop: 20 }} /> : null}
      {data && !tasks.length ? <EmptyState title={copy.coupleHome.briefingEmpty} /> : null}
      {tasks.length ? (
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18, marginTop: 20 }}>
          {tasks.map((t, i) => (
            <ListRow key={t.id} title={t.title} sub={[t.detail, t.assigned_to].filter(Boolean).join(" · ")} trailing={<Badge label={copy.planner.taskStatus[t.status]} kind={t.status === "done" ? "green" : t.status === "in_progress" ? "gold" : "mute"} />} onPress={() => cycle(t.id, t.status)} chevron={false} last={i === tasks.length - 1} />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

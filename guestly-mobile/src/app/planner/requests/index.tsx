// Planner requests and tasks.

import React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useCopy, useLang, relTime } from "@/i18n";
import { usePlannerRequests } from "@/lib/hooks";
import { Screen, TopBar, Wordmark, IconButton, BigTitle, Card, ListRow, Badge, EmptyState, Skeleton, Stack, SectionLabel, T } from "@/ui";
import { colors } from "@/ui/tokens";
import { requestTitle } from "@/app/couple/requests/index";

export default function PlannerRequests() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const { data, isLoading } = usePlannerRequests();
  const rows = data?.requests ?? [];
  const tasks = (data?.tasks ?? []).filter((t) => t.assigned_to === "planner" && t.status !== "done").slice(0, 5);
  const label = (s: string) => (s === "open" ? copy.planner.awaiting : s === "approved" ? copy.planner.approved : s === "declined" ? copy.planner.declined : copy.planner.cancelled);

  return (
    <Screen header={<TopBar left={<Wordmark height={20} />} right={<IconButton name="plus" onPress={() => router.push("/planner/requests/new")} label={copy.planner.newRequest} />} />}>
      <View style={{ marginTop: 18 }}>
        <BigTitle title={copy.planner.requests} sub={copy.planner.footer} />
      </View>
      <Stack gap={10} style={{ marginTop: 20 }}>
        {isLoading && !data ? <Skeleton h={120} r={18} /> : null}
        {data && !rows.length ? <EmptyState title={copy.requests.empty} /> : null}
        {rows.length ? (
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
            {rows.map((r, i) => (
              <ListRow
                key={r.id}
                title={requestTitle(r, copy.planner.kinds)}
                sub={`${(r.guest_names ?? []).slice(0, 2).join(", ")}${(r.guest_names?.length ?? 0) > 2 ? "…" : ""} · ${relTime(r.created_at, lang)}`}
                trailing={<Badge label={label(r.status)} kind={r.status === "open" ? "amber" : r.status === "approved" ? "green" : "mute"} />}
                onPress={() => router.push({ pathname: "/planner/requests/[id]", params: { id: r.id } })}
                last={i === rows.length - 1}
              />
            ))}
          </Card>
        ) : null}
        {tasks.length ? (
          <>
            <Pressable onPress={() => router.push("/planner/tasks")}>
              <SectionLabel style={{ marginTop: 10 }}>{copy.planner.tasks}</SectionLabel>
            </Pressable>
            <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
              {tasks.map((t, i) => (
                <ListRow key={t.id} title={t.title} sub={t.detail || null} trailing={<Badge label={copy.planner.taskStatus[t.status]} kind={t.status === "in_progress" ? "gold" : "mute"} />} onPress={() => router.push("/planner/tasks")} last={i === tasks.length - 1} />
              ))}
            </Card>
          </>
        ) : null}
        <T v="meta13" color={colors.ivory40} center style={{ marginTop: 10 }}>
          {copy.planner.footer}
        </T>
      </Stack>
    </Screen>
  );
}

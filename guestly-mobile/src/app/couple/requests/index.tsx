// Requests from the planner.

import React from "react";
import { useRouter } from "expo-router";
import { useCopy, useLang, relTime } from "@/i18n";
import { useCoupleRequests, type RequestRow } from "@/lib/hooks";
import { Screen, TopBar, BigTitle, Card, ListRow, Badge, EmptyState, Skeleton, Stack } from "@/ui";

export function requestTitle(r: RequestRow, kinds: Record<string, string>): string {
  const p = r.payload as { title?: string; add_seats?: number; seats?: unknown[] };
  if (r.kind === "custom" && typeof p.title === "string") return p.title;
  return kinds[r.kind] ?? r.kind;
}

export default function CoupleRequests() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const { data, isLoading } = useCoupleRequests();
  const rows = data?.requests ?? [];
  const kind = (s: string) => (s === "open" ? "amber" : s === "approved" ? "green" : "mute") as "amber" | "green" | "mute";
  const label = (s: string) => (s === "open" ? copy.planner.awaiting : s === "approved" ? copy.planner.approved : s === "declined" ? copy.planner.declined : copy.planner.cancelled);

  return (
    <Screen header={<TopBar onBack={() => router.back()} />}>
      <BigTitle title={copy.requests.title} sub={copy.requests.fromPlanner} />
      <Stack gap={10} style={{ marginTop: 20 }}>
        {isLoading && !data ? <Skeleton h={120} r={18} /> : null}
        {data && !rows.length ? <EmptyState title={copy.requests.empty} /> : null}
        {rows.length ? (
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
            {rows.map((r, i) => (
              <ListRow
                key={r.id}
                title={requestTitle(r, copy.planner.kinds)}
                sub={`${r.created_by_email} · ${relTime(r.created_at, lang)}`}
                trailing={<Badge label={label(r.status)} kind={kind(r.status)} />}
                onPress={() => router.push({ pathname: "/couple/requests/[id]", params: { id: r.id } })}
                last={i === rows.length - 1}
              />
            ))}
          </Card>
        ) : null}
      </Stack>
    </Screen>
  );
}

// Planner more: every planner surface, all native.

import React from "react";
import { useRouter } from "expo-router";
import { useCopy } from "@/i18n";
import { can, useUserSession } from "@/lib/session";
import { Screen, TopBar, Wordmark, BigTitle, Card, ListRow, Icon, Footer, Stack, type IconName } from "@/ui";
import { colors } from "@/ui/tokens";

export default function PlannerMore() {
  const copy = useCopy();
  const router = useRouter();
  const user = useUserSession();
  const me = user?.me;
  // Only the tools that are on for this planner on this wedding.
  const all: { key: string; icon: IconName; title: string; sub?: string; go: () => void }[] = [
    { key: "tasks", icon: "tasks", title: copy.planner.tasks, go: () => router.push("/planner/tasks") },
    { key: "runsheet", icon: "clock", title: copy.more.items.runsheet, sub: copy.more.subs.runsheet, go: () => router.push("/planner/runsheet" as never) },
    { key: "seating", icon: "grid", title: copy.more.items.seating, go: () => router.push("/planner/seating" as never) },
    { key: "vendors", icon: "store", title: copy.more.items.vendors, go: () => router.push("/planner/vendors" as never) },
    { key: "broadcasts", icon: "megaphone", title: copy.more.items.broadcasts, go: () => router.push("/planner/broadcasts" as never) },
    { key: "coordinator", icon: "chat", title: copy.more.items.coordinator, sub: copy.more.subs.coordinator, go: () => router.push("/assistant" as never) },
    { key: "guide", icon: "book", title: copy.more.items.guide, go: () => router.push({ pathname: "/web", params: { path: "/planner/guide", title: copy.more.items.guide } } as never) },
  ];
  const tools = all.filter((t) => can(me, t.key));
  return (
    <Screen header={<TopBar left={<Wordmark height={20} />} />}>
      <BigTitle title={copy.more.title} sub={user?.me.tenant.couple_names} />
      <Stack gap={12} style={{ marginTop: 22 }}>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
          {tools.map((t, i) => (
            <ListRow key={t.key} leading={<Icon name={t.icon} size={22} color={colors.goldLight} />} title={t.title} sub={t.sub} onPress={t.go} last={i === tools.length - 1} />
          ))}
        </Card>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
          <ListRow leading={<Icon name="gear" size={22} color={colors.goldLight} />} title={copy.more.items.settings} onPress={() => router.push("/settings")} last />
        </Card>
      </Stack>
      <Footer version={copy.common.footerVersion} trademark={copy.common.footerTrademark} />
    </Screen>
  );
}

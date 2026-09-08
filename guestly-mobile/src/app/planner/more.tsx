// Planner more: every planner surface, all native.

import React from "react";
import { useRouter } from "expo-router";
import { useCopy } from "@/i18n";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, Wordmark, BigTitle, Card, ListRow, Icon, Footer, Stack } from "@/ui";
import { colors } from "@/ui/tokens";

export default function PlannerMore() {
  const copy = useCopy();
  const router = useRouter();
  const user = useUserSession();
  return (
    <Screen header={<TopBar left={<Wordmark height={20} />} />}>
      <BigTitle title={copy.more.title} sub={user?.me.tenant.couple_names} />
      <Stack gap={12} style={{ marginTop: 22 }}>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
          <ListRow leading={<Icon name="tasks" size={22} color={colors.goldLight} />} title={copy.planner.tasks} onPress={() => router.push("/planner/tasks")} />
          <ListRow leading={<Icon name="clock" size={22} color={colors.goldLight} />} title={copy.more.items.runsheet} sub={copy.more.subs.runsheet} onPress={() => router.push("/planner/runsheet" as never)} />
          <ListRow leading={<Icon name="grid" size={22} color={colors.goldLight} />} title={copy.more.items.seating} onPress={() => router.push("/planner/seating" as never)} />
          <ListRow leading={<Icon name="store" size={22} color={colors.goldLight} />} title={copy.more.items.vendors} onPress={() => router.push("/planner/vendors" as never)} />
          <ListRow leading={<Icon name="megaphone" size={22} color={colors.goldLight} />} title={copy.more.items.broadcasts} onPress={() => router.push("/planner/broadcasts" as never)} />
          <ListRow leading={<Icon name="chat" size={22} color={colors.goldLight} />} title={copy.more.items.coordinator} sub={copy.more.subs.coordinator} onPress={() => router.push("/assistant" as never)} />
          <ListRow leading={<Icon name="book" size={22} color={colors.goldLight} />} title={copy.more.items.guide} onPress={() => router.push({ pathname: "/web", params: { path: "/planner/guide", title: copy.more.items.guide } } as never)} last />
        </Card>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
          <ListRow leading={<Icon name="gear" size={22} color={colors.goldLight} />} title={copy.more.items.settings} onPress={() => router.push("/settings")} last />
        </Card>
      </Stack>
      <Footer version={copy.common.footerVersion} trademark={copy.common.footerTrademark} />
    </Screen>
  );
}

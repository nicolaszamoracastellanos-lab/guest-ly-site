// Planner more: tasks, settings, the web surfaces.

import React from "react";
import { Linking } from "react-native";
import { useRouter } from "expo-router";
import { useCopy } from "@/i18n";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, Wordmark, BigTitle, Card, ListRow, Icon, Footer, Stack } from "@/ui";
import { colors } from "@/ui/tokens";

export default function PlannerMore() {
  const copy = useCopy();
  const router = useRouter();
  const user = useUserSession();
  const base = "https://app.guest-ly.com/planner";
  return (
    <Screen header={<TopBar left={<Wordmark height={20} />} />}>
      <BigTitle title={copy.more.title} sub={user?.me.tenant.couple_names} />
      <Stack gap={12} style={{ marginTop: 22 }}>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
          <ListRow leading={<Icon name="tasks" size={22} color={colors.goldLight} />} title={copy.planner.tasks} onPress={() => router.push("/planner/tasks")} />
          <ListRow leading={<Icon name="clock" size={22} color={colors.goldLight} />} title={copy.more.items.dayof} sub={copy.more.subs.openWeb} onPress={() => Linking.openURL(`${base}/runsheet`)} />
          <ListRow leading={<Icon name="store" size={22} color={colors.goldLight} />} title={copy.more.items.vendors} sub={copy.more.subs.openWeb} onPress={() => Linking.openURL(`${base}/vendors`)} />
          <ListRow leading={<Icon name="megaphone" size={22} color={colors.goldLight} />} title={copy.more.items.broadcasts} sub={copy.more.subs.openWeb} onPress={() => Linking.openURL(`${base}/broadcasts`)} last />
        </Card>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
          <ListRow leading={<Icon name="gear" size={22} color={colors.goldLight} />} title={copy.more.items.settings} onPress={() => router.push("/settings")} last />
        </Card>
      </Stack>
      <Footer version={copy.common.footerVersion} trademark={copy.common.footerTrademark} />
    </Screen>
  );
}

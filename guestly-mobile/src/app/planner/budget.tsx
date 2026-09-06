// Budget: read summary line, full editing on the web (the budget API is a
// web surface; the planner can write there, see authz.ts).

import React from "react";
import { Linking } from "react-native";
import { useCopy } from "@/i18n";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, Wordmark, BigTitle, Button, Card, T } from "@/ui";
import { colors } from "@/ui/tokens";

export default function PlannerBudget() {
  const copy = useCopy();
  const user = useUserSession();
  return (
    <Screen header={<TopBar left={<Wordmark height={20} />} />}>
      <BigTitle title={copy.planner.budgetTitle} sub={user?.me.tenant.couple_names} />
      <Card kind="solid" padding={16} style={{ marginTop: 22 }}>
        <T v="body15" color={colors.ivory70}>
          {copy.planner.budgetWeb}
        </T>
        <Button label={copy.more.subs.openWeb} icon="coins" onPress={() => Linking.openURL("https://app.guest-ly.com/planner/budget")} style={{ marginTop: 14 }} />
      </Card>
    </Screen>
  );
}

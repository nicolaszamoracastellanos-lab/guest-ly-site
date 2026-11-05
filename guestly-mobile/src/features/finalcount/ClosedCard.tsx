// #1 the guest's side of a locked final count: "Responses are closed", one
// sentence by the guest's own state, and one action, Contact the couple (the
// Ask thread, where the couple answers). Shown on Home and on the RSVP screen
// when the server says the count is locked (1.4.0), or when a send comes back
// 423 count_locked (every build gets that answer).

import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { fmt } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { Button, Card, Icon, Row, T } from "@/ui";
import { colors } from "@/ui/tokens";
import { FINAL_COUNT_COPY } from "./copy";

export function ClosedCard({ couple, answered }: { couple: string; answered: boolean }) {
  const c = useFeatureCopy(FINAL_COUNT_COPY);
  const router = useRouter();
  return (
    <View testID="rsvp-closed">
      <Card kind="glass" blur padding={20} border={colors.goldBorder}>
        <Row gap={10} align="flex-start">
          <Icon name="lock" size={22} color={colors.goldLight} />
          <T v="title26" accessibilityRole="header" style={{ flex: 1 }}>
            {c.closedTitle}
          </T>
        </Row>
        <T v="body15" color={colors.ivory70} style={{ marginTop: 8 }}>
          {fmt(answered ? c.closedAnswered : c.closedPending, { couple: couple || c.theCouple })}
        </T>
        <Button label={c.contactCouple} kind="glass" icon="chat" onPress={() => router.push("/guest/concierge")} style={{ marginTop: 16 }} testID="rsvp-closed-contact" />
      </Card>
    </View>
  );
}

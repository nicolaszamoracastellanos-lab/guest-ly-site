// The dress code in full (v1.2, N8). The Home tile used to open the More menu,
// where the dress code was a two-line sub-line that could not be tapped: a
// longer dress code was cut with no way to read the rest. The tile and the
// More row now open this sheet: the whole text, the per-event dress codes
// when they differ, and a way to ask the concierge.

import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useCopy } from "@/i18n";
import { useGuestHome, useGuestSchedule } from "@/lib/hooks";
import { Sheet, T, Card, Button, SectionLabel, Stack } from "@/ui";
import { colors } from "@/ui/tokens";

export function DressCodeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const copy = useCopy();
  const router = useRouter();
  const { data: home } = useGuestHome();
  const { data: schedule } = useGuestSchedule();
  const events = schedule?.events ?? [];
  // The wedding-wide dress code, else the first event's (the old More row did the same).
  const main = home?.dress_code?.trim() || events.find((e) => e.dress_code?.trim())?.dress_code?.trim() || null;
  // Events whose own dress code says something the main one does not.
  const perEvent = events.filter((e) => {
    const d = e.dress_code?.trim();
    return !!d && d !== main;
  });

  const ask = () => {
    onClose();
    router.push("/guest/concierge");
  };

  return (
    <Sheet visible={visible} onClose={onClose} top={260}>
      <SectionLabel color={colors.goldLight}>{copy.guestHome.dressCode}</SectionLabel>
      {main ? (
        <Card kind="paper" padding={18} style={{ marginTop: 12 }}>
          <T v="body16" color={colors.ink} selectable>
            {main}
          </T>
        </Card>
      ) : (
        <T v="body16" color={colors.ivory70} style={{ marginTop: 10 }}>
          {copy.guestHome.dressNone}
        </T>
      )}
      {perEvent.length ? (
        <Stack gap={12} style={{ marginTop: 18 }}>
          {perEvent.map((e) => (
            <View key={e.id} style={{ gap: 2 }}>
              <T v="meta13" color={colors.ivory55}>
                {e.title}
              </T>
              <T v="body15" color={colors.ivory90} selectable>
                {e.dress_code}
              </T>
            </View>
          ))}
        </Stack>
      ) : null}
      <Button label={copy.guestHome.dressAsk} kind="ghost" small icon="sparkle" style={{ marginTop: 20 }} onPress={ask} />
    </Sheet>
  );
}

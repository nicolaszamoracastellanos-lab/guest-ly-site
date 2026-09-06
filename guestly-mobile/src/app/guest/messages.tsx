// The guest's thread: their questions, concierge answers and couple replies.

import React from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useCopy, useLang, relTime } from "@/i18n";
import { useGuestMessages } from "@/lib/hooks";
import { useGuestSession } from "@/lib/session";
import { Screen, TopBar, BigTitle, T, Avatar, Row, Badge, EmptyState, Button, Skeleton, Stack } from "@/ui";
import { colors } from "@/ui/tokens";

export default function GuestMessages() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const session = useGuestSession();
  const { data, isLoading } = useGuestMessages();
  const messages = data?.messages ?? [];

  return (
    <Screen header={<TopBar onBack={() => router.back()} />} bottomInset={40}>
      <BigTitle title={copy.messages.title} sub={copy.messages.guestSubtitle} />
      <Stack gap={10} style={{ marginTop: 20 }}>
        {isLoading && !data ? (
          <>
            <Skeleton h={60} r={18} />
            <Skeleton h={60} r={18} w="80%" />
          </>
        ) : null}
        {!isLoading && !messages.length ? (
          <EmptyState title={copy.messages.empty} action={<Button label={copy.guestHome.concierge} small onPress={() => router.push("/guest/concierge")} />} />
        ) : null}
        {messages.map((m) => {
          const mine = m.role === "guest";
          return (
            <View key={m.id} style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
              {!mine ? (
                <Row gap={8} style={{ marginBottom: 4 }}>
                  <Avatar gem={m.role === "bot"} initials={m.role === "couple" ? (session?.tenant.couple_names[0] ?? "C") : undefined} size={22} />
                  <T v="meta13" color={colors.ivory55}>
                    {m.role === "couple" ? copy.messages.couple : copy.messages.conciergeName} · {relTime(m.created_at, lang)}
                  </T>
                </Row>
              ) : null}
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs, m.role === "couple" && styles.couple]}>
                <T v="body15" color={mine ? colors.night : colors.ivory90}>
                  {m.text}
                </T>
              </View>
              {m.needs_couple && !m.replied_at ? (
                <View style={{ marginTop: 6 }}>
                  <Badge label={copy.messages.waiting} kind="amber" />
                </View>
              ) : null}
            </View>
          );
        })}
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: "84%", borderRadius: 18, padding: 12, paddingHorizontal: 14 },
  mine: { backgroundColor: colors.gold, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: "rgba(247,243,236,0.12)", borderBottomLeftRadius: 4 },
  couple: { borderColor: colors.goldBorder },
});

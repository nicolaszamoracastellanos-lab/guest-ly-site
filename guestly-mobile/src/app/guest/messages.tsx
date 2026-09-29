// The guest's thread: their questions, concierge answers and couple replies.
//
// An inverted, virtualised list: it opens at the newest message (where the
// "the couple replied" push should land), and older messages render in pages
// as the guest scrolls up, fetched with ?before= once the loaded ones run out
// (the portal sends the newest 300 and has_more). Polling runs only while the
// screen is visible.

import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useIsFocused, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCopy, useLang, relTime } from "@/i18n";
import { get } from "@/lib/api";
import { useGuestMessages, type ThreadMessage } from "@/lib/hooks";
import { useGuestSession } from "@/lib/session";
import { Screen, TopBar, T, Avatar, Row, Badge, EmptyState, Button, Skeleton, Stack, useBottomClearance, renderInlineBold } from "@/ui";
import { colors } from "@/ui/tokens";
import { useSafeBack } from "@/lib/nav";
import { useRefetchOnRefocus } from "@/features/guest/focus";

const PAGE = 40;

export default function GuestMessages() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const back = useSafeBack();
  const session = useGuestSession();
  const focused = useIsFocused();
  const mainQuery = useGuestMessages({ poll: focused });
  useRefetchOnRefocus(focused, mainQuery.refetch);
  const { data, isLoading } = mainQuery;
  const insets = useSafeAreaInsets();
  const { clearance } = useBottomClearance();
  const [shown, setShown] = useState(PAGE);
  // Pages older than the polled newest page, fetched on demand.
  const [older, setOlder] = useState<ThreadMessage[]>([]);
  const [olderHasMore, setOlderHasMore] = useState<boolean | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Newest first for the inverted list. The server sends oldest first.
  const newestFirst = useMemo(() => {
    const byId = new Map<string, ThreadMessage>();
    for (const m of [...older, ...(data?.messages ?? [])]) byId.set(m.id, m);
    return [...byId.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [older, data?.messages]);
  const visible = useMemo(() => newestFirst.slice(0, shown), [newestFirst, shown]);
  const serverHasMore = olderHasMore ?? (data as { has_more?: boolean } | undefined)?.has_more ?? false;
  const more = newestFirst.length > visible.length || serverHasMore;

  const loadOlder = useCallback(async () => {
    if (newestFirst.length > visible.length) {
      setShown((n) => n + PAGE);
      return;
    }
    const oldest = newestFirst[newestFirst.length - 1];
    if (!serverHasMore || loadingOlder || !oldest) return;
    setLoadingOlder(true);
    try {
      const r = await get<{ messages: ThreadMessage[]; has_more?: boolean }>(`/guest/messages?before=${encodeURIComponent(oldest.created_at)}`);
      setOlder((prev) => [...r.messages, ...prev]);
      setOlderHasMore(!!r.has_more && r.messages.length > 0);
      setShown((n) => n + PAGE);
    } catch {
      // Scrolling up again retries.
    } finally {
      setLoadingOlder(false);
    }
  }, [newestFirst, visible.length, serverHasMore, loadingOlder]);
  const coupleInitial = session?.tenant.couple_names?.trim()[0] ?? "C";

  const renderItem = useCallback(
    ({ item: m }: { item: ThreadMessage }) => {
      const mine = m.role === "guest";
      const who = m.role === "couple" ? copy.messages.couple : mine ? copy.messages.you : copy.messages.conciergeName;
      const when = relTime(m.created_at, lang);
      return (
        <View style={{ alignItems: mine ? "flex-end" : "flex-start", paddingVertical: 5 }} accessible accessibilityLabel={`${who}, ${when}. ${m.text}`}>
          {!mine ? (
            <Row gap={8} style={{ marginBottom: 4 }}>
              <Avatar gem={m.role === "bot"} initials={m.role === "couple" ? coupleInitial : undefined} size={22} />
              <T v="meta13" color={colors.ivory55}>
                {who} · {when}
              </T>
            </Row>
          ) : null}
          <View style={[styles.bubble, mine ? styles.mine : styles.theirs, m.role === "couple" && styles.couple]}>
            <T v="body15" color={mine ? colors.night : colors.ivory90} selectable>
              {/* Concierge answers use **bold** like the chat; never show the asterisks. */}
              {mine ? m.text : renderInlineBold(m.text)}
            </T>
          </View>
          {m.needs_couple && !m.replied_at ? (
            <View style={{ marginTop: 6 }}>
              <Badge label={copy.messages.waiting} kind="amber" />
            </View>
          ) : null}
        </View>
      );
    },
    [copy, lang, coupleInitial]
  );

  const empty = !isLoading && !newestFirst.length;

  return (
    <Screen query={mainQuery} scroll={false} padded={false} bottomInset={0} header={<TopBar onBack={back} title={copy.messages.title} />}>
      {isLoading && !data ? (
        <Stack gap={10} style={styles.pad}>
          <Skeleton h={60} r={18} />
          <Skeleton h={60} r={18} w="80%" />
        </Stack>
      ) : empty ? (
        <View style={[styles.pad, { marginTop: 12 }]}>
          <T v="body15" color={colors.ivory55} style={{ marginBottom: 16 }}>
            {copy.messages.guestSubtitle}
          </T>
          <EmptyState title={copy.messages.empty} action={<Button label={copy.guestHome.concierge} small onPress={() => router.push("/guest/concierge")} />} />
        </View>
      ) : (
        <FlatList
          inverted
          data={visible}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.pad}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={16}
          maxToRenderPerBatch={16}
          windowSize={11}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (more) void loadOlder();
          }}
          // Inverted: the header sits at the bottom (clear of the tab bar and
          // the bubble), the footer at the top of the thread.
          ListHeaderComponent={<View style={{ height: Math.max(12, clearance - insets.bottom) }} />}
          ListFooterComponent={
            more ? (
              <ActivityIndicator color={colors.goldLight} style={{ paddingVertical: 16 }} />
            ) : (
              <T v="meta13" color={colors.ivory40} center style={{ paddingVertical: 16 }}>
                {copy.messages.guestSubtitle}
              </T>
            )
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 20 },
  bubble: { maxWidth: "84%", borderRadius: 18, padding: 12, paddingHorizontal: 14 },
  mine: { backgroundColor: colors.gold, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: "rgba(247,243,236,0.12)", borderBottomLeftRadius: 4 },
  couple: { borderColor: colors.goldBorder },
});

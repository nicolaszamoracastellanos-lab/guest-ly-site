// Mensajes (build 12, F4, as in the prototype): the guest conversations.
// Compose (top right) offers "Announcement to guests" (the Broadcast tab's
// composer) or "Message to one guest". A card says how many questions the
// concierge could not answer ("Teach it"), or that nothing waits for you
// (opens the concierge insights).
//
// Build 13: announcements have their own tab (Avisos / Broadcast), so the
// Announcements segment is gone; an old link with ?seg=avisos opens that tab.

import React, { useEffect, useState } from "react";
import { View, FlatList, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { relTime, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { get } from "@/lib/api";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, Wordmark, IconButton, BigTitle, Avatar, Badge, Row, T, Icon, EmptyState, Skeleton, Stack, Sheet, Input, ListRow, useTopInset, useBottomClearance, COLUMN, QueryError, useScrimScroll, usePullRefresh, OfflineState, retryConnection, StaleBanner } from "@/ui";
import { useOnline } from "@/lib/query";
import { colors, radius } from "@/ui/tokens";
import { COPY } from "@/features/inbox/copy";
import { useInboxList, type InboxItem } from "@/features/inbox/hooks";
import { useGuestPages } from "@/features/guests/hooks";
import { useCoupleCopy, MenuRow, MenuCard } from "@/features/couple/ui";

const FILTERS = ["all", "needs_you", "whatsapp", "web", "app"] as const;
type Filter = (typeof FILTERS)[number];

export default function Inbox() {
  const ic = useFeatureCopy(COPY);
  const c = useCoupleCopy();
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useUserSession();
  const { clearance } = useBottomClearance();
  const top = useTopInset();
  const scrim = useScrimScroll();
  const online = useOnline();

  // Home's reminders open this tab on a filter.
  const params = useLocalSearchParams<{ filter?: string; seg?: string }>();
  const [filter, setFilter] = useState<Filter>(FILTERS.find((f) => f === params.filter) ?? "all");
  const [seen, setSeen] = useState(params.filter);
  if (params.filter !== seen) {
    setSeen(params.filter);
    const f = FILTERS.find((x) => x === params.filter);
    if (f) setFilter(f);
  }
  // Announcements moved to their own tab (build 13).
  useEffect(() => {
    if (params.seg === "avisos") router.navigate("/couple/broadcasts");
  }, [params.seg, router]);

  const inbox = useInboxList(filter);
  const needsYou = useInboxList("needs_you");
  const { data, isLoading } = inbox;
  const unanswered = needsYou.data?.needs_you ?? data?.needs_you ?? 0;
  const firstWaiting = needsYou.data?.items.find((i) => i.needs_you) ?? null;
  // The composer explains itself when nothing can be sent yet, so an editor
  // always gets the announcement entry.
  const canSend = user?.me.can_edit ?? false;
  const pull = usePullRefresh(() => Promise.all([inbox.refetch(), needsYou.refetch()]));

  const [composeOpen, setComposeOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);

  function teach() {
    if (unanswered === 1 && firstWaiting) return router.push({ pathname: "/couple/messages/[id]", params: { id: firstWaiting.id } });
    setFilter("needs_you");
  }

  const newAnnouncement = () => router.push("/couple/broadcasts/new");

  const header = (
    <View>
      <View style={{ paddingHorizontal: 24 }}>
        <TopBar left={<Wordmark height={20} />} right={<IconButton name="edit" label={c.messages.compose} onPress={() => setComposeOpen(true)} testID="messages-compose" />} />
        <View style={{ marginTop: 10 }}>
          <BigTitle title={c.messages.title} />
        </View>
        {data && (!online || inbox.isError) ? (
          <View style={{ marginTop: 14 }}>
            <StaleBanner onRetry={() => retryConnection(inbox.refetch)} />
          </View>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
        {unanswered > 0 ? (
          <Pressable onPress={teach} accessibilityRole="button" accessibilityLabel={`${c.messages.unanswered(unanswered)}. ${c.messages.teach}`} testID="messages-teach" style={({ pressed }) => [styles.card, styles.cardGold, pressed && { opacity: 0.8 }]}>
            <Icon name="sparkle" size={22} color={colors.goldLight} />
            <View style={{ flex: 1, gap: 2 }}>
              <T v="body16">{c.messages.unanswered(unanswered)}</T>
              {firstWaiting ? (
                <T v="meta13" color={colors.ivory70} numberOfLines={1}>
                  {firstWaiting.name}
                  {firstWaiting.preview ? ` · ${firstWaiting.preview}` : ""}
                </T>
              ) : null}
            </View>
            <T v="meta13" color={colors.goldLight}>
              {c.messages.teach}
            </T>
          </Pressable>
        ) : needsYou.data || data ? (
          <Pressable onPress={() => router.push("/couple/insights")} accessibilityRole="button" accessibilityLabel={`${c.messages.answered}. ${c.messages.answeredSub}`} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
            <Icon name="sparkle" size={22} color={colors.goldLight} />
            <View style={{ flex: 1, gap: 2 }}>
              <T v="body16">{c.messages.answered}</T>
              <T v="meta13" color={colors.ivory70}>
                {c.messages.answeredSub}
              </T>
            </View>
            <Icon name="chev" size={18} color={colors.ivory40} />
          </Pressable>
        ) : null}
      </View>
      {/* No channel chips (F4: exactly the prototype). A filter set by
          "Teach it" or a reminder link says so, with the way back. */}
      {filter !== "all" ? (
        <Row gap={8} style={{ marginTop: 10, paddingHorizontal: 24 }}>
          <T v="meta13" color={colors.ivory70} style={{ flex: 1 }}>
            {c.messages.showing(c.messages.filters[filter] ?? filter)}
          </T>
          <Pressable onPress={() => setFilter("all")} accessibilityRole="button" hitSlop={8} style={({ pressed }) => [{ minHeight: 44, justifyContent: "center" }, pressed && { opacity: 0.7 }]} testID="messages-show-all">
            <T v="meta13" color={colors.goldLight}>
              {c.messages.showAll}
            </T>
          </Pressable>
        </Row>
      ) : null}
      <View style={{ height: 8 }} />
    </View>
  );

  const convEmpty =
    isLoading && !data ? (
      <Stack gap={10} style={{ paddingHorizontal: 24, marginTop: 8 }}>
        <Skeleton h={66} />
        <Skeleton h={66} />
      </Stack>
    ) : inbox.isError && !data ? (
      <QueryError onRetry={() => void inbox.refetch()} />
    ) : !online && !data ? (
      // Offline with nothing saved: "we cannot look", never "no messages" (S1).
      <OfflineState onRetry={() => retryConnection(inbox.refetch)} />
    ) : (
      <EmptyState title={filter === "needs_you" ? ic.emptyNeedsYou : ic.empty} />
    );
  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <Screen scroll={false} padded={false} topInset={false} contentStyle={{ flex: 1 }} scrollY={scrim.scrollY}>
        <FlatList<InboxItem>
          {...scrim.listProps}
          key="conv"
          refreshControl={pull.control ?? undefined}
          data={data?.items ?? []}
          keyExtractor={(i) => i.id}
          ListHeaderComponent={<View style={{ paddingTop: top }}>{header}</View>}
          contentContainerStyle={[COLUMN, { paddingBottom: clearance }]}
          ListEmptyComponent={convEmpty}
          renderItem={({ item: m }) => <ThreadRow m={m} onOpen={(id) => router.push({ pathname: "/couple/messages/[id]", params: { id } })} channelLabel={ic.channel[m.channel] ?? m.channel} lang={lang} gapLabel={ic.gap} upsetLabel={m.sentiment === "frustrated" ? ic.frustrated : m.sentiment === "negative" ? ic.upset : null} emptyPreview={ic.messages(m.message_count)} />}
        />
      </Screen>

      <Sheet visible={composeOpen} onClose={() => setComposeOpen(false)} top={380}>
        <T v="title26">{c.messages.compose}</T>
        <MenuCard style={{ marginTop: 14 }}>
          {canSend ? (
            <MenuRow
              icon="megaphone"
              title={c.messages.composeAnnouncement}
              sub={c.messages.composeAnnouncementSub}
              onPress={() => {
                setComposeOpen(false);
                setTimeout(newAnnouncement, 260);
              }}
            />
          ) : null}
          <MenuRow
            icon="chat"
            title={c.messages.composeOne}
            sub={c.messages.composeOneSub}
            onPress={() => {
              setComposeOpen(false);
              setTimeout(() => setPickOpen(true), 260);
            }}
            last
          />
        </MenuCard>
      </Sheet>

      <PickGuestSheet
        visible={pickOpen}
        onClose={() => setPickOpen(false)}
        onPick={async (guestId) => {
          // Their conversation when they have one; otherwise an announcement
          // for just them (the plan's "a notice only for them").
          let thread: InboxItem | undefined;
          try {
            const all = qc.getQueryData<{ items: InboxItem[] }>(["couple-inbox", "all"]) ?? (await qc.fetchQuery({ queryKey: ["couple-inbox", "all"], queryFn: () => get<{ items: InboxItem[]; needs_you: number }>("/couple/messages?filter=all") }));
            thread = all?.items.find((i) => i.guest_id === guestId);
          } catch {
            thread = undefined;
          }
          setPickOpen(false);
          if (thread) router.push({ pathname: "/couple/messages/[id]", params: { id: thread.id } });
          else if (canSend) router.push({ pathname: "/couple/broadcasts/new", params: { guest: guestId } } as never);
          else router.push({ pathname: "/couple/guests/[id]", params: { id: guestId } });
        }}
      />
    </View>
  );
}

function PickGuestSheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (id: string) => Promise<void> }) {
  const c = useCoupleCopy();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const guests = useGuestPages(q, "all", { enabled: visible });
  return (
    <Sheet visible={visible} onClose={onClose} top={90} scroll={false} form={false}>
      <View style={{ flex: 1, gap: 10 }}>
        <T v="title26">{c.messages.pickTitle}</T>
        <Input icon="search" value={q} onChangeText={setQ} placeholder={c.messages.pickSearch} accessibilityLabel={c.messages.pickSearch} autoCorrect={false} />
        <FlatList
          style={{ flex: 1 }}
          data={guests.items}
          keyExtractor={(g) => g.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onEndReached={guests.loadMore}
          ListEmptyComponent={guests.isLoading ? <Skeleton h={60} /> : null}
          renderItem={({ item: g, index }) => (
            <ListRow
              leading={<Avatar initials={g.initials} />}
              title={g.name}
              chevron={false}
              trailing={busy === g.id ? <Icon name="clock" size={18} color={colors.ivory55} /> : undefined}
              onPress={async () => {
                if (busy) return;
                setBusy(g.id);
                try {
                  await onPick(g.id);
                } finally {
                  setBusy(null);
                }
              }}
              last={index === guests.items.length - 1}
            />
          )}
        />
      </View>
    </Sheet>
  );
}

const ThreadRow = React.memo(function ThreadRow({ m, onOpen, channelLabel, lang, gapLabel, upsetLabel, emptyPreview }: { m: InboxItem; onOpen: (id: string) => void; channelLabel: string; lang: "en" | "es"; gapLabel: string; upsetLabel: string | null; emptyPreview: string }) {
  return (
    <View style={{ paddingHorizontal: 24 }}>
      <Pressable onPress={() => onOpen(m.id)} accessibilityRole="button" accessibilityLabel={`${m.name}, ${channelLabel}, ${m.preview || emptyPreview}`} style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}>
        <Avatar initials={m.initials} gem={m.channel === "app"} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <T v="body16" color={colors.ivory90} numberOfLines={1} style={m.needs_you ? { fontWeight: "600" } : undefined}>
            {m.name}
          </T>
          <Row gap={6}>
            <Icon name={m.channel === "whatsapp" ? "phone" : m.channel === "web" ? "globe" : "chat"} size={14} color={colors.ivory55} />
            <T v="meta13" color={colors.ivory70} numberOfLines={1} style={{ flexShrink: 1 }}>
              {m.preview || emptyPreview}
            </T>
          </Row>
          {upsetLabel || m.has_gap ? (
            <Row gap={6} style={{ marginTop: 2 }}>
              {upsetLabel ? <Badge label={upsetLabel} kind="red" /> : null}
              {m.has_gap ? <Badge label={gapLabel} kind="amber" /> : null}
            </Row>
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <T v="meta13" color={colors.ivory55}>
            {relTime(m.last_at, lang)}
          </T>
          {m.needs_you ? <View style={styles.dot} /> : <View style={{ height: 8 }} />}
        </View>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, padding: 14, borderRadius: radius.tile, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: "rgba(247,243,236,0.12)" },
  cardGold: { borderColor: colors.goldBorder, backgroundColor: colors.goldWash },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 68, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.ivory09 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber },
});

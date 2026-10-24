// Planner Messages (Duo v2, T2.4, read-only): the guest conversations of the
// wedding the planner is working on, behind the "conversations" tool. The list
// and the transcript reuse the couple's rows and bubbles. A planner never sees a
// guest's phone number or email here (the portal labels such threads
// anonymously and sends no WhatsApp link), and cannot reply, hand off or mark a
// thread handled: those stay with the couple.

import React, { useState } from "react";
import { FlatList, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { get } from "@/lib/api";
import { useSafeBack } from "@/lib/nav";
import { usePane } from "@/ui/MasterDetail";
import { Screen, TopBar, BigTitle, ChipRow, Chip, EmptyState, Skeleton, Stack, T, Card, COLUMN, QueryError, useTopInset, useBottomClearance } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/inbox/copy";
import type { ConversationDetail, InboxItem } from "@/features/inbox/hooks";
import { ThreadRow } from "@/features/inbox/Inbox";
import { Bubble } from "@/features/inbox/Conversation";

const FILTERS = ["all", "needs_you", "whatsapp", "web", "app"] as const;
type Filter = (typeof FILTERS)[number];

export const usePlannerInbox = (filter: string) =>
  useQuery({ queryKey: ["planner-inbox", filter], queryFn: () => get<{ items: InboxItem[]; needs_you: number }>(`/planner/messages?filter=${filter}`), refetchInterval: 30_000 });
export const usePlannerThread = (id: string) =>
  useQuery({ queryKey: ["planner-thread", id], queryFn: () => get<ConversationDetail>(`/planner/messages/${id}`), refetchInterval: 30_000, enabled: !!id });

export function PlannerInbox() {
  const ic = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const back = useSafeBack();
  const pane = usePane();
  const top = useTopInset();
  const { clearance } = useBottomClearance();
  const [filter, setFilter] = useState<Filter>("all");
  const inbox = usePlannerInbox(filter);
  const items = inbox.data?.items ?? [];

  const header = (
    <View style={{ paddingTop: top }}>
      <View style={{ paddingHorizontal: 24 }}>
        <TopBar onBack={back} />
        <View style={{ marginTop: 10 }}>
          <BigTitle title={ic.title} sub={ic.subtitle} />
        </View>
        <View style={{ marginTop: 14 }}>
          <ChipRow>
            {FILTERS.map((f) => (
              <Chip key={f} label={ic.filters[f] ?? f} on={filter === f} onPress={() => setFilter(f)} testID={`planner-inbox-${f}`} />
            ))}
          </ChipRow>
        </View>
        <T v="meta13" color={colors.ivory55} style={{ marginTop: 10 }}>
          {ic.readOnly}
        </T>
      </View>
    </View>
  );

  const empty = inbox.isLoading && !inbox.data ? (
    <Stack gap={10} style={{ paddingHorizontal: 24, marginTop: 12 }}>
      <Skeleton h={66} />
      <Skeleton h={66} />
    </Stack>
  ) : inbox.isError && !inbox.data ? (
    <QueryError onRetry={() => void inbox.refetch()} />
  ) : (
    <EmptyState title={filter === "needs_you" ? ic.emptyNeedsYou : ic.empty} />
  );

  return (
    <Screen scroll={false} padded={false} topInset={false} contentStyle={{ flex: 1 }}>
      <FlatList<InboxItem>
        data={items}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={[COLUMN, { paddingBottom: clearance }]}
        renderItem={({ item: m }) => (
          <ThreadRow
            m={m}
            selected={m.id === pane.selected}
            onOpen={(id) => pane.open(id, () => router.push({ pathname: "/planner/messages/[id]", params: { id } } as never))}
            channelLabel={ic.channel[m.channel] ?? m.channel}
            lang={lang}
            gapLabel={ic.gap}
            forYouLabel={ic.forYou}
            upsetLabel={null}
            emptyPreview={ic.messages(m.message_count)}
          />
        )}
      />
    </Screen>
  );
}

export function PlannerThread({ id }: { id: string }) {
  const ic = useFeatureCopy(COPY);
  const back = useSafeBack();
  const pane = usePane();
  const q = usePlannerThread(id);
  const data = q.data;
  return (
    <Screen query={q} refresh header={pane.embedded ? undefined : <TopBar onBack={back} title={data?.name} />}>
      {pane.embedded && data ? <BigTitle title={data.name} sub={ic.channel[data.channel] ?? data.channel} /> : null}
      <Card kind="glass" padding={12} style={{ marginBottom: 14 }}>
        <T v="meta13" color={colors.ivory70}>
          {ic.readOnly}
        </T>
      </Card>
      <Stack gap={14}>
        {(data?.messages ?? []).map((m) => (
          <Bubble key={m.id} m={m} name={data?.name ?? ""} />
        ))}
      </Stack>
    </Screen>
  );
}

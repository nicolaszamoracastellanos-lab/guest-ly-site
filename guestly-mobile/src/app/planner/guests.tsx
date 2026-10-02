// Planner Invitados / Guests (build 12, prototype P.guests; N11).
//
// Names, parties and answers, with status filters and search. Contact details
// never arrive: the portal scrubs the planner payload, and this screen shows
// nothing beyond what it sends. Tapping a party offers the three requests a
// planner can file about it (Add seats, Edit guest, Help with this guest);
// each opens the new request with that guest already picked.

import React, { useCallback, useMemo, useState } from "react";
import { View, FlatList, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fmt, useCopy } from "@/i18n";
import { usePlannerGuests, type PlannerGuest } from "@/lib/hooks";
import { can, useTenantKey, useUserSession } from "@/lib/session";
import { useOnline } from "@/lib/query";
import { Screen, BigTitle, Input, ListRow, Avatar, T, Skeleton, Stack, Icon, Row, Chip, ChipRow, Card, Sheet, SectionLabel, useBottomClearance, COLUMN, QueryState, StaleBanner, useQueryBlocked, retryConnection, EmptyState } from "@/ui";
import { colors } from "@/ui/tokens";
import { PlannerTop, IconDisc, NotShared } from "@/app/planner/_layout";

type Filter = "all" | "pending" | "attending" | "declined";
const FILTERS: Filter[] = ["all", "pending", "attending", "declined"];

export default function PlannerGuests() {
  // A wedding switch remounts the body: search, filter and an open sheet
  // never carry over to the next wedding (F1).
  return <PlannerGuestsBody key={useTenantKey()} />;
}

function PlannerGuestsBody() {
  const copy = useCopy();
  const c = copy.planner.b12;
  const router = useRouter();
  const me = useUserSession()?.me;
  const canGuests = can(me, "guests");
  const canRequest = can(me, "tasks");
  const params = useLocalSearchParams<{ filter?: string }>();
  const { clearance } = useBottomClearance();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>(FILTERS.includes(params.filter as Filter) ? (params.filter as Filter) : "all");
  // Hoy's briefing rows open this tab on a filter after it has mounted: a new
  // param moves the chip (the couple Invitados does the same).
  const [seenParam, setSeenParam] = useState(params.filter);
  if (params.filter !== seenParam) {
    setSeenParam(params.filter);
    if (FILTERS.includes(params.filter as Filter)) setFilter(params.filter as Filter);
  }
  const [picked, setPicked] = useState<PlannerGuest | null>(null);
  const online = useOnline();

  if (!canGuests) {
    return (
      <Screen header={<PlannerTop />}>
        <BigTitle title={c.tabs.guests} />
        <NotShared />
      </Screen>
    );
  }
  return <GuestList q={q} setQ={setQ} filter={filter} setFilter={setFilter} picked={picked} setPicked={setPicked} canRequest={canRequest} clearance={clearance} online={online} slug={me?.tenant.slug ?? ""} onAsk={(kind, g) => {
    setPicked(null);
    router.push({ pathname: "/planner/requests/new", params: { kind, guest: g.id } });
  }} />;
}

function GuestList({ q, setQ, filter, setFilter, picked, setPicked, canRequest, clearance, online, slug, onAsk }: {
  q: string;
  setQ: (v: string) => void;
  filter: Filter;
  setFilter: (f: Filter) => void;
  picked: PlannerGuest | null;
  setPicked: (g: PlannerGuest | null) => void;
  canRequest: boolean;
  clearance: number;
  online: boolean;
  slug: string;
  onAsk: (kind: "plus_one" | "edit_guest" | "guest_help", g: PlannerGuest) => void;
}) {
  const copy = useCopy();
  const c = copy.planner.b12;
  const guestsQuery = usePlannerGuests(slug);
  const { data, isLoading } = guestsQuery;
  // Offline or failed with nothing cached: say so, never "no guests yet" (S1).
  const blocked = useQueryBlocked(guestsQuery);
  const [pulling, setPulling] = useState(false);
  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await guestsQuery.refetch();
    } finally {
      setPulling(false);
    }
  }, [guestsQuery]);
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const all = useMemo(() => data?.guests ?? [], [data]);
  const counts = useMemo(() => {
    const n: Record<Filter, number> = { all: all.length, pending: 0, attending: 0, declined: 0 };
    for (const g of all) n[g.status] += 1;
    return n;
  }, [all]);
  const items = all.filter((g) => (filter === "all" ? true : g.status === filter)).filter((g) => (q ? fold(g.name).includes(fold(q)) || g.members.some((m) => fold(m).includes(fold(q))) : true));
  const label = (f: Filter) => (f === "all" ? c.filterAll : f === "pending" ? c.filterPending : f === "attending" ? c.filterGoing : c.filterDeclined);
  const replied = counts.attending + counts.declined;

  return (
    <Screen scroll={false} padded={false} contentStyle={{ flex: 1 }} header={<PlannerTop />}>
      <FlatList
        // Results scroll clear of the keyboard while searching, and a drag
        // puts it away (K10).
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        data={items}
        keyExtractor={(g) => g.id}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 24 }}>
            <BigTitle title={c.tabs.guests} sub={data ? fmt(all.length === 1 ? c.guestsSubOne : c.guestsSub, { total: all.length, replied }) : undefined} />
            {data !== undefined && (!online || guestsQuery.isError) ? (
              <View style={{ marginTop: 12 }}>
                <StaleBanner onRetry={() => retryConnection(guestsQuery.refetch)} />
              </View>
            ) : null}
            <Input accessibilityLabel={c.search} icon="search" value={q} onChangeText={setQ} placeholder={c.search} autoCorrect={false} returnKeyType="search" style={{ marginTop: 16 }} />
            <View style={{ marginTop: 10 }}>
              <ChipRow>
                {FILTERS.map((f) => (
                  <Chip key={f} label={data ? `${label(f)} ${counts[f]}` : label(f)} on={filter === f} onPress={() => setFilter(f)} testID={`planner-guests-${f}`} />
                ))}
              </ChipRow>
            </View>
            <Row gap={8} style={{ marginTop: 10, marginBottom: 8 }}>
              <Icon name="lock" size={16} color={colors.ivory55} />
              <T v="meta13" color={colors.ivory55} style={{ flex: 1 }}>
                {copy.planner.guestsNote}
              </T>
            </Row>
            <SectionLabel color={colors.goldLight} style={{ marginTop: 6, marginBottom: 4 }}>
              {c.parties}
            </SectionLabel>
          </View>
        }
        contentContainerStyle={[COLUMN, { paddingBottom: clearance }]}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={colors.goldLight} colors={[colors.gold]} progressBackgroundColor={colors.night} />}
        ListEmptyComponent={
          isLoading && !data ? (
            <Stack gap={10} style={{ paddingHorizontal: 24 }}>
              <Skeleton h={60} />
              <Skeleton h={60} />
              <Skeleton h={60} />
            </Stack>
          ) : blocked ? (
            <QueryState query={guestsQuery} />
          ) : q ? (
            <EmptyState title={c.noMatch} body={c.noMatchBody} />
          ) : all.length ? (
            <EmptyState title={c.noneInFilter} />
          ) : (
            // A wedding with no guests yet used to render nothing (P2-32).
            <EmptyState title={copy.core.guestsEmpty} body={copy.core.guestsEmptyBody} />
          )
        }
        ListFooterComponent={
          items.length && canRequest ? (
            <T v="meta13" color={colors.ivory40} center style={{ marginTop: 14, paddingHorizontal: 24 }}>
              {c.tapHint}
            </T>
          ) : null
        }
        renderItem={({ item: g, index }) => (
          <View style={{ paddingHorizontal: 24 }}>
            <ListRow
              testID={`planner-guest-${g.id}`}
              leading={<Avatar initials={g.initials} />}
              title={g.name}
              sub={[statusLine(g, c), g.members.length > 1 ? g.members.join(", ") : null].filter(Boolean).join(" · ")}
              trailing={<Icon name="more" size={20} color={colors.ivory55} />}
              chevron={false}
              onPress={() => setPicked(g)}
              last={index === items.length - 1}
            />
          </View>
        )}
      />
      <Sheet visible={!!picked} onClose={() => setPicked(null)}>
        {picked ? (
          <>
            <T v="title26">{picked.name}</T>
            <T v="body15" color={colors.ivory55} style={{ marginTop: 4 }}>
              {[statusLine(picked, c), picked.members.join(", "), picked.notes].filter(Boolean).join(" · ")}
            </T>
            {canRequest ? (
              <>
                <T v="meta13" color={colors.ivory55} style={{ marginTop: 12 }}>
                  {fmt(c.guestActionsHint, { name: picked.name.split(/\s+/)[0] ?? picked.name })}
                </T>
                <Card kind="solid" padding={2} style={{ paddingHorizontal: 16, marginTop: 12 }}>
                  <ListRow testID="planner-guest-add-seats" leading={<IconDisc name="guests" />} title={c.addSeats} sub={c.addSeatsSub} onPress={() => onAsk("plus_one", picked)} />
                  <ListRow testID="planner-guest-edit" leading={<IconDisc name="edit" />} title={c.editGuest} sub={c.editGuestSub} onPress={() => onAsk("edit_guest", picked)} />
                  <ListRow testID="planner-guest-help" leading={<IconDisc name="contacts" />} title={c.helpGuest} sub={c.helpGuestSub} onPress={() => onAsk("guest_help", picked)} last />
                </Card>
              </>
            ) : (
              <T v="body15" color={colors.ivory70} style={{ marginTop: 14 }}>
                {c.requestsOff}
              </T>
            )}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

function statusLine(g: PlannerGuest, c: { going: string; goingN: string; declined: string; pending: string; pendingN: string }): string {
  if (g.status === "attending") return g.party_size > 1 ? fmt(c.goingN, { n: g.party_size }) : c.going;
  if (g.status === "declined") return c.declined;
  return g.party_size > 1 ? fmt(c.pendingN, { n: g.party_size }) : c.pending;
}

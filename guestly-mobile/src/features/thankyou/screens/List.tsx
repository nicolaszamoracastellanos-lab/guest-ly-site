// The thank-you list: every guest who came (door check-ins, or the confirmed
// guests when nobody was checked in), with a done mark per row and the
// progress line. A row opens the note; on the Duo inner display the note
// opens beside the list (MasterDetail).

import React, { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { fmt } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { useSafeBack } from "@/lib/nav";
import { usePane } from "@/ui/MasterDetail";
import { Screen, TopBar, BigTitle, Card, ListRow, Badge, Skeleton, Stack, T, Segmented, EmptyState, Icon } from "@/ui";
import { colors } from "@/ui/tokens";
import { THANKYOU_COPY } from "../copy";
import { useThankyou } from "../hooks";
import { progress, sortItems } from "../logic";

export function ThankyouListScreen() {
  const c = useFeatureCopy(THANKYOU_COPY);
  const back = useSafeBack();
  const router = useRouter();
  const pane = usePane();
  const query = useThankyou();
  const { data } = query;
  const [filter, setFilter] = useState<"all" | "left">("left");
  const items = data ? sortItems(data.items, filter) : [];
  const p = data ? progress(data.items) : { done: 0, total: 0 };
  const share = p.total ? p.done / p.total : 0;

  return (
    <Screen query={query} header={<TopBar onBack={back} title={c.title} />} bottomInset={40} refresh={() => query.refetch()}>
      <BigTitle title={c.title} sub={data ? (data.source === "checkin" ? c.fromCheckin : c.fromConfirmed) : c.sub} size={38} />
      {!data ? (
        <Stack gap={10} style={{ marginTop: 20 }}>
          <Skeleton h={60} />
          <Skeleton h={60} />
          <Skeleton h={60} />
        </Stack>
      ) : data.items.length === 0 ? (
        <View style={{ marginTop: 20 }}>
          <EmptyState title={c.empty} body={c.emptyBody} />
        </View>
      ) : (
        <Stack gap={12} style={{ marginTop: 18 }}>
          <View>
            <T v="body16" color={colors.ivory90} accessibilityLiveRegion="polite">
              {fmt(c.progress, { done: p.done, total: p.total })}
            </T>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.ivory09, marginTop: 8, overflow: "hidden" }}>
              <View style={{ height: 4, width: `${share * 100}%`, backgroundColor: colors.gold }} />
            </View>
          </View>
          <Segmented
            value={filter}
            options={[
              { value: "left", label: c.left },
              { value: "all", label: c.all },
            ]}
            onChange={setFilter}
          />
          <Card kind="solid" padding={0} style={{ paddingHorizontal: 16 }}>
            {items.map((i, n) => (
              <ListRow
                key={i.guest_id}
                selected={pane.selected === i.guest_id}
                leading={i.done ? <Icon name="check" size={20} color={colors.greenText} /> : <Icon name="edit" size={20} color={colors.ivory55} />}
                title={i.party_names}
                sub={[i.table ? fmt(c.table, { t: i.table }) : null, i.draft && !i.done ? i.draft.split("\n")[0] : null].filter(Boolean).join(" · ") || null}
                below={<Badge label={i.done ? c.done : c.todo} kind={i.done ? "green" : "mute"} />}
                onPress={() => pane.open(i.guest_id, () => router.push({ pathname: "/couple/thankyou/[id]", params: { id: i.guest_id } } as never))}
                last={n === items.length - 1}
                testID={`thankyou-${n}`}
              />
            ))}
          </Card>
        </Stack>
      )}
    </Screen>
  );
}

// The planner's view of the couple's seating: tables and who sits where,
// plus the parties still without a seat. Read-only.

import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure } from "@/lib/api";
import {
  Screen,
  TopBar,
  BigTitle,
  Card,
  T,
  Badge,
  Row,
  Stack,
  Skeleton,
  SectionLabel,
  StatTile,
  EmptyState,
  Avatar,
} from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/seating/copy";
import { usePlannerSeating, initialsOf } from "@/features/seating/hooks";

export default function PlannerSeating() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const { data, isLoading, error } = usePlannerSeating();
  const unseated =
    data?.parties.filter((p) => p.confirmed && p.unseated > 0) ?? [];
  const peopleLabel = (n: number) =>
    n === 1 ? c.person : fmt(c.people, { n });

  return (
    <Screen
      header={<TopBar onBack={() => router.back()} title={c.title} />}
      bottomInset={40}
    >
      <BigTitle title={c.title} sub={c.readOnly} size={38} />
      {error instanceof ApiFailure ? (
        <T v="body15" color={colors.ivory55} style={{ marginTop: 16 }}>
          {error.messages[lang]}
        </T>
      ) : null}
      {isLoading && !data ? (
        <Stack gap={10} style={{ marginTop: 20 }}>
          <Skeleton h={78} r={16} />
          <Skeleton h={120} r={18} />
        </Stack>
      ) : null}
      {data && !data.tables.length ? <EmptyState title={c.empty} /> : null}
      {data && data.tables.length ? (
        <>
          <Row gap={8} style={{ marginTop: 18 }}>
            <StatTile
              value={String(data.stats.seated)}
              label={c.stats.seated}
            />
            <StatTile
              value={String(data.stats.unseated_people)}
              label={c.stats.unseated}
              color={data.stats.unseated_people ? colors.amber : colors.ivory}
            />
            <StatTile
              value={String(data.stats.free_seats)}
              label={c.stats.free}
              color={colors.goldLight}
            />
          </Row>
          <Stack gap={12} style={{ marginTop: 24 }}>
            {data.tables.map((t) => (
              <Card key={t.id} kind="solid" padding={14}>
                <Row style={{ justifyContent: "space-between" }}>
                  <T v="name24">{t.label}</T>
                  <Row gap={8}>
                    {t.over_capacity ? (
                      <Badge label={c.overCapacity} kind="amber" />
                    ) : null}
                    <T v="meta13" color={colors.ivory55}>
                      {fmt(c.seatedOf, {
                        seated: t.seated,
                        capacity: t.capacity,
                      })}
                    </T>
                  </Row>
                </Row>
                {t.people.length ? (
                  <View style={{ marginTop: 8 }}>
                    {t.people.map((p, i) => (
                      <T
                        key={`${p.rsvp_id}-${i}`}
                        v="body15"
                        color={colors.ivory70}
                      >
                        {p.person}
                        {p.person !== p.party_name ? ` · ${p.party_name}` : ""}
                      </T>
                    ))}
                  </View>
                ) : null}
              </Card>
            ))}
          </Stack>
          {unseated.length ? (
            <>
              <SectionLabel style={{ marginTop: 26 }}>
                {c.unseated} · {unseated.length}
              </SectionLabel>
              <Card kind="solid" padding={12} style={{ marginTop: 8 }}>
                {unseated.map((p) => (
                  <Row key={p.rsvp_id} gap={10} style={{ minHeight: 44 }}>
                    <Avatar initials={initialsOf(p.name)} size={32} />
                    <T v="body15" style={{ flex: 1 }}>
                      {p.name}
                    </T>
                    <T v="meta13" color={colors.ivory55}>
                      {peopleLabel(p.unseated)}
                    </T>
                  </Row>
                ))}
              </Card>
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

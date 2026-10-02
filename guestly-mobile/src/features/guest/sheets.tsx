// The guest Home's shortcut sheets (build 12, M3): Directions, Hotels and
// Gifts open here, over the invitation, instead of jumping to another tab.
// Dress code keeps its own sheet (DressCodeSheet). Hotels and Gifts draw the
// couple's own site sections (features/site), so the sheet and the site never
// disagree.

import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useCopy } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure } from "@/lib/api";
import { useGuestHome, useGuestSchedule, type ScheduleEvent } from "@/lib/hooks";
import { Sheet, T, Card, Button, SectionLabel, Stack, Skeleton, Row, Icon, toast } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY as SITE_COPY } from "@/features/site/copy";
import { useGuestSite, sectionsOf } from "@/features/site/hooks";
import { SiteBody } from "@/features/site/sections";
import { GUEST_COPY } from "./copy";
import { openMaps } from "./links";

function SheetTitle({ label, title }: { label?: string; title: string }) {
  return (
    <View style={{ gap: 4 }}>
      {label ? <SectionLabel color={colors.goldLight}>{label}</SectionLabel> : null}
      <T v="title30" accessibilityRole="header">
        {title}
      </T>
    </View>
  );
}

/** Places the guest is invited to, one per location, in schedule order. */
function venuesOf(events: ScheduleEvent[]): ScheduleEvent[] {
  const seen = new Set<string>();
  const out: ScheduleEvent[] = [];
  for (const e of events) {
    if (e.invited === false) continue;
    const k = (e.location ?? e.maps_url ?? "").trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

export function DirectionsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const g = useFeatureCopy(GUEST_COPY);
  const copy = useCopy();
  const router = useRouter();
  const { data: home } = useGuestHome();
  const { data: schedule, isLoading } = useGuestSchedule();
  const venues = venuesOf(schedule?.events ?? []);
  const fallbackUrl = home?.quick_links.directions_url ?? null;
  const fail = copy.common.linkFailed;
  const copyAddress = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      toast(g.directions.copied);
    } catch {
      toast(copy.common.error, { icon: "warning" });
    }
  };
  const ask = () => {
    onClose();
    router.push("/guest/concierge");
  };

  return (
    <Sheet visible={visible} onClose={onClose} top={200}>
      <SheetTitle title={g.directions.title} />
      <Stack gap={12} style={{ marginTop: 16 }}>
        {isLoading && !schedule ? <Skeleton h={120} r={18} /> : null}
        {venues.map((e) => {
          const address = [e.location, e.address_note].filter(Boolean).join(", ");
          return (
            <Card key={e.id} kind="solid" padding={16}>
              <T v="label11" color={colors.goldLight}>
                {e.title}
              </T>
              <T v="name24" style={{ marginTop: 4 }} selectable>
                {e.location}
              </T>
              {e.address_note ? (
                <T v="meta13" color={colors.ivory70} style={{ marginTop: 4 }} selectable>
                  {e.address_note}
                </T>
              ) : null}
              <Stack gap={8} style={{ marginTop: 14 }}>
                {e.maps_url ? <Button label={g.directions.openMaps} icon="map" small onPress={() => openMaps(e.maps_url, fail)} /> : null}
                {address ? <Button label={g.directions.copyAddress} kind="ghost" small onPress={() => void copyAddress(address)} /> : null}
              </Stack>
            </Card>
          );
        })}
        {!venues.length && fallbackUrl ? <Button label={g.directions.openMaps} icon="map" onPress={() => openMaps(fallbackUrl, fail)} /> : null}
        {!venues.length && !fallbackUrl && !isLoading ? (
          <T v="body15" color={colors.ivory70}>
            {g.directions.none}
          </T>
        ) : null}
        {schedule?.arrival_advice ? (
          <Card kind="glass" padding={16}>
            <Row gap={10} align="flex-start">
              <Icon name="bus" size={20} color={colors.goldLight} />
              <View style={{ flex: 1, gap: 2 }}>
                <SectionLabel>{g.directions.arrival}</SectionLabel>
                <T v="body15" color={colors.ivory90}>
                  {schedule.arrival_advice}
                </T>
              </View>
            </Row>
          </Card>
        ) : null}
        {!venues.length && !fallbackUrl && !isLoading ? <Button label={g.sheet.askConcierge} kind="ghost" small icon="sparkle" onPress={ask} /> : null}
      </Stack>
    </Sheet>
  );
}

/** Hotels or Gifts: the couple's site section of that kind. */
export function SiteSectionSheet({ kind, visible, onClose }: { kind: "hotels" | "gifts"; visible: boolean; onClose: () => void }) {
  const g = useFeatureCopy(GUEST_COPY);
  const site = useFeatureCopy(SITE_COPY);
  const router = useRouter();
  const { data, isLoading, error, refetch } = useGuestSite();
  const types = kind === "hotels" ? (["travel"] as const) : (["registry"] as const);
  const has = sectionsOf(data, [...types]).length > 0;
  const notPublished = error instanceof ApiFailure && error.code === "not_found";
  const title = kind === "hotels" ? g.home.hotels : g.home.gifts;
  const ask = () => {
    onClose();
    router.push("/guest/concierge");
  };

  return (
    <Sheet visible={visible} onClose={onClose} top={120}>
      <SheetTitle label={data?.couple_names} title={title} />
      {isLoading && !data ? (
        <Stack gap={12} style={{ marginTop: 16 }}>
          <Skeleton h={120} r={18} />
          <Skeleton h={90} r={18} />
        </Stack>
      ) : data && has ? (
        <SiteBody site={data} only={[...types]} hero={false} bare />
      ) : error && !notPublished && !data ? (
        <Stack gap={12} style={{ marginTop: 16 }}>
          <T v="body15" color={colors.ivory70}>
            {site.errorTitle}
          </T>
          <Button label={site.retry} kind="ghost" small onPress={() => void refetch()} />
        </Stack>
      ) : (
        <Stack gap={14} style={{ marginTop: 16 }}>
          <T v="body15" color={colors.ivory70}>
            {notPublished ? site.notPublishedBody : site.none[kind]}
          </T>
          <Button label={g.sheet.askConcierge} kind="ghost" small icon="sparkle" onPress={ask} />
        </Stack>
      )}
    </Sheet>
  );
}

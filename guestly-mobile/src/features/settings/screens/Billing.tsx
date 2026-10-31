// Settings > Plan (read-only). Couple: the plan, guests used of the cap as a
// bar (the Home funnel bar), the AI Coordinator line, live until, and what
// happens after. Prices, "Change plan" and "Keep it live" links show ONLY on
// the United States App Store storefront (lib/storefront, owner decision of
// Sep 29 2026 under guidelines 3.1.1 and 3.1.3); they open the browser, never
// an in-app purchase. Everywhere else: no price, no purchase wording, no link.
// Planner: the agency summary for agency owners.

import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { fmt, longDate, plural, useCopy, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { useSafeBack } from "@/lib/nav";
import { getStorefront } from "@/lib/storefront";
import { Screen, TopBar, BigTitle, Stack, Card, ListRow, Skeleton, T, Row, SectionLabel, Icon } from "@/ui";
import { colors } from "@/ui/tokens";
import { HH_COPY } from "../copy";
import { useBilling, usePlannerBilling, type Billing } from "../hooks";
import { capShare } from "../logic";

function useIsUS(): boolean {
  const [us, setUs] = useState(false);
  useEffect(() => {
    let alive = true;
    getStorefront().then((s) => alive && setUs(s.isUS));
    return () => {
      alive = false;
    };
  }, []);
  return us;
}

export function BillingScreen({ surface = "couple" }: { surface?: "couple" | "planner" }) {
  return surface === "planner" ? <PlannerBilling /> : <CoupleBilling />;
}

function CoupleBilling() {
  const c = useFeatureCopy(HH_COPY);
  const b = c.billing;
  const app = useCopy();
  const { lang } = useLang();
  const back = useSafeBack();
  const query = useBilling();
  const { data } = query;
  const us = useIsUS();
  const open = (url: string) => void WebBrowser.openBrowserAsync(url).catch(() => {});

  return (
    <Screen query={query} header={<TopBar onBack={back} title={app.settings.title} />} bottomInset={40} refresh={() => query.refetch()}>
      <BigTitle title={b.title} sub={b.sub} size={38} />
      {!data ? (
        <Stack gap={12} style={{ marginTop: 20 }}>
          <Skeleton h={150} r={18} />
          <Skeleton h={100} r={18} />
        </Stack>
      ) : (
        <Stack gap={12} style={{ marginTop: 20 }}>
          <Card kind="solid" padding={16}>
            <SectionLabel>{b.plan}</SectionLabel>
            <T v="title30" style={{ marginTop: 4 }}>
              {data.tier_label ?? b.noPlan}
            </T>
            <GuestsBar data={data} />
            <Row style={styles.line}>
              <T v="body15" color={colors.ivory70} style={{ flex: 1 }}>
                {b.coordinator}
              </T>
              <T v="body15">{data.coordinator ? b.coordinatorOn : b.coordinatorOff}</T>
            </Row>
          </Card>
          <Card kind="solid" padding={16}>
            <SectionLabel>{b.liveUntil}</SectionLabel>
            <T v="name24" style={{ marginTop: 4 }}>
              {data.live_until ? longDate(data.live_until, lang) : b.liveUntilNone}
            </T>
            <SectionLabel style={{ marginTop: 14 }}>{b.maintenance}</SectionLabel>
            <T v="body15" color={colors.ivory90} style={{ marginTop: 4 }}>
              {b.maint[data.maintenance.state] ?? b.maint.included}
            </T>
            {us && data.maintenance.state !== "none" ? (
              <T v="meta13" color={colors.ivory55} style={{ marginTop: 4 }}>
                {fmt(b.monthly, { n: data.maintenance.monthly_usd })}
              </T>
            ) : null}
          </Card>
          {us && (data.maintenance.keep_live_url || data.upgrade_links.length) ? (
            <>
              <Card kind="solid" padding={0} style={{ paddingHorizontal: 16 }}>
                {data.maintenance.keep_live_url ? (
                  <ListRow leading={<Icon name="clock" size={22} color={colors.ivory70} />} title={b.keepLive} sub={b.opensWeb} onPress={() => open(data.maintenance.keep_live_url as string)} last={!data.upgrade_links.length} />
                ) : null}
                {data.upgrade_links.map((u, i) => (
                  <ListRow key={u.plan_id} leading={<Icon name="star" size={22} color={colors.ivory70} />} title={fmt(b.upgradeRow, { name: u.name, price: u.price_usd })} sub={i === 0 ? `${b.upgrade}. ${b.opensWeb}` : undefined} onPress={() => open(u.url)} last={i === data.upgrade_links.length - 1} />
                ))}
              </Card>
            </>
          ) : null}
        </Stack>
      )}
    </Screen>
  );
}

function GuestsBar({ data }: { data: Billing }) {
  const b = useFeatureCopy(HH_COPY).billing;
  const frac = capShare(data.used, data.cap);
  return (
    <View style={{ marginTop: 16 }}>
      <Row style={{ justifyContent: "space-between" }} align="baseline">
        <T v="body16" color={colors.ivory90}>
          {b.guests}
        </T>
        <T v="name24" style={{ fontVariant: ["lining-nums", "tabular-nums"] }}>
          {data.cap ? fmt(b.guestsOf, { used: data.used, cap: data.cap_label ?? data.cap }) : fmt(b.guestsUncapped, { used: data.used })}
        </T>
      </Row>
      {frac !== null ? (
        <View style={styles.track}>
          <View style={[styles.bar, { width: `${frac * 100}%`, backgroundColor: data.over > 0 ? colors.amber : colors.gold }]} />
        </View>
      ) : null}
      {data.over > 0 ? (
        <T v="caption14" color={colors.amber} style={{ marginTop: 6 }}>
          {plural(data.over, b.over)}
        </T>
      ) : null}
    </View>
  );
}

function PlannerBilling() {
  const b = useFeatureCopy(HH_COPY).billing;
  const app = useCopy();
  const back = useSafeBack();
  const query = usePlannerBilling();
  const { data } = query;
  const rows: [string, number][] = data
    ? [
        [b.seats, data.seats],
        [b.live, data.live],
        [b.building, data.building],
        [b.archived, data.archived],
      ]
    : [];
  return (
    <Screen query={query} header={<TopBar onBack={back} title={app.settings.title} />} bottomInset={40}>
      <BigTitle title={b.planner} sub={data?.agency.name} size={38} />
      {!data ? (
        <Skeleton h={160} r={18} style={{ marginTop: 20 }} />
      ) : (
        <Card kind="solid" padding={0} style={{ paddingHorizontal: 16, marginTop: 20 }}>
          {rows.map(([label, n], i) => (
            <ListRow key={label} title={label} trailing={<T v="name24" style={{ fontVariant: ["lining-nums", "tabular-nums"] }}>{String(n)}</T>} chevron={false} last={i === rows.length - 1} />
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.ivory09 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.ivory09, marginTop: 8, overflow: "hidden" },
  bar: { height: 4, borderRadius: 2 },
});

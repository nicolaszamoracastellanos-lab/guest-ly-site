// Shared pieces of the planner cockpit: a wedding card (portfolio), the seats
// bar, the health dot and the hook that makes a wedding the one the other tabs
// work on. Every number can be null: a tool the couple did not share is never
// drawn as zero.

import React, { useCallback } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { fmt, plural, shortDate, useCopy, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { useSession, useUserSession } from "@/lib/session";
import type { PlannerPortfolioWedding } from "@/lib/hooks";
import { T, Row, Icon, toast } from "@/ui";
import { colors, radius } from "@/ui/tokens";
import { COPY } from "./copy";

const HEALTH_COLOR = { ok: colors.green, watch: colors.amber, urgent: colors.red } as const;

export function HealthDot({ health, size = 10 }: { health: PlannerPortfolioWedding["health"]; size?: number }) {
  return <View accessible={false} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: HEALTH_COLOR[health] }} />;
}

/** Going / not going / no reply as one bar. */
export function SeatsBar({ attending, declined, invited }: { attending: number; declined: number; invited: number }) {
  const total = Math.max(1, invited);
  return (
    <View accessible={false} style={styles.bar}>
      <View style={{ width: `${(attending / total) * 100}%`, backgroundColor: colors.green }} />
      <View style={{ width: `${(declined / total) * 100}%`, backgroundColor: colors.red }} />
    </View>
  );
}

export function daysLabel(w: Pick<PlannerPortfolioWedding, "days_to_go" | "wedding_date">, l: ReturnType<typeof useFeatureCopy<typeof COPY.en>>): string {
  if (w.days_to_go === null) return l.noDate;
  if (w.days_to_go === 0) return l.weddingToday;
  return plural(w.days_to_go, l.days);
}

/** One wedding of the portfolio. `selected` highlights the one open beside the list. */
export function WeddingCard({ w, onPress, selected }: { w: PlannerPortfolioWedding; onPress: () => void; selected?: boolean }) {
  const l = useFeatureCopy(COPY);
  const { lang } = useLang();
  const answered = w.seats ? w.seats.attending + w.seats.declined : 0;
  const facts: string[] = [];
  if (w.open_requests) facts.push(plural(w.open_requests, l.openRequests));
  if (w.asks_planner) facts.push(plural(w.asks_planner, l.asksYou));
  if (w.tasks?.overdue) facts.push(plural(w.tasks.overdue, l.tasksOverdue));
  const date = w.wedding_date ? shortDate(w.wedding_date, lang) : "";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={`${w.couple_names}, ${daysLabel(w, l)}, ${l.health[w.health]}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && { opacity: 0.85 }]}
      testID={`planner-wedding-card-${w.slug}`}
    >
      <Row gap={10} style={{ justifyContent: "space-between" }}>
        <Row gap={8} style={{ flex: 1, minWidth: 0 }}>
          <HealthDot health={w.health} />
          <T v="name24" numberOfLines={1} style={{ flexShrink: 1 }}>
            {w.couple_names}
          </T>
        </Row>
        <T v="body15" color={colors.goldLight}>
          {daysLabel(w, l)}
        </T>
      </Row>
      {date ? (
        <T v="meta13" color={colors.ivory55}>
          {date}
        </T>
      ) : null}
      {w.seats ? (
        <View style={{ gap: 6 }}>
          <SeatsBar attending={w.seats.attending} declined={w.seats.declined} invited={w.seats.invited} />
          <T v="meta13" color={colors.ivory70}>
            {fmt(l.seatsAnswered, { done: answered, total: w.seats.invited })}
          </T>
        </View>
      ) : (
        <Row gap={6}>
          <Icon name="lock" size={14} color={colors.ivory40} />
          <T v="meta13" color={colors.ivory40}>
            {l.notShared}
          </T>
        </Row>
      )}
      {facts.length ? (
        <T v="meta13" color={w.health === "urgent" ? colors.red : colors.amber}>
          {facts.join(" · ")}
        </T>
      ) : null}
    </Pressable>
  );
}

/** Make a wedding the one the other tabs work on (the pill's switch), with a
 *  tick and a toast. Resolves true when that wedding is now the current one. */
export function useWorkOnWedding() {
  const { switchTenant } = useSession();
  const me = useUserSession()?.me;
  const copy = useCopy();
  const l = useFeatureCopy(COPY);
  return useCallback(
    async (slug: string, names: string): Promise<boolean> => {
      if (slug === me?.tenant.slug) return true;
      void Haptics.selectionAsync();
      const ok = await switchTenant(slug);
      if (!ok) {
        toast(copy.core.switchFailed, { icon: "warning" });
        return false;
      }
      toast(fmt(l.working, { names }), { icon: "rings" });
      return true;
    },
    [me?.tenant.slug, switchTenant, copy.core.switchFailed, l.working]
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, borderColor: colors.ivory14, backgroundColor: colors.navy, padding: 16, gap: 8 },
  cardSelected: { borderColor: colors.goldBorder, backgroundColor: colors.goldWash },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.ivory09, overflow: "hidden", flexDirection: "row" },
});

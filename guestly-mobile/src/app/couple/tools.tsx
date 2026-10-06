// Herramientas / Tools (build 13): the old Plan and More tabs in one.
//   1. Five large tiles, each with one live number: Wedding site (wide, on
//      top), then Coordinator, Budget, Tasks and Seating in a 2 x 2 grid.
//   2. "More": the invitation code with Share, then every other section as
//      one list, Settings last (Settings is also the gear on Home).
// /couple/plan and /couple/more redirect here (old pushes and links).

import React, { useCallback, useState } from "react";
import { View, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { plural, useCopy } from "@/i18n";
import { useCoupleHome, useMore } from "@/lib/hooks";
import { useUserSession } from "@/lib/session";
import { useTasksBoard } from "@/features/tasks/hooks";
import { useCoupleSeating } from "@/features/seating/hooks";
import { useCoupleRunsheet } from "@/features/runsheet/hooks";
import { useBudgetSurface } from "@/features/budget/hooks";
import { useCoupleSettings } from "@/features/settings/hooks";
import { useWebsite } from "@/features/website/hooks";
import { useCoupleCopy, useShareInvite, MenuRow, MenuCard } from "@/features/couple/ui";
import { Screen, TopBar, Wordmark, BigTitle, T, Icon, Footer, Skeleton, SectionLabel, type IconName } from "@/ui";
import { colors, radius } from "@/ui/tokens";

type Tool = { key: string; icon: IconName; name: string; num: string | null; route: string };

export default function CoupleTools() {
  const copy = useCopy();
  const c = useCoupleCopy();
  const router = useRouter();
  const user = useUserSession();
  const home = useCoupleHome();
  const tasks = useTasksBoard();
  const seating = useCoupleSeating();
  const runsheet = useCoupleRunsheet();
  const website = useWebsite();
  const more = useMore();
  const settings = useCoupleSettings();
  const shareInvite = useShareInvite();
  const { width, fontScale } = useWindowDimensions();
  const oneColumn = width < 340 || (width < 380 && fontScale > 1.3);

  // "% paid" of the budget the Budget screen has open, as on Home (B3).
  const [budgetId, setBudgetId] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      AsyncStorage.getItem("budget-selected")
        .then((v) => {
          if (alive) setBudgetId(v);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );
  // The same number as the Budget screen (M11, B3): its own surface for the
  // open budget, computed the same way as there and on the planner's Tools.
  const budget = useBudgetSurface(budgetId ?? undefined);
  const byId = home.data?.budget_percent_paid_by_id;
  const homeById = budgetId && byId && Object.prototype.hasOwnProperty.call(byId, budgetId) ? byId[budgetId] : undefined;
  const activeBudget = budget.data?.active;
  // Home's per-budget figure is exact; its overall figure can differ from the
  // Budget screen (seen: 26% vs 17%), so it only stands in if the budget fails.
  const paid = activeBudget ? Math.round((activeBudget.computed.totals.paidFraction || 0) * 100) : homeById ?? (budget.isError ? home.data?.budget_percent_paid : undefined);
  const budgetNum = typeof paid === "number" ? c.plan.budgetNum(paid) : budget.data && !activeBudget ? c.plan.budgetNone : null;

  const groups = tasks.data?.groups;
  const dueSoon = groups ? (groups.overdue?.length ?? 0) + (groups.today?.length ?? 0) + (groups.week?.length ?? 0) : null;
  const open = tasks.data ? tasks.data.progress.total - tasks.data.progress.done : null;
  // Every tile carries a word (F5): a board that failed to load still says
  // where the tasks are, never a blank tile.
  const tasksNum = dueSoon === null ? (tasks.isError ? c.plan.tasksSee : null) : dueSoon > 0 ? c.plan.tasksWeek(dueSoon) : open && open > 0 ? c.plan.tasksOpen(open) : c.plan.tasksDone;
  const unseated = seating.data?.stats?.unseated_people;
  const seatingNum = seating.data && !seating.data.tables?.length ? c.plan.seatingNone : typeof unseated === "number" ? (unseated > 0 ? c.plan.seatingNum(unseated) : c.plan.seatingDone) : null;
  const blocks = runsheet.data?.blocks_total;
  const runsheetNum = typeof blocks === "number" ? (blocks > 0 ? c.plan.runsheetNum(blocks) : c.plan.runsheetNone) : runsheet.data ? c.plan.runsheetNone : null;

  // The public site lives at app.guest-ly.com/{slug} (as the website builder
  // and the guest Info tab say); a public_url from the portal wins.
  const slug = website.data?.site_slug ?? more.data?.site_slug ?? user?.me.tenant.slug ?? "";
  const publicUrl = website.data?.public_url ?? (more.data as { public_url?: unknown } | undefined)?.public_url;
  const siteAddress = typeof publicUrl === "string" && publicUrl ? publicUrl.replace(/^https?:\/\//, "") : slug ? `app.guest-ly.com/${slug}` : null;
  const siteNum = website.data ? (website.data.published ? c.tools.sitePublished : c.tools.siteDraft) : website.isError ? c.tools.siteSee : null;

  const tiles: Tool[] = [
    { key: "coordinator", icon: "sparkle", name: c.tools.coordinator, num: c.tools.coordinatorNum, route: "/assistant" },
    { key: "budget", icon: "wallet", name: c.plan.budget, num: budgetNum, route: "/couple/budget" },
    { key: "tasks", icon: "tasks", name: c.plan.tasks, num: tasksNum, route: "/couple/tasks" },
    { key: "seating", icon: "grid", name: c.plan.seating, num: seatingNum, route: "/couple/seating" },
  ];
  const days = home.data?.countdown && !home.data.countdown.passed ? home.data.countdown.days : null;
  const requests = more.data?.entries.requests?.count;
  const code = settings.data?.invite_code ?? null;

  return (
    <Screen
      refresh={() => Promise.all([home.refetch(), tasks.refetch(), seating.refetch(), runsheet.refetch(), budget.refetch(), website.refetch(), more.refetch(), settings.refetch()])}
      header={<TopBar left={<Wordmark height={20} />} />}
    >
      <View style={{ marginTop: 10 }}>
        <BigTitle title={c.tools.title} sub={days !== null ? c.plan.daysLeft(days) : user?.me.tenant.couple_names} />
      </View>

      {/* 1. The five tools */}
      <Pressable
        testID="tools-website"
        onPress={() => router.push("/couple/website")}
        accessibilityRole="button"
        accessibilityLabel={[c.tools.site, siteNum, siteAddress].filter(Boolean).join(", ")}
        style={({ pressed }) => [styles.tile, styles.siteTile, pressed && styles.pressed]}
      >
        <View style={styles.icon}>
          <Icon name="globe" size={24} color={colors.goldLight} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <T v="body16" color={colors.ivory} numberOfLines={2} size={18}>
            {c.tools.site}
          </T>
          {siteNum || siteAddress ? (
            <T v="meta13" color={colors.ivory70} numberOfLines={2}>
              {[siteNum, siteAddress].filter(Boolean).join(" · ")}
            </T>
          ) : (
            <Skeleton h={13} w={140} />
          )}
        </View>
        <Icon name="chev" size={18} color={colors.ivory40} />
      </Pressable>
      <View style={styles.grid}>
        {tiles.map((t) => (
          <Pressable
            key={t.key}
            testID={`tools-${t.key}`}
            onPress={() => router.push(t.route as never)}
            accessibilityRole="button"
            accessibilityLabel={t.num ? `${t.name}, ${t.num}` : t.name}
            style={({ pressed }) => [styles.tile, oneColumn ? styles.tileWide : styles.tileSquare, t.key === "coordinator" && styles.coordTile, pressed && styles.pressed]}
          >
            <View style={styles.icon}>
              <Icon name={t.icon} size={24} color={colors.goldLight} />
            </View>
            <View style={{ gap: 4 }}>
              <T v="body16" color={colors.ivory} numberOfLines={2} size={18}>
                {t.name}
              </T>
              {t.num ? (
                <T v="meta13" color={colors.ivory70} numberOfLines={2}>
                  {t.num}
                </T>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>

      {/* 2. More */}
      <SectionLabel style={{ marginTop: 28, marginBottom: 10 }}>{c.tools.more}</SectionLabel>
      {/* The invitation code, one tap from sharing. Two sibling buttons, so
          VoiceOver reaches Share as well (a button inside a button is hidden
          from it). */}
      <View style={styles.code}>
        <Pressable onPress={() => router.push("/couple/settings/invite")} accessibilityRole="button" accessibilityLabel={code ? `${c.more.code}, ${code.split("").join(" ")}` : c.more.code} style={({ pressed }) => [{ flex: 1, gap: 4, minHeight: 44, justifyContent: "center" }, pressed && { opacity: 0.85 }]} testID="tools-code">
          <T v="meta13" color={colors.ivory70}>
            {c.more.code}
          </T>
          {code ? (
            <T v="title30" color={colors.ivory} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ letterSpacing: 4 }}>
              {code}
            </T>
          ) : settings.isLoading ? (
            <Skeleton h={30} w={140} />
          ) : (
            <Icon name="chev" size={18} color={colors.ivory40} />
          )}
        </Pressable>
        <Pressable onPress={() => void shareInvite()} accessibilityRole="button" accessibilityLabel={c.more.share} style={({ pressed }) => [styles.share, pressed && { opacity: 0.8 }]} testID="tools-share">
          <Icon name="share" size={18} color={colors.goldLight} />
          <T v="meta13" color={colors.goldLight}>
            {c.more.share}
          </T>
        </Pressable>
      </View>

      <MenuCard style={{ marginTop: 12 }}>
        <MenuRow icon="clock" title={c.plan.runsheet} sub={runsheetNum} onPress={() => router.push("/couple/runsheet")} testID="tools-runsheet" />
        <MenuRow icon="store" title={c.tools.vendors} sub={c.tools.vendorsSub} onPress={() => router.push("/couple/vendors")} testID="tools-vendors" />
        <MenuRow icon="qr" title={c.more.checkin} sub={c.more.checkinSub} onPress={() => router.push("/couple/checkin")} testID="tools-checkin" />
        <MenuRow icon="calendar" title={c.more.dayof} sub={c.more.dayofSub} onPress={() => router.push("/couple/dayof")} testID="tools-dayof" />
        <MenuRow icon="book" title={c.more.brain} sub={c.more.brainSub} onPress={() => router.push("/couple/brain")} testID="tools-brain" />
        <MenuRow icon="tasks" title={c.more.requests} sub={typeof requests === "number" && requests > 0 ? plural(requests, copy.more.subs.requests) : c.more.requestsSub} onPress={() => router.push("/couple/requests")} testID="tools-requests" />
        <MenuRow icon="star" title={c.more.insights} sub={c.more.insightsSub} onPress={() => router.push("/couple/insights")} testID="tools-insights" />
        <MenuRow icon="info" title={c.more.guide} sub={c.more.guideSub} onPress={() => router.push({ pathname: "/web", params: { path: "/guide", title: c.more.guide } } as never)} testID="tools-guide" />
        <MenuRow icon="gear" title={c.tools.settings} sub={c.more.settingsSub} onPress={() => router.push("/settings")} testID="tools-settings" last />
      </MenuCard>
      <Footer version={copy.common.footerVersion} trademark={copy.common.footerTrademark} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12, marginTop: 12 },
  tile: { borderRadius: radius.tile, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: "rgba(247,243,236,0.12)", padding: 16, justifyContent: "space-between" },
  siteTile: { marginTop: 24, flexDirection: "row", alignItems: "center", gap: 14, minHeight: 92 },
  coordTile: { borderColor: colors.goldBorder },
  tileSquare: { width: "48.3%", aspectRatio: 1 },
  tileWide: { width: "100%", minHeight: 120, gap: 16 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.goldWash, alignItems: "center", justifyContent: "center" },
  code: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: radius.tile, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: colors.goldBorder },
  share: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.goldBorder },
});

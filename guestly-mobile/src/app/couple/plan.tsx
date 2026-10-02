// Plan (build 12, F5): exactly four square tools in a 2 x 2 grid, each with
// one live number, each opening its tool. Vendors live inside Budget now
// (budget lines show their vendor); the vendor routes stay for links.

import React, { useCallback, useState } from "react";
import { View, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCoupleHome } from "@/lib/hooks";
import { useTasksBoard } from "@/features/tasks/hooks";
import { useCoupleSeating } from "@/features/seating/hooks";
import { useCoupleRunsheet } from "@/features/runsheet/hooks";
import { useCoupleCopy } from "@/features/couple/ui";
import { Screen, TopBar, Wordmark, BigTitle, T, Icon, type IconName } from "@/ui";
import { colors, radius } from "@/ui/tokens";

type Tool = { key: string; icon: IconName; name: string; num: string | null; route: string };

export default function CouplePlan() {
  const c = useCoupleCopy();
  const router = useRouter();
  const home = useCoupleHome();
  const tasks = useTasksBoard();
  const seating = useCoupleSeating();
  const runsheet = useCoupleRunsheet();
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
  const byId = home.data?.budget_percent_paid_by_id;
  const paid = budgetId && byId && Object.prototype.hasOwnProperty.call(byId, budgetId) ? byId[budgetId] : home.data?.budget_percent_paid;

  const groups = tasks.data?.groups;
  const dueSoon = groups ? (groups.overdue?.length ?? 0) + (groups.today?.length ?? 0) + (groups.week?.length ?? 0) : null;
  const open = tasks.data ? tasks.data.progress.total - tasks.data.progress.done : null;
  const tasksNum = dueSoon === null ? null : dueSoon > 0 ? c.plan.tasksWeek(dueSoon) : open && open > 0 ? c.plan.tasksOpen(open) : c.plan.tasksDone;
  const unseated = seating.data?.stats?.unseated_people;
  const seatingNum = typeof unseated === "number" ? (unseated > 0 ? c.plan.seatingNum(unseated) : c.plan.seatingDone) : null;
  const blocks = runsheet.data?.blocks_total;

  const tools: Tool[] = [
    { key: "budget", icon: "wallet", name: c.plan.budget, num: typeof paid === "number" ? c.plan.budgetNum(paid) : null, route: "/couple/budget" },
    { key: "tasks", icon: "tasks", name: c.plan.tasks, num: tasksNum, route: "/couple/tasks" },
    { key: "seating", icon: "grid", name: c.plan.seating, num: seatingNum, route: "/couple/seating" },
    { key: "runsheet", icon: "clock", name: c.plan.runsheet, num: typeof blocks === "number" && blocks > 0 ? c.plan.runsheetNum(blocks) : null, route: "/couple/runsheet" },
  ];
  const days = home.data?.countdown && !home.data.countdown.passed ? home.data.countdown.days : null;

  return (
    <Screen
      refresh={() => Promise.all([home.refetch(), tasks.refetch(), seating.refetch(), runsheet.refetch()])}
      header={
        <TopBar
          left={<Wordmark height={20} />}
          right={
            <Pressable onPress={() => router.push("/assistant" as never)} accessibilityRole="button" accessibilityLabel={c.plan.coordinator} style={({ pressed }) => [styles.coord, pressed && { opacity: 0.8 }]}>
              <Icon name="sparkle" size={16} color={colors.goldLight} />
              <T v="meta13" color={colors.goldLight}>
                {c.plan.coordinator}
              </T>
            </Pressable>
          }
        />
      }
    >
      <View style={{ marginTop: 18 }}>
        <BigTitle title={c.plan.title} sub={days !== null ? c.plan.daysLeft(days) : undefined} />
      </View>
      <View style={styles.grid}>
        {tools.map((t) => (
          <Pressable
            key={t.key}
            testID={`plan-${t.key}`}
            onPress={() => router.push(t.route as never)}
            accessibilityRole="button"
            accessibilityLabel={t.num ? `${t.name}, ${t.num}` : t.name}
            style={({ pressed }) => [styles.tile, oneColumn ? styles.tileWide : styles.tileSquare, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12, marginTop: 24 },
  tile: { borderRadius: radius.tile, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: "rgba(247,243,236,0.12)", padding: 16, justifyContent: "space-between" },
  tileSquare: { width: "48.3%", aspectRatio: 1 },
  tileWide: { width: "100%", minHeight: 120, gap: 16 },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.goldWash, alignItems: "center", justifyContent: "center" },
  coord: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.goldBorder },
});

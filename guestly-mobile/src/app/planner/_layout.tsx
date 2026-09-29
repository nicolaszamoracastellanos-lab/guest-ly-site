import React from "react";
import { Tabs } from "expo-router";
import { useCopy } from "@/i18n";
import { usePlannerHome } from "@/lib/hooks";
import { can, useUserSession } from "@/lib/session";
import { GlassTabBar, type TabSpec } from "@/ui/TabBar";
import { colors } from "@/ui/tokens";

/** A render error in a planner screen shows the recovery screen inside the
 *  app instead of closing it, and is reported. */
export { ErrorBoundary } from "@/ui/ErrorScreen";

export default function PlannerTabs() {
  const c = useCopy().planner.tabs;
  const { data } = usePlannerHome();
  const me = useUserSession()?.me;
  // Only what waits on the planner: their own open tasks. Requests waiting
  // on the couple are shown per wedding on Home, not as a badge (P2-31).
  const badge = data?.open_tasks ?? 0;
  // Tools the operator switched off for this planner are not offered
  // (/auth/me `capabilities`); the server refuses them anyway.
  const specs: TabSpec[] = [
    { name: "index", icon: "home", label: c.home },
    ...(can(me, "guests") ? [{ name: "guests", icon: "guests", label: c.guests } as TabSpec] : []),
    { name: "requests", icon: "tasks", label: c.requests, badge: can(me, "tasks") ? badge : 0 },
    ...(can(me, "budget") ? [{ name: "budget", icon: "coins", label: c.budget } as TabSpec] : []),
    { name: "more", icon: "more", label: c.more },
  ];
  return (
    <Tabs
      // Back means the screen the person came from (More, then Tasks, then back
      // lands on More). The default, firstRoute, jumped to the home tab.
      backBehavior="history"
      tabBar={(props) => <GlassTabBar {...props} specs={specs} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.night },
        lazy: true,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="guests" />
      <Tabs.Screen name="requests" />
      {/* budget, tasks, vendors and runsheet each have a stack _layout, so the
          route names below match (core review P1-7). */}
      <Tabs.Screen name="budget" />
      <Tabs.Screen name="more" />
      <Tabs.Screen name="tasks" options={{ href: null }} />
      <Tabs.Screen name="runsheet" options={{ href: null }} />
      <Tabs.Screen name="seating" options={{ href: null }} />
      <Tabs.Screen name="broadcasts" options={{ href: null }} />
      <Tabs.Screen name="vendors" options={{ href: null }} />
    </Tabs>
  );
}

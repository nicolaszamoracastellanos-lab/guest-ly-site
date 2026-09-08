import React from "react";
import { Tabs } from "expo-router";
import { useCopy } from "@/i18n";
import { usePlannerHome } from "@/lib/hooks";
import { GlassTabBar, type TabSpec } from "@/ui/TabBar";
import { colors } from "@/ui/tokens";

export default function PlannerTabs() {
  const c = useCopy().planner.tabs;
  const { data } = usePlannerHome();
  const badge = data?.weddings.reduce((s, w) => s + w.open_requests, 0) ?? 0;
  const specs: TabSpec[] = [
    { name: "index", icon: "home", label: c.home },
    { name: "guests", icon: "guests", label: c.guests },
    { name: "requests", icon: "tasks", label: c.requests, badge },
    { name: "budget", icon: "coins", label: c.budget },
    { name: "more", icon: "more", label: c.more },
  ];
  return (
    <Tabs
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
      <Tabs.Screen name="budget" />
      <Tabs.Screen name="more" />
      <Tabs.Screen name="tasks" options={{ href: null }} />
    </Tabs>
  );
}

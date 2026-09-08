import React from "react";
import { Tabs } from "expo-router";
import { useCopy } from "@/i18n";
import { GlassTabBar, type TabSpec } from "@/ui/TabBar";
import { colors } from "@/ui/tokens";

export default function GuestTabs() {
  const c = useCopy().guestHome.tabs;
  const specs: TabSpec[] = [
    { name: "index", icon: "home", label: c.home },
    { name: "rsvp", icon: "mail", label: c.rsvp },
    { name: "schedule", icon: "calendar", label: c.schedule },
    { name: "concierge", icon: "sparkle", label: c.concierge },
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
      <Tabs.Screen name="rsvp" />
      <Tabs.Screen name="schedule" />
      <Tabs.Screen name="concierge" />
      <Tabs.Screen name="more" />
      <Tabs.Screen name="dayof" options={{ href: null }} />
      <Tabs.Screen name="messages" options={{ href: null }} />
    </Tabs>
  );
}

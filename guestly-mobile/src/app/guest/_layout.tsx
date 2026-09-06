import React from "react";
import { Tabs } from "expo-router";
import { useCopy } from "@/i18n";
import { makeTabBar } from "@/ui/TabBar";
import { colors } from "@/ui/tokens";

export default function GuestTabs() {
  const c = useCopy().guestHome.tabs;
  const TabBar = React.useMemo(
    () =>
      makeTabBar([
        { name: "index", icon: "home", label: c.home },
        { name: "rsvp", icon: "mail", label: c.rsvp },
        { name: "schedule", icon: "calendar", label: c.schedule },
        { name: "concierge", icon: "sparkle", label: c.concierge },
        { name: "more", icon: "more", label: c.more },
      ]),
    [c]
  );
  return (
    <Tabs tabBar={TabBar} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.night }, lazy: true }}>
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

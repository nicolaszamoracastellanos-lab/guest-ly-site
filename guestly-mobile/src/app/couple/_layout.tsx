import React from "react";
import { Tabs } from "expo-router";
import { useCopy } from "@/i18n";
import { useInbox } from "@/lib/hooks";
import { makeTabBar } from "@/ui/TabBar";
import { colors } from "@/ui/tokens";

export default function CoupleTabs() {
  const c = useCopy().coupleHome.tabs;
  const { data } = useInbox("needs_you");
  const badge = data?.needs_you ?? 0;
  const TabBar = React.useMemo(
    () =>
      makeTabBar([
        { name: "index", icon: "home", label: c.home },
        { name: "guests", icon: "guests", label: c.guests },
        { name: "rsvps", icon: "mail", label: c.rsvps },
        { name: "messages", icon: "chat", label: c.messages, badge },
        { name: "more", icon: "more", label: c.more },
      ]),
    [c, badge]
  );
  return (
    <Tabs tabBar={TabBar} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.night }, lazy: true }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="guests" />
      <Tabs.Screen name="rsvps" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="more" />
      <Tabs.Screen name="dayof" options={{ href: null }} />
      <Tabs.Screen name="checkin" options={{ href: null }} />
      <Tabs.Screen name="requests" options={{ href: null }} />
    </Tabs>
  );
}

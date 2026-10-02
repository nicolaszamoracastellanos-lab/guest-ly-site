import React, { useEffect } from "react";
import { Tabs } from "expo-router";
import { useCopy } from "@/i18n";
import { useInbox } from "@/lib/hooks";
import { useSession } from "@/lib/session";
import { enterTenantScope } from "@/features/shared/tenantScope";
import { GlassTabBar, type TabSpec } from "@/ui/TabBar";
import { colors } from "@/ui/tokens";

export default function CoupleTabs() {
  const c = useCopy().coupleHome.tabs;
  const { state } = useSession();
  const scopeKey = state.status === "user" ? `${state.me.user.id}:${state.me.tenant.slug}` : null;
  // The brain and seating drafts are module stores: a different account or
  // wedding than last time starts them empty.
  useEffect(() => {
    if (scopeKey) enterTenantScope(scopeKey);
  }, [scopeKey]);
  const { data } = useInbox("needs_you");
  const badge = data?.needs_you ?? 0;
  const specs: TabSpec[] = [
    { name: "index", icon: "home", label: c.home },
    { name: "guests", icon: "guests", label: c.guests },
    { name: "rsvps", icon: "mail", label: c.rsvps },
    { name: "messages", icon: "chat", label: c.messages, badge },
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
      <Tabs.Screen name="rsvps" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="more" />
      <Tabs.Screen name="dayof" options={{ href: null }} />
      <Tabs.Screen name="checkin" options={{ href: null }} />
      <Tabs.Screen name="requests" options={{ href: null }} />
      {/* Each section below is its own Stack (see its _layout.tsx). Leaving a
          section pops it to its list, so its detail screens never linger
          mounted with the last record's state. While a hidden section is open
          the More tab stays lit (GlassTabBar, v1.2 N3): all of them are
          reached from More (Day-of also from Home). */}
      <Tabs.Screen name="tasks" options={{ href: null, popToTopOnBlur: true }} />
      <Tabs.Screen name="seating" options={{ href: null, popToTopOnBlur: true }} />
      <Tabs.Screen name="runsheet" options={{ href: null, popToTopOnBlur: true }} />
      <Tabs.Screen name="brain" options={{ href: null, popToTopOnBlur: true }} />
      <Tabs.Screen name="insights" options={{ href: null, popToTopOnBlur: true }} />
      <Tabs.Screen name="broadcasts" options={{ href: null, popToTopOnBlur: true }} />
      <Tabs.Screen name="budget" options={{ href: null, popToTopOnBlur: true }} />
      <Tabs.Screen name="vendors" options={{ href: null, popToTopOnBlur: true }} />
      <Tabs.Screen name="website" options={{ href: null, popToTopOnBlur: true }} />
      <Tabs.Screen name="settings" options={{ href: null, popToTopOnBlur: true }} />
    </Tabs>
  );
}

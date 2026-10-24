// The three role layouts (guest, couple, planner) use the SYSTEM tab bar.
//
// Why: on the iPhone Duo the bars move to a vertical rail at the side on the
// outer display and in inner landscape; only bars built by the system
// (UITabBarController) move on their own. A bar drawn in JavaScript never
// does (Apple Group Lab: "There's no API that moves a custom tab bar for
// you"). Expo Router 58 NativeTabs is the system bar. Liquid Glass comes from
// the system; the gold stays in the tint, the icons and the content.
//
// Every tab has an SF Symbol AND a label: an item without an icon would stay
// in the horizontal bar and never go vertical.

import React, { useEffect } from "react";
import { NativeTabs, type SFSymbolIcon } from "expo-router/native-tabs";
import { registerTabs } from "@/lib/nav";
import { colors, fonts } from "./tokens";

type Sf = NonNullable<SFSymbolIcon["sf"]>;

export type RoleTab = {
  /** Route name of the tab ("index" for the surface home, "(group)" for a stack). */
  name: string;
  sf: Sf;
  label: string;
  /** A count (capped at 99) or a dot. 0, null and undefined show nothing. */
  badge?: number | "dot" | null;
  /** Sections inside the tab's stack, for the safe back (lib/nav registerTabs). */
  owns?: string[];
};

function badgeText(badge: RoleTab["badge"]): string | undefined {
  if (badge === "dot") return " ";
  if (typeof badge === "number" && badge > 0) return badge > 99 ? "99+" : String(badge);
  return undefined;
}

type NativeTabsProps = React.ComponentProps<typeof NativeTabs>;

export function RoleNativeTabs({
  surface,
  tabs,
  fallback,
  screenListeners,
}: {
  surface: "guest" | "couple" | "planner";
  tabs: RoleTab[];
  /** The tab that owns sections no tab lists. */
  fallback: string;
  screenListeners?: NativeTabsProps["screenListeners"];
}) {
  useEffect(() => {
    registerTabs(surface, tabs.map((t) => ({ name: t.name, owns: t.owns })), fallback);
  }, [surface, tabs, fallback]);
  return (
    <NativeTabs
      tintColor={colors.goldLight}
      iconColor={{ default: colors.ivory40, selected: colors.goldLight }}
      labelStyle={{ default: { color: colors.ivory40, fontFamily: fonts.bodyMedium }, selected: { color: colors.goldLight, fontFamily: fonts.bodyMedium } }}
      backgroundColor={colors.nightDeep}
      badgeBackgroundColor={colors.red}
      badgeTextColor={colors.night}
      minimizeBehavior="never"
      screenListeners={screenListeners}
    >
      {tabs.map((t) => {
        const text = badgeText(t.badge);
        return (
          <NativeTabs.Trigger key={t.name} name={t.name} contentStyle={{ backgroundColor: colors.night }}>
            <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf={t.sf} />
            <NativeTabs.Trigger.Badge hidden={text === undefined}>{text ?? ""}</NativeTabs.Trigger.Badge>
          </NativeTabs.Trigger>
        );
      })}
    </NativeTabs>
  );
}

// The floating glass tab bar (Direction A). Used as expo-router's custom
// tabBar so every root tab shares it. Labels stay at 10px by design; they
// are the one exception to the caption floor and carry an icon above them.
//
// Dynamic Type (Part 9 audit, D-031): the bar has a fixed height and five
// slots, so its labels do not scale with the system text size, the same way
// the system tab bar behaves. Each tab has a full accessibility label, and a
// long Spanish label shrinks a little instead of running into its neighbour.
// On wide windows the bar is a centered 520 pt pill, not a full-width strip.
//
// Tabs' tabBar prop is a render function that the navigator CALLS (it is not
// mounted as a component), so hooks cannot live in that function. The
// layouts pass `(props) => <GlassTabBar {...props} specs={...} />` and this
// component owns the hooks.

import React from "react";
import { View, Pressable, StyleSheet, Text } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs } from "expo-router";
import * as Haptics from "expo-haptics";
import { Icon, type IconName } from "./Icon";
import { colors, TAB_BAR_HEIGHT, TAB_BAR_BOTTOM, TAB_BAR_MAX_WIDTH, FILL } from "./tokens";

type TabsProps = React.ComponentProps<typeof Tabs>;
type TabBarFn = NonNullable<TabsProps["tabBar"]>;
type BottomTabBarProps = Parameters<TabBarFn>[0];

export type TabSpec = {
  name: string;
  icon: IconName;
  label: string;
  badge?: number;
};

export function GlassTabBar({
  state,
  navigation,
  specs,
}: BottomTabBarProps & { specs: TabSpec[] }) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 0) + TAB_BAR_BOTTOM;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <View style={styles.bar}>
        <BlurView
          intensity={45}
          tint="dark"
          style={FILL}
          blurMethod="dimezisBlurView"
        />
        <View style={styles.fill} />
        {state.routes.map((route, index) => {
          const spec = specs.find((s) => s.name === route.name);
          if (!spec) return null;
          const focused = state.index === index;
          const color = focused ? colors.goldLight : colors.ivory55;
          return (
            <Pressable
              key={route.key}
              testID={`tab-${route.name}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={spec.label}
              onPress={() => {
                void Haptics.selectionAsync();
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented)
                  navigation.navigate(route.name);
              }}
              style={styles.tab}
            >
              <View>
                <Icon name={spec.icon} size={22} color={color} />
                {spec.badge ? (
                  <View style={styles.badge}>
                    <Text allowFontScaling={false} style={styles.badgeText}>
                      {spec.badge > 99 ? "99" : spec.badge}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.label, { color }]}>
                {spec.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 20, right: 20, alignItems: "center" },
  bar: {
    width: "100%",
    maxWidth: TAB_BAR_MAX_WIDTH,
    height: TAB_BAR_HEIGHT,
    borderRadius: 999,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.ivory14,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  fill: {
    ...{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    backgroundColor: colors.glassFill,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minHeight: 48,
    paddingHorizontal: 2,
  },
  label: { fontFamily: "Jost_500Medium", fontSize: 10, letterSpacing: 0.4, alignSelf: "stretch", textAlign: "center" },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    fontFamily: "Jost_600SemiBold",
    fontSize: 10,
    color: colors.night,
  },
});

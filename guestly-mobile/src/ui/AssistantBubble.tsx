// The floating assistant button: a gold gem that lives on every screen,
// drags anywhere, snaps to the nearest edge and remembers where it was left.
// Tap opens the Coordinator (couples, planners) or the concierge (guests).
// Mounted once by the root layout; hidden while a keyboard is open or on the
// chat screens themselves.

import React, { useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useLang } from "@/i18n";
import { Icon } from "./Icon";
import { T } from "./Text";
import { colors, TAB_BAR_BOTTOM, TAB_BAR_HEIGHT } from "./tokens";

export type AssistantSurface = "guest" | "couple" | "planner";

const SIZE = 56;
const MARGIN = 14;
const STORAGE_KEY = "assistant-bubble";

type Saved = { side: "left" | "right"; y: number };

const LABEL = {
  en: { coordinator: "Ask the Coordinator", concierge: "Ask the concierge" },
  es: { coordinator: "Pregunte al Coordinador", concierge: "Pregunte al concierge" },
};

export default function AssistantBubble({ surface, hidden = false, badge = false }: { surface: AssistantSurface; hidden?: boolean; badge?: boolean }) {
  const router = useRouter();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [keyboard, setKeyboard] = useState(false);
  const [label, setLabel] = useState(false);

  const minY = Math.max(insets.top, 54) + MARGIN;
  const maxY = height - Math.max(insets.bottom, 0) - TAB_BAR_BOTTOM - TAB_BAR_HEIGHT - SIZE - MARGIN;
  const leftX = MARGIN;
  const rightX = width - SIZE - MARGIN;

  const x = useSharedValue(rightX);
  const y = useSharedValue(Math.max(minY, maxY - 120));
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const scale = useSharedValue(1);
  const shown = useSharedValue(1);

  // Restore the last resting place, once per mount.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && alive) {
          const saved = JSON.parse(raw) as Saved;
          x.set(saved.side === "left" ? leftX : rightX);
          y.set(Math.min(Math.max(saved.y, minY), maxY));
        }
      } catch {
        // No saved spot; the default corner is fine.
      }
    })();
    return () => {
      alive = false;
    };
    // Screen size and insets are settled by first paint; restoring once is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const a = Keyboard.addListener(showEvt, () => setKeyboard(true));
    const b = Keyboard.addListener(hideEvt, () => setKeyboard(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  const visible = !hidden && !keyboard;
  useEffect(() => {
    shown.set(withTiming(visible ? 1 : 0, { duration: 180 }));
  }, [visible, shown]);

  // The label hides itself; the effect owns the timer.
  useEffect(() => {
    if (!label) return;
    const t = setTimeout(() => setLabel(false), 1600);
    return () => clearTimeout(t);
  }, [label]);

  const persist = (side: "left" | "right", yy: number) => {
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ side, y: Math.round(yy) } satisfies Saved)).catch(() => {});
  };

  const open = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (surface === "guest") router.push("/guest/concierge");
    else router.push("/assistant");
  };

  const showLabel = () => {
    void Haptics.selectionAsync();
    setLabel(true);
  };

  const pan = Gesture.Pan()
    .minDistance(6)
    .onStart(() => {
      startX.set(x.get());
      startY.set(y.get());
      scale.set(withSpring(1.08));
    })
    .onUpdate((e) => {
      x.set(Math.min(Math.max(startX.get() + e.translationX, leftX - 6), rightX + 6));
      y.set(Math.min(Math.max(startY.get() + e.translationY, minY), maxY));
    })
    .onEnd((e) => {
      const side: "left" | "right" = x.get() + SIZE / 2 + e.velocityX * 0.05 < width / 2 ? "left" : "right";
      x.set(withSpring(side === "left" ? leftX : rightX, { damping: 18, stiffness: 180 }));
      scale.set(withSpring(1));
      runOnJS(persist)(side, y.get());
    });

  const tap = Gesture.Tap()
    .maxDuration(300)
    .onEnd((_e, success) => {
      if (success) runOnJS(open)();
    });

  const longPress = Gesture.LongPress()
    .minDuration(380)
    .onStart(() => {
      runOnJS(showLabel)();
    });

  const gesture = Gesture.Race(pan, Gesture.Exclusive(longPress, tap));

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value * (0.7 + 0.3 * shown.value) }],
    opacity: shown.value,
  }));
  const labelStyle = useAnimatedStyle(() => ({
    // The label sits on the side with room: left of the bubble when it rests
    // on the right edge, and the other way round.
    right: x.value > width / 2 ? SIZE + 10 : undefined,
    left: x.value > width / 2 ? undefined : SIZE + 10,
  }));

  const text = surface === "guest" ? LABEL[lang].concierge : LABEL[lang].coordinator;

  return (
    <View pointerEvents={visible ? "box-none" : "none"} style={StyleSheet.absoluteFill}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.wrap, style]}>
          {label ? (
            <Animated.View style={[styles.label, labelStyle]}>
              <T v="meta13" color={colors.ivory}>
                {text}
              </T>
            </Animated.View>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={text} style={styles.button} onPress={open} onLongPress={showLabel}>
            <View style={styles.ring} />
            <Icon name="sparkle" size={26} color={colors.night} strokeWidth={1.8} />
            {badge ? <View style={styles.badge} /> : null}
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, width: SIZE, height: SIZE },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  ring: { position: "absolute", top: 3, left: 3, right: 3, bottom: 3, borderRadius: SIZE / 2, borderWidth: 1, borderColor: "rgba(13,17,23,0.18)" },
  badge: { position: "absolute", top: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.amber, borderWidth: 2, borderColor: colors.gold },
  label: {
    position: "absolute",
    top: SIZE / 2 - 17,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: "rgba(13,17,23,0.92)",
    borderWidth: 1,
    borderColor: colors.ivory14,
    justifyContent: "center",
    minWidth: 150,
  },
});

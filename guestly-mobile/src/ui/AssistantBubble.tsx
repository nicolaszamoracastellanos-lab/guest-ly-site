// The floating Coordinator button, AssistiveTouch style (v1.2, audit I9).
//
// - Always whole on screen: it never docks half off the edge any more.
// - Drag it anywhere; on release it snaps to the nearest side, 8 pt in, with a
//   light selection tap. Vertically it stays between the header band under the
//   status bar and just above the tab bar.
// - Remembers its side and height across launches (AsyncStorage, best effort).
// - Rests at about 55% opacity after 3 s untouched and comes back to full on
//   touch, so it never hides what is under it for long.
// - Tap opens the Coordinator (couple, planner: /assistant) or the concierge
//   (guest: the concierge tab). Hold shows its name.
// - Hidden while the keyboard is open (build 12: read from
//   react-native-keyboard-controller, the same source the composers and docked
//   actions ride on) and on the chat it opens (root layout, chrome.ts
//   pathShowsBubble). Honors Reduce Motion.
//
// Mounted once by the root layout so it keeps its place across screens.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useLang } from "@/i18n";
import { Icon } from "./Icon";
import { T } from "./Text";
import { colors, TAB_BAR_HEIGHT, BUBBLE_SIZE, BUBBLE_MARGIN, BUBBLE_IDLE_OPACITY, BUBBLE_IDLE_MS, HIT_TARGET, TOP_SAFE_MIN, tabBarOffset } from "./tokens";

export type AssistantSurface = "guest" | "couple" | "planner";

const SIZE = BUBBLE_SIZE;
const INSET = BUBBLE_MARGIN;
const STORAGE_KEY = "assistant-bubble";
/** Every screen's header row (back, title actions, the tour's Skip) is one
 *  hit target tall with 6 pt under it, starting at the screen's top inset
 *  (useTopInset in the kit). The bubble stays below it, 8 pt clear. */
const HEADER_ROW = HIT_TARGET + 6;
/** A tap within this long of the bubble appearing is ignored: it was aimed at
 *  whatever was on top a moment ago (the tour's Skip, a closing sheet). */
const APPEAR_GRACE_MS = 600;
/** Where it starts before the person has moved it: the right side, a little
 *  below the middle of its travel. */
const DEFAULT_PLACE: Place = { side: "right", frac: 0.62 };

type Side = "left" | "right";
/** `frac` is the height as a fraction of the travel between the header band
 *  and the tab bar, so the place survives a different phone or a rotation. */
type Place = { side: Side; frac: number };
/** Stored shape. Build 11 saved `{ side, y }` (absolute points). */
type Saved = { side?: Side; y?: number; frac?: number };

const LABEL = {
  en: { coordinator: "Ask the Coordinator", concierge: "Ask the concierge", hint: "Opens the chat. Drag to move it." },
  es: { coordinator: "Pregúntale al Coordinador", concierge: "Pregúntale al concierge", hint: "Abre el chat. Arrástralo para moverlo." },
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export default function AssistantBubble({ surface, hidden = false, badge = false }: { surface: AssistantSurface; hidden?: boolean; badge?: boolean }) {
  const router = useRouter();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const keyboard = useKeyboardState((k) => k.isVisible);
  const [label, setLabel] = useState(false);
  const [place, setPlace] = useState<Place>(DEFAULT_PLACE);
  // The bubble stays hidden until the saved place is read, so it appears where
  // it was left instead of flying there from the default spot.
  const [restored, setRestored] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Travel: under the header row, above the floating tab bar, 8 pt in. The
  // header's top is the same rule the screens use (useTopInset in the kit).
  const headerTop = insets.top >= 40 ? Math.max(insets.top, TOP_SAFE_MIN) : insets.top + 16;
  const minY = headerTop + HEADER_ROW + INSET;
  const maxY = Math.max(minY, height - tabBarOffset(Math.max(insets.bottom, 0)) - TAB_BAR_HEIGHT - SIZE - INSET);
  const leftX = INSET;
  const rightX = Math.max(INSET, width - SIZE - INSET);

  const x = useSharedValue(rightX);
  const y = useSharedValue(minY + (maxY - minY) * DEFAULT_PLACE.frac);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const scale = useSharedValue(1);
  const shown = useSharedValue(0);
  const idle = useSharedValue(1);
  const armed = useSharedValue(0);

  // Restore the last place, once per mount. Storage can fail or be empty: the
  // default place is fine then.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw || !alive) return;
        const saved = JSON.parse(raw) as Saved;
        const side: Side = saved.side === "left" ? "left" : "right";
        let frac = typeof saved.frac === "number" ? saved.frac : null;
        // A build 11 place in points: map it onto today's travel.
        if (frac === null && typeof saved.y === "number" && maxY > minY) frac = (saved.y - minY) / (maxY - minY);
        setPlace({ side, frac: clamp01(frac ?? DEFAULT_PLACE.frac) });
      } catch {
        // Nothing saved, or unreadable: keep the default.
      } finally {
        if (alive) setRestored(true);
      }
    })();
    return () => {
      alive = false;
    };
    // Restoring once is intended; later size changes re-place from `place`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move to the place: on restore, after a drag (the snap) and when the window
  // or the safe area changes. Until the restore is done (bubble still hidden)
  // and for the restored place itself it jumps; later moves glide.
  const placed = useRef(false);
  useEffect(() => {
    const tx = place.side === "left" ? leftX : rightX;
    const ty = minY + (maxY - minY) * clamp01(place.frac);
    if (!placed.current || reduceMotion) {
      x.set(placed.current && reduceMotion ? withTiming(tx, { duration: 120 }) : tx);
      y.set(placed.current && reduceMotion ? withTiming(ty, { duration: 120 }) : ty);
      placed.current = restored;
      return;
    }
    x.set(withSpring(tx, { damping: 20, stiffness: 220 }));
    y.set(withSpring(ty, { damping: 20, stiffness: 220 }));
  }, [place, restored, leftX, rightX, minY, maxY, reduceMotion, x, y]);

  // Full opacity on touch (and each time it appears), then back to the
  // resting opacity after a while. Every touch bumps `touches`; the effect
  // owns the timer.
  const [touches, setTouches] = useState(0);
  const wake = useCallback(() => setTouches((n) => n + 1), []);
  const visible = restored && !hidden && !keyboard;
  useEffect(() => {
    if (!visible) return;
    idle.set(withTiming(1, { duration: reduceMotion ? 0 : 120 }));
    // Never dims under the finger: the rest timer starts when the drag ends.
    if (dragging) return;
    const t = setTimeout(() => {
      idle.set(withTiming(BUBBLE_IDLE_OPACITY, { duration: reduceMotion ? 0 : 400 }));
    }, BUBBLE_IDLE_MS);
    return () => clearTimeout(t);
  }, [touches, visible, dragging, idle, reduceMotion]);

  useEffect(() => {
    shown.set(withTiming(visible ? 1 : 0, { duration: reduceMotion ? 0 : 180 }));
    if (!visible) {
      armed.set(0);
      return;
    }
    const t = setTimeout(() => armed.set(1), APPEAR_GRACE_MS);
    return () => clearTimeout(t);
  }, [visible, shown, armed, reduceMotion]);

  // The label hides itself; the effect owns the timer.
  useEffect(() => {
    if (!label) return;
    const t = setTimeout(() => setLabel(false), 1600);
    return () => clearTimeout(t);
  }, [label]);

  const commit = useCallback((side: Side, frac: number) => {
    void Haptics.selectionAsync().catch(() => {});
    const next = { side, frac: clamp01(frac) };
    setPlace(next);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const open = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (surface === "guest") router.push("/guest/concierge");
    else router.push("/assistant");
  }, [router, surface]);

  const showLabel = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {});
    setLabel(true);
    wake();
  }, [wake]);

  const lift = reduceMotion ? 1 : 1.06;
  const pan = Gesture.Pan()
    .minDistance(6)
    .onBegin(() => {
      runOnJS(wake)();
    })
    .onStart(() => {
      startX.set(x.get());
      startY.set(y.get());
      scale.set(withTiming(lift, { duration: 120 }));
      runOnJS(setDragging)(true);
    })
    .onUpdate((e) => {
      // Free in both directions while held, never past the window edges.
      x.set(Math.min(Math.max(startX.get() + e.translationX, 0), rightX + INSET));
      y.set(Math.min(Math.max(startY.get() + e.translationY, minY), maxY));
    })
    .onEnd((e) => {
      const side: Side = x.get() + SIZE / 2 + e.velocityX * 0.05 < width / 2 ? "left" : "right";
      const frac = maxY > minY ? (y.get() - minY) / (maxY - minY) : 0;
      scale.set(withTiming(1, { duration: 120 }));
      runOnJS(commit)(side, frac);
      runOnJS(wake)();
    })
    .onFinalize(() => {
      runOnJS(setDragging)(false);
    });

  const tap = Gesture.Tap()
    .maxDuration(300)
    .onBegin(() => {
      runOnJS(wake)();
    })
    .onEnd((_e, success) => {
      // A tap right after the bubble appeared was meant for what covered it.
      if (success && armed.get() === 1) runOnJS(open)();
    });

  const longPress = Gesture.LongPress()
    .minDuration(380)
    .onStart(() => {
      runOnJS(showLabel)();
    });

  const gesture = Gesture.Race(pan, Gesture.Exclusive(longPress, tap));

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value * (0.8 + 0.2 * shown.value) }],
    opacity: shown.value * idle.value,
  }));
  const labelStyle = useAnimatedStyle(() => ({
    // The label sits on the side with room: left of the bubble when it rests
    // on the right side, and the other way round.
    right: x.value + SIZE / 2 > width / 2 ? SIZE + 10 : undefined,
    left: x.value + SIZE / 2 > width / 2 ? undefined : SIZE + 10,
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
          {/* Touches belong to the gesture above (tap, hold, drag). The view
              only speaks to VoiceOver and TalkBack: a Pressable here also
              fired on the same tap and pushed the chat twice (P2-36). */}
          <View
            testID="assistant-bubble"
            accessible={visible}
            accessibilityElementsHidden={!visible}
            importantForAccessibility={visible ? "yes" : "no-hide-descendants"}
            accessibilityRole="button"
            accessibilityLabel={text}
            accessibilityHint={LABEL[lang].hint}
            accessibilityActions={[{ name: "activate" }]}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === "activate") open();
            }}
            style={styles.button}
          >
            <View style={styles.ring} />
            <Icon name="sparkle" size={26} color={colors.night} strokeWidth={1.8} />
            {badge ? <View style={styles.badge} /> : null}
          </View>
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

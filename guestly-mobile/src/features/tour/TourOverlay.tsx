// The welcome tour itself: a full-screen layer above the app with a pager of
// steps. Swipe sideways (or Next and Back) to move, swipe down or Skip to
// leave. Every movement is driven by shared values on the UI thread; React
// state changes once per step. Only the current step and its two neighbours
// are mounted.
//
// Accessibility: the layer is modal for VoiceOver, the escape gesture skips,
// each step's title is a header that takes focus when the step changes, the
// scene is one element with a description (double tap runs its demo), and
// Reduce Motion turns the slide and parallax into a cross-fade.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import { fmt } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { T } from "@/ui/Text";
import { Icon } from "@/ui/Icon";
import { Button, IconButton } from "@/ui";
import { colors, fonts, COLUMN, FILL, radius } from "@/ui/tokens";
import { TOUR_COPY, type TourCopy } from "./copy";
import { buildSteps, ctaFor, type TourNames, type TourStep } from "./steps";
import type { TourVariant } from "./state";
import { SceneBox } from "./scenes/kit";

const PAGE_SPRING = { damping: 24, stiffness: 210, mass: 1 };

export function TourOverlay({ variant, names, onClose }: { variant: TourVariant; names: TourNames; onClose: (how: "done" | "skipped") => void }) {
  const t = useFeatureCopy(TOUR_COPY);
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const steps = useMemo(() => buildSteps(variant, t, names), [variant, t, names]);
  const n = steps.length;
  const [index, setIndex] = useState(0);
  const [sr, setSr] = useState(false);
  const pos = useSharedValue(0);
  const drag = useSharedValue(0);
  const shown = useSharedValue(0);
  // Not a ref: close() is handed to the gesture, which is built during render.
  const [closing] = useState(() => new Once());
  const title = useRef<View>(null);

  // ---------------------------------------------------------- open, close
  useEffect(() => {
    shown.set(reduced ? withTiming(1, { duration: 220 }) : withSpring(1, { damping: 22, stiffness: 170, mass: 1 }));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
  }, [reduced, shown]);

  const close = useCallback(
    (how: "done" | "skipped", fromDrag = false) => {
      if (!closing.take()) return;
      const ms = reduced ? 180 : 280;
      if (fromDrag) drag.set(withTiming(height, { duration: ms }));
      shown.set(withTiming(0, { duration: ms }));
      // A timer, not an animation callback: an interrupted animation must
      // never leave the layer on screen.
      setTimeout(() => onClose(how), ms + 20);
    },
    [closing, reduced, drag, shown, height, onClose]
  );

  // ---------------------------------------------------------- moving
  const settle = useCallback((i: number) => {
    setIndex(i);
    void Haptics.selectionAsync().catch(() => {});
  }, []);

  const goTo = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(n - 1, i));
      if (next === index) return;
      pos.set(reduced ? withTiming(next, { duration: 240 }) : withSpring(next, PAGE_SPRING));
      settle(next);
    },
    [n, index, pos, reduced, settle]
  );

  const next = useCallback(() => {
    if (steps[index]?.final) close("done");
    else goTo(index + 1);
  }, [steps, index, close, goTo]);

  const skip = useCallback(() => close("skipped"), [close]);
  const dragClose = useCallback(() => close("skipped", true), [close]);

  // Android back: one step back, or leave from the first step.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (index > 0) goTo(index - 1);
      else skip();
      return true;
    });
    return () => sub.remove();
  }, [index, goTo, skip]);

  // VoiceOver: move focus to the new step's title once it has slid in.
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((v) => alive && setSr(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("screenReaderChanged", setSr);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  useEffect(() => {
    if (!sr) return;
    const tm = setTimeout(() => {
      if (title.current) AccessibilityInfo.sendAccessibilityEvent(title.current, "focus");
    }, 420);
    return () => clearTimeout(tm);
  }, [index, sr]);

  // ---------------------------------------------------------- gesture
  const start = useSharedValue(0);
  const axis = useSharedValue(0); // 0 undecided, 1 sideways, 2 down
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(10)
        .onStart(() => {
          start.set(pos.get());
          axis.set(0);
        })
        .onUpdate((e) => {
          if (axis.get() === 0) axis.set(Math.abs(e.translationX) >= Math.abs(e.translationY) ? 1 : 2);
          if (axis.get() === 1) {
            let p = start.get() - e.translationX / width;
            if (p < 0) p *= 0.3;
            else if (p > n - 1) p = n - 1 + (p - (n - 1)) * 0.3;
            pos.set(p);
          } else {
            drag.set(Math.max(0, e.translationY));
          }
        })
        .onEnd((e) => {
          if (axis.get() === 1) {
            const s = Math.round(start.get());
            let target = s;
            if (e.translationX < -width * 0.18 || e.velocityX < -600) target = s + 1;
            else if (e.translationX > width * 0.18 || e.velocityX > 600) target = s - 1;
            target = Math.max(0, Math.min(n - 1, target));
            pos.set(withSpring(target, { ...PAGE_SPRING, velocity: -e.velocityX / width }));
            if (target !== s) scheduleOnRN(settle, target);
          } else if (axis.get() === 2) {
            if (e.translationY > 130 || e.velocityY > 900) scheduleOnRN(dragClose);
            else drag.set(withSpring(0, { damping: 20, stiffness: 220 }));
          }
        })
        .onFinalize((_e, success) => {
          if (success) return;
          pos.set(withSpring(Math.round(pos.get()), PAGE_SPRING));
          drag.set(withSpring(0, { damping: 20, stiffness: 220 }));
        }),
    [width, n, pos, drag, start, axis, settle, dragClose]
  );

  // ---------------------------------------------------------- styles
  const rootStyle = useAnimatedStyle(() => {
    const d = drag.get();
    const s = shown.get();
    return {
      opacity: s,
      borderRadius: interpolate(d, [0, 120], [0, radius.sheet], Extrapolation.CLAMP),
      transform: reduced
        ? [{ translateY: d }]
        : [{ translateY: d + (1 - s) * 36 }, { scale: interpolate(d, [0, height], [1, 0.9], Extrapolation.CLAMP) * (0.97 + s * 0.03) }],
    };
  });

  const step = steps[index];
  const lo = Math.max(0, index - 1);
  const hi = Math.min(n - 1, index + 1);
  const mounted: number[] = [];
  for (let i = lo; i <= hi; i++) mounted.push(i);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, rootStyle]}
      accessibilityViewIsModal
      onAccessibilityEscape={skip}
      accessibilityLabel={t.a11yTitle}
    >
      <LinearGradient colors={[colors.navy, colors.night, colors.nightDeep]} locations={[0, 0.45, 1]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={FILL} />
      <LinearGradient colors={["rgba(201,169,110,0.16)", "rgba(201,169,110,0)"]} start={{ x: 1, y: 0 }} end={{ x: 0.3, y: 0.55 }} style={FILL} />

      <View style={{ paddingTop: Math.max(insets.top, 20) + 6 }}>
        <View style={styles.grabber} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        <View style={[COLUMN, styles.header]}>
          <Progress n={n} pos={pos} />
          <Pressable
            onPress={skip}
            accessibilityRole="button"
            accessibilityLabel={t.skipLabel}
            accessibilityHint={t.swipeDown}
            hitSlop={8}
            style={({ pressed }) => [styles.skip, pressed && { opacity: 0.6 }]}
            testID="tour-skip"
          >
            <T v="body15" color={colors.ivory70} maxFontSizeMultiplier={1.2} numberOfLines={1}>
              {t.skip}
            </T>
          </Pressable>
        </View>
      </View>

      <GestureDetector gesture={pan}>
        <View style={styles.pages} collapsable={false}>
          {mounted.map((i) => (
            <Page
              key={steps[i].key}
              i={i}
              n={n}
              step={steps[i]}
              active={i === index}
              pos={pos}
              width={width}
              reduced={reduced}
              t={t}
              titleRef={i === index ? title : undefined}
            />
          ))}
        </View>
      </GestureDetector>

      <View style={[COLUMN, styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={{ width: 52, alignItems: "center" }} importantForAccessibility={index > 0 ? "auto" : "no-hide-descendants"} accessibilityElementsHidden={index === 0}>
          {index > 0 ? <IconButton name="back" label={t.back} onPress={() => goTo(index - 1)} testID="tour-back" /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Button testID="tour-next" label={step?.final ? ctaFor(variant, t) : t.next} onPress={next} haptic={false} />
        </View>
        <View style={{ width: 52 }} />
      </View>
    </Animated.View>
  );
}

/** True the first time only. */
class Once {
  private done = false;
  take(): boolean {
    if (this.done) return false;
    this.done = true;
    return true;
  }
}

// ---------------------------------------------------------------- one step

function Page({ i, n, step, active, pos, width, reduced, t, titleRef }: { i: number; n: number; step: TourStep; active: boolean; pos: SharedValue<number>; width: number; reduced: boolean; t: TourCopy; titleRef?: React.RefObject<View | null> }) {
  const pageStyle = useAnimatedStyle(() => {
    const d = i - pos.get();
    if (reduced) return { opacity: Math.max(0, 1 - Math.abs(d)) };
    return { transform: [{ translateX: d * width }] };
  });
  const sceneStyle = useAnimatedStyle(() => {
    if (reduced) return {};
    const d = i - pos.get();
    const a = Math.min(1, Math.abs(d));
    // The scene travels faster than its page (it leads on the way in and
    // leaves first), so a neighbour's scene is never in view at rest.
    return { opacity: 1 - a, transform: [{ translateX: d * width * 0.35 }, { scale: 1 - a * 0.14 }, { rotate: `${d * 6}deg` }] };
  });
  const textStyle = useAnimatedStyle(() => {
    if (reduced) return {};
    const d = i - pos.get();
    return { opacity: 1 - Math.min(1, Math.abs(d)) * 0.9, transform: [{ translateX: d * width * 0.14 }] };
  });
  const c = step.copy;
  const Scene = step.Scene;
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, pageStyle]}
      pointerEvents={active ? "auto" : "none"}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
    >
      <View style={[COLUMN, styles.page]}>
        <Animated.View style={[styles.scene, sceneStyle]}>
          <SceneBox label={c.scene} tryIt={c.tryIt} tryHint={t.tryHint} active={active} reduced={reduced}>
            <Scene active={active} reduced={reduced} />
          </SceneBox>
        </Animated.View>
        <Animated.View style={[styles.text, textStyle]}>
          <T v="label11" color={colors.goldLight} maxFontSizeMultiplier={1.2}>
            {fmt(t.stepOf, { n: i + 1, total: n })}
          </T>
          <View ref={titleRef} accessible accessibilityRole="header" accessibilityLabel={c.title} style={{ marginTop: 6 }}>
            <T v="title34" size={34}>
              {c.title}
            </T>
          </View>
          <T v="body15" color={colors.ivory70} style={{ marginTop: 8 }}>
            {c.body}
          </T>
          {c.where ? (
            <View style={styles.where}>
              <Icon name="pin" size={16} color={colors.goldLight} />
              <T v="meta13" color={colors.ivory70} style={{ flex: 1 }}>
                <T v="meta13" color={colors.goldLight} style={{ fontFamily: fonts.bodyMedium }}>
                  {`${t.findIt}: `}
                </T>
                {c.where}
              </T>
            </View>
          ) : null}
          {c.tip && !step.final ? (
            <View style={styles.tip}>
              <Icon name="sparkle" size={18} color={colors.goldLight} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="label11" color={colors.goldLight} maxFontSizeMultiplier={1.2}>
                  {t.tip}
                </T>
                <T v="meta13" color={colors.ivory90}>
                  {c.tip}
                </T>
              </View>
            </View>
          ) : c.tip ? (
            <View style={[styles.where, { marginTop: 14 }]}>
              <Icon name="undo" size={16} color={colors.ivory55} />
              <T v="meta13" color={colors.ivory55} style={{ flex: 1 }}>
                {c.tip}
              </T>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------- progress

function Progress({ n, pos }: { n: number; pos: SharedValue<number> }) {
  return (
    <View style={styles.progress} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: n }, (_, i) => (
        <Segment key={i} i={i} pos={pos} />
      ))}
    </View>
  );
}

function Segment({ i, pos }: { i: number; pos: SharedValue<number> }) {
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0, Math.min(1, pos.get() - i + 1)) }] }));
  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // No zIndex: the root layout draws the lock cover and update screen after
  // the tour, and they must stay on top of it.
  root: { backgroundColor: colors.night, overflow: "hidden" },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(247,243,236,0.22)", marginBottom: 6 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingLeft: 24, paddingRight: 12, minHeight: 44 },
  progress: { flex: 1, flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.ivory14, overflow: "hidden" },
  segmentFill: { flex: 1, backgroundColor: colors.goldLight, transformOrigin: "left" },
  skip: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  pages: { flex: 1, overflow: "hidden" },
  page: { flex: 1, paddingHorizontal: 24 },
  scene: { flex: 1, minHeight: 0, paddingTop: 8 },
  text: { paddingTop: 10, paddingBottom: 8 },
  where: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 14 },
  tip: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 12, padding: 12, borderRadius: radius.tile, borderWidth: 1, borderColor: "rgba(201,169,110,0.3)", backgroundColor: "rgba(201,169,110,0.07)" },
  footer: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingTop: 8 },
});

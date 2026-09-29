// Building blocks for the tour's mini scenes.
//
// A scene is drawn on a fixed 320 x 280 canvas and scaled to whatever room the
// step leaves it, so it looks the same on a 17e with the largest text and on a
// Pro Max. For VoiceOver the whole scene is one element: its description, and
// when it has a tap-to-try action, double tap runs that action.
//
// Everything that moves runs on the UI thread (Reanimated shared values).
// JavaScript only flips state on a tap or a timer between beats.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { View, StyleSheet, Pressable, type LayoutChangeEvent, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { T } from "@/ui/Text";
import { Icon, type IconName } from "@/ui/Icon";
import { colors, fonts, radius } from "@/ui/tokens";

export const CANVAS_W = 320;
export const CANVAS_H = 280;

/** What every scene receives from its page. */
export type SceneProps = {
  /** The page is the current step (not a neighbour being swiped past). */
  active: boolean;
  /** Reduce Motion is on: no loops, no flights, instant state changes. */
  reduced: boolean;
};

// ---------------------------------------------------------------- try action

type TryCtx = { register: (fn: (() => void) | null) => void; tried: () => void };
const TryContext = createContext<TryCtx>({ register: () => {}, tried: () => {} });

/** A scene registers its main tap-to-try action. VoiceOver's double tap on the
 *  scene runs it, and any tap in the scene hides the "Tap ..." nudge. */
export function useTryAction(fn: () => void) {
  const { register } = useContext(TryContext);
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    register(() => ref.current());
    return () => register(null);
  }, [register]);
}

/** Call from a scene's own tap handlers. Light haptic plus hides the nudge. */
export function useTried(): () => void {
  const { tried } = useContext(TryContext);
  return useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    tried();
  }, [tried]);
}

// ---------------------------------------------------------------- scene box

export function SceneBox({
  children,
  label,
  tryIt,
  tryHint,
  active,
  reduced,
}: {
  children: ReactNode;
  label: string;
  tryIt?: string;
  tryHint: string;
  active: boolean;
  reduced: boolean;
}) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [tried, setTried] = useState(false);
  const action = useRef<(() => void) | null>(null);
  const ctx = useMemo<TryCtx>(
    () => ({
      register: (fn) => {
        action.current = fn;
      },
      tried: () => setTried(true),
    }),
    []
  );
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((b) => (b && Math.abs(b.w - width) < 1 && Math.abs(b.h - height) < 1 ? b : { w: width, h: height }));
  }, []);
  // At the largest text sizes on a 6.1 inch phone the step's words leave the
  // scene less room than the canvas at half size plus the "Tap ..." pill, and
  // the pill used to spill over the step label below. The scene now shrinks
  // further, the pill gives up its room first, and nothing draws outside
  // the box (VoiceOver keeps the try action either way).
  const hint = !!tryIt && !!box && (box.h - 44) / CANVAS_H >= 0.4;
  const hintRoom = hint ? 44 : 0;
  const scale = box ? Math.max(0.25, Math.min((box.h - hintRoom) / CANVAS_H, box.w / CANVAS_W, 1.3)) : 0;
  const run = () => {
    action.current?.();
    setTried(true);
  };
  return (
    <View
      style={styles.box}
      onLayout={onLayout}
      accessible
      accessibilityLabel={label}
      accessibilityRole={tryIt ? "button" : "image"}
      accessibilityHint={tryIt ? tryHint : undefined}
      accessibilityActions={tryIt ? [{ name: "activate" }] : undefined}
      onAccessibilityAction={tryIt ? (e) => e.nativeEvent.actionName === "activate" && run() : undefined}
      onAccessibilityTap={tryIt ? run : undefined}
    >
      {box ? (
        <TryContext.Provider value={ctx}>
          <View style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: CANVAS_W, height: CANVAS_H, overflow: "hidden", transform: [{ scale }] }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              {children}
            </View>
          </View>
          {tryIt && hint ? <TryNudge label={tryIt} visible={!tried} active={active} reduced={reduced} /> : null}
        </TryContext.Provider>
      ) : null}
    </View>
  );
}

/** "Tap ..." pill under a scene with a slow breathing ring. */
function TryNudge({ label, visible, active, reduced }: { label: string; visible: boolean; active: boolean; reduced: boolean }) {
  const shown = useSharedValue(visible ? 1 : 0);
  const ring = useSharedValue(0);
  useEffect(() => {
    shown.set(withTiming(visible ? 1 : 0, { duration: reduced ? 0 : 260 }));
  }, [visible, reduced, shown]);
  useEffect(() => {
    if (!active || !visible || reduced) {
      cancelAnimation(ring);
      ring.set(0);
      return;
    }
    ring.set(withDelay(900, withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false)));
    return () => cancelAnimation(ring);
  }, [active, visible, reduced, ring]);
  const pill = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateY: (1 - shown.get()) * 6 }] }));
  const halo = useAnimatedStyle(() => ({ opacity: (1 - ring.get()) * 0.55, transform: [{ scale: 1 + ring.get() * 0.9 }] }));
  return (
    <Animated.View style={[styles.nudgeWrap, pill]} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={styles.nudge}>
        <View style={styles.dotWrap}>
          <Animated.View style={[styles.halo, halo]} />
          <View style={styles.dot} />
        </View>
        <T v="meta13" color={colors.goldLight} maxFontSizeMultiplier={1.1} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flexShrink: 1 }}>
          {label}
        </T>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------- text + chrome

/** Text inside a scene: a picture, so it does not follow Dynamic Type (the
 *  scene's description is what VoiceOver reads, and the canvas scales). */
export function ST({ children, v = "meta13", color = colors.ivory, style, lines = 2, center, size }: { children: ReactNode; v?: "meta13" | "body15" | "body16" | "label11" | "name24" | "title26" | "title30"; color?: string; style?: StyleProp<TextStyle>; lines?: number; center?: boolean; size?: number }) {
  return (
    <T v={v} color={color} size={size} maxFontSizeMultiplier={1} numberOfLines={lines} center={center} style={style}>
      {children}
    </T>
  );
}

/** A status badge. It keeps to its own width; inside a row it centres on the
 *  row; `start` keeps it at the leading edge of a column. */
export function Pill({ label, kind = "mute", icon, dot, start }: { label: string; kind?: "green" | "amber" | "gold" | "mute" | "red"; icon?: IconName; dot?: boolean; start?: boolean }) {
  const map = {
    green: { fg: colors.greenText, bg: "rgba(5,150,105,0.16)", border: "rgba(52,211,153,0.34)" },
    amber: { fg: colors.amber, bg: "rgba(245,158,11,0.14)", border: "rgba(245,158,11,0.32)" },
    gold: { fg: colors.goldLight, bg: "rgba(201,169,110,0.14)", border: "rgba(201,169,110,0.38)" },
    mute: { fg: colors.ivory55, bg: "rgba(247,243,236,0.06)", border: colors.ivory14 },
    red: { fg: colors.red, bg: "rgba(220,38,38,0.14)", border: "rgba(240,162,162,0.3)" },
  }[kind];
  return (
    <View style={[styles.pill, start && { alignSelf: "flex-start" }, { backgroundColor: map.bg, borderColor: map.border }]}>
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: kind === "green" ? colors.green : map.fg }} /> : null}
      {icon ? <Icon name={icon} size={13} color={map.fg} strokeWidth={2} /> : null}
      <T v="label11" color={map.fg} maxFontSizeMultiplier={1} numberOfLines={1} style={{ letterSpacing: 0.8 }}>
        {label}
      </T>
    </View>
  );
}

export function Initials({ text, size = 34, gold }: { text: string; size?: number; gold?: boolean }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: gold ? colors.gold : colors.navy, borderWidth: 1, borderColor: colors.goldBorder, alignItems: "center", justifyContent: "center" }}>
      <T v="body15" size={Math.max(16, Math.round(size * 0.44))} color={gold ? colors.night : colors.goldLight} maxFontSizeMultiplier={1} style={{ fontFamily: fonts.displaySemibold }}>
        {text}
      </T>
    </View>
  );
}

/** A tappable spot inside a scene. The whole scene is one VoiceOver element,
 *  so these are hidden from it and only serve touch. */
export function Tap({ onPress, children, style, hitSlop = 6 }: { onPress: () => void; children: ReactNode; style?: StyleProp<ViewStyle>; hitSlop?: number }) {
  return (
    <Pressable onPress={onPress} hitSlop={hitSlop} style={({ pressed }) => [style, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}>
      {children}
    </Pressable>
  );
}

/** A chat bubble. `me` is the person using the app (gold), otherwise the other
 *  side (glass). */
export function Bubble({ text, me, style, maxWidth = 236 }: { text: string; me?: boolean; style?: StyleProp<ViewStyle>; maxWidth?: number }) {
  return (
    <View style={[styles.bubble, me ? styles.bubbleMe : styles.bubbleThem, { maxWidth }, style]}>
      <ST v="body15" size={16} color={me ? colors.night : colors.ivory90} lines={4}>
        {text}
      </ST>
    </View>
  );
}

/** Three dots that breathe while the other side is "typing". */
export function TypingDots({ reduced, style }: { reduced: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.bubble, styles.bubbleThem, styles.typing, style]}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} i={i} reduced={reduced} />
      ))}
    </View>
  );
}

function Dot({ i, reduced }: { i: number; reduced: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.set(withDelay(i * 150, withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0, { duration: 320 })), -1, false)));
    return () => cancelAnimation(t);
  }, [i, reduced, t]);
  const s = useAnimatedStyle(() => ({ opacity: 0.35 + t.get() * 0.65, transform: [{ translateY: -t.get() * 3 }] }));
  return <Animated.View style={[styles.typingDot, s]} />;
}

/** A small rotated square, the brand gem. */
export function Gemlet({ size = 7, color = colors.gold, style }: { size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width: size, height: size, backgroundColor: color, transform: [{ rotate: "45deg" }] }, style]} />;
}

/** A fake button inside a scene, drawn like the kit's Button. */
export function FakeButton({ label, kind = "primary", icon, small = true, style }: { label: string; kind?: "primary" | "glass" | "ghost"; icon?: IconName; small?: boolean; style?: StyleProp<ViewStyle> }) {
  const fg = kind === "primary" ? colors.night : colors.ivory;
  return (
    <View style={[styles.fakeBtn, { height: small ? 40 : 48, backgroundColor: kind === "primary" ? colors.gold : kind === "glass" ? colors.glassFill : "transparent", borderColor: kind === "primary" ? colors.gold : colors.ivory14 }, style]}>
      {icon ? <Icon name={icon} size={16} color={fg} strokeWidth={1.8} /> : null}
      <T v="button17" size={16} color={fg} maxFontSizeMultiplier={1} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {label}
      </T>
    </View>
  );
}

/** One pending timeout per scene, cleared on unmount and when replaced. */
export class SceneTimer {
  private t: ReturnType<typeof setTimeout> | null = null;
  set(fn: () => void, ms: number) {
    this.clear();
    this.t = setTimeout(() => {
      this.t = null;
      fn();
    }, ms);
  }
  clear() {
    if (this.t) clearTimeout(this.t);
    this.t = null;
  }
}

export function useTimer(): SceneTimer {
  const [timer] = useState(() => new SceneTimer());
  useEffect(() => () => timer.clear(), [timer]);
  return timer;
}

/** A timer that only runs while the page is active; cleared on change. */
export function useBeat(active: boolean, ms: number, fn: () => void, deps: unknown[] = []) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => ref.current(), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ms, ...deps]);
}

export const sceneStyles = StyleSheet.create({
  card: { borderRadius: radius.card, backgroundColor: "rgba(13,17,23,0.72)", borderWidth: 1, borderColor: colors.ivory14, padding: 14 },
  paper: { borderRadius: radius.card, backgroundColor: colors.cream, padding: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
});

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  nudgeWrap: { height: 44, justifyContent: "flex-end", alignItems: "center", maxWidth: "100%" },
  nudge: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, height: 34, borderRadius: 17, borderWidth: 1, borderColor: "rgba(201,169,110,0.4)", backgroundColor: "rgba(201,169,110,0.08)", maxWidth: "100%" },
  dotWrap: { width: 10, height: 10, alignItems: "center", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.goldLight },
  halo: { position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: colors.goldLight },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3, alignSelf: "auto", maxWidth: "100%" },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMe: { backgroundColor: colors.gold, alignSelf: "flex-end", borderBottomRightRadius: 6 },
  bubbleThem: { backgroundColor: "rgba(247,243,236,0.08)", borderWidth: 1, borderColor: colors.ivory14, alignSelf: "flex-start", borderBottomLeftRadius: 6 },
  typing: { flexDirection: "row", gap: 5, paddingVertical: 14 },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.ivory70 },
  fakeBtn: { borderRadius: 24, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 16 },
});

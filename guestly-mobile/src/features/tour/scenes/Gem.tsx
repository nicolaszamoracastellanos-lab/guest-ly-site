// The last step's celebration: the brand gem assembles from its four facets,
// then bursts into small gems. With Reduce Motion it is simply there, calm.

import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Polygon, RadialGradient, Stop } from "react-native-svg";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors } from "@/ui/tokens";
import { CANVAS_H, CANVAS_W, useBeat, type SceneProps } from "./kit";

const G = 120; // gem box
const H = G / 2;
const CX = CANVAS_W / 2;
const CY = CANVAS_H / 2 - 4;

// Facets: points in the gem box, the direction they fly in from, and a shade.
const FACETS = [
  { pts: `${H},${H} 0,${H} ${H},0`, dx: -1, dy: -1, color: colors.goldLight, rot: -38 },
  { pts: `${H},${H} ${H},0 ${G},${H}`, dx: 1, dy: -1, color: colors.gold, rot: 32 },
  { pts: `${H},${H} ${G},${H} ${H},${G}`, dx: 1, dy: 1, color: colors.goldDim, rot: -28 },
  { pts: `${H},${H} ${H},${G} 0,${H}`, dx: -1, dy: 1, color: "#a8864f", rot: 42 },
] as const;

// Particles: fixed, hand-spread angles and distances so every run looks the same.
const PARTICLES = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2 + (i % 2 ? 0.14 : -0.1);
  const dist = 96 + ((i * 37) % 5) * 11;
  const size = 5 + ((i * 13) % 4);
  const tone = i % 3 === 0 ? colors.goldLight : i % 3 === 1 ? colors.gold : colors.ivory70;
  return { angle, dist, size, tone, delay: (i % 4) * 18 };
});

export function GemScene({ active, reduced, burst = true }: SceneProps & { burst?: boolean }) {
  const t = useSharedValue(reduced ? 1 : 0); // facets assembled
  const b = useSharedValue(0); // burst progress
  const float = useSharedValue(0);
  const glow = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      t.set(1);
      glow.set(1);
      b.set(0);
      float.set(0);
      return;
    }
    if (!active) {
      cancelAnimation(float);
      t.set(0);
      b.set(0);
      glow.set(0);
      float.set(0);
      return;
    }
    t.set(withDelay(120, withSpring(1, { damping: 14, stiffness: 120, mass: 0.9 })));
    glow.set(withDelay(420, withTiming(1, { duration: 700 })));
    if (burst) b.set(withDelay(640, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })));
    float.set(withDelay(1300, withRepeat(withSequence(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) })), -1, false)));
    return () => cancelAnimation(float);
  }, [active, reduced, burst, t, b, float, glow]);

  useBeat(active && burst, reduced ? 250 : 660, () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  });

  const gemStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -4 * float.get() }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() * 0.9, transform: [{ scale: 0.7 + glow.get() * 0.3 + float.get() * 0.04 }] }));
  const ringStyle = useAnimatedStyle(() => {
    const v = b.get();
    return { opacity: v > 0 && v < 1 ? (1 - v) * 0.8 : 0, transform: [{ scale: 0.5 + v * 1.9 }] };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.glow, glowStyle]}>
        <Svg width={240} height={240}>
          <Defs>
            <RadialGradient id="tourGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.goldLight} stopOpacity={0.34} />
              <Stop offset="0.45" stopColor={colors.gold} stopOpacity={0.12} />
              <Stop offset="1" stopColor={colors.gold} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={120} cy={120} r={120} fill="url(#tourGlow)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.ring, ringStyle]} />
      {burst ? PARTICLES.map((p, i) => <Particle key={i} p={p} b={b} />) : null}
      <Animated.View style={[styles.gem, gemStyle]}>
        {FACETS.map((f, i) => (
          <Facet key={i} f={f} i={i} t={t} />
        ))}
      </Animated.View>
    </View>
  );
}

function Facet({ f, i, t }: { f: (typeof FACETS)[number]; i: number; t: SharedValue<number> }) {
  const s = useAnimatedStyle(() => {
    // Each facet lags a little behind the one before it.
    const v = Math.min(1, Math.max(0, t.get() * 1.25 - i * 0.06));
    const away = 1 - v;
    return {
      opacity: Math.min(1, v * 1.6),
      transform: [{ translateX: f.dx * 70 * away }, { translateY: f.dy * 70 * away }, { rotate: `${f.rot * away}deg` }, { scale: 0.7 + v * 0.3 }],
    };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, s]}>
      <Svg width={G} height={G} viewBox={`0 0 ${G} ${G}`}>
        <Polygon points={f.pts} fill={f.color} />
      </Svg>
    </Animated.View>
  );
}

function Particle({ p, b }: { p: (typeof PARTICLES)[number]; b: SharedValue<number> }) {
  const s = useAnimatedStyle(() => {
    const v = b.get();
    const d = p.dist * v;
    return {
      opacity: v <= 0 || v >= 1 ? 0 : v < 0.2 ? v * 5 : 1 - (v - 0.2) / 0.8,
      transform: [{ translateX: Math.cos(p.angle) * d }, { translateY: Math.sin(p.angle) * d }, { rotate: `${45 + v * 90}deg` }, { scale: 1 - v * 0.4 }],
    };
  });
  return <Animated.View style={[styles.particle, { width: p.size, height: p.size, marginLeft: -p.size / 2, marginTop: -p.size / 2, backgroundColor: p.tone }, s]} />;
}

const styles = StyleSheet.create({
  gem: { position: "absolute", left: CX - H, top: CY - H, width: G, height: G },
  glow: { position: "absolute", left: CX - 120, top: CY - 120, width: 240, height: 240 },
  ring: { position: "absolute", left: CX - 70, top: CY - 70, width: 140, height: 140, borderRadius: 70, borderWidth: 1.5, borderColor: colors.goldLight },
  particle: { position: "absolute", left: CX, top: CY },
});

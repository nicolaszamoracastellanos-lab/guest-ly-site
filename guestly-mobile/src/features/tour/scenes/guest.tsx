// Guest tour scenes: RSVP cards that flip, an event that drops into the
// calendar, a concierge that answers, and the day-of route.

import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import Animated, { Easing, FadeIn, FadeInDown, FadeInUp, FadeOut, cancelAnimation, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useCopy } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { Icon } from "@/ui/Icon";
import { colors, fonts, radius } from "@/ui/tokens";
import { TOUR_COPY } from "../copy";
import { Bubble, FakeButton, Gemlet, Pill, ST, Tap, TypingDots, sceneStyles, useTimer, useTried, useTryAction, type SceneProps } from "./kit";

// ---------------------------------------------------------------- RSVP

export function RsvpScene({ reduced }: SceneProps) {
  const app = useCopy();
  const demo = useFeatureCopy(TOUR_COPY).demo;
  const tried = useTried();
  const [flipped, setFlipped] = useState([false, false]);
  const flip = (i: number) => {
    tried();
    setFlipped((f) => f.map((v, j) => (j === i ? !v : v)));
  };
  useTryAction(() => {
    const i = flipped.indexOf(false);
    flip(i === -1 ? 0 : i);
  });
  const people = [app.rsvp.you, app.rsvp.partyMember];
  return (
    <View style={styles.rsvpRow}>
      {people.map((who, i) => (
        <Tap key={who} onPress={() => flip(i)} style={{ flex: 1 }}>
          <FlipCard
            flipped={flipped[i]}
            reduced={reduced}
            front={
              <RsvpFace who={who} gemColor={colors.ivory40}>
                <EventLine label={demo.ceremony} />
                <EventLine label={demo.reception} />
                <View style={{ marginTop: "auto" }}>
                  <Pill label={app.guestHome.awaiting} kind="amber" dot start />
                </View>
              </RsvpFace>
            }
            back={
              <RsvpFace who={who} gemColor={colors.gold} on>
                <EventLine label={demo.ceremony} on />
                <EventLine label={demo.reception} on />
                <View style={{ marginTop: "auto" }}>
                  <Pill label={app.guestHome.attending} kind="green" dot start />
                </View>
              </RsvpFace>
            }
          />
        </Tap>
      ))}
    </View>
  );
}

function RsvpFace({ who, children, gemColor, on }: { who: string; children: React.ReactNode; gemColor: string; on?: boolean }) {
  return (
    <View style={[styles.face, on && styles.faceOn]}>
      <View style={sceneStyles.row}>
        <Gemlet size={7} color={gemColor} />
        <ST v="label11" color={on ? colors.goldLight : colors.ivory70} lines={2} style={{ flexShrink: 1, letterSpacing: 1 }}>
          {who}
        </ST>
      </View>
      <View style={[styles.avatar, on && { backgroundColor: colors.gold, borderColor: colors.gold }]}>
        {on ? <Icon name="check" size={26} color={colors.night} strokeWidth={2.4} /> : <Gemlet size={12} color={colors.goldDim} />}
      </View>
      {children}
    </View>
  );
}

function EventLine({ label, on }: { label: string; on?: boolean }) {
  return (
    <View style={[sceneStyles.row, { gap: 8, marginTop: 8 }]}>
      <View style={[styles.box, on && styles.boxOn]}>{on ? <Icon name="check" size={12} color={colors.night} strokeWidth={2.6} /> : null}</View>
      <ST v="meta13" color={on ? colors.ivory : colors.ivory70} lines={1} style={{ flexShrink: 1 }}>
        {label}
      </ST>
    </View>
  );
}

function FlipCard({ flipped, reduced, front, back }: { flipped: boolean; reduced: boolean; front: React.ReactNode; back: React.ReactNode }) {
  const f = useSharedValue(flipped ? 1 : 0);
  useEffect(() => {
    f.set(reduced ? withTiming(flipped ? 1 : 0, { duration: 160 }) : withSpring(flipped ? 1 : 0, { damping: 15, stiffness: 150, mass: 0.8 }));
  }, [flipped, reduced, f]);
  const frontStyle = useAnimatedStyle(() => {
    const v = f.get();
    if (reduced) return { opacity: 1 - v, transform: [] };
    return { opacity: v < 0.5 ? 1 : 0, transform: [{ perspective: 900 }, { rotateY: `${v * 180}deg` }, { scale: 1 - Math.sin(v * Math.PI) * 0.06 }] };
  });
  const backStyle = useAnimatedStyle(() => {
    const v = f.get();
    if (reduced) return { opacity: v, transform: [] };
    return { opacity: v >= 0.5 ? 1 : 0, transform: [{ perspective: 900 }, { rotateY: `${v * 180 - 180}deg` }, { scale: 1 - Math.sin(v * Math.PI) * 0.06 }] };
  });
  return (
    <View style={{ height: 232 }}>
      <Animated.View style={[StyleSheet.absoluteFill, frontStyle]}>{front}</Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, backStyle]}>{back}</Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------- calendar

export function CalendarScene({ active, reduced }: SceneProps) {
  const app = useCopy();
  const demo = useFeatureCopy(TOUR_COPY).demo;
  const tried = useTried();
  const [added, setAdded] = useState(false);
  const fly = useSharedValue(0);
  const pop = useSharedValue(added ? 1 : 0);

  const run = () => {
    tried();
    if (added) {
      setAdded(false);
      fly.set(0);
      pop.set(withTiming(0, { duration: 180 }));
      return;
    }
    setAdded(true);
    if (reduced) {
      pop.set(1);
      return;
    }
    fly.set(0);
    fly.set(withTiming(1, { duration: 620, easing: Easing.inOut(Easing.cubic) }));
    pop.set(withDelay(560, withSpring(1, { damping: 9, stiffness: 180 })));
  };
  useTryAction(run);

  // Leaving the step resets it, so coming back plays it again.
  useEffect(() => {
    if (active) return;
    const t = setTimeout(() => {
      setAdded(false);
      fly.set(0);
      pop.set(0);
    }, 0);
    return () => clearTimeout(t);
  }, [active, fly, pop]);

  const chip = useAnimatedStyle(() => {
    const v = fly.get();
    // From the button's centre (160, 246) to the tile's centre (260, 70).
    const x = 100 * v;
    const y = -176 * v + Math.sin(v * Math.PI) * -36;
    return { opacity: v > 0 && v < 1 ? 1 : 0, transform: [{ translateX: x }, { translateY: y }, { scale: 1 - v * 0.55 }] };
  });
  const tile = useAnimatedStyle(() => ({ transform: [{ scale: 1 + Math.sin(Math.min(pop.get(), 1) * Math.PI) * 0.1 }] }));
  const check = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.get()), transform: [{ scale: pop.get() }] }));
  const bar = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.get()), transform: [{ scaleX: Math.min(1, pop.get()) }] }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[sceneStyles.row, { position: "absolute", left: 6, top: 30, width: 170 }]}>
        <Gemlet />
        <ST v="label11" color={colors.goldLight} lines={2} style={{ flexShrink: 1 }}>
          {app.schedule.title}
        </ST>
      </View>
      <ST v="title26" size={30} color={colors.ivory} lines={2} style={{ position: "absolute", left: 6, top: 54, width: 170 }}>
        {app.schedule.addAll}
      </ST>
      <Animated.View style={[styles.tile, tile]}>
        <View style={styles.tileBand}>
          <View style={styles.ringHole} />
          <View style={styles.ringHole} />
        </View>
        <ST v="title30" size={40} color={colors.ink} center lines={1} style={{ marginTop: 4, fontVariant: ["lining-nums"] }}>
          {demo.day}
        </ST>
        <Animated.View style={[styles.tileBar, bar]} />
        <Animated.View style={[styles.tileCheck, check]}>
          <Icon name="check" size={14} color={colors.night} strokeWidth={2.8} />
        </Animated.View>
      </Animated.View>

      <View style={[sceneStyles.card, styles.eventCard]}>
        <View style={sceneStyles.row}>
          <Icon name="clock" size={18} color={colors.goldLight} />
          <ST v="body16" color={colors.ivory} lines={1} style={{ flexShrink: 1 }}>
            {demo.ceremonyTime}
          </ST>
        </View>
        <View style={[sceneStyles.row, { marginTop: 6 }]}>
          <Icon name="pin" size={18} color={colors.ivory55} />
          <ST v="meta13" color={colors.ivory70} lines={1}>
            {demo.garden}
          </ST>
        </View>
        <Tap onPress={run} style={{ marginTop: 14 }}>
          <FakeButton label={added ? demo.added : app.rsvp.addCalendar} icon={added ? "check" : "calendar-plus"} kind={added ? "glass" : "primary"} />
        </Tap>
      </View>
      <Animated.View style={[styles.flyChip, chip]} pointerEvents="none">
        <Icon name="calendar" size={14} color={colors.night} strokeWidth={2} />
        <View style={{ width: 30, height: 4, borderRadius: 2, backgroundColor: "rgba(13,17,23,0.5)" }} />
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------- concierge

export function ConciergeScene({ reduced }: SceneProps) {
  const app = useCopy();
  const demo = useFeatureCopy(TOUR_COPY).demo;
  const tried = useTried();
  const [sel, setSel] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const timer = useTimer();
  const qa = [
    { chip: app.concierge.chips.dressCode, q: demo.q1, a: demo.a1 },
    { chip: app.concierge.chips.hotels, q: demo.q2, a: demo.a2 },
    { chip: app.concierge.chips.gifts, q: demo.q3, a: demo.a3 },
  ];
  const ask = (i: number) => {
    tried();
    setSel(i);
    setAnswered(false);
    timer.set(() => setAnswered(true), reduced ? 250 : 950);
  };
  useTryAction(() => ask(sel === null ? 0 : (sel + 1) % qa.length));
  const enter = reduced ? FadeIn.duration(1) : FadeInDown.springify().damping(16).stiffness(170);

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[sceneStyles.row, { marginBottom: 12 }]}>
        <View style={styles.sparkle}>
          <Icon name="sparkle" size={16} color={colors.night} strokeWidth={1.9} />
        </View>
        <ST v="body16" color={colors.ivory} lines={1}>
          {app.concierge.title}
        </ST>
      </View>
      <View style={{ height: 176, gap: 10 }}>
        {sel === null ? (
          <Animated.View key="hello" entering={enter} exiting={FadeOut.duration(140)}>
            <Bubble text={demo.hello} />
          </Animated.View>
        ) : (
          <View key={`q${sel}`} style={{ gap: 10 }}>
            <Animated.View entering={reduced ? FadeIn.duration(1) : FadeInUp.springify().damping(16).stiffness(170)}>
              <Bubble text={qa[sel].q} me maxWidth={220} />
            </Animated.View>
            {answered ? (
              <Animated.View key="a" entering={enter}>
                <Bubble text={qa[sel].a} maxWidth={262} />
              </Animated.View>
            ) : (
              <Animated.View key="t" entering={FadeIn.duration(reduced ? 1 : 160)} exiting={FadeOut.duration(100)}>
                <TypingDots reduced={reduced} />
              </Animated.View>
            )}
          </View>
        )}
      </View>
      <View style={styles.chips}>
        {qa.map((x, i) => (
          <Tap key={x.chip} onPress={() => ask(i)}>
            <View style={[styles.chip, sel === i && styles.chipOn]}>
              <ST v="meta13" color={sel === i ? colors.goldLight : colors.ivory70} lines={1} style={{ fontFamily: fonts.bodyMedium }}>
                {x.chip}
              </ST>
            </View>
          </Tap>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- day-of

const AnimatedPath = Animated.createAnimatedComponent(Path);
const ROUTE = "M44 132 C 92 136, 96 92, 150 92 S 222 72, 262 64";
const ROUTE_LEN = 270;

export function DayOfScene({ active, reduced }: SceneProps) {
  const app = useCopy();
  const demo = useFeatureCopy(TOUR_COPY).demo;
  const draw = useSharedValue(reduced ? 1 : 0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      draw.set(1);
      return;
    }
    if (!active) {
      cancelAnimation(pulse);
      draw.set(0);
      pulse.set(0);
      return;
    }
    draw.set(withDelay(200, withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.cubic) })));
    pulse.set(withDelay(1300, withRepeat(withSequence(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 })), -1, false)));
    return () => cancelAnimation(pulse);
  }, [active, reduced, draw, pulse]);
  const routeProps = useAnimatedProps(() => ({ strokeDashoffset: ROUTE_LEN * (1 - draw.get()) }));
  const halo = useAnimatedStyle(() => ({ opacity: (1 - pulse.get()) * 0.6, transform: [{ scale: 0.6 + pulse.get() * 1.4 }] }));
  const pin = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, draw.get() * 4 - 3)), transform: [{ translateY: (1 - Math.min(1, Math.max(0, draw.get() * 4 - 3))) * -10 }] }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.map}>
        <Svg width={320} height={122} viewBox="0 26 320 122">
          <Rect x={0} y={0} width={320} height={176} fill="#131b2b" />
          <Path d="M188 0 C 200 40, 236 64, 320 70 L320 0 Z" fill="rgba(52,211,153,0.07)" />
          <Path d="M0 60 L320 32 M0 150 L320 118 M70 0 L110 176 M200 0 L236 176 M0 104 L320 84" stroke={colors.ivory09} strokeWidth={6} fill="none" />
          <Path d="M0 60 L320 32 M0 150 L320 118 M70 0 L110 176 M200 0 L236 176 M0 104 L320 84" stroke="rgba(247,243,236,0.05)" strokeWidth={1} fill="none" />
          <AnimatedPath d={ROUTE} stroke={colors.goldLight} strokeWidth={4} strokeLinecap="round" fill="none" strokeDasharray={`${ROUTE_LEN} ${ROUTE_LEN}`} animatedProps={routeProps} />
          <Circle cx={44} cy={132} r={7} fill={colors.ivory} />
          <Circle cx={44} cy={132} r={12} fill="none" stroke="rgba(247,243,236,0.35)" strokeWidth={2} />
        </Svg>
        <Animated.View style={[styles.halo, halo]} />
        <Animated.View style={[styles.pin, pin]}>
          <Icon name="pin" size={30} color={colors.goldLight} strokeWidth={2} />
        </Animated.View>
      </View>
      <View style={[sceneStyles.card, styles.nowCard]}>
        <View style={[sceneStyles.row, { justifyContent: "space-between" }]}>
          <ST v="label11" color={colors.goldLight} lines={1}>
            {app.dayof.rightNow}
          </ST>
          <Pill label={app.dayof.openMaps} kind="gold" icon="map" />
        </View>
        <ST v="name24" size={24} color={colors.ivory} lines={1} style={{ marginTop: 6 }}>
          {demo.headTo}
        </ST>
        <View style={{ marginTop: 6, gap: 4 }}>
          <View style={[sceneStyles.row, { gap: 5 }]}>
            <Icon name="clock" size={14} color={colors.ivory55} />
            <ST v="meta13" color={colors.ivory70} lines={1}>
              {demo.inMinutes}
            </ST>
          </View>
          <View style={[sceneStyles.row, { gap: 5 }]}>
            <Icon name="bus" size={14} color={colors.ivory55} />
            <ST v="meta13" color={colors.ivory70} lines={1} style={{ flexShrink: 1 }}>
              {demo.shuttleAt}
            </ST>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rsvpRow: { flexDirection: "row", gap: 16, paddingTop: 20 },
  face: { flex: 1, borderRadius: radius.card, padding: 14, backgroundColor: "rgba(13,17,23,0.78)", borderWidth: 1, borderColor: colors.ivory14, backfaceVisibility: "hidden" },
  faceOn: { borderColor: "rgba(52,211,153,0.4)", backgroundColor: "rgba(10,28,26,0.9)" },
  avatar: { width: 54, height: 54, borderRadius: 27, alignSelf: "center", marginVertical: 14, backgroundColor: colors.navy, borderWidth: 1, borderColor: colors.goldBorder, alignItems: "center", justifyContent: "center" },
  box: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: colors.ivory25, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: colors.green, borderColor: colors.green },
  tile: { position: "absolute", right: 8, top: 14, width: 104, height: 112, borderRadius: 18, backgroundColor: colors.cream, overflow: "visible", shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } },
  tileBand: { height: 26, borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: colors.gold, flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingHorizontal: 22 },
  ringHole: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.cream },
  tileBar: { position: "absolute", left: 16, right: 16, bottom: 14, height: 8, borderRadius: 4, backgroundColor: colors.gold, transformOrigin: "left" },
  tileCheck: { position: "absolute", right: -8, top: -8, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.night },
  eventCard: { position: "absolute", left: 0, right: 0, bottom: 0 },
  flyChip: { position: "absolute", left: 160 - 38, top: 246 - 13, width: 76, height: 26, borderRadius: 13, backgroundColor: colors.goldLight, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  sparkle: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  chips: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: radius.pill, paddingHorizontal: 12, height: 34, justifyContent: "center", borderWidth: 1, borderColor: colors.ivory14, backgroundColor: "rgba(247,243,236,0.04)" },
  chipOn: { borderColor: "rgba(201,169,110,0.55)", backgroundColor: "rgba(201,169,110,0.14)" },
  map: { height: 122, borderRadius: radius.card, overflow: "hidden", borderWidth: 1, borderColor: colors.ivory14 },
  halo: { position: "absolute", left: 262 - 22, top: 64 - 26 - 22, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(226,200,146,0.5)" },
  pin: { position: "absolute", left: 262 - 15, top: 64 - 26 - 28 },
  nowCard: { marginTop: 10, paddingVertical: 10 },
});

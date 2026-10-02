// Couple tour scenes: the briefing you clear, RSVPs that count themselves,
// a guest question you answer, the Coordinator's Confirm card, and the door.

import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, { Easing, FadeIn, FadeInDown, FadeInUp, FadeOut, LinearTransition, SlideOutRight, ZoomIn, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { fmt, useCopy } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { COPY as ASSISTANT_COPY } from "@/features/assistant/copy";
import { COPY as COUPLE_COPY } from "@/features/couple/copy";
import { Icon } from "@/ui/Icon";
import { colors, fonts, radius } from "@/ui/tokens";
import { TOUR_COPY } from "../copy";
import { Bubble, FakeButton, Gemlet, Initials, Pill, ST, Tap, TypingDots, sceneStyles, useBeat, useTimer, useTried, useTryAction, type SceneProps } from "./kit";

function useEnter(reduced: boolean) {
  return reduced ? FadeIn.duration(1) : FadeInDown.springify().damping(16).stiffness(170);
}

/** Resets scene state when its page stops being the current step. */
function useResetWhenInactive(active: boolean, reset: () => void) {
  const ref = useRef(reset);
  useEffect(() => {
    ref.current = reset;
  });
  useEffect(() => {
    if (active) return;
    const t = setTimeout(() => ref.current(), 0);
    return () => clearTimeout(t);
  }, [active]);
}

// ---------------------------------------------------------------- briefing

export function BriefingScene({ active, reduced }: SceneProps) {
  const app = useCopy();
  const cc = useFeatureCopy(COUPLE_COPY);
  const demo = useFeatureCopy(TOUR_COPY).demo;
  const tried = useTried();
  const all = [
    { id: "a", text: demo.brief1, tone: colors.amber },
    { id: "b", text: demo.brief2, tone: colors.gold },
    { id: "c", text: demo.brief3, tone: colors.amber },
  ];
  const [left, setLeft] = useState(all.map((r) => r.id));
  const [handling, setHandling] = useState<string | null>(null);
  const timer = useTimer();
  const handle = (id: string) => {
    if (handling) return;
    tried();
    setHandling(id);
    timer.set(() => {
      setLeft((l) => l.filter((x) => x !== id));
      setHandling(null);
    }, reduced ? 200 : 520);
  };
  const reset = () => {
    tried();
    setLeft(all.map((r) => r.id));
  };
  useTryAction(() => (left.length ? handle(left[0]) : reset()));
  useResetWhenInactive(active, () => {
    timer.clear();
    setLeft(all.map((r) => r.id));
    setHandling(null);
  });
  const layout = reduced ? undefined : LinearTransition.springify().damping(18).stiffness(170);

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Tile value="86" label={app.coupleHome.attending} />
        <Tile value={String(left.length)} label={app.coupleHome.needYou} color={colors.goldLight} reduced={reduced} />
      </View>
      <ST v="label11" color={colors.ivory55} lines={1} style={{ marginTop: 16, marginBottom: 4 }}>
        {cc.home.reminders}
      </ST>
      {left.length === 0 ? (
        <Animated.View entering={FadeIn.duration(reduced ? 1 : 300)}>
          <Tap onPress={reset}>
            <View style={[sceneStyles.row, { paddingVertical: 18 }]}>
              <View style={styles.okCircle}>
                <Icon name="check" size={16} color={colors.night} strokeWidth={2.6} />
              </View>
              <ST v="body16" color={colors.ivory70} style={{ flex: 1 }}>
                {app.coupleHome.briefingEmpty}
              </ST>
            </View>
          </Tap>
        </Animated.View>
      ) : (
        all
          .filter((r) => left.includes(r.id))
          .map((r) => (
            <Animated.View key={r.id} layout={layout} exiting={reduced ? FadeOut.duration(120) : SlideOutRight.duration(320)}>
              <Tap onPress={() => handle(r.id)}>
                <View style={styles.briefRow}>
                  {handling === r.id ? (
                    <Animated.View entering={ZoomIn.duration(reduced ? 1 : 220)} style={styles.okCircle}>
                      <Icon name="check" size={14} color={colors.night} strokeWidth={2.6} />
                    </Animated.View>
                  ) : (
                    <View style={{ width: 22, alignItems: "center" }}>
                      <Gemlet size={7} color={r.tone} />
                    </View>
                  )}
                  <ST v="body15" size={16} color={colors.ivory90} lines={2} style={{ flex: 1 }}>
                    {r.text}
                  </ST>
                  {handling === r.id ? <Pill label={demo.handled} kind="green" /> : <Icon name="chev" size={16} color={colors.ivory40} />}
                </View>
              </Tap>
            </Animated.View>
          ))
      )}
    </View>
  );
}

function Tile({ value, label, color = colors.ivory, reduced }: { value: string; label: string; color?: string; reduced?: boolean }) {
  return (
    <View style={styles.tile}>
      <Animated.View key={value} entering={reduced === undefined ? undefined : reduced ? FadeIn.duration(1) : FadeInUp.duration(260)}>
        <ST v="title30" size={30} color={color} lines={1} style={{ fontVariant: ["lining-nums"] }}>
          {value}
        </ST>
      </Animated.View>
      <ST v="meta13" color={colors.ivory55} lines={1}>
        {label}
      </ST>
    </View>
  );
}

// ---------------------------------------------------------------- RSVPs

export function RsvpsScene({ active, reduced }: SceneProps) {
  const app = useCopy();
  const demo = useFeatureCopy(TOUR_COPY).demo;
  const tried = useTried();
  const [recorded, setRecorded] = useState(false);
  const toggle = () => {
    tried();
    setRecorded((r) => !r);
  };
  useTryAction(toggle);
  useResetWhenInactive(active, () => setRecorded(false));
  const via = (k: keyof typeof app.rsvps.channelNames) => fmt(app.rsvps.via, { channel: app.rsvps.channelNames[k] });
  const layout = reduced ? undefined : LinearTransition.springify().damping(18).stiffness(170);

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Tile value={recorded ? "88" : "86"} label={app.rsvps.tiles.attending} color={colors.greenText} reduced={reduced} />
        <Tile value="9" label={app.rsvps.tiles.declined} />
        <Tile value={recorded ? "11" : "12"} label={app.rsvps.tiles.pending} color={colors.amber} reduced={reduced} />
      </View>
      <View style={{ marginTop: 10, height: 150, overflow: "hidden" }}>
        {recorded ? (
          <Animated.View key="new" entering={reduced ? FadeIn.duration(1) : FadeInUp.springify().damping(15).stiffness(160)} exiting={FadeOut.duration(140)}>
            <RsvpRow initials="TC" name={demo.newAnswer} sub={`${via("manual")} · ${demo.inPerson}`} pill={<Pill label={app.rsvps.filters.attending} kind="green" dot />} highlight />
          </Animated.View>
        ) : null}
        <Animated.View layout={layout}>
          <RsvpRow initials="LM" name={demo.lucia} sub={via("app")} pill={<Pill label={app.rsvps.filters.attending} kind="green" dot />} />
        </Animated.View>
        <Animated.View layout={layout}>
          <RsvpRow initials="AP" name={demo.ana} sub={via("whatsapp")} pill={<Pill label={app.rsvps.filters.pending} kind="amber" dot />} />
        </Animated.View>
      </View>
      <Tap onPress={toggle} style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
        <FakeButton label={app.rsvps.record} icon="plus" kind={recorded ? "glass" : "primary"} />
      </Tap>
    </View>
  );
}

function RsvpRow({ initials, name, sub, pill, highlight }: { initials: string; name: string; sub: string; pill: React.ReactNode; highlight?: boolean }) {
  return (
    <View style={[styles.rsvpRow, highlight && styles.rsvpRowOn]}>
      <Initials text={initials} size={34} gold={highlight} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <ST v="body15" size={16} color={colors.ivory} lines={1}>
          {name}
        </ST>
        <ST v="meta13" color={colors.ivory55} lines={1}>
          {sub}
        </ST>
      </View>
      {pill}
    </View>
  );
}

// ---------------------------------------------------------------- messages

export function MessagesScene({ active, reduced }: SceneProps) {
  const app = useCopy();
  const demo = useFeatureCopy(TOUR_COPY).demo;
  const tried = useTried();
  const [sent, setSent] = useState(false);
  const toggle = () => {
    tried();
    setSent((s) => !s);
  };
  useTryAction(toggle);
  useResetWhenInactive(active, () => setSent(false));
  const enter = useEnter(reduced);
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[sceneStyles.row, { gap: 8 }]}>
        {(["needs_you", "all", "whatsapp"] as const).map((k, i) => (
          <View key={k} style={[styles.chip, i === 0 && styles.chipOn]}>
            <ST v="meta13" color={i === 0 ? colors.goldLight : colors.ivory70} lines={1} style={{ fontFamily: fonts.bodyMedium }}>
              {app.inbox.filters[k]}
            </ST>
          </View>
        ))}
      </View>
      <View style={[sceneStyles.card, { marginTop: 12, gap: 10 }]}>
        <View style={sceneStyles.row}>
          <Initials text="MR" size={32} />
          <ST v="body15" size={16} color={colors.ivory} lines={1} style={{ flex: 1 }}>
            {demo.guestName}
          </ST>
          {sent ? (
            <Animated.View entering={ZoomIn.duration(reduced ? 1 : 220)}>
              <Pill label={app.common.doneLabel} kind="green" icon="check" />
            </Animated.View>
          ) : (
            <Pill label={app.inbox.filters.needs_you} kind="amber" dot />
          )}
        </View>
        <Bubble text={demo.guestQ} maxWidth={250} />
        {sent ? (
          <Animated.View entering={enter}>
            <Bubble text={demo.coupleA} me maxWidth={250} />
          </Animated.View>
        ) : (
          <Tap onPress={toggle}>
            <FakeButton label={app.inbox.reply} icon="chat" kind="primary" />
          </Tap>
        )}
      </View>
      {sent ? (
        <Animated.View entering={FadeIn.delay(reduced ? 0 : 220).duration(reduced ? 1 : 260)} style={{ marginTop: 8, paddingHorizontal: 4 }}>
          <Tap onPress={toggle}>
            <ST v="meta13" color={colors.greenText} lines={2}>
              {fmt(app.inbox.sent, { name: demo.guestName })}
            </ST>
          </Tap>
        </Animated.View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- Coordinator

export function CoordinatorScene({ active, reduced }: SceneProps) {
  const ac = useFeatureCopy(ASSISTANT_COPY);
  const demo = useFeatureCopy(TOUR_COPY).demo;
  const tried = useTried();
  const [shown, setShown] = useState(reduced);
  const [done, setDone] = useState(false);
  useBeat(active && !shown, 1000, () => setShown(true));
  useResetWhenInactive(active, () => {
    setShown(reduced);
    setDone(false);
  });
  const confirm = () => {
    tried();
    if (!shown) {
      setShown(true);
      return;
    }
    if (!done) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setDone((d) => !d);
  };
  useTryAction(confirm);
  const enter = useEnter(reduced);

  return (
    <View style={[StyleSheet.absoluteFill, { gap: 10 }]}>
      <Bubble text={demo.askWho} me maxWidth={250} />
      {shown ? (
        <Animated.View entering={enter} style={{ gap: 10 }}>
          <View style={[sceneStyles.row, { alignItems: "flex-end", gap: 8 }]}>
            <View style={styles.sparkle}>
              <Icon name="sparkle" size={15} color={colors.night} strokeWidth={1.9} />
            </View>
            <Bubble text={demo.coordA} maxWidth={250} />
          </View>
          <View style={[sceneStyles.card, done ? styles.cardDone : styles.cardWait, { padding: 12 }]}>
            <View style={[sceneStyles.row, { justifyContent: "space-between" }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <ST v="body15" size={16} color={colors.ivory} lines={1}>
                  {demo.cardTitle}
                </ST>
                <ST v="meta13" color={colors.ivory55} lines={1}>
                  {demo.cardSub}
                </ST>
              </View>
              {done ? (
                <Animated.View entering={ZoomIn.duration(reduced ? 1 : 240)}>
                  <Pill label={ac.statusExecuted} kind="green" icon="check" />
                </Animated.View>
              ) : null}
            </View>
            {done ? null : (
              <View style={[sceneStyles.row, { marginTop: 10, gap: 8 }]}>
                <Tap onPress={confirm} style={{ flex: 1 }}>
                  <FakeButton label={ac.confirm} kind="primary" />
                </Tap>
                <View style={{ flex: 1 }}>
                  <FakeButton label={ac.cancelCard} kind="ghost" />
                </View>
              </View>
            )}
          </View>
        </Animated.View>
      ) : active && !reduced ? (
        <Animated.View entering={FadeIn.duration(160)}>
          <TypingDots reduced={reduced} />
        </Animated.View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- check-in

export function CheckinScene({ active, reduced }: SceneProps) {
  const app = useCopy();
  const demo = useFeatureCopy(TOUR_COPY).demo;
  const tried = useTried();
  const [scanned, setScanned] = useState(false);
  const sweep = useSharedValue(0);
  const flash = useSharedValue(0);
  useEffect(() => {
    if (!active || scanned || reduced) {
      cancelAnimation(sweep);
      return;
    }
    sweep.set(withRepeat(withSequence(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.sin) })), -1, false));
    return () => cancelAnimation(sweep);
  }, [active, scanned, reduced, sweep]);
  useResetWhenInactive(active, () => setScanned(false));
  const scan = () => {
    tried();
    if (scanned) {
      setScanned(false);
      return;
    }
    setScanned(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (!reduced) flash.set(withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 420 })));
  };
  useTryAction(scan);
  const line = useAnimatedStyle(() => ({ opacity: scanned ? 0 : 1, transform: [{ translateY: 18 + sweep.get() * 134 }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() * 0.5 }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Tap onPress={scan}>
        <View style={styles.finder}>
          <Svg width={320} height={184} style={StyleSheet.absoluteFill}>
            <Path d="M14 44 V22 a8 8 0 0 1 8 -8 H44 M276 14 H298 a8 8 0 0 1 8 8 V44 M306 140 V162 a8 8 0 0 1 -8 8 H276 M44 170 H22 a8 8 0 0 1 -8 -8 V140" stroke={colors.goldLight} strokeWidth={3} fill="none" strokeLinecap="round" />
          </Svg>
          <View style={styles.pass}>
            <Icon name="qr" size={46} color={colors.ink} strokeWidth={1.8} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <ST v="body15" size={16} color={colors.ink} lines={2} style={{ fontFamily: fonts.bodyMedium }}>
                {demo.passName}
              </ST>
              <ST v="meta13" color={colors.muted} lines={1}>
                {demo.partyOf2}
              </ST>
            </View>
          </View>
          {reduced ? null : (
            <Animated.View style={[styles.scanLine, line]} pointerEvents="none">
              <LinearGradient colors={["rgba(226,200,146,0)", colors.goldLight, "rgba(226,200,146,0)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
            </Animated.View>
          )}
          <Animated.View style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} pointerEvents="none" />
          <View style={styles.offline} pointerEvents="none">
            <Pill label={app.checkin.worksOffline} kind="amber" icon="wifi-off" />
          </View>
        </View>
      </Tap>
      <View style={{ marginTop: 12, height: 96 }}>
        {scanned ? (
          <Animated.View key="done" entering={reduced ? FadeIn.duration(1) : FadeInUp.springify().damping(15).stiffness(170)} style={[sceneStyles.card, styles.result]}>
            <View style={styles.okCircleBig}>
              <Icon name="check" size={20} color={colors.night} strokeWidth={2.6} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <ST v="body15" size={17} color={colors.ivory} lines={1}>
                {app.checkin.scanned}
              </ST>
              <ST v="meta13" color={colors.ivory55} lines={1}>
                {`${demo.passName} · ${demo.partyOf2}`}
              </ST>
              <View style={{ marginTop: 4 }}>
                <Pill label={fmt(app.checkin.offlineQueued, { n: 1 })} kind="amber" icon="wifi-off" start />
              </View>
            </View>
          </Animated.View>
        ) : (
          <Animated.View key="count" entering={FadeIn.duration(reduced ? 1 : 200)} style={[sceneStyles.row, { justifyContent: "center", paddingTop: 22 }]}>
            <Icon name="qr" size={18} color={colors.goldLight} />
            <ST v="body15" size={16} color={colors.ivory70} lines={1}>
              {fmt(app.checkin.partiesIn, { n: 42, total: 120 })}
            </ST>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, borderRadius: radius.tile, padding: 10, paddingBottom: 8, backgroundColor: "rgba(13,17,23,0.72)", borderWidth: 1, borderColor: colors.ivory14, overflow: "hidden" },
  briefRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54, borderBottomWidth: 1, borderBottomColor: colors.ivory09, paddingVertical: 6 },
  okCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  okCircleBig: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  rsvpRow: { flexDirection: "row", alignItems: "center", gap: 10, height: 50, borderBottomWidth: 1, borderBottomColor: colors.ivory09, paddingHorizontal: 4 },
  rsvpRowOn: { backgroundColor: "rgba(201,169,110,0.1)", borderRadius: 12, borderBottomWidth: 0 },
  chip: { borderRadius: radius.pill, paddingHorizontal: 12, height: 32, justifyContent: "center", borderWidth: 1, borderColor: colors.ivory14 },
  chipOn: { borderColor: "rgba(201,169,110,0.55)", backgroundColor: "rgba(201,169,110,0.14)" },
  sparkle: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  cardWait: { borderColor: "rgba(201,169,110,0.45)" },
  cardDone: { borderColor: "rgba(52,211,153,0.45)" },
  finder: { height: 184, borderRadius: radius.card, backgroundColor: "#0a0e14", borderWidth: 1, borderColor: colors.ivory14, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  pass: { width: 212, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.cream, borderRadius: 16, padding: 14, marginTop: -22 },
  offline: { position: "absolute", left: 0, right: 0, bottom: 16, alignItems: "center" },
  scanLine: { position: "absolute", left: 24, right: 24, top: 0, height: 3 },
  flash: { backgroundColor: colors.green },
  result: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
});

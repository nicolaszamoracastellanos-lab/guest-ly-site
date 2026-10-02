// Planner tour scenes: switching weddings, a request the couple approves, the
// request list with its conversations, and the shared task board.

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, ZoomIn, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { fmt, plural, useCopy } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { COPY as TASKS_COPY } from "@/features/tasks/copy";
import { Icon, type IconName } from "@/ui/Icon";
import { colors, fonts, radius } from "@/ui/tokens";
import { TOUR_COPY } from "../copy";
import { Bubble, FakeButton, Initials, Pill, ST, Tap, sceneStyles, useTimer, useTried, useTryAction, type SceneProps } from "./kit";

const SPRING = { damping: 17, stiffness: 190, mass: 0.9 };

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

// ---------------------------------------------------------------- weddings

const ROW_H = 64;
const ROW_GAP = 10;

export function WeddingsScene({ active, reduced }: SceneProps) {
  const app = useCopy();
  const demo = useFeatureCopy(TOUR_COPY).demo;
  const tried = useTried();
  const [sel, setSel] = useState(0);
  const y = useSharedValue(0);
  useEffect(() => {
    const to = sel * (ROW_H + ROW_GAP);
    y.set(reduced ? withTiming(to, { duration: 1 }) : withSpring(to, SPRING));
  }, [sel, reduced, y]);
  useResetWhenInactive(active, () => setSel(0));
  const pick = (i: number) => {
    tried();
    void Haptics.selectionAsync().catch(() => {});
    setSel(i);
  };
  useTryAction(() => pick((sel + 1) % 3));
  const rows = [
    { names: demo.wedding1, initials: "CA", days: 45, open: 0 },
    { names: demo.wedding2, initials: "LT", days: 12, open: 2 },
    { names: demo.wedding3, initials: "VN", days: 88, open: 1 },
  ];
  const frame = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <View style={StyleSheet.absoluteFill}>
      <ST v="label11" color={colors.ivory55} lines={1} style={{ marginBottom: 10, marginTop: 10 }}>
        {app.planner.yourWeddings}
      </ST>
      <View>
        <Animated.View style={[styles.frame, frame]} pointerEvents="none" />
        {rows.map((r, i) => (
          <Tap key={r.names} onPress={() => pick(i)} style={{ marginBottom: ROW_GAP }}>
            <View style={styles.wRow}>
              <Initials text={r.initials} size={38} gold={i === sel} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <ST v="body15" size={17} color={colors.ivory} lines={1}>
                  {r.names}
                </ST>
                <ST v="meta13" color={i === sel ? colors.goldLight : colors.ivory55} lines={1}>
                  {i === sel ? `${app.planner.current} · ${r.days} ${app.common.days}` : fmt(demo.inDays, { n: r.days })}
                </ST>
              </View>
              <Pill label={plural(r.open, app.planner.open)} kind={r.open ? "amber" : "mute"} />
            </View>
          </Tap>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- propose

export function ProposeScene({ active, reduced }: SceneProps) {
  const app = useCopy();
  const demo = useFeatureCopy(TOUR_COPY).demo;
  const tried = useTried();
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const timer = useTimer();
  useResetWhenInactive(active, () => {
    timer.clear();
    setStage(0);
  });
  const send = () => {
    tried();
    timer.clear();
    if (stage !== 0) {
      setStage(0);
      return;
    }
    setStage(1);
    timer.set(() => {
      setStage(2);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, reduced ? 400 : 1300);
  };
  useTryAction(send);
  const kinds = ["plus_one", "edit_guest"] as const;
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[sceneStyles.card, { gap: 10 }, stage === 2 && { borderColor: "rgba(52,211,153,0.45)" }]}>
        <ST v="label11" color={colors.goldLight} lines={1}>
          {app.planner.newRequest}
        </ST>
        <View style={[sceneStyles.row, { gap: 6, flexWrap: "wrap" }]}>
          {kinds.map((k, i) => (
            <View key={k} style={[styles.chip, i === 0 && styles.chipOn]}>
              <ST v="meta13" color={i === 0 ? colors.goldLight : colors.ivory70} lines={1} style={{ fontFamily: fonts.bodyMedium }}>
                {app.planner.kinds[k]}
              </ST>
            </View>
          ))}
        </View>
        <View>
          <ST v="body16" color={colors.ivory} lines={1}>
            {demo.reqTitle}
          </ST>
          <ST v="meta13" color={colors.ivory55} lines={1} style={{ fontStyle: "italic" }}>
            {demo.reqNote}
          </ST>
        </View>
        {stage === 0 ? (
          <Tap onPress={send}>
            <FakeButton label={demo.send} icon="share" />
          </Tap>
        ) : (
          <Tap onPress={send}>
            <View style={[sceneStyles.row, { height: 40 }]}>
              {stage === 1 ? (
                <Animated.View key="wait" entering={FadeIn.duration(reduced ? 1 : 200)}>
                  <Pill label={app.planner.awaiting} kind="amber" dot />
                </Animated.View>
              ) : (
                <Animated.View key="ok" entering={ZoomIn.duration(reduced ? 1 : 240)}>
                  <Pill label={app.planner.approved} kind="green" icon="check" />
                </Animated.View>
              )}
            </View>
          </Tap>
        )}
      </View>
      {stage === 2 ? (
        <Animated.View entering={reduced ? FadeIn.duration(1) : FadeInDown.springify().damping(16).stiffness(170)} style={[sceneStyles.row, { marginTop: 10, alignItems: "flex-end", gap: 8 }]}>
          <Initials text="CA" size={30} />
          <Bubble text={demo.coupleSays} maxWidth={230} />
        </Animated.View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- requests

export function RequestsScene({ active, reduced }: SceneProps) {
  const app = useCopy();
  const demo = useFeatureCopy(TOUR_COPY).demo;
  const tried = useTried();
  const [open, setOpen] = useState<number | null>(null);
  useResetWhenInactive(active, () => setOpen(null));
  const toggle = (i: number) => {
    tried();
    setOpen((o) => (o === i ? null : i));
  };
  useTryAction(() => toggle(open === null ? 0 : (open + 1) % 3));
  const rows = [
    { title: demo.reqC, pill: <Pill label={app.planner.awaiting} kind="amber" dot start />, talk: <Bubble text={demo.reqNote} me maxWidth={290} />, action: app.planner.withdraw },
    { title: demo.reqB, pill: <Pill label={app.planner.approved} kind="green" dot start />, talk: <Bubble text={demo.coupleSays} maxWidth={290} /> },
    { title: demo.reqA, pill: <Pill label={app.planner.declined} kind="mute" dot start />, talk: <Bubble text={demo.declinedWhy} maxWidth={290} /> },
  ];
  const layout = reduced ? undefined : LinearTransition.springify().damping(18).stiffness(170);
  return (
    <View style={StyleSheet.absoluteFill}>
      {rows.map((r, i) => (
        <Animated.View key={r.title} layout={layout} style={[styles.reqRow, open === i && styles.reqRowOpen]}>
          <Tap onPress={() => toggle(i)}>
            <View style={[sceneStyles.row, { minHeight: 44 }]}>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <ST v="body15" size={16} color={colors.ivory} lines={1}>
                  {r.title}
                </ST>
                <View style={[sceneStyles.row, { justifyContent: "space-between", minHeight: 26 }]}>
                  {r.pill}
                  {open === i && r.action ? <FakeButton label={r.action} kind="ghost" style={{ height: 28, paddingHorizontal: 12 }} /> : null}
                </View>
              </View>
              <Icon name={open === i ? "down" : "chev"} size={16} color={colors.ivory40} />
            </View>
          </Tap>
          {open === i ? (
            <Animated.View entering={FadeIn.duration(reduced ? 1 : 240)} exiting={FadeOut.duration(100)} style={{ marginTop: 6 }}>
              {r.talk}
            </Animated.View>
          ) : null}
        </Animated.View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- tasks

const COL_W = 100;
const COL_GAP = 10;

export function TasksScene({ active, reduced }: SceneProps) {
  const app = useCopy();
  const tc = useFeatureCopy(TASKS_COPY);
  const demo = useFeatureCopy(TOUR_COPY).demo;
  const tried = useTried();
  const [col, setCol] = useState(0);
  const x = useSharedValue(0);
  const settle = useSharedValue(1);
  useEffect(() => {
    const to = col * (COL_W + COL_GAP);
    if (reduced) {
      x.set(to);
      return;
    }
    settle.set(0);
    settle.set(withSpring(1, { damping: 12, stiffness: 160 }));
    x.set(withSpring(to, SPRING));
  }, [col, reduced, x, settle]);
  useResetWhenInactive(active, () => setCol(0));
  const move = () => {
    tried();
    setCol((c) => (c + 1) % 3);
  };
  useTryAction(move);
  const card = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { rotate: `${(1 - settle.get()) * -4}deg` }, { scale: 1 + (1 - settle.get()) * 0.05 }] }));
  const labels = [app.planner.taskStatus.open, app.planner.taskStatus.in_progress, app.planner.taskStatus.done];
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[sceneStyles.row, { gap: 8, marginBottom: 12 }]}>
        <View style={[styles.chip, styles.chipOn]}>
          <ST v="meta13" color={colors.goldLight} lines={1} style={{ fontFamily: fonts.bodyMedium }}>
            {tc.planner.mine}
          </ST>
        </View>
        <View style={styles.chip}>
          <ST v="meta13" color={colors.ivory70} lines={1} style={{ fontFamily: fonts.bodyMedium }}>
            {tc.planner.theirs}
          </ST>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: COL_GAP }}>
        {labels.map((l, i) => (
          <View key={l} style={styles.col}>
            <ST v="label11" color={i === 2 ? colors.greenText : colors.ivory55} lines={1} style={{ letterSpacing: 1 }}>
              {l}
            </ST>
            <View style={{ height: 84 }} />
            <View style={styles.ghost} />
            {i === 0 ? <View style={[styles.ghost, { width: "70%" }]} /> : null}
          </View>
        ))}
      </View>
      <Animated.View style={[styles.task, col === 2 && styles.taskDone, card]}>
        <Tap onPress={move} hitSlop={10}>
          <View style={{ gap: 6 }}>
            <ST v="meta13" color={col === 2 ? colors.ivory55 : colors.ivory} lines={2} style={[{ fontFamily: fonts.bodyMedium }, col === 2 && { textDecorationLine: "line-through" }]}>
              {demo.task}
            </ST>
            {col === 2 ? (
              <Animated.View key="done" entering={ZoomIn.duration(reduced ? 1 : 220)} style={styles.doneDot}>
                <Icon name="check" size={12} color={colors.night} strokeWidth={2.8} />
              </Animated.View>
            ) : (
              <Pill label={tc.planner.mine} kind="gold" start />
            )}
          </View>
        </Tap>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------- tools (Boda)

export type TourTool = "budget" | "tasks" | "seating" | "runsheet";

/** Which Boda tools this planner has on this wedding (tour step 3 draws
 *  them lit or locked). Every tool lit when unknown. */
export const TourToolsContext = createContext<Record<TourTool, boolean> | null>(null);

const TOOL_ICONS: { id: TourTool; icon: IconName }[] = [
  { id: "budget", icon: "wallet" },
  { id: "tasks", icon: "tasks" },
  { id: "seating", icon: "grid" },
  { id: "runsheet", icon: "clock" },
];

export function ToolsScene({ reduced }: SceneProps) {
  const app = useCopy();
  const on = useContext(TourToolsContext);
  const b = app.planner.b12;
  const label = (t: TourTool) => (t === "budget" ? b.budget : t === "tasks" ? b.tasks : t === "seating" ? b.seating : b.runsheet);
  return (
    <View style={[StyleSheet.absoluteFill, { flexDirection: "row", flexWrap: "wrap", gap: 12, alignContent: "center", justifyContent: "center" }]}>
      {TOOL_ICONS.map((t, i) => {
        const lit = on ? on[t.id] : true;
        return (
          <Animated.View key={t.id} entering={reduced ? undefined : FadeInDown.delay(80 * i).duration(320)} style={[styles.tool, !lit && styles.toolLocked]}>
            <Icon name={lit ? t.icon : "lock"} size={26} color={lit ? colors.goldLight : colors.ivory40} />
            <ST v="body15" color={lit ? colors.ivory : colors.ivory55} lines={2}>
              {label(t.id)}
            </ST>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { position: "absolute", left: 0, right: 0, top: -4, height: ROW_H + 8, borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(201,169,110,0.7)", backgroundColor: "rgba(201,169,110,0.08)" },
  wRow: { height: ROW_H, marginHorizontal: 5, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, paddingHorizontal: 12, backgroundColor: "rgba(13,17,23,0.6)", borderWidth: 1, borderColor: colors.ivory09 },
  chip: { borderRadius: radius.pill, paddingHorizontal: 11, height: 30, justifyContent: "center", borderWidth: 1, borderColor: colors.ivory14 },
  chipOn: { borderColor: "rgba(201,169,110,0.55)", backgroundColor: "rgba(201,169,110,0.14)" },
  reqRow: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 6, backgroundColor: "rgba(13,17,23,0.6)", borderWidth: 1, borderColor: colors.ivory09, overflow: "hidden" },
  reqRowOpen: { borderColor: "rgba(201,169,110,0.45)" },
  col: { width: COL_W, height: 196, borderRadius: 14, padding: 8, gap: 8, backgroundColor: "rgba(247,243,236,0.035)", borderWidth: 1, borderColor: colors.ivory09 },
  ghost: { height: 30, borderRadius: 8, backgroundColor: "rgba(247,243,236,0.06)" },
  task: { position: "absolute", left: 4, top: 42 + 32, width: COL_W - 8, borderRadius: 12, padding: 9, backgroundColor: "rgba(22,33,58,0.96)", borderWidth: 1.5, borderColor: colors.gold, shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
  taskDone: { borderColor: "rgba(52,211,153,0.6)" },
  tool: { width: 136, height: 112, borderRadius: 18, padding: 14, justifyContent: "space-between", backgroundColor: "rgba(201,169,110,0.08)", borderWidth: 1.5, borderColor: "rgba(201,169,110,0.5)" },
  toolLocked: { backgroundColor: "rgba(247,243,236,0.03)", borderColor: colors.ivory14, borderStyle: "dashed" },
  doneDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
});

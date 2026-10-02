// Planner Boda / Wedding (build 12, prototype P.wedding; feedback F5).
//
// The open wedding at a glance (photo, names, date, days, replies, paid) and
// the same four tools as the couple's Plan: Budget, Tasks, Seating, Day-of
// schedule, plus Guest reminders when the planner has it. Vendors is no tool
// of its own any more: each budget line carries its vendor (the vendor
// screens stay, opened from budget lines and links).
//
// Permissions (the 18 per-tool levels, /auth/me `capabilities`): a tool the
// couple did not share shows "Not shared with you" on its tile and, tapped,
// says so and offers to ask the couple (a request, through the existing
// endpoint). Never an error, and its endpoint is never called: each live
// number is fetched by a component that only mounts when the tool is on.
//
// The pill row is the same header as every other planner tab, laid over the
// photo at the same spot (F1).

import React, { useState } from "react";
import { View, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { fmt, plural, longDate, useCopy, useLang } from "@/i18n";
import { usePlannerHome } from "@/lib/hooks";
import { can, useTenantKey, useUserSession } from "@/lib/session";
import { Screen, T, Card, ListRow, Sheet, Button, Stack, SectionLabel, Icon, PhotoHero, Row, useTopInset, type IconName } from "@/ui";
import { colors, radius, space, COLUMN } from "@/ui/tokens";
import { useBudgetSurface } from "@/features/budget/hooks";
import { usePlannerSeating } from "@/features/seating/hooks";
import { usePlannerRunsheet } from "@/features/runsheet/hooks";
import { PlannerTop, IconDisc, usePlannerBoardQ, daysToGo } from "@/app/planner/_layout";

// Stock photos (no couple photo reaches the planner): one per wedding, the
// same every time for the same wedding.
const PHOTOS = [require("../../../assets/photos/courtyard.jpg"), require("../../../assets/photos/ceremony.jpg"), require("../../../assets/photos/bluehour.jpg"), require("../../../assets/photos/dance.jpg")];

type Tool = "budget" | "tasks" | "seating" | "runsheet";
const TOOLS: { id: Tool; icon: IconName }[] = [
  { id: "budget", icon: "wallet" },
  { id: "tasks", icon: "tasks" },
  { id: "seating", icon: "grid" },
  { id: "runsheet", icon: "clock" },
];

export default function PlannerWedding() {
  // A wedding switch remounts the body (an open "not shared" sheet closes).
  return <PlannerWeddingBody key={useTenantKey()} />;
}

function PlannerWeddingBody() {
  const copy = useCopy();
  const c = copy.planner.b12;
  const { lang } = useLang();
  const router = useRouter();
  const top = useTopInset();
  const me = useUserSession()?.me;
  const home = usePlannerHome();
  const [locked, setLocked] = useState<Tool | null>(null);
  const slug = me?.tenant.slug ?? "";
  const photo = PHOTOS[[...slug].reduce((n, ch) => n + ch.charCodeAt(0), 0) % PHOTOS.length];
  const days = daysToGo(me, home.data?.weddings);
  const parties = home.data?.totals.parties ?? 0;
  const pendingParties = home.data?.totals.pending_parties ?? 0;
  const canBudget = can(me, "budget");
  const name = (t: Tool) => (t === "budget" ? c.budget : t === "tasks" ? c.tasks : t === "seating" ? c.seating : c.runsheet);

  function openTool(t: Tool) {
    if (!can(me, t)) return setLocked(t);
    if (t === "budget") router.push("/planner/budget" as never);
    // Tasks live in Pendientes (one place for them, N10).
    else if (t === "tasks") router.navigate("/planner/requests" as never);
    else if (t === "seating") router.push("/planner/seating" as never);
    else router.push("/planner/runsheet" as never);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <Screen query={home} refresh topInset={false} padded={false} backdrop={false}>
        <PhotoHero source={photo} focal={{ x: 0.5, y: 0.45 }} aspect={390 / 300} minHeight={260} maxHeightFraction={0.4} gradient={0.6}>
          <T v="title42" size={40} numberOfLines={2}>
            {me?.tenant.couple_names ?? ""}
          </T>
          <T v="body15" color={colors.ivory90} style={{ marginTop: 4 }}>
            {me?.tenant.wedding_date ? cap(longDate(me.tenant.wedding_date, lang)) : c.dateTbd}
          </T>
        </PhotoHero>
        <View style={styles.body}>
          <Row gap={8} align="stretch">
            <Stat value={days === null ? "·" : String(days)} label={days === null ? c.dateTbd : plural(days, c.daysWord)} />
            <Stat value={home.data ? String(parties - pendingParties) : "·"} label={fmt(c.ofReplied, { total: parties })} />
            {canBudget ? <BudgetStat /> : <Stat value={home.data ? String(home.data.totals.attending_seats) : "·"} label={c.goingWord} />}
          </Row>
          <SectionLabel color={colors.goldLight} style={{ marginTop: 24, marginBottom: 10 }}>
            {c.tools}
          </SectionLabel>
          <View style={styles.tiles}>
            {TOOLS.map((t) => (
              <Tile key={t.id} icon={t.icon} title={name(t.id)} locked={!can(me, t.id)} onPress={() => openTool(t.id)} testID={`planner-tool-${t.id}`}>
                {can(me, t.id) ? <ToolNumber tool={t.id} /> : null}
              </Tile>
            ))}
          </View>
          {can(me, "broadcasts") ? (
            <Card kind="solid" padding={2} style={{ paddingHorizontal: 16, marginTop: 10 }}>
              <ListRow testID="planner-tool-reminders" leading={<IconDisc name="bell" />} title={c.reminders} sub={home.data ? fmt(c.remindersSub, { n: pendingParties }) : null} onPress={() => router.push("/planner/broadcasts" as never)} last />
            </Card>
          ) : null}
        </View>
      </Screen>
      {/* The same header as the other tabs, over the photo, at the same spot. */}
      <View pointerEvents="box-none" style={[styles.over, { top }]}>
        <PlannerTop glass />
      </View>
      <Sheet visible={!!locked} onClose={() => setLocked(null)}>
        {locked ? (
          <Stack gap={12}>
            <View style={styles.lockDisc}>
              <Icon name="lock" size={26} color={colors.goldLight} />
            </View>
            <T v="title26">{fmt(c.toolNotShared, { tool: name(locked) })}</T>
            <T v="body15" color={colors.ivory70}>
              {fmt(c.toolNotSharedBody, { names: me?.tenant.couple_names ?? "" })}
            </T>
            {can(me, "tasks") ? (
              <Button
                label={c.askAccess}
                icon="arrow-up"
                onPress={() => {
                  const tool = name(locked);
                  setLocked(null);
                  router.push({ pathname: "/planner/requests/new", params: { kind: "custom", title: fmt(c.accessTitle, { tool }) } } as never);
                }}
                style={{ marginTop: 6 }}
                testID="planner-ask-access"
              />
            ) : (
              <T v="body15" color={colors.ivory55}>
                {c.askCouple}
              </T>
            )}
          </Stack>
        ) : null}
      </Sheet>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <T v="title30" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontVariant: ["lining-nums"] }}>
        {value}
      </T>
      <T v="meta13" color={colors.ivory70}>
        {label}
      </T>
    </View>
  );
}

/** Paid share of the budget, the number the Budget screen prints (B3). */
function BudgetStat() {
  const c = useCopy().planner.b12;
  const q = useBudgetSurface();
  const pct = q.data?.active ? Math.round((q.data.active.computed.totals.paidFraction || 0) * 100) : null;
  return <Stat value={pct === null ? "·" : `${pct}%`} label={c.paidWord} />;
}

/** A tile's live line. Mounted only for a tool that is on. */
function ToolNumber({ tool }: { tool: Tool }) {
  if (tool === "budget") return <BudgetLine />;
  if (tool === "tasks") return <TasksLine />;
  if (tool === "seating") return <SeatingLine />;
  return <RunsheetLine />;
}

function Line({ text }: { text: string | null }) {
  return (
    <T v="body15" color={colors.ivory70} numberOfLines={2}>
      {text ?? "·"}
    </T>
  );
}

function BudgetLine() {
  const c = useCopy().planner.b12;
  const q = useBudgetSurface();
  if (!q.data) return <Line text={null} />;
  if (!q.data.active) return <Line text={c.noBudget} />;
  return <Line text={fmt(c.paidPct, { n: Math.round((q.data.active.computed.totals.paidFraction || 0) * 100) })} />;
}

function TasksLine() {
  const c = useCopy().planner.b12;
  const q = usePlannerBoardQ(true);
  if (!q.data) return <Line text={null} />;
  return <Line text={plural(q.data.tasks.filter((t) => t.status !== "done").length, c.openTasks)} />;
}

function SeatingLine() {
  const c = useCopy().planner.b12;
  const q = usePlannerSeating();
  if (!q.data) return <Line text={null} />;
  if (!q.data.tables.length) return <Line text={c.noTables} />;
  const n = q.data.stats.unseated_people;
  return <Line text={n ? fmt(c.unseated, { n }) : c.allSeated} />;
}

function RunsheetLine() {
  const c = useCopy().planner.b12;
  const q = usePlannerRunsheet();
  if (!q.data) return <Line text={null} />;
  return <Line text={q.data.blocks_total ? plural(q.data.blocks_total, c.blocks) : c.notStarted} />;
}

function Tile({ icon, title, locked, onPress, children, testID }: { icon: IconName; title: string; locked: boolean; onPress: () => void; children?: React.ReactNode; testID?: string }) {
  const c = useCopy().planner.b12;
  // Large text on a narrow phone: full-width tiles instead of squares, so the
  // title and its line never run past the tile (the couple Plan rule, D-031).
  const { width, fontScale } = useWindowDimensions();
  const oneColumn = width < 340 || (width < 380 && fontScale > 1.15);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      // Unlocked: no label of its own, so VoiceOver reads the title and the
      // live number inside ("Presupuesto, 17% pagado").
      accessibilityLabel={locked ? `${title}, ${c.notSharedShort}` : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, oneColumn && styles.tileWide, locked && styles.tileLocked, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
    >
      <View style={[styles.tileIcon, locked && { backgroundColor: colors.ivory09 }]}>
        <Icon name={locked ? "lock" : icon} size={24} color={locked ? colors.ivory70 : colors.goldLight} />
      </View>
      <View style={{ gap: 2 }}>
        <T v="body16" color={colors.ivory} numberOfLines={2}>
          {title}
        </T>
        {locked ? <Line text={c.notSharedShort} /> : children}
      </View>
    </Pressable>
  );
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

const styles = StyleSheet.create({
  body: { ...COLUMN, paddingHorizontal: space.screen, paddingTop: 16 },
  over: { position: "absolute", left: 0, right: 0 },
  stat: { flex: 1, minWidth: 0, borderRadius: radius.tile, borderWidth: 1, borderColor: colors.ivory14, backgroundColor: colors.navy, padding: 12, gap: 2 },
  tiles: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  tile: { width: "48.5%", aspectRatio: 1, minHeight: 140, borderRadius: radius.tile, borderWidth: 1, borderColor: colors.ivory14, backgroundColor: colors.navy, padding: 16, justifyContent: "space-between" },
  tileWide: { width: "100%", aspectRatio: undefined, minHeight: 120, gap: 16 },
  tileLocked: { backgroundColor: "transparent", borderStyle: "dashed", borderColor: colors.ivory25 },
  tileIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.goldWash },
  lockDisc: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: colors.ivory09 },
});

// Planner surface, build 12 (plan v1.2 b; prototype M12, P.*; feedback F1, F5).
//
// Tabs: Hoy (index), Pendientes (requests: my tasks + requests to the couple),
// Invitados (guests), Boda (wedding: Budget, Tasks, Seating, Day-of schedule,
// guest reminders) and Más (more). The tab list is the same on every wedding:
// a tool the couple did not share shows "Not shared with you in this wedding"
// inside its tab or tile instead of a tab that comes and goes (F1: switching
// weddings never reshuffles the bar under the planner's thumb). The server
// refuses switched-off tools anyway; a locked tool never calls its endpoint.
//
// F1, the wedding pill: every tab root renders <PlannerTop /> in its fixed
// header, so the pill (couple names and date) sits in exactly the same spot
// on all five tabs. Tapping it opens the switcher. A switch from the pill:
//   1. session.switchTenant (commits only when the new wedding answered; it
//      empties the query cache, so no old-wedding row stays on screen and the
//      lists show skeletons while they refetch),
//   2. every tab stack pops to its root (popAllStacks),
//   3. every tab root body is keyed by session.tenantKey, so its local state
//      (search text, filters, selections, open sheets) starts clean,
//   4. a toast says "Now showing {names}'s wedding".
// A switch from elsewhere (a push for another wedding, Settings) changes
// tenantKey too: the tab bar wrapper below pops every stack except the focused
// one (a push tap has just opened its target there; popping it would close the
// screen the notification promised).
//
// Shared planner pieces live here as named exports (an extra file under
// src/app would become a route): PlannerTop, NotShared, the gated queries,
// the task check row and its toggle.

import React, { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { View, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Tabs, useNavigation } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { fmt, plural, shortDate, useCopy, useLang } from "@/i18n";
import { get, post } from "@/lib/api";
import { usePlannerHome, type RequestRow, type TaskRow } from "@/lib/hooks";
import { useOnline } from "@/lib/query";
import { can, useSession, useUserSession, type Me } from "@/lib/session";
import { GlassTabBar, resetTabs, type TabSpec } from "@/ui/TabBar";
import { T, Icon, Row, Sheet, ListRow, Badge, Card, Stack, toast, type IconName } from "@/ui";
import { colors, fonts, radius, space, COLUMN, HIT_TARGET } from "@/ui/tokens";
import { TASK_INVALIDATE, type BoardStatus, type BoardTask } from "@/features/tasks/hooks";
import { errorText } from "@/features/tasks/ui";

/** A render error in a planner screen shows the recovery screen inside the
 *  app instead of closing it, and is reported. */
export { ErrorBoundary } from "@/ui/ErrorScreen";

/** Routes that are not tabs. Each pops to its first screen when left. */
const HIDDEN = ["tasks", "budget", "runsheet", "seating", "broadcasts", "vendors"];

export default function PlannerTabs() {
  const c = useCopy().planner.b12.tabs;
  const me = useUserSession()?.me;
  const canTasks = can(me, "tasks");
  const home = usePlannerHome();
  const reqs = usePlannerRequestsQ(canTasks);
  // Pendientes counts what waits on the planner: their own open tasks and the
  // requests the couple answered with a question (plan b; prototype badge).
  const badge = canTasks ? (home.data?.open_tasks ?? 0) + (reqs.data?.requests ?? []).filter(asksPlanner).length : 0;
  const specs: TabSpec[] = [
    { name: "index", icon: "home", label: c.today },
    { name: "requests", icon: "tasks", label: c.todo, badge, owns: ["tasks"] },
    { name: "guests", icon: "guests", label: c.guests },
    // Vendors stays a route (budget lines and pushes open it) but is no tool
    // of its own any more (F5).
    { name: "wedding", icon: "rings", label: c.wedding, owns: ["budget", "runsheet", "seating", "broadcasts", "vendors"] },
    { name: "more", icon: "more", label: c.more },
  ];
  return (
    <Tabs
      // Back means the screen the person came from, not the first tab.
      backBehavior="history"
      tabBar={(props) => <PlannerTabBar {...props} specs={specs} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.night }, lazy: true }}
    >
      {specs.map((s) => (
        // A tab left with a detail open reopens on its list (Pendientes with a
        // request open, then Hoy, then "See all in To do").
        <Tabs.Screen key={s.name} name={s.name} options={{ popToTopOnBlur: s.name === "requests" }} />
      ))}
      {HIDDEN.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null, popToTopOnBlur: true }} />
      ))}
    </Tabs>
  );
}

type BarProps = React.ComponentProps<typeof GlassTabBar>;

/** The kit's bar, plus F1 for switches that did not start at the pill: when
 *  the wedding changes, every tab stack except the focused one pops to its
 *  root. (The kit's own `resetKey` pops the focused one too, which would close
 *  the screen a push for another wedding has just opened.) */
function PlannerTabBar(props: BarProps) {
  const { tenantKey } = useSession();
  const { state, navigation } = props;
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  });
  const last = useRef(tenantKey);
  useEffect(() => {
    const prev = last.current;
    last.current = tenantKey;
    if (!prev || !tenantKey || prev === tenantKey) return;
    const st = latest.current;
    resetTabs(navigation as unknown as Parameters<typeof resetTabs>[0], { skip: st.routes[st.index]?.key, tabs: PLANNER_STACKS });
  }, [tenantKey, navigation]);
  return <GlassTabBar {...props} />;
}

// ------------------------------------------------------------------ data

export type PlannerRequests = { pending: boolean; requests: RequestRow[]; tasks: TaskRow[]; tasks_pending: boolean };

/** GET /planner/requests (the same key and body as lib/hooks
 *  usePlannerRequests), only while "tasks" is on: requests ride on the tasks
 *  permission server side, and a switched-off tool is never called. */
export function usePlannerRequestsQ(enabled: boolean) {
  return useQuery({ queryKey: ["planner-requests"], queryFn: () => get<PlannerRequests>("/planner/requests"), enabled });
}

/** GET /planner/tasks, the shared board (the same key and body as
 *  features/tasks useSharedBoard("planner")), only while "tasks" is on. */
export function usePlannerBoardQ(enabled: boolean) {
  return useQuery({ queryKey: ["tasks-shared", "planner"], queryFn: () => get<{ pending: boolean; tasks: BoardTask[] }>("/planner/tasks"), enabled });
}

/** An open request whose last word is the couple's: they asked the planner
 *  something, so it waits on the planner. */
export function asksPlanner(r: RequestRow): boolean {
  if (r.status !== "open") return false;
  const thread = (r.thread ?? []).filter((t) => t.event !== "edited");
  const lastEntry = thread[thread.length - 1];
  return !!lastEntry && lastEntry.author_role !== "planner";
}

/** Due date of a board task, when the portal sends one (feature-detected:
 *  the production board has none yet, so nothing shows "Overdue" until it
 *  does). */
export function dueOf(t: unknown): string | null {
  const o = (t ?? {}) as Record<string, unknown>;
  for (const k of ["due_date", "due_on", "due_at", "due"]) {
    const v = o[k];
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  }
  return null;
}

export function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Days to the open wedding: the home's own count, else from the date. */
export function daysToGo(me: Me | undefined, weddings: { slug: string; days_to_go: number | null }[] | undefined): number | null {
  const row = weddings?.find((w) => w.slug === me?.tenant.slug);
  if (row && typeof row.days_to_go === "number") return row.days_to_go;
  const iso = me?.tenant.wedding_date;
  if (!iso) return null;
  const a = Date.parse(`${todayIso()}T00:00:00Z`);
  const b = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** "Camila & Andrés · 21 Mar": the wedding as the pill and the switcher name it. */
export function weddingLabel(names: string, date: string | null | undefined, lang: "en" | "es"): string {
  const d = date ? shortDate(date, lang).replace(/\.$/, "") : "";
  return d ? `${names} · ${d}` : names;
}

/** The kind's icon, for request rows and the kind grid. */
export function kindIcon(kind: string): IconName {
  if (kind === "plus_one") return "guests";
  if (kind === "edit_guest") return "edit";
  if (kind === "guest_help") return "contacts";
  if (kind === "send_reminders") return "bell";
  return "chat";
}

// ------------------------------------------------------------------ navigation

type NavLike = { getState: () => { type?: string }; getParent: () => NavLike | undefined };

/** The planner tabs whose stacks go back to their lists on a wedding switch,
 *  plus the hidden tasks stack Hoy pushes a task into. */
const PLANNER_STACKS: ReadonlySet<string> = new Set(["index", "requests", "guests", "wedding", "more", "tasks"]);

/** Pops every tab stack to its root (F1). From any screen inside the tabs. */
export function popAllStacks(navigation: unknown) {
  let nav = navigation as NavLike | undefined;
  while (nav && nav.getState()?.type !== "tab") nav = nav.getParent();
  if (!nav) return;
  resetTabs(nav as unknown as Parameters<typeof resetTabs>[0], { tabs: PLANNER_STACKS });
}

// ------------------------------------------------------------------ header

/** The one header of every planner tab root: the wedding pill at the top
 *  left, an optional action on the right. `glass` darkens the pill over a
 *  photo (Boda). Same padding everywhere, so the pill never moves (F1). */
export function PlannerTop({ right, glass }: { right?: ReactNode; glass?: boolean }) {
  const { lang } = useLang();
  const c = useCopy().planner.b12;
  const me = useUserSession()?.me;
  const [open, setOpen] = useState(false);
  const label = me ? weddingLabel(me.tenant.couple_names, me.tenant.wedding_date, lang) : "";
  return (
    <View style={styles.top}>
      <Pressable
        testID="planner-wedding-pill"
        accessibilityRole="button"
        accessibilityLabel={fmt(c.pillA11y, { name: label })}
        onPress={() => setOpen(true)}
        hitSlop={4}
        style={({ pressed }) => [styles.pill, glass && styles.pillGlass, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
      >
        <Icon name="rings" size={18} color={colors.goldLight} />
        <T v="body15" color={colors.ivory} numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.bodyMedium }}>
          {label}
        </T>
        <Icon name="down" size={16} color={colors.ivory70} />
      </Pressable>
      <View>{right}</View>
      <WeddingSwitcher visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

/** "Your weddings": each of the planner's weddings with a one line status. */
export function WeddingSwitcher({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const copy = useCopy();
  const c = copy.planner.b12;
  const { lang } = useLang();
  const navigation = useNavigation();
  const me = useUserSession()?.me;
  const { switchTenant, switchingTenant } = useSession();
  const home = usePlannerHome();
  const rows = useMemo(() => {
    const full = home.data?.weddings ?? [];
    // The home's rows carry date and counts; /auth/me lists every wedding
    // even before the home answers.
    return (me?.tenants ?? []).map((t) => {
      const w = full.find((x) => x.slug === t.slug);
      return { slug: t.slug, names: w?.couple_names ?? t.couple_names, date: w?.wedding_date ?? (t.slug === me?.tenant.slug ? me.tenant.wedding_date : null), days: w?.days_to_go ?? null, open: w?.open_requests ?? null };
    });
  }, [home.data, me]);

  function sub(r: (typeof rows)[number]): string {
    const when = r.days === null ? (r.date ? "" : c.noDate) : r.days === 0 ? c.weddingDay : plural(r.days, c.daysToGo);
    const tail = r.open === null ? "" : r.open > 0 ? plural(r.open, c.openRequests) : c.caughtUp;
    return [when, tail].filter(Boolean).join(" · ");
  }

  async function pick(slug: string, names: string) {
    if (switchingTenant) return;
    if (slug === me?.tenant.slug) return onClose();
    void Haptics.selectionAsync();
    const ok = await switchTenant(slug);
    if (!ok) {
      // Nothing changed: the sheet stays open with the reason.
      toast(copy.core.switchFailed, { icon: "warning" });
      return;
    }
    onClose();
    popAllStacks(navigation);
    toast(fmt(c.nowShowing, { names }), { icon: "rings" });
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Row style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <T v="title26">{c.switcherTitle}</T>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.common.close} onPress={onClose} style={styles.close}>
          <Icon name="x" size={22} color={colors.ivory70} />
        </Pressable>
      </Row>
      <Card kind="solid" padding={2} style={{ paddingHorizontal: 16 }}>
        {rows.map((r, i) => {
          const current = r.slug === me?.tenant.slug;
          return (
            <ListRow
              key={r.slug}
              testID={`planner-wedding-${r.slug}`}
              leading={<IconDisc name="rings" />}
              title={weddingLabel(r.names, r.date, lang)}
              sub={sub(r) || null}
              trailing={switchingTenant === r.slug ? <ActivityIndicator color={colors.goldLight} /> : current ? <View accessible accessibilityLabel={c.currentWedding}><Icon name="check" size={22} color={colors.goldLight} /></View> : undefined}
              chevron={false}
              onPress={() => void pick(r.slug, r.names)}
              last={i === rows.length - 1}
            />
          );
        })}
      </Card>
    </Sheet>
  );
}

// ------------------------------------------------------------------ bits

/** A 40 pt disc with a gold icon: the leading mark of planner rows. */
export function IconDisc({ name, muted }: { name: IconName; muted?: boolean }) {
  return (
    <View style={[styles.disc, muted && { backgroundColor: colors.ivory09 }]}>
      <Icon name={name} size={20} color={muted ? colors.ivory70 : colors.goldLight} />
    </View>
  );
}

/** The whole-tab state for a tool this wedding did not share with the
 *  planner. Never an error (F5, S18). */
export function NotShared({ title, body, action }: { title?: string; body?: string; action?: ReactNode }) {
  const c = useCopy().planner.b12;
  return (
    <Card kind="solid" padding={20} style={{ marginTop: 20 }}>
      <Stack gap={12}>
        <View style={styles.lock}>
          <Icon name="lock" size={26} color={colors.goldLight} />
        </View>
        <T v="title26">{title ?? c.notShared}</T>
        <T v="body15" color={colors.ivory55}>
          {body ?? c.askCouple}
        </T>
        {action}
      </Stack>
    </Card>
  );
}

// ------------------------------------------------------------------ tasks

const NEXT: Record<BoardStatus, BoardStatus> = { open: "in_progress", in_progress: "done", done: "open" };

/** Mark done / reopen / cycle a board task, at once on screen, then saved.
 *  Done offers Undo; a failure puts the row back and says so in a toast. */
export function useTaskToggle() {
  const c = useCopy().planner.b12;
  const { lang } = useLang();
  const qc = useQueryClient();
  const online = useOnline();
  const [optimistic, setOptimistic] = useState<Record<string, BoardStatus>>({});
  const statusOf = (t: BoardTask): BoardStatus => optimistic[t.id] ?? t.status;

  async function setStatus(t: BoardTask, from: BoardStatus, next: BoardStatus, quiet = false) {
    if (!online) {
      toast(c.offline, { icon: "wifi-off" });
      return;
    }
    setOptimistic((o) => ({ ...o, [t.id]: next }));
    const forget = () =>
      setOptimistic((o) => {
        const n = { ...o };
        delete n[t.id];
        return n;
      });
    try {
      await post(`/planner/tasks/${t.id}/status`, { status: next });
      if (!quiet) {
        if (next === "done") toast(c.taskDone, { undo: () => void setStatus(t, next, from, true) });
        else if (from === "done") toast(c.taskReopened, { icon: "undo" });
      }
      await Promise.all(TASK_INVALIDATE.map((k) => qc.invalidateQueries({ queryKey: [k] })));
      forget();
    } catch (err) {
      forget();
      toast(errorText(err, lang, c.couldNotSave), { icon: "warning" });
    }
  }

  return {
    statusOf,
    toggle: (t: BoardTask) => {
      const s = statusOf(t);
      return setStatus(t, s, s === "done" ? "open" : "done");
    },
    cycle: (t: BoardTask) => {
      const s = statusOf(t);
      return setStatus(t, s, NEXT[s]);
    },
  };
}

/** One task with a real 24 pt checkbox (plan c): tap the box to mark it done
 *  or open again, tap the row to open the task, hold it to move it to the
 *  next status. "Overdue" in red when the task has a past due date. */
export function TaskCheckRow({ task, status, canEdit, onToggle, onCycle, onPress, last }: { task: BoardTask; status: BoardStatus; canEdit: boolean; onToggle: () => void; onCycle: () => void; onPress: () => void; last?: boolean }) {
  const copy = useCopy();
  const c = copy.planner.b12;
  const done = status === "done";
  const due = dueOf(task);
  const today = todayIso();
  const overdue = !!due && !done && due < today;
  const meta = [task.assigned_to === "planner" ? c.ownerYou : c.ownerCouple, status === "in_progress" ? c.inProgress : null, due === today && !done ? c.dueToday : null, task.guest_names.slice(0, 2).join(", ") || null].filter(Boolean).join(" · ");
  return (
    <View style={[styles.taskRow, last && { borderBottomWidth: 0 }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done, disabled: !canEdit }}
        accessibilityLabel={`${task.title}, ${done ? c.markOpen : c.markDone}`}
        disabled={!canEdit}
        onPress={() => {
          void Haptics.selectionAsync();
          onToggle();
        }}
        style={styles.checkHit}
      >
        <View style={[styles.check, done && styles.checkOn, !canEdit && { opacity: 0.5 }]}>{done ? <Icon name="check" size={16} color={colors.ink} /> : null}</View>
      </Pressable>
      <Pressable
        onPress={onPress}
        onLongPress={canEdit ? () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onCycle(); } : undefined}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={[task.title, overdue ? c.overdue : null, meta].filter(Boolean).join(", ")}
        accessibilityActions={canEdit ? [{ name: "longpress", label: copy.core.cycleStatus }] : undefined}
        onAccessibilityAction={canEdit ? (e) => { if (e.nativeEvent.actionName === "longpress") onCycle(); } : undefined}
        style={({ pressed }) => [styles.taskMain, pressed && { opacity: 0.7 }]}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <T v="body16" color={done ? colors.ivory55 : colors.ivory90} numberOfLines={2} style={done ? { textDecorationLine: "line-through" } : undefined}>
            {task.title}
          </T>
          <Row gap={8} style={{ flexWrap: "wrap" }}>
            {overdue ? <Badge label={c.overdue} kind="red" /> : null}
            {meta ? (
              <T v="meta13" color={colors.ivory55} style={{ flexShrink: 1 }}>
                {meta}
              </T>
            ) : null}
          </Row>
        </View>
        <Icon name="chev" size={18} color={colors.ivory40} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { ...COLUMN, minHeight: HIT_TARGET, paddingHorizontal: space.screen, marginBottom: 6, gap: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pill: { flexShrink: 1, minWidth: 0, height: 40, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 12, paddingRight: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.goldBorder, backgroundColor: colors.goldWash },
  pillGlass: { backgroundColor: "rgba(13,17,23,0.62)" },
  close: { width: HIT_TARGET, height: HIT_TARGET, alignItems: "center", justifyContent: "center", marginRight: -10 },
  disc: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.goldWash },
  lock: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: colors.ivory09 },
  taskRow: { flexDirection: "row", alignItems: "center", minHeight: 64, borderBottomWidth: 1, borderBottomColor: colors.ivory09 },
  checkHit: { width: HIT_TARGET, height: HIT_TARGET, alignItems: "center", justifyContent: "center", marginLeft: -10 },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.ivory40, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  taskMain: { flex: 1, minWidth: 0, minHeight: 64, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
});

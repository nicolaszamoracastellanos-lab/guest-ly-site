// Keeps the Apple Watch current and answers what it asks. Mounted once, inside
// the session (src/app/_layout.tsx): the host listens for watch actions and
// mounts the sync for the signed-in role. Every data component below reads
// queries the screens already run; nothing here is fetched while the watch is
// off, not paired, or this wedding has no flag.

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useLang } from "@/i18n";
import { errorText } from "@/features/shared/requests";
import { useBudgetSurface } from "@/features/budget/hooks";
import { cachedPack, packKey, packsVersion, subscribePacks } from "@/features/dayof/packStore";
import type { GuestPack } from "@/features/dayof/packCore";
import { useCoupleRunsheet } from "@/features/runsheet/hooks";
import { useTasksBoard } from "@/features/tasks/hooks";
import { useVendors } from "@/features/vendors/hooks";
import { streamPost } from "@/features/assistant/stream";
import { get, post } from "@/lib/api";
import {
  useCoupleDayOf,
  useCoupleHome,
  useGuestDayOf,
  useGuestHome,
  useGuestSchedule,
  useInbox,
  usePlannerAgenda,
  usePlannerCheckin,
  usePlannerPortfolio,
  usePlannerTasks,
} from "@/lib/hooks";
import { checkIn, newEventId } from "@/lib/queue";
import { registerScopedReset } from "@/lib/scope";
import { can, featureOn, useSession } from "@/lib/session";
import { createWatchActions, type WatchRoleName } from "./actions";
import { watchBridge as bridge } from "./bridge";
import { WATCH_FLAG, watchEnabled } from "./flag";
import { setLastArrival, useLastArrival } from "./lastArrival";
import { buildCoupleSnapshot, buildGuestSnapshot, buildPlannerSnapshot, emptySnapshot } from "./snapshot";
import type { WatchLang, WatchSnapshot } from "./types";

/** Dev only: EXPO_PUBLIC_WATCH_FORCE=1 turns the watch on without the release flag
 *  (never for alexnico2026). Not set in any eas.json profile. */
const FORCE = process.env.EXPO_PUBLIC_WATCH_FORCE === "1";

// ---------------------------------------------------------------- small hooks

/** Bumped when the watch asks for "refresh" or an action changed data. */
const resyncListeners = new Set<() => void>();
let resyncCount = 0;
const bumpResync = () => {
  resyncCount += 1;
  resyncListeners.forEach((l) => l());
};
const subscribeResync = (fn: () => void) => {
  resyncListeners.add(fn);
  return () => void resyncListeners.delete(fn);
};

/** Is a watch paired with this phone and the Guest-ly watch app installed on it? Re-read on foreground. */
function useWatchLink(): boolean {
  const [linked, setLinked] = useState(() => FORCE || (bridge.link().paired && bridge.link().installed));
  useEffect(() => {
    const read = () => {
      const l = bridge.link();
      setLinked(FORCE || (l.paired && l.installed));
    };
    read();
    const sub = AppState.addEventListener("change", (s) => s === "active" && read());
    const t = setInterval(read, 60_000);
    return () => {
      sub.remove();
      clearInterval(t);
    };
  }, []);
  return linked;
}

/** The current time, refreshed every minute while the app is active. */
function useMinute(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    const sub = AppState.addEventListener("change", (s) => s === "active" && setNow(Date.now()));
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, []);
  return now;
}

/** Sends the snapshot 2 s after it last changed, and again on foreground or a resync. */
function useSendSnapshot(snapshot: WatchSnapshot | null) {
  const resync = useSyncExternalStore(subscribeResync, () => resyncCount, () => resyncCount);
  const [fg, setFg] = useState(0);
  const lastSent = useRef("");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        lastSent.current = "";
        setFg((n) => n + 1);
      }
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!snapshot) return;
    const key = JSON.stringify({ ...snapshot, at: 0 });
    if (key === lastSent.current) return;
    const t = setTimeout(() => {
      lastSent.current = key;
      bridge.send(snapshot);
    }, 2000);
    return () => clearTimeout(t);
  }, [snapshot, resync, fg]);
}

// ---------------------------------------------------------------- per role

function CoupleWatchData({ lang }: { lang: WatchLang }) {
  const now = useMinute();
  const home = useCoupleHome();
  const tasks = useTasksBoard();
  const budget = useBudgetSurface();
  const vendors = useVendors();
  const inbox = useInbox("needs_you");
  const lastArrival = useLastArrival();
  const days = home.data?.countdown?.days;
  const near = home.data?.countdown ? home.data.countdown.passed || (days != null && days <= 2) : false;
  const dayof = useCoupleDayOf({ poll: near, enabled: near });
  const runsheet = useCoupleRunsheet();

  const snapshot = useMemo(() => {
    if (!home.data) return null;
    const active = budget.data?.active;
    return buildCoupleSnapshot(
      {
        nowMs: now,
        home: home.data,
        tasks: tasks.data,
        budget: active ? { paid: active.computed.totals.paidBase, total: active.computed.totals.totalBase, fraction: active.computed.totals.paidFraction, currency: active.budget.currency } : null,
        vendors: vendors.data,
        dayof: dayof.data,
        blocks: near ? (runsheet.data?.days ?? []).flatMap((d) => d.blocks) : [],
        inbox: inbox.data?.items,
        lastArrival,
      },
      lang
    );
  }, [now, home.data, tasks.data, budget.data, vendors.data, dayof.data, runsheet.data, inbox.data, lastArrival, near, lang]);
  useSendSnapshot(snapshot);
  return null;
}

function PlannerWatchData({ lang, canCheckin }: { lang: WatchLang; canCheckin: boolean }) {
  const now = useMinute();
  const portfolio = usePlannerPortfolio();
  const agenda = usePlannerAgenda();
  const tasks = usePlannerTasks();
  const lastArrival = useLastArrival();
  const todayIso = new Date(now).toISOString().slice(0, 10);
  const live = (portfolio.data?.weddings ?? []).some((w) => !w.passed && (w.days_to_go === 0 || (w.wedding_date ?? "").slice(0, 10) === todayIso));
  const checkinCounts = usePlannerCheckin({ poll: live, enabled: live && canCheckin });

  const snapshot = useMemo(() => {
    if (!portfolio.data) return null;
    return buildPlannerSnapshot(
      {
        nowMs: now,
        weddings: portfolio.data.weddings,
        tasks: tasks.data?.tasks,
        agenda: agenda.data?.agenda,
        checkin: checkinCounts.data ?? null,
        lastArrival,
      },
      lang
    );
  }, [now, portfolio.data, tasks.data, agenda.data, checkinCounts.data, lastArrival, lang]);
  useSendSnapshot(snapshot);
  return null;
}

/** The table, from the saved guest pack when the Day pack is on (never fetched here). */
function useGuestTable(owner: string, slug: string): string | null {
  useSyncExternalStore(subscribePacks, packsVersion, packsVersion);
  return cachedPack<GuestPack>(packKey(owner, slug))?.pack.table ?? null;
}

function GuestWatchData({ lang, guestId, guestName, slug }: { lang: WatchLang; guestId: string; guestName: string; slug: string }) {
  const now = useMinute();
  const home = useGuestHome();
  const schedule = useGuestSchedule();
  const dayOfNow = !!home.data?.day_of;
  const dayof = useGuestDayOf({ poll: false });
  const table = useGuestTable(`guest:${slug}:${guestId}`, slug);

  const snapshot = useMemo(() => {
    if (!home.data) return null;
    const events = dayOfNow && dayof.data?.events?.length ? dayof.data.events : (schedule.data?.events ?? []);
    return buildGuestSnapshot(
      {
        nowMs: now,
        guestId,
        guestName,
        home: { couple_names: home.data.couple_names, wedding_date: home.data.wedding_date, countdown: home.data.countdown, day_of: home.data.day_of, rsvp: { party_size: home.data.rsvp.party_size, status: home.data.rsvp.status } },
        events: events.map((e) => ({ id: e.id, title: e.title, date: e.date, time: e.time, location: e.location, state: "state" in e ? (e as { state: "done" | "now" | "next" | "later" }).state : undefined })),
        table,
      },
      lang
    );
  }, [now, home.data, schedule.data, dayof.data, dayOfNow, table, guestId, guestName, lang]);
  useSendSnapshot(snapshot);
  return null;
}

/** The "feature off" or "signed out" snapshot: the watch shows "Open Guest-ly on your iPhone". */
function SendEmpty({ lang, enabled }: { lang: WatchLang; enabled: boolean }) {
  const [at] = useState(() => Date.now());
  const snap = useMemo(() => emptySnapshot(lang, at, enabled), [lang, enabled, at]);
  useSendSnapshot(snap);
  return null;
}

// ---------------------------------------------------------------- host

/** The language the reset snapshot uses (set from the host; read outside React). */
const resetLang: { current: WatchLang } = { current: "en" };

/** Mount once inside the session. Answers watch actions and syncs the signed-in role. */
export function WatchHost() {
  const { state } = useSession();
  const { lang } = useLang();
  const qc = useQueryClient();
  const linked = useWatchLink();

  const role: WatchRoleName = state.status === "user" ? state.me.surface : state.status === "guest" ? "guest" : "none";
  const me = state.status === "user" ? state.me : null;
  const slug = state.status === "user" ? state.me.tenant.slug : state.status === "guest" ? state.tenant.slug : null;

  // The deps read the latest values through a ref, so the listener registers once.
  const live = useRef({ role, me, slug, lang });
  useEffect(() => {
    live.current = { role, me, slug, lang };
    resetLang.current = lang;
  });

  const refresh = useCallback(async () => {
    await qc.invalidateQueries();
    bumpResync();
  }, [qc]);

  useEffect(() => {
    if (!bridge.available()) return;
    const actions = createWatchActions({
      role: () => live.current.role,
      can: (tool, level) => can(live.current.me, tool, level),
      lang: () => live.current.lang,
      slug: () => live.current.slug,
      get: (path) => get(path),
      post: (path, body) => post(path, body),
      checkIn: async (item) => {
        const r = await checkIn(item);
        return r ? { already: r.already, guest: r.guest ? { name: r.guest.name, table: r.guest.table } : null } : null;
      },
      newEventId,
      now: () => Date.now(),
      stream: (path, body, onEvent) => streamPost(path, body, (e) => onEvent(e as never), { lang: live.current.lang }),
      refresh,
      onArrival: setLastArrival,
      errText: (e) => errorText(e, live.current.lang, ""),
    });
    return bridge.onAction((e) => {
      void actions.handle(e.type, e.payload).then((reply) => bridge.reply(e.id, reply));
    });
  }, [refresh]);

  // Two notification categories the watch draws its own looks for (no actions:
  // the look only needs the identifier). iOS ignores a category it does not know.
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    for (const id of ["gl.rsvp_new", "gl.escalation"]) void Notifications.setNotificationCategoryAsync(id, []).catch(() => {});
  }, []);

  // Sign out, guest change, 401 and wedding switch: the watch forgets whoever was there.
  useEffect(
    () =>
      registerScopedReset(() => {
        setLastArrival(null);
        bridge.send(emptySnapshot(resetLang.current, Date.now(), true));
      }),
    []
  );

  if (!bridge.available() || !linked) return null;
  if (role === "none") return <SendEmpty lang={lang} enabled />;

  const on = watchEnabled({ flagOn: me ? featureOn(me, WATCH_FLAG) : false, slug, force: FORCE });
  if (!on) return <SendEmpty lang={lang} enabled={false} />;

  if (role === "couple") return <CoupleWatchData key={slug} lang={lang} />;
  if (role === "planner") return <PlannerWatchData key={slug} lang={lang} canCheckin={can(me, "checkin", "view")} />;
  if (state.status === "guest") return <GuestWatchData key={state.guest.id} lang={lang} guestId={state.guest.id} guestName={state.guest.name} slug={state.tenant.slug} />;
  return null;
}

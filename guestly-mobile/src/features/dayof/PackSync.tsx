// Invisible components that keep the Day packs current (#30, D2) and tell the
// person what the outbox could not deliver (D4, D28). Each role layout mounts
// its own, like the widget sync.
//
// When: on mount, whenever the app comes to the foreground, when the network
// comes back (D5: a silent refresh, then one toast only if the timeline
// changed) and on a one-minute check while in the foreground; refreshDue keeps
// it to one request per 15 minutes per wedding, inside the 7 days before the
// wedding. The pack never downloads in the background (no background modes).

import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { fmt, useLang } from "@/i18n";
import { useOnline } from "@/lib/query";
import { featureOn, useGuestSession, useUserSession } from "@/lib/session";
import { usePlannerHome } from "@/lib/hooks";
import { registerScopedReset } from "@/lib/scope";
import { subscribeDrain } from "@/lib/queue";
import { toast, toastError } from "@/ui";
import { DAYOF_COPY } from "./copy";
import { DAY_PACK_FLAG, useDayPack, usePackOwner } from "./hooks";
import { fetchPack, lastChecked, loadPack, type PackKind } from "./packStore";
import { dayBeforePrompt, lastUsefulDay, refreshDue, type GuestPack } from "./packCore";
import { instantOf, serviceDayOf, usableTimeZone, wallClockAt } from "./live";

type Target = { kind: PackKind; slug: string; weddingDate: string | null; names: string };

function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/La_Paz";
  } catch {
    return "America/La_Paz";
  }
}

/** One wedding: fetch its pack when D2 says so. Returns the timeline changes of a fresh save (null otherwise). */
async function maybeRefresh(owner: string, t: Target, force: boolean): Promise<number | null> {
  const saved = await loadPack(owner, t.kind, t.slug);
  const meta = saved?.pack.meta ?? null;
  const tz = usableTimeZone(meta?.tz ?? deviceZone());
  const now = Date.now() + (saved?.offsetMs ?? 0);
  const clock = wallClockAt(now, tz);
  const today = serviceDayOf(clock.day, clock.minutes);
  const due = refreshDue({
    today,
    weddingDate: meta?.wedding_date ?? t.weddingDate,
    lastUseful: meta ? lastUsefulDay(meta) : null,
    lastCheckedAt: await lastChecked(owner, t.slug),
    now: Date.now(),
    force,
  });
  if (!due || !onlineManager.isOnline()) return null;
  const r = await fetchPack(owner, t.kind, t.slug);
  if (r.kind !== "saved") return null;
  if (t.kind !== "guest") void scheduleDayBefore(owner, t, r.entry.pack.meta.tz, r.entry.savedAt);
  return r.changes;
}

// ---------------------------------------------------------------- the evening before (D2)

const PROMPT_PREFIX = "gl-dayprompt-";
const promptKey = (owner: string, slug: string) => `gl.scoped.dayprompt:${owner}:${slug}`;
let promptLang: "en" | "es" = "en";

/**
 * One local notification at 19:00 venue time the evening before: "Open
 * Guest-ly once on Wi-Fi so tomorrow works without signal." Only when the
 * person already allowed notifications (never a new permission prompt), once
 * per wedding. A pack saved within two hours of it makes it pointless: then
 * it is cancelled.
 */
async function scheduleDayBefore(owner: string, t: Target, tz: string, savedAt: number) {
  try {
    const at = dayBeforePrompt(t.weddingDate);
    if (!at) return;
    const when = instantOf(at.day, at.minutes, usableTimeZone(tz));
    if (when === null) return;
    const id = `${PROMPT_PREFIX}${t.slug}`;
    const key = promptKey(owner, t.slug);
    if (savedAt >= when - 2 * 3_600_000) {
      if (await AsyncStorage.getItem(key)) {
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
        await AsyncStorage.setItem(key, "done");
      }
      return;
    }
    if (when <= Date.now() || (await AsyncStorage.getItem(key))) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;
    const c = DAYOF_COPY[promptLang];
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: t.kind === "planner" ? { title: c.plannerPromptTitle, body: fmt(c.plannerPromptBody, { names: t.names }) } : { title: c.promptTitle, body: c.promptBody },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
    });
    await AsyncStorage.setItem(key, "scheduled");
  } catch {
    // a reminder is a nicety: the pack works without it
  }
}

// Sign out: the reminders name the wedding, so they go with everything else.
registerScopedReset(async () => {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(all.filter((n) => n.identifier.startsWith(PROMPT_PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  } catch {
    // nothing scheduled
  }
});

// ---------------------------------------------------------------- the loop

function useRefreshLoop(targets: Target[], enabled: boolean) {
  const owner = usePackOwner();
  const { lang } = useLang();
  useEffect(() => {
    promptLang = lang;
  }, [lang]);
  const online = useOnline();
  const wasOnline = useRef(online);
  const key = targets.map((t) => `${t.kind}:${t.slug}:${t.weddingDate ?? ""}`).join("|");
  const latest = useRef(targets);
  useEffect(() => {
    latest.current = targets;
  });
  const run = useCallback(
    async (force: boolean, announce: boolean) => {
      if (!enabled || !owner) return;
      let changes = 0;
      for (const t of latest.current) {
        const n = await maybeRefresh(owner, t, force).catch(() => null);
        changes += n ?? 0;
      }
      if (announce && changes > 0) {
        const c = DAYOF_COPY[lang];
        toast(changes === 1 ? c.updatedChange : fmt(c.updatedChanges, { n: changes }), { icon: "info" });
      }
    },
    [enabled, owner, lang]
  );
  useEffect(() => {
    void run(false, false);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void run(false, false);
    });
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void run(false, false);
    }, 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [run, key]);
  useEffect(() => {
    // Back online: refresh now and say what changed, once.
    if (online && !wasOnline.current) void run(true, true);
    wasOnline.current = online;
  }, [online, run]);
}

// ---------------------------------------------------------------- per role

export function CoupleDayPackSync() {
  const s = useUserSession();
  const on = !!s && featureOn(s.me, DAY_PACK_FLAG);
  const targets: Target[] = s ? [{ kind: "couple", slug: s.me.tenant.slug, weddingDate: s.me.tenant.wedding_date, names: s.me.tenant.couple_names }] : [];
  useRefreshLoop(targets, on);
  return <OutboxNotices />;
}

/** A planner keeps the pack of every wedding in the next 7 days, not only the open one (D2). */
export function PlannerDayPackSync() {
  const s = useUserSession();
  const home = usePlannerHome();
  const on = !!s && featureOn(s.me, DAY_PACK_FLAG);
  const targets: Target[] = (home.data?.weddings ?? []).map((w) => ({ kind: "planner" as const, slug: w.slug, weddingDate: w.wedding_date, names: w.couple_names }));
  // The open wedding's flag gates the loop. Other weddings answer 404 while
  // their flag is off: the store keeps nothing for them and remembers the 404,
  // so each is asked again only after 15 minutes.
  useRefreshLoop(targets, on);
  return <OutboxNotices />;
}

export function GuestDayPackSync() {
  const g = useGuestSession();
  const targets: Target[] = g ? [{ kind: "guest", slug: g.tenant.slug, weddingDate: g.tenant.wedding_date, names: g.tenant.couple_names }] : [];
  // Guests have no features map: the 404 of a dark /guest/pack hides it (asked
  // again after 15 minutes, not on every one-minute check).
  useRefreshLoop(targets, !!g);
  // The schedule screen reads its query first. The query cache drops what is
  // older than 24 hours; the guest pack lasts to the end of the wedding, so a
  // guest who last opened the app three days before still has the schedule
  // offline on the day (D6). Seeded only when the query has nothing.
  const { entry } = useDayPack<GuestPack>("guest", g?.tenant.slug, !!g);
  const qc = useQueryClient();
  useEffect(() => {
    if (!entry || qc.getQueryData(["guest-schedule"]) !== undefined) return;
    const p = entry.pack;
    qc.setQueryData(["guest-schedule"], { wedding_date: p.meta.wedding_date, timezone: p.meta.tz, events: p.schedule, arrival_advice: null }, { updatedAt: entry.savedAt });
  }, [entry, qc]);
  return null;
}

/**
 * What the outbox dropped for good, said once per drain: a locked timeline in
 * D28's one sentence (however many taps it dropped), and the blocks that were
 * deleted on the web by name.
 */
export function OutboxNotices() {
  const { lang } = useLang();
  useEffect(
    () =>
      subscribeDrain((r) => {
        const c = DAYOF_COPY[lang];
        if (r.locked.length) toast(c.locked, { icon: "info", ms: 6000 });
        else if (r.gone.length) toastError(fmt(r.gone.length === 1 ? c.gone : c.goneMany, { names: r.gone.join(", ") }));
      }),
    [lang]
  );
  return null;
}

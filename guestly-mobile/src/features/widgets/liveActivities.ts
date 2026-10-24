// Starts, updates and ends the two Live Activities from the app (no push: the
// APNs path needs the APNs key, see docs/duo-v2/ESTADO.md). On the iPhone Duo
// the Dynamic Island is vertical on both displays; the activities implement
// every presentation Apple requires.
//
// Everything is optional and swallows errors: a build without expo-widgets,
// Live Activities turned off in Settings, or the simulator must never break the
// screen that asks for one.

import { Platform } from "react-native";
import type { DayOfActivityProps } from "@/widgets/GuestlyDayOfActivity";
import type { CheckinActivityProps } from "@/widgets/GuestlyCheckinActivity";
import { COPY } from "./copy";
import type { DayOfBlock } from "./sync";

type Lang = "en" | "es";
type Instance<T> = { update: (p: T) => Promise<void>; end: (policy?: "default" | "immediate") => Promise<void> };
type Factory<T> = { start: (p: T, url?: string) => Instance<T>; getInstances: () => Instance<T>[] };

function factory<T>(which: "dayof" | "checkin"): Factory<T> | null {
  if (Platform.OS !== "ios") return null;
  try {
    return (which === "dayof" ? require("@/widgets/GuestlyDayOfActivity").default : require("@/widgets/GuestlyCheckinActivity").default) as Factory<T>;
  } catch {
    return null;
  }
}

/** Returns what happened as text (shown by the probe build); the app ignores it. */
async function upsert<T>(f: Factory<T> | null, props: T, url: string): Promise<string> {
  if (!f) return "no module";
  try {
    const live = f.getInstances();
    if (live.length) {
      await live[0].update(props);
      return `updated ${live.length}`;
    }
    f.start(props, url);
    return "started";
  } catch (e) {
    // Live Activities disabled or unavailable
    return `ERR ${String(e).slice(0, 90)}`;
  }
}

async function endAll<T>(f: Factory<T> | null, policy: "default" | "immediate" = "default") {
  if (!f) return;
  try {
    await Promise.all(f.getInstances().map((i) => i.end(policy)));
  } catch {
    // nothing running
  }
}

/** Wedding day: "Now / Next". Ends when no block is in progress or coming. */
export async function syncDayOfActivity(blocks: DayOfBlock[], live: boolean, lang: Lang, path: string) {
  const f = factory<DayOfActivityProps>("dayof");
  const now = live ? blocks.find((b) => b.state === "now") : undefined;
  const next = live ? blocks.find((b) => b.state === "next") ?? blocks.find((b) => b.state === "later") : undefined;
  if (!now && !next) return endAll(f);
  const c = COPY[lang];
  await upsert(f, { nowLabel: c.now, nextLabel: c.next, now: now?.title ?? c.idle, nowTime: now?.starts_at.slice(0, 5) ?? "", place: now?.location ?? "", next: next?.title ?? "", nextTime: next?.starts_at.slice(0, 5) ?? "" }, `guestly://${path}`);
}

/** Door check-in: the counter and the last guest in. */
export async function syncCheckinActivity(arrived: number, total: number, last: string, lang: Lang) {
  await upsert(factory<CheckinActivityProps>("checkin"), { title: COPY[lang].checkin, arrived, total, last }, "guestly://couple/checkin");
}

export async function endCheckinActivity() {
  await endAll(factory<CheckinActivityProps>("checkin"));
}

/** Probe build only: start both with sample content. */
export async function startSampleActivities(lang: Lang): Promise<string> {
  const c = COPY[lang];
  const a = await upsert(factory<DayOfActivityProps>("dayof"), { nowLabel: c.now, nextLabel: c.next, now: lang === "es" ? "Ceremonia" : "Ceremony", nowTime: "17:00", place: lang === "es" ? "Jardín" : "Garden", next: lang === "es" ? "Cóctel" : "Cocktail", nextTime: "18:30" }, "guestly://couple/dayof");
  const b = await upsert(factory<CheckinActivityProps>("checkin"), { title: c.checkin, arrived: 142, total: 180, last: "Whitney Adler · table 5" }, "guestly://couple/checkin");
  return `dayof: ${a}\ncheckin: ${b}`;
}

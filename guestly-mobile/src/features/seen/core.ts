// #37 "Seen", the app's half (1.4.0, MW_SEEN). Pure, no imports: the rules
// are the portal's (src/lib/seen.ts), so the couple reads the same words on
// the phone and on the web.
//  - guests: GET /couple/guests items carry `seen_at` (last open, or null);
//    GET /couple/guests/{id} carries `seen` {first_seen_at, last_seen_at, views}.
//  - runsheet: GET /planner/runsheet carries `seen` {state, at, viewers[]};
//    the couple's runsheet screen POSTs /couple/runsheet/seen {version} on
//    focus (never on a refetch), with the `version` GET gave.
// Every key is optional: a missing key means the feature is not here, and
// nothing new shows. Status is an icon and words, never a color alone.

export type SeenWhen =
  | { kind: "now" }
  | { kind: "minutes"; n: number }
  | { kind: "today"; time: string }
  | { kind: "yesterday"; time: string }
  | { kind: "weekday"; day: string; time: string }
  | { kind: "date"; date: string };

const LOCALE = { en: "en-US", es: "es-MX" } as const;

function dayKey(t: number, timeZone?: string): string {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
  // en-CA formats as YYYY-MM-DD; keep only digits and dashes (Hermes may add marks).
  return d.replace(/[^\d-]/g, "");
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000);
}

/** When something was seen, as people say it (the portal's seenWhen): under a
 *  minute "now", under an hour minutes ago, then today, yesterday, a weekday
 *  inside six days (with the time), then a short date (year only when it is
 *  not this year). Spanish reads 24-hour times. Null for an unreadable value. */
export function seenWhen(iso: string | null | undefined, lang: "en" | "es", now: number = Date.now(), timeZone?: string): SeenWhen | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const ago = Math.max(0, now - t);
  if (ago < 60_000) return { kind: "now" };
  if (ago < 3_600_000) return { kind: "minutes", n: Math.floor(ago / 60_000) };
  const locale = LOCALE[lang];
  const time = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: lang === "es" ? "2-digit" : "numeric",
    minute: "2-digit",
    ...(lang === "es" ? { hourCycle: "h23" as const } : {}),
  }).format(new Date(t));
  const diff = dayDiff(dayKey(now, timeZone), dayKey(t, timeZone));
  if (diff <= 0) return { kind: "today", time };
  if (diff === 1) return { kind: "yesterday", time };
  if (diff < 7) {
    const day = new Intl.DateTimeFormat(locale, { timeZone, weekday: "short" }).format(new Date(t)).replace(/\.$/, "");
    return { kind: "weekday", day, time };
  }
  const sameYear = dayKey(now, timeZone).slice(0, 4) === dayKey(t, timeZone).slice(0, 4);
  const date = new Intl.DateTimeFormat(locale, { timeZone, day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" as const }) })
    .format(new Date(t))
    .replace(/\./g, "");
  return { kind: "date", date };
}

export type SeenWords = {
  now: string;
  minutes: string; // "{n} min ago"
  today: string; // "today {time}"
  yesterday: string; // "yesterday {time}"
  weekday: string; // "{day} {time}"
};

const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

export function whenText(w: SeenWhen, words: SeenWords): string {
  switch (w.kind) {
    case "now":
      return words.now;
    case "minutes":
      return fill(words.minutes, { n: w.n });
    case "today":
      return fill(words.today, { time: w.time });
    case "yesterday":
      return fill(words.yesterday, { time: w.time });
    case "weekday":
      return fill(words.weekday, { day: w.day, time: w.time });
    case "date":
      return w.date;
  }
}

/** A guest row's Seen: the key is there (feature on) and holds an instant. */
export function guestSeenAt(item: { seen_at?: string | null }): { on: boolean; at: string | null } {
  if (!("seen_at" in item)) return { on: false, at: null };
  return { on: true, at: typeof item.seen_at === "string" && item.seen_at ? item.seen_at : null };
}

export type GuestSeen = { first_seen_at: string; last_seen_at: string; views: number };

/** The guest card's line: undefined = feature off (show nothing); null = never seen. */
export function readGuestSeen(detail: unknown): GuestSeen | null | undefined {
  if (!detail || typeof detail !== "object" || !("seen" in detail)) return undefined;
  const s = (detail as { seen?: unknown }).seen;
  if (!s || typeof s !== "object") return null;
  const o = s as Record<string, unknown>;
  if (typeof o.last_seen_at !== "string") return null;
  return { first_seen_at: typeof o.first_seen_at === "string" ? o.first_seen_at : o.last_seen_at, last_seen_at: o.last_seen_at, views: typeof o.views === "number" ? o.views : 1 };
}

export type RunsheetViewer = { name: string | null; role: "owner" | "admin" | "viewer" | string; seen_at: string; current: boolean };
export type RunsheetSeen = { state: "none" } | { state: "current" | "stale"; at: string; viewers: RunsheetViewer[] };

export function readRunsheetSeen(data: unknown): RunsheetSeen | null {
  if (!data || typeof data !== "object") return null;
  const s = (data as { seen?: unknown }).seen;
  if (!s || typeof s !== "object") return null;
  const o = s as Record<string, unknown>;
  if (o.state === "none") return { state: "none" };
  if ((o.state === "current" || o.state === "stale") && typeof o.at === "string") {
    const viewers = Array.isArray(o.viewers) ? (o.viewers as RunsheetViewer[]).filter((v) => v && typeof v.seen_at === "string") : [];
    return { state: o.state, at: o.at, viewers };
  }
  return null;
}

/** Who a runsheet viewer is, so a parent with view access is never read as the couple. */
export function viewerLabel(v: Pick<RunsheetViewer, "name" | "role">, roles: Record<"owner" | "admin" | "viewer", { tag: string; anon: string }>): string {
  const r = roles[(v.role as "owner" | "admin" | "viewer")] ?? roles.viewer;
  if (!v.name) return r.anon;
  return r.tag ? `${v.name} (${r.tag})` : v.name;
}

export function listNames(names: string[], and: string): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`;
}

/** When the couple's runsheet screen should stamp: once per focus and per
 *  version; never without a version (feature off or an older portal). */
export function shouldStamp(version: unknown, lastStamped: string | null): version is string {
  return typeof version === "string" && version.length > 0 && version !== lastStamped;
}

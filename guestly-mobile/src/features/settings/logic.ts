// Pure helpers of the Settings area (HH wave F). No React, no React Native:
// scripts/tests/settings.test.ts runs them under plain node.

// ---------------------------------------------------------------- time zones

/** The zones the picker offers, grouped by region, the couples' markets first.
 *  A stored zone outside this list is still shown (zoneGroups adds it). */
export const ZONE_REGIONS: { key: string; en: string; es: string; zones: string[] }[] = [
  {
    key: "americas",
    en: "Americas",
    es: "América",
    zones: [
      "America/La_Paz",
      "America/Lima",
      "America/Bogota",
      "America/Guayaquil",
      "America/Caracas",
      "America/Santiago",
      "America/Argentina/Buenos_Aires",
      "America/Montevideo",
      "America/Asuncion",
      "America/Sao_Paulo",
      "America/Mexico_City",
      "America/Cancun",
      "America/Monterrey",
      "America/Tijuana",
      "America/Guatemala",
      "America/El_Salvador",
      "America/Costa_Rica",
      "America/Panama",
      "America/Santo_Domingo",
      "America/Puerto_Rico",
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Phoenix",
      "America/Los_Angeles",
      "America/Anchorage",
      "Pacific/Honolulu",
      "America/Toronto",
      "America/Vancouver",
    ],
  },
  {
    key: "europe",
    en: "Europe",
    es: "Europa",
    zones: ["Europe/Madrid", "Europe/Lisbon", "Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Rome", "Europe/Berlin", "Europe/Amsterdam", "Europe/Zurich", "Europe/Athens", "Atlantic/Canary"],
  },
  {
    key: "other",
    en: "Rest of the world",
    es: "Resto del mundo",
    zones: ["Asia/Dubai", "Asia/Tokyo", "Asia/Bangkok", "Asia/Singapore", "Asia/Ho_Chi_Minh", "Asia/Taipei", "Australia/Sydney", "Pacific/Auckland", "Africa/Johannesburg", "UTC"],
  },
];

const ALL_ZONES = new Set(ZONE_REGIONS.flatMap((r) => r.zones));

/** "America/Argentina/Buenos_Aires" -> "Buenos Aires"; "UTC" stays. */
export function zoneCity(tz: string): string {
  return (tz.split("/").pop() ?? tz).replace(/_/g, " ");
}

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** The picker's sections for a search: matches on the city, the region or
 *  the raw id, accent-insensitive. The current and the phone's zone are kept
 *  in front (under "pinned") even when they are not in the curated list. */
export function zoneGroups(
  query: string,
  lang: "en" | "es",
  pinned: (string | null | undefined)[] = []
): { key: string; title: string; zones: string[] }[] {
  const q = fold(query.trim());
  const hit = (tz: string) => !q || fold(zoneCity(tz)).includes(q) || fold(tz).includes(q);
  const pins = [...new Set(pinned.filter((z): z is string => !!z && validZone(z)))].filter(hit);
  const out: { key: string; title: string; zones: string[] }[] = [];
  if (pins.length) out.push({ key: "pinned", title: "", zones: pins });
  for (const r of ZONE_REGIONS) {
    const zones = r.zones.filter((z) => hit(z) && !pins.includes(z));
    if (zones.length) out.push({ key: r.key, title: lang === "es" ? r.es : r.en, zones });
  }
  return out;
}

/** An IANA-looking id: "Area/City" or UTC. The server validates for real. */
export function validZone(tz: string): boolean {
  return tz === "UTC" || ALL_ZONES.has(tz) || /^[A-Z][A-Za-z_]+(\/[A-Za-z0-9_+-]+){1,2}$/.test(tz);
}

// ---------------------------------------------------------------- general

export type GeneralDraft = {
  couple_names: string;
  wedding_date: string | null;
  wedding_city: string | null;
  venue_booked: boolean;
  timezone: string;
  locale_default: "en" | "es";
};

const GENERAL_KEYS: (keyof GeneralDraft)[] = ["couple_names", "wedding_date", "wedding_city", "venue_booked", "timezone", "locale_default"];

/** Only the keys that changed, so a save never rewrites what the couple did
 *  not touch (the server merges a partial over the stored values). */
export function generalPatch(base: GeneralDraft, draft: GeneralDraft): Partial<GeneralDraft> {
  const out: Partial<GeneralDraft> = {};
  for (const k of GENERAL_KEYS) {
    const a = base[k];
    const b = typeof draft[k] === "string" ? (draft[k] as string).trim() : draft[k];
    const norm = (v: unknown) => (v === "" ? null : v);
    if (norm(a) !== norm(b)) (out as Record<string, unknown>)[k] = k === "couple_names" ? b : norm(b);
  }
  return out;
}

// ---------------------------------------------------------------- prefs

export type PrefsLike = {
  events: { key: string; channels: Partial<Record<"email" | "push" | "bell", boolean>>; mode?: "instant" | "daily" }[];
  rsvp_mode: "instant" | "daily";
  quiet_hours: { start: number; end: number } | null;
  marketing: { event: string; consent: boolean; unsubscribed: boolean };
};

export type PrefsChangeLike =
  | { event: string; channel: "email" | "push" | "bell"; enabled: boolean }
  | { event: "rsvp_new"; mode: "instant" | "daily" }
  | { quiet_hours: { start: number; end: number } | null }
  | { marketing: boolean };

/** The optimistic copy of the preference view after one change. A cell the
 *  event does not have stays absent (the server never stores it either). */
export function applyPrefChange<P extends PrefsLike>(p: P, change: PrefsChangeLike): P {
  if ("marketing" in change) return { ...p, marketing: { ...p.marketing, consent: change.marketing, unsubscribed: change.marketing ? false : p.marketing.unsubscribed } };
  if ("quiet_hours" in change) return { ...p, quiet_hours: change.quiet_hours };
  if ("mode" in change) return { ...p, rsvp_mode: change.mode, events: p.events.map((e) => (e.key === "rsvp_new" ? { ...e, mode: change.mode } : e)) };
  return {
    ...p,
    events: p.events.map((e) => (e.key === change.event && change.channel in e.channels ? { ...e, channels: { ...e.channels, [change.channel]: change.enabled } } : e)),
  };
}

/** Hours 0..23 as the picker shows them, "21:00". */
export function hourLabel(h: number): string {
  return `${String(((h % 24) + 24) % 24).padStart(2, "0")}:00`;
}

// ---------------------------------------------------------------- team

export function openInvites(invites: { status: string }[] | null | undefined): number {
  return (invites ?? []).filter((i) => i.status === "pending").length;
}

/** "a***@gmail.com" stays as the server masked it; an email typed in the
 *  sheet is checked loosely here and for real on the server. */
export function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
}

// ---------------------------------------------------------------- billing

/** Guests used against the plan cap, 0..1 for the bar; null when uncapped. */
export function capShare(used: number, cap: number | null | undefined): number | null {
  if (!cap || cap <= 0) return null;
  return Math.max(0, Math.min(1, used / cap));
}

// ---------------------------------------------------------------- connections

export type ConnLike = { category: string; status: "connected" | "needs_attention" | "not_set_up" };

/** Items grouped in the server's category order; a category the server did
 *  not name (an older portal) goes last under its key. */
export function groupConnections<I extends ConnLike>(items: I[], categories: { key: string; name: string }[]): { key: string; name: string; items: I[] }[] {
  const order = categories.map((c) => c.key);
  const keys = [...new Set([...order, ...items.map((i) => i.category)])];
  return keys
    .map((key) => ({ key, name: categories.find((c) => c.key === key)?.name ?? key, items: items.filter((i) => i.category === key) }))
    .filter((g) => g.items.length > 0);
}

/** How many cards are not connected (the Settings row's live line). */
export function needSetup(items: ConnLike[] | null | undefined): number {
  return (items ?? []).filter((i) => i.status !== "connected").length;
}

// ---------------------------------------------------------------- push on this phone

/** Which push preference key on this phone (lib/push registerPush prefs) a
 *  server event's Push cell drives. The portal maps bell types the same way
 *  (src/lib/push.ts on the portal: request_new and escalation both ring
 *  "escalations"). */
export const DEVICE_PUSH_KEY: Record<"couple" | "planner", Record<string, string>> = {
  couple: { rsvp_new: "rsvps", escalation: "escalations", request_new: "escalations", task_due: "tasks" },
  planner: { request_new: "approvals", escalation: "approvals", task_due: "tasks" },
};

/** The phone's push prefs after the preference center changed: every device
 *  key driven by server events is on while any of its events has Push on;
 *  keys no event drives (album, team) keep their stored value. */
export function devicePushPrefs(
  surface: "couple" | "planner",
  events: { key: string; channels: Partial<Record<"email" | "push" | "bell", boolean>> }[],
  stored: Record<string, boolean>
): Record<string, boolean> {
  const map = DEVICE_PUSH_KEY[surface];
  const out: Record<string, boolean> = { ...stored };
  const driven = new Map<string, boolean>();
  for (const e of events) {
    const k = map[e.key];
    if (!k || e.channels.push === undefined) continue;
    driven.set(k, (driven.get(k) ?? false) || e.channels.push === true);
  }
  for (const [k, v] of driven) out[k] = v;
  return out;
}

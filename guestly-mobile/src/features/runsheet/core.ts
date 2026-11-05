// Runsheet 1.4.0 payload pieces and the rules the screens follow, pure (no
// imports) so scripts/tests/runsheet-mw.test.ts runs them under node.
//
//  #2  locked timeline: `lock` and the open change `requests` (MW_RUNSHEET_LOCK).
//      The server decides who may write; the app only shows it. A couple on a
//      locked timeline sends change requests instead of saving; a person who may
//      not mark statuses sees a plain badge and D28's one sentence, never a
//      control that would be refused.
//  #9  places: `places` (stops of the day, both map links) and block `place_id`
//      (MW_PLACES). Map buttons are deep links only (no map SDK, no key).
//  #40 hair and makeup: glam blocks carry `glam` slots and `glam_warnings`
//      (MW_HMU), read only in the app this wave.
//  K7  a delete answers { deleted, restorable }: Undo restores the same block
//      (same id) when restorable, else records it again (an older portal).
//
// Every key is optional: builds below 1.4.0 never get them and a flag that is
// off leaves them out, so a missing key means "this feature is not here".

export type GlamService = "hair" | "makeup" | "both" | "other";

export type GlamSlot = {
  id: string;
  person: string;
  service: GlamService | string;
  stylist_name: string | null;
  stylist_vendor_id: string | null;
  starts_at: string;
  ends_at: string;
  offset_min: number;
  duration_min: number;
  notes: string;
};

export type GlamWarning = { kind: "overlap" | "after_end" | "twice" | string; ids: string[]; at: string };

export type PlaceKind = "getting_ready" | "ceremony" | "reception" | "hotel" | "transport" | "other";
export const PLACE_KINDS: PlaceKind[] = ["ceremony", "reception", "getting_ready", "hotel", "transport", "other"];

/** One stop of the day as /couple|planner/runsheet carries it (PublicPlace). */
export type RunsheetPlace = {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  /** HH:MM of the earliest block at this place, or null. */
  time: string | null;
  note: string | null;
  kind: PlaceKind | string;
  day: string | null;
  apple_maps_url: string | null;
  google_maps_url: string | null;
  same_place_as_before: boolean;
};

/** A place as /couple/places answers it (the stop plus what the form needs). */
export type AppPlace = RunsheetPlace & { maps_link: string | null; show_on_site: boolean };

export type RunsheetLock = {
  locked: boolean;
  at: string | null;
  by_name: string | null;
  note: string | null;
  /** May this person change statuses now (D28). */
  can_mark: boolean;
  /** Couple editing role while locked: send change requests. */
  can_request: boolean;
  /** Planning side: lock, unlock, approve, decline. */
  can_resolve: boolean;
};

export type RequestKind = "edit" | "add" | "remove" | "other";
export type ProposalField = "day" | "starts_at" | "ends_at" | "title" | "detail" | "location" | "owner" | "vendor_id" | "status" | "place_id";
export type FieldChange = { field: ProposalField | string; before: string; after: string };
export type BlockProposal = {
  day: string;
  starts_at: string;
  ends_at: string | null;
  title: string;
  detail: string;
  location: string;
  owner: string;
  vendor_id: string | null;
  status: string;
  place_id?: string | null;
};

export type ChangeRequest = {
  id: string;
  kind: RequestKind | string;
  status: "open" | "approved" | "declined" | "withdrawn" | string;
  target_id: string | null;
  title: string;
  note: string;
  created_at: string;
  created_by_name: string | null;
  changes: FieldChange[];
  proposed: BlockProposal | null;
  base: (BlockProposal & { id: string; updated_at: string | null; vendor_name?: string | null }) | null;
  decline_note: string | null;
};

/** The block fields a request compares (the RunsheetBlock shape, kept local). */
export type BlockLike = {
  id: string;
  day: string;
  starts_at: string;
  ends_at: string | null;
  title: string;
  detail: string;
  location: string;
  owner: string;
  vendor_id: string | null;
  status: string;
  place_id?: string | null;
};

/** The form as the screens hold it (strings, "" for none). */
export type FormLike = {
  day: string;
  starts_at: string;
  ends_at: string;
  title: string;
  detail: string;
  location: string;
  owner: string;
  vendor_id: string;
  status: string;
  place_id?: string;
};

type SurfaceLike = { can_edit: boolean; lock?: RunsheetLock | null; requests?: ChangeRequest[] | null; places?: RunsheetPlace[] | null };

// ------------------------------------------------------------------ #2 lock

export type LockView = {
  /** The timeline is locked (only ever true with the flag on and 1.4.0). */
  locked: boolean;
  /** May add, edit, delete blocks and places directly. */
  canEdit: boolean;
  /** May change a block's status (the status control shows only then). */
  canMark: boolean;
  /** Sends change requests instead of saving (couple, locked). */
  canRequest: boolean;
  /** Planning side: lock and unlock, approve and decline. */
  canResolve: boolean;
  /** Locked and this person may not mark: show D28's sentence once. */
  showMarkSentence: boolean;
};

export function lockView(s: SurfaceLike, opts: { planner?: boolean } = {}): LockView {
  const lock = s.lock ?? null;
  if (!lock) {
    // Flag off or a portal without #2: today's rules. The planner app stays
    // read-only (as on the web before #2).
    return { locked: false, canEdit: s.can_edit, canMark: opts.planner ? false : s.can_edit, canRequest: false, canResolve: false, showMarkSentence: false };
  }
  const canMark = lock.can_mark && (opts.planner ? true : lock.locked ? true : s.can_edit);
  return {
    locked: lock.locked,
    canEdit: s.can_edit && !lock.locked,
    // The planner marks through the day-of view (#30); the planner runsheet
    // has no status route, so the planner list keeps plain badges.
    canMark: opts.planner ? false : canMark,
    canRequest: lock.locked && lock.can_request,
    canResolve: lock.can_resolve,
    showMarkSentence: !opts.planner && lock.locked && !lock.can_mark && (s.can_edit || lock.can_request),
  };
}

/** Open requests by the block they are about (edit and remove). */
export function requestsByBlock(requests: readonly ChangeRequest[] | null | undefined): Map<string, ChangeRequest[]> {
  const out = new Map<string, ChangeRequest[]>();
  for (const r of requests ?? []) {
    if (r.status !== "open" || !r.target_id) continue;
    const list = out.get(r.target_id) ?? [];
    list.push(r);
    out.set(r.target_id, list);
  }
  return out;
}

export function openRequests(requests: readonly ChangeRequest[] | null | undefined): ChangeRequest[] {
  return (requests ?? []).filter((r) => r.status === "open");
}

const FIELDS: ProposalField[] = ["day", "starts_at", "ends_at", "title", "detail", "location", "owner", "vendor_id", "status", "place_id"];

function norm(field: string, v: unknown): string {
  const s = typeof v === "string" ? v : v === null || v === undefined ? "" : String(v);
  return field === "starts_at" || field === "ends_at" ? s.slice(0, 5) : s.trim();
}

/** What a request would change, the way the portal's proposalDiff counts it:
 *  only fields that differ (times by HH:MM, text trimmed); place_id only when
 *  places are on for the wedding. Empty: nothing to send. */
export function proposalChanges(base: BlockLike | null, form: FormLike, placesOn: boolean): FieldChange[] {
  const out: FieldChange[] = [];
  for (const field of FIELDS) {
    if (field === "place_id" && !placesOn) continue;
    const before = norm(field, base ? (base as Record<string, unknown>)[field] : "");
    const after = norm(field, (form as Record<string, unknown>)[field]);
    if (before !== after) out.push({ field, before, after });
  }
  return out;
}

/** The body of POST /couple/runsheet/requests. */
export function requestBody(
  kind: "edit" | "add" | "remove",
  blockId: string | null,
  block: Record<string, unknown> | null,
  note: string,
): { kind: string; block_id?: string; block?: Record<string, unknown>; note?: string } {
  return {
    kind,
    ...(blockId ? { block_id: blockId } : {}),
    ...(kind !== "remove" && block ? { block } : {}),
    ...(note.trim() ? { note: note.trim().slice(0, 500) } : {}),
  };
}

/** One Idempotency-Key per tap of Send (a retry after a timeout reuses it). */
export function newRequestKey(rand: () => number = Math.random): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join("");
  return `rq-${hex(8)}-${hex(4)}-${hex(12)}`;
}

/** The lock's day as people say it ("Nov 5" / "5 nov"), in the phone's zone
 *  (an instant, not a wedding time). Null when there is no usable stamp. */
export function lockDate(at: string | null, lang: "en" | "es"): string | null {
  if (!at) return null;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", { month: "short", day: "numeric" }).format(d).replace(/\.$/, "");
  } catch {
    return null;
  }
}

/** What a failed approve tells the screen: the block changed after the
 *  request (show both, offer Apply anyway), the block is gone (offer it as a
 *  new block), someone already answered, or something else. */
export function approveOutcome(f: { status: number; code: string; reason: string | null } | null): "stale" | "target_gone" | "already_resolved" | "locked" | "other" {
  if (!f) return "other";
  if (f.code === "stale" && f.reason === "target_gone") return "target_gone";
  if (f.code === "stale") return "stale";
  if (f.code === "already_resolved") return "already_resolved";
  if (f.code === "runsheet_locked") return "locked";
  return "other";
}

// ------------------------------------------------------------------ K7 delete

/** How Undo brings a deleted block back. */
export function undoKind(answer: unknown): "restore" | "recreate" {
  return answer && typeof answer === "object" && (answer as { restorable?: unknown }).restorable === true ? "restore" : "recreate";
}

// ------------------------------------------------------------------ #9 places

export function placesOn(s: { places?: unknown }): boolean {
  return Array.isArray(s.places);
}

const enc = encodeURIComponent;
const hasCoords = (p: { lat: number | null; lng: number | null }) => typeof p.lat === "number" && typeof p.lng === "number" && Number.isFinite(p.lat) && Number.isFinite(p.lng);
const httpsOnly = (u: string | null | undefined): string | null => (typeof u === "string" && /^https:\/\/[^\s]+$/i.test(u.trim()) ? u.trim() : null);

/** Apple Maps and Google Maps links for one place: the server's (it knows the
 *  couple's pasted pin), else built from coordinates or the address. https
 *  only: Apple's opens the Maps app, Google's opens Google Maps when it is
 *  installed and the browser otherwise. Null when there is nothing to search. */
export function mapLinks(p: Pick<RunsheetPlace, "name" | "address" | "lat" | "lng" | "apple_maps_url" | "google_maps_url">): { apple: string | null; google: string | null } {
  const name = (p.name ?? "").trim();
  const address = (p.address ?? "").trim();
  let apple = httpsOnly(p.apple_maps_url);
  let google = httpsOnly(p.google_maps_url);
  if (!apple) {
    if (hasCoords(p)) apple = `https://maps.apple.com/?ll=${p.lat},${p.lng}&q=${enc(name || address || `${p.lat},${p.lng}`)}`;
    else if (address) apple = `https://maps.apple.com/?q=${enc(name || address)}&address=${enc(address)}`;
    else if (name) apple = `https://maps.apple.com/?q=${enc(name)}`;
  }
  if (!google) {
    if (hasCoords(p)) google = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
    else {
      const q = [name, address].filter(Boolean).join(", ");
      if (q) google = `https://www.google.com/maps/search/?api=1&query=${enc(q)}`;
    }
  }
  return { apple, google };
}

export function placeById(places: readonly RunsheetPlace[] | null | undefined, id: string | null | undefined): RunsheetPlace | null {
  if (!id || !places) return null;
  return places.find((p) => p.id === id) ?? null;
}

// ------------------------------------------------------------------ #40 hair and makeup

const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/[áàäâ]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/\s+/g, " ")
    .trim();

/** Minutes since 05:00 (a 01:30 slot sorts after 23:00, as the list does). */
export function serviceMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10) || 0);
  const mins = h * 60 + m;
  return mins < 5 * 60 ? mins + 24 * 60 : mins;
}

export function isGlam(b: { kind?: string; glam?: unknown }): boolean {
  return b.kind === "glam";
}

/** Slots in time order (then stylist, then person). */
export function sortedSlots(slots: readonly GlamSlot[]): GlamSlot[] {
  return [...slots].sort(
    (a, b) =>
      serviceMinutes(a.starts_at) - serviceMinutes(b.starts_at) ||
      fold(a.stylist_name ?? "").localeCompare(fold(b.stylist_name ?? "")) ||
      fold(a.person).localeCompare(fold(b.person)),
  );
}

/** "6 people, 2 stylists, 12:00 to 14:45": people are name plus note (two
 *  María with different notes are two people), stylists by name; no stylist
 *  yet does not count as one. */
export function glamSummary(slots: readonly GlamSlot[]): { people: number; stylists: number; start: string | null; end: string | null } {
  if (!slots.length) return { people: 0, stylists: 0, start: null, end: null };
  const people = new Set(slots.map((s) => `${fold(s.person)}|${fold(s.notes ?? "")}`));
  const stylists = new Set(slots.map((s) => (s.stylist_vendor_id ? `v:${s.stylist_vendor_id}` : s.stylist_name ? `n:${fold(s.stylist_name)}` : "")).filter(Boolean));
  let start = slots[0].starts_at;
  let end = slots[0].ends_at;
  for (const s of slots) {
    if (serviceMinutes(s.starts_at) < serviceMinutes(start)) start = s.starts_at;
    if (serviceMinutes(s.ends_at) > serviceMinutes(end)) end = s.ends_at;
  }
  return { people: people.size, stylists: stylists.size, start, end };
}

/** Each warning as the words the screen shows: who or which stylist, and when. */
export function glamWarningParts(w: GlamWarning, slots: readonly GlamSlot[]): { kind: "overlap" | "after_end" | "twice"; who: string; at: string } | null {
  const first = slots.find((s) => w.ids.includes(s.id));
  if (!first) return null;
  if (w.kind === "overlap") return first.stylist_name ? { kind: "overlap", who: first.stylist_name, at: w.at } : null;
  if (w.kind === "after_end") return { kind: "after_end", who: first.person, at: w.at };
  if (w.kind === "twice") return { kind: "twice", who: first.person, at: w.at };
  return null;
}

/** Slot ids under a warning (the rows get the warning mark too). */
export function warnedSlotIds(warnings: readonly GlamWarning[] | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const w of warnings ?? []) for (const id of w.ids) out.add(id);
  return out;
}

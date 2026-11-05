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
//      (same id). On a portal not known to restore, the DELETE waits until the
//      Undo toast leaves (runDelete); a block is never re-created by Undo.
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
 *  places are on for the wedding; status only when this person may mark
 *  (D28: on a locked timeline the planner marks, so a request never carries
 *  a status). Empty: nothing to send. */
export function proposalChanges(base: BlockLike | null, form: FormLike, placesOn: boolean, statusOn = true): FieldChange[] {
  const out: FieldChange[] = [];
  for (const field of FIELDS) {
    if (field === "place_id" && !placesOn) continue;
    if (field === "status" && !statusOn) continue;
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

/** Did the DELETE answer say the same block can come back (K7)? */
export function undoKind(answer: unknown): "restore" | "none" {
  return answer && typeof answer === "object" && (answer as { restorable?: unknown }).restorable === true ? "restore" : "none";
}

/** The effects a delete with Undo needs, injected so node can fault them. */
export type DeleteEffects = {
  /** Optimistic: the row leaves the list. */
  hide(): void;
  /** The row comes back (Undo, or a rollback). */
  show(): void;
  /** DELETE /couple/runsheet/{id}. */
  send(): Promise<unknown>;
  /** POST /couple/runsheet/{id}/restore. */
  restore(): Promise<unknown>;
  /** Shows "Moment deleted: X" with Undo; onLeave runs when it leaves without
   *  Undo. Returns a function that closes it. */
  toast(undo: () => void, onLeave?: () => void): () => void;
  /** Says what failed (and that the row is back, or gone again). */
  failed(what: "delete" | "restore", err: unknown): void;
  /** Reads the server again. */
  settled(): void;
  /** This portal is known to restore deleted blocks (an earlier DELETE said so). */
  knowsRestore(): boolean;
  learnRestore(restorable: boolean): void;
};

export type DeleteOutcome = "deleted" | "undone" | "restored" | "rolled_back";

/** K7 and quality bar 5.3. Never undoes by re-creating (a new id):
 *  - the portal restores (known): commit now; Undo restores the same id;
 *  - not known yet (an older portal): hide the row and send the DELETE only
 *    when the toast leaves without Undo; Undo then sends nothing.
 *  A refused delete puts the row back and says so; a refused restore takes the
 *  row out again and says so. Resolves once the sequence has settled. */
export function runDelete(fx: DeleteEffects): Promise<DeleteOutcome> {
  fx.hide();
  return new Promise<DeleteOutcome>((resolve) => {
    if (fx.knowsRestore()) {
      const pending = fx.send();
      let undone = false;
      const dismiss = fx.toast(() => {
        undone = true;
        void undo();
      });
      pending.then(
        (answer) => {
          fx.learnRestore(undoKind(answer) === "restore");
          if (!undone) {
            fx.settled();
            resolve("deleted");
          }
        },
        (err) => {
          dismiss();
          fx.show();
          // Undo pressed before the refusal came back: the row is simply back.
          if (!undone) fx.failed("delete", err);
          fx.settled();
          resolve(undone ? "undone" : "rolled_back");
        },
      );
      async function undo() {
        let answer: unknown;
        try {
          answer = await pending;
        } catch {
          return; // the refusal above already put the row back
        }
        if (undoKind(answer) !== "restore") {
          // Deleted for good on a portal that cannot restore: say so, never re-create.
          fx.failed("restore", null);
          fx.settled();
          resolve("deleted");
          return;
        }
        fx.show();
        try {
          await fx.restore();
          resolve("restored");
        } catch (err) {
          fx.hide();
          fx.failed("restore", err);
          resolve("deleted");
        } finally {
          fx.settled();
        }
      }
      return;
    }
    let decided = false;
    fx.toast(
      () => {
        if (decided) return;
        decided = true;
        fx.show();
        resolve("undone");
      },
      () => {
        if (decided) return;
        decided = true;
        fx.send().then(
          (answer) => {
            fx.learnRestore(undoKind(answer) === "restore");
            fx.settled();
            resolve("deleted");
          },
          (err) => {
            fx.show();
            fx.failed("delete", err);
            fx.settled();
            resolve("rolled_back");
          },
        );
      },
    );
  });
}

// ------------------------------------------------------------------ #2 lock toggle

/** Lock or unlock with the screen updated first (quality bar 5.2): the new
 *  state shows at once, the server's lock replaces it, a refusal puts the
 *  previous lock back. `draft`: the server refused because the timeline is
 *  still a draft the couple has not seen (offer "Release and lock"). */
export async function runLockToggle(
  before: RunsheetLock,
  locked: boolean,
  fx: { apply(lock: RunsheetLock): void; send(): Promise<{ lock: RunsheetLock | null }> },
): Promise<{ ok: true; lock: RunsheetLock } | { ok: false; draft: boolean; err: unknown }> {
  fx.apply({ ...before, locked });
  try {
    const res = await fx.send();
    const lock = res && res.lock ? res.lock : { ...before, locked };
    fx.apply(lock);
    return { ok: true, lock };
  } catch (err) {
    fx.apply(before);
    const reason = err && typeof err === "object" ? (err as { reason?: unknown }).reason : null;
    return { ok: false, draft: reason === "draft", err };
  }
}

/** The Idempotency-Key of one approval: the same request, the same choice and
 *  the same version of the block give the same key, so a retry after a
 *  timeout is the same approval (quality bar 5.4). The server takes
 *  [A-Za-z0-9_-]{8,100}. */
export function approveKey(r: Pick<ChangeRequest, "id" | "base">, opts: { applyAnyway?: boolean; asNew?: boolean } = {}): string {
  const mode = opts.asNew ? "new" : opts.applyAnyway ? "any" : "ok";
  const version = r.base?.updated_at ?? "";
  // FNV-1a over the version stamp: short and in the allowed alphabet.
  let h = 0x811c9dc5;
  for (let i = 0; i < version.length; i++) {
    h ^= version.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const id = r.id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
  return `ap-${id}-${mode}-${h.toString(16)}`;
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

// The planner request form's body, built exactly as the portal validates it
// (lib/requests validateRequestInput): additional_seats 1..5, party_size an
// integer 1..40, tags a list, language "en" or "es", reminders naming at
// least one guest. Pure, so it is unit-tested apart from the screen.

export type RequestKind = "plus_one" | "edit_guest" | "guest_help" | "custom" | "send_reminders";
export type EditField = "name" | "party_size" | "tags" | "notes" | "language";

export type RequestForm = {
  kind: RequestKind;
  guestId: string | null;
  seats: string;
  field: EditField | "";
  value: string;
  title: string;
  note: string;
};

export const MAX_REMIND = 200;

export function patchValue(field: EditField | "", value: string): unknown {
  const v = value.trim();
  if (field === "party_size") return parseInt(v, 10);
  if (field === "tags") return v.split(",").map((t) => t.trim()).filter(Boolean);
  return v;
}

export function fieldValid(field: EditField | "", value: string): boolean {
  if (!field) return false;
  if (field === "party_size") {
    const n = parseInt(value, 10);
    return Number.isInteger(n) && n >= 1 && n <= 40 && /^\s*\d+\s*$/.test(value);
  }
  if (field === "language") return value === "en" || value === "es";
  if (field === "notes" || field === "tags") return true;
  return !!value.trim();
}

/** { kind, guest_ids, payload, note } for create; the edit route takes the
 *  same minus `kind` (payload.kind must equal the request's kind). */
export function buildRequestBody(f: RequestForm, pendingGuestIds: string[]) {
  const payload: Record<string, unknown> =
    f.kind === "plus_one"
      ? { kind: f.kind, additional_seats: Math.min(5, Math.max(1, parseInt(f.seats, 10) || 1)) }
      : f.kind === "edit_guest"
        ? { kind: f.kind, patch: { [f.field]: patchValue(f.field, f.value) } }
        : f.kind === "guest_help"
          ? { kind: f.kind, topic: f.title.trim() }
          : f.kind === "send_reminders"
            ? { kind: f.kind }
            : { kind: f.kind, title: f.title.trim() };
  const needsGuest = f.kind === "plus_one" || f.kind === "edit_guest" || f.kind === "guest_help";
  const guest_ids = f.kind === "send_reminders" ? pendingGuestIds.slice(0, MAX_REMIND) : needsGuest && f.guestId ? [f.guestId] : [];
  return { kind: f.kind, guest_ids, payload, note: f.note.trim() };
}

/** True when the form can be sent. */
export function formReady(f: RequestForm, pendingCount: number): boolean {
  if ((f.kind === "plus_one" || f.kind === "edit_guest") && !f.guestId) return false;
  if ((f.kind === "custom" || f.kind === "guest_help") && !f.title.trim()) return false;
  if (f.kind === "send_reminders" && pendingCount < 1) return false;
  if (f.kind === "edit_guest" && !fieldValid(f.field, f.value)) return false;
  return true;
}

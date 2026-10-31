// Pure helpers for the contacts picked in Add guest (no React Native imports,
// so scripts/tests/contacts.test.ts runs them under plain node).

/** A phone as typed into the form: digits and a leading plus, nothing else. */
export function cleanPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+") || trimmed.startsWith("00");
  const digits = trimmed.replace(/\D/g, "").replace(/^00/, "");
  if (!digits) return null;
  return plus ? `+${digits}` : digits;
}

/** The phone to use: a mobile one first, then any. */
export function bestPhone(phones: { label?: string | null; number?: string | null }[] | null | undefined): string | null {
  const list = (phones ?? []).filter((p) => !!p.number);
  const mobile = list.find((p) => /mobile|iphone|cell|m[oó]vil|celular/i.test(p.label ?? ""));
  return cleanPhone((mobile ?? list[0])?.number ?? null);
}

export type PickedContact = { id: string; name: string; phone: string | null; email: string | null };
export type ContactsAccess = "limited" | "all" | "none" | "undetermined" | "unavailable";

/** Which picker "Choose from contacts" opens for the current access, so no
 *  path ever raises the contacts permission prompt (where "Allow Full Access"
 *  is one tap away):
 *  - "access": already limited, the iOS 18 access picker shares more people
 *    and the app reads only the ones shared;
 *  - "system": anything else (never asked, denied, or full access the couple
 *    gave in Settings), the system contact picker, which needs no permission
 *    and hands over only the one person tapped;
 *  - "none": the build has no contacts module. */
export function pickerFor(access: ContactsAccess): "access" | "system" | "none" {
  if (access === "unavailable") return "none";
  return access === "limited" ? "access" : "system";
}

/** The person the system picker returned (expo-contacts' legacy shape), as
 *  the form needs it; null without a usable name. */
export function fromPickerContact(c: { id?: string | null; name?: string | null; firstName?: string | null; lastName?: string | null; phoneNumbers?: { label?: string | null; number?: string | null }[] | null; emails?: { email?: string | null }[] | null } | null | undefined): PickedContact | null {
  if (!c) return null;
  const name = (c.name?.trim() || [c.firstName, c.lastName].filter((s) => !!s?.trim()).join(" ")).trim().replace(/\s+/g, " ");
  if (!name) return null;
  const email = (c.emails ?? []).map((e) => e.email?.trim()).find((a) => !!a) ?? null;
  return { id: c.id ?? name, name, phone: bestPhone(c.phoneNumbers), email };
}

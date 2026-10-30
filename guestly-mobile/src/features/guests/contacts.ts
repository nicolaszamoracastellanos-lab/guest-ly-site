// Contacts in Add guest (HH, Oct 30 2026): limited access only.
//
// The couple picks people; the app never reads the address book as a whole
// (no Contact.getAll over everything, no full-access request of its own) and
// never writes to it. On iOS 18 and later the system permission sheet offers
// "Select contacts"; with that limited grant the app shows the system access
// picker (Contact.presentAccessPicker) and reads only what was shared. With a
// full grant the couple already gave in Settings, the system contact picker
// (Contact.presentPicker) returns the one person tapped. Planners get nothing
// here: their no-contacts rule stands until Nicolas decides (ESTADO.md).
//
// expo-contacts is a native module added in this wave. Builds made before it
// (build 34 and earlier) do not carry it, so the module is loaded lazily and
// every entry point checks for it first: on those builds the button is simply
// not shown, and nothing throws at import time.

import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import type * as ContactsModule from "expo-contacts";
import { bestPhone } from "./contactsMath";

export { bestPhone, cleanPhone } from "./contactsMath";

export type PickedContact = { id: string; name: string; phone: string | null; email: string | null };
export type PickResult =
  | { status: "picked"; contacts: PickedContact[] }
  | { status: "cancelled" }
  | { status: "denied" }
  | { status: "unavailable" };

/** True on iOS builds that carry the contacts module. */
export function contactsSupported(): boolean {
  return Platform.OS === "ios" && !!requireOptionalNativeModule("ExpoContactsNext");
}

function load(): typeof ContactsModule | null {
  if (!contactsSupported()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-contacts") as typeof ContactsModule;
  } catch {
    return null;
  }
}

/** "limited", "all", "none" or "undetermined", without prompting. */
export async function contactsAccess(): Promise<"limited" | "all" | "none" | "undetermined" | "unavailable"> {
  const mod = load();
  if (!mod) return "unavailable";
  try {
    const p = await mod.getPermissionsAsync();
    if (p.status === "undetermined") return "undetermined";
    if (!p.granted) return "none";
    return p.accessPrivileges === "limited" ? "limited" : "all";
  } catch {
    return "unavailable";
  }
}

async function details(mod: typeof ContactsModule, c: InstanceType<typeof ContactsModule.Contact>): Promise<PickedContact | null> {
  const F = mod.ContactField;
  const d = await c.getDetails([F.FULL_NAME, F.GIVEN_NAME, F.FAMILY_NAME, F.PHONES, F.EMAILS] as const);
  const name = (d.fullName || [d.givenName, d.familyName].filter(Boolean).join(" ")).trim().replace(/\s+/g, " ");
  if (!name) return null;
  const email = (d.emails ?? []).map((e) => e.address?.trim()).find((a) => !!a) ?? null;
  return { id: c.id, name, phone: bestPhone(d.phones), email };
}

/** Asks (once) and lets the couple choose people. Never reads anyone else. */
export async function pickContacts(): Promise<PickResult> {
  const mod = load();
  if (!mod) return { status: "unavailable" };
  try {
    let access = await contactsAccess();
    if (access === "undetermined") {
      const p = await mod.requestPermissionsAsync();
      access = !p.granted ? "none" : p.accessPrivileges === "limited" ? "limited" : "all";
    }
    if (access === "none") return { status: "denied" };
    if (access === "unavailable") return { status: "unavailable" };
    const picked = access === "limited" ? await mod.Contact.presentAccessPicker() : await mod.Contact.presentPicker().then((c) => (c ? [c] : []));
    if (!picked.length) return { status: "cancelled" };
    const out = (await Promise.all(picked.slice(0, 50).map((c) => details(mod, c).catch(() => null)))).filter((c): c is PickedContact => !!c);
    return out.length ? { status: "picked", contacts: out } : { status: "cancelled" };
  } catch {
    return { status: "cancelled" };
  }
}

/** Contacts the couple ALREADY shared with the app whose name matches. Under
 *  limited access this searches only the shared set. Used after the inline
 *  ContactAccessButton grants one more person. */
export async function sharedMatching(name: string, limit = 5): Promise<PickedContact[]> {
  const mod = load();
  const q = name.trim();
  if (!mod || q.length < 2) return [];
  try {
    const found = await mod.Contact.getAll({ name: q, limit });
    return (await Promise.all(found.map((c) => details(mod, c).catch(() => null)))).filter((c): c is PickedContact => !!c);
  } catch {
    return [];
  }
}

/** The inline iOS 18 button that shares one more matching contact, or null
 *  when the build or the OS cannot show it. */
export function contactAccessButton(): typeof ContactsModule.ContactAccessButton | null {
  const mod = load();
  if (!mod) return null;
  try {
    return mod.ContactAccessButton.isAvailable() ? mod.ContactAccessButton : null;
  } catch {
    return null;
  }
}

/** Fires when the shared set changes (the access button granted someone). */
export function onContactsChange(fn: () => void): () => void {
  const mod = load();
  if (!mod) return () => {};
  try {
    const sub = mod.addContactsChangeListener(fn);
    return () => sub.remove();
  } catch {
    return () => {};
  }
}

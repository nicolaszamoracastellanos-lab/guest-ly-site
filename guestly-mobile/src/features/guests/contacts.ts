// Contacts in Add guest (HH, Oct 30 2026): the couple picks people, the app
// never asks for the address book.
//
// No path here calls requestPermissionsAsync, so the contacts permission
// prompt (with its "Allow Full Access" choice) never appears from Guest-ly:
// - Never asked, denied, or full access the couple gave in Settings: the
//   system contact picker (CNContactPickerViewController through
//   expo-contacts' legacy presentContactPickerAsync). It needs no permission,
//   runs out of process and hands over only the one person tapped, read from
//   the picker's own result (the newer Contact.presentPicker returns an id
//   and reads details back from the store, which needs a grant).
// - Already limited (the couple chose "Select contacts" in Settings): the
//   iOS 18 access picker (Contact.presentAccessPicker) shares more people,
//   and the app reads only the people shared. The inline ContactAccessButton
//   and the change listener exist only in this state too.
// Nothing reads the whole book (no Contact.getAll outside the limited set)
// and nothing writes to it. Planners get nothing here: their no-contacts rule
// stands until Nicolas decides (ESTADO.md).
//
// expo-contacts is a native module added in this wave. Builds made before it
// (build 34 and earlier) do not carry it, so the module is loaded lazily and
// every entry point checks for it first: on those builds the button is simply
// not shown, and nothing throws at import time.

import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import type * as ContactsModule from "expo-contacts";
import type * as LegacyContacts from "expo-contacts/legacy";
import { bestPhone, fromPickerContact, pickerFor, type ContactsAccess, type PickedContact } from "./contactsMath";

export { bestPhone, cleanPhone, type PickedContact, type ContactsAccess } from "./contactsMath";

export type PickResult = { status: "picked"; contacts: PickedContact[] } | { status: "cancelled" } | { status: "unavailable" };

/** True on iOS builds that carry the contacts module (both of its halves). */
export function contactsSupported(): boolean {
  return Platform.OS === "ios" && !!requireOptionalNativeModule("ExpoContactsNext") && !!requireOptionalNativeModule("ExpoContacts");
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

function loadLegacy(): typeof LegacyContacts | null {
  if (!contactsSupported()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-contacts/legacy") as typeof LegacyContacts;
  } catch {
    return null;
  }
}

/** "limited", "all", "none" or "undetermined", without prompting. */
export async function contactsAccess(): Promise<ContactsAccess> {
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

/** Lets the couple choose people without any permission prompt. Never
 *  reads anyone they did not pick. */
export async function pickContacts(): Promise<PickResult> {
  const mod = load();
  if (!mod) return { status: "unavailable" };
  try {
    const route = pickerFor(await contactsAccess());
    if (route === "none") return { status: "unavailable" };
    if (route === "system") {
      const legacy = loadLegacy();
      if (!legacy) return { status: "unavailable" };
      const one = fromPickerContact(await legacy.presentContactPickerAsync());
      return one ? { status: "picked", contacts: [one] } : { status: "cancelled" };
    }
    const picked = await mod.Contact.presentAccessPicker();
    if (!picked.length) return { status: "cancelled" };
    const out = (await Promise.all(picked.slice(0, 50).map((c) => details(mod, c).catch(() => null)))).filter((c): c is PickedContact => !!c);
    return out.length ? { status: "picked", contacts: out } : { status: "cancelled" };
  } catch {
    return { status: "cancelled" };
  }
}

/** Contacts the couple ALREADY shared with the app whose name matches, only
 *  under limited access (the search then covers the shared set alone). With
 *  any other access it returns nothing: a full grant must never turn this
 *  into a search of the whole book. Used after the inline ContactAccessButton
 *  shares one more person. */
export async function sharedMatching(name: string, limit = 5): Promise<PickedContact[]> {
  const mod = load();
  const q = name.trim();
  if (!mod || q.length < 2) return [];
  try {
    if ((await contactsAccess()) !== "limited") return [];
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

/** Fires when the shared set changes (the access button granted someone).
 *  Subscribe only while access is limited (Add guest does). */
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

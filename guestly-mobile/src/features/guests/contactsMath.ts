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

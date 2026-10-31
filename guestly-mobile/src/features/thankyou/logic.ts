// Pure helpers of the thank-you list. No React Native imports.

export type ThankyouItem = { guest_id: string; party_names: string; table: string | null; attended: boolean; draft: string | null; done: boolean };

export function normalizeItems(raw: unknown): ThankyouItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      const id = typeof o.guest_id === "string" ? o.guest_id : null;
      if (!id) return null;
      const table = typeof o.table === "string" || typeof o.table === "number" ? String(o.table) : null;
      return {
        guest_id: id,
        party_names: typeof o.party_names === "string" ? o.party_names : "",
        table: table || null,
        attended: o.attended === true,
        draft: typeof o.draft === "string" && o.draft ? o.draft : null,
        done: o.done === true,
      };
    })
    .filter((x): x is ThankyouItem => !!x);
}

/** "12 of 80 written": done notes over everyone on the list. */
export function progress(items: ThankyouItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.done).length, total: items.length };
}

/** Not done first, then by name; a stable order for the list. */
export function sortItems(items: ThankyouItem[], filter: "all" | "left"): ThankyouItem[] {
  return items
    .filter((i) => filter === "all" || !i.done)
    .slice()
    .sort((a, b) => Number(a.done) - Number(b.done) || a.party_names.localeCompare(b.party_names));
}

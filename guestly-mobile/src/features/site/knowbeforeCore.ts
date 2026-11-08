// #45 the `knowbefore` section of GET /guest/site (1.4.0), read tolerantly.
// Pure, so scripts/tests/knowbefore.test.ts runs it under node.

export type KnowBeforeSection = {
  type: "knowbefore";
  heading: string | null;
  weather: string | null;
  packing: { key: string; text: string }[];
  dress_note: string | null;
  dress_all: string | null;
  dress_events: { id: string; title: string; code: string }[];
  entry: string | null;
  entry_link: string | null;
  currency: string[];
  tipping: string | null;
};

const s = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** A section as the server sent it, cleaned: unknown fields dropped, links
 *  https only (the couple typed it), empty items gone. */
export function readKnowBefore(raw: unknown): KnowBeforeSection | null {
  if (!raw || typeof raw !== "object" || (raw as { type?: unknown }).type !== "knowbefore") return null;
  const o = raw as Record<string, unknown>;
  const link = s(o.entry_link);
  return {
    type: "knowbefore",
    heading: s(o.heading),
    weather: s(o.weather),
    packing: Array.isArray(o.packing)
      ? (o.packing as Record<string, unknown>[]).map((p) => ({ key: s(p?.key) ?? "", text: s(p?.text) ?? "" })).filter((p) => p.key && p.text)
      : [],
    dress_note: s(o.dress_note),
    dress_all: s(o.dress_all),
    dress_events: Array.isArray(o.dress_events)
      ? (o.dress_events as Record<string, unknown>[]).map((d) => ({ id: s(d?.id) ?? "", title: s(d?.title) ?? "", code: s(d?.code) ?? "" })).filter((d) => d.id && d.code)
      : [],
    entry: s(o.entry),
    entry_link: link && /^https:\/\/[^\s]+$/i.test(link) ? link : null,
    currency: Array.isArray(o.currency) ? (o.currency as unknown[]).map(s).filter((x): x is string => !!x) : [],
    tipping: s(o.tipping),
  };
}

/** Anything for a guest to read; an empty card never renders. */
export function hasKnowBefore(k: KnowBeforeSection | null | undefined): k is KnowBeforeSection {
  if (!k) return false;
  return !!(k.weather || k.packing.length || k.dress_note || k.dress_all || k.dress_events.length || k.entry || k.entry_link || k.currency.length || k.tipping);
}

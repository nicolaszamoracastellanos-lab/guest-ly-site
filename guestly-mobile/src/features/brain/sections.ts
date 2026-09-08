// The editor schema: one entry per section the web brain edits, with the
// field kinds the section screen knows how to render.

export type FieldKind = "text" | "multiline" | "list";
export type Field = { path: string; label: string; kind: FieldKind; hint?: string; keyboard?: "url" | "phone" | "default" };
export type SectionKind = "fields" | "itinerary" | "hotels" | "faq";
export type Section = { key: string; kind: SectionKind; fields: Field[] };

export const SECTIONS: Section[] = [
  {
    key: "couple",
    kind: "fields",
    fields: [
      { path: "couple.names", label: "names", kind: "text" },
      { path: "couple.wedding_date", label: "wedding_date", kind: "text" },
      { path: "couple.location", label: "location", kind: "text" },
      { path: "couple.website", label: "website", kind: "text", keyboard: "url" },
      { path: "couple.rsvp_link", label: "rsvp_link", kind: "text", keyboard: "url" },
    ],
  },
  { key: "itinerary", kind: "itinerary", fields: [{ path: "arrival_advice", label: "arrival_advice", kind: "multiline" }] },
  {
    key: "travel",
    kind: "fields",
    fields: [
      { path: "travel.international", label: "international", kind: "multiline" },
      { path: "travel.domestic", label: "domestic", kind: "multiline" },
      { path: "travel.visas", label: "visas", kind: "multiline" },
      { path: "travel.notes", label: "notes", kind: "multiline" },
    ],
  },
  { key: "hotels", kind: "hotels", fields: [{ path: "hotel_areas", label: "hotel_areas", kind: "multiline" }] },
  {
    key: "transport",
    kind: "fields",
    fields: [
      { path: "transportation.uber", label: "uber", kind: "multiline" },
      { path: "transportation.taxis", label: "taxis", kind: "multiline" },
      { path: "transportation.recommended_service.name", label: "service_name", kind: "text" },
      { path: "transportation.recommended_service.whatsapp", label: "whatsapp", kind: "text", keyboard: "phone" },
      { path: "transportation.recommended_service.link", label: "link", kind: "text", keyboard: "url" },
      { path: "transportation.recommended_service.notes", label: "notes", kind: "multiline" },
    ],
  },
  {
    key: "planner",
    kind: "fields",
    fields: [
      { path: "planner.name", label: "planner_name", kind: "text", hint: "plannerHint" },
      { path: "planner.whatsapp", label: "whatsapp", kind: "text", keyboard: "phone" },
      { path: "planner.helps_with", label: "helps_with", kind: "multiline" },
    ],
  },
  {
    key: "money",
    kind: "fields",
    fields: [
      { path: "money.currency", label: "currency", kind: "multiline" },
      { path: "money.exchange_rate", label: "exchange_rate", kind: "multiline" },
      { path: "money.exchanging", label: "exchanging", kind: "multiline" },
      { path: "money.tipping", label: "tipping", kind: "multiline" },
    ],
  },
  {
    key: "weather",
    kind: "fields",
    fields: [
      { path: "weather_packing.weather", label: "weather", kind: "multiline" },
      { path: "weather_packing.packing", label: "packing", kind: "multiline" },
      { path: "weather_packing.grooming", label: "grooming", kind: "multiline" },
    ],
  },
  {
    key: "local",
    kind: "fields",
    fields: [
      { path: "altitude", label: "altitude", kind: "multiline" },
      { path: "electricity", label: "electricity", kind: "multiline" },
      { path: "communication", label: "communication", kind: "multiline" },
      { path: "health_safety", label: "health_safety", kind: "list" },
    ],
  },
  {
    key: "food",
    kind: "fields",
    fields: [
      { path: "restaurants", label: "restaurants", kind: "list" },
      { path: "food_to_try", label: "food_to_try", kind: "list" },
      { path: "things_to_do.bolivia", label: "things_region", kind: "list" },
      { path: "things_to_do.tarija", label: "things_local", kind: "list" },
    ],
  },
  { key: "gifts", kind: "fields", fields: [{ path: "gifts", label: "gifts", kind: "multiline" }] },
  { key: "faq", kind: "faq", fields: [] },
];

export const EVENT_FIELDS: Field[] = [
  { path: "name", label: "name", kind: "text" },
  { path: "date", label: "date", kind: "text" },
  { path: "time", label: "time", kind: "text" },
  { path: "location", label: "location", kind: "text" },
  { path: "maps_url", label: "maps_url", kind: "text", keyboard: "url" },
  { path: "dress_code", label: "dress_code", kind: "text" },
  { path: "description", label: "description", kind: "multiline" },
  { path: "ceremony_location", label: "ceremony_location", kind: "text" },
  { path: "ceremony_maps_url", label: "ceremony_maps_url", kind: "text", keyboard: "url" },
  { path: "reception_location", label: "reception_location", kind: "text" },
  { path: "reception_maps_url", label: "reception_maps_url", kind: "text", keyboard: "url" },
  { path: "cost", label: "cost", kind: "text" },
  { path: "notes", label: "notes", kind: "multiline" },
];

/** How filled a section is, for the overview list. */
export function sectionFill(section: Section, facts: Record<string, unknown>): { filled: number; total: number; count: number | null } {
  const read = (path: string): unknown => path.split(".").reduce<unknown>((c, k) => (c && typeof c === "object" ? (c as Record<string, unknown>)[k] : undefined), facts);
  if (section.kind === "itinerary") return { filled: 0, total: 0, count: Array.isArray(facts.itinerary) ? facts.itinerary.length : 0 };
  if (section.kind === "hotels") return { filled: 0, total: 0, count: Array.isArray(facts.hotels) ? facts.hotels.length : 0 };
  if (section.kind === "faq") return { filled: 0, total: 0, count: Array.isArray(facts.custom_faq) ? facts.custom_faq.length : 0 };
  let filled = 0;
  for (const f of section.fields) {
    const v = read(f.path);
    if ((typeof v === "string" && v.trim()) || (Array.isArray(v) && v.length)) filled++;
  }
  return { filled, total: section.fields.length, count: null };
}

// The stress Day pack (STUDY-quality-bar 11: 500 parties, 40 runsheet blocks,
// accents and long names), built deterministically so the timing test has the
// same input on every run. Same field set as couple-pack-200.json.

const FIRST = ["Sofía", "Mateo", "Valentina", "José María", "Inés", "Andrés", "Lucía", "Tomás", "Camila", "Nicolás", "Ana", "Joaquín", "Renée", "Zoë", "Íñigo", "Martín", "Paula", "Óscar", "Elena", "Raúl"];
const LAST = ["Ríos", "Núñez", "Peña y Lillo", "Gutiérrez", "Fernández de Córdoba", "Vargas", "Zamora", "Castellanos", "Müller", "O'Connor", "Ibáñez", "Suárez", "Montaño", "Añez", "Saavedra"];

function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

function uuid(n: number): string {
  const h = n.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${h}`;
}

export function bigPack(parties = 500, blocks = 40): Record<string, unknown> {
  const r = rand(27);
  const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
  const roster = Array.from({ length: parties }, (_, i) => {
    const size = 1 + Math.floor(r() * 4);
    const last = pick(LAST);
    const members = Array.from({ length: size }, () => `${pick(FIRST)} ${last}`);
    return {
      id: uuid(i + 1),
      name: members[0],
      members,
      party_size: size,
      table: r() < 0.9 ? `Table ${1 + Math.floor(r() * 50)}` : null,
      tags: r() < 0.2 ? ["family"] : [],
      checked_in_at: r() < 0.3 ? "2027-05-22T19:30:00.000Z" : null,
      rsvp_status: "attending",
      meal: pick(["fish", "beef", "vegetarian", null]),
    };
  });
  const runsheet = Array.from({ length: blocks }, (_, i) => {
    // 10:00 to 03:30: the last few cross midnight.
    const start = 10 * 60 + i * 26;
    const h = Math.floor(start / 60) % 24;
    const m = start % 60;
    const hhmm = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return {
      id: `b-${i}`,
      day: "2027-05-22",
      starts_at: hhmm,
      ends_at: i % 3 === 0 ? null : `${String((h + (m + 20 >= 60 ? 1 : 0)) % 24).padStart(2, "0")}:${String((m + 20) % 60).padStart(2, "0")}`,
      title: `Block ${i + 1}: ${pick(["Ceremony", "Cocktail hour", "Dinner and toasts", "First dance", "Brindis de los padrinos", "Fotos con la familia"])}`,
      detail: "A longer note about what happens, who brings what and where the vendors wait.",
      location: pick(["Garden terrace", "Courtyard", "Salón principal de la Hacienda Solaz"]),
      place_id: null,
      owner: pick(["Mesa Lumen Catering", "Trío Brisa", "Estudio Faro"]),
      vendor_id: null,
      status: i < 12 ? "done" : "planned",
      updated_at: "2027-05-20T14:00:00.000Z",
      sort_order: i,
    };
  });
  return {
    meta: {
      version: "v-big",
      generated_at: "2027-05-22T20:11:58.000Z",
      tz: "America/La_Paz",
      wedding_date: "2027-05-22",
      valid_until: "2027-05-23",
      server_now: "2027-05-22T20:12:00.000Z",
      slug: "big-wedding",
      couple_names: "Maria Fernanda de los Ángeles & Juan Sebastián Castellanos",
      can_mark_status: true,
    },
    runsheet,
    places: [],
    vendors: Array.from({ length: 25 }, (_, i) => ({ id: `v-${i}`, name: `Vendor ${i}`, category: "other", contact: "Contact", phone: "+59170000000", whatsapp: "59170000000", arrival: "12:00" })),
    seating: { tables: Array.from({ length: 50 }, (_, i) => ({ id: `t-${i}`, name: `Table ${i + 1}`, number: i + 1, seats: 10 })), assignments: [], floor_plan_url: null },
    roster,
    counts: null,
    contacts: [],
  };
}

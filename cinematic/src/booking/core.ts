/* #22 demo booking, the pure part: reading the API answers (L7P-LOG "Booking
   API for the landing", v1), grouping slots by day in the visitor's zone, and
   the date and zone labels. No browser or Vite globals, so the Node tests
   import this file directly (scripts/test-booking-core.mjs).
   Times arrive as UTC ISO strings and are formatted only here, with Intl and
   a named zone. */

export type Lang = 'en' | 'es';
export type Text = { en: string; es: string };

export type OpenSlots = {
  kind: 'open';
  slots: string[];
  hostZone: string;
  durationMin: number;
  description: Text | null;
  window: { from: string; days: number; timeZone: string };
  nextOpen: string | null;
};
/* closed: bookings off, tables missing, unknown host or type: the contact
   fallback. error: network, 429 or anything unexpected: retry plus contact. */
export type SlotsResult = OpenSlots | { kind: 'closed' } | { kind: 'error' };

export type BookField = 'name' | 'email' | 'phone' | 'weddingDate' | 'notes' | 'start';
export type Booked = {
  kind: 'booked';
  replay: boolean;
  start: string | null;
  end: string | null;
  hostZone: string | null;
  manageUrl: string | null;
  icsUrl: string | null;
};
export type BookResult =
  | Booked
  | { kind: 'invalid'; field: BookField | null }
  | { kind: 'taken'; slots: string[] }
  | { kind: 'closed' }
  | { kind: 'error' };

export type Role = 'couple' | 'planner' | 'other';
export type BookRequest = {
  start: string;
  name: string;
  email: string;
  role: Role | '';
  weddingDate: string;
  phone: string;
  notes: string;
  lang: Lang;
  visitorTz: string;
  idempotencyKey: string;
  /* The honeypot field's value: '' from people. */
  fax_number: string;
};

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const isIso = (v: unknown): v is string => typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v));
const isText = (v: unknown): v is Text => isObj(v) && typeof v.en === 'string' && typeof v.es === 'string';
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isoList = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter(isIso))].sort((a, b) => Date.parse(a) - Date.parse(b)) : [];

export function validZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/* GET .../slots: the HTTP status and the parsed body (null when unreadable). */
export function readSlots(status: number, body: unknown): SlotsResult {
  if (status === 404) return { kind: 'closed' };
  if (status !== 200 || !isObj(body) || body.v !== 1) return { kind: 'error' };
  if (body.status === 'closed' || body.status === 'unavailable') return { kind: 'closed' };
  if (body.status !== 'open') return { kind: 'error' };
  const host = isObj(body.host) ? body.host : null;
  const type = isObj(body.type) ? body.type : null;
  const win = isObj(body.window) ? body.window : null;
  if (!host || !validZone(host.timeZone) || !win || !isDay(win.from) || !validZone(win.timeZone)) return { kind: 'error' };
  const days = typeof win.days === 'number' && win.days >= 1 && win.days <= 31 ? Math.floor(win.days) : 14;
  return {
    kind: 'open',
    slots: isoList(body.slots),
    hostZone: host.timeZone,
    durationMin: type && typeof type.durationMin === 'number' ? type.durationMin : 30,
    description: type && isText(type.description) ? type.description : null,
    window: { from: win.from, days, timeZone: win.timeZone },
    nextOpen: isIso(body.nextOpen) ? body.nextOpen : null,
  };
}

const FIELDS: BookField[] = ['name', 'email', 'phone', 'weddingDate', 'notes', 'start'];

/* Links in the answer are shown only when they point at the API origin. */
function ownUrl(v: unknown, origin: string): string | null {
  if (typeof v !== 'string') return null;
  try {
    const u = new URL(v);
    return u.origin === origin && u.pathname.startsWith('/booking/manage/') ? u.href : null;
  } catch {
    return null;
  }
}

/* POST .../book. */
export function readBook(status: number, body: unknown, origin: string): BookResult {
  if (!isObj(body) || body.v !== 1) return status === 404 ? { kind: 'closed' } : { kind: 'error' };
  if (status === 201 && body.ok === true && body.status === 'booked') {
    const b = isObj(body.booking) ? body.booking : {};
    return {
      kind: 'booked',
      replay: body.replay === true,
      start: isIso(b.start) ? b.start : null,
      end: isIso(b.end) ? b.end : null,
      hostZone: validZone(b.timeZone) ? b.timeZone : null,
      manageUrl: ownUrl(b.manageUrl, origin),
      icsUrl: ownUrl(b.icsUrl, origin),
    };
  }
  if (status === 400 && body.status === 'invalid') {
    const f = body.field;
    return { kind: 'invalid', field: typeof f === 'string' && (FIELDS as string[]).includes(f) ? (f as BookField) : null };
  }
  if (status === 409 && body.status === 'taken') return { kind: 'taken', slots: isoList(body.slots) };
  if (status === 409 || status === 404 || status === 503) return { kind: 'closed' };
  return { kind: 'error' };
}

/* ---------- checks before sending (the server checks again) ---------- */

export const LIMITS = { name: 120, email: 254, phone: 40, notes: 1000 } as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9 +().-]{6,40}$/;

export type Draft = { name: string; email: string; phone: string; weddingDate: string; notes: string };

export function draftProblems(d: Draft): BookField[] {
  const out: BookField[] = [];
  const name = d.name.trim();
  if (!name || name.length > LIMITS.name) out.push('name');
  const email = d.email.trim();
  if (!email || email.length > LIMITS.email || !EMAIL_RE.test(email)) out.push('email');
  if (d.phone.trim() && !PHONE_RE.test(d.phone.trim())) out.push('phone');
  if (d.weddingDate && !isDay(d.weddingDate)) out.push('weddingDate');
  if (d.notes.length > LIMITS.notes) out.push('notes');
  return out;
}

export function isEmail(v: string): boolean {
  const e = v.trim();
  return e.length > 0 && e.length <= LIMITS.email && EMAIL_RE.test(e);
}

/* ---------- days and zones ---------- */

const dayFmt = new Map<string, Intl.DateTimeFormat>();
/* YYYY-MM-DD of an instant in a zone. */
export function dayOf(iso: string, tz: string): string {
  let f = dayFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    dayFmt.set(tz, f);
  }
  return f.format(new Date(iso));
}

export function addDays(day: string, n: number): string {
  const t = Date.parse(`${day}T12:00:00Z`) + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

export type Day = { day: string; slots: string[] };

/* Every day of the window in order, each with its slots (possibly none).
   Slots outside the window (a 409's fresh list starts today) extend it. */
export function daysOf(slots: string[], tz: string, from: string, count: number): Day[] {
  const by = new Map<string, string[]>();
  for (const s of slots) {
    const d = dayOf(s, tz);
    const list = by.get(d);
    if (list) list.push(s);
    else by.set(d, [s]);
  }
  const keys = [...by.keys()].sort();
  const first = keys.length && keys[0] < from ? keys[0] : from;
  let last = addDays(from, count - 1);
  if (keys.length && keys[keys.length - 1] > last) last = keys[keys.length - 1];
  const out: Day[] = [];
  for (let d = first; d <= last && out.length < 62; d = addDays(d, 1)) out.push({ day: d, slots: by.get(d) ?? [] });
  return out;
}

/* City names IANA writes without their accents or in English only. */
const CITY: Record<string, Partial<Text>> = {
  'America/Bogota': { es: 'Bogotá' },
  'America/Mexico_City': { en: 'Mexico City', es: 'Ciudad de México' },
  'America/Cancun': { en: 'Cancún', es: 'Cancún' },
  'America/Sao_Paulo': { en: 'São Paulo', es: 'São Paulo' },
  'America/Asuncion': { en: 'Asunción', es: 'Asunción' },
  'America/New_York': { es: 'Nueva York' },
  'America/Los_Angeles': { es: 'Los Ángeles' },
  'America/Panama': { es: 'Panamá' },
  'America/Havana': { es: 'La Habana' },
  'Europe/London': { es: 'Londres' },
  'Europe/Lisbon': { es: 'Lisboa' },
};

/* "America/Argentina/Buenos_Aires" -> "Buenos Aires"; "America/Bogota" in
   Spanish -> "Bogotá". */
export function zoneCity(tz: string, lang: Lang = 'en'): string {
  if (tz === 'UTC' || tz === 'Etc/UTC') return 'UTC';
  return CITY[tz]?.[lang] ?? (tz.split('/').pop() ?? tz).replace(/_/g, ' ');
}

export function zonePhrase(tz: string, lang: Lang): string {
  const city = zoneCity(tz, lang);
  if (city === 'UTC') return 'UTC';
  return lang === 'es' ? `hora de ${city}` : `${city} time`;
}

/* "GMT-6" for a zone at a given instant. */
export function zoneOffset(tz: string, at: number): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
    .formatToParts(new Date(at))
    .find((p) => p.type === 'timeZoneName');
  return part?.value ?? '';
}

/* Zones offered in the "change time zone" list: the visitor's own, the host's,
   and the places couples and planners write from most. */
export const COMMON_ZONES = [
  'America/La_Paz',
  'America/Lima',
  'America/Bogota',
  'America/Mexico_City',
  'America/Cancun',
  'America/Santo_Domingo',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Sao_Paulo',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Lisbon',
  'Europe/Madrid',
  'UTC',
];

export function zoneChoices(visitor: string, host: string): string[] {
  return [...new Set([visitor, host, ...COMMON_ZONES].filter(validZone))];
}

/* ---------- labels (Intl, named zone) ---------- */

const LOCALE: Record<Lang, string> = { en: 'en-US', es: 'es-MX' };
const noon = (day: string) => new Date(`${day}T12:00:00Z`);
/* "AM" -> "am" (the house style: "4:30 pm"); keeps Intl's own spacing. */
const lowerMeridiem = (s: string) => s.replace(/\b(AM|PM)\b/g, (m) => m.toLowerCase());

/* Day strip: "Thu" + "Nov 20" / "jue" + "20 nov". */
export function dayParts(day: string, lang: Lang): { weekday: string; date: string } {
  const d = noon(day);
  const weekday = new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'short', timeZone: 'UTC' }).format(d).replace(/\.$/, '');
  const date =
    lang === 'es'
      ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d).replace(/\.$/, '')
      : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d);
  return { weekday, date };
}

/* "Thursday, November 20" / "jueves 20 de noviembre". */
export function dayLong(day: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(noon(day));
}

/* "9:00 am" / "09:00". */
export function timeLabel(iso: string, tz: string, lang: Lang): string {
  const opts: Intl.DateTimeFormatOptions =
    lang === 'es' ? { hour: 'numeric', minute: '2-digit', hourCycle: 'h23', timeZone: tz } : { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz };
  return lowerMeridiem(new Intl.DateTimeFormat(LOCALE[lang], opts).format(new Date(iso)));
}

/* "Thursday, November 20, 9:00 am" / "jueves 20 de noviembre, 9:00". */
export function whenLabel(iso: string, tz: string, lang: Lang): string {
  return `${dayLong(dayOf(iso, tz), lang)}, ${timeLabel(iso, tz, lang)}`;
}

/* A random id. crypto.randomUUID is missing before Safari 15.4 and Chrome 92
   and on plain http pages, so fall back to getRandomValues, then Math.random
   (the beacon's pattern): a missing API must never throw inside a render. */
export function randomId(c: Partial<Pick<Crypto, 'randomUUID' | 'getRandomValues'>> | null = globalThis.crypto ?? null): string {
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  if (typeof c?.getRandomValues === 'function') return Array.from(c.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/* One key per opening of the booking dialog (contract: 8 to 80 of A-Za-z0-9_-). */
export function newKey(rand: () => string = randomId): string {
  return rand().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80).padEnd(8, '0');
}

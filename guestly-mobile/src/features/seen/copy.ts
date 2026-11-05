// #37 "Seen" copy, EN and neutral LatAm ES (tú), word for word the portal's
// (src/lib/i18n/seen.ts). "Visto" is the word WhatsApp uses for a read message.

const en = {
  when: { now: "just now", minutes: "{n} min ago", today: "today {time}", yesterday: "yesterday {time}", weekday: "{day} {time}" },
  seen: "Seen {when}",
  notSeen: "Not seen yet",
  detail: "Seen {when} · {views} visits since {first}",
  runsheet: {
    seenBy: "Seen by {names}, {when}",
    stale: "Not seen since the last change",
    lastOpened: "Last opened by {names}, {when}",
    none: "The couple has not opened the runsheet yet",
  },
  roles: {
    owner: { tag: "", anon: "the couple" },
    admin: { tag: "editor", anon: "an editor" },
    viewer: { tag: "view only", anon: "someone with view access" },
  },
  and: "and",
};

const es: typeof en = {
  when: { now: "hace un momento", minutes: "hace {n} min", today: "hoy {time}", yesterday: "ayer {time}", weekday: "{day} {time}" },
  seen: "Visto {when}",
  notSeen: "Sin ver todavía",
  detail: "Visto {when} · {views} visitas desde {first}",
  runsheet: {
    seenBy: "Visto por {names}, {when}",
    stale: "Sin ver desde el último cambio",
    lastOpened: "Última apertura: {names}, {when}",
    none: "La pareja todavía no abrió el cronograma",
  },
  roles: {
    owner: { tag: "", anon: "la pareja" },
    admin: { tag: "editor", anon: "un editor" },
    viewer: { tag: "solo lectura", anon: "alguien con acceso de lectura" },
  },
  and: "y",
};

export const SEEN_COPY = { en, es };

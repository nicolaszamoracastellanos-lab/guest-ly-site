// #1 final count copy, EN and neutral LatAm ES (tú). The words follow the
// portal's final-count dictionary (src/lib/i18n/final-count.ts) and the
// guest site's closed card, so the couple, the guest and the web read the
// same thing.

const en = {
  title: "Final count",
  badges: {
    locked: "Locked",
    overdue: "Overdue",
    today: "Due today",
    soon: { one: "Due tomorrow", other: "Due in {n} days" },
    upcoming: "In {n} days",
    none: "No due date",
  },
  dueOn: "Due {date}",
  lockedOn: "Locked {date}",
  lockedOnBy: "Locked {date} by {name}",
  totals: "{attending} attending, {pending} not answered yet",
  noChoice: "No choice yet",
  lock: "Lock final count",
  unlock: "Unlock count",
  locked: "Final count locked",
  unlocked: "Final count unlocked",
  fail: { lock: "Could not lock the final count.", unlock: "Could not unlock the count." },
  // Guest side (the site's closed card, word for word).
  closedTitle: "Responses are closed",
  closedAnswered: "To change your answer, contact {couple}.",
  closedPending: "To send your answer, contact {couple}.",
  contactCouple: "Contact the couple",
  theCouple: "the couple",
  // #1 per-person questions (a menu): each person coming picks their own.
  eachPerson: "Each person coming picks one.",
  missingPerson: "Pick one for {name}.",
};

const es: typeof en = {
  title: "Conteo final",
  badges: {
    locked: "Cerrado",
    overdue: "Atrasado",
    today: "Se entrega hoy",
    soon: { one: "Se entrega mañana", other: "Faltan {n} días" },
    upcoming: "En {n} días",
    none: "Sin fecha de entrega",
  },
  dueOn: "Se entrega el {date}",
  lockedOn: "Cerrado el {date}",
  lockedOnBy: "Cerrado el {date} por {name}",
  totals: "{attending} asisten, {pending} sin responder todavía",
  noChoice: "Sin elección todavía",
  lock: "Cerrar conteo final",
  unlock: "Reabrir conteo",
  locked: "Conteo final cerrado",
  unlocked: "Conteo final reabierto",
  fail: { lock: "No se pudo cerrar el conteo final.", unlock: "No se pudo reabrir el conteo." },
  closedTitle: "Las respuestas están cerradas",
  closedAnswered: "Para cambiar tu respuesta, escribe a {couple}.",
  closedPending: "Para enviar tu respuesta, escribe a {couple}.",
  contactCouple: "Escribir a la pareja",
  theCouple: "la pareja",
  eachPerson: "Cada persona que asiste elige una.",
  missingPerson: "Elige una para {name}.",
};

export const FINAL_COUNT_COPY = { en, es };

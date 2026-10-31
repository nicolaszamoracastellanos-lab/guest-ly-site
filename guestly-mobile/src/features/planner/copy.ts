// Planner copy for the Duo v2 rebuild (Today as a cockpit across weddings,
// Weddings portfolio, header menu). EN and neutral LatAm ES (tú).

export type PlannerCopy = {
  tabs: { weddings: string };
  needsYou: string; // "{n}"
  needsEmpty: string;
  needsEmptyBody: string;
  agenda: string;
  agendaEmpty: string;
  week: string;
  weekEmpty: string;
  weddings: string;
  inWedding: string; // "{names}"
  health: { ok: string; watch: string; urgent: string };
  days: { one: string; other: string };
  weddingToday: string;
  weddingPassed: string;
  noDate: string;
  seatsAnswered: string; // "{done} of {total} seats answered"
  openRequests: { one: string; other: string };
  asksYou: { one: string; other: string };
  tasksOpen: { one: string; other: string };
  tasksOverdue: { one: string; other: string };
  menu: { title: string; coordinator: string; guide: string; settings: string; language: string; signOut: string; switchWedding: string };
  summary: string;
  invited: string;
  going: string;
  notGoing: string;
  noReply: string;
  access: string;
  notShared: string;
  workHere: string;
  working: string; // "Now working on {names}"
  openGuests: string;
  openTasks: string;
  openBudget: string;
  openRunsheet: string;
  pickWedding: string;
  weddingsSub: { one: string; other: string };
  loadFailed: string;
  retry: string;
  kinds: { request_answered: string; task_overdue: string; task_due_today: string; wedding_soon: string };
};

const en: PlannerCopy = {
  tabs: { weddings: "Weddings" },
  needsYou: "Needs you ({n})",
  needsEmpty: "Nothing needs you right now",
  needsEmptyBody: "Every wedding is on track. New requests and due dates show up here.",
  agenda: "Today",
  agendaEmpty: "Nothing scheduled today",
  week: "This week",
  weekEmpty: "A quiet week ahead",
  weddings: "Your weddings",
  inWedding: "In {names}",
  health: { ok: "On track", watch: "Keep an eye", urgent: "Needs attention" },
  days: { one: "{n} day", other: "{n} days" },
  weddingToday: "Today",
  weddingPassed: "Wedding done",
  noDate: "No date yet",
  seatsAnswered: "{done} of {total} seats answered",
  openRequests: { one: "{n} open request", other: "{n} open requests" },
  asksYou: { one: "{n} waiting on you", other: "{n} waiting on you" },
  tasksOpen: { one: "{n} open task", other: "{n} open tasks" },
  tasksOverdue: { one: "{n} overdue", other: "{n} overdue" },
  menu: { title: "Menu", coordinator: "Coordinator", guide: "Guide", settings: "Settings", language: "Language", signOut: "Sign out", switchWedding: "Switch wedding" },
  summary: "Wedding summary",
  invited: "Invited",
  going: "Going",
  notGoing: "Not going",
  noReply: "No reply",
  access: "What you can see here",
  notShared: "Not shared with you",
  workHere: "Work on this wedding",
  working: "Now working on {names}",
  openGuests: "Guests",
  openTasks: "Tasks",
  openBudget: "Budget",
  openRunsheet: "Day-of schedule",
  pickWedding: "Pick a wedding to see its summary",
  weddingsSub: { one: "{n} wedding", other: "{n} weddings" },
  loadFailed: "Could not load your weddings",
  retry: "Try again",
  kinds: { request_answered: "Request", task_overdue: "Task", task_due_today: "Task", wedding_soon: "Wedding" },
};

const es: PlannerCopy = {
  tabs: { weddings: "Bodas" },
  needsYou: "Necesitan de ti ({n})",
  needsEmpty: "Nada necesita de ti ahora",
  needsEmptyBody: "Todas las bodas van al día. Las solicitudes nuevas y los vencimientos aparecen aquí.",
  agenda: "Hoy",
  agendaEmpty: "Nada programado para hoy",
  week: "Esta semana",
  weekEmpty: "Una semana tranquila",
  weddings: "Tus bodas",
  inWedding: "En {names}",
  health: { ok: "Al día", watch: "Atención", urgent: "Requiere atención" },
  days: { one: "{n} día", other: "{n} días" },
  weddingToday: "Hoy",
  weddingPassed: "Boda realizada",
  noDate: "Sin fecha aún",
  seatsAnswered: "{done} de {total} asientos respondieron",
  openRequests: { one: "{n} solicitud abierta", other: "{n} solicitudes abiertas" },
  asksYou: { one: "{n} espera tu respuesta", other: "{n} esperan tu respuesta" },
  tasksOpen: { one: "{n} tarea abierta", other: "{n} tareas abiertas" },
  tasksOverdue: { one: "{n} vencida", other: "{n} vencidas" },
  menu: { title: "Menú", coordinator: "Coordinador", guide: "Guía", settings: "Ajustes", language: "Idioma", signOut: "Cerrar sesión", switchWedding: "Cambiar de boda" },
  summary: "Resumen de la boda",
  invited: "Invitados",
  going: "Van",
  notGoing: "No van",
  noReply: "Sin responder",
  access: "Lo que puedes ver aquí",
  notShared: "No compartida contigo",
  workHere: "Trabajar en esta boda",
  working: "Ahora trabajas en {names}",
  openGuests: "Invitados",
  openTasks: "Tareas",
  openBudget: "Presupuesto",
  openRunsheet: "Programa del día",
  pickWedding: "Elige una boda para ver su resumen",
  weddingsSub: { one: "{n} boda", other: "{n} bodas" },
  loadFailed: "No pudimos cargar tus bodas",
  retry: "Reintentar",
  kinds: { request_answered: "Solicitud", task_overdue: "Tarea", task_due_today: "Tarea", wedding_soon: "Boda" },
};

export const COPY = { en, es };

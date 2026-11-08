// #5 plan card copy, EN and neutral LatAm ES (tú). The words are the portal's
// (src/lib/i18n/coordinator-plan.ts, Spanish written first), so the card reads
// the same on the web and in the app. The line sentences and their errors come
// from the server in both languages; only the chrome is here.

const en = {
  /** A plan that closed before it ran; the server's title says "N actions to confirm". */
  titleNotRunOne: "1 action not run",
  titleNotRun: "{n} actions not run",
  helper: "Untick what you do not want. Nothing changes until you run it.",
  runOne: "Run 1 action",
  run: "Run {n} actions",
  noneTicked: "Tick at least one action to run the plan.",
  discard: "Discard plan",
  retryFailedOne: "Try the 1 that failed",
  retryFailed: "Try the {n} that failed",
  runRestOne: "Run the 1 left",
  runRest: "Run the {n} left",
  running: "Running the plan",
  undo: "Undo",
  undoFailed: "Could not undo this action.",
  undone: {
    tasks: "Task removed",
    vendors: "Vendor removed",
    budget: "Budget line removed",
    runsheet: "Timeline moment removed",
    guests: "Guest removed",
    rsvps: "Answer undone",
  },
  step: {
    done: "Done",
    failed: "Not done",
    skipped: "Skipped",
    undone: "Undone",
    running: "Running",
    unknown: "To check",
    pending: "Not run",
  },
  area: {
    tasks: "Tasks",
    vendors: "Vendors",
    budget: "Budget",
    runsheet: "Day-of runsheet",
    guests: "Guests",
    rsvps: "RSVPs",
  },
  openArea: "Open {area}",
  expired: "This plan expired without running. Ask again if you still need it.",
  replaced: "A newer proposal replaced this plan. Nothing changed.",
  cancelled: "Plan discarded. Nothing changed.",
  readOnly: "Your role can see the plan but not run it.",
  askAgain: "Ask again",
  runFailed: "Could not run the plan.",
  /** VoiceOver: a tick's state is read by the switch itself; this names the line. */
  tickHint: "Runs with the plan when ticked",
};

const es: typeof en = {
  titleNotRunOne: "1 acción sin ejecutar",
  titleNotRun: "{n} acciones sin ejecutar",
  helper: "Desmarca lo que no quieras. Nada cambia hasta que lo ejecutes.",
  runOne: "Ejecutar 1 acción",
  run: "Ejecutar {n} acciones",
  noneTicked: "Marca al menos una acción para ejecutar el plan.",
  discard: "Descartar plan",
  retryFailedOne: "Reintentar la que falló",
  retryFailed: "Reintentar las {n} que fallaron",
  runRestOne: "Ejecutar la que falta",
  runRest: "Ejecutar las {n} que faltan",
  running: "Ejecutando el plan",
  undo: "Deshacer",
  undoFailed: "No se pudo deshacer esta acción.",
  undone: {
    tasks: "Tarea eliminada",
    vendors: "Proveedor eliminado",
    budget: "Línea de presupuesto eliminada",
    runsheet: "Momento eliminado del cronograma",
    guests: "Invitado eliminado",
    rsvps: "Respuesta deshecha",
  },
  step: {
    done: "Hecho",
    failed: "No se hizo",
    skipped: "Omitida",
    undone: "Deshecho",
    running: "En curso",
    unknown: "Por revisar",
    pending: "Sin ejecutar",
  },
  area: {
    tasks: "Tareas",
    vendors: "Proveedores",
    budget: "Presupuesto",
    runsheet: "Cronograma del día",
    guests: "Invitados",
    rsvps: "RSVPs",
  },
  openArea: "Abrir {area}",
  expired: "Este plan venció sin ejecutarse. Pídelo de nuevo si lo necesitas.",
  replaced: "Una propuesta más reciente reemplazó este plan. No se cambió nada.",
  cancelled: "Plan descartado. No se cambió nada.",
  readOnly: "Tu rol puede ver el plan pero no ejecutarlo.",
  askAgain: "Pedir de nuevo",
  runFailed: "No se pudo ejecutar el plan.",
  tickHint: "Se ejecuta con el plan cuando está marcada",
};

export const PLAN_COPY = { en, es };
export type PlanCopy = typeof en;

/** Where each area opens in the couple app. */
export const PLAN_AREA_ROUTE = {
  tasks: "/couple/tasks",
  vendors: "/couple/vendors",
  budget: "/couple/budget",
  runsheet: "/couple/runsheet",
  guests: "/couple/guests",
  rsvps: "/couple/guests",
} as const;

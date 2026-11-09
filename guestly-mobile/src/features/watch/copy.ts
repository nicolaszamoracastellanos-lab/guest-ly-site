// Strings that end up inside the snapshot (the watch shows them as they are).
// Fixed watch labels live on the watch (targets/watch/L10n.swift).

import type { WatchLang } from "./types";

export type WatchCopy = {
  today: string;
  tomorrow: string;
  overdue: string;
  due: (when: string) => string;
  doneAt: (time: string) => string;
  done: string;
  partyOf: (n: number) => string;
  table: (t: string) => string;
  onSite: string;
  dueAt: (t: string) => string;
  late: (min: number) => string;
  onSiteSummary: (n: number, m: number) => string;
  minLeft: (n: number) => string;
  lastIn: (name: string) => string;
  asks: (name: string) => string;
  repliesPending: (n: number) => string;
  tasksOpen: (n: number) => string;
  inMin: (n: number) => string;
  pushLabel: string;
  keepLabel: (time: string) => string;
  overrunQuestion: (title: string) => string;
  overrunBody: (over: string, next: string, time: string) => string;
  categories: Record<string, string>;
};

export const WATCH_COPY: Record<WatchLang, WatchCopy> = {
  en: {
    today: "Today",
    tomorrow: "Tomorrow",
    overdue: "Overdue",
    due: (w) => `Due ${w}`,
    doneAt: (t) => `Done ${t}`,
    done: "Done",
    partyOf: (n) => `Party of ${n}`,
    table: (t) => `Table ${t}`,
    onSite: "On site",
    dueAt: (t) => `Due ${t}`,
    late: (m) => `Late ${m} min`,
    onSiteSummary: (n, m) => `${n} of ${m} on site`,
    minLeft: (n) => `${n} min left`,
    lastIn: (n) => `Last in: ${n}`,
    asks: (n) => `${n} asks`,
    repliesPending: (n) => (n === 1 ? "1 reply pending" : `${n} replies pending`),
    tasksOpen: (n) => (n === 1 ? "1 task open" : `${n} tasks open`),
    inMin: (n) => `in ${n} min`,
    pushLabel: "Push 15 min",
    keepLabel: (t) => `Keep ${t}`,
    overrunQuestion: (t) => `Push ${t}?`,
    overrunBody: (o, n, t) => `${o} is running over. ${n} moves to ${t}.`,
    categories: { venue: "Venue", catering: "Catering", photo: "Photographer", video: "Videographer", music: "Music", flowers: "Florist", decor: "Decor", beauty: "Beauty", attire: "Attire", cake: "Cake", transport: "Transport", stationery: "Stationery", planner: "Planner", rentals: "Rentals", other: "Vendor" },
  },
  es: {
    today: "Hoy",
    tomorrow: "Mañana",
    overdue: "Vencida",
    due: (w) => `Vence ${w}`,
    doneAt: (t) => `Hecho ${t}`,
    done: "Hecho",
    partyOf: (n) => `Grupo de ${n}`,
    table: (t) => `Mesa ${t}`,
    onSite: "En el lugar",
    dueAt: (t) => `Llega ${t}`,
    late: (m) => `Retraso ${m} min`,
    onSiteSummary: (n, m) => `${n} de ${m} en el lugar`,
    minLeft: (n) => `faltan ${n} min`,
    lastIn: (n) => `Último: ${n}`,
    asks: (n) => `${n} pregunta`,
    repliesPending: (n) => (n === 1 ? "1 respuesta pendiente" : `${n} respuestas pendientes`),
    tasksOpen: (n) => (n === 1 ? "1 tarea abierta" : `${n} tareas abiertas`),
    inMin: (n) => `en ${n} min`,
    pushLabel: "Atrasar 15 min",
    keepLabel: (t) => `Dejar ${t}`,
    overrunQuestion: (t) => `¿Atrasar ${t}?`,
    overrunBody: (o, n, t) => `${o} se está pasando. ${n} se mueve a las ${t}.`,
    categories: { venue: "Salón", catering: "Banquetería", photo: "Fotógrafo", video: "Videógrafo", music: "Música", flowers: "Florista", decor: "Decoración", beauty: "Belleza", attire: "Vestuario", cake: "Pastel", transport: "Transporte", stationery: "Papelería", planner: "Planner", rentals: "Alquileres", other: "Proveedor" },
  },
};

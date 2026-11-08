/* #22: every word of the booking dialog, EN and ES (tú). Loaded with the
   dialog's lazy chunk only. Placeholders in braces are filled by the dialog. */

import type { BookField } from './core';

export type BookingCopy = {
  close: string;
  title: string;
  description: string;
  duration: string;
  zoneLine: string;
  hostLine: string;
  changeZone: string;
  zoneLabel: string;
  dayLegend: string;
  timesLegend: string;
  dayNone: string;
  dayOne: string;
  dayMany: string;
  loading: string;
  pickFirst: string;
  next: string;
  emptyWindow: string;
  nextOpen: string;
  closed: string;
  error: string;
  retry: string;
  whatsapp: string;
  taken: string;
  detailsTitle: string;
  changeTime: string;
  fields: { name: string; email: string; role: string; weddingDate: string; phone: string; notes: string };
  roles: { couple: string; planner: string; other: string };
  submit: string;
  sending: string;
  errors: Record<BookField, string> & { form: string; network: string; emailLimit: string };
  doneTitle: string;
  doneHost: string;
  doneSent: string;
  doneReplay: string;
  addToCalendar: string;
  manage: string;
  backToSite: string;
  privacyNote: string;
  privacyLink: string;
};

export const bookingCopy: Record<'en' | 'es', BookingCopy> = {
  en: {
    close: 'Close',
    title: 'Book a demo call',
    description: 'We walk through Guest-ly with your wedding in mind and answer your questions.',
    duration: '{n} minutes by video',
    zoneLine: 'Times in {zone}.',
    hostLine: 'Guest-ly works on {host}.',
    changeZone: 'Change time zone',
    zoneLabel: 'Your time zone',
    dayLegend: 'Pick a day',
    timesLegend: 'Times on {day}',
    dayNone: 'no times',
    dayOne: '1 time',
    dayMany: '{n} times',
    loading: 'Loading times',
    pickFirst: 'Pick a time first.',
    next: 'Choose this time',
    emptyWindow: 'No open times in these two weeks.',
    nextOpen: 'See times from {day}',
    closed: 'No times open right now. Write to us and we will find one with you.',
    error: 'Could not load the times. Check your connection and try again.',
    retry: 'Load times again',
    whatsapp: 'Chat on WhatsApp',
    taken: 'That time was just taken. Pick another.',
    detailsTitle: 'Your details',
    changeTime: 'Change time',
    fields: {
      name: 'Your name',
      email: 'Email',
      role: 'You are',
      weddingDate: 'Wedding date (optional)',
      phone: 'WhatsApp (optional)',
      notes: 'Anything we should know? (optional)',
    },
    roles: { couple: 'Part of the couple', planner: 'A wedding planner', other: 'Something else' },
    submit: 'Book the call',
    sending: 'Booking your call',
    errors: {
      name: 'Write your name.',
      email: 'Write an email address, like ana@example.com.',
      phone: 'Use digits, spaces and + only.',
      weddingDate: 'Pick a date, or leave it empty.',
      notes: 'Keep the note under 1,000 characters.',
      start: 'That time is no longer open. Pick another.',
      form: 'Could not read the form. Check it and try again.',
      network: 'Could not reach Guest-ly. Check your connection and try again.',
      emailLimit: 'You already booked today. Check your email for the details.',
    },
    doneTitle: 'Your call is booked',
    doneHost: 'For Guest-ly: {time}, {host}.',
    doneSent: 'We sent the details and a calendar invite to {email}.',
    doneReplay: 'We sent the details and the link to your email.',
    addToCalendar: 'Add to calendar',
    manage: 'Change or cancel the call',
    backToSite: 'Back to the site',
    privacyNote: 'We use your email only for this call.',
    privacyLink: 'Privacy',
  },
  es: {
    close: 'Cerrar',
    title: 'Agendar una demo',
    description: 'Te mostramos Guest-ly pensando en tu boda y respondemos tus preguntas.',
    duration: '{n} minutos por video',
    zoneLine: 'Horarios en {zone}.',
    hostLine: 'Guest-ly trabaja en {host}.',
    changeZone: 'Cambiar zona horaria',
    zoneLabel: 'Tu zona horaria',
    dayLegend: 'Elige un día',
    timesLegend: 'Horarios del {day}',
    dayNone: 'sin horarios',
    dayOne: '1 horario',
    dayMany: '{n} horarios',
    loading: 'Cargando horarios',
    pickFirst: 'Primero elige un horario.',
    next: 'Elegir este horario',
    emptyWindow: 'No hay horarios libres en estas dos semanas.',
    nextOpen: 'Ver horarios desde el {day}',
    closed: 'No hay horarios abiertos ahora. Escríbenos y buscamos uno contigo.',
    error: 'No se pudieron cargar los horarios. Revisa tu conexión e inténtalo de nuevo.',
    retry: 'Cargar horarios de nuevo',
    whatsapp: 'Escribir por WhatsApp',
    taken: 'Ese horario se acaba de ocupar. Elige otro.',
    detailsTitle: 'Tus datos',
    changeTime: 'Cambiar horario',
    fields: {
      name: 'Tu nombre',
      email: 'Correo',
      role: 'Eres',
      weddingDate: 'Fecha de la boda (opcional)',
      phone: 'WhatsApp (opcional)',
      notes: '¿Algo que debamos saber? (opcional)',
    },
    roles: { couple: 'Parte de la pareja', planner: 'Planner de bodas', other: 'Otro' },
    submit: 'Agendar la llamada',
    sending: 'Agendando tu llamada',
    errors: {
      name: 'Escribe tu nombre.',
      email: 'Escribe un correo, como ana@ejemplo.com.',
      phone: 'Usa solo números, espacios y +.',
      weddingDate: 'Elige una fecha o déjala vacía.',
      notes: 'Escribe la nota en menos de 1.000 caracteres.',
      start: 'Ese horario ya no está libre. Elige otro.',
      form: 'No pudimos leer el formulario. Revísalo e inténtalo de nuevo.',
      network: 'No pudimos conectar con Guest-ly. Revisa tu conexión e inténtalo de nuevo.',
      emailLimit: 'Ya agendaste hoy. Revisa tu correo para ver los detalles.',
    },
    doneTitle: 'Tu llamada está agendada',
    doneHost: 'Para Guest-ly: {time}, {host}.',
    doneSent: 'Enviamos los detalles y una invitación de calendario a {email}.',
    doneReplay: 'Enviamos los detalles y el enlace a tu correo.',
    addToCalendar: 'Agregar al calendario',
    manage: 'Cambiar o cancelar la llamada',
    backToSite: 'Volver al sitio',
    privacyNote: 'Usamos tu correo solo para esta llamada.',
    privacyLink: 'Privacidad',
  },
};

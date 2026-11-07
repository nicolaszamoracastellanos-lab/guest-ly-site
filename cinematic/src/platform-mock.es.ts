/* Spanish for the platform tour vignettes (ui/MockScreens.tsx), keyed by the
   exact English string the component renders. Loaded only when the page is in
   Spanish (ui/PlatformTabs.tsx), so it stays out of the main bundle. Names,
   numbers and glyphs are not listed: they read the same in both languages.
   scripts/test-platform-mock-i18n.mjs fails when a rendered English string
   has no entry here. */
const MOCK_ES: Record<string, string> = {
  questions: 'preguntas',
  answered: 'respondidas',
  'topics rising': 'temas en alza',
  gap: 'vacío',
  'Is there parking at the venue?': '¿Hay estacionamiento en el lugar?',
  'party of {n}': 'grupo de {n}',
  'Party: Luis · RSVP: both events': 'Grupo: Luis · RSVP: ambos eventos',
  'History: 3 questions answered': 'Historial: 3 preguntas respondidas',
  'no reply yet': 'sin respuesta',
  'has phone': 'con teléfono',
  'Friendly reminder: RSVP closes May 12…': 'Recordatorio: el RSVP cierra el 12 de mayo…',
  recipients: 'destinatarios',
  paid: 'pagado',
  'due Sep': 'vence sep.',
  'reimb.': 'reembolso',
  'Venue deposit · 12,000.00': 'Depósito del lugar · 12.000,00',
  'Catering, per plate · 89.50': 'Banquete, por plato · 89,50',
  'Florals, arch · 1,450.00': 'Flores, arco · 1.450,00',
  'Import review': 'Revisión de importación',
  '109 items found · total 285,545.06': '109 partidas encontradas · total 285.545,06',
  'Nothing is written until you approve': 'No se escribe nada hasta que apruebes',
  'grand total': 'total general',
  'Shuttle: leaves Hotel Grand at 3:15 PM, free for guests…': 'Transporte: sale del Hotel Grand a las 3:15 PM, gratis para invitados…',
  'v12 · live': 'v12 · en vivo',
  'v12 · draft': 'v12 · borrador',
  'Change request · 3 edits': 'Solicitud de cambios · 3 ediciones',
  'Rosa Delgado: table 7 → 4': 'Rosa Delgado: mesa 7 → 4',
  'Diego Morales: vegetarian': 'Diego Morales: vegetariano',
  'Awaiting the couple’s approval': 'Esperando la aprobación de la pareja',
  edit: 'editar',
  'Rosa Delgado · table 7 → 4': 'Rosa Delgado · mesa 7 → 4',
  'Diego Morales · vegetarian': 'Diego Morales · vegetariano',
  'Phones and emails hidden': 'Teléfonos y correos ocultos',
  'checked in': 'registrados',
};

export default MOCK_ES;

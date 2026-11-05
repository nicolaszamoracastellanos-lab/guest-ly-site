/* #50: the words of the guides form, EN and ES (tú). In the form's lazy
   chunk only; the section header lives in ./head-copy.ts. Placeholders in
   braces are filled by the form. */

export type GuidesCopy = {
  destLegend: string;
  email: string;
  consent: string;
  consentNote: string;
  privacyLink: string;
  submit: string;
  sending: string;
  errors: { destination: string; email: string; form: string; network: string };
  closed: string;
  doneTitle: string;
  doneBody: string;
  another: string;
};

/* Version of the tips sentence (consent). A new wording needs a new version. */
export const CONSENT_VERSION = 'guides-tips-2026-11-05';

export const guidesCopy: Record<'en' | 'es', GuidesCopy> = {
  en: {
    destLegend: 'Pick a destination',
    email: 'Your email',
    consent: 'Also send me wedding planning tips from Guest-ly',
    consentNote: 'We email the guide once. Tips only if you tick the box, and you can stop them any time.',
    privacyLink: 'Privacy',
    submit: 'Email me the guide',
    sending: 'Sending the guide',
    errors: {
      destination: 'Pick a destination first.',
      email: 'Write an email address, like ana@example.com.',
      form: 'Could not read the form. Check it and try again.',
      network: 'Could not reach Guest-ly. Check your connection and try again.',
    },
    closed: 'Guides are not available right now. Write to us at {email} and we will send yours.',
    doneTitle: 'Check your inbox',
    doneBody: 'The {place} guide is on its way to {email}.',
    another: 'Get another guide',
  },
  es: {
    destLegend: 'Elige un destino',
    email: 'Tu correo',
    consent: 'Envíame también consejos de Guest-ly para organizar la boda',
    consentNote: 'Enviamos la guía una sola vez. Los consejos, solo si marcas la casilla, y puedes dejarlos cuando quieras.',
    privacyLink: 'Privacidad',
    submit: 'Enviarme la guía',
    sending: 'Enviando la guía',
    errors: {
      destination: 'Primero elige un destino.',
      email: 'Escribe un correo, como ana@ejemplo.com.',
      form: 'No pudimos leer el formulario. Revísalo e inténtalo de nuevo.',
      network: 'No pudimos conectar con Guest-ly. Revisa tu conexión e inténtalo de nuevo.',
    },
    closed: 'Las guías no están disponibles ahora. Escríbenos a {email} y te enviamos la tuya.',
    doneTitle: 'Revisa tu correo',
    doneBody: 'La guía de {place} va camino a {email}.',
    another: 'Pedir otra guía',
  },
};

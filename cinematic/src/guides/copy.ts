/* #50: the words of the guides form, EN and ES (tú). In the form's lazy
   chunk only; the section header lives in ./head-copy.ts. Placeholders in
   braces are filled by the form. The places and the tips sentence are not
   here: they come from the catalogue on app.guest-ly.com, so the sentence
   the person ticks is the one the server records with its version. */

export type GuidesCopy = {
  destLegend: string;
  email: string;
  consentNote: string;
  privacyLink: string;
  submit: string;
  sending: string;
  errors: { code: string; email: string; form: string; network: string; retry: string };
  closed: string;
  doneTitle: string;
  doneBody: string;
  another: string;
};

export const guidesCopy: Record<'en' | 'es', GuidesCopy> = {
  en: {
    destLegend: 'Pick a destination',
    email: 'Your email',
    consentNote: 'We email the guide once. Tips only if you tick the box, and you can stop them any time.',
    privacyLink: 'Privacy',
    submit: 'Email me the guide',
    sending: 'Sending the guide',
    errors: {
      code: 'Pick a destination first.',
      email: 'Write an email address, like ana@example.com.',
      form: 'Could not read the form. Check it and try again.',
      network: 'Could not reach Guest-ly. Check your connection and try again.',
      retry: 'Could not send the guide. Try again in a minute.',
    },
    closed: 'Guides are not available right now. Write to us at {email} and we will send yours.',
    doneTitle: 'Check your inbox',
    doneBody: 'The {place} guide is on its way to {email}.',
    another: 'Get another guide',
  },
  es: {
    destLegend: 'Elige un destino',
    email: 'Tu correo',
    consentNote: 'Enviamos la guía una sola vez. Los consejos, solo si marcas la casilla, y puedes dejarlos cuando quieras.',
    privacyLink: 'Privacidad',
    submit: 'Enviarme la guía',
    sending: 'Enviando la guía',
    errors: {
      code: 'Primero elige un destino.',
      email: 'Escribe un correo, como ana@ejemplo.com.',
      form: 'No pudimos leer el formulario. Revísalo e inténtalo de nuevo.',
      network: 'No pudimos conectar con Guest-ly. Revisa tu conexión e inténtalo de nuevo.',
      retry: 'No se pudo enviar la guía. Inténtalo de nuevo en un minuto.',
    },
    closed: 'Las guías no están disponibles ahora. Escríbenos a {email} y te enviamos la tuya.',
    doneTitle: 'Revisa tu correo',
    doneBody: 'La guía de {place} va camino a {email}.',
    another: 'Pedir otra guía',
  },
};

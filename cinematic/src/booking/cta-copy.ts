/* #22: the words on the booking buttons, EN and ES. Kept apart from copy.ts
   so nothing of the booking feature is in the build while BOOKING_ENABLED is
   false; the dialog's own words live in ./copy.ts (its lazy chunk). */
export const bookCtaCopy = {
  en: {
    cta: 'Book a demo call',
    pricingLine: 'Not sure which plan fits? Talk it through with us on a short video call.',
    wizardLine: 'Questions before you pay?',
  },
  es: {
    cta: 'Agendar una demo',
    pricingLine: '¿No sabes qué plan te conviene? Lo vemos juntos en una videollamada corta.',
    wizardLine: '¿Preguntas antes de pagar?',
  },
} as const;

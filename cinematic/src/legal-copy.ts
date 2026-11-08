/* The legal pages' text (/privacy, /terms, /refunds), EN and ES. It lives
   apart from src/copy.ts so it ships in the legal pages' own lazy chunk
   (src/ui/LegalPage.tsx) and stays out of the home page's first load
   (STUDY-quality-bar 7.4, scripts/check-seo.mjs). Same house rules as the
   rest of the copy: no em dashes, no emojis, Guest-ly with the hyphen. */

import { COORDINATOR_MONTHLY, COORDINATOR_ONCE, MAINTENANCE_MONTHLY, MONTHS_INCLUDED, ordinalEn } from './pricing.ts';
import type { Locale } from './copy.ts';

export interface LegalSection {
  h: string;
  body: string[];
}

export interface LegalPage {
  title: string;
  updated: string;
  sections: LegalSection[];
}

export interface LegalCopy {
  backHome: string;
  contactLine: string;
  pages: { privacy: LegalPage; terms: LegalPage; refunds: LegalPage };
}

const en: LegalCopy = {
  backHome: 'Back to guest-ly.com',
  contactLine: 'Questions? Write to nicolas@guest-ly.com. We answer every message ourselves.',
  pages: {
    privacy: {
      title: 'Privacy',
      updated: 'Last updated: November 2026',
      sections: [
        {
          h: 'What we collect',
          body: [
            'When you start an order, we collect what you type into the order form: your name, your partner’s name, email, phone (optional), wedding date, city and notes. The form is delivered to our inbox via FormSubmit, the form relay service.',
            'If you try the live hero demo, the messages you type are sent to a demo concierge for a fictional wedding so it can reply. Demo conversations are not linked to your identity and the demo session lives only in your browser.',
            'Once you are a client, the wedding information you give us (schedule, venues, guest list, travel tips) is used solely to run your concierge.',
          ],
        },
        {
          h: 'Why we collect it',
          body: [
            'To respond to your order, to build and operate your wedding concierge, and for nothing else. We do not sell data, run ads, or share guest lists with anyone.',
          ],
        },
        {
          h: 'Retention',
          body: [
            'Order emails are kept while we work together and deleted on request. Client wedding data is kept through the wedding and removed after the service ends. Write to us any time to have your data deleted.',
          ],
        },
      ],
    },
    terms: {
      title: 'Terms of Service',
      updated: 'Last updated: November 2026',
      sections: [
        {
          h: 'The service',
          body: [
            'Guest-ly builds and operates an AI wedding concierge for your guests (web chat and WhatsApp), a wedding website with per-person RSVPs, and a private couple portal. We handle setup, hosting and monitoring.',
            'Guest-ly is operated by ZC Ventures LLC. Contact: nicolas@guest-ly.com.',
          ],
        },
        {
          h: `One-time payment, ${MONTHS_INCLUDED} months live included`,
          body: [
            `Every plan is a single one-time payment that includes ${MONTHS_INCLUDED} months of live service, counted from the delivery date (the day we email you that your concierge is ready). During those months the concierge, website, RSVP and portal run with no further charge.`,
            `After the included ${MONTHS_INCLUDED} months, keeping the service live costs a maintenance fee of $${MAINTENANCE_MONTHLY} per month, billed monthly through Stripe and cancellable at any time. We notify you in your portal and by email when your ${ordinalEn(MONTHS_INCLUDED)} included month starts, a week before the included period ends, and on the day it ends. If no maintenance plan is active after the included period, the service may be paused until one is.`,
            `The optional AI Coordinator is billed separately: $${COORDINATOR_ONCE} one-time (stays active for as long as your service is live) or $${COORDINATOR_MONTHLY} per month, which continues alongside the maintenance fee.`,
          ],
        },
        {
          h: 'Fair use',
          body: [
            'Plan limits count invited guests, not messages. Messages are effectively unlimited under fair use.',
          ],
        },
        {
          h: 'Refunds',
          body: ['See the refund policy page. Its terms are part of these terms.'],
        },
      ],
    },
    refunds: {
      title: 'Refund Policy',
      updated: 'Last updated: November 2026',
      sections: [
        {
          h: 'The guarantee',
          body: [
            'Full refund before your first guest messages the concierge, or within 30 days of payment, whichever comes first.',
            'In plain words: if we have built your concierge but no guest has used it yet, you can still walk away with all of your money. Once guests are actively using it, the 30-day window applies.',
          ],
        },
        {
          h: 'How to request one',
          body: [
            'Email nicolas@guest-ly.com with the name on your order. No forms, no questions beyond what we need to send the money back. Refunds go to the original payment method within 5 business days.',
          ],
        },
      ],
    },
  },
};

const es: LegalCopy = {
  backHome: 'Volver a guest-ly.com',
  contactLine: '¿Preguntas? Escribe a nicolas@guest-ly.com. Respondemos cada mensaje nosotros mismos.',
  pages: {
    privacy: {
      title: 'Privacidad',
      updated: 'Última actualización: noviembre de 2026',
      sections: [
        {
          h: 'Qué recolectamos',
          body: [
            'Cuando inicias un pedido, recolectamos lo que escribes en el formulario: tu nombre, el de tu pareja, correo, teléfono (opcional), fecha de la boda, ciudad y notas. El formulario llega a nuestro correo vía FormSubmit, el servicio de envío de formularios.',
            'Si pruebas el demo en vivo, los mensajes que escribes se envían a un asistente demo de una boda ficticia para que pueda responder. Las conversaciones del demo no se vinculan a tu identidad y la sesión vive solo en tu navegador.',
            'Cuando ya eres cliente, la información de tu boda (horarios, lugares, lista de invitados, consejos de viaje) se usa únicamente para operar tu asistente.',
          ],
        },
        {
          h: 'Para qué la usamos',
          body: [
            'Para responder tu pedido, construir y operar tu asistente de boda, y nada más. No vendemos datos, no mostramos publicidad y no compartimos listas de invitados con nadie.',
          ],
        },
        {
          h: 'Retención',
          body: [
            'Los correos de pedidos se conservan mientras trabajamos juntos y se eliminan a pedido. Los datos de la boda se conservan hasta después de la boda y se eliminan al terminar el servicio. Escríbenos cuando quieras para borrar tus datos.',
          ],
        },
      ],
    },
    terms: {
      title: 'Términos del Servicio',
      updated: 'Última actualización: noviembre de 2026',
      sections: [
        {
          h: 'El servicio',
          body: [
            'Guest-ly construye y opera un asistente IA para tus invitados (chat web y WhatsApp), una página de boda con RSVP por persona, y un portal privado de pareja. Nosotros manejamos la configuración, el hosting y el monitoreo.',
            'Guest-ly es operado por ZC Ventures LLC. Contacto: nicolas@guest-ly.com.',
          ],
        },
        {
          h: `Pago único, ${MONTHS_INCLUDED} meses activos incluidos`,
          body: [
            `Cada plan es un único pago que incluye ${MONTHS_INCLUDED} meses de servicio activo, contados desde la fecha de entrega (el día en que te enviamos el email de que tu asistente está listo). Durante esos meses el asistente, la página, el RSVP y el portal funcionan sin ningún cargo adicional.`,
            `Después de los ${MONTHS_INCLUDED} meses incluidos, mantener el servicio activo cuesta una cuota de mantenimiento de $${MAINTENANCE_MONTHLY} al mes, cobrada mensualmente por Stripe y cancelable en cualquier momento. Te avisamos en tu portal y por email cuando empieza tu ${MONTHS_INCLUDED}° mes incluido, una semana antes de que termine el periodo incluido y el día en que termina. Si no hay un plan de mantenimiento activo después del periodo incluido, el servicio puede pausarse hasta que lo haya.`,
            `El Coordinador IA opcional se cobra por separado: $${COORDINATOR_ONCE} pago único (sigue activo mientras tu servicio esté activo) o $${COORDINATOR_MONTHLY} al mes, que continúa junto con la cuota de mantenimiento.`,
          ],
        },
        {
          h: 'Uso razonable',
          body: [
            'Los límites de los planes cuentan personas invitadas, no mensajes. Los mensajes son en la práctica ilimitados, bajo uso razonable.',
          ],
        },
        {
          h: 'Reembolsos',
          body: ['Consulta la página de política de reembolsos. Sus términos forman parte de estos términos.'],
        },
      ],
    },
    refunds: {
      title: 'Política de Reembolsos',
      updated: 'Última actualización: noviembre de 2026',
      sections: [
        {
          h: 'La garantía',
          body: [
            'Reembolso total antes de que tu primer invitado le escriba al asistente, o dentro de los 30 días posteriores al pago, lo que ocurra primero.',
            'En palabras simples: si ya construimos tu asistente pero ningún invitado lo ha usado, todavía puedes retirarte con todo tu dinero. Cuando los invitados ya lo usan activamente, aplica la ventana de 30 días.',
          ],
        },
        {
          h: 'Cómo pedirlo',
          body: [
            'Envía un correo a nicolas@guest-ly.com con el nombre de tu pedido. Sin formularios, sin más preguntas que las necesarias para devolverte el dinero. Los reembolsos van al método de pago original dentro de 5 días hábiles.',
          ],
        },
      ],
    },
  },
};

export const legalCopy: Record<Locale, LegalCopy> = { en, es };

/* #23: the privacy page's visit-counts paragraph, EN and ES. Shown only
   while SITE_BEACON_URL is set (LegalPage), so the disclosure goes live with
   the beacon and never before; an empty URL leaves it out of the bundle. */
export const visitCountsCopy: Record<'en' | 'es', { h: string; body: string[] }> = {
  en: {
    h: 'Visit counts',
    body: [
      'To learn which parts of this site help couples and planners, the site counts visits without cookies. It notes which sections were shown, how far the page was scrolled, which buttons and links were used (by their name or where they lead, never what you type), the page language, the screen size group and the site that linked here.',
      'Nothing is stored on your device. Your IP address is never kept: it is combined with a value that changes every day into a code that does not identify you and cannot link one day to the next. Visit details are kept for two days at most; after that only daily totals remain.',
      'The counts go to our own server at app.guest-ly.com. No analytics company or ad network receives them.',
      'If your browser sends Do Not Track or Global Privacy Control, nothing is counted.',
    ],
  },
  es: {
    h: 'Conteo de visitas',
    body: [
      'Para saber qué partes del sitio ayudan a parejas y planners, el sitio cuenta las visitas sin cookies. Registra qué secciones se mostraron, hasta dónde se desplazó la página, qué botones y enlaces se usaron (por su nombre o a dónde llevan, nunca lo que escribes), el idioma de la página, el tipo de pantalla y el sitio que te trajo aquí.',
      'No se guarda nada en tu dispositivo. Tu dirección IP nunca se conserva: se combina con un valor que cambia cada día para formar un código que no te identifica y no permite unir un día con otro. El detalle de las visitas se conserva dos días como máximo; después solo quedan totales por día.',
      'Los conteos van a nuestro propio servidor en app.guest-ly.com. Ninguna empresa de analítica ni red de publicidad los recibe.',
      'Si tu navegador envía Do Not Track o Global Privacy Control, no se cuenta nada.',
    ],
  },
};

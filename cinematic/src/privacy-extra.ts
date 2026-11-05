/* Privacy page paragraphs for #22 (demo calls) and #50 (destination guides).
   LegalPage renders each one only while its switch is on (src/switches.ts),
   so a disclosure goes live with its feature and never before. DRAFT
   wording: Nicolas approves it, with a new "Last updated" date, before either
   switch is turned on (open issue in L7-LOG). */

type Block = { h: string; body: string[] };

export const bookingPrivacyCopy: Record<'en' | 'es', Block> = {
  en: {
    h: 'Demo calls',
    body: [
      'When you book a demo call, we receive the time you picked, your name and email, and what you choose to add: whether you are part of the couple or a planner, your wedding date, your WhatsApp number and a note. Your time zone is used to show the times in your own time.',
      'We use these details to hold the call, send you the confirmation, the calendar invite and the reminders, and to prepare for the call. They are stored on our own server at app.guest-ly.com and the emails go out through our email provider. We never sell them or use them for ads.',
      'You can change or cancel the call with the link in your confirmation email, and you can ask us to delete your details at any time.',
    ],
  },
  es: {
    h: 'Llamadas de demo',
    body: [
      'Cuando agendas una llamada de demo, recibimos el horario que elegiste, tu nombre y tu correo, y lo que quieras agregar: si eres parte de la pareja o planner, la fecha de tu boda, tu número de WhatsApp y una nota. Tu zona horaria se usa para mostrarte los horarios en tu hora.',
      'Usamos estos datos para reservar la llamada, enviarte la confirmación, la invitación de calendario y los recordatorios, y para preparar la llamada. Se guardan en nuestro propio servidor en app.guest-ly.com y los correos salen a través de nuestro proveedor de correo. Nunca los vendemos ni los usamos para publicidad.',
      'Puedes cambiar o cancelar la llamada con el enlace de tu correo de confirmación, y puedes pedirnos que borremos tus datos cuando quieras.',
    ],
  },
};

export const guidesPrivacyCopy: Record<'en' | 'es', Block> = {
  en: {
    h: 'Destination guides',
    body: [
      'When you ask for a guide, we receive your email address, the destination, the page language and your time zone, and we email you a link to the guide.',
      'We send wedding planning tips only if you tick the box, and we keep the sentence you agreed to and when. Every tips email has a link to stop them.',
      'Requests are stored on our own server at app.guest-ly.com. We never sell your address or use it for ads.',
    ],
  },
  es: {
    h: 'Guías de destino',
    body: [
      'Cuando pides una guía, recibimos tu correo, el destino, el idioma de la página y tu zona horaria, y te enviamos por correo un enlace a la guía.',
      'Solo te enviamos consejos para organizar la boda si marcas la casilla, y guardamos la frase que aceptaste y cuándo. Cada correo de consejos tiene un enlace para dejarlos.',
      'Las solicitudes se guardan en nuestro propio servidor en app.guest-ly.com. Nunca vendemos tu correo ni lo usamos para publicidad.',
    ],
  },
};

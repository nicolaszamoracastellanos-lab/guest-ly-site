/* Complete site copy for the Guest-ly cinematic experience, EN and ES.
   Wave 5: nine-section IA, progressive disclosure, truth pass. Brand is
   always written "Guest-ly". Multi-line headings use '\n'.
   House rules: no em dashes anywhere, no emojis in client-facing strings.
   Permitted symbols: the diamond, checkmarks, crosses, typographic marks. */

export type Locale = 'en' | 'es';

export interface ChatMessage {
  from: 'guest' | 'ai';
  text: string;
}

export interface PillarDetail {
  h: string;
  b: string;
}

export interface LegalSection {
  h: string;
  body: string[];
}

export interface LegalPage {
  title: string;
  updated: string;
  sections: LegalSection[];
}

export interface SiteCopy {
  meta: { title: string };
  nav: {
    links: { label: string; href: string }[];
    login: { label: string; href: string };
    cta: string;
    theme: { label: string; day: string; night: string };
    skip: string;
  };
  hero: {
    badge: string;
    kicker: string;
    titleLines: string[];
    accentIndex: number;
    sub: string;
    primary: string;
    secondary: string;
    stats: { value: string; label: string }[];
    chat: {
      header: string;
      sub: string;
      liveTag: string;
      chips: string[];
      inputPlaceholder: string;
      inputPlaceholderLive: string;
      send: string;
      messages: ChatMessage[];
      limitNote: string;
      rateNote: string;
      errorPrefix: string;
    };
    marquee: string[];
    scrollHint: string;
  };
  pillars: {
    no: string;
    kicker: string;
    title: string;
    expand: string;
    items: { id: string; title: string; line: string; details: PillarDetail[]; note?: string }[];
  };
  how: {
    no: string;
    kicker: string;
    title: string;
    intro: string;
    steps: { n: string; title: string; body: string }[];
    cta: string;
    ctaNote: string;
  };
  pricing: {
    no: string;
    kicker: string;
    title: string;
    intro: string;
    popularTag: string;
    plans: {
      id: 'essentials' | 'signature' | 'grande';
      name: string;
      guests: string;
      price: number;
      priceNote: string;
      features: string[];
      cta: string;
      popular?: boolean;
    }[];
    coordinator: { badge: string; name: string; body: string };
    guarantee: string;
    zolaLine: string;
  };
  founding: {
    no: string;
    kicker: string;
    title: string;
    body: string[];
    offer: { badge: string; body: string; ends: string; cta: string };
    /* Real testimonials land here later; the section renders nothing extra
       while the list is empty. */
    proof: { quote: string; names: string; place: string }[];
  };
  faq: {
    no: string;
    kicker: string;
    title: string;
    human: { title: string; body: string; email: string };
    items: { q: string; a: string }[];
  };
  cta: {
    kicker: string;
    title: string;
    body: string;
    primary: string;
    secondary: string;
  };
  footer: {
    blurb: string;
    explore: { title: string; links: { label: string; href: string }[] };
    contact: { title: string; email: string; startOrder: string; intakeForm: string };
    legal: { title: string; links: { label: string; href: string }[] };
    entityNote: string;
    copyright: string;
    crafted: string;
  };
  wizard: {
    stepLabels: string[];
    step1: {
      title: string;
      sub: string;
      guestsLabel: string;
      guestRanges: { id: 'essentials' | 'signature' | 'grande' | 'grande-plus'; label: string }[];
      dateLabel: string;
      locationLabel: string;
      next: string;
    };
    step2: {
      title: string;
      sub: string;
      reason: string;
      reasonPlus: string;
      addon: { title: string; pitch: string; includedNote: string };
      back: string;
      next: string;
    };
    step3: {
      title: string;
      sub: string;
      fields: {
        name: string;
        partner: string;
        email: string;
        phone: string;
        notes: string;
      };
      back: string;
      confirm: string;
    };
    step4: {
      badge: string;
      title: string;
      summaryTitle: string;
      rows: { plan: string; guests: string; couple: string; date: string; addon: string; price: string };
      addonYes: string;
      addonNo: string;
      nextTitle: string;
      next: { title: string; body: string }[];
      payCta: string;
      payNoteLinked: string;
      payNoteFallback: string;
      whatsapp: string;
      refundLine: string;
      refundLink: string;
      mailFallback: string;
      mailFallbackLink: string;
      backHome: string;
    };
  };
  legal: {
    backHome: string;
    contactLine: string;
    pages: { privacy: LegalPage; terms: LegalPage; refunds: LegalPage };
  };
}

/* The floating-questions marquee is intentionally multilingual on the site
   (EN / ES / FR / DE mixed) and identical in both language modes: it shows
   the reality of an international guest list. The honest language claim
   (bilingual EN/ES, best effort in other languages) lives in pillar one. */
const marquee: string[] = [
  "What's the dress code?",
  '¿Hay shuttle desde el hotel?',
  'Can I bring a plus-one?',
  '¿Dónde hago el RSVP?',
  'Which hotel has the group rate?',
  'Quel est le programme du jour ?',
  'Is there parking at the venue?',
  '¿A qué hora es la ceremonia?',
  'Are kids welcome?',
  'Wie komme ich vom Flughafen dorthin?',
  "What's on the menu?",
  '¿Cuál es la lista de regalos?',
];

const en: SiteCopy = {
  meta: { title: 'Guest-ly: AI Concierge & Wedding Platform' },

  nav: {
    links: [
      { label: 'See it work', href: '#hero' },
      { label: 'What you get', href: '#pillars' },
      { label: 'How it works', href: '#how' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'FAQ', href: '#faq' },
    ],
    login: { label: 'Client Login', href: 'https://app.guest-ly.com' },
    cta: 'Get started',
    theme: { label: 'Theme', day: 'Day', night: 'Night' },
    skip: 'Skip to content',
  },

  hero: {
    badge: 'Built for our own 400-guest wedding',
    kicker: 'AI Concierge · Weddings & Events',
    titleLines: ['Your guests,', 'answered.', 'Always.'],
    accentIndex: 1,
    sub: 'Stop answering the same questions 200 times. A 24/7 concierge, per-person RSVPs, and one portal to run it all.',
    primary: 'Get my concierge',
    secondary: 'Try the demo',
    stats: [
      { value: '24/7', label: 'Always on' },
      { value: '0', label: 'Questions you answer at 2am' },
      { value: 'EN/ES', label: 'Fully bilingual' },
      { value: '~7d', label: 'To launch' },
    ],
    chat: {
      header: 'Emma & James · Guest-ly',
      sub: 'Powered by AI',
      liveTag: 'Live demo. A real Guest-ly concierge for a fictional wedding.',
      chips: ['Dress code', 'Hotels', 'Shuttle', 'RSVP'],
      inputPlaceholder: 'Ask about the wedding',
      inputPlaceholderLive: 'Ask about the demo wedding of Emma and James',
      send: 'Send',
      messages: [
        { from: 'guest', text: "What's the dress code?" },
        { from: 'ai', text: 'Black tie optional. Formal attire encouraged, no jeans please.' },
        { from: 'guest', text: 'Is there a shuttle from the hotel?' },
        { from: 'ai', text: 'Yes, from Hotel Grand at 3:15 PM. Free for all guests.' },
      ],
      limitNote: 'The demo rests after a few questions. Your real concierge never will.',
      rateNote: 'One message every few seconds, please. The demo likes to savor each question.',
      errorPrefix: 'The concierge is napping. Here is what it would say:',
    },
    marquee,
    scrollHint: 'Scroll',
  },

  pillars: {
    no: '№ 01',
    kicker: 'What you get',
    title: 'Three promises.',
    expand: 'See what that means',
    items: [
      {
        id: 'guests',
        title: 'Your guests',
        line: 'Ask anything, any hour, in their language.',
        details: [
          {
            h: 'Web chat and WhatsApp',
            b: 'An elegant chat page on a link, plus a dedicated WhatsApp number guests text like any contact. Nothing to install, no accounts to create: they tap a link or scan a QR code and ask away.',
          },
          {
            h: 'Wedding website with per-person RSVPs',
            b: 'A bilingual site with your story, itinerary, dress code and registry. Each guest confirms each person for each event, from the site or straight in the chat.',
          },
          {
            h: 'Travel answers built in',
            b: 'Visas, currency, weather, transport and local tips for guests flying in from abroad.',
          },
          {
            h: 'QR guest passes',
            b: 'Every guest gets a personal QR pass for a smooth check-in at the door.',
          },
          {
            h: 'Their language',
            b: 'Fully bilingual in English and Spanish, with best-effort answers in other languages. SMS and Telegram are coming soon.',
          },
        ],
      },
      {
        id: 'you',
        title: 'You',
        line: 'One screen, everything visible, nothing to install.',
        details: [
          {
            h: 'Wedding Brain',
            b: 'Everything your concierge knows, editable by you. Change a hotel tip, preview the answer, publish instantly.',
          },
          {
            h: 'Live dashboard',
            b: 'Every question guests ask, the topics they care about, RSVP momentum, and the gaps your Brain has not covered yet.',
          },
          {
            h: 'Guest list and RSVP board',
            b: 'Import from Excel, CSV or Zola in one click. Every response with per-event detail, automatic reminders to non-responders, and a Monday digest in your inbox.',
          },
          {
            h: 'Broadcasts',
            b: 'Message all guests, only non-responders, or one group, on WhatsApp, in each guest’s own language.',
          },
          {
            h: 'Website studio',
            b: 'Edit your wedding site live: sections, themes, photos, custom RSVP questions. Publish when it is perfect.',
          },
          {
            h: 'AI Coordinator',
            b: 'The optional add-on: tell it what changed, in plain English or Spanish, and it updates the list, the RSVPs and the reminders. Every change asks for your approval first.',
          },
        ],
      },
      {
        id: 'under',
        title: 'Under it',
        line: 'Built, hosted and monitored by us.',
        details: [
          {
            h: 'Trained only on your wedding',
            b: 'The concierge answers from your wedding’s information alone. When it is not sure, it tells the guest it is checking with you and flags the question on your dashboard.',
          },
          {
            h: 'Full transcripts',
            b: 'You can read every conversation your guests have with the concierge, any time.',
          },
          {
            h: 'Zero setup for you',
            b: 'We handle the WhatsApp business approval, the hosting, the servers and the monitoring. You never touch code or create a business account.',
          },
          {
            h: 'Version history',
            b: 'Every change to your Wedding Brain is versioned, with one-click rollback.',
          },
          {
            h: 'Live in about a week',
            b: 'From intake form to live concierge in about seven days. Signature and Grande include priority support. Guest limits count invited people, not messages.',
          },
        ],
      },
    ],
  },

  how: {
    no: '№ 02',
    kicker: 'How it works',
    title: 'From order to live concierge\nin about a week.',
    intro: '',
    steps: [
      {
        n: '01',
        title: 'Fill the intake form',
        body: 'Venue, schedule, hotels, dress code, travel tips. 15 minutes.',
      },
      {
        n: '02',
        title: 'We build your bot',
        body: 'We train the AI on your wedding and match your aesthetic.',
      },
      {
        n: '03',
        title: 'You review and approve',
        body: 'Test a private preview, tweak anything, publish instantly.',
      },
      {
        n: '04',
        title: 'Share with guests',
        body: 'A website, a chat link, a WhatsApp number.',
      },
    ],
    cta: 'Start step one',
    ctaNote: 'Most couples finish it over a coffee.',
  },

  pricing: {
    no: '№ 03',
    kicker: 'Pricing',
    title: 'One price.\nEvery question answered.',
    intro: 'From $199, once. Yours until the wedding.',
    popularTag: '✦ Most popular',
    plans: [
      {
        id: 'essentials',
        name: 'Essentials',
        guests: 'Up to 60 guests',
        price: 199,
        priceNote: 'One payment',
        features: [
          'Concierge: WhatsApp + web, EN/ES',
          'Website + registry + RSVP',
          'Import: CSV, Excel, Zola',
          'Dashboard + transcripts',
        ],
        cta: 'Get started →',
      },
      {
        id: 'signature',
        name: 'Signature',
        guests: 'Up to 160 guests',
        price: 399,
        priceNote: 'One payment',
        features: [
          'Everything in Essentials',
          'Per-person, per-event RSVP',
          'Unlimited broadcasts',
          'QR check-in + Zola sync',
        ],
        cta: 'Get started →',
        popular: true,
      },
      {
        id: 'grande',
        name: 'Grande',
        guests: 'Up to 300 guests',
        price: 699,
        priceNote: 'One payment',
        features: [
          'Everything in Signature',
          'AI Coordinator included',
          'Done-for-you setup',
          'Planner seat',
        ],
        cta: 'Get started →',
      },
    ],
    coordinator: {
      badge: 'Add-on',
      name: 'AI Coordinator',
      body: 'runs your wedding by chat. $79 once or $19/mo. Included with Grande.',
    },
    guarantee:
      'Full refund before your first guest messages the concierge, or within 30 days.',
    zolaLine: 'Keep Zola. We sync with it.',
  },

  founding: {
    no: '№ 04',
    kicker: 'The origin',
    title: 'Built for our own\nwedding first.',
    body: [
      'Being built and tested for our own wedding: 400 guests in Tarija, Bolivia, this November.',
      'Every feature exists because a real guest needed it.',
    ],
    offer: {
      badge: 'Founding Couples',
      body: 'First 10 weddings: 30% off and the AI Coordinator included, for an honest testimonial.',
      ends: 'Ends Aug 31, 2026',
      cta: 'Claim a founding spot',
    },
    proof: [],
  },

  faq: {
    no: '№ 05',
    kicker: 'Questions',
    title: 'You probably have\na few questions.',
    human: {
      title: 'Prefer a human?',
      body: 'We answer every message ourselves, usually within hours.',
      email: 'nicolas@guest-ly.com',
    },
    items: [
      {
        q: 'Why not just use Zola for free?',
        a: 'Zola gives you a website and an RSVP form; it does not answer 600 guest questions at 2am in Spanish on WhatsApp. Keep Zola. We sync with it.',
      },
      {
        q: 'Is it really one payment?',
        a: 'Yes. Every plan is a single one-time price, yours until the wedding. Only the optional AI Coordinator has a monthly option: $79 one-time or $19/mo.',
      },
      {
        q: 'Does it work in Bolivia and Latin America?',
        a: 'That is our home turf. Guest-ly is WhatsApp-first and fully bilingual, with proper +591 (and any international) phone handling built in.',
      },
      {
        q: 'What if the AI is not sure?',
        a: 'It only answers from your wedding’s information. When it is not sure, it tells the guest it is checking with you and flags the question on your dashboard. You see every transcript.',
      },
      {
        q: 'What about refunds?',
        a: 'Full refund before your first guest messages the concierge, or within 30 days, whichever comes first. The refunds page has the details.',
      },
    ],
  },

  cta: {
    kicker: 'Ready to stop answering questions?',
    title: 'Your guests deserve a\nbeautiful experience.',
    body: '',
    primary: 'Get my concierge',
    secondary: 'See pricing',
  },

  footer: {
    blurb: 'The AI concierge and platform for weddings.',
    explore: {
      title: 'Explore',
      links: [
        { label: 'What you get', href: '#pillars' },
        { label: 'How it works', href: '#how' },
        { label: 'Pricing', href: '#pricing' },
        { label: 'FAQ', href: '#faq' },
      ],
    },
    contact: {
      title: 'Contact',
      email: 'nicolas@guest-ly.com',
      startOrder: 'Start your order',
      intakeForm: 'Intake form',
    },
    legal: {
      title: 'Legal',
      links: [
        { label: 'Privacy', href: '/privacy' },
        { label: 'Terms', href: '/terms' },
        { label: 'Refunds', href: '/refunds' },
      ],
    },
    entityNote: '',
    copyright: '© 2026 Guest-ly',
    crafted: 'Crafted with ✦ for unforgettable celebrations',
  },

  wizard: {
    stepLabels: ['Your wedding', 'Plan', 'Details', 'Confirm'],
    step1: {
      title: 'Tell us about your wedding',
      sub: 'Three things every couple knows by heart.',
      guestsLabel: 'How many guests?',
      guestRanges: [
        { id: 'essentials', label: 'Up to 60' },
        { id: 'signature', label: '61 to 160' },
        { id: 'grande', label: '161 to 300' },
        { id: 'grande-plus', label: 'More than 300' },
      ],
      dateLabel: 'Wedding date',
      locationLabel: 'City / Country',
      next: 'Continue →',
    },
    step2: {
      title: 'Our recommendation',
      sub: 'Pick a different tier any time. The price never changes later.',
      reason: '{guests} guests fits {plan}.',
      reasonPlus: 'For more than 300 guests, Grande is the fit. We will confirm capacity with you.',
      addon: {
        title: 'Add the AI Coordinator',
        pitch: 'Run your wedding by chat: $79 one-time or $19/mo.',
        includedNote: 'Included with Grande.',
      },
      back: '← Back',
      next: 'Continue →',
    },
    step3: {
      title: 'Almost there',
      sub: 'We follow up within 24 hours to get started.',
      fields: {
        name: 'Your name',
        partner: "Partner's name",
        email: 'Email address',
        phone: 'Phone (optional)',
        notes: 'Anything we should know? (optional)',
      },
      back: '← Back',
      confirm: 'Confirm order →',
    },
    step4: {
      badge: 'Order received',
      title: "You're all set.",
      summaryTitle: 'Summary',
      rows: {
        plan: 'Plan',
        guests: 'Guest count',
        couple: 'Couple',
        date: 'Date',
        addon: 'AI Coordinator',
        price: 'Price · one-time',
      },
      addonYes: 'Yes',
      addonNo: 'No',
      nextTitle: 'What happens next',
      next: [
        { title: 'Pay once to lock your build slot', body: 'Secure Stripe checkout. We confirm within 2 hours during business hours.' },
        { title: 'We send you the intake form', body: 'A 15-minute form with everything your bot needs.' },
        { title: 'We build your bot (~7 days)', body: 'AI training, channel setup, design: all handled.' },
        { title: 'You test, approve and share', body: 'Your guests get a 24/7 concierge experience.' },
      ],
      payCta: 'Pay {price} securely →',
      payNoteLinked: 'Secure checkout by Stripe. Your build slot is reserved the moment payment comes through.',
      payNoteFallback: 'We will send a secure Stripe payment link to {email} within 2 hours to reserve your build slot.',
      whatsapp: 'Prefer WhatsApp? Chat with us →',
      refundLine: 'Full refund before your first guest messages the concierge, or within 30 days, whichever comes first.',
      refundLink: 'Read the refund policy',
      mailFallback: 'No reply from us within 24 hours?',
      mailFallbackLink: 'Email us your order',
      backHome: '← Back to home',
    },
  },

  legal: {
    backHome: '← Back to guest-ly.com',
    contactLine: 'Questions? Write to nicolas@guest-ly.com. We answer every message ourselves.',
    pages: {
      privacy: {
        title: 'Privacy',
        updated: 'Last updated: August 2026',
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
        updated: 'Last updated: August 2026',
        sections: [
          {
            h: 'The service',
            body: [
              'Guest-ly builds and operates an AI wedding concierge for your guests (web chat and WhatsApp), a wedding website with per-person RSVPs, and a private couple portal. We handle setup, hosting and monitoring.',
              'Guest-ly is operated by its founding team; the registered legal entity name will be published here. Contact: nicolas@guest-ly.com.',
            ],
          },
          {
            h: 'One-time payment, yours until the wedding',
            body: [
              'Every plan is a single one-time payment. "Yours until the wedding" means the service runs from launch through your wedding date plus 30 days after it, so late thank-you questions still get answered. Only the optional AI Coordinator has a monthly billing option.',
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
        updated: 'Last updated: August 2026',
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
  },
};

const es: SiteCopy = {
  meta: { title: 'Guest-ly: Asistente IA y Plataforma para Bodas' },

  nav: {
    links: [
      { label: 'Míralo funcionar', href: '#hero' },
      { label: 'Qué recibes', href: '#pillars' },
      { label: 'Cómo funciona', href: '#how' },
      { label: 'Precios', href: '#pricing' },
      { label: 'Preguntas', href: '#faq' },
    ],
    login: { label: 'Acceso clientes', href: 'https://app.guest-ly.com' },
    cta: 'Empezar',
    theme: { label: 'Tema', day: 'Día', night: 'Noche' },
    skip: 'Saltar al contenido',
  },

  hero: {
    badge: 'Creado para nuestra propia boda de 400 invitados',
    kicker: 'Asistente IA · Bodas y Eventos',
    titleLines: ['Tus invitados,', 'respondidos.', 'Siempre.'],
    accentIndex: 1,
    sub: 'Deja de responder las mismas preguntas 200 veces. Un asistente 24/7, RSVP por persona, y un portal para manejarlo todo.',
    primary: 'Obtener mi asistente',
    secondary: 'Prueba el demo',
    stats: [
      { value: '24/7', label: 'Siempre activo' },
      { value: '0', label: 'Preguntas que respondes a las 2am' },
      { value: 'ES/EN', label: 'Totalmente bilingüe' },
      { value: '~7d', label: 'Para lanzar' },
    ],
    chat: {
      header: 'Emma & James · Guest-ly',
      sub: 'Con IA',
      liveTag: 'Demo en vivo. Un asistente Guest-ly real para una boda ficticia.',
      chips: ['Dress code', 'Hoteles', 'Shuttle', 'RSVP'],
      inputPlaceholder: 'Pregunta sobre la boda',
      inputPlaceholderLive: 'Pregunta sobre la boda demo de Emma y James',
      send: 'Enviar',
      messages: [
        { from: 'guest', text: '¿Cuál es el dress code?' },
        { from: 'ai', text: 'Black tie opcional. Vestimenta formal recomendada, sin jeans por favor.' },
        { from: 'guest', text: '¿Hay transporte desde el hotel?' },
        { from: 'ai', text: 'Sí, desde el Hotel Grand a las 3:15 PM. Sin costo para invitados.' },
      ],
      limitNote: 'El demo descansa después de algunas preguntas. Tu asistente real nunca lo hará.',
      rateNote: 'Un mensaje cada pocos segundos, por favor. Al demo le gusta saborear cada pregunta.',
      errorPrefix: 'El asistente está tomando una siesta. Esto es lo que diría:',
    },
    marquee,
    scrollHint: 'Desliza',
  },

  pillars: {
    no: '№ 01',
    kicker: 'Qué recibes',
    title: 'Tres promesas.',
    expand: 'Ver qué significa',
    items: [
      {
        id: 'guests',
        title: 'Tus invitados',
        line: 'Preguntan lo que sea, a cualquier hora, en su idioma.',
        details: [
          {
            h: 'Chat web y WhatsApp',
            b: 'Una página de chat elegante en un link, más un número de WhatsApp dedicado que tus invitados escriben como a cualquier contacto. Nada que instalar, sin crear cuentas: tocan un link o escanean un QR y preguntan.',
          },
          {
            h: 'Página de boda con RSVP por persona',
            b: 'Una página bilingüe con su historia, itinerario, dress code y lista de regalos. Cada invitado confirma cada persona para cada evento, desde la página o directo en el chat.',
          },
          {
            h: 'Respuestas de viaje incluidas',
            b: 'Visas, moneda, clima, transporte y consejos locales para invitados que vienen del exterior.',
          },
          {
            h: 'Pases QR de invitado',
            b: 'Cada invitado recibe un pase QR personal para un check-in fluido en la puerta.',
          },
          {
            h: 'Su idioma',
            b: 'Totalmente bilingüe en español e inglés, con respuestas de mejor esfuerzo en otros idiomas. SMS y Telegram llegan pronto.',
          },
        ],
      },
      {
        id: 'you',
        title: 'Tú',
        line: 'Una sola pantalla, todo visible, nada que instalar.',
        details: [
          {
            h: 'Wedding Brain',
            b: 'Todo lo que sabe tu asistente, editable por ti. Cambia un consejo de hotel, prueba la respuesta, publica al instante.',
          },
          {
            h: 'Panel en vivo',
            b: 'Cada pregunta de tus invitados, los temas que más importan, el ritmo de RSVPs y los vacíos que tu Brain aún no cubre.',
          },
          {
            h: 'Lista de invitados y tablero de RSVPs',
            b: 'Importa desde Excel, CSV o Zola en un click. Cada respuesta con detalle por evento, recordatorios automáticos a quienes no responden, y un resumen cada lunes en tu correo.',
          },
          {
            h: 'Difusiones',
            b: 'Escribe a todos, solo a quienes no respondieron, o a un grupo, por WhatsApp, en el idioma de cada invitado.',
          },
          {
            h: 'Estudio de página web',
            b: 'Edita tu página en vivo: secciones, temas, fotos, preguntas de RSVP personalizadas. Publica cuando esté perfecta.',
          },
          {
            h: 'Coordinador IA',
            b: 'El add-on opcional: cuéntale qué cambió, en español o inglés, y actualiza la lista, los RSVPs y los recordatorios. Cada cambio pide primero tu aprobación.',
          },
        ],
      },
      {
        id: 'under',
        title: 'Por debajo',
        line: 'Construido, alojado y monitoreado por nosotros.',
        details: [
          {
            h: 'Entrenado solo con tu boda',
            b: 'El asistente responde únicamente con la información de tu boda. Cuando no está seguro, le dice al invitado que lo está consultando contigo y marca la pregunta en tu panel.',
          },
          {
            h: 'Todas las conversaciones',
            b: 'Puedes leer cada conversación de tus invitados con el asistente, en cualquier momento.',
          },
          {
            h: 'Cero configuración para ti',
            b: 'Nosotros manejamos la aprobación de WhatsApp Business, el hosting, los servidores y el monitoreo. Tú nunca tocas código ni creas cuentas de empresa.',
          },
          {
            h: 'Historial de versiones',
            b: 'Cada cambio a tu Wedding Brain queda versionado, con rollback de un click.',
          },
          {
            h: 'En vivo en una semana',
            b: 'Del formulario al asistente activo en unos siete días. Signature y Grande incluyen soporte prioritario. Los límites cuentan personas invitadas, no mensajes.',
          },
        ],
      },
    ],
  },

  how: {
    no: '№ 02',
    kicker: 'Cómo funciona',
    title: 'De tu pedido a asistente activo\nen una semana.',
    intro: '',
    steps: [
      {
        n: '01',
        title: 'Rellenas el formulario',
        body: 'Lugar, horarios, hoteles, dress code, consejos de viaje. Unos 15 minutos.',
      },
      {
        n: '02',
        title: 'Construimos tu bot',
        body: 'Entrenamos la IA con tu boda y adaptamos el diseño.',
      },
      {
        n: '03',
        title: 'Revisas y apruebas',
        body: 'Prueba una vista previa privada, ajusta y publica al instante.',
      },
      {
        n: '04',
        title: 'Compártelo',
        body: 'Una página, un link de chat, un número de WhatsApp.',
      },
    ],
    cta: 'Empezar paso uno',
    ctaNote: 'La mayoría lo termina con un café.',
  },

  pricing: {
    no: '№ 03',
    kicker: 'Precios',
    title: 'Un solo pago.\nCada pregunta respondida.',
    intro: 'Desde $199, una sola vez. Tuyo hasta la boda.',
    popularTag: '✦ Más popular',
    plans: [
      {
        id: 'essentials',
        name: 'Essentials',
        guests: 'Hasta 60 invitados',
        price: 199,
        priceNote: 'Pago único',
        features: [
          'Asistente: WhatsApp + web, ES/EN',
          'Página + regalos + RSVP',
          'Importa: CSV, Excel, Zola',
          'Panel + conversaciones',
        ],
        cta: 'Empezar →',
      },
      {
        id: 'signature',
        name: 'Signature',
        guests: 'Hasta 160 invitados',
        price: 399,
        priceNote: 'Pago único',
        features: [
          'Todo lo de Essentials',
          'RSVP por persona y por evento',
          'Difusiones ilimitadas',
          'QR + sincronización con Zola',
        ],
        cta: 'Empezar →',
        popular: true,
      },
      {
        id: 'grande',
        name: 'Grande',
        guests: 'Hasta 300 invitados',
        price: 699,
        priceNote: 'Pago único',
        features: [
          'Todo lo de Signature',
          'Coordinador IA incluido',
          'Configuración hecha por nosotros',
          'Acceso para tu planner',
        ],
        cta: 'Empezar →',
      },
    ],
    coordinator: {
      badge: 'Add-on',
      name: 'Coordinador IA',
      body: 'maneja tu boda por chat. $79 una vez o $19/mes. Incluido en Grande.',
    },
    guarantee:
      'Reembolso total antes de que tu primer invitado le escriba al asistente, o dentro de 30 días.',
    zolaLine: 'Conserva Zola. Nos sincronizamos con él.',
  },

  founding: {
    no: '№ 04',
    kicker: 'El origen',
    title: 'Creado primero para\nnuestra propia boda.',
    body: [
      'Se está construyendo y probando para nuestra propia boda: 400 invitados en Tarija, Bolivia, este noviembre.',
      'Cada función existe porque un invitado real la necesitó.',
    ],
    offer: {
      badge: 'Parejas Fundadoras',
      body: 'Primeras 10 bodas: 30% de descuento y Coordinador IA incluido, por un testimonio honesto.',
      ends: 'Termina el 31 de agosto de 2026',
      cta: 'Reservar un lugar fundador',
    },
    proof: [],
  },

  faq: {
    no: '№ 05',
    kicker: 'Preguntas',
    title: 'Probablemente tienes\nalgunas preguntas.',
    human: {
      title: '¿Prefieres un humano?',
      body: 'Respondemos cada mensaje nosotros mismos, normalmente en pocas horas.',
      email: 'nicolas@guest-ly.com',
    },
    items: [
      {
        q: '¿Por qué no usar Zola gratis y ya?',
        a: 'Zola te da una página y un formulario de RSVP; no responde 600 preguntas de invitados a las 2am, en español, por WhatsApp. Conserva Zola. Nos sincronizamos con él.',
      },
      {
        q: '¿De verdad es un solo pago?',
        a: 'Sí. Cada plan es un único pago, tuyo hasta la boda. Solo el Coordinador IA, que es opcional, tiene opción mensual: $79 pago único o $19/mes.',
      },
      {
        q: '¿Funciona en Bolivia y Latinoamérica?',
        a: 'Es nuestra casa. Guest-ly es WhatsApp-first y totalmente bilingüe, con manejo correcto de números +591 (y de cualquier país) incluido.',
      },
      {
        q: '¿Y si la IA no está segura?',
        a: 'Solo responde con la información de tu boda. Cuando no está segura, le dice al invitado que lo está consultando contigo y marca la pregunta en tu panel. Tú ves cada conversación.',
      },
      {
        q: '¿Y los reembolsos?',
        a: 'Reembolso total antes de que tu primer invitado le escriba al asistente, o dentro de 30 días, lo que ocurra primero. La página de reembolsos tiene los detalles.',
      },
    ],
  },

  cta: {
    kicker: '¿Listo para dejar de responder preguntas?',
    title: 'Tus invitados merecen una\nexperiencia hermosa.',
    body: '',
    primary: 'Obtener mi asistente',
    secondary: 'Ver precios',
  },

  footer: {
    blurb: 'El asistente IA y la plataforma para bodas.',
    explore: {
      title: 'Explorar',
      links: [
        { label: 'Qué recibes', href: '#pillars' },
        { label: 'Cómo funciona', href: '#how' },
        { label: 'Precios', href: '#pricing' },
        { label: 'Preguntas', href: '#faq' },
      ],
    },
    contact: {
      title: 'Contacto',
      email: 'nicolas@guest-ly.com',
      startOrder: 'Empieza tu pedido',
      intakeForm: 'Formulario de boda',
    },
    legal: {
      title: 'Legal',
      links: [
        { label: 'Privacidad', href: '/privacy' },
        { label: 'Términos', href: '/terms' },
        { label: 'Reembolsos', href: '/refunds' },
      ],
    },
    entityNote: '',
    copyright: '© 2026 Guest-ly',
    crafted: 'Hecho con ✦ para celebraciones inolvidables',
  },

  wizard: {
    stepLabels: ['Tu boda', 'Plan', 'Detalles', 'Confirmar'],
    step1: {
      title: 'Cuéntanos sobre tu boda',
      sub: 'Tres cosas que toda pareja sabe de memoria.',
      guestsLabel: '¿Cuántos invitados?',
      guestRanges: [
        { id: 'essentials', label: 'Hasta 60' },
        { id: 'signature', label: '61 a 160' },
        { id: 'grande', label: '161 a 300' },
        { id: 'grande-plus', label: 'Más de 300' },
      ],
      dateLabel: 'Fecha de la boda',
      locationLabel: 'Ciudad / País',
      next: 'Continuar →',
    },
    step2: {
      title: 'Nuestra recomendación',
      sub: 'Puedes elegir otro plan cuando quieras. El precio nunca cambia después.',
      reason: '{guests} invitados encaja con {plan}.',
      reasonPlus: 'Para más de 300 invitados, Grande es el plan. Confirmamos la capacidad contigo.',
      addon: {
        title: 'Agregar el Coordinador IA',
        pitch: 'Maneja tu boda por chat: $79 pago único o $19/mes.',
        includedNote: 'Incluido en Grande.',
      },
      back: '← Atrás',
      next: 'Continuar →',
    },
    step3: {
      title: 'Ya casi',
      sub: 'Te contactamos en menos de 24 horas para empezar.',
      fields: {
        name: 'Tu nombre',
        partner: 'Nombre de tu pareja',
        email: 'Correo electrónico',
        phone: 'Teléfono (opcional)',
        notes: '¿Algo que debamos saber? (opcional)',
      },
      back: '← Atrás',
      confirm: 'Confirmar pedido →',
    },
    step4: {
      badge: 'Pedido recibido',
      title: 'Todo listo.',
      summaryTitle: 'Resumen',
      rows: {
        plan: 'Plan',
        guests: 'Número de invitados',
        couple: 'Pareja',
        date: 'Fecha',
        addon: 'Coordinador IA',
        price: 'Precio · pago único',
      },
      addonYes: 'Sí',
      addonNo: 'No',
      nextTitle: 'Qué pasa después',
      next: [
        { title: 'Paga una sola vez para reservar tu lugar', body: 'Checkout seguro con Stripe. Confirmamos en menos de 2 horas en horario laboral.' },
        { title: 'Te enviamos el formulario', body: 'Un formulario de 15 minutos con todo lo que tu bot necesita.' },
        { title: 'Construimos tu bot (~7 días)', body: 'Entrenamiento de IA, configuración de canales, diseño: nos encargamos de todo.' },
        { title: 'Pruebas, apruebas y compartes', body: 'Tus invitados reciben una experiencia de asistente 24/7.' },
      ],
      payCta: 'Pagar {price} de forma segura →',
      payNoteLinked: 'Checkout seguro con Stripe. Tu lugar queda reservado en cuanto se procesa el pago.',
      payNoteFallback: 'Te enviaremos un link de pago seguro de Stripe a {email} en menos de 2 horas para reservar tu lugar.',
      whatsapp: '¿Prefieres WhatsApp? Escríbenos →',
      refundLine: 'Reembolso total antes de que tu primer invitado le escriba al asistente, o dentro de 30 días, lo que ocurra primero.',
      refundLink: 'Lee la política de reembolsos',
      mailFallback: '¿No supiste de nosotros en 24 horas?',
      mailFallbackLink: 'Envíanos tu pedido por email',
      backHome: '← Volver al inicio',
    },
  },

  legal: {
    backHome: '← Volver a guest-ly.com',
    contactLine: '¿Preguntas? Escribe a nicolas@guest-ly.com. Respondemos cada mensaje nosotros mismos.',
    pages: {
      privacy: {
        title: 'Privacidad',
        updated: 'Última actualización: agosto 2026',
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
        updated: 'Última actualización: agosto 2026',
        sections: [
          {
            h: 'El servicio',
            body: [
              'Guest-ly construye y opera un asistente IA para tus invitados (chat web y WhatsApp), una página de boda con RSVP por persona, y un portal privado de pareja. Nosotros manejamos la configuración, el hosting y el monitoreo.',
              'Guest-ly es operado por su equipo fundador; el nombre de la entidad legal registrada se publicará aquí. Contacto: nicolas@guest-ly.com.',
            ],
          },
          {
            h: 'Pago único, tuyo hasta la boda',
            body: [
              'Cada plan es un único pago. "Tuyo hasta la boda" significa que el servicio funciona desde el lanzamiento hasta la fecha de tu boda más 30 días después, para que las preguntas tardías también tengan respuesta. Solo el Coordinador IA opcional tiene opción de pago mensual.',
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
        updated: 'Última actualización: agosto 2026',
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
  },
};

export const copy: Record<Locale, SiteCopy> = { en, es };

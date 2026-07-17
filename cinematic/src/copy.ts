/* Complete site copy for the Guest-ly cinematic experience — EN and ES.
   Originally transcribed from the production landing page; updated Jul 2026
   for the full platform (couple portal, wedding website, per-person RSVPs,
   AI Coordinator add-on). Brand is always written "Guest-ly". Multi-line
   headings use '\n'. */

export type Locale = 'en' | 'es';

export interface ChatMessage {
  from: 'guest' | 'ai';
  text: string;
}

export interface SiteCopy {
  meta: { title: string };
  nav: {
    links: { label: string; href: string }[];
    login: { label: string; href: string };
    cta: string;
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
      chips: string[];
      inputPlaceholder: string;
      messages: ChatMessage[];
    };
    marquee: string[];
    scrollHint: string;
  };
  channels: {
    no: string;
    kicker: string;
    title: string;
    intro: string;
    items: { name: string; desc: string; plans: string }[];
    unify: { title: string; body: string };
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
  included: {
    no: string;
    kicker: string;
    title: string;
    intro: string;
    items: { title: string; body: string }[];
  };
  platform: {
    no: string;
    kicker: string;
    title: string;
    intro: string;
    items: { title: string; body: string }[];
    coordinator: {
      badge: string;
      title: string;
      body: string;
      examples: string[];
      note: string;
    };
  };
  compare: {
    no: string;
    kicker: string;
    title: string;
    without: { label: string; title: string; points: string[] };
    withG: { label: string; title: string; points: string[] };
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
    founding: { badge: string; body: string; ends: string };
    guarantee: string;
    comparison: {
      title: string;
      sub: string;
      rows: string[];
      priceRow: string;
      columns: { name: string; sub: string; cells: boolean[]; price: string; highlight?: boolean }[];
      note: string;
    };
  };
  testimonials: {
    no: string;
    kicker: string;
    title: string;
    intro: string;
    items: { quote: string; emoji: string; names: string; place: string }[];
    badges: string[];
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
    copyright: string;
    crafted: string;
  };
  wizard: {
    stepLabels: string[];
    step1: { title: string; sub: string };
    step2: {
      title: string;
      sub: string;
      fields: {
        name: string;
        partner: string;
        email: string;
        phone: string;
        date: string;
        location: string;
        notes: string;
      };
      back: string;
      confirm: string;
    };
    step3: {
      badge: string;
      title: string;
      summaryTitle: string;
      rows: { plan: string; guests: string; couple: string; price: string };
      nextTitle: string;
      next: { title: string; body: string }[];
      payCta: string;
      payNoteLinked: string;
      payNoteFallback: string;
      whatsapp: string;
      mailFallback: string;
      mailFallbackLink: string;
      backHome: string;
    };
    continueLabel: string;
  };
}

/* The floating-questions marquee is intentionally multilingual on the site
   (EN / ES / FR / DE mixed) and identical in both language modes. */
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
  meta: { title: 'Guest-ly — AI Concierge & Wedding Platform' },

  nav: {
    links: [
      { label: 'Channels', href: '#channels' },
      { label: 'Your portal', href: '#platform' },
      { label: 'How it works', href: '#how' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'FAQ', href: '#faq' },
    ],
    login: { label: 'Client Login', href: 'https://app.guest-ly.com' },
    cta: 'Get started',
  },

  hero: {
    badge: 'Born at a real 400-guest wedding',
    kicker: 'AI Concierge · Weddings & Events',
    titleLines: ['Your guests,', 'answered.', 'Always.'],
    accentIndex: 1,
    sub: 'Stop answering the same questions 200 times. Guest-ly pairs a 24/7 AI concierge for your guests with a wedding website, per-person RSVPs, and a private portal where you run it all — even by chatting with your own AI Coordinator.',
    primary: 'Get my concierge',
    secondary: 'See how it works',
    stats: [
      { value: '24/7', label: 'Always on' },
      { value: '30+', label: 'Languages' },
      { value: '2', label: 'AI assistants' },
      { value: '~7d', label: 'To launch' },
    ],
    chat: {
      header: 'Emma & James · Guest-ly',
      sub: 'Powered by AI · Always online',
      chips: ['Dress code', 'Hotels nearby', 'Shuttle times', 'RSVP'],
      inputPlaceholder: 'Ask anything about the wedding…',
      messages: [
        { from: 'guest', text: "What's the dress code?" },
        { from: 'ai', text: 'Black tie optional — formal attire is encouraged. No jeans please! ✨' },
        { from: 'guest', text: 'Is there a shuttle from the hotel?' },
        { from: 'ai', text: 'Yes! A shuttle leaves Hotel Grand at 3:15 PM. Free for all guests. 🚐' },
      ],
    },
    marquee,
    scrollHint: 'Scroll',
  },

  channels: {
    no: '№ 01',
    kicker: 'Channels',
    title: 'Guests choose\ntheir channel.',
    intro:
      'One concierge, four ways in. Your guests use whatever app they already have — no downloads, no new accounts, no friction.',
    items: [
      {
        name: 'Web Bot',
        desc: 'An elegant chat page on a custom URL. Works in any browser, on any device. No app needed — just a link your guests tap.',
        plans: 'All plans',
      },
      {
        name: 'WhatsApp',
        desc: 'A dedicated WhatsApp number for your wedding. Guests text it like any contact. The dominant channel in Latin America, Europe & Asia.',
        plans: 'All plans',
      },
      {
        name: 'SMS',
        desc: 'A dedicated number guests can text. No internet, no app, no account. The universal fallback — works on every phone on earth.',
        plans: 'Signature & Grande',
      },
      {
        name: 'Telegram',
        desc: 'A dedicated Telegram bot for your wedding. Popular with guests from Europe, Brazil, and tech-savvy crowds. Zero extra cost.',
        plans: 'Signature & Grande',
      },
    ],
    unify: {
      title: 'One brain. Every channel. Same answer.',
      body: "Whether your guest texts on WhatsApp, SMS, Telegram, or opens the web bot — they're all talking to the same AI, trained on the same wedding data, getting the same accurate answers.",
    },
  },

  how: {
    no: '№ 02',
    kicker: 'How it works',
    title: 'From order to live concierge\nin about a week.',
    intro: 'You fill out a form. We build everything. You never touch a line of code.',
    steps: [
      {
        n: '01',
        title: 'Fill the intake form',
        body: 'Venue, schedule, hotels, dress code, travel tips — everything your guests will ask about. About 15 minutes.',
      },
      {
        n: '02',
        title: 'We build your bot',
        body: 'We train the AI on your wedding, set up every channel, and match the design to your aesthetic.',
      },
      {
        n: '03',
        title: 'You review & approve',
        body: 'We send a private preview and your portal login. Test it as a guest would, tweak the Wedding Brain yourself, publish instantly.',
      },
      {
        n: '04',
        title: 'Share with guests',
        body: 'Share your wedding website, a chat link, or a WhatsApp number — guests RSVP and ask away on whatever they already use.',
      },
    ],
    cta: 'Start step one',
    ctaNote: '— most couples finish the form over a coffee.',
  },

  included: {
    no: '№ 03',
    kicker: "What's included",
    title: 'Everything your guests\nneed to know.',
    intro: 'Guest-ly handles every question automatically — elegantly, accurately, and in their language.',
    items: [
      {
        title: '30+ Languages',
        body: "Auto-detected from each guest's message. Spanish, English, Portuguese, French, German, Mandarin and more — all included.",
      },
      {
        title: 'International Guest Guide',
        body: 'Visa info, currency, weather, transport, local tips — built in for guests flying from abroad.',
      },
      {
        title: 'Wedding Website & Registry',
        body: 'A beautiful bilingual wedding site with your story, itinerary, dress code and registry — with an elegant RSVP flow built in.',
      },
      {
        title: 'Per-Person, Per-Event RSVPs',
        body: 'Guests confirm each person for each event — welcome cocktail, ceremony, brunch — through the bot or the website. You see exactly who comes to what.',
      },
      {
        title: 'QR Guest Passes',
        body: 'Every guest gets a personal QR pass for a smooth, elegant check-in at the door.',
      },
      {
        title: 'Zero Setup for You',
        body: 'We handle Twilio, Meta, Telegram, servers — everything. You never touch code or create a business account.',
      },
    ],
  },

  platform: {
    no: '№ 04',
    kicker: 'Your portal',
    title: 'You are in control.\nAll of it, in one place.',
    intro:
      'Every Guest-ly wedding includes a private couple portal at app.guest-ly.com — live, self-serve, and made for the couch. No calls, no tickets, no waiting.',
    items: [
      {
        title: 'Wedding Brain',
        body: 'Everything your concierge knows, editable by you. Change a hotel tip, preview the answer, publish instantly — with version history and one-click rollback.',
      },
      {
        title: 'Live Dashboard',
        body: 'Every question your guests ask, the topics they care about, RSVP momentum, and the gaps your Brain has not covered yet — all at a glance.',
      },
      {
        title: 'Guest List',
        body: 'Import from Excel in one click. Tags, languages, party members, plus-ones — one clean list that feeds everything else.',
      },
      {
        title: 'RSVP Board',
        body: 'Every response with per-event detail, automatic reminders to non-responders on the days you choose, and a Monday digest in your inbox.',
      },
      {
        title: 'Broadcasts',
        body: "Message all guests, only non-responders, or one group — on WhatsApp, in each guest's own language, from one screen.",
      },
      {
        title: 'Website Studio',
        body: 'Edit your wedding site and registry live: sections, themes, photos, custom RSVP questions. Publish when it is perfect.',
      },
    ],
    coordinator: {
      badge: 'New · AI Coordinator add-on',
      title: 'Meet your Personal Coordinator.',
      body: 'The newest member of your wedding team: a private AI coordinator inside your portal. Tell it what changed, in plain English or Spanish, and it handles the guest list, the RSVPs, the knowledge base, and the reminders — with the full picture of your wedding always in mind.',
      examples: [
        '"I forgot to add Lucía — friend of the bride, plus one."',
        '"Marco just told me he can\'t make it."',
        '"Add the new hotel to the travel tips."',
        '"Remind everyone who hasn\'t responded yet."',
      ],
      note: 'Every change shows you a confirmation card first — nothing moves without your approval. Included with Grande — or $79 one-time / $19/mo on Essentials & Signature.',
    },
  },

  compare: {
    no: '№ 05',
    kicker: 'The difference',
    title: 'The week before your wedding,\ntwo ways.',
    without: {
      label: 'Without Guest-ly',
      title: 'Your phone never stops.',
      points: [
        '200 guests asking the same 8 questions, one by one',
        'A 2am "what\'s the dress code?" text from another time zone',
        'Group chats that bury the answers you already gave',
        'Translating hotel directions for guests flying in',
        'Your final week spent as a call center, not a couple',
      ],
    },
    withG: {
      label: 'With Guest-ly',
      title: 'Silence. The good kind.',
      points: [
        'Every question answered in seconds, on every channel, 24/7',
        'The 2am guest gets a perfect answer — you stay asleep',
        'One source of truth, trained on your wedding alone',
        'Guests answered in their own language, automatically',
        'A live portal: every question, RSVP and gap visible at a glance',
        '"Marco can\'t make it" — you tell your AI Coordinator, and it is handled',
        'Your final week spent being celebrated, not consulted',
      ],
    },
  },

  pricing: {
    no: '№ 06',
    kicker: 'Pricing',
    title: 'One price.\nEvery guest question answered.',
    intro: 'From $199, once — no subscriptions.',
    popularTag: '✦ Most popular',
    plans: [
      {
        id: 'essentials',
        name: 'Essentials',
        guests: 'Up to 60 guests',
        price: 199,
        priceNote: 'One payment · yours until the wedding',
        features: [
          'AI concierge — WhatsApp + web, EN/ES',
          'RSVP wizard',
          'Wedding website + registry',
          'Guest import — CSV, Excel, Zola',
          '4 broadcasts',
          'Dashboard + full transcripts',
        ],
        cta: 'Get started →',
      },
      {
        id: 'signature',
        name: 'Signature',
        guests: 'Up to 160 guests',
        price: 399,
        priceNote: 'One payment · yours until the wedding',
        features: [
          'Everything in Essentials',
          'Unlimited broadcasts',
          'Per-person, per-event RSVP',
          'QR day-of check-in',
          'Zola RSVP sync',
          'Priority support',
        ],
        cta: 'Get started →',
        popular: true,
      },
      {
        id: 'grande',
        name: 'Grande',
        guests: 'Up to 300 guests',
        price: 699,
        priceNote: 'One payment · yours until the wedding',
        features: [
          'Everything in Signature',
          'AI Coordinator included',
          'Done-for-you import & setup call',
          'Planner seat',
        ],
        cta: 'Get started →',
      },
    ],
    coordinator: {
      badge: 'Add-on',
      name: 'AI Coordinator',
      body: '— run your wedding by chat. $79 one-time, yours until the wedding — or $19/mo. For Essentials & Signature; already included with Grande.',
    },
    founding: {
      badge: 'Founding Couples',
      body: 'The first 10 weddings get 30% off + the AI Coordinator free — in exchange for a testimonial.',
      ends: 'Ends Aug 31, 2026',
    },
    guarantee:
      'Full refund before your first guest messages the concierge, or within 30 days — whichever comes first.',
    comparison: {
      title: 'How Guest-ly compares',
      sub: 'For a wedding of about 150 guests',
      rows: [
        'WhatsApp concierge',
        'EN/ES bilingual',
        'Per-person RSVP',
        'Wedding website',
        'Broadcasts',
        'QR check-in',
      ],
      priceRow: 'Price',
      columns: [
        {
          name: 'Guest-ly',
          sub: 'Signature plan',
          cells: [true, true, true, true, true, true],
          price: '$399 once',
          highlight: true,
        },
        {
          name: 'Vino',
          sub: 'No web chat',
          cells: [true, true, false, false, true, false],
          price: '$2,499',
        },
        {
          name: 'Daisy Chat',
          sub: 'SMS only · no RSVP',
          cells: [false, false, false, false, true, false],
          price: '$125–175',
        },
        {
          name: 'GuestBook',
          sub: 'Web chat only',
          cells: [false, false, false, false, false, false],
          price: '$10–99/mo',
        },
        {
          name: 'Zola / The Knot',
          sub: 'No AI · no WhatsApp',
          cells: [false, false, true, true, true, false],
          price: 'Free',
        },
      ],
      note: 'Keep Zola — we sync with it.',
    },
  },

  testimonials: {
    no: '№ 07',
    kicker: 'Real weddings',
    title: 'Couples who stopped\nanswering messages.',
    intro: 'Guest-ly was born from a real wedding with 400 guests, many international. These are their words.',
    items: [
      {
        quote:
          "Our guests from the US couldn't believe how fast they got answers. Someone texted at 2am asking about dress code and got an instant reply. I was asleep.",
        emoji: '👰',
        names: 'Alexandra & Nicolás',
        place: 'Tarija, Bolivia · November 2026',
      },
      {
        quote:
          'We had guests from 6 countries. The bot answered in Spanish, English, and Portuguese without us doing anything. Like having a personal concierge for each guest.',
        emoji: '💑',
        names: 'Valentina & Diego',
        place: 'Buenos Aires, Argentina',
      },
      {
        quote:
          "The week before our wedding I didn't answer a single WhatsApp about logistics. The bot handled everything. Worth every penny.",
        emoji: '💍',
        names: 'Camila & Rodrigo',
        place: 'Miami, FL',
      },
    ],
    badges: [
      'Born at a real 400-guest wedding',
      'Guests from 6 countries',
      'Answers in 3 languages, automatically',
    ],
  },

  faq: {
    no: '№ 08',
    kicker: 'Questions',
    title: 'You probably have\na few questions.',
    human: {
      title: 'Prefer a human?',
      body: 'Write to us directly — we answer every message ourselves, usually within a few hours.',
      email: 'nicolas@guest-ly.com',
    },
    items: [
      {
        q: 'Why not just use Zola for free?',
        a: "Zola gives you a website and an RSVP form; it doesn't answer 600 guest questions at 2am in Spanish on WhatsApp. Keep Zola — we sync with it.",
      },
      {
        q: 'Is it really one payment?',
        a: 'Yes. Every plan is a single one-time price, yours until the wedding. Only the optional AI Coordinator has a monthly option — $79 one-time or $19/mo.',
      },
      {
        q: 'Does it work for guests in Bolivia and Latin America?',
        a: "That's our home turf. Guest-ly is WhatsApp-first and fully bilingual, with proper +591 — and any international — phone handling built in.",
      },
      {
        q: "What if the AI doesn't know an answer?",
        a: "It only answers from your wedding's information. When it isn't sure, it tells the guest it's checking with you and flags the question on your dashboard — and you see every transcript.",
      },
      {
        q: 'How do guests use it?',
        a: 'They tap a link or scan a QR code and start chatting — on WhatsApp or the web. Nothing to install, no accounts to create.',
      },
      {
        q: 'What counts toward the guest limit?',
        a: 'Invited people, not messages. Messages are effectively unlimited under fair use.',
      },
      {
        q: 'What about refunds?',
        a: 'Full refund before your first guest messages the concierge, or within 30 days — whichever comes first.',
      },
    ],
  },

  cta: {
    kicker: 'Ready to stop answering questions?',
    title: 'Your guests deserve a\nbeautiful experience.',
    body: 'Join couples who gave their guests a 5-star concierge — and gave themselves the peace of mind they deserved.',
    primary: 'Get my concierge',
    secondary: 'See pricing',
  },

  footer: {
    blurb:
      'The AI-powered wedding platform — a concierge for your guests, a website with per-person RSVPs, and a portal with its own AI Coordinator for you.',
    explore: {
      title: 'Explore',
      links: [
        { label: 'Channels', href: '#channels' },
        { label: 'Your portal', href: '#platform' },
        { label: 'How it works', href: '#how' },
        { label: 'Pricing', href: '#pricing' },
        { label: 'FAQ', href: '#faq' },
      ],
    },
    contact: {
      title: 'Get in touch',
      email: 'nicolas@guest-ly.com',
      startOrder: 'Start your order',
      intakeForm: 'Intake form',
    },
    copyright: '© 2026 Guest-ly · AI Concierge & Wedding Platform',
    crafted: 'Crafted with ✦ for unforgettable celebrations',
  },

  wizard: {
    stepLabels: ['Plan', 'Details', 'Confirm'],
    step1: {
      title: 'Choose your plan',
      sub: 'One payment, yours until the wedding — no subscriptions. Sized by guest count.',
    },
    step2: {
      title: 'Tell us about your wedding',
      sub: "We'll follow up within 24 hours to get started.",
      fields: {
        name: 'Your name',
        partner: "Partner's name",
        email: 'Email address',
        phone: 'Phone (optional)',
        date: 'Wedding date',
        location: 'City / Country',
        notes: 'Anything we should know? (optional)',
      },
      back: '← Back',
      confirm: 'Confirm order →',
    },
    step3: {
      badge: 'Order received',
      title: "You're all set.",
      summaryTitle: 'Summary',
      rows: {
        plan: 'Plan',
        guests: 'Guest count',
        couple: 'Couple',
        price: 'Price · one-time',
      },
      nextTitle: 'What happens next',
      next: [
        { title: 'Pay once to lock your build slot', body: 'Secure Stripe checkout — we confirm within 2 hours during business hours.' },
        { title: 'We send you the intake form', body: 'A 15-minute form with everything your bot needs.' },
        { title: 'We build your bot (~7 days)', body: 'AI training, channel setup, design — all handled.' },
        { title: 'You test, approve & share', body: 'Your guests get a 24/7 luxury concierge experience.' },
      ],
      payCta: 'Pay {price} · one-time →',
      payNoteLinked: 'Secure checkout by Stripe. Your build slot is reserved the moment payment comes through.',
      payNoteFallback: "We'll send a secure Stripe payment link to {email} within 2 hours to reserve your build slot.",
      whatsapp: 'Prefer WhatsApp? Chat with us →',
      mailFallback: "Didn't hear from us within 24 hours?",
      mailFallbackLink: 'Email us your order',
      backHome: '← Back to home',
    },
    continueLabel: 'Continue · {plan} · {price} →',
  },
};

const es: SiteCopy = {
  meta: { title: 'Guest-ly — Asistente IA y Plataforma para Bodas' },

  nav: {
    links: [
      { label: 'Canales', href: '#channels' },
      { label: 'Tu portal', href: '#platform' },
      { label: 'Cómo funciona', href: '#how' },
      { label: 'Precios', href: '#pricing' },
      { label: 'Preguntas', href: '#faq' },
    ],
    login: { label: 'Acceso clientes', href: 'https://app.guest-ly.com' },
    cta: 'Empezar',
  },

  hero: {
    badge: 'Nacido en una boda real de 400 invitados',
    kicker: 'Asistente IA · Bodas y Eventos',
    titleLines: ['Tus invitados,', 'respondidos.', 'Siempre.'],
    accentIndex: 1,
    sub: 'Deja de responder las mismas preguntas 200 veces. Guest-ly combina un asistente IA 24/7 para tus invitados con una página de boda, RSVPs por persona y un portal privado donde manejas todo — incluso conversando con tu propio Coordinador IA.',
    primary: 'Obtener mi asistente',
    secondary: 'Cómo funciona',
    stats: [
      { value: '24/7', label: 'Siempre activo' },
      { value: '30+', label: 'Idiomas' },
      { value: '2', label: 'Asistentes IA' },
      { value: '~7d', label: 'Para lanzar' },
    ],
    chat: {
      header: 'Emma & James · Guest-ly',
      sub: 'Powered by AI · Always online',
      chips: ['Dress code', 'Hotels nearby', 'Shuttle times', 'RSVP'],
      inputPlaceholder: 'Pregunta lo que sea sobre la boda…',
      messages: [
        { from: 'guest', text: '¿Cuál es el dress code?' },
        { from: 'ai', text: 'Black tie opcional — se recomienda vestimenta formal. ¡Sin jeans, por favor! ✨' },
        { from: 'guest', text: '¿Hay transporte desde el hotel?' },
        { from: 'ai', text: '¡Sí! Hay shuttle desde el Hotel Grand a las 3:15 PM. Sin costo para los invitados. 🚐' },
      ],
    },
    marquee,
    scrollHint: 'Desliza',
  },

  channels: {
    no: '№ 01',
    kicker: 'Canales',
    title: 'Tus invitados eligen\nsu canal.',
    intro:
      'Un asistente, cuatro formas de acceder. Tus invitados usan la app que ya tienen — sin descargas, sin cuentas nuevas, sin fricción.',
    items: [
      {
        name: 'Bot Web',
        desc: 'Una página de chat elegante en una URL personalizada. Funciona en cualquier navegador y dispositivo. Solo un link.',
        plans: 'Todos los planes',
      },
      {
        name: 'WhatsApp',
        desc: 'Un número de WhatsApp dedicado a tu boda. Los invitados lo escriben como cualquier contacto. Dominante en LatAm, Europa y Asia.',
        plans: 'Todos los planes',
      },
      {
        name: 'SMS',
        desc: 'Un número dedicado para mensajes de texto. Sin internet, sin apps. El canal universal — funciona en cualquier teléfono del mundo.',
        plans: 'Signature y Grande',
      },
      {
        name: 'Telegram',
        desc: 'Un bot de Telegram dedicado. Popular entre invitados de Europa, Brasil y el mundo tech. Sin costo extra.',
        plans: 'Signature y Grande',
      },
    ],
    unify: {
      title: 'Un solo cerebro. Todos los canales. La misma respuesta.',
      body: 'Ya sea que tu invitado escriba por WhatsApp, SMS, Telegram o abra el bot web — todos hablan con la misma IA, entrenada con los mismos datos de tu boda, con las mismas respuestas precisas.',
    },
  },

  how: {
    no: '№ 02',
    kicker: 'Cómo funciona',
    title: 'De tu pedido a asistente activo\nen aproximadamente una semana.',
    intro: 'Tú llenas un formulario. Nosotros construimos todo. Nunca tocas una línea de código.',
    steps: [
      {
        n: '01',
        title: 'Rellenas el formulario',
        body: 'Lugar, horarios, hoteles, código de vestimenta, consejos de viaje — todo lo que tus invitados van a preguntar. Unos 15 minutos.',
      },
      {
        n: '02',
        title: 'Construimos tu bot',
        body: 'Entrenamos la IA con tu boda, configuramos todos los canales y personalizamos el diseño a tu estética.',
      },
      {
        n: '03',
        title: 'Revisas y apruebas',
        body: 'Te enviamos una vista previa privada y tu acceso al portal. Pruébalo como invitado, ajusta el Wedding Brain tú mismo, publica al instante.',
      },
      {
        n: '04',
        title: 'Compártelo',
        body: 'Comparte tu página de boda, un link de chat o un número de WhatsApp — tus invitados confirman y preguntan por donde ya usan.',
      },
    ],
    cta: 'Empezar paso uno',
    ctaNote: '— la mayoría de las parejas termina el formulario con un café.',
  },

  included: {
    no: '№ 03',
    kicker: 'Qué incluye',
    title: 'Todo lo que tus invitados\nnecesitan saber.',
    intro: 'Guest-ly responde cada pregunta automáticamente — con elegancia, precisión, y en su idioma.',
    items: [
      {
        title: 'Más de 30 Idiomas',
        body: 'Detección automática del idioma de cada invitado. Español, inglés, portugués, francés, alemán, mandarín y más — incluidos.',
      },
      {
        title: 'Guía para el Exterior',
        body: 'Visas, moneda, clima, transporte, consejos locales — incluido para invitados que vienen del exterior.',
      },
      {
        title: 'Página de Boda y Lista de Regalos',
        body: 'Una hermosa página bilingüe con su historia, itinerario, dress code y lista de regalos — con un RSVP elegante integrado.',
      },
      {
        title: 'RSVP por Persona y por Evento',
        body: 'Los invitados confirman cada persona para cada evento — cóctel, ceremonia, brunch — por el bot o la página. Sabes exactamente quién va a qué.',
      },
      {
        title: 'Pases QR de Invitado',
        body: 'Cada invitado recibe un pase QR personal para un check-in fluido y elegante en la puerta.',
      },
      {
        title: 'Cero Configuración',
        body: 'Nosotros manejamos Twilio, Meta, Telegram, servidores — todo. Tú nunca tocas código ni creas cuentas de empresa.',
      },
    ],
  },

  platform: {
    no: '№ 04',
    kicker: 'Tu portal',
    title: 'Tú tienes el control.\nTodo, en un solo lugar.',
    intro:
      'Cada boda Guest-ly incluye un portal privado de pareja en app.guest-ly.com — en vivo, autogestionado y hecho para el sofá. Sin llamadas, sin tickets, sin esperas.',
    items: [
      {
        title: 'Wedding Brain',
        body: 'Todo lo que sabe tu asistente, editable por ti. Cambia un consejo de hotel, prueba la respuesta, publica al instante — con historial de versiones y rollback.',
      },
      {
        title: 'Panel en Vivo',
        body: 'Cada pregunta de tus invitados, los temas que más importan, el ritmo de RSVPs y los vacíos que tu Brain aún no cubre — de un vistazo.',
      },
      {
        title: 'Lista de Invitados',
        body: 'Importa desde Excel en un click. Etiquetas, idiomas, acompañantes, plus-ones — una sola lista que alimenta todo lo demás.',
      },
      {
        title: 'Tablero de RSVPs',
        body: 'Cada respuesta con detalle por evento, recordatorios automáticos a quienes no responden en los días que elijas, y un resumen cada lunes en tu correo.',
      },
      {
        title: 'Difusiones',
        body: 'Escribe a todos, solo a quienes no respondieron, o a un grupo — por WhatsApp, en el idioma de cada invitado, desde una sola pantalla.',
      },
      {
        title: 'Estudio de Página Web',
        body: 'Edita tu página y tu lista de regalos en vivo: secciones, temas, fotos, preguntas de RSVP personalizadas. Publica cuando esté perfecta.',
      },
    ],
    coordinator: {
      badge: 'Nuevo · Add-on Coordinador IA',
      title: 'Conoce a tu Coordinador Personal.',
      body: 'El nuevo integrante de tu equipo de boda: un coordinador IA privado dentro de tu portal. Cuéntale qué cambió, en español o inglés, y él se encarga de la lista, los RSVPs, la base de conocimiento y los recordatorios — siempre con el panorama completo de tu boda.',
      examples: [
        '"Me olvidé de agregar a Lucía — amiga de la novia, con acompañante."',
        '"Marco me avisó que no puede venir."',
        '"Agrega el hotel nuevo a los consejos de viaje."',
        '"Recuérdales a los que aún no responden."',
      ],
      note: 'Cada cambio te muestra primero una tarjeta de confirmación — nada se mueve sin tu aprobación. Incluido en Grande — o $79 pago único / $19/mes en Essentials y Signature.',
    },
  },

  compare: {
    no: '№ 05',
    kicker: 'La diferencia',
    title: 'La semana antes de tu boda,\ndos versiones.',
    without: {
      label: 'Sin Guest-ly',
      title: 'Tu teléfono no para.',
      points: [
        '200 invitados haciendo las mismas 8 preguntas, uno por uno',
        'Un "¿cuál es el dress code?" a las 2am desde otro huso horario',
        'Grupos de chat que entierran las respuestas que ya diste',
        'Traducir indicaciones del hotel para invitados del exterior',
        'Tu última semana convertida en un call center, no en pareja',
      ],
    },
    withG: {
      label: 'Con Guest-ly',
      title: 'Silencio. Del bueno.',
      points: [
        'Cada pregunta respondida en segundos, en cada canal, 24/7',
        'El invitado de las 2am recibe una respuesta perfecta — tú sigues durmiendo',
        'Una sola fuente de verdad, entrenada solo con tu boda',
        'Invitados atendidos en su propio idioma, automáticamente',
        'Un portal en vivo: cada pregunta, RSVP y pendiente visible de un vistazo',
        '"Marco no puede venir" — se lo dices a tu Coordinador IA y queda resuelto',
        'Tu última semana celebrando, no respondiendo',
      ],
    },
  },

  pricing: {
    no: '№ 06',
    kicker: 'Precios',
    title: 'Un solo pago.\nTodas las preguntas de tus invitados, respondidas.',
    intro: 'Desde $199, una sola vez — sin suscripciones.',
    popularTag: '✦ Más popular',
    plans: [
      {
        id: 'essentials',
        name: 'Essentials',
        guests: 'Hasta 60 invitados',
        price: 199,
        priceNote: 'Pago único · tuyo hasta la boda',
        features: [
          'Asistente IA — WhatsApp + web, ES/EN',
          'RSVP guiado paso a paso',
          'Página de boda + lista de regalos',
          'Importa invitados — CSV, Excel, Zola',
          '4 difusiones',
          'Panel + todas las conversaciones',
        ],
        cta: 'Empezar →',
      },
      {
        id: 'signature',
        name: 'Signature',
        guests: 'Hasta 160 invitados',
        price: 399,
        priceNote: 'Pago único · tuyo hasta la boda',
        features: [
          'Todo lo de Essentials',
          'Difusiones ilimitadas',
          'RSVP por persona y por evento',
          'Check-in con QR el gran día',
          'Sincronización de RSVPs con Zola',
          'Soporte prioritario',
        ],
        cta: 'Empezar →',
        popular: true,
      },
      {
        id: 'grande',
        name: 'Grande',
        guests: 'Hasta 300 invitados',
        price: 699,
        priceNote: 'Pago único · tuyo hasta la boda',
        features: [
          'Todo lo de Signature',
          'Coordinador IA incluido',
          'Importación y configuración hechas por nosotros',
          'Acceso para tu wedding planner',
        ],
        cta: 'Empezar →',
      },
    ],
    coordinator: {
      badge: 'Add-on',
      name: 'Coordinador IA',
      body: '— maneja tu boda por chat. $79 pago único, tuyo hasta la boda — o $19/mes. Para Essentials y Signature; ya incluido en Grande.',
    },
    founding: {
      badge: 'Parejas Fundadoras',
      body: 'Las primeras 10 bodas reciben 30% de descuento + el Coordinador IA gratis — a cambio de un testimonio.',
      ends: 'Termina el 31 de agosto de 2026',
    },
    guarantee:
      'Reembolso total antes de que tu primer invitado le escriba al asistente, o dentro de 30 días — lo que ocurra primero.',
    comparison: {
      title: 'Cómo se compara Guest-ly',
      sub: 'Para una boda de unos 150 invitados',
      rows: [
        'Asistente en WhatsApp',
        'Bilingüe ES/EN',
        'RSVP por persona',
        'Página de boda',
        'Difusiones',
        'Check-in con QR',
      ],
      priceRow: 'Precio',
      columns: [
        {
          name: 'Guest-ly',
          sub: 'Plan Signature',
          cells: [true, true, true, true, true, true],
          price: '$399 una vez',
          highlight: true,
        },
        {
          name: 'Vino',
          sub: 'Sin chat web',
          cells: [true, true, false, false, true, false],
          price: '$2,499',
        },
        {
          name: 'Daisy Chat',
          sub: 'Solo SMS · sin RSVP',
          cells: [false, false, false, false, true, false],
          price: '$125–175',
        },
        {
          name: 'GuestBook',
          sub: 'Solo chat web',
          cells: [false, false, false, false, false, false],
          price: '$10–99/mes',
        },
        {
          name: 'Zola / The Knot',
          sub: 'Sin IA · sin WhatsApp',
          cells: [false, false, true, true, true, false],
          price: 'Gratis',
        },
      ],
      note: 'Quédate con Zola — nosotros nos sincronizamos con ella.',
    },
  },

  testimonials: {
    no: '№ 07',
    kicker: 'Bodas reales',
    title: 'Parejas que dejaron de\nresponder mensajes.',
    intro: 'Guest-ly nació de una boda real con 400 invitados, muchos del exterior. Estas son sus palabras.',
    items: [
      {
        quote:
          'Nuestros invitados del exterior no podían creer la rapidez con la que obtenían respuestas. Alguien escribió a las 2am preguntando por el dress code y recibió respuesta al instante. Yo estaba durmiendo.',
        emoji: '👰',
        names: 'Alexandra & Nicolás',
        place: 'Tarija, Bolivia · Noviembre 2026',
      },
      {
        quote:
          'Teníamos invitados de 6 países. El bot respondió en español, inglés y portugués sin que hiciéramos nada. Como tener un conserje personal para cada invitado.',
        emoji: '💑',
        names: 'Valentina & Diego',
        place: 'Buenos Aires, Argentina',
      },
      {
        quote:
          'La semana antes de mi boda no respondí un solo WhatsApp de logística. El bot manejó todo. Valió cada centavo.',
        emoji: '💍',
        names: 'Camila & Rodrigo',
        place: 'Miami, FL',
      },
    ],
    badges: [
      'Nacido en una boda real de 400 invitados',
      'Invitados de 6 países',
      'Respuestas en 3 idiomas, automáticas',
    ],
  },

  faq: {
    no: '№ 08',
    kicker: 'Preguntas',
    title: 'Probablemente tienes\nalgunas preguntas.',
    human: {
      title: '¿Prefieres un humano?',
      body: 'Escríbenos directamente — respondemos cada mensaje nosotros mismos, normalmente en pocas horas.',
      email: 'nicolas@guest-ly.com',
    },
    items: [
      {
        q: '¿Por qué no usar Zola gratis y ya?',
        a: 'Zola te da una página y un formulario de RSVP; no responde 600 preguntas de invitados a las 2am, en español, por WhatsApp. Quédate con Zola — nosotros nos sincronizamos con ella.',
      },
      {
        q: '¿De verdad es un solo pago?',
        a: 'Sí. Cada plan es un único pago, tuyo hasta la boda. Solo el Coordinador IA, que es opcional, tiene opción mensual — $79 pago único o $19/mes.',
      },
      {
        q: '¿Funciona para invitados en Bolivia y Latinoamérica?',
        a: 'Es nuestra casa. Guest-ly es WhatsApp-first y totalmente bilingüe, con manejo correcto de números +591 — y de cualquier país — incluido.',
      },
      {
        q: '¿Y si la IA no sabe una respuesta?',
        a: 'Solo responde con la información de tu boda. Cuando no está segura, le dice al invitado que lo está consultando contigo y marca la pregunta en tu panel — y tú ves cada conversación.',
      },
      {
        q: '¿Cómo lo usan los invitados?',
        a: 'Tocan un link o escanean un código QR y empiezan a chatear — por WhatsApp o en la web. Nada que instalar, sin crear cuentas.',
      },
      {
        q: '¿Qué cuenta para el límite de invitados?',
        a: 'Personas invitadas, no mensajes. Los mensajes son en la práctica ilimitados, bajo uso razonable.',
      },
      {
        q: '¿Y los reembolsos?',
        a: 'Reembolso total antes de que tu primer invitado le escriba al asistente, o dentro de 30 días — lo que ocurra primero.',
      },
    ],
  },

  cta: {
    kicker: '¿Listo para dejar de responder preguntas?',
    title: 'Tus invitados merecen una\nexperiencia hermosa.',
    body: 'Únete a las parejas que le dieron a sus invitados una experiencia de 5 estrellas — y a ellas mismas la tranquilidad que merecían.',
    primary: 'Obtener mi asistente',
    secondary: 'Ver precios',
  },

  footer: {
    blurb:
      'La plataforma de bodas con IA — un asistente para tus invitados, una página con RSVP por persona, y un portal con su propio Coordinador IA para ti.',
    explore: {
      title: 'Explorar',
      links: [
        { label: 'Canales', href: '#channels' },
        { label: 'Tu portal', href: '#platform' },
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
    copyright: '© 2026 Guest-ly · Asistente IA y Plataforma para Bodas',
    crafted: 'Hecho con ✦ para celebraciones inolvidables',
  },

  /* The production get-started wizard is EN-only; ES strings below follow the
     site's own vocabulary (Empezar, Tarifa de creación, invitados, etc.). */
  wizard: {
    stepLabels: ['Plan', 'Detalles', 'Confirmar'],
    step1: {
      title: 'Elige tu plan',
      sub: 'Un solo pago, tuyo hasta la boda — sin suscripciones. El tamaño depende del número de invitados.',
    },
    step2: {
      title: 'Cuéntanos sobre tu boda',
      sub: 'Te contactamos en menos de 24 horas para empezar.',
      fields: {
        name: 'Tu nombre',
        partner: 'Nombre de tu pareja',
        email: 'Correo electrónico',
        phone: 'Teléfono (opcional)',
        date: 'Fecha de la boda',
        location: 'Ciudad / País',
        notes: '¿Algo que debamos saber? (opcional)',
      },
      back: '← Atrás',
      confirm: 'Confirmar pedido →',
    },
    step3: {
      badge: 'Pedido recibido',
      title: 'Todo listo.',
      summaryTitle: 'Resumen',
      rows: {
        plan: 'Plan',
        guests: 'Número de invitados',
        couple: 'Pareja',
        price: 'Precio · pago único',
      },
      nextTitle: 'Qué pasa después',
      next: [
        { title: 'Paga una sola vez para reservar tu lugar', body: 'Checkout seguro con Stripe — confirmamos en menos de 2 horas en horario laboral.' },
        { title: 'Te enviamos el formulario', body: 'Un formulario de 15 minutos con todo lo que tu bot necesita.' },
        { title: 'Construimos tu bot (~7 días)', body: 'Entrenamiento de IA, configuración de canales, diseño — nosotros nos encargamos.' },
        { title: 'Pruebas, apruebas y compartes', body: 'Tus invitados reciben una experiencia de asistente de lujo 24/7.' },
      ],
      payCta: 'Pagar {price} · pago único →',
      payNoteLinked: 'Checkout seguro con Stripe. Tu lugar queda reservado en cuanto se procesa el pago.',
      payNoteFallback: 'Te enviaremos un link de pago seguro de Stripe a {email} en menos de 2 horas para reservar tu lugar.',
      whatsapp: '¿Prefieres WhatsApp? Escríbenos →',
      mailFallback: '¿No supiste de nosotros en 24 horas?',
      mailFallbackLink: 'Envíanos tu pedido por email',
      backHome: '← Volver al inicio',
    },
    continueLabel: 'Continuar · {plan} · {price} →',
  },
};

export const copy: Record<Locale, SiteCopy> = { en, es };

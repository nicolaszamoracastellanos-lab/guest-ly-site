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
    ranges: string[];
    rangeSub: string;
    popularTag: string;
    plans: {
      id: 'basic' | 'standard' | 'premium';
      name: string;
      channels: string;
      prices: [number, number, number, number];
      feeNote: string;
      hosting: string;
      features: string[];
      cta: string;
      popular?: boolean;
    }[];
    addons: { price: string; label: string }[];
    note: string;
    valueLine: string;
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
    step1: { title: string; sub: string; ranges: string[] };
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
      rows: { plan: string; guests: string; couple: string; fee: string; hosting: string };
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
        plans: 'Standard & Premium',
      },
      {
        name: 'SMS',
        desc: 'A dedicated number guests can text. No internet, no app, no account. The universal fallback — works on every phone on earth.',
        plans: 'Standard & Premium',
      },
      {
        name: 'Telegram',
        desc: 'A dedicated Telegram bot for your wedding. Popular with guests from Europe, Brazil, and tech-savvy crowds. Zero extra cost.',
        plans: 'Standard & Premium',
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
      note: 'Every change shows you a confirmation card first — nothing moves without your approval. Available on Standard & Premium.',
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
    title: 'Build it once.\nKeep it for pennies.',
    intro:
      "A one-time creation fee builds everything — concierge, website, portal, design, and your first 3 months of hosting. After that, a small monthly fee keeps it live. Priced by guest count, because that's what's fair.",
    ranges: ['0–100 guests', '100–300', '300–500', '500+'],
    rangeSub: 'Select your approximate guest count',
    popularTag: '✦ Most popular',
    plans: [
      {
        id: 'basic',
        name: 'Basic',
        channels: 'Web Bot · custom URL',
        prices: [97, 147, 197, 267],
        feeNote: 'Creation fee · one-time',
        hosting: 'then $5/mo hosting after 3 months',
        features: [
          'AI web concierge, custom URL',
          '30+ languages, auto-detected',
          'Couple portal with live analytics',
          'Wedding Brain — edit & publish yourself',
          '1 round of revisions',
          '7-day post-delivery support',
        ],
        cta: 'Get started →',
      },
      {
        id: 'standard',
        name: 'Standard',
        channels: 'Web · WhatsApp · SMS · Telegram',
        prices: [247, 347, 447, 547],
        feeNote: 'Creation fee · one-time',
        hosting: 'then $12/mo hosting after 3 months',
        features: [
          'Everything in Basic',
          'WhatsApp, SMS & Telegram concierge',
          'Bilingual wedding website with RSVP',
          "Broadcasts in each guest's language",
          'International guest travel guide',
          'AI Coordinator add-on available',
          '30-day post-wedding support',
        ],
        cta: 'Get started →',
        popular: true,
      },
      {
        id: 'premium',
        name: 'Premium',
        channels: 'All channels + Guest dashboard',
        prices: [447, 597, 747, 897],
        feeNote: 'Creation fee · one-time',
        hosting: 'then $19/mo hosting after 3 months',
        features: [
          'Everything in Standard',
          'Per-person, per-event RSVP tracking',
          'Automatic RSVP reminders & digest',
          'QR guest passes & registry page',
          'Priority build queue',
          'Unlimited revisions until wedding',
          '60-day post-wedding support',
        ],
        cta: 'Get started →',
      },
    ],
    addons: [
      { price: 'New', label: 'AI Coordinator — run your wedding by chat · Standard & Premium · contact us' },
      { price: '+$100', label: 'Rush delivery — live in under 7 days' },
      { price: '$0', label: 'First 3 months of hosting — always included' },
    ],
    note: 'No contracts. Cancel hosting anytime — your bot simply goes offline.',
    valueLine:
      'For a 400-guest wedding, Standard works out to about $1.12 per guest — less than a single printed menu.',
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
        q: 'Do I need any technical knowledge?',
        a: 'None. You fill out a form with your wedding details and we handle everything — AI training, WhatsApp setup, server hosting, Meta Business. You never touch code.',
      },
      {
        q: 'Why does the price depend on guest count?',
        a: 'The bot uses AI to answer every guest individually — a 500-guest wedding involves far more conversations than a 50-guest one. Pricing by guest count keeps it fair: small weddings pay less, large ones pay for the scale they use.',
      },
      {
        q: 'How long does setup take?',
        a: 'About a week from your completed intake form. Need it faster? The Rush add-on prioritizes your build for delivery in under 7 days.',
      },
      {
        q: 'What if my wedding details change?',
        a: "Change them yourself, instantly. Your portal includes the Wedding Brain — everything your concierge knows. Edit a tip, preview the bot's answer, publish in one click, roll back anytime. Prefer us to do it? Revision rounds are still included in every plan.",
      },
      {
        q: 'What is the AI Coordinator?',
        a: 'A private AI assistant inside your portal that manages your wedding by chat: "Add Lucía, friend of the bride, plus one." "Marco can\'t make it." "Remind non-responders." It knows your live numbers, proposes each change on a confirmation card, and nothing happens until you approve — broadcasts even require typing SEND. Available as an add-on on Standard and Premium.',
      },
      {
        q: 'What languages does the bot speak?',
        a: "30+ languages, automatically detected from each guest's message. Spanish, English, Portuguese, French, German, Italian, Mandarin and many more — all included at no extra cost in every plan.",
      },
      {
        q: "How long is the bot active, and what's the monthly fee?",
        a: 'Your creation fee includes the first 3 months of hosting — which covers most weddings right up to the big day. After that, a small monthly hosting fee keeps your bot live: $5/mo (Basic), $12/mo (Standard), or $19/mo (Premium). It covers the real costs of running your bot — the phone numbers, messaging, and servers. Cancel anytime; the bot simply goes offline.',
      },
      {
        q: 'Is it only for weddings?',
        a: 'Weddings are our specialty, but Guest-ly works beautifully for any event with guests and logistics — quinceañeras, corporate retreats, destination birthdays, conferences. If guests ask questions, Guest-ly answers them.',
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
      sub: 'One-time creation fee + 3 months hosting included. Priced by guest count — fair for everyone.',
      ranges: ['0–100 guests', '100–300', '300–500', '500+'],
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
        fee: 'Creation fee',
        hosting: 'Hosting',
      },
      nextTitle: 'What happens next',
      next: [
        { title: 'Pay the creation fee to lock your slot', body: 'Secure Stripe checkout — we confirm within 2 hours during business hours.' },
        { title: 'We send you the intake form', body: 'A 15-minute form with everything your bot needs.' },
        { title: 'We build your bot (~7 days)', body: 'AI training, channel setup, design — all handled.' },
        { title: 'You test, approve & share', body: 'Your guests get a 24/7 luxury concierge experience.' },
      ],
      payCta: 'Pay creation fee · {price} →',
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
        plans: 'Estándar y Premium',
      },
      {
        name: 'SMS',
        desc: 'Un número dedicado para mensajes de texto. Sin internet, sin apps. El canal universal — funciona en cualquier teléfono del mundo.',
        plans: 'Estándar y Premium',
      },
      {
        name: 'Telegram',
        desc: 'Un bot de Telegram dedicado. Popular entre invitados de Europa, Brasil y el mundo tech. Sin costo extra.',
        plans: 'Estándar y Premium',
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
      note: 'Cada cambio te muestra primero una tarjeta de confirmación — nada se mueve sin tu aprobación. Disponible en Estándar y Premium.',
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
    title: 'Créalo una vez.\nMantenlo por centavos.',
    intro:
      'Una tarifa única de creación lo construye todo — asistente, página de boda, portal, diseño y tus primeros 3 meses de hosting. Después, una pequeña cuota mensual lo mantiene activo. El precio varía por número de invitados, porque así es justo.',
    ranges: ['0–100 invitados', '100–300', '300–500', '500+'],
    rangeSub: 'Selecciona tu número aproximado de invitados',
    popularTag: '✦ Más popular',
    plans: [
      {
        id: 'basic',
        name: 'Básico',
        channels: 'Bot Web · URL personalizada',
        prices: [97, 147, 197, 267],
        feeNote: 'Tarifa de creación · pago único',
        hosting: 'luego $5/mes de hosting tras 3 meses',
        features: [
          'Asistente web con IA, URL personalizada',
          'Más de 30 idiomas, detección automática',
          'Portal de pareja con analíticas en vivo',
          'Wedding Brain — edita y publica tú mismo',
          '1 ronda de revisiones',
          'Soporte 7 días post-entrega',
        ],
        cta: 'Empezar →',
      },
      {
        id: 'standard',
        name: 'Estándar',
        channels: 'Web · WhatsApp · SMS · Telegram',
        prices: [247, 347, 447, 547],
        feeNote: 'Tarifa de creación · pago único',
        hosting: 'luego $12/mes de hosting tras 3 meses',
        features: [
          'Todo lo del Básico',
          'Asistente en WhatsApp, SMS y Telegram',
          'Página de boda bilingüe con RSVP',
          'Difusiones en el idioma de cada invitado',
          'Guía para invitados del exterior',
          'Add-on Coordinador IA disponible',
          'Soporte 30 días post-boda',
        ],
        cta: 'Empezar →',
        popular: true,
      },
      {
        id: 'premium',
        name: 'Premium',
        channels: 'Todos los canales + Panel de invitados',
        prices: [447, 597, 747, 897],
        feeNote: 'Tarifa de creación · pago único',
        hosting: 'luego $19/mes de hosting tras 3 meses',
        features: [
          'Todo lo del Estándar',
          'RSVP por persona y por evento',
          'Recordatorios automáticos y resumen semanal',
          'Pases QR y página de regalos',
          'Prioridad en la cola de creación',
          'Revisiones ilimitadas hasta la boda',
          'Soporte 60 días post-boda',
        ],
        cta: 'Empezar →',
      },
    ],
    addons: [
      { price: 'Nuevo', label: 'Coordinador IA — maneja tu boda por chat · Estándar y Premium · contáctanos' },
      { price: '+$100', label: 'Entrega urgente — activo en menos de 7 días' },
      { price: '$0', label: 'Primeros 3 meses de hosting — siempre incluidos' },
    ],
    note: 'Sin contratos. Cancela el hosting cuando quieras — tu bot simplemente se desactiva.',
    valueLine:
      'Para una boda de 400 invitados, el plan Estándar sale a unos $1.12 por invitado — menos que un solo menú impreso.',
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
        q: '¿Necesito conocimientos técnicos?',
        a: 'Ninguno. Tú llenas un formulario con los datos de tu boda y nosotros manejamos todo — entrenamiento de IA, configuración de WhatsApp, servidor, Meta Business. Nunca tocas código.',
      },
      {
        q: '¿Por qué el precio depende del número de invitados?',
        a: 'El bot usa IA para responder a cada invitado de forma individual — una boda de 500 personas implica muchas más conversaciones que una de 50. Cobrar por rango de invitados lo hace justo: las bodas pequeñas pagan menos.',
      },
      {
        q: '¿Cuánto tiempo tarda la configuración?',
        a: 'Aproximadamente una semana después de recibir tu formulario completo. ¿Con prisa? El add-on Rush lo entrega en menos de 7 días.',
      },
      {
        q: '¿Qué pasa si cambian los datos de mi boda?',
        a: 'Los cambias tú mismo, al instante. Tu portal incluye el Wedding Brain — todo lo que sabe tu asistente. Edita un consejo, prueba la respuesta del bot, publica en un click y vuelve atrás cuando quieras. ¿Prefieres que lo hagamos nosotros? Las rondas de revisión siguen incluidas en todos los planes.',
      },
      {
        q: '¿Qué es el Coordinador IA?',
        a: 'Un asistente IA privado dentro de tu portal que maneja tu boda por chat: "Agrega a Lucía, amiga de la novia, con acompañante." "Marco no puede venir." "Recuérdales a los pendientes." Conoce tus números en vivo, propone cada cambio en una tarjeta de confirmación y nada ocurre hasta que apruebas — las difusiones incluso requieren escribir ENVIAR. Disponible como add-on en Estándar y Premium.',
      },
      {
        q: '¿En qué idiomas responde el bot?',
        a: 'Más de 30 idiomas, detectados automáticamente del mensaje de cada invitado. Español, inglés, portugués, francés, alemán, italiano, mandarín y más — incluidos en todos los planes.',
      },
      {
        q: '¿Cuánto tiempo está activo el bot y cuál es la cuota mensual?',
        a: 'Tu tarifa de creación incluye los primeros 3 meses de hosting — que cubren la mayoría de las bodas hasta el gran día. Después, una pequeña cuota mensual mantiene tu bot activo: $5/mes (Básico), $12/mes (Estándar) o $19/mes (Premium). Cubre los costos reales de operar tu bot. Cancela cuando quieras.',
      },
      {
        q: '¿Es solo para bodas?',
        a: 'Las bodas son nuestra especialidad, pero Guest-ly funciona perfecto para cualquier evento con invitados y logística — quinceañeras, retiros corporativos, cumpleaños de destino, conferencias. Si los invitados preguntan, Guest-ly responde.',
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
      sub: 'Tarifa única de creación + 3 meses de hosting incluidos. El precio varía por número de invitados — justo para todos.',
      ranges: ['0–100 invitados', '100–300', '300–500', '500+'],
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
        fee: 'Tarifa de creación',
        hosting: 'Hosting',
      },
      nextTitle: 'Qué pasa después',
      next: [
        { title: 'Paga la tarifa de creación para reservar tu lugar', body: 'Checkout seguro con Stripe — confirmamos en menos de 2 horas en horario laboral.' },
        { title: 'Te enviamos el formulario', body: 'Un formulario de 15 minutos con todo lo que tu bot necesita.' },
        { title: 'Construimos tu bot (~7 días)', body: 'Entrenamiento de IA, configuración de canales, diseño — nosotros nos encargamos.' },
        { title: 'Pruebas, apruebas y compartes', body: 'Tus invitados reciben una experiencia de asistente de lujo 24/7.' },
      ],
      payCta: 'Pagar tarifa de creación · {price} →',
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

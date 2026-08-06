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
  link?: { label: string; href: string };
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

/* ---- wave 5.1 interactive content types ---- */

export interface ConfirmCard {
  title: string;
  lines: string[];
  confirm: string;
  cancel: string;
  done: string;
}

export interface ScenarioStep {
  kind: 'guest' | 'couple' | 'ai' | 'typing' | 'confirm' | 'diff' | 'frame' | 'note';
  text?: string;
  card?: ConfirmCard;
  frame?: { title: string; rows: string[] };
}

export interface Scenario {
  id: string;
  label: string;
  timeLabel: string;
  hook: string;
  steps: ScenarioStep[];
  endNote: string;
  caption?: { text: string; href: string };
}

export interface ChannelCard {
  id: string;
  name: string;
  status: 'live' | 'soon';
  caption: string;
  fact?: string;
  script: { from: 'guest' | 'ai'; text: string }[];
}

export interface LanguageChip {
  id: string;
  label: string;
  starred?: boolean;
  q: string;
  a: string;
}

export interface PlatformPane {
  id: string;
  menuLabel: string;
  title: string;
  blurb: string;
  facts: string[];
  wow?: string;
  microCta: string;
  microDone: string;
  link?: { label: string; href: string };
}

export interface CompareColumn {
  id: string;
  name: string;
  sub: string;
  price: string;
  marks: string[]; /* 'yes' | 'no' | short text per row */
  highlight?: boolean;
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
    watchLink: string;
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
    steps: { n: string; day: string; timeChip?: string; title: string; body: string; details: string[] }[];
    cta: string;
    ctaNote: string;
  };
  scenarios: {
    no: string;
    kicker: string;
    title: string;
    intro: string;
    disclaimer: string;
    replay: string;
    playAria: string;
    tapSkip: string;
    items: Scenario[];
  };
  channels: {
    no: string;
    kicker: string;
    title: string;
    intro: string;
    liveLabel: string;
    soonLabel: string;
    cards: ChannelCard[];
    languages: {
      headline: string;
      chips: LanguageChip[];
      moreLabel: string;
      footnote: string;
    };
    intlGuide: {
      title: string;
      hint: string;
      items: { title: string; body: string }[];
      closing: string;
      scenarioLink: { label: string; href: string };
    };
  };
  platform: {
    no: string;
    kicker: string;
    title: string;
    intro: string;
    windowLabel: string;
    items: PlatformPane[];
  };
  coordinator: {
    no: string;
    badge: string;
    title: string;
    intro: string;
    disclaimer: string;
    scripts: Scenario[];
    capsTitle: string;
    caps: string[];
    capsClosing: string;
    priceLine: string;
    cta: string;
    seePricing: string;
  };
  compare: {
    no: string;
    toggle: string;
    hint: string;
    sub: string;
    rows: string[];
    priceLabel: string;
    includedSr: string;
    notIncludedSr: string;
    footnote: string;
    zolaLine: string;
    columns: CompareColumn[];
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
    fullListLabel: string;
    fullLists: { essentials: string[]; signature: string[]; grande: string[] };
    channelsFootnote: string;
    coordLink: string;
    compareLink: string;
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
      emailCta: string;
      emailNote: string;
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
      { label: 'See it happen', href: '#scenarios' },
      { label: 'Platform', href: '#platform' },
      { label: 'Coordinator', href: '#coordinator' },
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
      { value: '30+', label: 'Languages · perfected in EN & ES' },
      { value: '2', label: 'Channels live today' },
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
    watchLink: 'Watch it happen',
  },

  pillars: {
    no: '№ 02',
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
            h: 'International guest guide',
            b: 'Visas, currency, weather and transport, answered from your facts in the guest\u2019s language.',
            link: { label: 'Play the 2:07 AM scenario', href: '#scenarios=abroad' },
          },
          {
            h: 'QR guest passes',
            b: 'Every guest gets a personal QR pass for a smooth check-in at the door.',
          },
          {
            h: 'Their language',
            b: 'Understands 30+ languages, perfected in English and Spanish. SMS and Telegram are coming soon.',
            link: { label: 'See the channels', href: '#channels' },
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
            h: 'Seating planner',
            b: 'AI reads the tables from a photo of your venue floor plan; auto-assign never splits a party.',
            link: { label: 'See it live', href: '#platform=seating' },
          },
          {
            h: 'Budget',
            b: 'Imports your existing budget from Excel, pasted text or a photo, with your review before anything is written.',
            link: { label: 'See it live', href: '#platform=budget' },
          },
          {
            h: 'AI Coordinator',
            b: 'The optional add-on: tell it what changed, in plain English or Spanish, and it updates the list, the RSVPs and the reminders. Every change asks for your approval first.',
            link: { label: 'See it in action', href: '#coordinator' },
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
            h: 'A seat for your planner',
            b: 'Your planner gets a scrubbed portal with no guest contact data; you approve every change.',
            link: { label: 'See it live', href: '#platform=planner' },
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
    no: '№ 06',
    kicker: 'How it works',
    title: 'From order to live concierge\nin about a week.',
    intro: '',
    steps: [
      {
        n: '01',
        day: 'Day 0',
        timeChip: 'about 20 minutes',
        title: 'Tell us about your wedding',
        body: 'The intake wizard walks you through it.',
        details: [
          'Your story, events, venues and travel facts',
          'Import your guest list from CSV or Excel, or sync from Zola',
          'Pick your languages and your site address',
        ],
      },
      {
        n: '02',
        day: 'Days 1 to 4',
        title: 'We build your concierge and website',
        body: 'You do nothing. We build.',
        details: [
          'A themed bilingual website at your short address',
          'The Wedding Brain, trained only on your facts',
          'Your dedicated WhatsApp number and QR passes',
        ],
      },
      {
        n: '03',
        day: 'Days 5 and 6',
        title: 'You review and approve',
        body: 'Test it like a guest would.',
        details: [
          'Ask your live bot from inside the portal',
          'Edit any fact and publish instantly',
          'Every version kept, one-click restore',
        ],
      },
      {
        n: '04',
        day: 'Day 7',
        title: 'Share one link and one number',
        body: 'Guests RSVP and start asking.',
        details: [
          'Per-person, per-event RSVPs from day one',
          'You watch the dashboard fill',
          'We monitor everything behind the scenes',
        ],
      },
    ],
    cta: 'Start step one',
    ctaNote: 'Most couples are live in about 7 days.',
  },

  scenarios: {
    no: '№ 01',
    kicker: 'See it happen',
    title: 'Four moments.\nZero panic.',
    intro: 'Tap play. Each one is the real product doing its job.',
    disclaimer: 'Scripted examples from a fictional wedding. The real concierge runs on your actual guest list and facts.',
    replay: 'Replay',
    playAria: 'Play scenario',
    tapSkip: 'Tap to skip ahead',
    items: [
      {
        id: 'abroad',
        label: 'The 2am question',
        timeLabel: '2:07 AM · Tuesday',
        hook: 'A guest lands on the visa, currency and airport questions. You are asleep.',
        steps: [
          { kind: 'guest', text: 'Do I need a visa for the wedding? And can I pay by card there?' },
          { kind: 'typing' },
          { kind: 'ai', text: 'No visa for stays under 90 days on most passports; the wedding page lists the exceptions. Cards work almost everywhere, and small bills help with taxis. Expect warm days and cool evenings that week.' },
          { kind: 'note', text: 'Answered from the couple\u2019s published facts.' },
          { kind: 'guest', text: '¿Y cómo llego del aeropuerto al hotel?' },
          { kind: 'typing' },
          { kind: 'ai', text: 'El shuttle del hotel sale cada hora hasta medianoche, y el trayecto dura unos 25 minutos. También hay taxis oficiales en la puerta.' },
          { kind: 'note', text: 'Language detected per guest.' },
        ],
        endNote: 'Answered in seconds, in the guest\u2019s language. Nobody woke up.',
      },
      {
        id: 'marco',
        label: 'Marco cannot make it',
        timeLabel: 'Sunday · 9:40 PM',
        hook: 'One sentence from you. The list, the counts and the reminders all update.',
        steps: [
          { kind: 'couple', text: 'Marco just told me he can\u2019t make it.' },
          { kind: 'typing' },
          { kind: 'ai', text: 'Marco Rossi is in the Rossi party, attending ceremony and reception. Want me to mark him as not attending for both?' },
          {
            kind: 'confirm',
            card: {
              title: 'Proposed change',
              lines: ['Marco Rossi: not attending, ceremony and reception', 'Headcounts update automatically'],
              confirm: 'Confirm',
              cancel: 'Cancel',
              done: 'Done. Marco marked as not attending. Headcounts updated.',
            },
          },
        ],
        endNote: 'Nothing writes without your click.',
        caption: { text: 'Meet the Coordinator', href: '#coordinator' },
      },
      {
        id: 'planner',
        label: 'Your planner asks. You approve.',
        timeLabel: 'Wednesday · 11:15 AM',
        hook: 'Your planner fixes three things. You approve them in one tap.',
        steps: [
          {
            kind: 'frame',
            frame: {
              title: 'Planner portal · inline edits',
              rows: ['Rosa Delgado → table 4 (was 7)', 'Diego Morales → vegetarian menu', 'Note: reach Rosa via the planner'],
            },
          },
          {
            kind: 'diff',
            card: {
              title: 'Change request from your planner',
              lines: ['Rosa Delgado: table 7 → table 4', 'Diego Morales: dietary note added: vegetarian', 'Rosa Delgado: contact note added'],
              confirm: 'Approve all',
              cancel: 'Dismiss',
              done: 'Approved. Three changes applied in one tap.',
            },
          },
          { kind: 'note', text: 'Guest phones and emails never reach your planner.' },
        ],
        endNote: 'One approval applies the whole batch.',
        caption: { text: 'See the planner portal', href: '#platform=planner' },
      },
      {
        id: 'budget',
        label: 'A photo becomes your budget',
        timeLabel: 'Thursday · 6:20 PM',
        hook: 'Your old spreadsheet, photographed, read and imported.',
        steps: [
          { kind: 'frame', frame: { title: 'budget-2026.xlsx · photo', rows: ['A photo of the printed budget, snapped on the kitchen table'] } },
          {
            kind: 'frame',
            frame: {
              title: 'Reading line items',
              rows: ['Venue deposit · 12,000.00', 'Catering, per plate · 89.50', 'Florals, ceremony arch · 1,450.00', '106 more rows detected'],
            },
          },
          {
            kind: 'confirm',
            card: {
              title: 'Proposed import',
              lines: ['109 line items found', 'Grand total 285,545.06, matched to the cent', 'Nothing is saved until you approve'],
              confirm: 'Import all',
              cancel: 'Cancel',
              done: 'Imported. 109 items, totals matched to the cent.',
            },
          },
          { kind: 'note', text: 'You review every line before anything is saved.' },
        ],
        endNote: 'Your existing spreadsheet, imported and understood.',
        caption: { text: 'See the budget tab', href: '#platform=budget' },
      },
    ],
  },

  channels: {
    no: '№ 03',
    kicker: 'Guests choose their channel',
    title: 'One brain.\nEvery channel.',
    intro: 'Your guests do not download anything. They ask where they already talk and get the same answer everywhere.',
    liveLabel: 'Live',
    soonLabel: 'Coming soon',
    cards: [
      {
        id: 'web',
        name: 'Web chat',
        status: 'live',
        caption: 'An elegant chat on the couple\u2019s wedding page. Any browser, nothing to install.',
        fact: 'Live for a real November 2026 wedding: 100+ real guest messages answered.',
        script: [
          { from: 'guest', text: 'What time is the ceremony?' },
          { from: 'ai', text: 'The ceremony starts at 4:00 PM sharp at the garden pavilion. Doors open at 3:30 PM.' },
        ],
      },
      {
        id: 'whatsapp',
        name: 'WhatsApp',
        status: 'live',
        caption: 'A dedicated number for your wedding. Guests can finish their entire RSVP in chat, per named person.',
        script: [
          { from: 'guest', text: 'rsvp' },
          { from: 'ai', text: 'Happy to help! Your invitation covers Ana Torres and Luis Torres. Is Ana attending the ceremony?' },
          { from: 'guest', text: 'Yes, both of us, both events' },
          { from: 'ai', text: 'Lovely. Ana and Luis are confirmed for ceremony and reception. Anything we should know about food?' },
        ],
      },
      {
        id: 'sms',
        name: 'SMS',
        status: 'soon',
        caption: 'On the roadmap. Not live yet. Web and WhatsApp carry every wedding today.',
        script: [],
      },
      {
        id: 'telegram',
        name: 'Telegram',
        status: 'soon',
        caption: 'On the roadmap. Not live yet. Web and WhatsApp carry every wedding today.',
        script: [],
      },
    ],
    languages: {
      headline: 'Understands 30+ languages, perfected in English and Spanish.',
      chips: [
        { id: 'en', label: 'English', starred: true, q: 'What\u2019s the dress code?', a: 'Black tie optional. Formal attire is encouraged.' },
        { id: 'es', label: 'Español', starred: true, q: '¿Cuál es el código de vestimenta?', a: 'Black tie opcional. Se recomienda vestimenta formal.' },
        { id: 'pt', label: 'Português', q: 'Qual é o traje?', a: 'Black tie opcional. Traje formal é recomendado.' },
        { id: 'fr', label: 'Français', q: 'Quel est le code vestimentaire ?', a: 'Tenue de soirée facultative. Une tenue habillée est recommandée.' },
        { id: 'de', label: 'Deutsch', q: 'Wie ist der Dresscode?', a: 'Black Tie optional. Festliche Kleidung wird empfohlen.' },
        { id: 'it', label: 'Italiano', q: 'Qual è il dress code?', a: 'Black tie facoltativo. Si consiglia un abito elegante.' },
        { id: 'zh', label: '中文', q: '婚礼的着装要求是什么？', a: '黑领结可选，建议正式着装。' },
      ],
      moreLabel: '+ more',
      footnote: '✦ the perfected pair. Other languages are answered best-effort by the same AI.',
    },
    intlGuide: {
      title: 'The international guest guide',
      hint: 'See what it covers',
      items: [
        { title: 'Visas', body: 'Who needs one, who does not, and where to check, from the couple\u2019s facts.' },
        { title: 'Currency', body: 'What to pay with, where to exchange and how much to tip.' },
        { title: 'Weather', body: 'What the season is really like and what to pack for it.' },
        { title: 'Getting around', body: 'Airport transfers, shuttles, rideshares and taxi advice.' },
      ],
      closing: 'All answered from the couple\u2019s own facts, in the guest\u2019s language.',
      scenarioLink: { label: 'Play the 2:07 AM scenario', href: '#scenarios=abroad' },
    },
  },

  platform: {
    no: '№ 04',
    kicker: 'Inside the platform',
    title: 'Your whole wedding.\nOne portal.',
    intro: 'This is app.guest-ly.com in miniature. Tap around: everything here is live in the real product today.',
    windowLabel: 'app.guest-ly.com',
    items: [
      {
        id: 'dashboard',
        menuLabel: 'Dashboard',
        title: 'Live dashboard',
        blurb: 'Every question, topic and gap, at a glance.',
        facts: [
          'Guest questions classified by topic, every hour',
          'Gaps flagged when the concierge could not answer',
          'Sentiment badges surface frustrated guests',
          'A weekly bilingual digest lands in your inbox',
        ],
        microCta: 'Turn the gap into an answer',
        microDone: 'Turned into an answer. The concierge knows it now.',
      },
      {
        id: 'guests',
        menuLabel: 'Guests & RSVPs',
        title: 'Guest list and RSVP board',
        blurb: 'One clean list that feeds everything else.',
        facts: [
          'Per-person, per-event RSVP: headcounts count people, not replies',
          'Import from CSV, Excel or Zola',
          'Zola sync: 46 real RSVPs brought over with zero conflicts',
          'Branded .xlsx exports with nine presets',
        ],
        wow: 'Real 401-person Zola export: 359 guests auto-matched.',
        microCta: 'Tap a guest row',
        microDone: 'The guest drawer opens anywhere a name appears: about 30 screens.',
      },
      {
        id: 'broadcasts',
        menuLabel: 'Broadcasts',
        title: 'Message the right guests',
        blurb: 'All guests, one group, or only the silent ones.',
        facts: [
          'Audience filters: RSVP status, event, language',
          'Each guest gets the message in their own language',
          'Scheduled bilingual reminders',
          'Delivery and read stats',
        ],
        microCta: 'Filter: no reply yet',
        microDone: 'Audience updated: 37 guests, each in their own language.',
      },
      {
        id: 'seating',
        menuLabel: 'Seating',
        title: 'Seating planner',
        blurb: 'From a photo of the floor plan to a printable seat sheet.',
        facts: [
          'AI vision reads the tables from a photo of the venue floor plan',
          'Drag tables, tap to seat by family or tags',
          'Auto-assign never splits a party',
          'Printable seating sheet',
        ],
        wow: 'Reads the layout straight from a photo of the floor plan.',
        microCta: 'Auto-assign',
        microDone: 'Seated. No party split.',
      },
      {
        id: 'budget',
        menuLabel: 'Budget',
        title: 'Budget with AI import',
        blurb: 'Your whole budget, shared with your planner.',
        facts: [
          'Nested line items with dated payments',
          'Who paid, what is reimbursable, month by month totals',
          'AI import from Excel, pasted text or a photo',
          'The one place your planner can edit directly',
        ],
        wow: 'A real 109-item spreadsheet imported: grand total 285,545.06, matched to the cent.',
        microCta: 'Import a spreadsheet',
        microDone: 'Review card first: nothing is written until you approve.',
      },
      {
        id: 'brain',
        menuLabel: 'Wedding Brain',
        title: 'Everything your concierge knows',
        blurb: 'Edit, preview, publish. The live bot updates in about a minute.',
        facts: [
          'Publishing updates the live concierge within a minute',
          'Every version kept, one-click restore',
          'Ask your live bot from inside the portal',
          'Full transcripts with search, intents and gap badges',
        ],
        microCta: 'Publish v12',
        microDone: 'v12 is live. The concierge answers with it now.',
      },
      {
        id: 'planner',
        menuLabel: 'Planner',
        title: 'A portal for your planner',
        blurb: 'They manage. You approve. Contact data stays private.',
        facts: [
          'Scrubbed portal: no guest phones or emails',
          'Inline edits become change requests you approve',
          'Shared task board and metrics',
          'Read-only broadcast history with request-a-reminder',
        ],
        wow: 'Up to 50 guests edited inline, approved in one click.',
        microCta: 'Submit request',
        microDone: 'Sent to the couple: the whole diff, approved in one click.',
        link: { label: 'Play the planner scenario', href: '#scenarios=planner' },
      },
      {
        id: 'checkin',
        menuLabel: 'Day-of',
        title: 'QR passes and check-in',
        blurb: 'A calm door on the big day.',
        facts: [
          'Printable per-guest QR passes',
          'Camera scan with name-search fallback',
          'Live counters and undo',
        ],
        microCta: 'Scan a pass',
        microDone: 'Checked in. Counter: 86 → 87.',
      },
    ],
  },

  coordinator: {
    no: '№ 05',
    badge: 'AI Coordinator',
    title: 'Tell it what happened.\nApprove what it proposes.',
    intro: 'A natural-language assistant that reads your wedding and drafts the exact change. Nothing writes until you click confirm.',
    disclaimer: 'Scripted example. The real Coordinator runs on your actual guest list.',
    scripts: [
      {
        id: 'import',
        label: 'Drop in a spreadsheet',
        timeLabel: 'guests.xlsx · 18 KB',
        hook: 'A file becomes a clean guest list.',
        steps: [
          { kind: 'couple', text: 'guests.xlsx' },
          { kind: 'typing' },
          { kind: 'ai', text: 'I read 45 rows. 42 look like new guests, 3 are already on your list. Here is the import I would run.' },
          {
            kind: 'confirm',
            card: {
              title: 'Proposed import',
              lines: ['Add 42 guests', 'Skip 3 duplicates', 'Columns mapped: name, party, phone, side'],
              confirm: 'Confirm',
              cancel: 'Cancel',
              done: 'Done. 42 guests imported to your list.',
            },
          },
        ],
        endNote: 'Drop a spreadsheet into the chat and it proposes the exact import for you to confirm.',
      },
      {
        id: 'marco',
        label: 'Marco just told me he can\u2019t make it',
        timeLabel: 'One sentence in',
        hook: 'Guest edits from plain language.',
        steps: [
          { kind: 'couple', text: 'Marco just told me he can\u2019t make it.' },
          { kind: 'typing' },
          { kind: 'ai', text: 'Marco Rossi, Rossi party, currently attending ceremony and reception. Mark him as not attending for both?' },
          {
            kind: 'confirm',
            card: {
              title: 'Proposed change',
              lines: ['Marco Rossi: not attending, both events', 'Headcounts update automatically'],
              confirm: 'Confirm',
              cancel: 'Cancel',
              done: 'Done. Marco updated. Reception headcount is now 121.',
            },
          },
        ],
        endNote: 'Nothing writes without your click.',
      },
      {
        id: 'remind',
        label: 'Remind everyone who has not responded',
        timeLabel: 'One sentence in',
        hook: 'A bilingual reminder to exactly the right people.',
        steps: [
          { kind: 'couple', text: 'Remind everyone who has not responded yet.' },
          { kind: 'typing' },
          { kind: 'ai', text: '37 guests have not responded and have a phone on file. Here is the reminder I would send, in each guest\u2019s own language.' },
          {
            kind: 'confirm',
            card: {
              title: 'Proposed broadcast',
              lines: ['Audience: no reply yet, has phone (37)', 'Message: bilingual RSVP reminder', 'Sends in each guest\u2019s own language'],
              confirm: 'Confirm',
              cancel: 'Cancel',
              done: 'Queued. 37 reminders, each in the guest\u2019s own language.',
            },
          },
        ],
        endNote: 'Audience filters, language batching, delivery stats. All from one sentence.',
      },
      {
        id: 'export',
        label: 'Export the final list for the caterer',
        timeLabel: 'One sentence in',
        hook: 'The right preset, scrubbed and branded.',
        steps: [
          { kind: 'couple', text: 'Export the final list for the caterer.' },
          { kind: 'typing' },
          { kind: 'ai', text: 'I would use the Caterer preset: per-person rows, dietary answers, table numbers. Contact details scrubbed.' },
          {
            kind: 'confirm',
            card: {
              title: 'Proposed export',
              lines: ['Preset: Caterer', 'Per-person mode: party rosters expanded', 'Contact data scrubbed'],
              confirm: 'Confirm',
              cancel: 'Cancel',
              done: 'Done. Your branded .xlsx is ready.',
            },
          },
        ],
        endNote: 'Nine presets, one click, always your branding.',
      },
    ],
    capsTitle: 'Everything it can do today',
    caps: [
      'Guest and RSVP edits',
      'Batch edits across up to 50 guests',
      'Reminders and broadcasts',
      'CSV and Excel import straight into the guest list',
      'Bulk RSVP updates',
      'Branded exports',
      'Escalation handling',
    ],
    capsClosing: 'Each action is gated by its own capability switch.',
    priceLine: 'Included with Grande. Or add to any plan: $79 one-time or $19 per month.',
    cta: 'Get my concierge',
    seePricing: 'See pricing',
  },

  compare: {
    no: '№ 07',
    toggle: 'How Guest-ly compares',
    hint: 'Vino, Daisy Chat, GuestBook, Zola and The Knot',
    sub: 'For a wedding of about 150 guests.',
    rows: ['WhatsApp concierge', 'EN/ES bilingual', 'Per-person RSVP', 'Wedding website', 'Broadcasts', 'QR check-in'],
    priceLabel: 'Price',
    includedSr: 'Included',
    notIncludedSr: 'Not included',
    footnote: 'Public pricing as listed by each vendor, mid-2026.',
    zolaLine: 'Keep Zola. We sync with it: 46 real RSVPs brought over with zero conflicts.',
    columns: [
      { id: 'guestly', name: 'Guest-ly', sub: 'Signature plan', price: '$399 once', marks: ['yes', 'yes', 'yes', 'yes', 'yes', 'yes'], highlight: true },
      { id: 'vino', name: 'Vino', sub: 'No web chat', price: '$2,499', marks: ['yes', 'yes', 'no', 'no', 'yes', 'no'] },
      { id: 'daisy', name: 'Daisy Chat', sub: 'SMS only', price: '$125 to $175', marks: ['no', 'no', 'no', 'no', 'yes', 'no'] },
      { id: 'guestbook', name: 'GuestBook', sub: 'Web chat only', price: '$10 to $99/mo', marks: ['no', 'no', 'no', 'no', 'no', 'no'] },
      { id: 'zola', name: 'Zola / The Knot', sub: 'No AI, no WhatsApp', price: 'Free', marks: ['no', 'no', 'yes', 'yes', 'yes', 'no'] },
    ],
  },

  pricing: {
    no: '№ 08',
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
    fullListLabel: 'See everything included',
    fullLists: {
      essentials: [
        'AI concierge on web + WhatsApp, perfected in EN/ES',
        'Bilingual wedding website + RSVP wizard',
        'Guest list with parties and tags',
        'Import from CSV, Excel or Zola',
        'Dashboard, transcripts and gap alerts',
        '4 broadcasts included',
        'Budget tab with AI import',
        'Seating planner',
        'Email notifications',
      ],
      signature: [
        'Everything in Essentials',
        'Per-person, per-event RSVP',
        'Unlimited broadcasts, scheduled reminders',
        'QR guest passes + day-of check-in console',
        'Zola RSVP sync',
        'Branded .xlsx exports, nine presets',
        'Priority support',
      ],
      grande: [
        'Everything in Signature',
        'AI Coordinator included',
        'Done-for-you import and setup call',
        'Planner seat: scrubbed portal, requests and approvals',
      ],
    },
    channelsFootnote: 'SMS and Telegram concierge channels are coming soon and will join when they launch.',
    coordLink: 'See it in action',
    compareLink: 'See how this compares',
  },

  founding: {
    no: '№ 09',
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
    no: '№ 10',
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
        q: 'What languages does it speak, and on which channels?',
        a: 'Understands 30+ languages, perfected in English and Spanish. Web chat and WhatsApp are live today; SMS and Telegram are coming soon.',
      },
      {
        q: 'When do SMS and Telegram arrive?',
        a: 'They are on the roadmap and will be announced when live. Web and WhatsApp carry every wedding today.',
      },
      {
        q: 'What does my wedding planner get to see?',
        a: 'A scrubbed portal with no guest phones or emails. Their edits become change requests you approve in one click; the budget is the one place they edit directly.',
      },
      {
        q: 'We already collected RSVPs on Zola. Do we lose them?',
        a: 'No. We sync with Zola: a real 46-RSVP list came over with zero conflicts. Keep Zola if you like it.',
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
        { label: 'See it happen', href: '#scenarios' },
        { label: 'Platform', href: '#platform' },
        { label: 'Coordinator', href: '#coordinator' },
        { label: 'Compare', href: '#compare' },
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
        { title: 'We confirm your quote by email', body: 'You reply to lock your build slot. We answer within 2 hours during business hours.' },
        { title: 'We send you the intake form', body: 'A 15-minute form with everything your bot needs.' },
        { title: 'We build your bot (~7 days)', body: 'AI training, channel setup, design: all handled.' },
        { title: 'You test, approve and share', body: 'Your guests get a 24/7 concierge experience.' },
      ],
      payCta: 'Pay {price} securely →',
      payNoteLinked: 'Secure checkout by Stripe. Your build slot is reserved the moment payment comes through.',
      payNoteFallback: 'We will send a secure Stripe payment link to {email} within 2 hours to reserve your build slot.',
      emailCta: 'Email us to complete your order →',
      emailNote: 'We confirm your quote and reserve your build slot by email, usually within a few hours.',
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
              'Guest-ly is operated by ZC Ventures LLC. Contact: nicolas@guest-ly.com.',
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
      { label: 'Míralo pasar', href: '#scenarios' },
      { label: 'Plataforma', href: '#platform' },
      { label: 'Coordinador', href: '#coordinator' },
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
      { value: '30+', label: 'Idiomas · perfeccionado en ES y EN' },
      { value: '2', label: 'Canales activos hoy' },
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
    watchLink: 'Míralo pasar',
  },

  pillars: {
    no: '№ 02',
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
            h: 'Guía del invitado internacional',
            b: 'Visas, moneda, clima y transporte, respondidos con tus datos en el idioma del invitado.',
            link: { label: 'Reproduce el escenario de las 2:07 AM', href: '#scenarios=abroad' },
          },
          {
            h: 'Pases QR de invitado',
            b: 'Cada invitado recibe un pase QR personal para un check-in fluido en la puerta.',
          },
          {
            h: 'Su idioma',
            b: 'Entiende más de 30 idiomas, perfeccionado en inglés y español. SMS y Telegram llegan pronto.',
            link: { label: 'Mira los canales', href: '#channels' },
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
            h: 'Planificador de mesas',
            b: 'La IA lee las mesas desde una foto del plano; la asignación automática nunca separa un grupo.',
            link: { label: 'Míralo en vivo', href: '#platform=seating' },
          },
          {
            h: 'Presupuesto',
            b: 'Importa tu presupuesto desde Excel, texto pegado o una foto, con tu revisión antes de escribir nada.',
            link: { label: 'Míralo en vivo', href: '#platform=budget' },
          },
          {
            h: 'Coordinador IA',
            b: 'El add-on opcional: cuéntale qué cambió, en español o inglés, y actualiza la lista, los RSVPs y los recordatorios. Cada cambio pide primero tu aprobación.',
            link: { label: 'Míralo en acción', href: '#coordinator' },
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
            h: 'Un lugar para tu planner',
            b: 'Tu planner recibe un portal filtrado sin datos de contacto; tú apruebas cada cambio.',
            link: { label: 'Míralo en vivo', href: '#platform=planner' },
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
    no: '№ 06',
    kicker: 'Cómo funciona',
    title: 'De tu pedido a asistente activo\nen una semana.',
    intro: '',
    steps: [
      {
        n: '01',
        day: 'Día 0',
        timeChip: 'unos 20 minutos',
        title: 'Cuéntanos sobre tu boda',
        body: 'El asistente de alta te guía paso a paso.',
        details: [
          'Su historia, eventos, lugares y datos de viaje',
          'Importa tu lista desde CSV o Excel, o sincroniza desde Zola',
          'Elige tus idiomas y la dirección de tu página',
        ],
      },
      {
        n: '02',
        day: 'Días 1 a 4',
        title: 'Construimos tu asistente y tu página',
        body: 'Tú no haces nada. Nosotros construimos.',
        details: [
          'Una página bilingüe con tu estética en tu dirección corta',
          'El Wedding Brain, entrenado solo con tus datos',
          'Tu número de WhatsApp dedicado y tus pases QR',
        ],
      },
      {
        n: '03',
        day: 'Días 5 y 6',
        title: 'Revisas y apruebas',
        body: 'Pruébalo como lo haría un invitado.',
        details: [
          'Pregúntale a tu bot en vivo desde el portal',
          'Edita cualquier dato y publica al instante',
          'Cada versión guardada, restaurar con un click',
        ],
      },
      {
        n: '04',
        day: 'Día 7',
        title: 'Comparte un link y un número',
        body: 'Tus invitados confirman y empiezan a preguntar.',
        details: [
          'RSVP por persona y por evento desde el primer día',
          'Ves el panel llenarse en vivo',
          'Nosotros monitoreamos todo por detrás',
        ],
      },
    ],
    cta: 'Empezar paso uno',
    ctaNote: 'La mayoría de las parejas está en vivo en unos 7 días.',
  },

  scenarios: {
    no: '№ 01',
    kicker: 'Míralo pasar',
    title: 'Cuatro momentos.\nCero pánico.',
    intro: 'Toca play. Cada uno es el producto real haciendo su trabajo.',
    disclaimer: 'Ejemplos guionados de una boda ficticia. El asistente real funciona con tu lista y tus datos.',
    replay: 'Repetir',
    playAria: 'Reproducir escenario',
    tapSkip: 'Toca para adelantar',
    items: [
      {
        id: 'abroad',
        label: 'La pregunta de las 2am',
        timeLabel: '2:07 AM · martes',
        hook: 'A un invitado le cae la duda de visa, moneda y aeropuerto. Tú duermes.',
        steps: [
          { kind: 'guest', text: 'Do I need a visa for the wedding? And can I pay by card there?' },
          { kind: 'typing' },
          { kind: 'ai', text: 'No visa for stays under 90 days on most passports; the wedding page lists the exceptions. Cards work almost everywhere, and small bills help with taxis. Expect warm days and cool evenings that week.' },
          { kind: 'note', text: 'Responde con los datos publicados por la pareja.' },
          { kind: 'guest', text: '¿Y cómo llego del aeropuerto al hotel?' },
          { kind: 'typing' },
          { kind: 'ai', text: 'El shuttle del hotel sale cada hora hasta medianoche, y el trayecto dura unos 25 minutos. También hay taxis oficiales en la puerta.' },
          { kind: 'note', text: 'Idioma detectado por invitado.' },
        ],
        endNote: 'Respondido en segundos, en el idioma del invitado. Nadie se despertó.',
      },
      {
        id: 'marco',
        label: 'Marco no puede venir',
        timeLabel: 'Domingo · 9:40 PM',
        hook: 'Una frase tuya. La lista, los conteos y los recordatorios se actualizan.',
        steps: [
          { kind: 'couple', text: 'Marco me acaba de avisar que no puede venir.' },
          { kind: 'typing' },
          { kind: 'ai', text: 'Marco Rossi está en el grupo Rossi, confirmado para ceremonia y recepción. ¿Lo marco como no asiste en ambos?' },
          {
            kind: 'confirm',
            card: {
              title: 'Cambio propuesto',
              lines: ['Marco Rossi: no asiste, ceremonia y recepción', 'Los conteos se actualizan automáticamente'],
              confirm: 'Confirmar',
              cancel: 'Cancelar',
              done: 'Listo. Marco marcado como no asiste. Conteos actualizados.',
            },
          },
        ],
        endNote: 'Nada se escribe sin tu click.',
        caption: { text: 'Conoce al Coordinador', href: '#coordinator' },
      },
      {
        id: 'planner',
        label: 'Tu planner pide. Tú apruebas.',
        timeLabel: 'Miércoles · 11:15 AM',
        hook: 'Tu planner corrige tres cosas. Tú las apruebas con un toque.',
        steps: [
          {
            kind: 'frame',
            frame: {
              title: 'Portal del planner · ediciones',
              rows: ['Rosa Delgado → mesa 4 (era 7)', 'Diego Morales → menú vegetariano', 'Nota: contactar a Rosa vía el planner'],
            },
          },
          {
            kind: 'diff',
            card: {
              title: 'Solicitud de cambio de tu planner',
              lines: ['Rosa Delgado: mesa 7 → mesa 4', 'Diego Morales: nota de dieta: vegetariano', 'Rosa Delgado: nota de contacto agregada'],
              confirm: 'Aprobar todo',
              cancel: 'Descartar',
              done: 'Aprobado. Tres cambios aplicados con un toque.',
            },
          },
          { kind: 'note', text: 'Los teléfonos y correos de tus invitados nunca llegan al planner.' },
        ],
        endNote: 'Una aprobación aplica el lote completo.',
        caption: { text: 'Mira el portal del planner', href: '#platform=planner' },
      },
      {
        id: 'budget',
        label: 'Una foto se vuelve tu presupuesto',
        timeLabel: 'Jueves · 6:20 PM',
        hook: 'Tu vieja planilla, fotografiada, leída e importada.',
        steps: [
          { kind: 'frame', frame: { title: 'presupuesto-2026.xlsx · foto', rows: ['Una foto del presupuesto impreso, tomada en la mesa de la cocina'] } },
          {
            kind: 'frame',
            frame: {
              title: 'Leyendo las líneas',
              rows: ['Anticipo del lugar · 12,000.00', 'Catering, por plato · 89.50', 'Flores, arco de ceremonia · 1,450.00', '106 filas más detectadas'],
            },
          },
          {
            kind: 'confirm',
            card: {
              title: 'Importación propuesta',
              lines: ['109 líneas encontradas', 'Total general 285,545.06, cuadrado al centavo', 'Nada se guarda hasta que apruebes'],
              confirm: 'Importar todo',
              cancel: 'Cancelar',
              done: 'Importado. 109 líneas, totales cuadrados al centavo.',
            },
          },
          { kind: 'note', text: 'Revisas cada línea antes de que algo se guarde.' },
        ],
        endNote: 'Tu planilla de siempre, importada y entendida.',
        caption: { text: 'Mira el presupuesto', href: '#platform=budget' },
      },
    ],
  },

  channels: {
    no: '№ 03',
    kicker: 'Tus invitados eligen su canal',
    title: 'Un solo cerebro.\nTodos los canales.',
    intro: 'Tus invitados no descargan nada. Preguntan donde ya conversan y reciben la misma respuesta en todos lados.',
    liveLabel: 'Activo',
    soonLabel: 'Muy pronto',
    cards: [
      {
        id: 'web',
        name: 'Chat web',
        status: 'live',
        caption: 'Un chat elegante en la página de la boda. Cualquier navegador, nada que instalar.',
        fact: 'Activo para una boda real de noviembre 2026: más de 100 mensajes reales respondidos.',
        script: [
          { from: 'guest', text: '¿A qué hora es la ceremonia?' },
          { from: 'ai', text: 'La ceremonia empieza a las 4:00 PM en punto en el pabellón del jardín. Las puertas abren a las 3:30 PM.' },
        ],
      },
      {
        id: 'whatsapp',
        name: 'WhatsApp',
        status: 'live',
        caption: 'Un número dedicado a tu boda. Tus invitados completan su RSVP entero en el chat, por persona.',
        script: [
          { from: 'guest', text: 'rsvp' },
          { from: 'ai', text: '¡Con gusto! Tu invitación cubre a Ana Torres y Luis Torres. ¿Ana asiste a la ceremonia?' },
          { from: 'guest', text: 'Sí, los dos, a ambos eventos' },
          { from: 'ai', text: 'Perfecto. Ana y Luis confirmados para ceremonia y recepción. ¿Algo que debamos saber sobre la comida?' },
        ],
      },
      {
        id: 'sms',
        name: 'SMS',
        status: 'soon',
        caption: 'En el plan de ruta. Aún no activo. Web y WhatsApp llevan cada boda hoy.',
        script: [],
      },
      {
        id: 'telegram',
        name: 'Telegram',
        status: 'soon',
        caption: 'En el plan de ruta. Aún no activo. Web y WhatsApp llevan cada boda hoy.',
        script: [],
      },
    ],
    languages: {
      headline: 'Entiende más de 30 idiomas, perfeccionado en inglés y español.',
      chips: [
        { id: 'en', label: 'English', starred: true, q: 'What\u2019s the dress code?', a: 'Black tie optional. Formal attire is encouraged.' },
        { id: 'es', label: 'Español', starred: true, q: '¿Cuál es el código de vestimenta?', a: 'Black tie opcional. Se recomienda vestimenta formal.' },
        { id: 'pt', label: 'Português', q: 'Qual é o traje?', a: 'Black tie opcional. Traje formal é recomendado.' },
        { id: 'fr', label: 'Français', q: 'Quel est le code vestimentaire ?', a: 'Tenue de soirée facultative. Une tenue habillée est recommandée.' },
        { id: 'de', label: 'Deutsch', q: 'Wie ist der Dresscode?', a: 'Black Tie optional. Festliche Kleidung wird empfohlen.' },
        { id: 'it', label: 'Italiano', q: 'Qual è il dress code?', a: 'Black tie facoltativo. Si consiglia un abito elegante.' },
        { id: 'zh', label: '中文', q: '婚礼的着装要求是什么？', a: '黑领结可选，建议正式着装。' },
      ],
      moreLabel: '+ más',
      footnote: '✦ el par perfeccionado. Los demás idiomas se responden con el mejor esfuerzo de la misma IA.',
    },
    intlGuide: {
      title: 'La guía del invitado internacional',
      hint: 'Mira qué cubre',
      items: [
        { title: 'Visas', body: 'Quién necesita una, quién no, y dónde verificarlo, según los datos de la pareja.' },
        { title: 'Moneda', body: 'Con qué pagar, dónde cambiar y cuánto dejar de propina.' },
        { title: 'Clima', body: 'Cómo es la temporada de verdad y qué empacar.' },
        { title: 'Cómo moverse', body: 'Traslados del aeropuerto, shuttles, apps y consejos de taxi.' },
      ],
      closing: 'Todo respondido con los datos de la pareja, en el idioma del invitado.',
      scenarioLink: { label: 'Reproduce el escenario de las 2:07 AM', href: '#scenarios=abroad' },
    },
  },

  platform: {
    no: '№ 04',
    kicker: 'Dentro de la plataforma',
    title: 'Toda tu boda.\nUn portal.',
    intro: 'Esto es app.guest-ly.com en miniatura. Toca y explora: todo lo que ves está vivo en el producto real hoy.',
    windowLabel: 'app.guest-ly.com',
    items: [
      {
        id: 'dashboard',
        menuLabel: 'Panel',
        title: 'Panel en vivo',
        blurb: 'Cada pregunta, tema y vacío, de un vistazo.',
        facts: [
          'Preguntas clasificadas por tema, cada hora',
          'Vacíos marcados cuando el asistente no pudo responder',
          'Insignias de sentimiento destacan invitados frustrados',
          'Un resumen bilingüe semanal llega a tu correo',
        ],
        microCta: 'Convierte el vacío en respuesta',
        microDone: 'Convertido en respuesta. El asistente ya lo sabe.',
      },
      {
        id: 'guests',
        menuLabel: 'Invitados y RSVPs',
        title: 'Lista de invitados y tablero de RSVPs',
        blurb: 'Una sola lista limpia que alimenta todo lo demás.',
        facts: [
          'RSVP por persona y por evento: los conteos cuentan personas',
          'Importa desde CSV, Excel o Zola',
          'Sincronización con Zola: 46 RSVPs reales migrados sin conflictos',
          'Exportes .xlsx con tu marca y nueve presets',
        ],
        wow: 'Un export real de Zola con 401 personas: 359 emparejadas automáticamente.',
        microCta: 'Toca una fila',
        microDone: 'La ficha del invitado se abre donde aparezca su nombre: unas 30 pantallas.',
      },
      {
        id: 'broadcasts',
        menuLabel: 'Difusiones',
        title: 'Escríbele a los invitados correctos',
        blurb: 'A todos, a un grupo, o solo a los que no responden.',
        facts: [
          'Filtros de audiencia: estado de RSVP, evento, idioma',
          'Cada invitado recibe el mensaje en su propio idioma',
          'Recordatorios bilingües programados',
          'Estadísticas de entrega y lectura',
        ],
        microCta: 'Filtrar: sin respuesta',
        microDone: 'Audiencia actualizada: 37 invitados, cada uno en su idioma.',
      },
      {
        id: 'seating',
        menuLabel: 'Mesas',
        title: 'Planificador de mesas',
        blurb: 'De una foto del plano a una hoja de asientos lista para imprimir.',
        facts: [
          'La IA lee las mesas desde una foto del plano del lugar',
          'Arrastra mesas, sienta por familia o etiquetas',
          'La asignación automática nunca separa un grupo',
          'Hoja de asientos imprimible',
        ],
        wow: 'Lee el plano directo desde una foto.',
        microCta: 'Asignar automáticamente',
        microDone: 'Sentados. Ningún grupo separado.',
      },
      {
        id: 'budget',
        menuLabel: 'Presupuesto',
        title: 'Presupuesto con importación IA',
        blurb: 'Todo tu presupuesto, compartido con tu planner.',
        facts: [
          'Líneas anidadas con pagos fechados',
          'Quién pagó, qué es reembolsable, totales por mes',
          'Importa desde Excel, texto pegado o una foto',
          'El único lugar donde tu planner edita directamente',
        ],
        wow: 'Una planilla real de 109 líneas importada: total 285,545.06, cuadrado al centavo.',
        microCta: 'Importar una planilla',
        microDone: 'Primero la revisión: nada se escribe hasta que apruebes.',
      },
      {
        id: 'brain',
        menuLabel: 'Wedding Brain',
        title: 'Todo lo que sabe tu asistente',
        blurb: 'Edita, prueba, publica. El bot en vivo se actualiza en un minuto.',
        facts: [
          'Publicar actualiza el asistente en vivo en un minuto',
          'Cada versión guardada, restaurar con un click',
          'Pregúntale a tu bot en vivo desde el portal',
          'Conversaciones completas con búsqueda, temas y vacíos',
        ],
        microCta: 'Publicar v12',
        microDone: 'v12 en vivo. El asistente ya responde con ella.',
      },
      {
        id: 'planner',
        menuLabel: 'Planner',
        title: 'Un portal para tu planner',
        blurb: 'Ellos gestionan. Tú apruebas. Los contactos quedan privados.',
        facts: [
          'Portal filtrado: sin teléfonos ni correos de invitados',
          'Sus ediciones se vuelven solicitudes que tú apruebas',
          'Tablero de tareas y métricas compartidos',
          'Historial de difusiones en solo lectura, con pedir-recordatorio',
        ],
        wow: 'Hasta 50 invitados editados en línea, aprobados con un click.',
        microCta: 'Enviar solicitud',
        microDone: 'Enviado a la pareja: todo el cambio, aprobado con un click.',
        link: { label: 'Reproduce el escenario del planner', href: '#scenarios=planner' },
      },
      {
        id: 'checkin',
        menuLabel: 'El gran día',
        title: 'Pases QR y check-in',
        blurb: 'Una puerta tranquila el gran día.',
        facts: [
          'Pases QR imprimibles por invitado',
          'Escaneo con cámara y búsqueda por nombre',
          'Contadores en vivo y deshacer',
        ],
        microCta: 'Escanear un pase',
        microDone: 'Registrado. Contador: 86 → 87.',
      },
    ],
  },

  coordinator: {
    no: '№ 05',
    badge: 'Coordinador IA',
    title: 'Cuéntale qué pasó.\nAprueba lo que propone.',
    intro: 'Un asistente en lenguaje natural que lee tu boda y redacta el cambio exacto. Nada se escribe hasta que confirmas.',
    disclaimer: 'Ejemplo guionado. El Coordinador real funciona con tu lista de invitados.',
    scripts: [
      {
        id: 'import',
        label: 'Suelta una planilla',
        timeLabel: 'invitados.xlsx · 18 KB',
        hook: 'Un archivo se vuelve una lista limpia.',
        steps: [
          { kind: 'couple', text: 'invitados.xlsx' },
          { kind: 'typing' },
          { kind: 'ai', text: 'Leí 45 filas. 42 parecen invitados nuevos, 3 ya están en tu lista. Esta es la importación que haría.' },
          {
            kind: 'confirm',
            card: {
              title: 'Importación propuesta',
              lines: ['Agregar 42 invitados', 'Omitir 3 duplicados', 'Columnas mapeadas: nombre, grupo, teléfono, lado'],
              confirm: 'Confirmar',
              cancel: 'Cancelar',
              done: 'Listo. 42 invitados importados a tu lista.',
            },
          },
        ],
        endNote: 'Suelta una planilla en el chat y te propone la importación exacta para confirmar.',
      },
      {
        id: 'marco',
        label: 'Marco me avisó que no puede venir',
        timeLabel: 'Una frase basta',
        hook: 'Ediciones de invitados en lenguaje natural.',
        steps: [
          { kind: 'couple', text: 'Marco me avisó que no puede venir.' },
          { kind: 'typing' },
          { kind: 'ai', text: 'Marco Rossi, grupo Rossi, confirmado para ceremonia y recepción. ¿Lo marco como no asiste en ambos?' },
          {
            kind: 'confirm',
            card: {
              title: 'Cambio propuesto',
              lines: ['Marco Rossi: no asiste, ambos eventos', 'Los conteos se actualizan automáticamente'],
              confirm: 'Confirmar',
              cancel: 'Cancelar',
              done: 'Listo. Marco actualizado. La recepción ahora cuenta 121.',
            },
          },
        ],
        endNote: 'Nada se escribe sin tu click.',
      },
      {
        id: 'remind',
        label: 'Recuérdales a los que no respondieron',
        timeLabel: 'Una frase basta',
        hook: 'Un recordatorio bilingüe exactamente a quien corresponde.',
        steps: [
          { kind: 'couple', text: 'Recuérdales a los que aún no responden.' },
          { kind: 'typing' },
          { kind: 'ai', text: '37 invitados no han respondido y tienen teléfono registrado. Este es el recordatorio que enviaría, en el idioma de cada uno.' },
          {
            kind: 'confirm',
            card: {
              title: 'Difusión propuesta',
              lines: ['Audiencia: sin respuesta, con teléfono (37)', 'Mensaje: recordatorio bilingüe de RSVP', 'Se envía en el idioma de cada invitado'],
              confirm: 'Confirmar',
              cancel: 'Cancelar',
              done: 'En cola. 37 recordatorios, cada uno en el idioma del invitado.',
            },
          },
        ],
        endNote: 'Filtros de audiencia, idiomas por lote, estadísticas de entrega. Todo desde una frase.',
      },
      {
        id: 'export',
        label: 'Exporta la lista final para el catering',
        timeLabel: 'Una frase basta',
        hook: 'El preset correcto, filtrado y con tu marca.',
        steps: [
          { kind: 'couple', text: 'Exporta la lista final para el catering.' },
          { kind: 'typing' },
          { kind: 'ai', text: 'Usaría el preset Catering: filas por persona, respuestas de dieta, números de mesa. Datos de contacto filtrados.' },
          {
            kind: 'confirm',
            card: {
              title: 'Exportación propuesta',
              lines: ['Preset: Catering', 'Modo por persona: grupos expandidos', 'Datos de contacto filtrados'],
              confirm: 'Confirmar',
              cancel: 'Cancelar',
              done: 'Listo. Tu .xlsx con tu marca está listo.',
            },
          },
        ],
        endNote: 'Nueve presets, un click, siempre con tu marca.',
      },
    ],
    capsTitle: 'Todo lo que puede hacer hoy',
    caps: [
      'Ediciones de invitados y RSVPs',
      'Ediciones por lote de hasta 50 invitados',
      'Recordatorios y difusiones',
      'Importación de CSV y Excel directo a la lista',
      'Actualizaciones de RSVP en masa',
      'Exportes con tu marca',
      'Manejo de escalaciones',
    ],
    capsClosing: 'Cada acción tiene su propio interruptor de permiso.',
    priceLine: 'Incluido en Grande. O agrégalo a cualquier plan: $79 una vez o $19 al mes.',
    cta: 'Obtener mi asistente',
    seePricing: 'Ver precios',
  },

  compare: {
    no: '№ 07',
    toggle: 'Cómo se compara Guest-ly',
    hint: 'Vino, Daisy Chat, GuestBook, Zola y The Knot',
    sub: 'Para una boda de unos 150 invitados.',
    rows: ['Asistente en WhatsApp', 'Bilingüe ES/EN', 'RSVP por persona', 'Página de boda', 'Difusiones', 'Check-in con QR'],
    priceLabel: 'Precio',
    includedSr: 'Incluido',
    notIncludedSr: 'No incluido',
    footnote: 'Precios públicos según cada proveedor, mediados de 2026.',
    zolaLine: 'Conserva Zola. Nos sincronizamos: 46 RSVPs reales migrados sin conflictos.',
    columns: [
      { id: 'guestly', name: 'Guest-ly', sub: 'Plan Signature', price: '$399 una vez', marks: ['yes', 'yes', 'yes', 'yes', 'yes', 'yes'], highlight: true },
      { id: 'vino', name: 'Vino', sub: 'Sin chat web', price: '$2,499', marks: ['yes', 'yes', 'no', 'no', 'yes', 'no'] },
      { id: 'daisy', name: 'Daisy Chat', sub: 'Solo SMS', price: '$125 a $175', marks: ['no', 'no', 'no', 'no', 'yes', 'no'] },
      { id: 'guestbook', name: 'GuestBook', sub: 'Solo chat web', price: '$10 a $99/mes', marks: ['no', 'no', 'no', 'no', 'no', 'no'] },
      { id: 'zola', name: 'Zola / The Knot', sub: 'Sin IA, sin WhatsApp', price: 'Gratis', marks: ['no', 'no', 'yes', 'yes', 'yes', 'no'] },
    ],
  },

  pricing: {
    no: '№ 08',
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
    fullListLabel: 'Mira todo lo incluido',
    fullLists: {
      essentials: [
        'Asistente IA en web + WhatsApp, perfeccionado en ES/EN',
        'Página de boda bilingüe + RSVP guiado',
        'Lista de invitados con grupos y etiquetas',
        'Importa desde CSV, Excel o Zola',
        'Panel, conversaciones y alertas de vacíos',
        '4 difusiones incluidas',
        'Presupuesto con importación IA',
        'Planificador de mesas',
        'Notificaciones por correo',
      ],
      signature: [
        'Todo lo de Essentials',
        'RSVP por persona y por evento',
        'Difusiones ilimitadas y recordatorios programados',
        'Pases QR + consola de check-in el gran día',
        'Sincronización de RSVPs con Zola',
        'Exportes .xlsx con tu marca, nueve presets',
        'Soporte prioritario',
      ],
      grande: [
        'Todo lo de Signature',
        'Coordinador IA incluido',
        'Importación y configuración hechas por nosotros',
        'Lugar para tu planner: portal filtrado, solicitudes y aprobaciones',
      ],
    },
    channelsFootnote: 'Los canales de SMS y Telegram llegan pronto y se sumarán cuando estén activos.',
    coordLink: 'Míralo en acción',
    compareLink: 'Mira cómo se compara',
  },

  founding: {
    no: '№ 09',
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
    no: '№ 10',
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
        q: '¿Qué idiomas habla, y en qué canales?',
        a: 'Entiende más de 30 idiomas, perfeccionado en inglés y español. Chat web y WhatsApp están activos hoy; SMS y Telegram llegan pronto.',
      },
      {
        q: '¿Cuándo llegan SMS y Telegram?',
        a: 'Están en el plan de ruta y se anunciarán cuando estén activos. Web y WhatsApp llevan cada boda hoy.',
      },
      {
        q: '¿Qué puede ver mi wedding planner?',
        a: 'Un portal filtrado sin teléfonos ni correos de invitados. Sus ediciones se vuelven solicitudes que apruebas con un click; el presupuesto es el único lugar donde edita directamente.',
      },
      {
        q: 'Ya juntamos RSVPs en Zola. ¿Los perdemos?',
        a: 'No. Nos sincronizamos con Zola: una lista real de 46 RSVPs migró sin conflictos. Conserva Zola si te gusta.',
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
        { label: 'Míralo pasar', href: '#scenarios' },
        { label: 'Plataforma', href: '#platform' },
        { label: 'Coordinador', href: '#coordinator' },
        { label: 'Comparar', href: '#compare' },
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
        { title: 'Confirmamos tu cotización por email', body: 'Respondes para reservar tu lugar. Contestamos en menos de 2 horas en horario laboral.' },
        { title: 'Te enviamos el formulario', body: 'Un formulario de 15 minutos con todo lo que tu bot necesita.' },
        { title: 'Construimos tu bot (~7 días)', body: 'Entrenamiento de IA, configuración de canales, diseño: nos encargamos de todo.' },
        { title: 'Pruebas, apruebas y compartes', body: 'Tus invitados reciben una experiencia de asistente 24/7.' },
      ],
      payCta: 'Pagar {price} de forma segura →',
      payNoteLinked: 'Checkout seguro con Stripe. Tu lugar queda reservado en cuanto se procesa el pago.',
      payNoteFallback: 'Te enviaremos un link de pago seguro de Stripe a {email} en menos de 2 horas para reservar tu lugar.',
      emailCta: 'Escríbenos para completar tu pedido →',
      emailNote: 'Confirmamos tu cotización y reservamos tu lugar por email, normalmente en unas horas.',
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
              'Guest-ly es operado por ZC Ventures LLC. Contacto: nicolas@guest-ly.com.',
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

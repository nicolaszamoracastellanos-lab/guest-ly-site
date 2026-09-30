// Guest-ly App Store set v2: panel copy and layout. Coordinates are px inside a
// 1320 x 2868 panel. Every screen is a real capture of app 1.1 (see README);
// every callout is cut from one of those captures by tools/prepare.py.
//
// device: { screen, x, y, w (screen width px), rot }
// callout from its own place in the device: { img, from: deviceIndex, k (scale vs the
//   device), dx, dy, rot }  or placed freely: { img, x, y, w, rot }

window.BACKDROPS = [
  // strip coords; panels are 1320 wide. pos = object-position
  { img: "table-vineyard.jpg", from: 0, to: 3, h: 2150, pos: "50% 30%", dim: 0.6 },
  { img: "courtyard-night.jpg", from: 3, to: 6, h: 2150, pos: "50% 40%", dim: 0.62 },
  { img: "candles-still.jpg", from: 6, to: 8, h: 2150, pos: "38% 50%", dim: 0.62 },
  { img: "valley-dusk.jpg", from: 8, to: 10, h: 2150, pos: "60% 50%", dim: 0.72 },
];

const D = (screen, extra = {}) => ({ screen, x: 160, y: 760, w: 1000, rot: 0, ...extra });

window.PANELS = [
  {
    id: "01-hook",
    hook: true,
    title: { en: "Every guest.<br>Every answer.", es: "Cada invitado.<br>Cada respuesta." },
    sub: {
      en: "Invitations, RSVPs and an AI concierge for your wedding.",
      es: "Invitaciones, confirmaciones y un concierge con IA para tu boda.",
    },
    devices: [D("guest-home", { x: 330, y: 1010, w: 900, rot: -5, fade: 1670 })],
    callouts: [
      { img: "question-shuttle", x: 430, y: 2215, w: 740, rot: -2 },
      { img: "answer-shuttle", x: 40, y: 2440, w: 830, rot: 1.5 },
    ],
  },
  {
    id: "02-rsvp",
    eyebrow: { en: "For guests", es: "Para invitados" },
    title: { en: "RSVP for<br>the whole party", es: "Confirma por<br>todo tu grupo" },
    sub: {
      en: "Answer for each person and each event. Change it any time.",
      es: "Responde por cada persona y cada evento. Cámbialo cuando quieras.",
    },
    devices: [D("rsvp", { x: 60, soft: (l) => (l === "es" ? [[1760, 2250]] : [[2180, 2600]]) })],
    callouts: [{ img: "rsvp-grant", from: 0, k: 1.16, dx: 55, dy: 10, rot: -2.5 }],
  },
  {
    id: "03-concierge",
    eyebrow: { en: "For guests", es: "Para invitados" },
    title: { en: "Ask anything.<br>Get answers.", es: "Pregunta<br>lo que quieras" },
    sub: {
      en: "An AI concierge that knows the wedding: parking, hotels, dress code, the shuttle.",
      es: "Un concierge con IA que conoce la boda: estacionamiento, hoteles, vestimenta y más.",
    },
    devices: [D("concierge", { x: 260, soft: [[1400, 2110]] })],
    callouts: [{ img: "answer-parking", from: 0, k: 1.28, dx: -70, dy: 53, rot: -2.5 }],
  },
  {
    id: "04-couple-replies",
    eyebrow: { en: "For guests", es: "Para invitados" },
    title: { en: "Straight to<br>the couple", es: "Directo a<br>los novios" },
    sub: {
      en: "What only the couple can answer reaches them, and their reply lands in your app.",
      es: "Lo que solo la pareja puede responder les llega, y su respuesta vuelve a tu app.",
    },
    devices: [D("messages", { soft: [[225, 2500]] })],
    callouts: [
      { img: "guest-question", from: 0, k: 1.22, dx: 55, dy: -10, rot: 2 },
      { img: "couple-reply", from: 0, k: 1.26, dx: -40, dy: 10, rot: -2 },
    ],
  },
  {
    id: "05-day-of",
    eyebrow: { en: "On the day", es: "El gran día" },
    title: { en: "Where to be,<br>right now", es: "Dónde estar,<br>ahora mismo" },
    sub: {
      en: "What's next, how to get there, the shuttle and the dress code.",
      es: "Qué sigue, cómo llegar, el transporte y qué ponerte.",
    },
    devices: [D("dayof", { x: 170, y: 790, rot: 4, soft: [[1680, 2420]] })],
    callouts: [{ img: "getting-there", from: 0, k: 1.16, dx: -30, dy: 30, rot: -2 }],
  },
  {
    id: "06-rsvps",
    theme: "ivory",
    eyebrow: { en: "For couples", es: "Para parejas" },
    title: { en: "Every RSVP<br>as it lands", es: "Cada confirmación,<br>al instante" },
    sub: {
      en: "See who's coming, who can't make it and who still has to answer.",
      es: "Ve quién viene, quién no puede y quién falta por responder.",
    },
    devices: [D("rsvps", { soft: [[1040, 1225]] })],
    callouts: [
      { img: "rsvp-stats", from: 0, k: 1.2, dx: 0, dy: 40, rot: -1.5 },
    ],
  },
  {
    id: "07-seating",
    eyebrow: { en: "For couples", es: "Para parejas" },
    title: { en: "Seat everyone,<br>table by table", es: "Sienta a todos,<br>mesa por mesa" },
    sub: {
      en: "Seated, unseated and free seats at a glance, with a suggested plan.",
      es: "Sentados, sin asiento y lugares libres de un vistazo, con una propuesta de mesas.",
    },
    devices: [D("seating", { x: 380, y: 780, w: 900 })],
    callouts: [
      { img: "seat-stat-0", x: 30, y: 1230, w: 400, rot: -3 },
      { img: "seat-stat-1", x: 40, y: 1555, w: 400, rot: 0 },
      { img: "seat-stat-2", x: 30, y: 1880, w: 400, rot: 3 },
    ],
  },
  {
    id: "08-check-in",
    eyebrow: { en: "On the day", es: "El gran día" },
    title: { en: "Check-in<br>at the door", es: "Registro<br>en la puerta" },
    sub: {
      en: "Scan a guest pass or type a name. It works even without signal.",
      es: "Escanea el pase o escribe un nombre. Funciona incluso sin señal.",
    },
    devices: [D("checkin", { x: 150, y: 800, rot: -4 })],
    callouts: [{ img: "checkin-card", x: 70, y: 2030, w: 1180, rot: 2 }],
  },
  {
    id: "09-planners",
    theme: "ivory",
    eyebrow: { en: "For planners", es: "Para planners" },
    title: { en: "Planners propose.<br>Couples approve.", es: "Tú propones.<br>La pareja aprueba." },
    sub: {
      en: "Every wedding you run in one place: guest lists, requests and tasks.",
      es: "Todas tus bodas en un solo lugar: invitados, solicitudes y tareas.",
    },
    devices: [D("couple-request", { x: 260 })],
    callouts: [{ img: "planner-card", x: 40, y: 2350, w: 1000, rot: -3 }],
  },
  {
    id: "10-start",
    closing: true,
    title: { en: "Your wedding,<br>set up in minutes", es: "Tu boda,<br>lista en minutos" },
    sub: {
      en: "Create your account in the app. In English and Spanish.",
      es: "Crea tu cuenta desde la app. En español e inglés.",
    },
    devices: [D("signup", { x: 160, y: 930, w: 1000 })],
    callouts: [
      { img: "signup-apple", from: 0, k: 1.2, dx: -70, dy: -10, rot: -2 },
      { img: "signup-google", from: 0, k: 1.2, dx: 70, dy: 20, rot: 1.5 },
    ],
  },
];

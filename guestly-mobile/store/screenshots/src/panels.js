// Guest-ly App Store set v3 (app 1.2.0, build 13): panel copy and layout.
// Coordinates are px inside a 1320 x 2868 panel. Every screen is a capture of
// the 1.2.0 Release build (see README); every callout is cut from one of those
// captures by tools/prepare.py.
//
// device: { screen, x, y, w (screen width px), rot, soft, fade }
//   soft: bands in native screen px, [y0, y1] full width or [x0, y0, x1, y1];
//         may be a function of the language.
// callout from its own place in the device: { img, from: deviceIndex, k (scale vs the
//   device), dx, dy, rot }  or placed freely: { img, x, y, w, rot }

window.BACKDROPS = [
  // strip coords; panels are 1320 wide. pos = object-position
  { img: "table-vineyard.jpg", from: 0, to: 3, h: 2150, pos: "50% 30%", dim: 0.6 },
  { img: "courtyard-night.jpg", from: 3, to: 5, h: 2150, pos: "50% 40%", dim: 0.62 },
  { img: "candles-still.jpg", from: 5, to: 8, h: 2150, pos: "38% 50%", dim: 0.62 },
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
    devices: [D("guest-home", { x: 330, y: 1010, w: 900, rot: -5, fade: 1615 })],
    callouts: [
      { img: "question-shuttle", x: 420, y: 2210, w: 760, rot: -2 },
      { img: "answer-shuttle", x: 40, y: 2420, w: 860, rot: 1.5 },
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
    devices: [D("rsvp", { x: 60, soft: [[2110, 2640]] })],
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
    devices: [D("concierge", { x: 260, soft: (l) => (l === "es" ? [[412, 562], [1540, 2250]] : [[412, 700], [1540, 2250]]) })],
    callouts: [{ img: "answer-parking", from: 0, k: 1.24, dx: -70, dy: 20, rot: -2.5 }],
  },
  {
    id: "04-day-of",
    eyebrow: { en: "On the day", es: "El gran día" },
    title: { en: "Where to be,<br>right now", es: "Dónde estar,<br>ahora mismo" },
    sub: {
      en: "What's next, how to get there, the shuttle and the dress code.",
      es: "Qué sigue, cómo llegar, el transporte y qué ponerte.",
    },
    // Out of focus: the clock in the top row (the real time of the capture, past
    // midnight), the event note (demo data with a sentence pasted into it) and, in
    // Spanish, the Getting there and Dress code cards (the demo data is English only).
    devices: [D("dayof", { x: 170, y: 790, rot: 4, soft: (l) => [[150, 250, "light"], [805, 1050, "light"], ...(l === "es" ? [[1645, 2340]] : [])] })],
    callouts: [{ img: "schedule", from: 0, k: 1.14, dx: -30, dy: -12, rot: -2 }],
  },
  {
    id: "05-rsvps",
    theme: "ivory",
    eyebrow: { en: "For couples", es: "Para parejas" },
    title: { en: "Every RSVP<br>as it lands", es: "Cada confirmación,<br>al instante" },
    sub: {
      en: "See who's coming, who can't make it and who still has to answer.",
      es: "Ve quién viene, quién no puede y quién falta por responder.",
    },
    devices: [D("guests", { soft: [[1585, 2868]] })],
    callouts: [{ img: "rsvp-stats", x: 40, y: 2120, w: 1240, rot: -1.5 }],
  },
  {
    id: "06-broadcast",
    eyebrow: { en: "For couples", es: "Para parejas" },
    title: { en: "Message every<br>guest on WhatsApp", es: "Avisa a todos<br>por WhatsApp" },
    sub: {
      en: "Approved templates and a preview of every message, in each guest's language.",
      es: "Plantillas aprobadas y una vista previa de cada mensaje, en el idioma de cada invitado.",
    },
    // Demo guests have no phone numbers: the recipient counts, the no-phone note
    // and the disabled Send are kept out of focus.
    devices: [
      D("broadcast", {
        soft: (l) => (l === "es" ? [[640, 780], [1180, 1345], [1480, 1640], [2232, 2640]] : [[1180, 1350], [1500, 1652], [2180, 2640]]),
      }),
    ],
    callouts: [
      { img: "template-chips", from: 0, k: 1.22, dx: 0, dy: 0, rot: -2 },
      { img: "message-preview", from: 0, k: 1.14, dx: 10, dy: 40, rot: 1.5 },
    ],
  },
  {
    id: "07-tools",
    eyebrow: { en: "For couples", es: "Para parejas" },
    title: { en: "Every tool<br>in one place", es: "Todo en<br>un solo lugar" },
    sub: {
      en: "Your wedding site, budget, tasks, seating and an AI coordinator.",
      es: "Tu sitio de boda, presupuesto, tareas, mesas y un coordinador con IA.",
    },
    devices: [D("tools", { soft: [[2210, 2640]] })],
    callouts: [
      { img: "tool-budget", from: 0, k: 1.3, dx: 70, dy: -30, rot: 3 },
      { img: "tool-tasks", from: 0, k: 1.3, dx: -70, dy: 40, rot: -3 },
    ],
  },
  {
    id: "08-seating",
    eyebrow: { en: "For couples", es: "Para parejas" },
    title: { en: "Seat everyone,<br>table by table", es: "Sienta a todos,<br>mesa por mesa" },
    sub: {
      en: "Seated, unseated and free seats at a glance, with a suggested plan.",
      es: "Sentados, sin asiento y lugares libres de un vistazo, con una propuesta de mesas.",
    },
    devices: [D("seating", { x: 380, y: 780, w: 900, soft: [[860, 585, 1270, 875]] })],
    callouts: [
      { img: "seat-stat-0", x: 30, y: 1300, w: 420, rot: -3 },
      { img: "seat-stat-1", x: 40, y: 1660, w: 420, rot: 2 },
    ],
  },
  {
    id: "09-check-in",
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
    id: "10-planners",
    theme: "ivory",
    eyebrow: { en: "For planners", es: "Para planners" },
    title: { en: "Planners propose.<br>Couples approve.", es: "Tú propones.<br>La pareja aprueba." },
    sub: {
      en: "Every wedding you run in one place: guest lists, requests and tasks.",
      es: "Todas tus bodas en un solo lugar: invitados, solicitudes y tareas.",
    },
    // ES: the planner's note and the reply were typed in English; out of focus.
    devices: [D("couple-request", { x: 260, soft: (l) => (l === "es" ? [[845, 1035], [1440, 1615], [2030, 2868]] : [[2030, 2868]]) })],
    callouts: [{ img: "planner-card", x: 40, y: 2350, w: 1000, rot: -3 }],
  },
];

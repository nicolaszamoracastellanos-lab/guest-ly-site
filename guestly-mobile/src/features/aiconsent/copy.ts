// Apple 5.1.2(i) consent sheet, EN and neutral LatAm ES (tú). Each kind of
// sharing names the company that receives the data, what is sent and why,
// before the first use, with a plain way to say no. Keep it true: the voice
// text matches the portal's voice path (recording and the provider's copy are
// deleted once the text is read, lib/meeting-audio-server.ts pollTranscription).

const en = {
  sentTo: "Sent to",
  whatIsSent: "What is sent",
  whatFor: "What it is for",
  allow: "Allow and continue",
  decline: "Not now",
  notSent: "Nothing was sent. You can allow it the next time you use it.",
  privacy: "Read the privacy policy",
  coordinator: {
    title: "Before you use the Coordinator",
    intro: "The Coordinator is an AI assistant run by another company. Your permission is needed before anything is sent to it.",
    who: "Anthropic, the company behind the Claude AI model.",
    what: "Your messages and the details of this wedding the chat reads to answer you: guest names and replies, the runsheet, vendors, tasks and budget lines.",
    why: "To write each reply and to prepare the changes you confirm. Nothing changes in your wedding until you tap to confirm.",
  },
  brief: {
    title: "Before you write a recap",
    intro: "The recap at the top of the brief is written by an AI model run by another company. Your permission is needed before anything is sent to it.",
    who: "Anthropic, the company behind the Claude AI model.",
    what: "The figures in this brief: the wedding's status, replies, open decisions, payments due and vendors.",
    why: "To write a short recap around those figures. Every figure in the brief comes from the wedding's data, never from the AI.",
  },
  voice: {
    title: "Before you use the microphone",
    intro: "Your voice note becomes text through a speech service run by another company. Your permission is needed before a recording is sent to it.",
    who: "AssemblyAI, a speech-to-text service.",
    what: "The recording you make after tapping the mic. Nothing records at any other time.",
    why: "To turn it into text in your message box. You read the text and decide whether to send it. The recording and the service's copy are deleted once the text is ready.",
  },
};

const es: typeof en = {
  sentTo: "Se envía a",
  whatIsSent: "Qué se envía",
  whatFor: "Para qué",
  allow: "Permitir y continuar",
  decline: "Ahora no",
  notSent: "No se envió nada. Puedes permitirlo la próxima vez que lo uses.",
  privacy: "Leer la política de privacidad",
  coordinator: {
    title: "Antes de usar el Coordinador",
    intro: "El Coordinador es un asistente de IA de otra empresa. Necesitamos tu permiso antes de enviarle algo.",
    who: "Anthropic, la empresa del modelo de IA Claude.",
    what: "Tus mensajes y los datos de esta boda que el chat lee para responderte: nombres y respuestas de los invitados, el cronograma, proveedores, tareas y líneas del presupuesto.",
    why: "Para escribir cada respuesta y preparar los cambios que confirmes. Nada cambia en tu boda hasta que tocas para confirmar.",
  },
  brief: {
    title: "Antes de redactar la síntesis",
    intro: "La síntesis al inicio del resumen la escribe un modelo de IA de otra empresa. Necesitamos tu permiso antes de enviarle algo.",
    who: "Anthropic, la empresa del modelo de IA Claude.",
    what: "Las cifras de este resumen: el estado de la boda, las respuestas, las decisiones pendientes, los pagos por vencer y los proveedores.",
    why: "Para escribir una síntesis breve con esas cifras. Cada cifra del resumen sale de los datos de la boda, nunca de la IA.",
  },
  voice: {
    title: "Antes de usar el micrófono",
    intro: "Tu nota de voz se convierte en texto con un servicio de otra empresa. Necesitamos tu permiso antes de enviarle una grabación.",
    who: "AssemblyAI, un servicio que convierte voz en texto.",
    what: "La grabación que haces después de tocar el micrófono. Nunca graba en otro momento.",
    why: "Para convertirla en texto en tu cuadro de mensaje. Tú lees el texto y decides si lo envías. La grabación y la copia del servicio se borran en cuanto el texto está listo.",
  },
};

export const CONSENT_COPY = { en, es };
export type ConsentCopy = typeof en;

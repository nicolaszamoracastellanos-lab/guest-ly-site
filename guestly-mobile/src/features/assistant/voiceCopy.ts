// D5 mic copy, EN and neutral LatAm ES (tú). Errors say what failed and what
// to do; the keyboard's dictation key is always the fallback.

const en = {
  mic: "Record a voice note",
  stop: "Stop and turn into text",
  cancel: "Cancel the recording",
  recording: "Recording {time}",
  limit: "Up to {min} min",
  transcribing: "Turning your voice into text",
  fail: {
    off: "Voice notes are not available right now. Type your message instead.",
    denied: "Microphone access is off for Guest-ly. Turn it on in Settings, or use the dictation key on the keyboard.",
    tooLong: "That recording is too long. Keep it under {min} minutes.",
    rate: "Voice notes are paused for today. Type your message instead.",
    noAnswer: "The text did not come back in time. The recording was deleted. Try again or type your message.",
    offline: "Could not send the recording. Check your connection and try again.",
    failed: "Could not turn the recording into text. Try again or type your message.",
    empty: "No words were heard. Try again a little closer to the phone.",
  },
  openSettings: "Open Settings",
};

const es: typeof en = {
  mic: "Grabar una nota de voz",
  stop: "Detener y convertir en texto",
  cancel: "Cancelar la grabación",
  recording: "Grabando {time}",
  limit: "Hasta {min} min",
  transcribing: "Convirtiendo tu voz en texto",
  fail: {
    off: "Las notas de voz no están disponibles ahora. Escribe tu mensaje.",
    denied: "El acceso al micrófono está apagado para Guest-ly. Actívalo en Ajustes o usa la tecla de dictado del teclado.",
    tooLong: "La grabación es demasiado larga. Mantenla por debajo de {min} minutos.",
    rate: "Las notas de voz están en pausa por hoy. Escribe tu mensaje.",
    noAnswer: "El texto no llegó a tiempo. La grabación se borró. Inténtalo de nuevo o escribe tu mensaje.",
    offline: "No se pudo enviar la grabación. Revisa tu conexión e inténtalo de nuevo.",
    failed: "No se pudo convertir la grabación en texto. Inténtalo de nuevo o escribe tu mensaje.",
    empty: "No se escucharon palabras. Inténtalo de nuevo un poco más cerca del teléfono.",
  },
  openSettings: "Abrir Ajustes",
};

export const VOICE_COPY = { en, es };

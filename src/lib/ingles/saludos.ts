// src/lib/ingles/saludos.ts
// Saludo con el que la tutora abre el chat y lo que contesta a los botones
// de respuesta rápida. Todo ya escrito: no llama al modelo ni gasta mensajes.
// Se usa en cliente y servidor (sin dependencias).

/** Para quien todavía no ha practicado (con o sin cuenta). Se elige uno al azar. */
export const SALUDOS_NUEVOS = [
  "¡Hola! 👋 Soy tu tutora de inglés. Empecemos fácil: ¿cómo te llamas? Responde: **My name is…**",
  "¡Hola! 😊 I'm your English teacher. Vamos poco a poco: ¿de dónde eres? Responde: **I'm from…**",
  "¡Qué gusto tenerte aquí! 👋 Practiquemos juntos. Primera pregunta fácil: ¿cómo estás hoy? Responde: **I'm fine, thank you!**",
  "Hi there! 👋 Soy tu tutora. No te preocupes por los errores, yo te ayudo. ¿Cuántos años tienes? Responde: **I'm … years old.**",
  "¡Hola! 🙌 Aquí practicas sin pena. Para empezar: ¿qué te gusta comer? Responde: **I like…**",
  "Welcome! 👋 Soy tu tutora de inglés. Algo sencillo: ¿en qué trabajas? Responde: **I work as…** (o **I'm a student**)",
  "¡Hola! ☀️ Let's practice. Cuéntame algo fácil: ¿tienes hermanos? Responde: **I have … brothers / sisters.**",
];

/** Lo que contesta la tutora al tocar "💬 Platicar en inglés". */
export const RESPUESTAS_PLATICAR = [
  "Great! 💬 Let's talk. ¿Qué hiciste hoy? Puedes empezar con: **Today I…** (si no sabes una palabra, escríbela en español).",
  "Perfect! 💬 Cuéntame de tu familia. Empieza con: **My family is…**",
  "Awesome! 💬 ¿Cuál es tu comida favorita? Responde: **My favorite food is…**",
  "Let's go! 💬 ¿Qué te gusta hacer el fin de semana? Responde: **On weekends I like to…**",
];

/** Lo que contesta al tocar "Soy principiante" (además de poner el nivel). */
export const RESPUESTAS_PRINCIPIANTE = [
  "¡Perfecto, vamos despacio! 🌱 Ya puse tu nivel en Principiante. Repite conmigo y escríbelo: **Hello, my name is…** Yo te corrijo con calma y te explico en español.",
  "¡Muy bien! 🌱 Ya estás en nivel Principiante. Empecemos con un saludo: escribe **Good morning!** o **Good afternoon!** y seguimos.",
];

export function alAzar<T>(lista: T[]): T {
  return lista[Math.floor(Math.random() * lista.length)];
}

/** Para quien ya practicó antes. Con cuenta se menciona la racha y el reto pendiente. */
export function saludoDeRegreso(opciones: { racha: number; retoPendiente: string | null }): string {
  const { racha, retoPendiente } = opciones;
  const inicio =
    racha > 0
      ? `¡Qué bueno verte otra vez! 🔥 Llevas ${racha} ${racha === 1 ? "día" : "días"} de racha.`
      : "¡Qué bueno verte otra vez! 👋";
  const reto = retoPendiente ? ` Hoy te espera el reto: **${retoPendiente}**.` : "";
  return `${inicio}${reto} ¿Practicamos?`;
}

/** Botones de respuesta rápida (se guarda cuál tocaron, para las estadísticas). */
export type BotonRapido = "pronunciacion" | "platicar" | "reto" | "principiante";

export const ETIQUETA_BOTON: Record<BotonRapido, string> = {
  pronunciacion: "🎤 Practicar pronunciación",
  platicar: "💬 Platicar en inglés",
  reto: "📖 Reto del día",
  principiante: "🌱 Soy principiante",
};

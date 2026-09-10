// Bot de WhatsApp de Elim LLDM.
//
// Se conecta a WhatsApp usando whatsapp-web.js (sesión del propio
// WhatsApp del número que se escanee por QR — no requiere la API
// oficial de Meta Business). Cada mensaje que le escribe una persona
// se reenvía al endpoint interno /api/whatsapp/chat de elimlldm.net,
// que reutiliza la misma base de conocimiento y el mismo modo LLDM
// de Elim IA (solo responde con lo que hay en los documentos que el
// administrador subió).
//
// Pensado para correr como contenedor Docker de larga duración en el
// servidor Hetzner, junto a AzuraCast — ver ../Dockerfile y
// ../docker-compose.yml.

import "dotenv/config";
import { Client, LocalAuth, Message } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

const ELIM_API_URL = process.env.ELIM_API_URL ?? "https://elimlldm.net/api/whatsapp/chat";
const ELIM_CLEAR_URL = process.env.ELIM_CLEAR_URL ?? "https://elimlldm.net/api/whatsapp/clear";
const WHATSAPP_BOT_SECRET = process.env.WHATSAPP_BOT_SECRET;
const RESPOND_IN_GROUPS = process.env.RESPOND_IN_GROUPS === "true";
const PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

// Límite de mensajes por número en la ventana de tiempo, para que
// nadie pueda tumbarnos la cuenta de Anthropic mandando mensajes en
// bucle (el número es público: cualquiera puede escribirle).
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? 8);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 5 * 60 * 1000);

// WhatsApp no tiene un límite duro de caracteres por mensaje, pero
// mensajes muy largos se ven mal — partimos la respuesta en trozos.
const MAX_REPLY_CHUNK = 3500;

if (!WHATSAPP_BOT_SECRET) {
  console.error("Falta WHATSAPP_BOT_SECRET en el entorno. Revisa whatsapp-bot/.env");
  process.exit(1);
}

const rateLimitLog = new Map<string, number[]>();

function isRateLimited(phoneNumber: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitLog.get(phoneNumber) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  timestamps.push(now);
  rateLimitLog.set(phoneNumber, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

function splitIntoChunks(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    // Cortar en el último salto de línea o espacio antes del límite,
    // para no partir una palabra o un párrafo a la mitad.
    let cut = remaining.lastIndexOf("\n", maxLength);
    if (cut < maxLength * 0.5) cut = remaining.lastIndexOf(" ", maxLength);
    if (cut < maxLength * 0.5) cut = maxLength;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function callElimIA(phoneNumber: string, message: string): Promise<string> {
  const res = await fetch(ELIM_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-whatsapp-secret": WHATSAPP_BOT_SECRET!,
    },
    body: JSON.stringify({ from: phoneNumber, message }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Elim IA respondió ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as { reply?: string };
  if (!data.reply) throw new Error("Elim IA no devolvió respuesta");
  return data.reply;
}

async function clearHistory(phoneNumber: string): Promise<void> {
  await fetch(ELIM_CLEAR_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-whatsapp-secret": WHATSAPP_BOT_SECRET!,
    },
    body: JSON.stringify({ from: phoneNumber }),
  });
}

const HELP_TEXT =
  "Hola, soy el asistente de Elim LLDM 🙏\n\n" +
  "Escríbeme tu pregunta y te respondo con base en los documentos oficiales.\n\n" +
  "Comandos:\n" +
  "!limpiar — borra nuestro historial de conversación\n" +
  "!ayuda — muestra este mensaje";

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "session" }),
  puppeteer: {
    headless: true,
    executablePath: PUPPETEER_EXECUTABLE_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  },
});

client.on("qr", (qr) => {
  console.log("Escanea este código QR desde WhatsApp > Dispositivos vinculados:\n");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Bot de WhatsApp de Elim LLDM listo.");
});

client.on("auth_failure", (msg) => {
  console.error("Falló la autenticación de WhatsApp:", msg);
});

client.on("disconnected", (reason) => {
  console.error("WhatsApp se desconectó:", reason);
  // Salimos para que Docker (restart: unless-stopped) reinicie el
  // proceso y vuelva a intentar la conexión desde cero.
  process.exit(1);
});

client.on("message", async (msg: Message) => {
  try {
    if (msg.from === "status@broadcast") return;
    if (msg.fromMe) return;
    if (!RESPOND_IN_GROUPS && msg.from.endsWith("@g.us")) return;

    const text = msg.body?.trim();
    if (!text) return;

    const lower = text.toLowerCase();

    if (lower === "!ayuda" || lower === "!help") {
      await msg.reply(HELP_TEXT);
      return;
    }

    if (lower === "!limpiar" || lower === "!clear" || lower === "!reset") {
      await clearHistory(msg.from);
      await msg.reply("Listo, borré nuestro historial de conversación. ¿En qué te ayudo?");
      return;
    }

    if (isRateLimited(msg.from)) {
      await msg.reply(
        "Has enviado varios mensajes seguidos. Espera unos minutos antes de volver a escribir, por favor 🙏"
      );
      return;
    }

    const chat = await msg.getChat();
    await chat.sendStateTyping();

    const reply = await callElimIA(msg.from, text);

    for (const chunk of splitIntoChunks(reply, MAX_REPLY_CHUNK)) {
      await msg.reply(chunk);
    }
  } catch (err) {
    console.error("Error procesando mensaje de WhatsApp:", err);
    try {
      await msg.reply(
        "Disculpa, tuve un problema para responder. Intenta de nuevo en un momento 🙏"
      );
    } catch {
      // Si ni siquiera se pudo mandar el mensaje de error, solo lo dejamos en el log.
    }
  }
});

client.initialize();

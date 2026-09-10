import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { buildLldmSystemPrompt } from "@/lib/elim-ia/prompts";
import type { ElimIADocument } from "@/types";

// Endpoint interno para el asistente de WhatsApp (bot en el servidor
// Hetzner, whatsapp-web.js). Reutiliza la MISMA base de conocimiento
// y el MISMO modo LLDM que Elim IA (src/app/api/elim-ia/chat/route.ts):
// solo responde con lo que hay en los documentos subidos por el
// administrador, sin modo "general" ni búsqueda web — este canal es
// público (cualquiera puede escribirle al número de WhatsApp), así
// que no exponemos el modo con más costo/superficie de abuso.
//
// No hay usuario de Supabase Auth detrás de un mensaje de WhatsApp,
// así que la autenticación es un secreto compartido (header
// x-whatsapp-secret) en vez de la sesión por cookies, y el
// historial se guarda por número de teléfono en whatsapp_ia_messages
// (ver supabase/migrations/0036_whatsapp_ia.sql).

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const HISTORY_LIMIT = 20;
const MAX_MESSAGE_LENGTH = 4000;

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.WHATSAPP_BOT_SECRET;
  if (!secret) return false;
  return request.headers.get("x-whatsapp-secret") === secret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Elim IA no está configurado" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as
    | { from?: string; message?: string }
    | null;

  const phoneNumber = body?.from?.trim();
  const message = body?.message?.trim();

  if (!phoneNumber) {
    return NextResponse.json({ error: "Falta el número de teléfono (from)" }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "Mensaje demasiado largo" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: historyData } = await supabase
    .from("whatsapp_ia_messages")
    .select("role, content")
    .eq("phone_number", phoneNumber)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const history = ((historyData ?? []) as { role: string; content: string }[])
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));

  // Más reciente primero: si el presupuesto de buildLldmSystemPrompt no
  // alcanza para todos los documentos, lo que se queda afuera es lo más
  // viejo — igual que en Elim IA (ver src/app/api/elim-ia/chat/route.ts).
  const { data: docsData } = await supabase
    .from("elim_ia_documents")
    .select("title, content")
    .order("created_at", { ascending: false });

  const documents = (docsData ?? []) as Pick<ElimIADocument, "title" | "content">[];

  // WhatsApp no renderiza Markdown: "## título" y "**negrita**" salen
  // como texto literal con los símbolos a la vista. buildLldmSystemPrompt
  // es compartido con el chat web de Elim IA (donde el Markdown sí se ve
  // bien), así que el ajuste de formato va aquí, solo para este canal.
  const systemPrompt =
    buildLldmSystemPrompt(documents) +
    "\n\n# Formato de respuesta (WhatsApp)\n\n" +
    "Esta respuesta se envía por WhatsApp, que no interpreta Markdown. " +
    "No uses encabezados (#, ##), ni negrita con doble asterisco (**texto**), " +
    "ni listas con guiones o viñetas, ni enlaces en formato [texto](url). " +
    "Escribe en párrafos cortos y naturales, como un mensaje de WhatsApp real. " +
    "Si necesitas resaltar una palabra, usa un solo asterisco (*así*), que es " +
    "la negrita nativa de WhatsApp — úsalo con moderación.";

  const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1536,
      system: systemPrompt,
      messages: [...history, { role: "user", content: message }],
    }),
  });

  if (!anthropicResponse.ok) {
    const errText = await anthropicResponse.text();
    console.error("WhatsApp IA — error de Anthropic API:", errText);
    return NextResponse.json({ error: "Error al consultar el asistente" }, { status: 502 });
  }

  const data = (await anthropicResponse.json()) as { content: AnthropicContentBlock[] };

  const reply = data.content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n\n")
    .trim();

  if (!reply) {
    return NextResponse.json({ error: "El asistente no generó una respuesta" }, { status: 502 });
  }

  await supabase.from("whatsapp_ia_messages").insert([
    { phone_number: phoneNumber, role: "user", content: message },
    { phone_number: phoneNumber, role: "assistant", content: reply },
  ]);

  return NextResponse.json({ reply });
}

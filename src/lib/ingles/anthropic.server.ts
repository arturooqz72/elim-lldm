// src/lib/ingles/anthropic.server.ts
// Llamada simple a la API de Anthropic (mismo fetch directo que Elim IA y el
// chat de Elim English) para el modo Pronunciación: generar frases y
// explicar los errores.

import { inglesConfig } from "./config";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

interface BloqueAnthropic {
  type: string;
  text?: string;
}

/** Devuelve el texto de la respuesta, o null si falla (el error queda en el log). */
export async function pedirAlModelo(sistema: string, mensaje: string, maxTokens: number): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Elim English — falta ANTHROPIC_API_KEY");
    return null;
  }

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: inglesConfig().modelo,
        max_tokens: maxTokens,
        system: sistema,
        messages: [{ role: "user", content: mensaje }],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      console.error("Elim English — error de Anthropic API:", await res.text());
      return null;
    }

    const data = (await res.json()) as { content: BloqueAnthropic[] };
    const texto = data.content
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n")
      .trim();
    return texto || null;
  } catch (err) {
    console.error("Elim English — fallo de red con Anthropic:", err);
    return null;
  }
}

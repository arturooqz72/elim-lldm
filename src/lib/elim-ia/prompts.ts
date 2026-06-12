import type { ElimIADocument } from "@/types";

export const SYSTEM_PROMPT_LLDM =
  "Eres un asistente de La Luz del Mundo. Solo respondes con información de los documentos que el administrador ha subido. Si la respuesta no está en esos documentos, dices que no tienes esa información disponible. Responde siempre en español con tono respetuoso y pastoral.";

export const SYSTEM_PROMPT_GENERAL =
  "Eres Elim IA, un asistente inteligente de la plataforma Elim LLDM. Puedes responder cualquier pregunta usando búsqueda web. Responde siempre en español.";

// Límite aproximado de caracteres de contexto de documentos (deja margen
// dentro de la ventana de contexto del modelo para el historial y la respuesta).
const MAX_DOCUMENTS_CONTEXT_CHARS = 300_000;

export function buildLldmSystemPrompt(documents: Pick<ElimIADocument, "title" | "content">[]): string {
  if (documents.length === 0) {
    return `${SYSTEM_PROMPT_LLDM}\n\nActualmente el administrador no ha subido ningún documento.`;
  }

  let remaining = MAX_DOCUMENTS_CONTEXT_CHARS;
  const parts: string[] = [];

  for (const doc of documents) {
    if (remaining <= 0) break;
    const content = doc.content.slice(0, remaining);
    parts.push(`--- Documento: ${doc.title} ---\n${content}`);
    remaining -= content.length;
  }

  return `${SYSTEM_PROMPT_LLDM}\n\n# Documentos disponibles\n\n${parts.join("\n\n")}`;
}

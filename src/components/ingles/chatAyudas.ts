// Ayudas del chat con cuenta de Elim English (InglesChat).

import { MODOS } from "@/lib/ingles/etiquetas";
import type { InglesMensaje, InglesModo, InglesRacha, InglesReto, InglesRetoAvance, InglesSaldo } from "@/types";

/** Mensaje en pantalla; el id permite practicar con la voz las frases de la tutora. */
export type ChatMsg = Pick<InglesMensaje, "id" | "role" | "content">;

/** Lo que responden /api/ingles/chat y /api/ingles/reto. */
export interface RespuestaChat {
  estado?: string;
  reply?: string;
  mensajeId?: string | null;
  saldo?: InglesSaldo;
  error?: string;
  racha?: InglesRacha;
  avance?: InglesRetoAvance;
}

/** Conversaciones separadas por modo. */
export function agrupar(mensajes: InglesMensaje[]): Record<InglesModo, ChatMsg[]> {
  const grupos = Object.fromEntries(MODOS.map((m) => [m, [] as ChatMsg[]])) as Record<InglesModo, ChatMsg[]>;
  for (const m of mensajes) grupos[m.modo]?.push({ id: m.id, role: m.role, content: m.content });
  return grupos;
}

export function bienvenidaReto(reto: InglesReto): string {
  return `¡Reto de hoy: ${reto.titulo}! Escríbeme la frase 1 en inglés: "${reto.frases[0].en}" (puedes adaptarla a tu caso). Te corrijo y seguimos con la 2 y la 3.`;
}

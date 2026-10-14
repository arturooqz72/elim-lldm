// src/lib/arena-publica/puntos.server.ts
//
// Puntos de la Trivia en línea. Al responder solo se guarda la respuesta
// (correcta o no, y en cuánto tiempo); los puntos se suman al revelar la
// pregunta, así nadie puede ver por Realtime quién acertó antes de tiempo.
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { ROUND_SECONDS } from "./config";

const ROUND_MS = ROUND_SECONDS * 1000;

/** La fórmula de siempre: correcta = 100 a 1000 según la rapidez; incorrecta = 0. */
export function puntosDeRespuesta(esCorrecta: boolean, tiempoMs: number): number {
  if (!esCorrecta) return 0;
  const t = Math.max(0, Math.min(tiempoMs, ROUND_MS));
  return Math.max(100, Math.round(1000 * (1 - t / ROUND_MS)));
}

/**
 * Recalcula los puntos de cada jugador de la sala sumando TODAS sus
 * respuestas. Es una suma completa (no un incremento), así que llamarla
 * más de una vez no duplica nada, y una respuesta que llegó justo cuando
 * la pregunta cerraba entra en el siguiente recálculo.
 */
export async function sumarPuntosSala(salaId: string): Promise<{ error?: string }> {
  const service = await createServiceClient();
  const [jugadores, respuestas] = await Promise.all([
    service.from("arena_publica_jugadores").select("id, puntos").eq("sala_id", salaId),
    service.from("arena_publica_respuestas").select("jugador_id, es_correcta, tiempo_ms").eq("sala_id", salaId),
  ]);
  if (jugadores.error) return { error: jugadores.error.message };
  if (respuestas.error) return { error: respuestas.error.message };

  const totales = new Map<string, number>();
  for (const r of respuestas.data ?? []) {
    totales.set(r.jugador_id, (totales.get(r.jugador_id) ?? 0) + puntosDeRespuesta(r.es_correcta, r.tiempo_ms));
  }

  for (const j of jugadores.data ?? []) {
    const total = totales.get(j.id) ?? 0;
    if (total === j.puntos) continue;
    const { error } = await service.from("arena_publica_jugadores").update({ puntos: total }).eq("id", j.id);
    if (error) return { error: error.message };
  }
  return {};
}

// src/lib/juegos/ranking-individual.server.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FilaPosicion } from "@/types";

/**
 * Top N de un juego individual (un jugador, sin sala), leído de
 * juego_individual_rankings (0034_ahorcado_nt.sql) — la contraparte de
 * getTablaPosiciones() para juegos de sala en vivo (tabla_posiciones).
 *
 * Usa el cliente anónimo a propósito: la tabla tiene SELECT público (ver
 * migración), así que un visitante sin cuenta también ve el ranking.
 *
 * `partidas` en el resultado en realidad es "palabras ganadas" (o lo que
 * cada juego individual futuro decida guardar en metadata) — el llamador
 * rotula la unidad correcta vía las props unidadSingular/unidadPlural de
 * TablaPosiciones (ver Task 3, Step 2).
 */
export async function getRankingIndividual(
  gameKey: string,
  limite = 5
): Promise<FilaPosicion[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("juego_individual_rankings")
    .select("user_id, score, metadata, profiles(display_name, avatar_url)")
    .eq("game_key", gameKey)
    .order("score", { ascending: false })
    .order("updated_at", { ascending: true })
    .limit(limite);

  // Falla en silencio a lista vacía: esto pinta una tarjeta secundaria del
  // hub de /juegos — no debe tirar la página entera si el ranking no se
  // pudo leer (mismo criterio que getTablaPosiciones).
  if (error) {
    console.error("[ranking-individual] no se pudo leer el ranking:", error.message);
    return [];
  }

  return (
    (data ?? []) as unknown as Array<{
      user_id: string;
      score: number;
      metadata: { palabras_ganadas?: number } | null;
      profiles: { display_name: string; avatar_url: string | null } | null;
    }>
  ).map((fila) => ({
    user_id: fila.user_id,
    nombre: fila.profiles?.display_name ?? "Jugador",
    avatar_url: fila.profiles?.avatar_url ?? null,
    puntos_totales: fila.score,
    partidas: fila.metadata?.palabras_ganadas ?? 0,
  }));
}

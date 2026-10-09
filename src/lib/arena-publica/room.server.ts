// src/lib/arena-publica/room.server.ts
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { MIN_PREGUNTAS_DISPONIBLES, PREGUNTAS_POR_PARTIDA } from "./config";
import { healStaleRooms } from "./advance.server";

export interface SalaActual {
  id: string;
  status: "lobby" | "counting" | "playing" | "reveal" | "finished";
  pregunta_actual: number;
  jugadores_deseados: number;
  total_preguntas: number;
  cuenta_termina_en: string | null;
  pregunta_termina_en: string | null;
  reveal_termina_en: string | null;
  created_at: string;
}

/**
 * Devuelve la sala "abierta a unirse" (la más reciente en 'lobby' o
 * 'counting' — todavía acepta jugadores nuevos). Si no existe ninguna —
 * primera visita de siempre, o la única que había ya arrancó a jugar — crea
 * una sala nueva en 'lobby' (sus preguntas salen del banco una por una
 * durante la partida — ver prepararPreguntaDelBanco), en vez de devolver una sala que ya está en 'playing'/'reveal' y rechazaría el
 * join. Así, varias partidas pueden estar en curso a la vez — el que llega
 * mientras otra sala ya juega no espera, entra a una sala propia.
 * No hay cron job: esta función se llama desde la página en cada visita,
 * así que la próxima persona que entre después de que termine una partida
 * es quien, sin darse cuenta, prepara la siguiente. La misma visita también
 * sana de paso cualquier otra sala abandonada — ver healStaleRooms().
 */
export async function getOrCreateOpenRoom(jugadoresDeseados = 2): Promise<{
  sala: SalaActual | null;
  error: string | null;
}> {
  const service = await createServiceClient();

  await healStaleRooms().catch((err) => {
    console.error("[arena-publica/room] Error inesperado en healStaleRooms:", err);
  });

  const buscarSalaAbierta = () =>
    service
      .from("arena_publica_salas")
      .select("*")
      .in("status", ["lobby", "counting"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  const { data: existente } = await buscarSalaAbierta();

  if (existente) return { sala: existente as SalaActual, error: null };

  // Las preguntas ya no se sortean aquí: cada una se elige del banco justo
  // cuando le toca (ver prepararPreguntaDelBanco), con los jugadores ya
  // dentro, para no repetirles ninguna que hayan visto. Aquí solo se
  // comprueba que el banco tenga preguntas aprobadas.
  const { count: disponibles, error: bancoError } = await service
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("estado", "aprobada")
    .eq("activa", true)
    .not("dificultad", "is", null);

  if (bancoError) {
    return { sala: null, error: bancoError.message };
  }
  if ((disponibles ?? 0) < MIN_PREGUNTAS_DISPONIBLES) {
    return {
      sala: null,
      error: `Todavía no hay suficientes preguntas en el banco (se necesitan al menos ${MIN_PREGUNTAS_DISPONIBLES}).`,
    };
  }

  const { data: nuevaSala, error: salaError } = await service
    .from("arena_publica_salas")
    .insert({
      status: "lobby",
      jugadores_deseados: jugadoresDeseados,
      total_preguntas: PREGUNTAS_POR_PARTIDA,
    })
    .select("*")
    .single();

  if (salaError || !nuevaSala) {
    // 23505 = violación de unicidad: otra request concurrente ganó la
    // carrera vía el índice único parcial idx_arena_publica_salas_una_lobby
    // (a lo sumo una sala en 'lobby' a la vez). No es un error real — esa
    // sala ya existe, así que la buscamos y la
    // devolvemos en vez de fallar.
    if (salaError?.code === "23505") {
      const { data: salaGanadora } = await buscarSalaAbierta();
      if (salaGanadora) return { sala: salaGanadora as SalaActual, error: null };
    }
    return { sala: null, error: salaError?.message ?? "No se pudo crear la sala" };
  }

  return { sala: nuevaSala as SalaActual, error: null };
}

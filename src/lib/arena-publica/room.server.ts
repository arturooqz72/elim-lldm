// src/lib/arena-publica/room.server.ts
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { MIN_PREGUNTAS_DISPONIBLES, PREGUNTAS_POR_PARTIDA } from "./config";
import { healStaleRooms } from "./advance.server";

export interface SalaActual {
  id: string;
  status: "lobby" | "counting" | "playing" | "reveal" | "finished";
  pregunta_actual: number;
  cuenta_termina_en: string | null;
  pregunta_termina_en: string | null;
  reveal_termina_en: string | null;
  created_at: string;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Devuelve la sala "abierta a unirse" (la más reciente en 'lobby' o
 * 'counting' — todavía acepta jugadores nuevos). Si no existe ninguna —
 * primera visita de siempre, o la única que había ya arrancó a jugar — crea
 * una sala nueva en 'lobby' con un set de preguntas sorteado del banco
 * público (todas las questions de question_sets con is_public = true), en
 * vez de devolver una sala que ya está en 'playing'/'reveal' y rechazaría el
 * join. Así, varias partidas pueden estar en curso a la vez — el que llega
 * mientras otra sala ya juega no espera, entra a una sala propia.
 * No hay cron job: esta función se llama desde la página en cada visita,
 * así que la próxima persona que entre después de que termine una partida
 * es quien, sin darse cuenta, prepara la siguiente. La misma visita también
 * sana de paso cualquier otra sala abandonada — ver healStaleRooms().
 */
export async function getOrCreateOpenRoom(): Promise<{
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

  // Dos consultas simples en vez de un filtro anidado sobre la tabla
  // embebida (question_sets.is_public) — más fácil de verificar que
  // realmente filtra bien, y evita depender de sintaxis de PostgREST menos
  // común para algo que se ejecuta cada vez que arranca una partida nueva.
  const { data: setsPublicos, error: setsError } = await service
    .from("question_sets")
    .select("id")
    .eq("is_public", true);

  if (setsError) {
    return { sala: null, error: setsError.message };
  }
  const setIds = (setsPublicos ?? []).map((s) => s.id as string);
  if (setIds.length === 0) {
    return {
      sala: null,
      error: `Todavía no hay suficientes preguntas públicas (se necesitan al menos ${MIN_PREGUNTAS_DISPONIBLES}).`,
    };
  }

  const { data: preguntasDisponibles, error: preguntasError } = await service
    .from("questions")
    .select("question_text, option_a, option_b, option_c, option_d, correct_option")
    .in("question_set_id", setIds);

  if (preguntasError) {
    return { sala: null, error: preguntasError.message };
  }
  if (!preguntasDisponibles || preguntasDisponibles.length < MIN_PREGUNTAS_DISPONIBLES) {
    return {
      sala: null,
      error: `Todavía no hay suficientes preguntas públicas (se necesitan al menos ${MIN_PREGUNTAS_DISPONIBLES}).`,
    };
  }

  const elegidas = shuffle(preguntasDisponibles).slice(0, PREGUNTAS_POR_PARTIDA);

  const { data: nuevaSala, error: salaError } = await service
    .from("arena_publica_salas")
    .insert({ status: "lobby" })
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

  const { data: preguntasInsertadas, error: insertPreguntasError } = await service
    .from("arena_publica_preguntas")
    .insert(
      elegidas.map((q, i) => ({
        sala_id: nuevaSala.id,
        pregunta: q.question_text,
        opcion_a: q.option_a,
        opcion_b: q.option_b,
        opcion_c: q.option_c,
        opcion_d: q.option_d,
        orden: i + 1,
      }))
    )
    .select("id");

  if (insertPreguntasError || !preguntasInsertadas) {
    await service.from("arena_publica_salas").delete().eq("id", nuevaSala.id);
    return { sala: null, error: insertPreguntasError?.message ?? "No se pudieron crear las preguntas" };
  }

  const { error: insertRespuestasError } = await service.from("arena_publica_respuestas_correctas").insert(
    preguntasInsertadas.map((p, i) => ({
      pregunta_id: p.id,
      respuesta_correcta: elegidas[i].correct_option,
    }))
  );

  if (insertRespuestasError) {
    await service.from("arena_publica_salas").delete().eq("id", nuevaSala.id);
    return { sala: null, error: insertRespuestasError.message };
  }

  return { sala: nuevaSala as SalaActual, error: null };
}

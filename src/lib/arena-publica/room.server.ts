// src/lib/arena-publica/room.server.ts
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { MIN_PREGUNTAS_DISPONIBLES, PREGUNTAS_POR_PARTIDA } from "./config";

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
 * Devuelve la sala "actual" (la más reciente que no esté 'finished'). Si no
 * existe ninguna — primera visita de siempre, o la anterior ya terminó —
 * crea una nueva en 'lobby' con un set de preguntas sorteado del banco
 * público (todas las questions de question_sets con is_public = true).
 * No hay cron job: esta función se llama desde la página en cada visita,
 * así que la próxima persona que entre después de que termine una partida
 * es quien, sin darse cuenta, prepara la siguiente.
 */
export async function getOrCreateOpenRoom(): Promise<{
  sala: SalaActual;
  error: string | null;
}> {
  const service = await createServiceClient();

  const { data: existente } = await service
    .from("arena_publica_salas")
    .select("*")
    .neq("status", "finished")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
    return { sala: null as unknown as SalaActual, error: setsError.message };
  }
  const setIds = (setsPublicos ?? []).map((s) => s.id as string);
  if (setIds.length === 0) {
    return {
      sala: null as unknown as SalaActual,
      error: `Todavía no hay suficientes preguntas públicas (se necesitan al menos ${MIN_PREGUNTAS_DISPONIBLES}).`,
    };
  }

  const { data: preguntasDisponibles, error: preguntasError } = await service
    .from("questions")
    .select("question_text, option_a, option_b, option_c, option_d, correct_option")
    .in("question_set_id", setIds);

  if (preguntasError) {
    return { sala: null as unknown as SalaActual, error: preguntasError.message };
  }
  if (!preguntasDisponibles || preguntasDisponibles.length < MIN_PREGUNTAS_DISPONIBLES) {
    return {
      sala: null as unknown as SalaActual,
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
    return { sala: null as unknown as SalaActual, error: salaError?.message ?? "No se pudo crear la sala" };
  }

  const { error: insertPreguntasError } = await service.from("arena_publica_preguntas").insert(
    elegidas.map((q, i) => ({
      sala_id: nuevaSala.id,
      pregunta: q.question_text,
      opcion_a: q.option_a,
      opcion_b: q.option_b,
      opcion_c: q.option_c,
      opcion_d: q.option_d,
      respuesta_correcta: q.correct_option,
      orden: i + 1,
    }))
  );

  if (insertPreguntasError) {
    await service.from("arena_publica_salas").delete().eq("id", nuevaSala.id);
    return { sala: null as unknown as SalaActual, error: insertPreguntasError.message };
  }

  return { sala: nuevaSala as SalaActual, error: null };
}

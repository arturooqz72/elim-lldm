// src/lib/juegos/preguntas.server.ts
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { AnswerOption } from "@/types";

export interface PreguntaDeJuego {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: AnswerOption;
  bible_reference: string | null;
  time_limit_seconds: number;
  points: number;
  order_index: number;
}

/**
 * Preguntas jugables (aprobadas y activas) de una partida de /juegos, en
 * el mismo orden para todos: la página del jugador, el anfitrión y las
 * rutas que avanzan y califican usan esta lista, así que el índice
 * current_question_index apunta siempre a la misma pregunta.
 * Con service role (desde 0071 questions solo la lee un admin). Incluye la
 * respuesta correcta: quien la mande al navegador de un jugador debe
 * quitarla antes.
 */
export async function preguntasDeJuego(questionSetId: string): Promise<PreguntaDeJuego[]> {
  const service = await createServiceClient();
  const { data } = await service
    .from("questions")
    .select(
      "id, question_text, option_a, option_b, option_c, option_d, correct_option, bible_reference, time_limit_seconds, points, order_index"
    )
    .eq("question_set_id", questionSetId)
    .eq("estado", "aprobada")
    .eq("activa", true)
    .order("order_index")
    .order("created_at")
    .order("id");
  return (data ?? []) as PreguntaDeJuego[];
}

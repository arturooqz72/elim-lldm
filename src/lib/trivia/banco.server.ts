// src/lib/trivia/banco.server.ts
// Lógica del banco de preguntas que solo corre en el servidor: elegir una
// pregunta que ningún jugador haya visto, revolver sus opciones, recordar
// quién la vio y sumar sus estadísticas. La respuesta correcta nunca sale
// de aquí hacia el navegador antes de tiempo.
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { AnswerOption } from "@/types";
import { NIVELES, type Nivel } from "./banco";

export interface PreguntaBanco {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: AnswerOption;
  bible_reference: string | null;
  dificultad: Nivel;
  categoria: string | null;
}

export interface OpcionesRevueltas {
  opcion_a: string;
  opcion_b: string;
  opcion_c: string;
  opcion_d: string;
  correcta: AnswerOption;
}

const LETRAS: AnswerOption[] = ["a", "b", "c", "d"];

export function revolver<T>(arr: T[]): T[] {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Revuelve las 4 opciones y devuelve en qué letra quedó la correcta. */
export function revolverOpciones(q: {
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: AnswerOption;
}): OpcionesRevueltas {
  const opciones = LETRAS.map((letra) => ({
    texto: q[`option_${letra}` as const],
    correcta: letra === q.correct_option,
  }));
  const nuevas = revolver(opciones);
  return {
    opcion_a: nuevas[0].texto,
    opcion_b: nuevas[1].texto,
    opcion_c: nuevas[2].texto,
    opcion_d: nuevas[3].texto,
    correcta: LETRAS[nuevas.findIndex((o) => o.correcta)],
  };
}

/**
 * Pregunta que ninguno de `userIds` ha visto (ver elegir_pregunta_banco en
 * 0071). null si ya vieron todo el banco.
 */
export async function elegirDelBanco(
  userIds: string[],
  excluir: string[],
  nivel: Nivel,
  categoriaEvitar: string | null
): Promise<PreguntaBanco | null> {
  const service = await createServiceClient();
  const { data, error } = await service.rpc("elegir_pregunta_banco", {
    p_user_ids: userIds,
    p_excluir: excluir,
    p_nivel: nivel,
    p_categoria_evitar: categoriaEvitar,
  });
  if (error) {
    console.error("[trivia/banco] elegir_pregunta_banco falló:", error);
    return null;
  }
  const filas = (data ?? []) as PreguntaBanco[];
  return filas[0] ?? null;
}

/** Desde ahora estos jugadores ya vieron la pregunta: no se les repite nunca. */
export async function marcarVistas(userIds: string[], questionId: string): Promise<void> {
  if (userIds.length === 0) return;
  const service = await createServiceClient();
  const { error } = await service
    .from("trivia_vistas")
    .upsert(
      userIds.map((user_id) => ({ user_id, question_id: questionId })),
      { onConflict: "user_id,question_id", ignoreDuplicates: true }
    );
  if (error) console.error("[trivia/banco] No se pudieron marcar las vistas:", error);
}

/** Suma una respuesta a las estadísticas de la pregunta del banco. */
export async function registrarRespuesta(questionId: string, acerto: boolean): Promise<void> {
  const service = await createServiceClient();
  const { error } = await service.rpc("registrar_respuesta_pregunta", {
    p_question_id: questionId,
    p_acerto: acerto,
  });
  if (error) console.error("[trivia/banco] registrar_respuesta_pregunta falló:", error);
}

/**
 * Dificultad progresiva: se empieza en fácil y se sube un nivel cuando la
 * mayoría de los jugadores acertó la pregunta anterior; si no, se queda.
 */
export function siguienteNivel(anterior: string | null, aciertos: number, jugadores: number): Nivel {
  const actual = (NIVELES as readonly string[]).includes(anterior ?? "") ? (anterior as Nivel) : "facil";
  if (jugadores > 0 && aciertos * 2 > jugadores) {
    return NIVELES[Math.min(NIVELES.indexOf(actual) + 1, NIVELES.length - 1)];
  }
  return actual;
}

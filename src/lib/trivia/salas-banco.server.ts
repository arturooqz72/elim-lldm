// src/lib/trivia/salas-banco.server.ts
// Prepara, justo cuando le toca, la siguiente pregunta de una sala de
// Trivia en línea (arena_publica_*) o de Elim Arena en modo banco
// (elim_arena_*). Las dos familias de tablas tienen las mismas columnas.
//
// La pregunta se escoge en el momento y no al crear la sala porque:
//   - hay que saber quiénes juegan, para no darles nada que ya vieron;
//   - la dificultad depende de cómo les fue con la pregunta anterior;
//   - así nadie puede leer por adelantado las preguntas que vienen.
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { elegirDelBanco, marcarVistas, revolverOpciones, siguienteNivel } from "./banco.server";

export type ArenaConBanco = "arena_publica" | "elim_arena";

export interface PreguntaDeSala {
  id: string;
  pregunta: string;
  opcion_a: string;
  opcion_b: string;
  opcion_c: string;
  opcion_d: string;
  orden: number;
}

const COLUMNAS = "id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, orden";

/**
 * Devuelve la pregunta `orden` de la sala; si todavía no existe la elige
 * del banco y la guarda. null si los jugadores ya vieron todo el banco (o
 * si algo falló: queda en el log), en cuyo caso la partida debe terminar.
 */
export async function prepararPreguntaDelBanco(
  arena: ArenaConBanco,
  salaId: string,
  orden: number
): Promise<PreguntaDeSala | null> {
  const service = await createServiceClient();
  const tablaPreguntas = `${arena}_preguntas`;

  const buscar = () =>
    service.from(tablaPreguntas).select(COLUMNAS).eq("sala_id", salaId).eq("orden", orden).maybeSingle();

  const { data: existente } = await buscar();
  if (existente) return existente as PreguntaDeSala;

  const [{ data: jugadores }, { data: previas }] = await Promise.all([
    service.from(`${arena}_jugadores`).select("user_id").eq("sala_id", salaId),
    service
      .from(tablaPreguntas)
      .select("id, question_id, dificultad, categoria, orden")
      .eq("sala_id", salaId)
      .order("orden"),
  ]);

  const userIds = [
    ...new Set(
      ((jugadores ?? []) as { user_id: string | null }[])
        .map((j) => j.user_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const anteriores = (previas ?? []) as {
    id: string;
    question_id: string | null;
    dificultad: string | null;
    categoria: string | null;
  }[];
  const ultima = anteriores.at(-1) ?? null;

  let aciertos = 0;
  if (ultima) {
    const { count } = await service
      .from(`${arena}_respuestas`)
      .select("id", { count: "exact", head: true })
      .eq("pregunta_id", ultima.id)
      .eq("es_correcta", true);
    aciertos = count ?? 0;
  }
  const nivel = ultima
    ? siguienteNivel(ultima.dificultad, aciertos, (jugadores ?? []).length)
    : "facil";

  const elegida = await elegirDelBanco(
    userIds,
    anteriores.map((p) => p.question_id).filter((id): id is string => Boolean(id)),
    nivel,
    ultima?.categoria ?? null
  );
  if (!elegida) return null;

  const opciones = revolverOpciones(elegida);

  const { data: insertada, error: insertError } = await service
    .from(tablaPreguntas)
    .insert({
      sala_id: salaId,
      pregunta: elegida.question_text,
      opcion_a: opciones.opcion_a,
      opcion_b: opciones.opcion_b,
      opcion_c: opciones.opcion_c,
      opcion_d: opciones.opcion_d,
      orden,
      question_id: elegida.id,
      dificultad: elegida.dificultad,
      categoria: elegida.categoria,
    })
    .select(COLUMNAS)
    .single();

  if (insertError || !insertada) {
    // 23505: otra petición al mismo tiempo ya guardó la pregunta de este
    // turno (UNIQUE sala_id, orden). Se usa la suya.
    if (insertError?.code === "23505") {
      const { data: ganadora } = await buscar();
      if (ganadora) return ganadora as PreguntaDeSala;
    }
    console.error(`[trivia/salas-banco] No se pudo guardar la pregunta ${orden} de ${arena} ${salaId}:`, insertError);
    return null;
  }

  const { error: correctaError } = await service
    .from(`${arena}_respuestas_correctas`)
    .insert({ pregunta_id: insertada.id, respuesta_correcta: opciones.correcta });

  if (correctaError) {
    console.error(`[trivia/salas-banco] No se pudo guardar la respuesta correcta (${arena} ${salaId}):`, correctaError);
    await service.from(tablaPreguntas).delete().eq("id", insertada.id);
    return null;
  }

  await marcarVistas(userIds, elegida.id);
  return insertada as PreguntaDeSala;
}

/** Cuenta la respuesta en las estadísticas de la pregunta del banco, si salió de ahí. */
export async function questionIdDePregunta(arena: ArenaConBanco, preguntaId: string): Promise<string | null> {
  const service = await createServiceClient();
  const { data } = await service.from(`${arena}_preguntas`).select("question_id").eq("id", preguntaId).maybeSingle();
  return (data?.question_id as string | null | undefined) ?? null;
}

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { AnswerOption } from "@/types";

const ANSWER_OPTIONS: AnswerOption[] = ["a", "b", "c", "d"];
const ROUND_MS = 15000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const supabase = await createServiceClient();

  let body: {
    jugador_id?: string;
    pregunta_id?: string;
    respuesta?: AnswerOption;
    tiempo_ms?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const { jugador_id, pregunta_id, respuesta, tiempo_ms } = body;

  if (
    !jugador_id ||
    !pregunta_id ||
    !respuesta ||
    !ANSWER_OPTIONS.includes(respuesta) ||
    typeof tiempo_ms !== "number"
  ) {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const { data: sala } = await supabase
    .from("elim_arena_salas")
    .select("id, status, pregunta_actual")
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  if (sala.status !== "playing") {
    return NextResponse.json({ error: "No se puede responder en este momento" }, { status: 400 });
  }

  const { data: pregunta } = await supabase
    .from("elim_arena_preguntas")
    .select("id, sala_id, orden, respuesta_correcta")
    .eq("id", pregunta_id)
    .maybeSingle();

  if (!pregunta || pregunta.sala_id !== sala.id) {
    return NextResponse.json({ error: "Pregunta no encontrada" }, { status: 404 });
  }
  if (pregunta.orden !== sala.pregunta_actual) {
    return NextResponse.json({ error: "Esta pregunta ya no está activa" }, { status: 400 });
  }

  const esCorrecta = respuesta === pregunta.respuesta_correcta;
  const tiempoClamped = Math.max(0, Math.min(tiempo_ms, ROUND_MS));
  const puntos = esCorrecta
    ? Math.max(100, Math.round(1000 * (1 - tiempoClamped / ROUND_MS)))
    : 0;

  const { error: insertError } = await supabase.from("elim_arena_respuestas").insert({
    sala_id: sala.id,
    jugador_id,
    pregunta_id,
    respuesta,
    es_correcta: esCorrecta,
    tiempo_ms: tiempoClamped,
  });

  if (insertError) {
    return NextResponse.json({ error: "Ya respondiste esta pregunta" }, { status: 409 });
  }

  const { data: jugador } = await supabase
    .from("elim_arena_jugadores")
    .select("puntos")
    .eq("id", jugador_id)
    .single();

  await supabase
    .from("elim_arena_jugadores")
    .update({
      puntos: (jugador?.puntos ?? 0) + puntos,
      ultimo_respondido_at: new Date().toISOString(),
    })
    .eq("id", jugador_id);

  return NextResponse.json({ es_correcta: esCorrecta, puntos_obtenidos: puntos });
}

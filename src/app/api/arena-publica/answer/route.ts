import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ROUND_SECONDS } from "@/lib/arena-publica/config";
import { registrarRespuesta } from "@/lib/trivia/banco.server";
import type { AnswerOption } from "@/types";

const ANSWER_OPTIONS: AnswerOption[] = ["a", "b", "c", "d"];
const ROUND_MS = ROUND_SECONDS * 1000;

export async function POST(request: Request) {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para jugar" }, { status: 401 });

  const supabase = await createServiceClient();

  let body: {
    sala_id?: string;
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

  const { sala_id, jugador_id, pregunta_id, respuesta, tiempo_ms } = body;

  if (
    !sala_id ||
    !jugador_id ||
    !pregunta_id ||
    !respuesta ||
    !ANSWER_OPTIONS.includes(respuesta) ||
    typeof tiempo_ms !== "number"
  ) {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const { data: sala } = await supabase
    .from("arena_publica_salas")
    .select("id, status, pregunta_actual")
    .eq("id", sala_id)
    .maybeSingle();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  if (sala.status !== "playing") {
    return NextResponse.json({ error: "No se puede responder en este momento" }, { status: 400 });
  }

  // Solo puedes responder por tu propio jugador y en su sala.
  const { data: jugadorPropio } = await supabase
    .from("arena_publica_jugadores")
    .select("id")
    .eq("id", jugador_id)
    .eq("sala_id", sala.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!jugadorPropio) {
    return NextResponse.json({ error: "No eres jugador de esta sala" }, { status: 403 });
  }

  const { data: pregunta } = await supabase
    .from("arena_publica_preguntas")
    .select("id, sala_id, orden, question_id")
    .eq("id", pregunta_id)
    .maybeSingle();

  if (!pregunta || pregunta.sala_id !== sala.id) {
    return NextResponse.json({ error: "Pregunta no encontrada" }, { status: 404 });
  }
  if (pregunta.orden !== sala.pregunta_actual) {
    return NextResponse.json({ error: "Esta pregunta ya no está activa" }, { status: 400 });
  }

  // La respuesta correcta vive aparte, sin GRANTs públicos — solo el
  // service role client puede leerla. Ver 0021_arena_publica.sql.
  const { data: respuestaCorrecta } = await supabase
    .from("arena_publica_respuestas_correctas")
    .select("respuesta_correcta")
    .eq("pregunta_id", pregunta_id)
    .maybeSingle();

  const esCorrecta = respuesta === respuestaCorrecta?.respuesta_correcta;
  const tiempoClamped = Math.max(0, Math.min(tiempo_ms, ROUND_MS));
  const puntos = esCorrecta
    ? Math.max(100, Math.round(1000 * (1 - tiempoClamped / ROUND_MS)))
    : 0;

  const { error: insertError } = await supabase.from("arena_publica_respuestas").insert({
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

  if (pregunta.question_id) await registrarRespuesta(pregunta.question_id, esCorrecta);

  const { data: jugador } = await supabase
    .from("arena_publica_jugadores")
    .select("puntos")
    .eq("id", jugador_id)
    .single();

  await supabase
    .from("arena_publica_jugadores")
    .update({
      puntos: (jugador?.puntos ?? 0) + puntos,
      ultimo_respondido_at: new Date().toISOString(),
    })
    .eq("id", jugador_id);

  return NextResponse.json({ es_correcta: esCorrecta, puntos_obtenidos: puntos });
}

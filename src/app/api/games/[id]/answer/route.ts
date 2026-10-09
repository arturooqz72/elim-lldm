import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { preguntasDeJuego } from "@/lib/juegos/preguntas.server";
import { registrarRespuesta } from "@/lib/trivia/banco.server";
import type { AnswerOption } from "@/types";

const ANSWER_OPTIONS: AnswerOption[] = ["a", "b", "c", "d"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { questionId?: string; selectedOption?: AnswerOption; timeTakenMs?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  const { questionId, selectedOption, timeTakenMs } = body;
  if (!questionId || !selectedOption || !ANSWER_OPTIONS.includes(selectedOption) || typeof timeTakenMs !== "number") {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  // Todo con service role: la respuesta correcta, la respuesta guardada y
  // los puntos solo los toca el servidor (0071).
  const service = await createServiceClient();

  const { data: game } = await service
    .from("games")
    .select("id, status, question_set_id, current_question_index")
    .eq("id", id)
    .maybeSingle();

  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (game.status !== "in_progress") return NextResponse.json({ error: "Game not in progress" }, { status: 400 });

  const { data: player } = await service
    .from("game_players")
    .select("id, game_id")
    .eq("game_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!player) return NextResponse.json({ error: "Not a player in this game" }, { status: 403 });

  // Solo se puede responder la pregunta que está en curso.
  const preguntas = await preguntasDeJuego(game.question_set_id);
  const question = preguntas[game.current_question_index];
  if (!question || question.id !== questionId) {
    return NextResponse.json({ error: "Esta pregunta ya no está activa" }, { status: 400 });
  }

  const isCorrect = selectedOption === question.correct_option;

  // Calculate points with time bonus (faster = more points)
  const maxTime = question.time_limit_seconds * 1000;
  const tiempo = Math.max(0, Math.min(timeTakenMs, maxTime));
  const timeBonus = isCorrect
    ? Math.floor(question.points * (1 - tiempo / maxTime) * 0.5)
    : 0;
  const earnedPoints = isCorrect ? question.points + timeBonus : 0;

  // Insert answer (UNIQUE constraint prevents double-answering)
  const { error } = await service.from("game_answers").insert({
    game_id: id,
    question_id: questionId,
    player_id: player.id,
    selected_option: selectedOption,
    is_correct: isCorrect,
    time_taken_ms: tiempo,
  });

  if (error) {
    // UNIQUE violation = already answered
    return NextResponse.json({ error: "Already answered" }, { status: 409 });
  }

  await registrarRespuesta(question.id, isCorrect);

  // Update player score
  if (earnedPoints > 0) {
    await service.rpc("increment_player_score", {
      p_player_id: player.id,
      p_points: earnedPoints,
    });
  }

  return NextResponse.json({ isCorrect, earnedPoints });
}

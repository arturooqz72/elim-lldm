import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AnswerOption } from "@/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { questionId, selectedOption, timeTakenMs } = await request.json() as {
    questionId: string;
    selectedOption: AnswerOption;
    timeTakenMs: number;
  };

  // Get the game player record
  const { data: player } = await supabase
    .from("game_players")
    .select("id, game_id")
    .eq("game_id", id)
    .eq("user_id", user.id)
    .single();

  if (!player) return NextResponse.json({ error: "Not a player in this game" }, { status: 403 });

  // Get correct answer (server-side validation)
  const { data: questionRaw } = await supabase
    .from("questions")
    .select("correct_option, points, time_limit_seconds")
    .eq("id", questionId)
    .single();

  const question = questionRaw as {
    correct_option: string;
    points: number;
    time_limit_seconds: number;
  } | null;

  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const isCorrect = selectedOption === question.correct_option;

  // Calculate points with time bonus (faster = more points)
  const maxTime = question.time_limit_seconds * 1000;
  const timeBonus = isCorrect
    ? Math.floor(question.points * (1 - timeTakenMs / maxTime) * 0.5)
    : 0;
  const earnedPoints = isCorrect ? question.points + timeBonus : 0;

  // Insert answer (UNIQUE constraint prevents double-answering)
  const { error } = await supabase.from("game_answers").insert({
    game_id: id,
    question_id: questionId,
    player_id: player.id,
    selected_option: selectedOption,
    is_correct: isCorrect,
    time_taken_ms: timeTakenMs,
  });

  if (error) {
    // UNIQUE violation = already answered
    return NextResponse.json({ error: "Already answered" }, { status: 409 });
  }

  // Update player score
  if (earnedPoints > 0) {
    await supabase.rpc("increment_player_score", {
      player_id: player.id,
      points: earnedPoints,
    });
  }

  return NextResponse.json({ isCorrect, earnedPoints });
}

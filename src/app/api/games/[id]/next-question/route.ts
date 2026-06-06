import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .single();

  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (game.host_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (game.status !== "in_progress") return NextResponse.json({ error: "Game not in progress" }, { status: 400 });

  // Get all questions for this game
  const { data: questions } = await supabase
    .from("questions")
    .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, time_limit_seconds, points, order_index, bible_reference")
    .eq("question_set_id", game.question_set_id)
    .order("order_index");

  if (!questions) return NextResponse.json({ error: "No questions found" }, { status: 500 });

  const currentIndex = game.current_question_index;
  const nextIndex = currentIndex + 1;

  if (nextIndex >= questions.length) {
    return NextResponse.json({ error: "No more questions" }, { status: 400 });
  }

  const currentQuestion = questions[currentIndex];
  const nextQuestion = questions[nextIndex];
  const endsAt = Date.now() + nextQuestion.time_limit_seconds * 1000;

  await supabase
    .from("games")
    .update({ current_question_index: nextIndex })
    .eq("id", id);

  const channel = supabase.channel(`game:${id}`);

  // First broadcast: reveal correct answer for the question that just ended
  await channel.send({
    type: "broadcast",
    event: "QUESTION_END",
    payload: { correctOption: currentQuestion.correct_option },
  });

  // Then broadcast the next question (without correct_option)
  await channel.send({
    type: "broadcast",
    event: "QUESTION_START",
    payload: {
      questionIndex: nextIndex,
      endsAt,
    },
  });

  return NextResponse.json({ questionIndex: nextIndex, question: nextQuestion });
}

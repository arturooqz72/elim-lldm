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
    .select("*, question_sets(id), questions:question_sets(questions(*))")
    .eq("id", id)
    .single();

  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (game.host_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (game.status !== "lobby") return NextResponse.json({ error: "Game already started" }, { status: 400 });

  // Get first question to include endsAt in GAME_STARTED broadcast
  const { data: questions } = await supabase
    .from("questions")
    .select("id, time_limit_seconds")
    .eq("question_set_id", game.question_set_id)
    .order("order_index")
    .limit(1);

  const firstQuestion = questions?.[0];
  const endsAt = firstQuestion
    ? Date.now() + firstQuestion.time_limit_seconds * 1000
    : Date.now() + 30000;

  await supabase
    .from("games")
    .update({ status: "in_progress", started_at: new Date().toISOString(), current_question_index: 0 })
    .eq("id", id);

  const channel = supabase.channel(`game:${id}`);
  await channel.send({
    type: "broadcast",
    event: "GAME_STARTED",
    payload: { gameId: id, endsAt },
  });

  return NextResponse.json({ success: true });
}

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

  await supabase
    .from("games")
    .update({ status: "finished", finished_at: new Date().toISOString() })
    .eq("id", id);

  // Get final scores
  const { data: teams } = await supabase
    .from("game_teams")
    .select("*, game_players(id, score, profiles(display_name, avatar_url))")
    .eq("game_id", id)
    .order("score", { ascending: false });

  // Broadcast game finished
  const channel = supabase.channel(`game:${id}`);
  await channel.send({
    type: "broadcast",
    event: "GAME_FINISHED",
    payload: { teams },
  });

  return NextResponse.json({ success: true, teams });
}

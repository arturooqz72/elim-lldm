import { createClient, getProfile } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { GameHostPanel } from "./GameHostPanel";
import { preguntasDeJuego } from "@/lib/juegos/preguntas.server";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GameHostPage({ params }: Props) {
  const { id } = await params;

  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/admin");

  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select("id, title, status, join_code, current_question_index, question_set_id")
    .eq("id", id)
    .single();

  if (!game) notFound();
  const g = game as {
    id: string;
    title: string;
    status: string;
    join_code: string;
    current_question_index: number;
    question_set_id: string;
  };

  const [{ data: teamsRaw }, { data: playersRaw }, questionsRaw] = await Promise.all([
    supabase
      .from("game_teams")
      .select("id, name, color, score")
      .eq("game_id", id)
      .order("score", { ascending: false }),
    supabase
      .from("game_players")
      .select("id, user_id, team_id, score, profiles(display_name, avatar_url)")
      .eq("game_id", id)
      .order("score", { ascending: false }),
    preguntasDeJuego(g.question_set_id),
  ]);

  return (
    <GameHostPanel
      game={g}
      initialTeams={(teamsRaw ?? []) as Parameters<typeof GameHostPanel>[0]["initialTeams"]}
      initialPlayers={(playersRaw ?? []) as unknown as Parameters<typeof GameHostPanel>[0]["initialPlayers"]}
      questions={questionsRaw as Parameters<typeof GameHostPanel>[0]["questions"]}
    />
  );
}

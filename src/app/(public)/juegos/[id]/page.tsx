import { createClient, getProfile } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { GameRoom } from "@/components/juegos/GameRoom";
import { preguntasDeJuego } from "@/lib/juegos/preguntas.server";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("games").select("title").eq("id", id).single();
  return {
    title: data ? `${(data as { title: string }).title} — Elim LLDM` : "Juego — Elim LLDM",
  };
}

type TeamRow = { id: string; name: string; color: string; score: number };
type PlayerRow = {
  id: string;
  user_id: string;
  team_id: string | null;
  score: number;
  profiles: { display_name: string; avatar_url: string | null } | null;
};
type QuestionRow = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  bible_reference: string | null;
  time_limit_seconds: number;
  points: number;
};

export default async function GameRoomPage({ params }: Props) {
  const { id } = await params;

  const profile = await getProfile();
  if (!profile) {
    redirect(`/login?returnUrl=/juegos/${id}`);
  }

  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select(
      "id, title, join_code, status, current_question_index, host_id, question_set_id, profiles(display_name)"
    )
    .eq("id", id)
    .single();

  if (!game) notFound();

  const g = game as unknown as {
    id: string;
    title: string;
    join_code: string;
    status: string;
    current_question_index: number;
    host_id: string;
    question_set_id: string;
    profiles: { display_name: string } | null;
  };

  const [{ data: teamsRaw }, { data: playersRaw }, preguntas] = await Promise.all([
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

  const teams = (teamsRaw ?? []) as unknown as TeamRow[];
  let players = (playersRaw ?? []) as unknown as PlayerRow[];
  // Al navegador del jugador nunca le llega la respuesta correcta: la
  // revela el servidor (QUESTION_END) cuando termina cada pregunta.
  const questions: QuestionRow[] = preguntas.map((q) => ({
    id: q.id,
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    bible_reference: q.bible_reference,
    time_limit_seconds: q.time_limit_seconds,
    points: q.points,
  }));

  // Auto-join in lobby if not already a player
  const existingPlayer = players.find((p) => p.user_id === profile.id);
  if (!existingPlayer && g.status === "lobby") {
    await supabase
      .from("game_players")
      .upsert({ game_id: id, user_id: profile.id, score: 0 }, { onConflict: "game_id,user_id" });

    const { data: updated } = await supabase
      .from("game_players")
      .select("id, user_id, team_id, score, profiles(display_name, avatar_url)")
      .eq("game_id", id)
      .order("score", { ascending: false });

    if (updated) players = updated as unknown as PlayerRow[];
  }

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <GameRoom
        gameId={id}
        title={g.title}
        joinCode={g.join_code}
        initialStatus={g.status}
        initialQuestionIndex={g.current_question_index}
        initialTeams={teams}
        initialPlayers={players}
        questions={questions}
        currentUserId={profile.id}
      />
    </div>
  );
}

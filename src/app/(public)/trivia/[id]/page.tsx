import { createClient, getProfile } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { TriviaRoom } from "@/components/trivia/TriviaRoom";
import type { Metadata } from "next";
import type { TriviaDifficulty, TriviaStatus } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("trivia_rooms").select("name").eq("id", id).single();
  return {
    title: data ? `${(data as { name: string }).name} — Trivia en Vivo` : "Sala de Trivia — Elim LLDM",
  };
}

type RoomRecord = {
  id: string;
  name: string;
  category: string;
  difficulty: TriviaDifficulty;
  status: TriviaStatus;
  join_code: string;
  host_id: string;
  current_question_index: number;
  profiles: { display_name: string } | null;
};

type TeamRow = { id: string; name: string; color: string; score: number; created_by: string };
type PlayerRow = {
  id: string;
  user_id: string;
  team_id: string | null;
  score: number;
  profiles: { display_name: string; avatar_url: string | null } | null;
};

export default async function TriviaRoomPage({ params }: Props) {
  const { id } = await params;

  const profile = await getProfile();
  if (!profile) {
    redirect(`/login?returnUrl=/trivia/${id}`);
  }

  const supabase = await createClient();

  const { data: room } = await supabase
    .from("trivia_rooms")
    .select(
      "id, name, category, difficulty, status, join_code, host_id, current_question_index, profiles(display_name)"
    )
    .eq("id", id)
    .single();

  if (!room) notFound();

  const r = room as unknown as RoomRecord;

  const [{ data: teamsRaw }, { data: playersRaw }] = await Promise.all([
    supabase
      .from("trivia_teams")
      .select("id, name, color, score, created_by")
      .eq("room_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("trivia_players")
      .select("id, user_id, team_id, score, profiles(display_name, avatar_url)")
      .eq("room_id", id)
      .order("joined_at", { ascending: true }),
  ]);

  const teams = (teamsRaw ?? []) as unknown as TeamRow[];
  let players = (playersRaw ?? []) as unknown as PlayerRow[];

  // Auto-join as a player while the room is still in its lobby
  const existingPlayer = players.find((p) => p.user_id === profile.id);
  if (!existingPlayer && r.status === "lobby") {
    await supabase
      .from("trivia_players")
      .upsert({ room_id: id, user_id: profile.id, score: 0 }, { onConflict: "room_id,user_id" });

    const { data: updated } = await supabase
      .from("trivia_players")
      .select("id, user_id, team_id, score, profiles(display_name, avatar_url)")
      .eq("room_id", id)
      .order("joined_at", { ascending: true });

    if (updated) players = updated as unknown as PlayerRow[];
  }

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <TriviaRoom
        roomId={id}
        name={r.name}
        category={r.category}
        difficulty={r.difficulty}
        joinCode={r.join_code}
        hostId={r.host_id}
        hostName={r.profiles?.display_name ?? "Anfitrión"}
        initialStatus={r.status}
        initialTeams={teams}
        initialPlayers={players}
        currentUserId={profile.id}
      />
    </div>
  );
}

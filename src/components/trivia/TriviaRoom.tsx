"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TriviaWaitingRoom } from "./TriviaWaitingRoom";
import { ArrowLeft, Sparkles, Clock } from "lucide-react";
import Link from "next/link";
import type { TriviaDifficulty, TriviaStatus } from "@/types";

interface Team {
  id: string;
  name: string;
  color: string;
  score: number;
  created_by: string;
}

interface Player {
  id: string;
  user_id: string;
  team_id: string | null;
  score: number;
  profiles: { display_name: string; avatar_url: string | null } | null;
}

interface TriviaRoomProps {
  roomId: string;
  name: string;
  category: string;
  difficulty: TriviaDifficulty;
  joinCode: string;
  hostId: string;
  hostName: string;
  initialStatus: TriviaStatus;
  initialTeams: Team[];
  initialPlayers: Player[];
  currentUserId: string;
}

const STATUS_BADGE: Record<TriviaStatus, { label: string; bg: string; border: string; color: string }> = {
  lobby: {
    label: "SALA DE ESPERA",
    bg: "rgba(245,200,66,0.12)",
    border: "rgba(245,200,66,0.3)",
    color: "var(--trivia-gold)",
  },
  in_progress: {
    label: "EN VIVO",
    bg: "rgba(74,222,128,0.1)",
    border: "rgba(74,222,128,0.3)",
    color: "var(--color-success)",
  },
  finished: {
    label: "TERMINADA",
    bg: "var(--color-surface-elevated)",
    border: "var(--color-border)",
    color: "var(--color-text-muted)",
  },
};

export function TriviaRoom({
  roomId,
  name,
  category,
  difficulty,
  joinCode,
  hostId,
  hostName,
  initialStatus,
  initialTeams,
  initialPlayers,
  currentUserId,
}: TriviaRoomProps) {
  const [status, setStatus] = useState<TriviaStatus>(initialStatus);
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const isHost = currentUserId === hostId;

  useEffect(() => {
    const supabase = createClient();

    const roomChannel = supabase
      .channel(`trivia-room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trivia_rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const next = payload.new as { status: TriviaStatus };
          if (next.status) setStatus(next.status);
        }
      )
      .subscribe();

    const teamsChannel = supabase
      .channel(`trivia-teams:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trivia_teams", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            setTeams((prev) =>
              prev.some((t) => t.id === (payload.new as Team).id) ? prev : [...prev, payload.new as Team]
            );
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Team;
            setTeams((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
          } else if (payload.eventType === "DELETE") {
            const removed = payload.old as { id: string };
            setTeams((prev) => prev.filter((t) => t.id !== removed.id));
          }
        }
      )
      .subscribe();

    const playersChannel = supabase
      .channel(`trivia-players:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trivia_players", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const { data } = await supabase
              .from("trivia_players")
              .select("id, user_id, team_id, score, profiles(display_name, avatar_url)")
              .eq("id", (payload.new as { id: string }).id)
              .single();
            if (data) {
              const updated = data as unknown as Player;
              setPlayers((prev) => {
                const exists = prev.find((p) => p.id === updated.id);
                if (exists) return prev.map((p) => (p.id === updated.id ? updated : p));
                return [...prev, updated];
              });
            }
          } else if (payload.eventType === "DELETE") {
            const removed = payload.old as { id: string };
            setPlayers((prev) => prev.filter((p) => p.id !== removed.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(teamsChannel);
      supabase.removeChannel(playersChannel);
    };
  }, [roomId]);

  const badge = STATUS_BADGE[status];

  return (
    <>
      <style>{`
        .trivia-back:hover { color: var(--trivia-gold) !important; }
      `}</style>

      {/* Header bar */}
      <div
        className="px-4 py-3"
        style={{ borderBottom: "1px solid var(--color-border)", background: "rgba(10,10,18,0.95)" }}
      >
        <div className="max-w-md mx-auto flex items-center gap-3">
          <Link
            href="/trivia"
            className="trivia-back flex items-center gap-1.5 text-sm shrink-0 transition-colors"
            style={{ color: "var(--color-text-muted)" }}
          >
            <ArrowLeft size={14} />
            Trivia
          </Link>

          <span
            className="px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0"
            style={{ background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color }}
          >
            {badge.label}
          </span>

          <span className="flex-1 font-semibold text-sm truncate" style={{ color: "var(--color-text)" }}>
            {name}
          </span>
        </div>
      </div>

      <div className="px-4 py-6">
        {status === "lobby" ? (
          <TriviaWaitingRoom
            roomId={roomId}
            name={name}
            category={category}
            difficulty={difficulty}
            joinCode={joinCode}
            hostName={hostName}
            isHost={isHost}
            teams={teams}
            players={players}
            currentUserId={currentUserId}
          />
        ) : (
          <PlaceholderPhase status={status} />
        )}
      </div>
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function PlaceholderPhase({ status }: { status: TriviaStatus }) {
  return (
    <div className="max-w-md mx-auto flex flex-col items-center text-center gap-3 py-16">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(245,200,66,0.1)" }}
      >
        {status === "in_progress" ? (
          <Sparkles size={26} style={{ color: "var(--trivia-gold)" }} />
        ) : (
          <Clock size={26} style={{ color: "var(--color-text-muted)" }} />
        )}
      </div>
      <div>
        <p className="font-medium text-sm" style={{ color: "var(--color-text)" }}>
          {status === "in_progress" ? "La partida está en curso" : "Esta sala ya terminó"}
        </p>
        <p className="text-xs mt-1 max-w-xs" style={{ color: "var(--color-text-muted)" }}>
          {status === "in_progress"
            ? "La vista de preguntas y marcador en vivo llega en la próxima fase de Trivia en Vivo."
            : "Vuelve al lobby para encontrar otras salas activas."}
        </p>
      </div>
      <Link
        href="/trivia"
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold mt-1"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
      >
        <ArrowLeft size={14} />
        Ver otras salas
      </Link>
    </div>
  );
}

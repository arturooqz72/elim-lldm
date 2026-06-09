"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, Copy, Check, Loader2, Plus, Crown } from "lucide-react";
import { TRIVIA_DIFFICULTY_LABEL } from "@/types";
import type { TriviaDifficulty } from "@/types";

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

interface TriviaWaitingRoomProps {
  roomId: string;
  name: string;
  category: string;
  difficulty: TriviaDifficulty;
  joinCode: string;
  hostName: string;
  isHost: boolean;
  teams: Team[];
  players: Player[];
  currentUserId: string;
}

const TEAM_COLORS = ["#f5c842", "#60a5fa", "#4ade80", "#f87171", "#c084fc", "#22d3ee"];

export function TriviaWaitingRoom({
  roomId,
  category,
  difficulty,
  joinCode,
  hostName,
  isHost,
  teams,
  players,
  currentUserId,
}: TriviaWaitingRoomProps) {
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamColor, setTeamColor] = useState(TEAM_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  const me = players.find((p) => p.user_id === currentUserId);
  const myTeamId = me?.team_id ?? null;
  const unassigned = players.filter((p) => !p.team_id);

  function copyCode() {
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = teamName.trim();
    if (!trimmed || creating) return;
    setError(null);
    setCreating(true);
    const supabase = createClient();

    const { data: team, error: insertError } = await supabase
      .from("trivia_teams")
      .insert({ room_id: roomId, name: trimmed, color: teamColor, created_by: currentUserId })
      .select("id")
      .single();

    if (insertError || !team) {
      setError(
        insertError?.code === "23505" ? "Ya existe un equipo con ese nombre en esta sala." : "No se pudo crear el equipo."
      );
      setCreating(false);
      return;
    }

    await supabase
      .from("trivia_players")
      .upsert(
        { room_id: roomId, user_id: currentUserId, team_id: (team as { id: string }).id, score: 0 },
        { onConflict: "room_id,user_id" }
      );

    setTeamName("");
    setCreating(false);
  }

  async function joinTeam(teamId: string) {
    if (joining || myTeamId === teamId) return;
    setJoining(teamId);
    const supabase = createClient();
    await supabase
      .from("trivia_players")
      .upsert(
        { room_id: roomId, user_id: currentUserId, team_id: teamId, score: 0 },
        { onConflict: "room_id,user_id" }
      );
    setJoining(null);
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-5">
      {/* Join code — large, stream-friendly */}
      <div
        className="rounded-2xl p-5 text-center"
        style={{ background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.25)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--trivia-gold)" }}>
          Código para unirse
        </p>
        <button onClick={copyCode} className="group inline-flex items-center gap-2.5">
          <span
            className="text-4xl font-black font-mono"
            style={{ color: "var(--color-text)", letterSpacing: "0.2em" }}
          >
            {joinCode}
          </span>
          {copied ? (
            <Check size={20} style={{ color: "var(--color-success)" }} />
          ) : (
            <Copy
              size={18}
              className="opacity-60 transition-opacity group-hover:opacity-100"
              style={{ color: "var(--color-text-muted)" }}
            />
          )}
        </button>
        <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
          {category} · {TRIVIA_DIFFICULTY_LABEL[difficulty]} · Anfitrión {hostName}
        </p>
      </div>

      {/* Connected players */}
      <div className="flex items-center justify-center gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
        <Users size={15} />
        <span>
          {players.length} {players.length === 1 ? "jugador conectado" : "jugadores conectados"}
        </span>
      </div>

      {/* Create team */}
      <form
        onSubmit={createTeam}
        className="rounded-xl p-4 flex flex-col gap-3"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--color-text)" }}>
          <Plus size={15} style={{ color: "var(--trivia-gold)" }} />
          Crea tu equipo
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value.slice(0, 40))}
            placeholder="Nombre del equipo"
            maxLength={40}
            className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
          <button
            type="submit"
            disabled={!teamName.trim() || creating}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold shrink-0 min-w-[72px] flex items-center justify-center"
            style={{
              background: !teamName.trim() || creating ? "var(--color-surface-elevated)" : "var(--trivia-gold)",
              color: !teamName.trim() || creating ? "var(--color-text-muted)" : "#1a1500",
            }}
          >
            {creating ? <Loader2 size={15} className="animate-spin" /> : "Crear"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Color:
          </span>
          {TEAM_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setTeamColor(c)}
              aria-label={`Color ${c}`}
              className="w-6 h-6 rounded-full transition-transform duration-150"
              style={{
                background: c,
                border: teamColor === c ? "2px solid var(--color-text)" : "2px solid transparent",
                transform: teamColor === c ? "scale(1.2)" : "scale(1)",
              }}
            />
          ))}
        </div>
        {error && (
          <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
            {error}
          </p>
        )}
      </form>

      {/* Teams */}
      {teams.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
            Equipos ({teams.length})
          </p>
          {teams.map((team) => {
            const roster = players.filter((p) => p.team_id === team.id);
            const isMine = myTeamId === team.id;
            const isJoining = joining === team.id;
            return (
              <div
                key={team.id}
                className="rounded-xl p-3.5"
                style={{
                  background: "var(--color-surface)",
                  border: `1px solid ${isMine ? team.color : "var(--color-border)"}`,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: team.color }} />
                    <span className="font-semibold text-sm truncate" style={{ color: "var(--color-text)" }}>
                      {team.name}
                    </span>
                    <span className="text-xs shrink-0" style={{ color: "var(--color-text-muted)" }}>
                      {roster.length} {roster.length === 1 ? "jugador" : "jugadores"}
                    </span>
                  </div>
                  <button
                    onClick={() => joinTeam(team.id)}
                    disabled={!!joining || isMine}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5"
                    style={{
                      background: isMine ? `${team.color}22` : "var(--color-surface-elevated)",
                      border: `1px solid ${isMine ? team.color : "var(--color-border)"}`,
                      color: isMine ? team.color : "var(--color-text)",
                    }}
                  >
                    {isJoining ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : isMine ? (
                      <Check size={12} />
                    ) : null}
                    {isMine ? "Tu equipo" : "Unirme"}
                  </button>
                </div>
                {roster.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {roster.map((p) => (
                      <span
                        key={p.id}
                        className="px-2 py-1 rounded-full text-xs truncate max-w-[140px]"
                        style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-muted)" }}
                      >
                        {p.profiles?.display_name ?? "Jugador"}
                        {p.user_id === currentUserId && " (tú)"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Players without a team yet */}
      {unassigned.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
            Sin equipo ({unassigned.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unassigned.map((p) => (
              <span
                key={p.id}
                className="px-2.5 py-1 rounded-full text-xs"
                style={{
                  background: "var(--color-surface-elevated)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-muted)",
                }}
              >
                {p.profiles?.display_name ?? "Jugador"}
                {p.user_id === currentUserId && " (tú)"}
              </span>
            ))}
          </div>
        </div>
      )}

      {isHost && (
        <div
          className="rounded-xl p-3.5 flex items-center gap-2.5"
          style={{ background: "rgba(245,200,66,0.06)", border: "1px solid rgba(245,200,66,0.2)" }}
        >
          <Crown size={16} style={{ color: "var(--trivia-gold)" }} />
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Eres el anfitrión de esta sala. El inicio de la partida llega en la próxima fase de Trivia en Vivo.
          </p>
        </div>
      )}
    </div>
  );
}

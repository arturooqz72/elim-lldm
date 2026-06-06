"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Team {
  id: string;
  name: string;
  color: string;
  player_count?: number;
}

interface TeamSelectProps {
  gameId: string;
  currentUserId: string;
  teams: Team[];
  selectedTeamId: string | null;
  onSelect: (teamId: string) => void;
}

export function TeamSelect({
  gameId,
  currentUserId,
  teams,
  selectedTeamId,
  onSelect,
}: TeamSelectProps) {
  const [loading, setLoading] = useState<string | null>(null);

  async function joinTeam(teamId: string) {
    if (loading || selectedTeamId === teamId) return;
    setLoading(teamId);
    const supabase = createClient();

    await supabase
      .from("game_players")
      .upsert(
        { game_id: gameId, user_id: currentUserId, team_id: teamId, score: 0 },
        { onConflict: "game_id,user_id" }
      );

    onSelect(teamId);
    setLoading(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-text-muted)" }}>
        Elige tu equipo
      </p>
      <div className="grid grid-cols-2 gap-2">
        {teams.map((team) => {
          const isSelected = selectedTeamId === team.id;
          const isLoading = loading === team.id;

          return (
            <button
              key={team.id}
              onClick={() => joinTeam(team.id)}
              disabled={!!loading}
              className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{
                background: isSelected
                  ? `${team.color}22`
                  : "var(--color-surface-elevated)",
                border: `1px solid ${isSelected ? team.color : "var(--color-border)"}`,
                color: isSelected ? team.color : "var(--color-text)",
              }}
            >
              <span className="truncate">{team.name}</span>
              {isLoading ? (
                <Loader2 size={14} className="animate-spin shrink-0 ml-2" />
              ) : isSelected ? (
                <Check size={14} className="shrink-0 ml-2" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

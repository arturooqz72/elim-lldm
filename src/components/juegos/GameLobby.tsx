"use client";

import { Users } from "lucide-react";
import { TeamSelect } from "./TeamSelect";

interface Team {
  id: string;
  name: string;
  color: string;
}

interface Player {
  id: string;
  user_id: string;
  team_id: string | null;
  profiles: { display_name: string; avatar_url: string | null } | null;
}

interface GameLobbyProps {
  gameId: string;
  teams: Team[];
  players: Player[];
  currentUserId: string;
  selectedTeamId: string | null;
  onTeamSelect: (teamId: string) => void;
}

export function GameLobby({
  gameId,
  teams,
  players,
  currentUserId,
  selectedTeamId,
  onTeamSelect,
}: GameLobbyProps) {
  const playersWithoutTeam = players.filter((p) => p.team_id === null);

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">

      {/* Waiting indicator */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-3">
          <PulsingDot />
          <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Esperando que el anfitrión inicie la partida
          </span>
        </div>
        <span
          className="px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0"
          style={{
            background: "rgba(212,160,23,0.1)",
            border: "1px solid rgba(212,160,23,0.2)",
            color: "var(--color-primary)",
          }}
        >
          {players.length} {players.length === 1 ? "jugador" : "jugadores"}
        </span>
      </div>

      {/* Team selection */}
      {teams.length > 0 && (
        <div
          className="rounded-2xl p-5"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <TeamSelect
            gameId={gameId}
            currentUserId={currentUserId}
            teams={teams}
            selectedTeamId={selectedTeamId}
            onSelect={onTeamSelect}
          />
        </div>
      )}

      {/* Players list */}
      <div
        className="rounded-2xl p-5"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Users size={15} style={{ color: "var(--color-primary)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            Jugadores en sala
          </span>
        </div>

        {teams.length > 0 ? (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-5">
              {teams.map((team) => {
                const teamPlayers = players.filter((p) => p.team_id === team.id);
                return (
                  <div key={team.id}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: team.color }}
                      />
                      <p className="text-xs font-bold" style={{ color: team.color }}>
                        {team.name}{" "}
                        <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>
                          ({teamPlayers.length})
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 pl-4">
                      {teamPlayers.length === 0 ? (
                        <p className="text-xs italic" style={{ color: "var(--color-text-muted)" }}>
                          Sin jugadores aún
                        </p>
                      ) : (
                        teamPlayers.map((player) => (
                          <PlayerRow
                            key={player.id}
                            player={player}
                            isMe={player.user_id === currentUserId}
                            accentColor={team.color}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {playersWithoutTeam.length > 0 && (
              <div
                className="pt-4"
                style={{ borderTop: "1px solid var(--color-border)" }}
              >
                <p className="text-xs font-semibold mb-2.5" style={{ color: "var(--color-text-muted)" }}>
                  Sin equipo ({playersWithoutTeam.length})
                </p>
                <div className="flex flex-col gap-1.5">
                  {playersWithoutTeam.map((player) => (
                    <PlayerRow
                      key={player.id}
                      player={player}
                      isMe={player.user_id === currentUserId}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {players.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                Aún no hay jugadores
              </p>
            ) : (
              players.map((player) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  isMe={player.user_id === currentUserId}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function PulsingDot() {
  return (
    <div className="relative flex items-center justify-center w-3 h-3 shrink-0">
      <div
        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
        style={{ background: "var(--color-primary)" }}
      />
      <div
        className="relative inline-flex rounded-full w-2 h-2"
        style={{ background: "var(--color-primary)" }}
      />
    </div>
  );
}

function PlayerRow({
  player,
  isMe,
  accentColor,
}: {
  player: { user_id: string; profiles: { display_name: string; avatar_url: string | null } | null };
  isMe: boolean;
  accentColor?: string;
}) {
  const initial = player.profiles?.display_name?.[0]?.toUpperCase() ?? "?";
  const avatarBg = accentColor ? `${accentColor}33` : "rgba(212,160,23,0.15)";
  const avatarColor = accentColor ?? "var(--color-primary)";

  return (
    <div className="flex items-center gap-2">
      {player.profiles?.avatar_url ? (
        <img
          src={player.profiles.avatar_url}
          alt={player.profiles.display_name}
          className="w-6 h-6 rounded-full object-cover shrink-0"
        />
      ) : (
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: avatarBg, color: avatarColor }}
        >
          {initial}
        </div>
      )}
      <span
        className="text-sm truncate"
        style={{
          color: isMe ? "var(--color-primary)" : "var(--color-text)",
          fontWeight: isMe ? 600 : 400,
        }}
      >
        {player.profiles?.display_name ?? "Jugador"}
        {isMe && " (tú)"}
      </span>
    </div>
  );
}

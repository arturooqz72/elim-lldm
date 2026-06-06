"use client";

import { Trophy, Medal } from "lucide-react";

interface Team {
  id: string;
  name: string;
  color: string;
  score: number;
}

interface Player {
  id: string;
  user_id: string;
  score: number;
  team_id: string | null;
  profiles: { display_name: string; avatar_url: string | null } | null;
}

interface ScoreboardProps {
  teams: Team[];
  players: Player[];
  currentUserId: string;
  isFinal?: boolean;
}

const RANK_COLORS = ["#D4A017", "#C0C0C0", "#CD7F32"];

export function Scoreboard({ teams, players, currentUserId, isFinal }: ScoreboardProps) {
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score).slice(0, 10);
  const winner = sortedTeams[0];

  return (
    <div className="flex flex-col gap-4">

      {/* Final state header */}
      {isFinal && (
        <div
          className="flex flex-col items-center py-8 gap-4 rounded-2xl"
          style={{
            background:
              winner
                ? `linear-gradient(135deg, ${winner.color}10 0%, var(--color-surface) 60%)`
                : "var(--color-surface)",
            border: winner
              ? `1px solid ${winner.color}40`
              : "1px solid var(--color-border)",
          }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: "rgba(212,160,23,0.1)",
              border: "1px solid rgba(212,160,23,0.3)",
            }}
          >
            <Trophy size={32} style={{ color: "var(--color-primary)" }} />
          </div>

          <div className="text-center flex flex-col gap-1">
            <h3 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
              ¡Partida terminada!
            </h3>
            {winner && winner.score > 0 ? (
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Ganador:{" "}
                <span className="font-bold" style={{ color: winner.color }}>
                  {winner.name}
                </span>{" "}
                con{" "}
                <span className="font-bold" style={{ color: "var(--color-primary)" }}>
                  {winner.score.toLocaleString()} pts
                </span>
              </p>
            ) : sortedPlayers.length > 0 && sortedPlayers[0].score > 0 ? (
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Mejor jugador:{" "}
                <span className="font-bold" style={{ color: "var(--color-primary)" }}>
                  {sortedPlayers[0].profiles?.display_name ?? "Jugador"}
                </span>
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* Team scores */}
      {teams.length > 0 && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div
            className="px-4 py-3 flex items-center gap-2"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <Trophy size={14} style={{ color: "var(--color-primary)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              Equipos
            </span>
          </div>

          <div className="p-3 flex flex-col gap-2">
            {sortedTeams.map((team, idx) => {
              const rankColor = RANK_COLORS[idx] ?? "var(--color-text-muted)";
              const isFirst = idx === 0;

              return (
                <div
                  key={team.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{
                    background:
                      isFirst && isFinal
                        ? `${team.color}15`
                        : "var(--color-surface-elevated)",
                    border: `1px solid ${isFirst && isFinal ? `${team.color}50` : "var(--color-border)"}`,
                  }}
                >
                  <span
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                    style={{
                      background: `${rankColor}18`,
                      color: rankColor,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: team.color }}
                  />
                  <span
                    className="flex-1 text-sm font-medium truncate"
                    style={{ color: "var(--color-text)" }}
                  >
                    {team.name}
                  </span>
                  <span
                    className="font-mono font-bold text-sm"
                    style={{ color: isFirst ? team.color : "var(--color-text-muted)" }}
                  >
                    {team.score.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Player leaderboard */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div
          className="px-4 py-3 flex items-center gap-2"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <Medal size={14} style={{ color: "var(--color-primary)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {isFinal ? "Clasificación final" : "Jugadores"}
          </span>
        </div>

        <div className="p-3 flex flex-col gap-1.5">
          {sortedPlayers.length === 0 ? (
            <p className="text-xs text-center py-3" style={{ color: "var(--color-text-muted)" }}>
              Sin puntuaciones aún
            </p>
          ) : (
            sortedPlayers.map((player, idx) => {
              const isMe = player.user_id === currentUserId;
              const team = teams.find((t) => t.id === player.team_id);
              const rankColor = RANK_COLORS[idx] ?? null;

              return (
                <div
                  key={player.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                  style={{
                    background: isMe
                      ? "rgba(212,160,23,0.08)"
                      : "var(--color-surface-elevated)",
                    border: `1px solid ${isMe ? "rgba(212,160,23,0.2)" : "transparent"}`,
                  }}
                >
                  {isFinal && rankColor ? (
                    <span
                      className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: `${rankColor}20`, color: rankColor }}
                    >
                      {idx + 1}
                    </span>
                  ) : (
                    <span
                      className="text-xs font-bold w-5 text-center shrink-0"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {idx + 1}
                    </span>
                  )}

                  {team && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: team.color }}
                    />
                  )}

                  {player.profiles?.avatar_url ? (
                    <img
                      src={player.profiles.avatar_url}
                      alt={player.profiles.display_name}
                      className="w-5 h-5 rounded-full object-cover shrink-0"
                    />
                  ) : null}

                  <span
                    className="flex-1 text-sm truncate"
                    style={{
                      color: isMe ? "var(--color-primary)" : "var(--color-text)",
                      fontWeight: isMe ? 600 : 400,
                    }}
                  >
                    {player.profiles?.display_name ?? "Jugador"}
                    {isMe && " (tú)"}
                  </span>

                  <span
                    className="font-mono text-xs font-bold"
                    style={{
                      color:
                        isFinal && idx === 0
                          ? "var(--color-primary)"
                          : "var(--color-text-muted)",
                    }}
                  >
                    {player.score.toLocaleString()}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

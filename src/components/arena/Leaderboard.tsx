"use client";

import { Crown } from "lucide-react";
import type { ArenaJugador } from "@/types";

interface LeaderboardProps {
  jugadores: ArenaJugador[];
  meId?: string | null;
  limit?: number;
}

const RANK_COLORS = ["#D4A017", "#C0C0C0", "#CD7F32"];

export function Leaderboard({ jugadores, meId, limit = 10 }: LeaderboardProps) {
  const sorted = [...jugadores].sort((a, b) => b.puntos - a.puntos).slice(0, limit);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <Crown size={16} style={{ color: "var(--color-primary)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Tabla de líderes
        </span>
      </div>

      <div className="p-3 flex flex-col gap-2">
        {sorted.length === 0 ? (
          <p className="text-sm text-center py-3" style={{ color: "var(--color-text-muted)" }}>
            Aún no hay jugadores
          </p>
        ) : (
          sorted.map((jugador, idx) => {
            const isMe = jugador.id === meId;
            const rankColor = RANK_COLORS[idx] ?? null;
            const initial = jugador.nombre[0]?.toUpperCase() ?? "?";

            return (
              <div
                key={jugador.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{
                  background: isMe ? "rgba(212,160,23,0.08)" : "var(--color-surface-elevated)",
                  border: `1px solid ${isMe ? "rgba(212,160,23,0.25)" : "transparent"}`,
                }}
              >
                <span
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                  style={{
                    background: rankColor ? `${rankColor}22` : "transparent",
                    color: rankColor ?? "var(--color-text-muted)",
                  }}
                >
                  {idx + 1}
                </span>
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-base font-bold shrink-0"
                  style={{ background: "rgba(212,160,23,0.15)", color: "var(--color-primary)" }}
                >
                  {initial}
                </span>
                <span
                  className="flex-1 text-base font-medium truncate"
                  style={{
                    color: isMe ? "var(--color-primary)" : "var(--color-text)",
                    fontWeight: isMe ? 700 : 500,
                  }}
                >
                  {jugador.nombre}
                  {isMe && " (tú)"}
                </span>
                <span className="font-mono font-bold text-base" style={{ color: "var(--color-text)" }}>
                  {jugador.puntos.toLocaleString()}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

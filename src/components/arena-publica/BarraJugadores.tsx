"use client";

import { Check } from "lucide-react";
import type { ArenaJugador } from "@/types";
import { AvatarJugador } from "./AvatarJugador";

interface BarraJugadoresProps {
  jugadores: ArenaJugador[];
  meId: string | null;
  /** Puntos que se muestran: se actualizan al terminar cada pregunta, no al instante. */
  puntos: Record<string, number>;
  /** null = no hay pregunta en curso (no se muestra ✓ ni …). */
  respondio: ((j: ArenaJugador) => boolean) | null;
  avatarDe: (j: ArenaJugador) => string | null;
  conectado: (j: ArenaJugador) => boolean;
  /** "fila" = celular (horizontal con scroll); "columna" = panel lateral en pantallas grandes. */
  variante: "fila" | "columna";
}

/**
 * Jugadores durante la partida, ordenados por puntos: nombre, puntos, si ya
 * respondió la pregunta actual (✓) o sigue pensando (…). Quien se
 * desconectó se ve atenuado; "Tú" resaltado.
 */
export function BarraJugadores({ jugadores, meId, puntos, respondio, avatarDe, conectado, variante }: BarraJugadoresProps) {
  const ordenados = [...jugadores].sort(
    (a, b) => (puntos[b.id] ?? 0) - (puntos[a.id] ?? 0) || a.created_at.localeCompare(b.created_at)
  );
  const fila = variante === "fila";

  return (
    <ol
      aria-label="Jugadores"
      className={
        fila
          ? "flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "flex flex-col gap-2"
      }
    >
      {ordenados.map((j, i) => {
        const esYo = j.id === meId;
        const enLinea = conectado(j);
        const yaRespondio = respondio ? respondio(j) : null;
        return (
          <li
            key={j.id}
            className={`flex items-center gap-2 rounded-xl shrink-0 transition-opacity ${fila ? "pl-1.5 pr-2.5 py-1.5" : "px-3 py-2"}`}
            style={{
              background: esYo ? "rgba(212,160,23,0.12)" : "var(--color-surface)",
              border: `1px solid ${esYo ? "rgba(212,160,23,0.5)" : "var(--color-border)"}`,
              opacity: enLinea ? 1 : 0.4,
              maxWidth: fila ? 160 : undefined,
            }}
            title={enLinea ? undefined : "Desconectado"}
          >
            <span className="text-[11px] font-bold w-4 text-center tabular-nums" style={{ color: "var(--color-text-muted)" }}>
              {i + 1}
            </span>
            <div className="relative shrink-0">
              <AvatarJugador nombre={j.nombre} avatar={avatarDe(j)} tam={fila ? 28 : 32} />
              {yaRespondio !== null && (
                <span
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold leading-none"
                  style={{
                    background: yaRespondio ? "var(--color-success)" : "var(--color-surface-elevated)",
                    color: yaRespondio ? "#000" : "var(--color-text-muted)",
                    border: "1.5px solid var(--color-bg)",
                  }}
                  aria-label={yaRespondio ? "Ya respondió" : "Pensando"}
                >
                  {yaRespondio ? <Check size={10} strokeWidth={3.5} /> : "…"}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-xs font-semibold truncate leading-tight"
                style={{ color: esYo ? "var(--color-primary)" : "var(--color-text)" }}
              >
                {esYo ? "Tú" : j.nombre}
              </p>
              <p className="text-[11px] font-mono font-bold leading-tight tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                {(puntos[j.id] ?? 0).toLocaleString()} pts
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

import { Trophy } from "lucide-react";
import type { FilaPosicion } from "@/types";

interface TablaPosicionesProps {
  titulo: string;
  filas: FilaPosicion[];
  /** Miembro que está viendo la página, para resaltar su propia fila. null si no inició sesión. */
  currentUserId?: string | null;
  /** Texto cuando todavía no hay ninguna partida terminada de este juego. */
  vacio?: string;
  /** Para juegos donde "partida" no aplica (ej. Ahorcado: "palabra"/"palabras"). */
  unidadSingular?: string;
  unidadPlural?: string;
}

// Mismos oro/plata/bronce que arena/Leaderboard.tsx y juegos/Scoreboard.tsx,
// para que el ranking global se lea igual que el de la partida en curso.
const RANK_COLORS = ["#D4A017", "#C0C0C0", "#CD7F32"];

/**
 * Tabla de posiciones global de un juego: lugar, jugador y puntos acumulados.
 *
 * Componente de servidor (sin "use client"): son datos ya resueltos que no
 * cambian con la interacción, así que no hace falta mandar JS al navegador.
 */
export function TablaPosiciones({
  titulo,
  filas,
  currentUserId,
  vacio = "Aún no hay partidas terminadas. ¡Sé el primero en aparecer aquí!",
  unidadSingular = "partida",
  unidadPlural = "partidas",
}: TablaPosicionesProps) {
  return (
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
          {titulo}
        </span>
      </div>

      {filas.length === 0 ? (
        <p className="text-xs text-center px-4 py-5" style={{ color: "var(--color-text-muted)" }}>
          {vacio}
        </p>
      ) : (
        <ol className="p-3 flex flex-col gap-1.5">
          {filas.map((fila, idx) => {
            const isMe = currentUserId != null && fila.user_id === currentUserId;
            const rankColor = RANK_COLORS[idx] ?? null;

            return (
              <li
                key={fila.user_id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
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

                {fila.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fila.avatar_url}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: "rgba(212,160,23,0.15)", color: "var(--color-primary)" }}
                  >
                    {fila.nombre[0]?.toUpperCase() ?? "?"}
                  </span>
                )}

                <span
                  className="flex-1 text-sm truncate"
                  style={{
                    color: isMe ? "var(--color-primary)" : "var(--color-text)",
                    fontWeight: isMe ? 700 : 500,
                  }}
                >
                  {fila.nombre}
                  {isMe && " (tú)"}
                </span>

                <span className="flex flex-col items-end shrink-0">
                  <span
                    className="font-mono text-sm font-bold leading-tight"
                    style={{ color: idx === 0 ? "var(--color-primary)" : "var(--color-text)" }}
                  >
                    {fila.puntos_totales.toLocaleString()} pts
                  </span>
                  <span className="text-[10px] leading-tight" style={{ color: "var(--color-text-muted)" }}>
                    {fila.partidas} {fila.partidas === 1 ? unidadSingular : unidadPlural}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

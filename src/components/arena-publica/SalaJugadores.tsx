"use client";

import type { ArenaJugador } from "@/types";
import { AvatarJugador } from "./AvatarJugador";

interface SalaJugadoresProps {
  jugadores: ArenaJugador[];
  meId: string | null;
  avatarDe: (j: ArenaJugador) => string | null;
  conectado: (j: ArenaJugador) => boolean;
}

/** "Jugando contra: Juan, María y 2 más" (sin contarse a uno mismo). */
export function textoRivales(jugadores: ArenaJugador[], meId: string | null): string | null {
  const rivales = jugadores.filter((j) => j.id !== meId).map((j) => j.nombre);
  if (rivales.length === 0) return null;
  if (rivales.length === 1) return `Jugando contra: ${rivales[0]}`;
  if (rivales.length === 2) return `Jugando contra: ${rivales[0]} y ${rivales[1]}`;
  const resto = rivales.length - 2;
  return `Jugando contra: ${rivales[0]}, ${rivales[1]} y ${resto} más`;
}

/** Sala de espera: quién ya entró, en vivo (entra, sale, se desconecta). */
export function SalaJugadores({ jugadores, meId, avatarDe, conectado }: SalaJugadoresProps) {
  const rivales = textoRivales(jugadores, meId);
  return (
    <div className="w-full flex flex-col gap-3">
      <p className="text-sm font-semibold" style={{ color: rivales ? "var(--color-text)" : "var(--color-text-muted)" }}>
        {rivales ?? "Todavía no entra nadie más. ¡Invita a alguien!"}
      </p>
      <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2" aria-label="Jugadores en la sala">
        {jugadores.map((j) => {
          const esYo = j.id === meId;
          const enLinea = conectado(j);
          return (
            <li
              key={j.id}
              className="flex flex-col items-center gap-1.5 px-1 py-2.5 rounded-xl min-w-0 transition-opacity"
              style={{
                background: esYo ? "rgba(212,160,23,0.1)" : "var(--color-surface)",
                border: `1px solid ${esYo ? "rgba(212,160,23,0.4)" : "var(--color-border)"}`,
                opacity: enLinea ? 1 : 0.4,
              }}
              title={enLinea ? undefined : "Desconectado"}
            >
              <AvatarJugador nombre={j.nombre} avatar={avatarDe(j)} tam={40} />
              <span
                className="w-full text-xs font-semibold truncate text-center"
                style={{ color: esYo ? "var(--color-primary)" : "var(--color-text)" }}
              >
                {esYo ? "Tú" : j.nombre}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

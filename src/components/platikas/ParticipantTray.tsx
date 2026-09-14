"use client";

import { Mic, MicOff } from "lucide-react";
import { ParticipantName } from "@livekit/components-react";
import type { Participant } from "livekit-client";

interface ParticipantTrayProps {
  tiles: { id: string; participant: Participant; isMuted: boolean }[];
}

// Tira de participantes conectados — visible aunque el layout activo
// (Solo, Lado a lado) no los muestre en el canvas, mismo patrón que la
// bandeja de tarjetas de StreamYard debajo de su fila de layouts. Con
// un solo participante no aporta nada, así que no se muestra.
export function ParticipantTray({ tiles }: ParticipantTrayProps) {
  if (tiles.length <= 1) return null;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 shrink-0 overflow-x-auto"
      style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-surface)" }}
    >
      {tiles.map(({ id, participant, isMuted }) => (
        <div
          key={id}
          className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-full shrink-0"
          style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
            style={{ background: "rgba(212,160,23,0.15)", color: "var(--color-primary)" }}
          >
            {(participant.name || participant.identity || "?").charAt(0).toUpperCase()}
          </div>
          <span className="text-xs font-medium max-w-24 truncate" style={{ color: "var(--color-text)" }}>
            <ParticipantName participant={participant} />
          </span>
          {isMuted ? (
            <MicOff size={12} style={{ color: "var(--color-text-muted)" }} />
          ) : (
            <Mic size={12} style={{ color: "var(--color-success)" }} />
          )}
        </div>
      ))}
    </div>
  );
}

"use client";

import { Loader2, ArrowRight, Trophy } from "lucide-react";
import type { RuletaJugador } from "@/types";

interface RoundBannerProps {
  frase: string;
  ganador: RuletaJugador | null;
  isHost: boolean;
  isLastRound: boolean;
  onNext: () => void;
  advancing: boolean;
}

export function RoundBanner({ frase, ganador, isHost, isLastRound, onNext, advancing }: RoundBannerProps) {
  return (
    <div
      className="flex flex-col items-center gap-4 text-center rounded-2xl p-6"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-primary)" }}
    >
      <Trophy size={32} style={{ color: "var(--color-primary)" }} />
      <p className="text-sm font-semibold" style={{ color: "var(--color-text-muted)" }}>
        {ganador ? `${ganador.nombre} ganó la ronda` : "Ronda terminada"}
      </p>
      <p className="text-xl font-bold" style={{ color: "var(--color-text)" }}>{frase}</p>

      {isHost ? (
        <button
          onClick={onNext}
          disabled={advancing}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-base font-bold"
          style={{ background: advancing ? "var(--color-surface-elevated)" : "var(--color-primary)", color: advancing ? "var(--color-text-muted)" : "#000" }}
        >
          {advancing ? <Loader2 size={18} className="animate-spin" /> : <>{isLastRound ? "Ver resultado final" : "Siguiente ronda"} <ArrowRight size={18} /></>}
        </button>
      ) : (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Esperando al anfitrión...</p>
      )}
    </div>
  );
}

"use client";

import { Trophy } from "lucide-react";
import type { RuletaJugador } from "@/types";
import { TurnTimer } from "./TurnTimer";

interface RoundBannerProps {
  frase: string;
  ganador: RuletaJugador | null;
  terminaEn: number | null;
  onExpire: () => void;
}

export function RoundBanner({ frase, ganador, terminaEn, onExpire }: RoundBannerProps) {
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
      <TurnTimer endsAt={terminaEn} onExpire={onExpire} />
    </div>
  );
}

"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Trophy } from "lucide-react";
import Link from "next/link";
import type { ArenaJugador } from "@/types";
import { Leaderboard } from "./Leaderboard";

interface WinnerScreenProps {
  jugadores: ArenaJugador[];
  meId?: string | null;
}

export function WinnerScreen({ jugadores, meId }: WinnerScreenProps) {
  const sorted = [...jugadores].sort((a, b) => b.puntos - a.puntos);
  const winner = sorted[0];

  useEffect(() => {
    const duration = 2500;
    const end = Date.now() + duration;
    const colors = ["#D4A017", "#EDB84A", "#FFFFFF"];
    let frameId: number;

    function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors });
      if (Date.now() < end) frameId = requestAnimationFrame(frame);
    }

    frame();
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center gap-6 py-8">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center"
        style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}
      >
        <Trophy size={40} style={{ color: "var(--color-primary)" }} />
      </div>

      <div className="text-center flex flex-col gap-2">
        <p
          className="text-sm font-semibold uppercase"
          style={{ color: "var(--color-text-muted)", letterSpacing: "0.1em" }}
        >
          ¡Partida terminada!
        </p>
        {winner ? (
          <h1 className="text-3xl font-extrabold" style={{ color: "var(--color-primary)" }}>
            {winner.nombre}
          </h1>
        ) : (
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
            Sin jugadores
          </h1>
        )}
        {winner && (
          <p className="text-base" style={{ color: "var(--color-text-muted)" }}>
            con{" "}
            <span className="font-bold" style={{ color: "var(--color-text)" }}>
              {winner.puntos.toLocaleString()} pts
            </span>
          </p>
        )}
      </div>

      <div className="w-full">
        <Leaderboard jugadores={jugadores} meId={meId} />
      </div>

      <Link
        href="/arena"
        className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
        }}
      >
        Volver a Elim Arena
      </Link>
    </div>
  );
}

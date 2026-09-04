"use client";

import Link from "next/link";
import { Share2 } from "lucide-react";

interface PuertaArenaAbiertaProps {
  disponible: boolean;
  jugandoAhora: number;
}

export function PuertaArenaAbierta({ disponible, jugandoAhora }: PuertaArenaAbiertaProps) {
  const rojo = jugandoAhora > 0 && !disponible;

  async function handleInvitar(e: React.MouseEvent) {
    e.preventDefault();
    const url = `${window.location.origin}/arena-abierta`;
    const shareData = { title: "Arena Abierta — Elim LLDM", text: "Únete a jugar trivia bíblica conmigo", url };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // canceló el share — no hacer nada más
      }
    }

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard no disponible
    }
  }

  return (
    <div
      className="flex flex-col gap-4 p-6 rounded-2xl"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.3)" }}
          >
            ⚡
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
              Arena Abierta
            </h2>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Trivia bíblica en vivo
            </p>
          </div>
        </div>

        <span
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide"
          style={{
            color: rojo ? "var(--color-live)" : "var(--color-success)",
            background: rojo ? "rgba(255,68,68,0.1)" : "rgba(74,222,128,0.1)",
            border: `1px solid ${rojo ? "rgba(255,68,68,0.3)" : "rgba(74,222,128,0.32)"}`,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "currentColor" }}
          />
          {rojo ? "Ocupado" : "Disponible"}
        </span>
      </div>

      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        {jugandoAhora > 0
          ? `${jugandoAhora} ${jugandoAhora === 1 ? "partida jugándose" : "partidas jugándose"} ahora — al entrar se abre una sala para ti`
          : "Nadie jugando — sé el primero"}
      </p>

      <div className="flex items-center gap-2">
        <Link
          href="/arena-abierta"
          className="flex-1 text-center px-4 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: "var(--color-primary)", color: "#000" }}
        >
          Entrar
        </Link>
        <button
          type="button"
          onClick={handleInvitar}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "rgba(37,211,102,0.1)", color: "#25D366", border: "1px solid rgba(37,211,102,0.25)" }}
        >
          <Share2 size={14} />
          Invitar
        </button>
      </div>
    </div>
  );
}

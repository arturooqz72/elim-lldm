"use client";

import { useState } from "react";
import { Users, Play, Loader2, Copy, Check, Share2 } from "lucide-react";
import type { ArenaJugador } from "@/types";

interface HostLobbyProps {
  codigo: string;
  titulo: string;
  jugadores: ArenaJugador[];
  onStart: () => void;
  starting: boolean;
}

export function HostLobby({ codigo, titulo, jugadores, onStart, starting }: HostLobbyProps) {
  const [copied, setCopied] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard no disponible
    }
  }

  async function handleInvite() {
    const url = `${window.location.origin}/arena/${codigo}`;
    const shareData = {
      title: `${titulo} — Elim Arena`,
      text: `Únete a jugar trivia bíblica conmigo. Código: ${codigo}`,
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // El usuario canceló el share o falló — seguir con copiar el link
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 1500);
    } catch {
      // clipboard no disponible
    }
  }

  return (
    <div className="flex-1 flex flex-col gap-5 py-4">
      <div className="text-center flex flex-col gap-1">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          {titulo}
        </h1>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Comparte este código para que se unan
        </p>
      </div>

      <button
        onClick={handleCopy}
        className="flex items-center justify-center gap-3 py-6 rounded-2xl transition-colors"
        style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
      >
        <span
          className="text-5xl font-extrabold font-mono"
          style={{ color: "var(--color-primary)", letterSpacing: "0.3em" }}
        >
          {codigo}
        </span>
        {copied ? (
          <Check size={22} style={{ color: "var(--color-success)" }} />
        ) : (
          <Copy size={22} style={{ color: "var(--color-text-muted)" }} />
        )}
      </button>

      <button
        type="button"
        onClick={handleInvite}
        className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-colors"
        style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)", color: "var(--color-primary)" }}
      >
        {inviteCopied ? <Check size={17} /> : <Share2 size={17} />}
        {inviteCopied ? "Enlace copiado" : "Invitar jugadores"}
      </button>

      <div
        className="rounded-2xl p-4 flex-1 flex flex-col gap-3"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-2">
          <Users size={16} style={{ color: "var(--color-primary)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {jugadores.length} {jugadores.length === 1 ? "jugador" : "jugadores"}
          </span>
        </div>

        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {jugadores.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: "var(--color-text-muted)" }}>
              Esperando jugadores... comparte el código para que se unan desde su celular.
            </p>
          ) : (
            jugadores.map((j) => (
              <div
                key={j.id}
                className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{ background: "var(--color-surface-elevated)" }}
              >
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: "rgba(212,160,23,0.15)", color: "var(--color-primary)" }}
                >
                  {j.nombre[0]?.toUpperCase() ?? "?"}
                </span>
                <span className="text-base font-medium truncate" style={{ color: "var(--color-text)" }}>
                  {j.nombre}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {jugadores.length === 0 && (
        <p className="text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
          El anfitrión no juega — se necesita al menos 1 jugador conectado desde su propio celular para poder empezar.
        </p>
      )}

      <button
        onClick={onStart}
        disabled={jugadores.length === 0 || starting}
        className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-lg font-bold transition-all duration-200"
        style={{
          background:
            jugadores.length > 0 && !starting ? "var(--color-primary)" : "var(--color-surface-elevated)",
          color: jugadores.length > 0 && !starting ? "#000" : "var(--color-text-muted)",
        }}
      >
        {starting ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} />}
        Iniciar juego
      </button>
    </div>
  );
}

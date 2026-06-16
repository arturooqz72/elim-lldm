"use client";

import { useState } from "react";
import { ArrowRight, Loader2, UserRound } from "lucide-react";

interface JoinFormProps {
  codigo: string;
  titulo: string;
  onJoined: (jugadorId: string, nombre: string) => void;
}

export function JoinForm({ codigo, titulo, onJoined }: JoinFormProps) {
  const [nombre, setNombre] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/arena/${codigo}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre.trim() }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo unir a la sala");
      setSubmitting(false);
      return;
    }

    const data = await res.json();
    onJoined(data.jugador_id, nombre.trim());
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-10">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}
      >
        <UserRound size={32} style={{ color: "var(--color-primary)" }} />
      </div>

      <div className="text-center flex flex-col gap-2">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          {titulo}
        </h1>
        <p className="text-base" style={{ color: "var(--color-text-muted)" }}>
          ¿Cuál es tu nombre?
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value.slice(0, 20))}
          placeholder="Tu nombre"
          maxLength={20}
          autoFocus
          className="w-full rounded-2xl px-5 py-4 text-xl font-semibold text-center outline-none transition-colors"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        />

        {error && (
          <p className="text-sm text-center" style={{ color: "var(--color-destructive)" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!nombre.trim() || submitting}
          className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-lg font-bold transition-all duration-200"
          style={{
            background:
              nombre.trim() && !submitting ? "var(--color-primary)" : "var(--color-surface-elevated)",
            color: nombre.trim() && !submitting ? "#000" : "var(--color-text-muted)",
          }}
        >
          {submitting ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <>
              Entrar al juego
              <ArrowRight size={20} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

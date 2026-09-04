"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Disc3 } from "lucide-react";
import { MIN_PLAYERS, MAX_PLAYERS } from "@/lib/ruleta/wheel";

interface EntrarFormProps {
  onEntrado?: (jugadorId: string, codigo: string) => void;
}

export function EntrarForm({ onEntrado }: EntrarFormProps) {
  const [jugadoresDeseados, setJugadoresDeseados] = useState(MIN_PLAYERS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opciones = Array.from(
    { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
    (_, i) => MIN_PLAYERS + i
  );

  async function handleEntrar() {
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/ruleta/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jugadores_deseados: jugadoresDeseados }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo unir a la sala");
      setSubmitting(false);
      return;
    }

    const data = await res.json();
    if (onEntrado) {
      onEntrado(data.jugador_id, data.codigo);
    } else {
      // Sin callback (uso desde page.tsx sin sala previa): recarga directo
      // a /ruleta, que ahora sí va a encontrar la sala recién creada.
      window.location.href = "/ruleta";
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-10">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}
      >
        <Disc3 size={32} style={{ color: "var(--color-primary)" }} />
      </div>

      <div className="text-center flex flex-col gap-2">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          ¿Cuántos van a jugar?
        </h1>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Si al final no llegan todos, puedes empezar antes.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-center">
        {opciones.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setJugadoresDeseados(n)}
            className="w-11 h-11 rounded-xl font-mono font-semibold text-base transition-colors"
            style={{
              background: n === jugadoresDeseados ? "rgba(212,160,23,0.14)" : "var(--color-surface-elevated)",
              border: `1px solid ${n === jugadoresDeseados ? "var(--color-primary)" : "var(--color-border)"}`,
              color: n === jugadoresDeseados ? "var(--color-primary-light)" : "var(--color-text-muted)",
            }}
          >
            {n}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-center" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleEntrar}
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-lg font-bold transition-all duration-200"
        style={{
          background: !submitting ? "var(--color-primary)" : "var(--color-surface-elevated)",
          color: !submitting ? "#000" : "var(--color-text-muted)",
        }}
      >
        {submitting ? <Loader2 size={20} className="animate-spin" /> : <>Entrar a jugar <ArrowRight size={20} /></>}
      </button>
    </div>
  );
}

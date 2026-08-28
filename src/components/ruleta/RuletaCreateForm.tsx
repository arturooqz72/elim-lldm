"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { ROUNDS_MIN, ROUNDS_MAX, ROUNDS_DEFAULT } from "@/lib/ruleta/wheel";

function clampRondas(raw: string): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return ROUNDS_DEFAULT;
  return Math.max(ROUNDS_MIN, Math.min(ROUNDS_MAX, n));
}

export function RuletaCreateForm() {
  const [rondasText, setRondasText] = useState(String(ROUNDS_DEFAULT));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/ruleta/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rondas: clampRondas(rondasText) }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo crear la sala");
      setSubmitting(false);
      return;
    }

    const data = await res.json();
    if (data.jugador_id) {
      try {
        localStorage.setItem(
          `ruleta_jugador_${data.codigo}`,
          JSON.stringify({ id: data.jugador_id, nombre: data.nombre })
        );
      } catch {
        // localStorage no disponible
      }
    }
    router.push(`/ruleta/${data.codigo}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className="text-sm font-semibold block mb-2" style={{ color: "var(--color-text)" }}>
          Número de rondas
        </label>
        <input
          type="number"
          inputMode="numeric"
          min={ROUNDS_MIN}
          max={ROUNDS_MAX}
          value={rondasText}
          onChange={(e) => setRondasText(e.target.value)}
          onBlur={() => setRondasText(String(clampRondas(rondasText)))}
          className="w-full rounded-xl px-4 py-3 text-lg font-semibold outline-none"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        />
        <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
          Tú ya quedas como jugador. Comparte el código para que se unan de 1 a 5 personas más (2 a 6 en total).
        </p>
      </div>

      {error && (
        <p className="text-sm text-center" style={{ color: "var(--color-destructive)" }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-lg font-bold transition-all duration-200"
        style={{
          background: submitting ? "var(--color-surface-elevated)" : "var(--color-primary)",
          color: submitting ? "var(--color-text-muted)" : "#000",
        }}
      >
        {submitting ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
        Crear sala
      </button>
    </form>
  );
}

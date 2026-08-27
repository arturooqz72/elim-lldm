"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { ROUNDS_MIN, ROUNDS_MAX, ROUNDS_DEFAULT } from "@/lib/ruleta/wheel";

export function RuletaCreateForm() {
  const [rondas, setRondas] = useState(ROUNDS_DEFAULT);
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
      body: JSON.stringify({ rondas }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo crear la sala");
      setSubmitting(false);
      return;
    }

    const data = await res.json();
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
          min={ROUNDS_MIN}
          max={ROUNDS_MAX}
          value={rondas}
          onChange={(e) => setRondas(Math.max(ROUNDS_MIN, Math.min(ROUNDS_MAX, Number(e.target.value) || ROUNDS_DEFAULT)))}
          className="w-full rounded-xl px-4 py-3 text-lg font-semibold outline-none"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        />
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

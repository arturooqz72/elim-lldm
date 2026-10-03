// src/components/juegos/palabra/PreguntaIglesia.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Church } from "lucide-react";

/**
 * Se muestra una sola vez antes del ranking (o al tocar "cambiar"). Guardar
 * vacío ("Prefiero no decirlo") también cuenta como respondido.
 */
export function PreguntaIglesia({
  valorInicial,
  onGuardado,
  onCancelar,
}: {
  valorInicial: string;
  onGuardado: (valor: string) => void;
  onCancelar?: () => void;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(valorInicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(iglesia: string) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/juegos/palabra/iglesia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iglesia }),
      });
      const data = (await res.json()) as { iglesia?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
      onGuardado(data.iglesia ?? iglesia);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form
      className="p-4 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valor.trim()) void guardar(valor);
      }}
    >
      <div className="flex items-center gap-2">
        <Church size={18} style={{ color: "var(--color-primary)" }} />
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          ¿De qué iglesia o ciudad eres?
        </p>
      </div>
      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        Lo usamos para el ranking por iglesia. Se muestra junto a tu nombre.
      </p>
      <input
        type="text"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        maxLength={80}
        placeholder="Ej: Elim Las Vegas, Guadalajara…"
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
        style={{
          background: "var(--color-surface-elevated)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
        }}
        autoFocus
      />
      {error && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={guardando}
          onClick={() => (onCancelar ? onCancelar() : void guardar(""))}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          {onCancelar ? "Cancelar" : "Prefiero no decirlo"}
        </button>
        <button
          type="submit"
          disabled={guardando || !valor.trim()}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: "var(--color-primary)", color: "#000", opacity: valor.trim() ? 1 : 0.6 }}
        >
          {guardando ? "Guardando…" : "Ver ranking"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { createFreshClient } from "@/lib/supabase/client";

const MENSAJE_MAX = 500;

export function OpinionForm({ userId }: { userId: string | null }) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!userId) {
    return (
      <div
        className="rounded-2xl p-5 text-center flex flex-col items-center gap-2"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Inicia sesión para dejar tu opinión.
        </p>
        <Link
          href="/login?returnUrl=/opiniones"
          className="text-sm font-semibold"
          style={{ color: "var(--color-primary)" }}
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const texto = mensaje.trim();
    if (!texto) return;

    setSubmitting(true);
    setError(null);

    // createFreshClient(), no el singleton: su initializePromise puede
    // quedarse colgado para siempre si el refresh inicial de token nunca
    // resolvió, y esto es exactamente el tipo de flujo de un solo uso para
    // el que existe la variante fresh (ver comentario en client.ts).
    const supabase = createFreshClient();
    const { error: insertError } = await supabase
      .from("opiniones")
      .insert({ user_id: userId, mensaje: texto });

    setSubmitting(false);

    if (insertError) {
      setError("No se pudo publicar tu opinión. Intenta de nuevo.");
      return;
    }

    setMensaje("");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <textarea
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value)}
        maxLength={MENSAJE_MAX}
        rows={3}
        placeholder="Escribe tu opinión o sugerencia…"
        className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none transition-colors"
        style={{
          background: "var(--color-surface-elevated)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
      />

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
          {mensaje.length}/{MENSAJE_MAX}
        </span>

        <div className="flex items-center gap-3">
          {error && (
            <span className="text-xs" style={{ color: "var(--color-destructive)" }}>
              {error}
            </span>
          )}
          <button
            type="submit"
            disabled={submitting || mensaje.trim().length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{
              background: submitting || mensaje.trim().length === 0 ? "var(--color-surface-elevated)" : "var(--color-primary)",
              color: submitting || mensaje.trim().length === 0 ? "var(--color-text-muted)" : "#000",
            }}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Publicar
          </button>
        </div>
      </div>
    </form>
  );
}

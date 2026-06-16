"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Radio, X } from "lucide-react";

export function GoLiveButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/platikas/create-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al crear la sesión");
        setLoading(false);
        return;
      }

      router.push(`/platikas/${data.id}`);
    } catch {
      setError("Error al crear la sesión");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold shrink-0 transition-all"
        style={{ background: "var(--color-live)", color: "#fff" }}
      >
        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        Ir en vivo ahora
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          style={{ background: "rgba(10,10,18,0.7)" }}
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--color-text)" }}>
                <Radio size={18} style={{ color: "var(--color-live)" }} />
                Ir en vivo ahora
              </h2>
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                style={{ color: "var(--color-text-muted)" }}
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Se creará una sesión del Estudio en Vivo y comenzará la transmisión de inmediato.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                  Título de la sesión
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder='Ej: "Debate: La Fe", "Charlando con..."'
                  maxLength={120}
                  autoFocus
                  required
                  disabled={loading}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{
                    background: "var(--color-surface-elevated)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
              </div>

              {error && (
                <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !title.trim()}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold transition-all"
                style={{ background: "var(--color-live)", color: "#fff" }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Radio size={16} />}
                Iniciar transmisión
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

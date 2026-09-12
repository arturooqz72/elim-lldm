"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radio, Loader2, X } from "lucide-react";

interface GoLiveProgramaButtonProps {
  programaId: string;
  nombre: string;
}

export function GoLiveProgramaButton({ programaId, nombre }: GoLiveProgramaButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tema, setTema] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function irEnVivo(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    const temaLimpio = tema.trim();
    const title = temaLimpio ? `${nombre} — ${temaLimpio}` : nombre;

    try {
      const res = await fetch("/api/platikas/create-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, programa_id: programaId }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) throw new Error(data.error ?? "No se pudo iniciar el programa");
      router.push(`/platikas/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar el programa");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shrink-0"
        style={{ background: "var(--color-primary)", color: "#000" }}
      >
        <Radio size={14} />
        Ir en vivo
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
                <Radio size={18} style={{ color: "var(--color-primary)" }} />
                {nombre}
              </h2>
              <button onClick={() => setOpen(false)} disabled={loading} style={{ color: "var(--color-text-muted)" }}>
                <X size={18} />
              </button>
            </div>

            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              ¿De qué tratará esta sesión de hoy? (opcional — se agrega al título del programa)
            </p>

            <form onSubmit={irEnVivo} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                  Tema de hoy
                </label>
                <input
                  type="text"
                  value={tema}
                  onChange={(e) => setTema(e.target.value)}
                  placeholder='Ej: "El fruto del Espíritu"'
                  maxLength={120}
                  autoFocus
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
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold transition-all"
                style={{ background: "var(--color-primary)", color: "#000", opacity: loading ? 0.7 : 1 }}
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

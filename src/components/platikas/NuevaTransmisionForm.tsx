"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Radio, Loader2, ArrowLeft } from "lucide-react";

interface NuevaTransmisionFormProps {
  programaId: string;
  nombrePrograma: string;
}

// Pantalla completa de configuración antes de entrar al estudio — en
// vez del modal pequeño que pedía solo el tema del día. Mismo patrón
// de dos columnas (formulario + resumen en vivo) que la pantalla de
// configuración de tdv-llm. Por ahora solo pide el tema; más adelante
// se agregan más opciones aquí mismo.
export function NuevaTransmisionForm({ programaId, nombrePrograma }: NuevaTransmisionFormProps) {
  const router = useRouter();
  const [tema, setTema] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const temaLimpio = tema.trim();
  const tituloFinal = temaLimpio ? `${nombrePrograma} — ${temaLimpio}` : nombrePrograma;

  async function entrarAlEstudio(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/platikas/create-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: tituloFinal, programa_id: programaId }),
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
    <div
      className="min-h-screen px-4 py-8 md:px-6"
      style={
        {
          background: "var(--color-bg)",
          "--color-bg": "#FAF8F3",
          "--color-surface": "#FFFFFF",
          "--color-surface-elevated": "#FFFFFF",
          "--color-border": "#E8E1CE",
          "--color-primary": "#D4A017",
          "--color-primary-light": "#EDB84A",
          "--color-primary-dark": "#A07810",
          "--color-text": "#1C1917",
          "--color-text-muted": "#6B6558",
          "--color-live": "#FF4444",
          "--color-success": "#16A34A",
          "--color-destructive": "#DC2626",
        } as React.CSSProperties
      }
    >
      <div className="mx-auto max-w-4xl mb-4">
        <Link
          href="/platikas/programas"
          className="inline-flex items-center gap-2 text-sm"
          style={{ color: "var(--color-text-muted)" }}
        >
          <ArrowLeft size={14} />
          Programas
        </Link>
      </div>

      <div className="mx-auto grid w-full max-w-4xl gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        {/* Formulario */}
        <div
          className="rounded-2xl p-6 flex flex-col gap-5"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--color-text)" }}>
              Configurar transmisión
            </h1>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Prepara el tema de hoy antes de entrar al estudio.
            </p>
          </div>

          <form onSubmit={entrarAlEstudio} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                Tema de hoy (opcional)
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
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Se agrega al título del programa: &quot;{tituloFinal}&quot;
              </p>
            </div>

            {error && (
              <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-70"
              style={{ background: "var(--color-primary)", color: "#000" }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Radio size={16} />}
              Entrar al estudio
            </button>
          </form>
        </div>

        {/* Resumen */}
        <div
          className="rounded-2xl p-6 flex flex-col gap-4 h-fit"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <h2 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
            Resumen de esta transmisión
          </h2>

          <div
            className="rounded-xl p-4"
            style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
          >
            <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--color-text-muted)" }}>
              Programa
            </p>
            <p className="mt-1 text-sm font-medium" style={{ color: "var(--color-text)" }}>
              {nombrePrograma}
            </p>
          </div>

          <div
            className="rounded-xl p-4"
            style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
          >
            <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--color-text-muted)" }}>
              Título de la sesión
            </p>
            <p className="mt-1 text-sm font-medium" style={{ color: "var(--color-text)" }}>
              {tituloFinal}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

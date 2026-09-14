"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Radio, Loader2, ArrowLeft, Cast } from "lucide-react";

interface NuevaTransmisionFormProps {
  programaId: string;
  nombrePrograma: string;
}

type Visibilidad = "publico" | "oculto" | "privado";

const VISIBILIDAD_LABEL: Record<Visibilidad, string> = {
  publico: "🌍 Público",
  oculto: "🔗 Oculto",
  privado: "🔒 Privado",
};

// Pantalla completa de configuración antes de entrar al estudio — en
// vez del modal pequeño que pedía solo el tema del día. Mismo patrón
// de dos columnas (formulario + resumen en vivo) que la pantalla de
// configuración de tdv-llm, con los mismos campos (título/tema,
// descripción, privacidad) — la diferencia es "Plataformas": en tdv se
// elige un modo de salida fijo antes de entrar; aquí los destinos
// (YouTube, Facebook, etc.) se agregan y prenden/apagan dentro del
// estudio en cualquier momento, así que esta tarjeta es informativa.
export function NuevaTransmisionForm({ programaId, nombrePrograma }: NuevaTransmisionFormProps) {
  const router = useRouter();
  const [tema, setTema] = useState("");
  const [description, setDescription] = useState("");
  const [visibilidad, setVisibilidad] = useState<Visibilidad>("publico");
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
        body: JSON.stringify({
          title: tituloFinal,
          programa_id: programaId,
          description: description.trim() || undefined,
          visibilidad,
        }),
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
              Prepara el título, descripción y privacidad antes de entrar al estudio.
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

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                Descripción (opcional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="¿De qué tratará esta sesión?"
                rows={4}
                maxLength={500}
                disabled={loading}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                style={{
                  background: "var(--color-surface-elevated)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                Privacidad
              </label>
              <select
                value={visibilidad}
                onChange={(e) => setVisibilidad(e.target.value as Visibilidad)}
                disabled={loading}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{
                  background: "var(--color-surface-elevated)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              >
                <option value="publico">🌍 Público — aparece en la lista del Estudio en Vivo</option>
                <option value="oculto">🔗 Oculto — solo con el enlace directo</option>
                <option value="privado">🔒 Privado — solo tú y quienes apruebes</option>
              </select>
            </div>

            <div
              className="rounded-xl p-4 flex items-start gap-3"
              style={{ background: "rgba(212,160,23,0.06)", border: "1px solid rgba(212,160,23,0.2)" }}
            >
              <Cast size={18} style={{ color: "var(--color-primary)" }} className="shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                  Plataformas
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  YouTube, Facebook y demás destinos se conectan y se prenden/apagan dentro del
                  estudio, en cualquier momento — no hace falta elegirlos aquí.
                </p>
              </div>
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
              Título de la sesión
            </p>
            <p className="mt-1 text-sm font-medium" style={{ color: "var(--color-text)" }}>
              {tituloFinal}
            </p>
          </div>

          <div
            className="rounded-xl p-4"
            style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
          >
            <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--color-text-muted)" }}>
              Privacidad
            </p>
            <p className="mt-1 text-sm font-medium" style={{ color: "var(--color-text)" }}>
              {VISIBILIDAD_LABEL[visibilidad]}
            </p>
          </div>

          <div
            className="rounded-xl p-4"
            style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
          >
            <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--color-text-muted)" }}>
              Descripción
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap" style={{ color: "var(--color-text)" }}>
              {description.trim() || "Sin descripción"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

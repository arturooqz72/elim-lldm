"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import type { EncuestaRespuesta, EncuestaTipo } from "@/types";

const GOLD = "#f5c842";

const PREGUNTA: Record<EncuestaTipo, string> = {
  voz: "¿Pagarías por práctica de voz ilimitada?",
  mensajes: "¿Pagarías por mensajes ilimitados con la tutora?",
};

const OPCIONES: { valor: EncuestaRespuesta; texto: string }[] = [
  { valor: "no", texto: "No pagaría" },
  { valor: "3", texto: "$3 al mes" },
  { valor: "5", texto: "$5 al mes" },
  { valor: "10", texto: "$10 al mes" },
];

interface Props {
  tipo: EncuestaTipo;
  /** Lo que ya respondió antes (se puede cambiar). */
  inicial?: EncuestaRespuesta;
  onRespondida?: (respuesta: EncuestaRespuesta) => void;
}

/**
 * Encuesta "¿Pagarías…?". Es solo una encuesta para decidir el futuro de
 * Elim English: no cobra ni pide datos de pago. Una respuesta por persona,
 * que puede cambiar tocando otra opción.
 */
export function EncuestaPrecio({ tipo, inicial, onRespondida }: Props) {
  const [elegida, setElegida] = useState<EncuestaRespuesta | undefined>(inicial);
  const [guardando, setGuardando] = useState<EncuestaRespuesta | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function responder(respuesta: EncuestaRespuesta) {
    setGuardando(respuesta);
    setError(null);
    try {
      const res = await fetch("/api/ingles/encuesta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tipo, respuesta }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo guardar. Intenta de nuevo.");
      setElegida(respuesta);
      onRespondida?.(respuesta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div className="w-full flex flex-col gap-2" role="group" aria-label={PREGUNTA[tipo]}>
      <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
        {PREGUNTA[tipo]}
      </p>
      <div className="grid grid-cols-2 min-[400px]:grid-cols-4 gap-2">
        {OPCIONES.map((o) => {
          const activa = elegida === o.valor;
          return (
            <button
              key={o.valor}
              type="button"
              onClick={() => void responder(o.valor)}
              disabled={guardando !== null}
              aria-pressed={activa}
              className="px-2 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1"
              style={
                activa
                  ? { background: GOLD, color: "#000", border: `1px solid ${GOLD}` }
                  : { background: "var(--color-surface-elevated)", color: "var(--color-text)", border: "1px solid var(--color-border)" }
              }
            >
              {guardando === o.valor ? <Loader2 size={12} className="animate-spin" /> : activa && <Check size={12} />}
              {o.texto}
            </button>
          );
        })}
      </div>
      <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
        {elegida
          ? "¡Gracias! Guardamos tu respuesta; puedes cambiarla cuando quieras. "
          : ""}
        Es solo una encuesta: no se te cobrará nada.
      </p>
      {error && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

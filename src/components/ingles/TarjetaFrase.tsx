"use client";

import { useState } from "react";
import { Loader2, MicOff, RotateCcw } from "lucide-react";
import { useVoz } from "./contextoVoz";
import { useEscuchar } from "./useEscuchar";
import { useGrabadoraWav } from "./useGrabadoraWav";
import { AYUDA_MICROFONO } from "./PronunciacionGrabadora";
import { PronunciacionResultado } from "./PronunciacionResultado";
import type { InglesSaldo, PronResultado } from "@/types";

const GOLD = "#f5c842";

interface Props {
  texto: string;
  /** Mensaje de la tutora que contiene la frase (sin id no se puede evaluar). */
  mensajeId?: string;
  /** Qué frase marcada del mensaje es (0 o 1). */
  indice: number;
}

interface Respuesta {
  estado?: string;
  resultado?: PronResultado;
  saldo?: InglesSaldo;
  vozPrueba?: number;
  error?: string;
}

function reloj(s: number): string {
  return `0:${String(s).padStart(2, "0")}`;
}

/**
 * Frase en inglés que la tutora marcó para practicar: 🔊 la lee en voz alta y
 * 🎤 graba al alumno y la evalúa con Azure (mismo resultado que el modo
 * Pronunciación, en versión compacta). El micrófono se pide solo al tocar.
 */
export function TarjetaFrase({ texto, mensajeId, indice }: Props) {
  const voz = useVoz();
  const { disponible, hablando, leer } = useEscuchar();
  const [evaluando, setEvaluando] = useState(false);
  const [resultado, setResultado] = useState<PronResultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const maxSegundos = voz?.maxSegundos ?? 15;
  const grabadora = useGrabadoraWav(maxSegundos, (wav) => void evaluar(wav));
  const grabando = grabadora.estado === "grabando";
  const ocupado = evaluando || grabadora.estado === "pidiendo" || grabadora.estado === "procesando";
  const puedeGrabar = Boolean(voz && mensajeId);

  async function evaluar(wav: Blob) {
    if (!voz || !mensajeId) return;
    setEvaluando(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("mensaje_id", mensajeId);
      form.append("indice", String(indice));
      form.append("nivel", voz.nivel);
      form.append("audio", wav, "intento.wav");
      const res = await fetch("/api/ingles/voz", { method: "POST", body: form });
      const data = (await res.json()) as Respuesta;
      voz.actualizar({ saldo: data.saldo, vozPrueba: data.vozPrueba });
      if (data.estado === "limite_voz" || data.estado === "limite_prueba") {
        voz.alLimite();
        return;
      }
      if (!res.ok || !data.resultado) throw new Error(data.error ?? "No se pudo evaluar tu pronunciación");
      setResultado(data.resultado);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo evaluar tu pronunciación");
    } finally {
      setEvaluando(false);
    }
  }

  function tocarMicrofono() {
    if (!voz) return;
    if (grabando) {
      void grabadora.detener();
      return;
    }
    // Sin intentos: el chat muestra el aviso (con cuenta) o la invitación (prueba).
    if (voz.restantes <= 0) {
      voz.alLimite();
      return;
    }
    setResultado(null);
    setError(null);
    void grabadora.iniciar();
  }

  const etiquetaMicrofono = evaluando
    ? "Evaluando…"
    : grabando
      ? `⏹ Terminar ${reloj(grabadora.segundos)}`
      : grabadora.estado === "pidiendo"
        ? "Permiso del micrófono…"
        : grabadora.estado === "procesando"
          ? "Preparando…"
          : resultado
            ? "🎤 Otra vez"
            : "🎤 Dilo tú";

  return (
    <div
      className="my-2 rounded-xl px-2.5 py-2.5 flex flex-col gap-2 whitespace-normal"
      style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}55` }}
    >
      <p className="text-base font-semibold leading-snug" style={{ color: "var(--color-text)" }} lang="en">
        {texto}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {disponible && (
          <button
            type="button"
            onClick={() => leer(texto)}
            className="px-2.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
            style={{ background: hablando ? GOLD : `${GOLD}1A`, border: `1px solid ${GOLD}66`, color: hablando ? "#000" : GOLD }}
          >
            🔊 Escuchar
          </button>
        )}
        {puedeGrabar && (
          <button
            type="button"
            onClick={tocarMicrofono}
            disabled={ocupado && !grabando}
            aria-label={grabando ? "Terminar la grabación" : "Decir la frase con tu voz"}
            className="px-2.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap disabled:opacity-70"
            style={
              grabando
                ? { background: "var(--color-live)", color: "#fff" }
                : { background: GOLD, color: "#000" }
            }
          >
            {ocupado && !grabando && <Loader2 size={12} className="animate-spin" />}
            {etiquetaMicrofono}
          </button>
        )}
      </div>

      {grabando && (
        <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          Di la frase en voz alta y toca “Terminar” (máximo {maxSegundos} segundos).
        </p>
      )}

      {grabadora.error && (
        <div className="text-xs flex flex-col gap-1.5" role="alert">
          <p className="font-semibold flex items-center gap-1.5" style={{ color: "var(--color-destructive)" }}>
            <MicOff size={13} />
            {AYUDA_MICROFONO[grabadora.error].titulo}
          </p>
          <ul className="list-disc pl-4 flex flex-col gap-1" style={{ color: "var(--color-text-muted)" }}>
            {AYUDA_MICROFONO[grabadora.error].pasos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }} role="alert">
          {error}
        </p>
      )}

      {resultado && (
        <div className="flex flex-col gap-2 pt-1" style={{ borderTop: `1px solid ${GOLD}33` }}>
          <PronunciacionResultado resultado={resultado} compacto />
          <button
            type="button"
            onClick={() => setResultado(null)}
            className="self-start flex items-center gap-1.5 text-xs font-semibold hover:underline"
            style={{ color: "var(--color-text-muted)" }}
          >
            <RotateCcw size={12} />
            Ocultar resultado
          </button>
        </div>
      )}
    </div>
  );
}

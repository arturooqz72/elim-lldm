"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, RotateCcw, Volume2 } from "lucide-react";
import { InglesLimiteVoz } from "./InglesLimiteVoz";
import { PronunciacionGrabadora } from "./PronunciacionGrabadora";
import { PronunciacionProgreso } from "./PronunciacionProgreso";
import { PronunciacionResultado } from "./PronunciacionResultado";
import { escuchar } from "./useEscuchar";
import type { EncuestaRespuesta, InglesNivel, InglesSaldo, PronFrase, PronProgreso, PronResultado } from "@/types";

const GOLD = "#f5c842";

interface Props {
  nivel: InglesNivel;
  maxSegundos: number;
  saldo: InglesSaldo;
  fraseInicial: PronFrase | null;
  progresoInicial: PronProgreso;
  onSaldo: (saldo: InglesSaldo) => void;
  /** Encuesta "¿Pagarías por práctica de voz ilimitada?" (al llegar al límite de voz). */
  encuestaVoz?: EncuestaRespuesta;
  onEncuestaVoz: (respuesta: EncuestaRespuesta) => void;
}

export function InglesPronunciacion(props: Props) {
  const { nivel, maxSegundos, saldo, fraseInicial, progresoInicial, onSaldo } = props;
  const [frase, setFrase] = useState<PronFrase | null>(fraseInicial);
  const [cargandoFrase, setCargandoFrase] = useState(false);
  const [evaluando, setEvaluando] = useState(false);
  const [resultado, setResultado] = useState<PronResultado | null>(null);
  const [progreso, setProgreso] = useState<PronProgreso>(progresoInicial);
  const [error, setError] = useState<string | null>(null);
  const nivelFrase = useRef<InglesNivel | null>(fraseInicial ? nivel : null);

  // Solo para la pantalla: el servidor vuelve a validar los intentos de voz.
  const sinVoz = saldo.vozRestantes <= 0;

  const siguiente = useCallback(async (paraNivel: InglesNivel) => {
    setCargandoFrase(true);
    setError(null);
    setResultado(null);
    try {
      const res = await fetch("/api/ingles/pronunciacion/frase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nivel: paraNivel }),
      });
      const data = (await res.json()) as { frase?: PronFrase; error?: string };
      if (!res.ok || !data.frase) throw new Error(data.error ?? "No se pudo preparar una frase");
      setFrase(data.frase);
      nivelFrase.current = paraNivel;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo preparar una frase");
    } finally {
      setCargandoFrase(false);
    }
  }, []);

  // Primera frase, o una nueva cuando cambia el nivel.
  useEffect(() => {
    if (nivelFrase.current !== nivel) void siguiente(nivel);
  }, [nivel, siguiente]);

  async function evaluar(wav: Blob) {
    if (!frase) return;
    setEvaluando(true);
    setError(null);
    setResultado(null);
    try {
      const form = new FormData();
      form.append("frase_id", frase.id);
      form.append("audio", wav, "intento.wav");
      const res = await fetch("/api/ingles/pronunciacion/evaluar", { method: "POST", body: form });
      const data = (await res.json()) as {
        estado?: string;
        resultado?: PronResultado;
        saldo?: InglesSaldo;
        progreso?: PronProgreso;
        error?: string;
      };
      // Con "limite_voz" el saldo actualizado (0 de voz) ya muestra el aviso y la encuesta.
      if (data.saldo) onSaldo(data.saldo);
      if (data.estado === "limite_voz") return;
      if (!res.ok || !data.resultado) throw new Error(data.error ?? "No se pudo evaluar tu pronunciación");
      setResultado(data.resultado);
      if (data.progreso) setProgreso(data.progreso);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo evaluar tu pronunciación");
    } finally {
      setEvaluando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PronunciacionProgreso progreso={progreso} />

      <div
        className="rounded-2xl px-5 py-5 flex flex-col gap-3"
        style={{ background: "var(--color-surface-elevated)", border: `1px solid ${GOLD}33` }}
      >
        {cargandoFrase || !frase ? (
          <p className="text-sm flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
            {cargandoFrase && <Loader2 size={14} className="animate-spin" />}
            {cargandoFrase ? "Preparando tu frase..." : "Sin frase por ahora."}
          </p>
        ) : (
          <>
            <p className="text-xl font-semibold leading-snug" style={{ color: "var(--color-text)" }} lang="en">
              {frase.texto}
            </p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {frase.traduccion}
            </p>
            <button
              type="button"
              onClick={() => escuchar(frase.texto)}
              className="self-start flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: `${GOLD}1A`, border: `1px solid ${GOLD}55`, color: GOLD }}
            >
              <Volume2 size={14} />
              Escuchar
            </button>
          </>
        )}
      </div>

      {!resultado && !evaluando && frase && !sinVoz && (
        <PronunciacionGrabadora maxSegundos={maxSegundos} deshabilitado={cargandoFrase} onGrabado={evaluar} />
      )}

      {evaluando && (
        <p className="text-sm flex items-center justify-center gap-2 py-6" style={{ color: "var(--color-text-muted)" }}>
          <Loader2 size={16} className="animate-spin" />
          Evaluando tu pronunciación...
        </p>
      )}

      {resultado && <PronunciacionResultado resultado={resultado} />}

      {error && (
        <div
          className="px-4 py-3 rounded-2xl text-sm"
          style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.3)",
            color: "var(--color-destructive)",
          }}
        >
          {error}
        </div>
      )}

      {sinVoz && (
        <InglesLimiteVoz
          encuesta={props.encuestaVoz}
          onEncuesta={props.onEncuestaVoz}
          mensajesRestantes={saldo.gratisRestantes}
        />
      )}

      {frase && !evaluando && (
        <div className="flex gap-2 justify-center">
          {resultado && !sinVoz && (
            <button
              type="button"
              onClick={() => setResultado(null)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            >
              <RotateCcw size={14} />
              Intentar de nuevo
            </button>
          )}
          <button
            type="button"
            onClick={() => void siguiente(nivel)}
            disabled={cargandoFrase}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background: GOLD, color: "#000" }}
          >
            Siguiente frase
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      <p className="text-[11px] text-center" style={{ color: "var(--color-text-muted)" }}>
        Te quedan {saldo.vozRestantes} de {saldo.vozDiarios} intentos de voz hoy (aparte de tus mensajes). Si no se
        escucha tu voz o falla la evaluación, el intento no se cuenta.
      </p>
    </div>
  );
}

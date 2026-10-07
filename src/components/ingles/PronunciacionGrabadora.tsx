"use client";

import { Loader2, Mic, MicOff, Square } from "lucide-react";
import { useGrabadoraWav, type ErrorGrabadora } from "./useGrabadoraWav";

const GOLD = "#f5c842";

const AYUDA: Record<ErrorGrabadora, { titulo: string; pasos: string[] }> = {
  denegado: {
    titulo: "No tenemos permiso para usar tu micrófono",
    pasos: [
      "Chrome en computadora: toca el candado junto a la dirección del sitio → Micrófono → Permitir, y recarga la página.",
      "Chrome en Android: toca el candado (o los tres puntos → Configuración → Configuración de sitios) → Micrófono → Permitir.",
      "Safari en iPhone: toca \"aA\" en la barra de dirección → Configuración del sitio web → Micrófono → Permitir. Si no aparece, ve a Ajustes → Safari → Micrófono.",
    ],
  },
  sin_microfono: {
    titulo: "No encontramos un micrófono",
    pasos: [
      "Revisa que tu micrófono o audífonos estén conectados.",
      "Cierra otras apps que puedan estar usando el micrófono (videollamadas, grabadoras) e intenta de nuevo.",
    ],
  },
  no_soportado: {
    titulo: "Tu navegador no permite grabar aquí",
    pasos: [
      "Usa la versión más reciente de Chrome o Safari.",
      "Si abriste el enlace desde otra app (WhatsApp, Facebook), ábrelo en el navegador.",
    ],
  },
  otro: {
    titulo: "No se pudo iniciar la grabación",
    pasos: ["Recarga la página e intenta de nuevo."],
  },
};

function reloj(s: number): string {
  return `0:${String(s).padStart(2, "0")}`;
}

interface Props {
  maxSegundos: number;
  deshabilitado: boolean;
  onGrabado: (wav: Blob) => void;
}

export function PronunciacionGrabadora({ maxSegundos, deshabilitado, onGrabado }: Props) {
  const { estado, segundos, error, iniciar, detener } = useGrabadoraWav(maxSegundos, onGrabado);
  const grabando = estado === "grabando";
  const ocupado = estado === "pidiendo" || estado === "procesando";

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => void (grabando ? detener() : iniciar())}
        disabled={(deshabilitado && !grabando) || ocupado}
        aria-label={grabando ? "Detener grabación" : "Grabar mi voz"}
        className="w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-40"
        style={
          grabando
            ? { background: "var(--color-live)", color: "#fff", boxShadow: "0 0 0 8px rgba(255,68,68,0.2)" }
            : { background: GOLD, color: "#000", boxShadow: `0 0 20px ${GOLD}55` }
        }
      >
        {ocupado ? <Loader2 size={30} className="animate-spin" /> : grabando ? <Square size={26} /> : <Mic size={30} />}
      </button>

      <p className="text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
        {grabando ? (
          <>
            <span className="font-mono font-bold" style={{ color: "var(--color-live)" }}>
              ● {reloj(segundos)}
            </span>{" "}
            / {reloj(maxSegundos)} — toca para terminar
          </>
        ) : estado === "pidiendo" ? (
          "Esperando permiso del micrófono..."
        ) : estado === "procesando" ? (
          "Preparando tu grabación..."
        ) : (
          `Toca el micrófono y lee la frase (máximo ${maxSegundos} segundos)`
        )}
      </p>

      {error && (
        <div
          className="w-full px-4 py-3 rounded-2xl text-sm flex flex-col gap-2"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)" }}
        >
          <p className="font-semibold flex items-center gap-2" style={{ color: "var(--color-destructive)" }}>
            <MicOff size={15} />
            {AYUDA[error].titulo}
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            {AYUDA[error].pasos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

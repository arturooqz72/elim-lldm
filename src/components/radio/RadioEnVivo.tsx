"use client";

import { useEffect, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { InglesInstalar } from "@/components/ingles/InglesInstalar";
import { plataforma } from "@/components/ingles/instalacionApp";
import { RadioVisualizer } from "./RadioVisualizer";
import { useRadioEnVivo, type AhoraSuena } from "./useRadioEnVivo";

const DORADO = "#D4A017";

/**
 * Reproductor directo de la radio (/escuchar, la app Radio Elim): logo,
 * botón gigante, "En vivo 24/7", lo que suena ahora y volumen.
 */
export function RadioEnVivo({ inicial }: { inicial: AhoraSuena }) {
  const { audioRef, estado, alternar, volumen, silencio, cambiarVolumen, alternarSilencio, ahora } =
    useRadioEnVivo(inicial);
  // En iPhone el volumen de una página no se puede cambiar: solo los botones del teléfono.
  const [esIos, setEsIos] = useState(false);
  useEffect(() => setEsIos(plataforma() === "ios"), []);

  const sonando = estado === "sonando";
  const cargando = estado === "cargando";
  const efectivo = silencio ? 0 : volumen;

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center text-center">
      <audio ref={audioRef} preload="none" />

      <div className="flex flex-col items-center gap-2">
        <img
          src="/icons/icon-192.png"
          alt=""
          width={96}
          height={96}
          className="w-20 h-20 min-[400px]:w-24 min-[400px]:h-24 rounded-2xl"
          style={{ border: `1px solid ${DORADO}40` }}
        />
        <span
          className="text-2xl font-bold tracking-widest"
          style={{ fontFamily: "var(--font-cinzel)", color: "var(--color-primary)" }}
        >
          Elim LLDM
        </span>
      </div>
      <h1 className="text-base font-semibold mt-1" style={{ color: "var(--color-text)" }}>
        Radio Elim
      </h1>

      <span
        className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-bold"
        style={{ background: "var(--color-live)", color: "#fff" }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        En vivo 24/7
      </span>

      <button
        type="button"
        onClick={alternar}
        aria-label={sonando || cargando ? "Pausar" : "Reproducir"}
        className="mt-7 w-36 h-36 min-[400px]:w-40 min-[400px]:h-40 rounded-full flex items-center justify-center transition-transform duration-200 active:scale-95"
        style={{
          background: DORADO,
          color: "#000",
          boxShadow: sonando ? `0 0 48px ${DORADO}80` : `0 0 24px ${DORADO}33`,
        }}
      >
        {cargando ? (
          <span className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin" />
        ) : sonando ? (
          <Pause size={64} fill="currentColor" />
        ) : (
          <Play size={64} fill="currentColor" className="ml-2" />
        )}
      </button>
      <p className="text-xs mt-3 h-4" style={{ color: "var(--color-text-muted)" }}>
        {cargando ? "Conectando…" : sonando ? "Toca para pausar" : "Toca para escuchar"}
      </p>

      <div className="w-full mt-6 px-1">
        <RadioVisualizer isPlaying={sonando} />
      </div>

      {/* Lo que suena ahora */}
      <div
        className="w-full mt-4 rounded-2xl px-4 py-3 min-w-0"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          {ahora.locutor ? "Transmitiendo en vivo" : "Ahora suena"}
        </p>
        <p className="text-sm font-semibold mt-0.5 line-clamp-2" style={{ color: "var(--color-text)" }}>
          {ahora.locutor ?? ahora.titulo ?? "Elim LLDM Radio"}
        </p>
        {!ahora.locutor && ahora.artista && (
          <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
            {ahora.artista}
          </p>
        )}
        {typeof ahora.oyentes === "number" && (
          <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>
            {ahora.oyentes} {ahora.oyentes === 1 ? "oyente" : "oyentes"}
          </p>
        )}
      </div>

      {/* Volumen */}
      {esIos ? (
        <p className="text-xs mt-4" style={{ color: "var(--color-text-muted)" }}>
          Sube o baja el volumen con los botones de tu iPhone.
        </p>
      ) : (
        <div className="w-full flex items-center gap-3 mt-4 px-1">
          <button
            type="button"
            onClick={alternarSilencio}
            className="shrink-0 p-1"
            style={{ color: "var(--color-text-muted)" }}
            aria-label={silencio || volumen === 0 ? "Quitar silencio" : "Silenciar"}
          >
            {silencio || volumen === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={efectivo}
            onChange={(e) => cambiarVolumen(parseFloat(e.target.value))}
            aria-label="Volumen"
            className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${DORADO} ${efectivo * 100}%, var(--color-border) ${efectivo * 100}%)`,
              accentColor: DORADO,
            }}
          />
        </div>
      )}

      <div className="mt-6">
        <InglesInstalar nombreApp="Radio Elim" color={DORADO} />
      </div>
    </div>
  );
}

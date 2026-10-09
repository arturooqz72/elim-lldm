// src/components/juegos/ahorcado/AhorcadoGame.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Trophy, Heart, RotateCcw } from "lucide-react";
import { AhorcadoDibujo } from "./AhorcadoDibujo";
import { AhorcadoTeclado } from "./AhorcadoTeclado";
import { AhorcadoPista } from "./AhorcadoPista";
import type { AhorcadoCategoria } from "@/types";

const VIDAS_INICIALES = 6;

// Estado que devuelve el servidor (ver EstadoAhorcado en ahorcado.server.ts):
// nunca trae la palabra completa mientras se juega.
interface EstadoPartida {
  mascara: string[];
  letras: string[];
  correctas: string[];
  vidas: number;
  estado: "jugando" | "ganada" | "perdida";
  puntos: number;
  ganadas: number;
  puntosPalabra: number;
  categoria: AhorcadoCategoria;
  pista: string;
  referencia_biblica: string | null;
  palabra: string | null;
  nuevoRecord?: boolean;
}

export function AhorcadoGame() {
  const [partida, setPartida] = useState<EstadoPartida | null>(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pedirPalabra = useCallback(async (reiniciar = false) => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/juegos/ahorcado/palabra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reiniciar }),
      });
      if (!res.ok) throw new Error("No se pudo cargar una palabra nueva.");
      setPartida((await res.json()) as EstadoPartida);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar una palabra nueva.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    pedirPalabra();
  }, [pedirPalabra]);

  async function manejarLetra(letra: string) {
    if (!partida || partida.estado !== "jugando" || partida.letras.includes(letra) || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/juegos/ahorcado/letra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letra }),
      });
      if (!res.ok) throw new Error("No se pudo enviar la letra. Intenta de nuevo.");
      setPartida((await res.json()) as EstadoPartida);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la letra. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  const palabraActual = partida;
  const juegoTerminado = partida ? partida.estado !== "jugando" : false;
  const ganado = partida?.estado === "ganada";
  const intentosRestantes = partida?.vidas ?? VIDAS_INICIALES;
  const puntuacion = partida?.puntos ?? 0;
  const mensajeRanking =
    partida?.nuevoRecord === true
      ? "¡Nuevo récord guardado!"
      : partida?.nuevoRecord === false
        ? "Tu récord anterior sigue siendo mayor."
        : "";

  if (cargando && !palabraActual) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <p style={{ color: "var(--color-text-muted)" }}>Cargando...</p>
      </div>
    );
  }

  if (error && !palabraActual) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <p style={{ color: "var(--color-destructive)" }}>{error}</p>
      </div>
    );
  }

  if (!palabraActual) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-center gap-3 flex-wrap">
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Trophy size={16} style={{ color: "var(--color-primary)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {puntuacion} puntos
          </span>
        </div>
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Heart size={16} style={{ color: "var(--color-live)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {intentosRestantes} vidas
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <AhorcadoDibujo errores={VIDAS_INICIALES - intentosRestantes} />

        <div
          className="rounded-2xl p-5 flex flex-col gap-5"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <AhorcadoPista
            mascara={palabraActual.mascara}
            categoria={palabraActual.categoria}
            pista={palabraActual.pista}
            referenciaBiblica={palabraActual.referencia_biblica}
          />

          {juegoTerminado && (
            <div
              className="p-4 rounded-2xl text-center"
              style={{
                background: ganado ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
                border: `1px solid ${ganado ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}`,
              }}
            >
              {ganado ? (
                <>
                  <p className="font-bold text-lg mb-1" style={{ color: "var(--color-success)" }}>
                    ¡Ganaste!
                  </p>
                  <p className="text-sm" style={{ color: "var(--color-text)" }}>
                    +{palabraActual.puntosPalabra} puntos
                  </p>
                  {mensajeRanking && (
                    <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
                      {mensajeRanking}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="font-bold text-lg mb-1" style={{ color: "var(--color-destructive)" }}>
                    Perdiste
                  </p>
                  <p className="text-sm" style={{ color: "var(--color-text)" }}>
                    La palabra era: <strong>{palabraActual.palabra}</strong>
                  </p>
                </>
              )}
              {error && (
                <p className="text-xs mt-2" style={{ color: "var(--color-destructive)" }}>
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={() => pedirPalabra()}
                disabled={cargando}
                className="mt-3 px-4 py-2 rounded-xl text-sm font-bold"
                style={{ background: "var(--color-primary)", color: "#000" }}
              >
                Siguiente palabra
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        className="rounded-2xl p-5"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <AhorcadoTeclado
          correctas={palabraActual.correctas}
          letrasAdivinadas={palabraActual.letras}
          disabled={juegoTerminado || enviando}
          onLetra={manejarLetra}
        />
      </div>

      <div className="text-center">
        {error && (
          <p className="text-xs mb-2" style={{ color: "var(--color-destructive)" }}>
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => pedirPalabra(true)}
          disabled={cargando}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          <RotateCcw size={14} />
          Reiniciar juego
        </button>
      </div>
    </div>
  );
}

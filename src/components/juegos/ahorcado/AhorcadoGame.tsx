// src/components/juegos/ahorcado/AhorcadoGame.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Trophy, Heart, RotateCcw } from "lucide-react";
import { AhorcadoDibujo } from "./AhorcadoDibujo";
import { AhorcadoTeclado } from "./AhorcadoTeclado";
import { AhorcadoPista } from "./AhorcadoPista";
import type { AhorcadoCategoria } from "@/types";

const VIDAS_INICIALES = 6;

interface Palabra {
  id: string;
  palabra: string;
  categoria: AhorcadoCategoria;
  pista: string;
  referencia_biblica: string | null;
}

export function AhorcadoGame() {
  const [palabraActual, setPalabraActual] = useState<Palabra | null>(null);
  const [letrasAdivinadas, setLetrasAdivinadas] = useState<string[]>([]);
  const [intentosRestantes, setIntentosRestantes] = useState(VIDAS_INICIALES);
  const [puntuacion, setPuntuacion] = useState(0);
  const [palabrasGanadas, setPalabrasGanadas] = useState(0);
  const [juegoTerminado, setJuegoTerminado] = useState(false);
  const [ganado, setGanado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensajeRanking, setMensajeRanking] = useState("");

  const pedirPalabra = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/juegos/ahorcado/palabra-aleatoria");
      if (!res.ok) throw new Error("No se pudo cargar una palabra nueva.");
      const data = (await res.json()) as Palabra;
      setPalabraActual(data);
      setLetrasAdivinadas([]);
      setIntentosRestantes(VIDAS_INICIALES);
      setJuegoTerminado(false);
      setGanado(false);
      setMensajeRanking("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar una palabra nueva.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    pedirPalabra();
  }, [pedirPalabra]);

  async function guardarRanking(score: number, ganadas: number) {
    try {
      const res = await fetch("/api/juegos/ahorcado/ranking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, palabras_ganadas: ganadas }),
      });
      if (!res.ok) throw new Error("No se pudo guardar el ranking.");
      const data = (await res.json()) as { mejorado: boolean };
      setMensajeRanking(
        data.mejorado ? "¡Nuevo récord guardado!" : "Tu récord anterior sigue siendo mayor."
      );
    } catch (err) {
      setMensajeRanking(err instanceof Error ? err.message : "No se pudo guardar el ranking.");
    }
  }

  function manejarLetra(letra: string) {
    if (!palabraActual || juegoTerminado || letrasAdivinadas.includes(letra)) return;

    const nuevasLetras = [...letrasAdivinadas, letra];
    setLetrasAdivinadas(nuevasLetras);

    if (!palabraActual.palabra.includes(letra)) {
      const restantes = intentosRestantes - 1;
      setIntentosRestantes(restantes);
      if (restantes === 0) {
        setJuegoTerminado(true);
        setGanado(false);
      }
      return;
    }

    const completa = palabraActual.palabra
      .split("")
      .every((l) => l === " " || nuevasLetras.includes(l));

    if (completa) {
      const puntosGanados = intentosRestantes * 10;
      const nuevoScore = puntuacion + puntosGanados;
      const nuevasGanadas = palabrasGanadas + 1;

      setJuegoTerminado(true);
      setGanado(true);
      setPuntuacion(nuevoScore);
      setPalabrasGanadas(nuevasGanadas);
      guardarRanking(nuevoScore, nuevasGanadas);
    }
  }

  function reiniciar() {
    setPuntuacion(0);
    setPalabrasGanadas(0);
    pedirPalabra();
  }

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
            palabra={palabraActual.palabra}
            categoria={palabraActual.categoria}
            pista={palabraActual.pista}
            referenciaBiblica={palabraActual.referencia_biblica}
            letrasAdivinadas={letrasAdivinadas}
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
                    +{intentosRestantes * 10} puntos
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
                onClick={pedirPalabra}
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
          palabra={palabraActual.palabra}
          letrasAdivinadas={letrasAdivinadas}
          disabled={juegoTerminado}
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
          onClick={reiniciar}
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

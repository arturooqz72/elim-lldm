// src/components/juegos/ahorcado/AhorcadoGame.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Trophy, Heart, Gauge, RotateCcw } from "lucide-react";
import { AhorcadoDibujo } from "./AhorcadoDibujo";
import { AhorcadoTeclado } from "./AhorcadoTeclado";
import { PreguntaTikTokJuego } from "@/components/juegos/PreguntaTikTokJuego";
import { AhorcadoPista } from "./AhorcadoPista";
import { AhorcadoDificultad } from "./AhorcadoDificultad";
import { AhorcadoResultado } from "./AhorcadoResultado";
import {
  DIFICULTADES,
  PUNTOS_POR_PISTA,
  type Dificultad,
  type EstadoAhorcado,
  type SinPartidaAhorcado,
} from "@/lib/juegos/ahorcado-dificultad";

// El estado lo decide el servidor (ver ahorcado.server.ts): mientras se
// juega nunca trae la palabra, la descripción ni la cita, solo las pistas
// que ya se pidieron.
type Respuesta = EstadoAhorcado | SinPartidaAhorcado;

function esSinPartida(r: Respuesta): r is SinPartidaAhorcado {
  return "necesitaDificultad" in r;
}

async function enviar(url: string, cuerpo: object | null, mensajeError: string): Promise<Respuesta> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Respuesta | { error?: string };
  if (!res.ok) throw new Error(("error" in data && data.error) || mensajeError);
  return data as Respuesta;
}

export function AhorcadoGame() {
  const [partida, setPartida] = useState<EstadoAhorcado | null>(null);
  /** Se muestra el selector de dificultad (al inicio, al perder o con "Cambiar dificultad"). */
  const [eligiendo, setEligiendo] = useState(false);
  const [ultimaDificultad, setUltimaDificultad] = useState<Dificultad>("normal");
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aplicar = useCallback((r: Respuesta) => {
    if (esSinPartida(r)) {
      setUltimaDificultad(r.dificultad);
      setEligiendo(true);
      return;
    }
    setPartida(r);
    setUltimaDificultad(r.dificultad);
    setEligiendo(false);
  }, []);

  const pedirPalabra = useCallback(
    async (dificultad?: Dificultad) => {
      setCargando(true);
      setError(null);
      try {
        aplicar(
          await enviar(
            "/api/juegos/ahorcado/palabra",
            dificultad ? { dificultad } : null,
            "No se pudo cargar una palabra nueva.",
          ),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar una palabra nueva.");
      } finally {
        setCargando(false);
      }
    },
    [aplicar],
  );

  useEffect(() => {
    pedirPalabra();
  }, [pedirPalabra]);

  async function accion(url: string, cuerpo: object | null, mensajeError: string) {
    if (!partida || partida.estado !== "jugando" || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      aplicar(await enviar(url, cuerpo, mensajeError));
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeError);
    } finally {
      setEnviando(false);
    }
  }

  function manejarLetra(letra: string) {
    if (partida?.letras.includes(letra)) return;
    void accion("/api/juegos/ahorcado/letra", { letra }, "No se pudo enviar la letra. Intenta de nuevo.");
  }

  function manejarPista() {
    void accion("/api/juegos/ahorcado/pista", null, "No se pudo pedir la pista. Intenta de nuevo.");
  }

  if (cargando && !partida && !eligiendo) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <p style={{ color: "var(--color-text-muted)" }}>Cargando...</p>
      </div>
    );
  }

  if (eligiendo) {
    return (
      <div className="flex flex-col gap-3">
        <AhorcadoDificultad
          inicial={ultimaDificultad}
          cargando={cargando}
          onEmpezar={(d) => pedirPalabra(d)}
          onCancelar={partida?.estado === "jugando" ? () => setEligiendo(false) : undefined}
        />
        {error && (
          <p className="text-xs text-center" style={{ color: "var(--color-destructive)" }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  if (!partida) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <p style={{ color: "var(--color-destructive)" }}>{error ?? "No se pudo cargar una palabra nueva."}</p>
      </div>
    );
  }

  const config = DIFICULTADES[partida.dificultad];
  const juegoTerminado = partida.estado !== "jugando";
  const costoPista = config.pistas === "gratis" ? "gratis" : `1 vida y ${PUNTOS_POR_PISTA} puntos`;
  const motivoBloqueo =
    config.pistas === "con-costo" && partida.vidas <= 1 ? "Te queda una sola vida: otra pista te haría perder." : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-center gap-3 flex-wrap">
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Trophy size={16} style={{ color: "var(--color-primary)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {partida.puntos} puntos
          </span>
        </div>
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Heart size={16} style={{ color: "var(--color-live)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {partida.vidas} {partida.vidas === 1 ? "vida" : "vidas"}
          </span>
        </div>
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Gauge size={16} style={{ color: "var(--color-primary)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {config.nombre}
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <AhorcadoDibujo errores={partida.vidasIniciales - partida.vidas} vidasIniciales={partida.vidasIniciales} />

        <div
          className="rounded-2xl p-5 flex flex-col gap-5"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <AhorcadoPista
            mascara={partida.mascara}
            pistas={partida.pistas}
            pistasTotales={juegoTerminado ? 0 : partida.pistasTotales}
            costo={costoPista}
            motivoBloqueo={motivoBloqueo}
            pidiendo={enviando}
            onPedir={manejarPista}
          />

          {juegoTerminado && (
            <AhorcadoResultado
              partida={partida}
              error={error}
              cargando={cargando}
              onSiguiente={() => pedirPalabra()}
              onNuevaRacha={() => setEligiendo(true)}
            />
          )}
          {juegoTerminado && <PreguntaTikTokJuego />}
        </div>
      </div>

      <div
        className="rounded-2xl p-5"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <AhorcadoTeclado
          correctas={partida.correctas}
          letrasAdivinadas={partida.letras}
          disabled={juegoTerminado || enviando}
          onLetra={manejarLetra}
        />
      </div>

      <div className="text-center">
        {error && !juegoTerminado && (
          <p className="text-xs mb-2" style={{ color: "var(--color-destructive)" }}>
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => setEligiendo(true)}
          disabled={cargando}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold min-h-11"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          <RotateCcw size={14} />
          Reiniciar o cambiar dificultad
        </button>
      </div>
    </div>
  );
}

// src/components/juegos/palabra/PalabraGame.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { PALABRA_LONGITUD } from "@/lib/palabra/config";
import { normalizarPalabra } from "@/lib/palabra/logica";
import type {
  PalabraColor,
  PalabraEstadoJugador,
  PalabraIntento,
  PalabraPartidaEstado,
  PalabraRevelada,
} from "@/types";
import { ayudaYaVista, estadoLocal, guardarPartidaLocal, marcarAyudaVista } from "./almacenamiento";
import { useRecargaAlCambiarDia, useSincronizacionLocal, useTecladoFisico } from "./hooks";
import { DURACION_REVELADO, PalabraTablero } from "./PalabraTablero";
import { PalabraTeclado } from "./PalabraTeclado";
import { PalabraBarraSuperior } from "./PalabraBarraSuperior";
import { PalabraModales } from "./PalabraModales";
import { PalabraResultado } from "./PalabraResultado";
import { InvitacionSesion } from "./InvitacionSesion";
import { PalabraPista } from "./PalabraPista";
import { ESTILOS_PALABRA } from "./estilos";

const PRIORIDAD: Record<PalabraColor, number> = { absent: 0, present: 1, correct: 2 };

const MENSAJES_VICTORIA = ["¡Asombroso!", "¡Excelente!", "¡Muy bien!", "¡Bien hecho!", "¡Lo lograste!", "¡Por poco!"];

interface PalabraGameProps {
  fecha: string;
  numero: number;
  hayPalabra: boolean;
  conSesion: boolean;
  /** Estado desde Supabase si hay sesión; null si se juega sin sesión (se lee de localStorage). */
  estadoInicial: PalabraEstadoJugador | null;
}

interface RespuestaIntento {
  intento: PalabraIntento;
  terminada: boolean;
  resuelta: boolean;
  revelado: PalabraRevelada | null;
  estado?: PalabraEstadoJugador;
  error?: string;
  mensaje?: string;
}

export function PalabraGame({ fecha, numero, hayPalabra, conSesion, estadoInicial }: PalabraGameProps) {
  const [estado, setEstado] = useState<PalabraEstadoJugador | null>(estadoInicial);
  const [actual, setActual] = useState("");
  const [revelandoFila, setRevelandoFila] = useState<number | null>(null);
  const [sacudir, setSacudir] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [modal, setModal] = useState<"ayuda" | "estadisticas" | null>(null);
  const resultadoRef = useRef<HTMLDivElement>(null);
  const temporizadorAviso = useRef<number | undefined>(undefined);

  const mostrarAviso = useCallback((mensaje: string, ms = 1800) => {
    setAviso(mensaje);
    window.clearTimeout(temporizadorAviso.current);
    temporizadorAviso.current = window.setTimeout(() => setAviso(null), ms);
  }, []);

  // Sin sesión: el estado vive en localStorage, que solo existe después de
  // montar (leerlo antes rompería la hidratación).
  useEffect(() => {
    if (!conSesion) setEstado(estadoLocal(fecha));
  }, [conSesion, fecha]);

  // Ayuda "Cómo jugar" la primera vez.
  useEffect(() => {
    if (!ayudaYaVista()) setModal("ayuda");
  }, []);

  useSincronizacionLocal(conSesion, fecha, setEstado, mostrarAviso);
  useRecargaAlCambiarDia(fecha);

  const partida: PalabraPartidaEstado = estado?.partida ?? {
    intentos: [],
    terminada: false,
    resuelta: false,
    pistaUsada: false,
  };
  const bloqueado = !estado || !hayPalabra || partida.terminada || enviando || revelandoFila !== null;

  function sacudirFila() {
    setSacudir(true);
    window.setTimeout(() => setSacudir(false), 600);
  }

  async function enviar() {
    if (actual.length < PALABRA_LONGITUD) {
      mostrarAviso("Faltan letras");
      sacudirFila();
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/juegos/palabra/intento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intento: actual,
          previos: conSesion ? undefined : partida.intentos.map((i) => i.palabra),
        }),
      });
      const data = (await res.json()) as RespuestaIntento;

      if (!res.ok) {
        if (data.error === "no_valida" || data.error === "formato") {
          mostrarAviso(data.mensaje ?? "No está en la lista de palabras");
          sacudirFila();
        } else if (data.error === "conflicto" || (conSesion && data.error === "terminada")) {
          window.location.reload();
        } else {
          mostrarAviso(data.mensaje ?? "Algo salió mal. Intenta de nuevo.", 3000);
        }
        return;
      }

      const intentos = [...partida.intentos, data.intento];
      const nuevaPartida: PalabraPartidaEstado = {
        intentos,
        terminada: data.terminada,
        resuelta: data.resuelta,
        pistaUsada: partida.pistaUsada,
      };
      const filaRevelada = intentos.length - 1;
      setActual("");
      setRevelandoFila(filaRevelada);

      if (conSesion) {
        setEstado((prev) =>
          data.estado ?? (prev ? { ...prev, partida: nuevaPartida, revelado: data.revelado } : prev)
        );
      } else {
        guardarPartidaLocal(fecha, { ...nuevaPartida, revelado: data.revelado, pista: estado?.pista ?? null });
        setEstado(estadoLocal(fecha));
      }

      // Al terminar la animación de giro: festejo y, si acabó, resultado.
      window.setTimeout(() => {
        setRevelandoFila(null);
        if (!data.terminada) return;
        if (data.resuelta) {
          mostrarAviso(MENSAJES_VICTORIA[filaRevelada] ?? "¡Bien hecho!", 2200);
          confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 }, colors: ["#D4A017", "#538D4E", "#F8F8FF"] });
        }
        window.setTimeout(() => resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
      }, DURACION_REVELADO + 100);
    } catch {
      mostrarAviso("Sin conexión. Intenta de nuevo.", 3000);
    } finally {
      setEnviando(false);
    }
  }

  function aplicarPista(pista: string) {
    const conPista: PalabraPartidaEstado = { ...partida, pistaUsada: true };
    if (conSesion) {
      setEstado((prev) => (prev ? { ...prev, partida: conPista, pista } : prev));
    } else {
      guardarPartidaLocal(fecha, { ...conPista, revelado: null, pista });
      setEstado(estadoLocal(fecha));
    }
  }

  function manejarTecla(tecla: string) {
    if (bloqueado || modal) return;
    if (tecla === "ENVIAR") {
      void enviar();
      return;
    }
    if (tecla === "BORRAR") {
      setActual((a) => a.slice(0, -1));
      return;
    }
    const letra = normalizarPalabra(tecla);
    if (/^[A-ZÑ]$/.test(letra)) {
      setActual((a) => (a.length < PALABRA_LONGITUD ? a + letra : a));
    }
  }

  useTecladoFisico(manejarTecla);

  // Color de cada tecla: el mejor que haya tenido esa letra (sin contar la
  // fila que se está revelando, para no adelantar el resultado).
  const estadosTeclas = new Map<string, PalabraColor>();
  partida.intentos.forEach((intento, fila) => {
    if (fila === revelandoFila) return;
    [...intento.palabra].forEach((letra, i) => {
      const color = intento.colores[i];
      const previo = estadosTeclas.get(letra);
      if (!previo || PRIORIDAD[color] > PRIORIDAD[previo]) estadosTeclas.set(letra, color);
    });
  });

  const cerrarModal = useCallback(() => {
    setModal((m) => {
      if (m === "ayuda") marcarAyudaVista();
      return null;
    });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <style>{ESTILOS_PALABRA}</style>

      <PalabraBarraSuperior
        numero={numero}
        racha={estado?.racha.actual ?? 0}
        comodinesUsados={estado?.comodinesUsados ?? 0}
        estadisticasDisponibles={Boolean(estado)}
        onAyuda={() => setModal("ayuda")}
        onEstadisticas={() => setModal("estadisticas")}
      />

      {hayPalabra && estado && (
        <PalabraPista
          pista={estado.pista}
          disponible={!partida.terminada}
          conSesion={conSesion}
          onPista={aplicarPista}
          onError={(m) => mostrarAviso(m, 3000)}
        />
      )}

      <div className="relative">
        {aviso && (
          <div
            role="status"
            className="absolute left-1/2 -translate-x-1/2 -top-1 z-10 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap shadow-lg"
            style={{ background: "var(--color-text)", color: "var(--color-bg)" }}
          >
            {aviso}
          </div>
        )}

        {hayPalabra ? (
          <PalabraTablero
            intentos={partida.intentos}
            actual={actual}
            revelandoFila={revelandoFila}
            sacudir={sacudir}
            terminada={partida.terminada}
          />
        ) : (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <p style={{ color: "var(--color-text-muted)" }}>
              Hoy no hay palabra programada todavía. ¡Vuelve más tarde!
            </p>
          </div>
        )}
      </div>

      {hayPalabra && !partida.terminada && (
        <PalabraTeclado estados={estadosTeclas} deshabilitado={bloqueado} onTecla={manejarTecla} />
      )}

      {estado && partida.terminada && revelandoFila === null && (
        <div ref={resultadoRef} className="scroll-mt-20">
          <PalabraResultado
            fecha={fecha}
            partida={partida}
            revelado={estado.revelado}
            estado={estado}
            conSesion={conSesion}
            onAviso={mostrarAviso}
          />
        </div>
      )}

      {!conSesion && !partida.terminada && <InvitacionSesion />}

      <PalabraModales modal={modal} estado={estado} partida={partida} conSesion={conSesion} onCerrar={cerrarModal} />
    </div>
  );
}

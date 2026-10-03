// src/components/juegos/palabra/PalabraTablero.tsx
import { PALABRA_LONGITUD, PALABRA_MAX_INTENTOS } from "@/lib/palabra/config";
import type { PalabraIntento } from "@/types";
import { COLOR_FONDO, ETIQUETA_COLOR } from "./colores";

/** Duración del giro de cada letra y el escalonado entre letras (ms). */
export const DURACION_GIRO = 500;
export const ESCALONADO_GIRO = 280;
export const DURACION_REVELADO = ESCALONADO_GIRO * (PALABRA_LONGITUD - 1) + DURACION_GIRO;

interface PalabraTableroProps {
  intentos: PalabraIntento[];
  actual: string;
  /** Fila que se está revelando ahora (anima el giro), o null. */
  revelandoFila: number | null;
  sacudir: boolean;
  terminada: boolean;
}

export function PalabraTablero({ intentos, actual, revelandoFila, sacudir, terminada }: PalabraTableroProps) {
  const filas = Array.from({ length: PALABRA_MAX_INTENTOS }, (_, i) => i);
  const filaActual = terminada ? -1 : intentos.length;

  return (
    <div
      className="grid gap-1.5 mx-auto w-full"
      style={{
        // El alto del tablero es ~1.2 × su ancho: se limita por la altura de
        // la pantalla para que tablero + teclado quepan sin scroll en
        // celulares chicos (375×667), y a 330px en los grandes.
        maxWidth: "clamp(220px, calc((100dvh - 330px) / 1.2), 330px)",
        gridTemplateRows: `repeat(${PALABRA_MAX_INTENTOS}, 1fr)`,
      }}
      role="grid"
      aria-label="Tablero de intentos"
    >
      {filas.map((fila) => {
        const evaluada = intentos[fila];
        const esActual = fila === filaActual;
        const letras = evaluada ? [...evaluada.palabra] : esActual ? [...actual] : [];
        const animarGiro = evaluada && revelandoFila === fila;

        return (
          <div
            key={fila}
            role="row"
            className={`grid gap-1.5 ${esActual && sacudir ? "palabra-sacudir" : ""}`}
            style={{ gridTemplateColumns: `repeat(${PALABRA_LONGITUD}, 1fr)` }}
          >
            {Array.from({ length: PALABRA_LONGITUD }, (_, col) => {
              const letra = letras[col] ?? "";
              const color = evaluada?.colores[col];
              return (
                <div
                  key={`${col}-${letra}`}
                  role="gridcell"
                  aria-label={letra ? `${letra}${color ? `, ${ETIQUETA_COLOR[color]}` : ""}` : "vacía"}
                  className={`aspect-square flex items-center justify-center rounded-lg font-bold select-none ${
                    animarGiro ? "palabra-girar" : letra && !evaluada ? "palabra-pop" : ""
                  }`}
                  style={
                    {
                      fontSize: "clamp(1.4rem, 7vw, 2rem)",
                      color: "var(--color-text)",
                      background: color ? "var(--palabra-ficha-bg)" : "var(--color-surface)",
                      border: `2px solid ${
                        color ? "transparent" : letra ? "var(--color-text-muted)" : "var(--color-border)"
                      }`,
                      "--palabra-ficha-bg": color ? COLOR_FONDO[color] : undefined,
                      animationDelay: animarGiro ? `${col * ESCALONADO_GIRO}ms` : undefined,
                      animationDuration: animarGiro ? `${DURACION_GIRO}ms` : undefined,
                    } as React.CSSProperties
                  }
                >
                  {letra}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// src/components/juegos/palabra/PalabraPista.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { PALABRA_FALLOS_SEGUNDA_PISTA } from "@/lib/palabra/config";
import type { PalabraCategoria } from "@/types";

interface PalabraPistaProps {
  /** Primera pista: siempre visible. */
  categoria: PalabraCategoria | null;
  /** Segunda pista ("Búscala en Mateo 6"); null hasta el 2.º intento fallido. */
  pista: string | null;
  /** Intentos fallidos hasta ahora, para avisar cuándo llega la segunda pista. */
  fallidos: number;
  terminada: boolean;
}

// "Pista 1: es un objeto" — con su artículo.
const CATEGORIA_CON_ARTICULO: Record<PalabraCategoria, string> = {
  persona: "una persona",
  lugar: "un lugar",
  objeto: "un objeto",
  accion: "una acción",
  concepto: "un concepto",
};

const tarjeta = "flex items-start gap-2 w-full rounded-xl px-3 py-2 text-[13px] leading-snug";

/**
 * Pistas gratis arriba del tablero (no restan puntos), como dos tarjetas:
 * la categoría desde el inicio, y el libro y capítulo después del 2.º
 * intento fallido (antes se ve bloqueada, diciendo cuánto falta). Cuando
 * se desbloquea durante la partida, la tarjeta hace una animación corta
 * para que se note. Las dos caben a 360px sin cortarse: el texto puede
 * pasar a dos líneas y el tablero reserva ese alto (ver PalabraTablero).
 */
export function PalabraPista({ categoria, pista, fallidos, terminada }: PalabraPistaProps) {
  // Solo se anima si la pista aparece mientras juega, no si ya estaba al
  // abrir la página (por ejemplo, al volver más tarde a la partida).
  const pistaAlMontar = useRef(pista);
  const [recienDesbloqueada, setRecienDesbloqueada] = useState(false);

  useEffect(() => {
    if (pista && !pistaAlMontar.current) setRecienDesbloqueada(true);
  }, [pista]);

  if (!categoria && !pista) return null;
  const faltan = PALABRA_FALLOS_SEGUNDA_PISTA - fallidos;
  const mostrarBloqueada = !pista && !terminada && faltan > 0;

  return (
    <div className="flex flex-col gap-1.5 w-full max-w-[330px] mx-auto">
      {categoria && (
        <div
          className={tarjeta}
          style={{ background: "rgba(212,160,23,0.12)", border: "1px solid rgba(212,160,23,0.45)", color: "var(--color-text)" }}
        >
          <span aria-hidden="true">💡</span>
          <p>
            <strong style={{ color: "var(--color-primary)" }}>Pista 1:</strong> es {CATEGORIA_CON_ARTICULO[categoria]}
          </p>
        </div>
      )}

      <div aria-live="polite">
        {pista ? (
          <div
            className={`${tarjeta}${recienDesbloqueada ? " palabra-pista-aparece" : ""}`}
            style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.45)", color: "var(--color-text)" }}
          >
            <span aria-hidden="true">📖</span>
            <p>
              <strong style={{ color: "var(--color-success)" }}>Pista 2:</strong>{" "}
              {pista.charAt(0).toLowerCase() + pista.slice(1)}
            </p>
          </div>
        ) : (
          mostrarBloqueada && (
            <div
              className={tarjeta}
              style={{ background: "var(--color-surface)", border: "1px dashed var(--color-border)", color: "var(--color-text-muted)" }}
            >
              <span aria-hidden="true">🔒</span>
              <p>
                <strong style={{ color: "var(--color-text)" }}>Pista 2:</strong> libro y capítulo. Se desbloquea al fallar{" "}
                {faltan === 1 ? "1 vez más" : `${faltan} veces`}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

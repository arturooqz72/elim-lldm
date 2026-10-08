// src/components/juegos/palabra/PalabraPista.tsx
"use client";

import { Lightbulb, Tag } from "lucide-react";
import { PALABRA_FALLOS_SEGUNDA_PISTA } from "@/lib/palabra/config";
import { NOMBRE_CATEGORIA } from "@/lib/palabra/logica";
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

/**
 * Pistas gratis arriba del tablero (no restan puntos): la categoría desde
 * el inicio y el libro y capítulo después del 2.º intento fallido.
 */
export function PalabraPista({ categoria, pista, fallidos, terminada }: PalabraPistaProps) {
  if (!categoria && !pista) return null;
  const faltan = PALABRA_FALLOS_SEGUNDA_PISTA - fallidos;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
      {categoria && (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)", color: "var(--color-text)" }}
        >
          <Tag size={13} className="shrink-0" style={{ color: "var(--color-primary)" }} />
          <span>
            Categoría: <strong>{NOMBRE_CATEGORIA[categoria]}</strong>
          </span>
        </span>
      )}

      {pista ? (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)", color: "var(--color-text)" }}
        >
          <Lightbulb size={13} className="shrink-0" style={{ color: "var(--color-primary)" }} />
          <strong>{pista}</strong>
        </span>
      ) : (
        !terminada &&
        faltan > 0 && (
          <span className="px-1" style={{ color: "var(--color-text-muted)" }}>
            💡 Otra pista {faltan === 1 ? "tras 1 intento fallido más" : `tras ${faltan} intentos fallidos`}
          </span>
        )
      )}
    </div>
  );
}

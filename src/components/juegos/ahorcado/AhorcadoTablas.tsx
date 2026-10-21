// src/components/juegos/ahorcado/AhorcadoTablas.tsx
"use client";

import { useState } from "react";
import { TablaPosiciones } from "@/components/juegos/TablaPosiciones";
import { DIFICULTADES, DIFICULTADES_ORDEN, type Dificultad } from "@/lib/juegos/ahorcado-dificultad";
import type { FilaPosicion } from "@/types";

type Pestana = Dificultad | "historicos";

interface AhorcadoTablasProps {
  porNivel: Record<Dificultad, FilaPosicion[]>;
  historicos: FilaPosicion[];
  /** El nivel que está jugando la persona (o Normal). */
  inicial: Dificultad;
  currentUserId: string | null;
}

/**
 * Una tabla por nivel, porque Difícil da más puntos por vida que Normal y
 * Fácil. "Récords históricos" son los de antes de los niveles, tal cual
 * quedaron (game_key "ahorcado").
 */
export function AhorcadoTablas({ porNivel, historicos, inicial, currentUserId }: AhorcadoTablasProps) {
  const [pestana, setPestana] = useState<Pestana>(inicial);
  const pestanas: Array<{ id: Pestana; nombre: string }> = [
    ...DIFICULTADES_ORDEN.map((d) => ({ id: d as Pestana, nombre: DIFICULTADES[d].nombre })),
    { id: "historicos", nombre: "Históricos" },
  ];

  return (
    <div id="tablas" className="flex flex-col gap-3 scroll-mt-20">
      <div
        className="grid grid-cols-4 gap-1 p-1 rounded-xl"
        role="tablist"
        aria-label="Tablas de posiciones"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        {pestanas.map((p) => {
          const activa = p.id === pestana;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => setPestana(p.id)}
              className="min-h-11 rounded-lg text-xs sm:text-sm font-semibold transition-colors"
              style={{
                background: activa ? "rgba(212,160,23,0.14)" : "transparent",
                color: activa ? "var(--color-primary-light)" : "var(--color-text-muted)",
                border: `1px solid ${activa ? "var(--color-primary)" : "transparent"}`,
              }}
            >
              {p.nombre}
            </button>
          );
        })}
      </div>

      {pestana === "historicos" ? (
        <div className="flex flex-col gap-2">
          <TablaPosiciones
            titulo="Récords históricos — Ahorcado del Nuevo Testamento"
            filas={historicos}
            currentUserId={currentUserId}
            unidadSingular="palabra"
            unidadPlural="palabras"
            vacio="No hay récords de antes de los niveles."
          />
          <p className="text-xs text-center px-2" style={{ color: "var(--color-text-muted)" }}>
            Récords de antes del 21 de octubre de 2026, cuando el juego no tenía niveles. Ya no cambian.
          </p>
        </div>
      ) : (
        <TablaPosiciones
          titulo={`Tabla de posiciones — ${DIFICULTADES[pestana].nombre}`}
          filas={porNivel[pestana]}
          currentUserId={currentUserId}
          unidadSingular="palabra"
          unidadPlural="palabras"
          vacio={`Aún nadie tiene récord en ${DIFICULTADES[pestana].nombre}. ¡Sé el primero!`}
        />
      )}
    </div>
  );
}

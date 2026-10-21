// src/components/juegos/ahorcado/AhorcadoDificultad.tsx
"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { DIFICULTADES, DIFICULTADES_ORDEN, type Dificultad } from "@/lib/juegos/ahorcado-dificultad";

interface AhorcadoDificultadProps {
  /** La que queda marcada al abrir (la última que usó). */
  inicial: Dificultad;
  cargando: boolean;
  onEmpezar: (dificultad: Dificultad) => void;
  /** Para volver a la partida en curso sin cambiar nada. */
  onCancelar?: () => void;
}

/** Se elige antes de empezar una racha; cambiarla empieza los puntos de cero. */
export function AhorcadoDificultad({ inicial, cargando, onEmpezar, onCancelar }: AhorcadoDificultadProps) {
  const [elegida, setElegida] = useState<Dificultad>(inicial);

  return (
    <div
      className="rounded-2xl p-5 sm:p-6 flex flex-col gap-5"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="text-center flex flex-col gap-1">
        <h2 className="text-xl font-bold" style={{ color: "var(--color-text)" }}>
          Elige la dificultad
        </h2>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Solo verás los guiones de la palabra. La cita bíblica sale al terminar.
        </p>
        {onCancelar && (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Al empezar de nuevo, los puntos de la racha actual vuelven a cero.
          </p>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Dificultad">
        {DIFICULTADES_ORDEN.map((d) => {
          const config = DIFICULTADES[d];
          const activa = d === elegida;
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={activa}
              onClick={() => setElegida(d)}
              className="rounded-xl p-4 text-left flex flex-col gap-1 transition-colors min-h-11"
              style={{
                background: activa ? "rgba(212,160,23,0.12)" : "var(--color-surface-elevated)",
                border: `1px solid ${activa ? "var(--color-primary)" : "var(--color-border)"}`,
              }}
            >
              <span
                className="font-bold"
                style={{ color: activa ? "var(--color-primary-light)" : "var(--color-text)" }}
              >
                {config.nombre}
              </span>
              <span className="text-xs leading-snug" style={{ color: "var(--color-text-muted)" }}>
                {config.descripcion}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onEmpezar(elegida)}
        disabled={cargando}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold transition-all duration-200"
        style={{
          background: cargando ? "var(--color-surface-elevated)" : "var(--color-primary)",
          color: cargando ? "var(--color-text-muted)" : "#000",
        }}
      >
        {cargando ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <>
            Empezar <ArrowRight size={18} />
          </>
        )}
      </button>

      {onCancelar && (
        <button
          type="button"
          onClick={onCancelar}
          className="text-sm underline underline-offset-2 self-center min-h-11"
          style={{ color: "var(--color-text-muted)" }}
        >
          Volver a la palabra que estaba jugando
        </button>
      )}
    </div>
  );
}

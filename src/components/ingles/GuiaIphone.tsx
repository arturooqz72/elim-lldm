"use client";

import { Share, SquarePlus, X } from "lucide-react";

interface Props {
  titulo: string;
  /** Texto antes de los pasos (por ejemplo, por qué hace falta instalarla). */
  intro?: string;
  color?: string;
  onCerrar: () => void;
}

/** Mini guía para agregar la app a la pantalla de inicio del iPhone (Safari). */
export function GuiaIphone({ titulo, intro, color: GOLD = "#f5c842", onCerrar }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guia-iphone-titulo"
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5"
        style={{ background: "var(--color-surface-elevated)", border: `1px solid ${GOLD}55` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <p id="guia-iphone-titulo" className="text-base font-bold" style={{ color: "var(--color-text)" }}>
            {titulo}
          </p>
          <button
            type="button"
            onClick={onCerrar}
            className="p-1 rounded-lg shrink-0"
            style={{ color: "var(--color-text-muted)" }}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {intro && (
          <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
            {intro}
          </p>
        )}

        <ol className="flex flex-col gap-3 text-sm" style={{ color: "var(--color-text)" }}>
          <li className="flex items-center gap-3">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `${GOLD}1A`, color: GOLD }}
            >
              <Share size={16} />
            </span>
            <span>
              1. Toca <strong>Compartir</strong> en la barra de Safari.
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `${GOLD}1A`, color: GOLD }}
            >
              <SquarePlus size={16} />
            </span>
            <span>
              2. Luego toca <strong>Agregar a pantalla de inicio</strong>.
            </span>
          </li>
        </ol>

        <p className="text-xs mt-4" style={{ color: "var(--color-text-muted)" }}>
          Si no ves la opción, desliza hacia abajo en el menú de Compartir.
        </p>

        <button
          type="button"
          onClick={onCerrar}
          className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: GOLD, color: "#000" }}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, Circle, Flame, Target } from "lucide-react";
import type { InglesReto, InglesRetoAvance } from "@/types";

const GOLD = "#f5c842";

interface Props {
  reto: InglesReto;
  /** null = visitante sin cuenta (solo lo puede ver). */
  avance: InglesRetoAvance | null;
  enReto: boolean;
  onEmpezar?: () => void;
  onSalir?: () => void;
}

/**
 * Reto del día, arriba del chat. Cerrado ocupa una línea; abierto muestra
 * las 3 frases. Mientras se hace el reto queda abierto y marca las frases
 * que ya practicó (una por mensaje).
 */
export function InglesRetoTarjeta({ reto, avance, enReto, onEmpezar, onSalir }: Props) {
  const [abierta, setAbierta] = useState(false);
  const verFrases = abierta || enReto;
  const hechas = avance ? Math.min(avance.mensajes, reto.frases.length) : 0;

  let estado: React.ReactNode = null;
  if (avance?.completado) {
    estado = (
      <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--color-success)" }}>
        <CheckCircle2 size={14} /> Completado
      </span>
    );
  } else if (avance && enReto) {
    estado = (
      <span className="text-xs font-semibold" style={{ color: GOLD }}>
        {Math.min(avance.mensajes, avance.requeridos)}/{avance.requeridos}
      </span>
    );
  }

  return (
    <div className="px-3 min-[400px]:px-5 py-2 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setAbierta((a) => !a)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
          aria-expanded={verFrases}
        >
          <Target size={15} className="shrink-0" style={{ color: GOLD }} />
          <span className="text-xs min-w-0 truncate" style={{ color: "var(--color-text)" }}>
            <span style={{ color: "var(--color-text-muted)" }}>Reto de hoy: </span>
            <strong>{reto.titulo}</strong>
          </span>
          {!enReto && (
            <ChevronDown
              size={14}
              className="shrink-0 transition-transform"
              style={{ color: "var(--color-text-muted)", transform: verFrases ? "rotate(180deg)" : undefined }}
            />
          )}
        </button>
        {estado}
        {avance && !enReto && !avance.completado && onEmpezar && (
          <button
            type="button"
            onClick={onEmpezar}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 whitespace-nowrap"
            style={{ background: GOLD, color: "#000" }}
          >
            Hacer reto
          </button>
        )}
        {enReto && onSalir && (
          <button
            type="button"
            onClick={onSalir}
            className="text-xs font-semibold shrink-0 whitespace-nowrap hover:underline"
            style={{ color: "var(--color-text-muted)" }}
          >
            Volver al chat
          </button>
        )}
      </div>

      {verFrases && (
        <div className="mt-2 flex flex-col gap-1.5">
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {reto.descripcion}
          </p>
          <ol className="flex flex-col gap-1.5">
            {reto.frases.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                {avance && i < hechas ? (
                  <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: "var(--color-success)" }} />
                ) : (
                  <Circle size={14} className="shrink-0 mt-0.5" style={{ color: `${GOLD}99` }} />
                )}
                <span>
                  <strong style={{ color: "var(--color-text)" }}>{f.en}</strong>
                  <span style={{ color: "var(--color-text-muted)" }}> — {f.es}</span>
                </span>
              </li>
            ))}
          </ol>

          {!avance && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-1">
              <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--color-text)" }}>
                <Flame size={13} style={{ color: GOLD }} />
                Crea tu cuenta gratis para hacer el reto con la tutora y guardar tu racha.
              </p>
              <Link
                href="/login?returnUrl=%2Fingles&modo=registro"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: GOLD, color: "#000" }}
              >
                Crear cuenta gratis
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

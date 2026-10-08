"use client";

import { useEffect, useState } from "react";
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
 * Reto del día, arriba del chat. Cerrado ocupa una línea; al tocarla se ven
 * las 3 frases. Dentro del reto se abre sola (solo las frases en inglés,
 * para dejar lugar a la conversación), marca las que ya practicó y se
 * cierra sola al completarlo.
 */
export function InglesRetoTarjeta({ reto, avance, enReto, onEmpezar, onSalir }: Props) {
  const [abierta, setAbierta] = useState(false);
  const completado = Boolean(avance?.completado);
  const hechas = avance ? Math.min(avance.mensajes, reto.frases.length) : 0;

  // Al entrar al reto se abre; al completarlo se cierra (la felicitación queda en el chat).
  useEffect(() => {
    if (enReto) setAbierta(!completado);
  }, [enReto, completado]);

  return (
    <div className="px-3 min-[400px]:px-5 py-2 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setAbierta((a) => !a)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
          aria-expanded={abierta}
        >
          <Target size={15} className="shrink-0" style={{ color: GOLD }} />
          <span className="text-xs min-w-0 line-clamp-2" style={{ color: "var(--color-text)" }}>
            <span style={{ color: "var(--color-text-muted)" }}>Reto de hoy: </span>
            <strong>{reto.titulo}</strong>
          </span>
          <ChevronDown
            size={14}
            className="shrink-0 transition-transform"
            style={{ color: "var(--color-text-muted)", transform: abierta ? "rotate(180deg)" : undefined }}
          />
        </button>
        {!enReto && completado && (
          <CheckCircle2 size={15} className="shrink-0" style={{ color: "var(--color-success)" }} aria-label="Completado" />
        )}
        {avance && !enReto && !completado && onEmpezar && (
          <button
            type="button"
            onClick={onEmpezar}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 whitespace-nowrap"
            style={{ background: GOLD, color: "#000" }}
          >
            Hacer reto
          </button>
        )}
      </div>

      {enReto && avance && (
        <div className="flex items-center justify-between gap-3 mt-1.5 pl-[23px] text-xs">
          {completado ? (
            <span className="flex items-center gap-1 font-semibold" style={{ color: "var(--color-success)" }}>
              <CheckCircle2 size={14} /> Completado
            </span>
          ) : (
            <span style={{ color: "var(--color-text-muted)" }}>
              Frase{" "}
              <strong style={{ color: GOLD }}>{Math.min(avance.mensajes + 1, avance.requeridos)}</strong> de{" "}
              {avance.requeridos}
            </span>
          )}
          {onSalir && (
            <button
              type="button"
              onClick={onSalir}
              className="font-semibold whitespace-nowrap hover:underline"
              style={{ color: "var(--color-text-muted)" }}
            >
              Volver al chat
            </button>
          )}
        </div>
      )}

      {abierta && (
        <div className="mt-2 flex flex-col gap-1.5">
          {!enReto && (
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {reto.descripcion}
            </p>
          )}
          <ol className="flex flex-col gap-1">
            {reto.frases.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                {avance && i < hechas ? (
                  <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: "var(--color-success)" }} />
                ) : (
                  <Circle size={14} className="shrink-0 mt-0.5" style={{ color: `${GOLD}99` }} />
                )}
                <span>
                  <strong style={{ color: "var(--color-text)" }}>{f.en}</strong>
                  {/* Dentro del reto, sin traducción: deja más lugar a la conversación. */}
                  {!enReto && <span style={{ color: "var(--color-text-muted)" }}> — {f.es}</span>}
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

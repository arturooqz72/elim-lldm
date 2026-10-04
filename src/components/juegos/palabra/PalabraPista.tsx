// src/components/juegos/palabra/PalabraPista.tsx
"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { PALABRA_COSTO_PISTA } from "@/lib/palabra/config";

interface PalabraPistaProps {
  /** Texto de la pista si ya se pidió hoy. */
  pista: string | null;
  /** Se puede pedir solo mientras la partida sigue abierta. */
  disponible: boolean;
  conSesion: boolean;
  onPista: (pista: string) => void;
  onError: (mensaje: string) => void;
}

/**
 * Botón opcional "Pedir pista": revela el libro de la Biblia donde aparece
 * la palabra. Pide confirmación porque resta puntos en el ranking de hoy.
 */
export function PalabraPista({ pista, disponible, conSesion, onPista, onError }: PalabraPistaProps) {
  const [confirmando, setConfirmando] = useState(false);
  const [cargando, setCargando] = useState(false);

  if (pista) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
        style={{ background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.3)", color: "var(--color-text)" }}
      >
        <Lightbulb size={14} className="shrink-0" style={{ color: "var(--color-primary)" }} />
        <span>
          <strong>Pista:</strong> {pista}
        </span>
      </div>
    );
  }

  if (!disponible) return null;

  async function pedir() {
    setCargando(true);
    try {
      const res = await fetch("/api/juegos/palabra/pista", { method: "POST" });
      const data = (await res.json()) as { pista?: string; mensaje?: string };
      if (!res.ok || !data.pista) throw new Error(data.mensaje ?? "No se pudo obtener la pista.");
      onPista(data.pista);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo obtener la pista.");
    } finally {
      setCargando(false);
      setConfirmando(false);
    }
  }

  if (confirmando) {
    return (
      <div
        className="flex flex-col gap-2 px-3 py-3 rounded-xl text-xs"
        style={{ background: "var(--color-surface)", border: "1px solid rgba(212,160,23,0.35)", color: "var(--color-text)" }}
      >
        <p>
          La pista te dice en qué libro de la Biblia aparece la palabra.{" "}
          {conSesion
            ? `Resta ${PALABRA_COSTO_PISTA} puntos en el ranking de hoy (no afecta tu racha).`
            : "No afecta tu racha."}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            disabled={cargando}
            className="flex-1 py-2 rounded-lg font-semibold"
            style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void pedir()}
            disabled={cargando}
            className="flex-1 py-2 rounded-lg font-bold"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            {cargando ? "…" : "Sí, dame la pista"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmando(true)}
      className="self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
      style={{ background: "rgba(212,160,23,0.1)", color: "var(--color-primary)", border: "1px solid rgba(212,160,23,0.25)" }}
    >
      <Lightbulb size={14} />
      Pedir pista{conSesion ? ` (−${PALABRA_COSTO_PISTA} pts)` : ""}
    </button>
  );
}

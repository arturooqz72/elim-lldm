"use client";

import { useState } from "react";
import { BellRing, Check, Loader2, Moon } from "lucide-react";
import { InglesPaquetes } from "./InglesPaquetes";
import { EncuestaPrecio } from "./EncuestaPrecio";
import type { EncuestaRespuesta, InglesPaquete } from "@/types";

const GOLD = "#f5c842";

interface Props {
  /** ENGLISH_PAYMENTS_ENABLED: con venta activa se muestran los paquetes. */
  pagosActivos: boolean;
  paquetes: InglesPaquete[];
  gratisDiarios: number;
  /** Si el usuario ya está en la lista de espera (estado compartido del chat). */
  enLista: boolean;
  onApuntado: () => void;
  /** Encuesta "¿Pagarías por mensajes ilimitados?" (lo que ya respondió). */
  encuesta?: EncuestaRespuesta;
  onEncuesta?: (respuesta: EncuestaRespuesta) => void;
}

/** Aviso al llegar al límite diario: paquetes de compra, o lista de espera y encuesta de precio. */
export function InglesAvisoLimite({ pagosActivos, paquetes, gratisDiarios, enLista, onApuntado, encuesta, onEncuesta }: Props) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (pagosActivos) return <InglesPaquetes paquetes={paquetes} gratisDiarios={gratisDiarios} />;

  async function apuntarme() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/ingles/lista-espera", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo guardar. Intenta de nuevo.");
      onApuntado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="rounded-2xl p-4 flex flex-col items-start gap-3"
      style={{ background: `${GOLD}0F`, border: `1px solid ${GOLD}55` }}
    >
      <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--color-text)" }}>
        <Moon size={15} style={{ color: GOLD }} />
        Llegaste a tu límite gratis de hoy. Vuelve mañana para seguir practicando.
      </p>

      <button
        type="button"
        onClick={() => void apuntarme()}
        disabled={enLista || guardando}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity disabled:cursor-default"
        style={
          enLista
            ? { background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.4)", color: "var(--color-success)" }
            : { background: GOLD, color: "#000" }
        }
      >
        {enLista ? <Check size={15} /> : guardando ? <Loader2 size={15} className="animate-spin" /> : <BellRing size={15} />}
        {enLista ? "¡Listo, te avisaremos!" : "Avísame cuando haya más mensajes"}
      </button>

      {error && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}

      <EncuestaPrecio tipo="mensajes" inicial={encuesta} onRespondida={onEncuesta} />
    </div>
  );
}

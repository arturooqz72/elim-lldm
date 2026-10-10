"use client";

import { Moon } from "lucide-react";
import { EncuestaPrecio } from "./EncuestaPrecio";
import type { EncuestaRespuesta } from "@/types";

const GOLD = "#f5c842";

interface Props {
  /** Lo que ya respondió en la encuesta de voz (se puede cambiar). */
  encuesta?: EncuestaRespuesta;
  onEncuesta?: (respuesta: EncuestaRespuesta) => void;
  /** Mensajes escritos que le quedan hoy (puede seguir escribiendo). */
  mensajesRestantes?: number;
}

/** Aviso al llegar al límite diario de voz, con la encuesta de precio debajo. */
export function InglesLimiteVoz({ encuesta, onEncuesta, mensajesRestantes }: Props) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col items-start gap-3"
      style={{ background: `${GOLD}0F`, border: `1px solid ${GOLD}55` }}
      role="status"
    >
      <p className="text-sm font-semibold flex items-start gap-2" style={{ color: "var(--color-text)" }}>
        <Moon size={15} className="mt-0.5 shrink-0" style={{ color: GOLD }} />
        Llegaste a tu límite de práctica de voz por hoy. Vuelve mañana.
      </p>
      {mensajesRestantes !== undefined && mensajesRestantes > 0 && (
        <p className="text-xs -mt-1" style={{ color: "var(--color-text-muted)" }}>
          Puedes seguir escribiendo: te quedan {mensajesRestantes} mensajes hoy.
        </p>
      )}
      <EncuestaPrecio tipo="voz" inicial={encuesta} onRespondida={onEncuesta} />
    </div>
  );
}

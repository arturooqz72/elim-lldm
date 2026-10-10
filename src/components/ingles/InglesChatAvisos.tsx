"use client";

import { InglesAvisoLimite } from "./InglesAvisoLimite";
import { InglesLimiteVoz } from "./InglesLimiteVoz";
import type { EncuestaRespuesta, EncuestaTipo, EncuestasUsuario, InglesPaquete } from "@/types";

interface Props {
  error: string | null;
  /** Llegó al límite de mensajes escritos. */
  limite: boolean;
  /** Llegó al límite de voz (al intentar una tarjeta del chat). */
  limiteVoz: boolean;
  mensajesRestantes: number;
  pagosActivos: boolean;
  paquetes: InglesPaquete[];
  gratisDiarios: number;
  enLista: boolean;
  onApuntado: () => void;
  encuestas: EncuestasUsuario;
  onEncuesta: (tipo: EncuestaTipo, respuesta: EncuestaRespuesta) => void;
}

/** Avisos al final de la conversación: error, límite de mensajes y límite de voz. */
export function InglesChatAvisos(props: Props) {
  return (
    <>
      {props.error && (
        <div
          className="px-4 py-3 rounded-2xl text-sm"
          style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.3)",
            color: "var(--color-destructive)",
          }}
        >
          {props.error}
        </div>
      )}

      {props.limiteVoz && (
        <InglesLimiteVoz
          encuesta={props.encuestas.voz}
          onEncuesta={(r) => props.onEncuesta("voz", r)}
          mensajesRestantes={props.mensajesRestantes}
        />
      )}

      {props.limite && (
        <InglesAvisoLimite
          pagosActivos={props.pagosActivos}
          paquetes={props.paquetes}
          gratisDiarios={props.gratisDiarios}
          enLista={props.enLista}
          onApuntado={props.onApuntado}
          encuesta={props.encuestas.mensajes}
          onEncuesta={(r) => props.onEncuesta("mensajes", r)}
        />
      )}
    </>
  );
}

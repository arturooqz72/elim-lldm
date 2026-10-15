"use client";

import { Avatar } from "./InglesMensajes";
import { TextoConNegritas } from "./TextoConNegritas";
import { ETIQUETA_BOTON, type BotonRapido } from "@/lib/ingles/saludos";

const GOLD = "#f5c842";

interface Props {
  texto: string;
  botones: BotonRapido[];
  onBoton: (boton: BotonRapido) => void;
}

/**
 * La tutora habla primero: saludo ya escrito (no llama al modelo ni gasta
 * mensajes) con botones de respuesta rápida para no tener que escribir.
 */
export function InglesSaludo({ texto, botones, onBoton }: Props) {
  // La voz va sola en su fila y resaltada; si los demás quedan impares, el
  // último también ocupa la fila completa (ninguno queda solo a la mitad).
  const otros = botones.filter((b) => b !== "pronunciacion");
  const ancho = (b: BotonRapido, i: number) =>
    b === "pronunciacion" || (otros.length % 2 === 1 && i === botones.length - 1);

  return (
    <>
      <div className="flex gap-3">
        <Avatar rol="assistant" />
        <div
          className="px-4 py-3 rounded-2xl text-sm max-w-[85%] whitespace-pre-wrap"
          style={{ background: "var(--color-surface-elevated)", color: "var(--color-text)" }}
        >
          <TextoConNegritas texto={texto} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pl-11 max-w-md" role="group" aria-label="Respuestas rápidas">
        {botones.map((b, i) => (
          <button
            key={b}
            type="button"
            onClick={() => onBoton(b)}
            className={`px-3 py-2.5 rounded-2xl text-sm font-semibold text-left leading-snug transition-colors ${
              ancho(b, i) ? "col-span-2" : ""
            }`}
            style={
              b === "pronunciacion"
                ? { background: GOLD, color: "#000" }
                : { background: `${GOLD}14`, border: `1px solid ${GOLD}55`, color: "var(--color-text)" }
            }
          >
            {ETIQUETA_BOTON[b]}
          </button>
        ))}
      </div>
    </>
  );
}

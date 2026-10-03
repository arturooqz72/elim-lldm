// src/components/juegos/palabra/PalabraTeclado.tsx
import { Delete } from "lucide-react";
import type { PalabraColor } from "@/types";
import { COLOR_FONDO } from "./colores";

const FILAS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ñ"],
  ["ENVIAR", "Z", "X", "C", "V", "B", "N", "M", "BORRAR"],
];

interface PalabraTecladoProps {
  estados: Map<string, PalabraColor>;
  deshabilitado: boolean;
  onTecla: (tecla: string) => void;
}

export function PalabraTeclado({ estados, deshabilitado, onTecla }: PalabraTecladoProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full mx-auto select-none" style={{ maxWidth: 500 }}>
      {FILAS.map((fila, i) => (
        <div key={i} className="flex gap-1 sm:gap-1.5">
          {fila.map((tecla) => {
            const especial = tecla === "ENVIAR" || tecla === "BORRAR";
            const estado = estados.get(tecla);
            return (
              <button
                key={tecla}
                type="button"
                onClick={(e) => {
                  // Sin foco en el botón: si no, Enter del teclado físico
                  // lo "presionaría" otra vez además de enviar.
                  e.currentTarget.blur();
                  onTecla(tecla);
                }}
                disabled={deshabilitado}
                aria-label={tecla === "BORRAR" ? "Borrar" : tecla === "ENVIAR" ? "Enviar" : tecla}
                className="h-[50px] sm:h-14 rounded-lg font-bold flex items-center justify-center transition-colors"
                style={{
                  flex: especial ? 1.5 : 1,
                  minWidth: 0,
                  fontSize: especial ? "0.7rem" : "1rem",
                  background: estado ? COLOR_FONDO[estado] : "var(--color-surface-elevated)",
                  border: `1px solid ${estado ? "transparent" : "var(--color-border)"}`,
                  color: tecla === "ENVIAR" ? "var(--color-primary)" : "var(--color-text)",
                  opacity: deshabilitado ? 0.6 : 1,
                  touchAction: "manipulation",
                }}
              >
                {tecla === "BORRAR" ? <Delete size={20} /> : tecla}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

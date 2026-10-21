// src/components/juegos/ahorcado/AhorcadoPista.tsx
import { Lightbulb, Loader2 } from "lucide-react";
import type { PistaAhorcado } from "@/lib/juegos/ahorcado-dificultad";

interface AhorcadoPistaProps {
  /** Una entrada por carácter: la letra adivinada, "_" o " " (ver ahorcado.server.ts). */
  mascara: string[];
  /** Solo las pistas ya pedidas (el servidor no manda las demás). */
  pistas: PistaAhorcado[];
  /** 0 en Difícil: no se muestra el botón. */
  pistasTotales: number;
  /** Lo que cuesta la siguiente, p. ej. "1 vida y 5 puntos" o "gratis". */
  costo: string;
  /** Si no se puede pedir otra, por qué (se muestra bajo el botón). */
  motivoBloqueo: string | null;
  pidiendo: boolean;
  onPedir: () => void;
}

export function AhorcadoPista({
  mascara,
  pistas,
  pistasTotales,
  costo,
  motivoBloqueo,
  pidiendo,
  onPedir,
}: AhorcadoPistaProps) {
  const quedan = pistasTotales - pistas.length;

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex flex-wrap justify-center gap-2"
        aria-label={`Palabra de ${mascara.filter((l) => l !== " ").length} letras`}
      >
        {mascara.map((letra, index) =>
          letra === " " ? (
            <div key={index} className="w-4" />
          ) : (
            <div
              key={index}
              className="w-9 h-12 sm:w-10 sm:h-14 flex items-center justify-center rounded-xl"
              style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
            >
              <span className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
                {letra}
              </span>
            </div>
          ),
        )}
      </div>

      {pistas.length > 0 && (
        <ol className="flex flex-col gap-2">
          {pistas.map((pista, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-xl p-3"
              style={{ background: "rgba(212,160,23,0.06)", border: "1px solid rgba(212,160,23,0.25)" }}
            >
              <Lightbulb size={16} className="shrink-0 mt-0.5" style={{ color: "var(--color-primary)" }} />
              <div className="min-w-0">
                <p
                  className="text-[11px] font-bold uppercase tracking-wide"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Pista {i + 1}: {pista.titulo}
                </p>
                <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                  {pista.texto}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {pistasTotales > 0 && quedan > 0 && (
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={onPedir}
            disabled={pidiendo || motivoBloqueo !== null}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold min-h-11"
            style={{
              background: "rgba(212,160,23,0.1)",
              border: "1px solid rgba(212,160,23,0.3)",
              color: "var(--color-primary)",
              opacity: pidiendo || motivoBloqueo !== null ? 0.5 : 1,
            }}
          >
            {pidiendo ? <Loader2 size={16} className="animate-spin" /> : <Lightbulb size={16} />}
            Pista ({pistas.length + 1} de {pistasTotales}) · {costo}
          </button>
          {motivoBloqueo && (
            <p className="text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
              {motivoBloqueo}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

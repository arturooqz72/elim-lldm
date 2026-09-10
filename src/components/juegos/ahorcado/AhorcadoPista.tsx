// src/components/juegos/ahorcado/AhorcadoPista.tsx
import { Lightbulb } from "lucide-react";
import type { AhorcadoCategoria } from "@/types";

const ETIQUETAS_CATEGORIA: Record<AhorcadoCategoria, string> = {
  personaje: "Personaje bíblico",
  lugar: "Lugar",
  concepto: "Palabra clave",
  libro: "Libro del Nuevo Testamento",
};

interface AhorcadoPistaProps {
  palabra: string;
  categoria: AhorcadoCategoria;
  pista: string;
  referenciaBiblica: string | null;
  letrasAdivinadas: string[];
}

export function AhorcadoPista({
  palabra,
  categoria,
  pista,
  referenciaBiblica,
  letrasAdivinadas,
}: AhorcadoPistaProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div
          className="rounded-2xl p-2 shrink-0"
          style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}
        >
          <Lightbulb size={18} style={{ color: "var(--color-primary)" }} />
        </div>
        <div>
          <span
            className="inline-block text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mb-1.5"
            style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-muted)" }}
          >
            {ETIQUETAS_CATEGORIA[categoria]}
          </span>
          <p className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
            {pista}
          </p>
          {referenciaBiblica && (
            <p className="text-xs mt-1" style={{ color: "var(--color-primary)" }}>
              {referenciaBiblica}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {palabra.split("").map((letra, index) =>
          letra === " " ? (
            <div key={index} className="w-4" />
          ) : (
            <div
              key={index}
              className="w-10 h-14 flex items-center justify-center rounded-xl"
              style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
            >
              <span className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
                {letrasAdivinadas.includes(letra) ? letra : "_"}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

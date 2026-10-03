// src/components/juegos/palabra/PalabraEstadisticas.tsx
import { Shield } from "lucide-react";
import { PALABRA_MAX_COMODINES } from "@/lib/palabra/config";
import type { PalabraEstadisticas as Estadisticas, PalabraRacha } from "@/types";

interface PalabraEstadisticasProps {
  estadisticas: Estadisticas;
  racha: PalabraRacha;
  /** Intentos de la partida de hoy si la resolvió, para resaltar su barra. */
  resaltarIntentos?: number | null;
}

function Cifra({ valor, etiqueta }: { valor: string | number; etiqueta: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
        {valor}
      </span>
      <span className="text-[11px] leading-tight" style={{ color: "var(--color-text-muted)" }}>
        {etiqueta}
      </span>
    </div>
  );
}

export function PalabraEstadisticas({ estadisticas, racha, resaltarIntentos }: PalabraEstadisticasProps) {
  const maximo = Math.max(1, ...estadisticas.distribucion);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-2">
        <Cifra valor={estadisticas.jugadas} etiqueta="Jugadas" />
        <Cifra valor={`${estadisticas.porcentaje}%`} etiqueta="Aciertos" />
        <Cifra valor={`🔥 ${racha.actual}`} etiqueta="Racha actual" />
        <Cifra valor={racha.maxima} etiqueta="Racha máxima" />
      </div>

      <div
        className="flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-xl"
        style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-muted)" }}
      >
        <Shield size={14} style={{ color: "var(--color-info)" }} />
        Comodines guardados:{" "}
        <strong style={{ color: "var(--color-text)" }}>
          {racha.comodines}/{PALABRA_MAX_COMODINES}
        </strong>
      </div>

      <div>
        <p
          className="text-xs font-semibold uppercase tracking-wider mb-2"
          style={{ color: "var(--color-text-muted)" }}
        >
          Distribución de intentos
        </p>
        <div className="flex flex-col gap-1">
          {estadisticas.distribucion.map((cantidad, i) => {
            const resaltada = resaltarIntentos === i + 1;
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-right" style={{ color: "var(--color-text)" }}>
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div
                    className="h-5 rounded flex items-center justify-end px-1.5 font-semibold"
                    style={{
                      width: `${Math.max(8, (cantidad / maximo) * 100)}%`,
                      background: resaltada ? "#538D4E" : "var(--color-surface-elevated)",
                      color: "var(--color-text)",
                    }}
                  >
                    {cantidad}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

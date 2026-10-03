// src/components/juegos/palabra/PalabraBarraSuperior.tsx
import { BarChart3, HelpCircle, Shield } from "lucide-react";

interface PalabraBarraSuperiorProps {
  numero: number;
  racha: number;
  comodinesUsados: number;
  estadisticasDisponibles: boolean;
  onAyuda: () => void;
  onEstadisticas: () => void;
}

const estiloBoton = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text-muted)",
} as const;

export function PalabraBarraSuperior({
  numero,
  racha,
  comodinesUsados,
  estadisticasDisponibles,
  onAyuda,
  onEstadisticas,
}: PalabraBarraSuperiorProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onAyuda}
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={estiloBoton}
          aria-label="Cómo jugar"
        >
          <HelpCircle size={18} />
        </button>
        <div className="text-center">
          <h1 className="sm:hidden text-base font-bold leading-tight" style={{ color: "var(--color-text)" }}>
            Palabra del Día
          </h1>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
            Reto #{numero}
          </p>
          <p className="text-sm font-bold" style={{ color: "var(--color-primary)" }}>
            🔥 Racha: {racha}
          </p>
        </div>
        <button
          type="button"
          onClick={onEstadisticas}
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={estiloBoton}
          aria-label="Estadísticas"
          disabled={!estadisticasDisponibles}
        >
          <BarChart3 size={18} />
        </button>
      </div>

      {comodinesUsados > 0 && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
          style={{
            background: "rgba(96,165,250,0.08)",
            border: "1px solid rgba(96,165,250,0.3)",
            color: "var(--color-text)",
          }}
        >
          <Shield size={14} style={{ color: "var(--color-info)" }} />
          {comodinesUsados === 1
            ? "Usamos 1 comodín para proteger tu racha del día que faltaste."
            : `Usamos ${comodinesUsados} comodines para proteger tu racha de los días que faltaste.`}
        </div>
      )}
    </>
  );
}

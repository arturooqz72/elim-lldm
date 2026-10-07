import { TrendingUp } from "lucide-react";
import { ETIQUETA_SONIDO } from "@/lib/ingles/etiquetas";
import type { PronProgreso } from "@/types";

const GOLD = "#f5c842";

export function PronunciacionProgreso({ progreso }: { progreso: PronProgreso }) {
  if (progreso.promedio === null) return null;

  return (
    <div
      className="rounded-2xl px-4 py-3 flex flex-col gap-2 text-xs"
      style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
    >
      <p className="flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
        <TrendingUp size={14} style={{ color: GOLD }} />
        Tu promedio en los últimos {progreso.intentos} {progreso.intentos === 1 ? "intento" : "intentos"}:{" "}
        <strong className="text-sm" style={{ color: "var(--color-text)" }}>
          {progreso.promedio}/100
        </strong>
      </p>
      {progreso.sonidosDificiles.length > 0 && (
        <p style={{ color: "var(--color-text-muted)" }}>
          Lo que más te cuesta:{" "}
          {progreso.sonidosDificiles.map((s, i) => (
            <span key={s.sonido} style={{ color: "var(--color-text)" }}>
              {i > 0 && ", "}
              {ETIQUETA_SONIDO[s.sonido]}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

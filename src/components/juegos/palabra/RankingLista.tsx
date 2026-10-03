// src/components/juegos/palabra/RankingLista.tsx
import { Church } from "lucide-react";

// Mismos oro/plata/bronce que TablaPosiciones.
const RANK_COLORS = ["#D4A017", "#C0C0C0", "#CD7F32"];

export interface FilaLista {
  clave: string;
  esYo: boolean;
  nombre: string;
  avatar: string | null;
  icono?: boolean;
  detalle: string | null;
  valor: React.ReactNode;
  subvalor: string;
}

export function RankingLista({ filas, vacio }: { filas: FilaLista[]; vacio: string }) {
  if (filas.length === 0) {
    return (
      <p className="text-xs text-center px-4 py-5" style={{ color: "var(--color-text-muted)" }}>
        {vacio}
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-1.5">
      {filas.map((fila, idx) => {
        const rankColor = RANK_COLORS[idx] ?? null;
        return (
          <li
            key={fila.clave}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
            style={{
              background: fila.esYo ? "rgba(212,160,23,0.08)" : "var(--color-surface-elevated)",
              border: `1px solid ${fila.esYo ? "rgba(212,160,23,0.25)" : "transparent"}`,
            }}
          >
            <span
              className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
              style={{
                background: rankColor ? `${rankColor}22` : "transparent",
                color: rankColor ?? "var(--color-text-muted)",
              }}
            >
              {idx + 1}
            </span>
            {fila.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fila.avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
            ) : (
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: "rgba(212,160,23,0.15)", color: "var(--color-primary)" }}
              >
                {fila.icono ? <Church size={13} /> : fila.nombre[0]?.toUpperCase()}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
                {fila.nombre}
              </p>
              {fila.detalle && (
                <p className="text-[11px] truncate" style={{ color: "var(--color-text-muted)" }}>
                  {fila.detalle}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold" style={{ color: "var(--color-primary)" }}>
                {fila.valor}
              </p>
              <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                {fila.subvalor}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

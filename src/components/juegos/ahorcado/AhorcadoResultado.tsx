// src/components/juegos/ahorcado/AhorcadoResultado.tsx
import { BookOpen } from "lucide-react";
import type { EstadoAhorcado } from "@/lib/juegos/ahorcado-dificultad";

interface AhorcadoResultadoProps {
  partida: EstadoAhorcado;
  error: string | null;
  cargando: boolean;
  /** Ganó: siguiente palabra de la racha, en el mismo nivel. */
  onSiguiente: () => void;
  /** Perdió: volver a elegir dificultad y empezar de cero. */
  onNuevaRacha: () => void;
}

/** Al terminar la palabra (ganada o perdida) ya se ve la cita completa, para aprender. */
export function AhorcadoResultado({ partida, error, cargando, onSiguiente, onNuevaRacha }: AhorcadoResultadoProps) {
  const ganado = partida.estado === "ganada";
  const mensajeRanking =
    partida.nuevoRecord === true
      ? "¡Nuevo récord guardado!"
      : partida.nuevoRecord === false
        ? "Tu récord anterior sigue siendo mayor."
        : "";
  const { revelacion } = partida;

  return (
    <div
      className="p-4 rounded-2xl text-center flex flex-col gap-3"
      style={{
        background: ganado ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
        border: `1px solid ${ganado ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}`,
      }}
    >
      <div>
        {ganado ? (
          <>
            <p className="font-bold text-lg mb-1" style={{ color: "var(--color-success)" }}>
              ¡Ganaste!
            </p>
            <p className="text-sm" style={{ color: "var(--color-text)" }}>
              +{partida.puntosPalabra} puntos
            </p>
            {mensajeRanking && (
              <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
                {mensajeRanking}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="font-bold text-lg mb-1" style={{ color: "var(--color-destructive)" }}>
              Perdiste
            </p>
            <p className="text-sm" style={{ color: "var(--color-text)" }}>
              La palabra era: <strong>{partida.palabra}</strong>
            </p>
          </>
        )}
      </div>

      {revelacion && (
        <div
          className="rounded-xl p-3 text-left flex items-start gap-3"
          style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
        >
          <BookOpen size={18} className="shrink-0 mt-0.5" style={{ color: "var(--color-primary)" }} />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
              {revelacion.categoria}
            </p>
            <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              {revelacion.descripcion}
            </p>
            {revelacion.referencia && (
              <p className="text-xs mt-1 font-semibold" style={{ color: "var(--color-primary)" }}>
                {revelacion.referencia}
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={ganado ? onSiguiente : onNuevaRacha}
        disabled={cargando}
        className="self-center px-4 py-2 rounded-xl text-sm font-bold min-h-11"
        style={{ background: "var(--color-primary)", color: "#000" }}
      >
        {ganado ? "Siguiente palabra" : "Jugar de nuevo"}
      </button>
    </div>
  );
}

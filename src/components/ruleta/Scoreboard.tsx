import type { RuletaJugador } from "@/types";

export function Scoreboard({ jugadores, turnoJugadorId }: { jugadores: RuletaJugador[]; turnoJugadorId: string | null }) {
  return (
    <div className="flex gap-2 flex-wrap justify-center">
      {jugadores.map((j) => {
        const active = j.id === turnoJugadorId;
        return (
          <div
            key={j.id}
            className="flex-1 min-w-[80px] rounded-xl p-2 text-center transition-all"
            style={{
              background: "linear-gradient(160deg, rgba(255,255,255,.05), rgba(0,0,0,.4))",
              border: active ? "2px solid var(--color-primary)" : "2px solid rgba(212,160,23,.2)",
              boxShadow: active ? "0 0 16px rgba(212,160,23,.5)" : "none",
              transform: active ? "translateY(-2px)" : "none",
            }}
          >
            <div className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>{j.nombre}</div>
            <div className="text-lg font-bold" style={{ color: "var(--color-primary)" }}>{j.puntos}</div>
          </div>
        );
      })}
    </div>
  );
}

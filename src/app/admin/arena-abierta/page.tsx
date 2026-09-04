import { createClient } from "@/lib/supabase/server";
import { Zap } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ArenaAbiertaEndButton } from "@/components/admin/ArenaAbiertaEndButton";

export const metadata = { title: "Arena Abierta — Admin" };

type SalaStatus = "lobby" | "counting" | "playing" | "reveal" | "finished";

const STATUS_LABEL: Record<SalaStatus, string> = {
  lobby: "Esperando jugadores",
  counting: "Arrancando",
  playing: "Jugando",
  reveal: "Mostrando respuesta",
  finished: "Terminada",
};

const STATUS_COLOR: Record<SalaStatus, { bg: string; text: string }> = {
  lobby: { bg: "rgba(212,160,23,0.12)", text: "var(--color-primary)" },
  counting: { bg: "rgba(96,165,250,0.12)", text: "var(--color-info)" },
  playing: { bg: "rgba(74,222,128,0.1)", text: "var(--color-success)" },
  reveal: { bg: "rgba(74,222,128,0.1)", text: "var(--color-success)" },
  finished: { bg: "var(--color-surface-elevated)", text: "var(--color-text-muted)" },
};

interface SalaRow {
  id: string;
  status: SalaStatus;
  pregunta_actual: number;
  created_at: string;
  jugadores: { count: number }[];
  preguntas: { count: number }[];
}

export default async function AdminArenaAbiertaPage() {
  const supabase = await createClient();

  const { data: salas } = await supabase
    .from("arena_publica_salas")
    .select(
      "id, status, pregunta_actual, created_at, jugadores:arena_publica_jugadores(count), preguntas:arena_publica_preguntas(count)"
    )
    .order("created_at", { ascending: false })
    .limit(30);

  const rows = (salas ?? []) as unknown as SalaRow[];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>
            Arena Abierta
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            Salas públicas de trivia — cualquier sala en curso se puede terminar a mano si se
            queda atascada.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-2xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Zap size={36} className="mb-3" style={{ color: "var(--color-text-muted)" }} />
          <p style={{ color: "var(--color-text-muted)" }}>Todavía no se ha creado ninguna sala.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((sala) => {
            const jugadores = sala.jugadores?.[0]?.count ?? 0;
            const totalPreguntas = sala.preguntas?.[0]?.count ?? 0;
            const colors = STATUS_COLOR[sala.status];

            return (
              <div
                key={sala.id}
                className="flex items-center justify-between px-5 py-4 rounded-2xl"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Zap size={15} style={{ color: "var(--color-primary)" }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                      {jugadores} {jugadores === 1 ? "jugador" : "jugadores"}
                      {sala.status !== "lobby" &&
                        sala.status !== "finished" &&
                        ` · pregunta ${sala.pregunta_actual} de ${totalPreguntas}`}
                    </p>
                    <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                      {sala.id.slice(0, 8)} · {formatDate(sala.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: colors.bg, color: colors.text }}
                  >
                    {STATUS_LABEL[sala.status]}
                  </span>
                  {sala.status !== "finished" && <ArenaAbiertaEndButton salaId={sala.id} />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

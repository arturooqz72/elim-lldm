import { createClient } from "@/lib/supabase/server";
import { Disc3 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ArenaAbiertaEndButton } from "@/components/admin/ArenaAbiertaEndButton";

export const metadata = { title: "Ruleta en línea — Admin" };

type SalaStatus = "lobby" | "playing" | "ronda_fin" | "finished";

const STATUS_LABEL: Record<SalaStatus, string> = {
  lobby: "Esperando jugadores",
  playing: "Jugando",
  ronda_fin: "Entre rondas",
  finished: "Terminada",
};

const STATUS_COLOR: Record<SalaStatus, { bg: string; text: string }> = {
  lobby: { bg: "rgba(212,160,23,0.12)", text: "var(--color-primary)" },
  playing: { bg: "rgba(74,222,128,0.1)", text: "var(--color-success)" },
  ronda_fin: { bg: "rgba(96,165,250,0.12)", text: "var(--color-info)" },
  finished: { bg: "var(--color-surface-elevated)", text: "var(--color-text-muted)" },
};

interface SalaRow {
  id: string;
  status: SalaStatus;
  ronda_actual: number;
  rondas_totales: number;
  created_at: string;
  jugadores: { count: number }[];
}

export default async function AdminRuletaPage() {
  const supabase = await createClient();

  const { data: salas } = await supabase
    .from("ruleta_salas")
    .select("id, status, ronda_actual, rondas_totales, created_at, jugadores:ruleta_jugadores(count)")
    .order("created_at", { ascending: false })
    .limit(30);

  const rows = (salas ?? []) as unknown as SalaRow[];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>
            La Ruleta en línea
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            Salas públicas de Ruleta — cualquier sala en curso se puede terminar a mano si se
            queda atascada.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-2xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Disc3 size={36} className="mb-3" style={{ color: "var(--color-text-muted)" }} />
          <p style={{ color: "var(--color-text-muted)" }}>Todavía no se ha creado ninguna sala.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((sala) => {
            const jugadores = sala.jugadores?.[0]?.count ?? 0;
            const colors = STATUS_COLOR[sala.status];

            return (
              <div
                key={sala.id}
                className="flex items-center justify-between px-5 py-4 rounded-2xl"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Disc3 size={15} style={{ color: "var(--color-primary)" }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                      {jugadores} {jugadores === 1 ? "jugador" : "jugadores"}
                      {sala.status !== "lobby" &&
                        sala.status !== "finished" &&
                        ` · ronda ${sala.ronda_actual} de ${sala.rondas_totales}`}
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
                  {sala.status !== "finished" && (
                    <ArenaAbiertaEndButton salaId={sala.id} endpoint={`/api/admin/ruleta/${sala.id}/end`} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

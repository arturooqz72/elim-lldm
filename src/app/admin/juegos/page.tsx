import { createClient } from "@/lib/supabase/server";
import { Plus, Gamepad2, Settings } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Juegos — Admin" };

export default async function AdminJuegosPage() {
  const supabase = await createClient();

  const { data: games } = await supabase
    .from("games")
    .select("id, title, status, join_code, created_at, profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>
          Juegos
        </h1>
        <div className="flex items-center gap-3">
          <a
            href="/juegos/ruleta-elimlldm.html?admin=1"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--color-surface-elevated)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
          >
            <Settings size={16} />
            Editar Ruleta
          </a>
          <Link
            href="/admin/juegos/nueva"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            <Plus size={16} />
            Nueva partida
          </Link>
        </div>
      </div>

      {(!games || games.length === 0) ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-2xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Gamepad2 size={36} className="mb-3" style={{ color: "var(--color-text-muted)" }} />
          <p style={{ color: "var(--color-text-muted)" }}>No hay juegos creados aún.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(games as unknown as Array<{
            id: string;
            title: string;
            status: string;
            join_code: string;
            created_at: string;
            profiles: { display_name: string } | null;
          }>).map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between px-5 py-4 rounded-2xl"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Gamepad2 size={15} style={{ color: "var(--color-primary)" }} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                    {g.title}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    #{g.join_code} · {formatDate(g.created_at).split(",")[0]}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    background:
                      g.status === "lobby"
                        ? "rgba(212,160,23,0.1)"
                        : g.status === "in_progress"
                        ? "rgba(74,222,128,0.1)"
                        : "var(--color-surface-elevated)",
                    color:
                      g.status === "lobby"
                        ? "var(--color-primary)"
                        : g.status === "in_progress"
                        ? "var(--color-success)"
                        : "var(--color-text-muted)",
                  }}
                >
                  {g.status === "lobby" ? "Sala" : g.status === "in_progress" ? "En curso" : "Terminado"}
                </span>
                {g.status !== "finished" && (
                  <Link
                    href={`/admin/juegos/${g.id}/host`}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: "rgba(212,160,23,0.15)", color: "var(--color-primary)" }}
                  >
                    Panel host
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { TRIVIA_DIFFICULTY_LABEL } from "@/types";
import type { TriviaDifficulty, TriviaStatus } from "@/types";

export const metadata = { title: "Salas de Trivia — Admin" };

const STATUS_LABEL: Record<TriviaStatus, string> = {
  lobby: "Sala",
  in_progress: "En curso",
  finished: "Terminada",
};

export default async function AdminTriviaPage() {
  const supabase = await createClient();

  const { data: rooms } = await supabase
    .from("trivia_rooms")
    .select("id, name, category, difficulty, status, join_code, created_at, profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>
          Salas de Trivia
        </h1>
        <Link
          href="/trivia/nueva"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "var(--trivia-gold)", color: "#1a1500" }}
        >
          <Plus size={16} />
          Nueva sala
        </Link>
      </div>

      {(!rooms || rooms.length === 0) ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-2xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Sparkles size={36} className="mb-3" style={{ color: "var(--color-text-muted)" }} />
          <p style={{ color: "var(--color-text-muted)" }}>No hay salas de trivia creadas aún.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(rooms as unknown as Array<{
            id: string;
            name: string;
            category: string;
            difficulty: TriviaDifficulty;
            status: TriviaStatus;
            join_code: string;
            created_at: string;
            profiles: { display_name: string } | null;
          }>).map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between px-5 py-4 rounded-2xl"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Sparkles size={15} style={{ color: "var(--trivia-gold)" }} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                    {r.name}
                  </p>
                  <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                    #{r.join_code} · {r.category} · {TRIVIA_DIFFICULTY_LABEL[r.difficulty]} · Anfitrión:{" "}
                    {r.profiles?.display_name ?? "—"} · {formatDate(r.created_at).split(",")[0]}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    background:
                      r.status === "lobby"
                        ? "rgba(245,200,66,0.12)"
                        : r.status === "in_progress"
                        ? "rgba(74,222,128,0.1)"
                        : "var(--color-surface-elevated)",
                    color:
                      r.status === "lobby"
                        ? "var(--trivia-gold)"
                        : r.status === "in_progress"
                        ? "var(--color-success)"
                        : "var(--color-text-muted)",
                  }}
                >
                  {STATUS_LABEL[r.status]}
                </span>
                <Link
                  href={`/trivia/${r.id}`}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(245,200,66,0.15)", color: "var(--trivia-gold)" }}
                >
                  Ver sala
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

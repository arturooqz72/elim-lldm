import { createClient } from "@/lib/supabase/server";
import { Plus, BookOpen } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Banco de preguntas — Admin" };

export default async function QuestionSetsPage() {
  const supabase = await createClient();

  const { data: sets } = await supabase
    .from("question_sets")
    .select("id, title, description, is_public, created_at, questions(count)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>
            Banco de preguntas
          </h1>
        </div>
        <Link
          href="/admin/question-sets/nueva"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "var(--color-primary)", color: "#000" }}
        >
          <Plus size={16} />
          Nuevo set
        </Link>
      </div>

      {(!sets || sets.length === 0) ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-2xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <BookOpen size={36} className="mb-3" style={{ color: "var(--color-text-muted)" }} />
          <p style={{ color: "var(--color-text-muted)" }}>No hay sets de preguntas. Crea el primero.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(sets as unknown as Array<{
            id: string;
            title: string;
            description: string | null;
            is_public: boolean;
            created_at: string;
            questions: Array<{ count: number }>;
          }>).map((s) => {
            const questionCount = (s.questions as unknown as { count: number }[])?.[0]?.count ?? 0;
            return (
              <Link
                key={s.id}
                href={`/admin/question-sets/${s.id}`}
                className="flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-200"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,160,23,0.3)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <BookOpen size={15} style={{ color: "var(--color-primary)" }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                      {s.title}
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {questionCount} preguntas · {formatDate(s.created_at).split(",")[0]}
                    </p>
                  </div>
                </div>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium ml-2 shrink-0"
                  style={{
                    background: s.is_public ? "rgba(74,222,128,0.1)" : "var(--color-surface-elevated)",
                    color: s.is_public ? "var(--color-success)" : "var(--color-text-muted)",
                  }}
                >
                  {s.is_public ? "Público" : "Privado"}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { QuestionForm } from "./QuestionForm";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}

async function addQuestion(formData: FormData) {
  "use server";
  const setId = formData.get("setId") as string;
  const supabase = await createServiceClient();
  await supabase.from("questions").insert({
    question_set_id: setId,
    question_text: (formData.get("question_text") as string).trim(),
    option_a: (formData.get("option_a") as string).trim(),
    option_b: (formData.get("option_b") as string).trim(),
    option_c: (formData.get("option_c") as string).trim(),
    option_d: (formData.get("option_d") as string).trim(),
    correct_option: formData.get("correct_option") as string,
    bible_reference: ((formData.get("bible_reference") as string).trim()) || null,
    time_limit_seconds: parseInt((formData.get("time_limit_seconds") as string) || "30", 10),
    points: parseInt((formData.get("points") as string) || "100", 10),
    order_index: parseInt((formData.get("order_index") as string) || "0", 10),
  });
  revalidatePath(`/admin/question-sets/${setId}`);
}

async function updateQuestion(formData: FormData) {
  "use server";
  const questionId = formData.get("questionId") as string;
  const setId = formData.get("setId") as string;
  const supabase = await createServiceClient();
  await supabase.from("questions").update({
    question_text: (formData.get("question_text") as string).trim(),
    option_a: (formData.get("option_a") as string).trim(),
    option_b: (formData.get("option_b") as string).trim(),
    option_c: (formData.get("option_c") as string).trim(),
    option_d: (formData.get("option_d") as string).trim(),
    correct_option: formData.get("correct_option") as string,
    bible_reference: ((formData.get("bible_reference") as string).trim()) || null,
    time_limit_seconds: parseInt((formData.get("time_limit_seconds") as string) || "30", 10),
    points: parseInt((formData.get("points") as string) || "100", 10),
  }).eq("id", questionId);
  revalidatePath(`/admin/question-sets/${setId}`);
}

async function deleteQuestion(formData: FormData) {
  "use server";
  const questionId = formData.get("questionId") as string;
  const setId = formData.get("setId") as string;
  const supabase = await createServiceClient();
  await supabase.from("questions").delete().eq("id", questionId);
  revalidatePath(`/admin/question-sets/${setId}`);
}

async function moveQuestion(formData: FormData) {
  "use server";
  const questionId = formData.get("questionId") as string;
  const setId = formData.get("setId") as string;
  const direction = formData.get("direction") as "up" | "down";
  const currentIndex = parseInt(formData.get("currentIndex") as string, 10);
  const supabase = await createServiceClient();

  const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  // Swap with adjacent question
  const { data: adjacent } = await supabase
    .from("questions")
    .select("id, order_index")
    .eq("question_set_id", setId)
    .eq("order_index", newIndex)
    .single();

  if (adjacent) {
    await supabase
      .from("questions")
      .update({ order_index: currentIndex })
      .eq("id", (adjacent as { id: string }).id);
    await supabase
      .from("questions")
      .update({ order_index: newIndex })
      .eq("id", questionId);
  }
  revalidatePath(`/admin/question-sets/${setId}`);
}

export default async function EditQuestionSetPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { edit: editId } = await searchParams;
  const supabase = await createClient();

  const { data: set } = await supabase
    .from("question_sets")
    .select("id, title, description, is_public")
    .eq("id", id)
    .single();

  if (!set) notFound();

  const s = set as { id: string; title: string; description: string | null; is_public: boolean };

  const { data: questionsRaw } = await supabase
    .from("questions")
    .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, bible_reference, time_limit_seconds, points, order_index")
    .eq("question_set_id", id)
    .order("order_index", { ascending: true });

  const questions = (questionsRaw ?? []) as Array<{
    id: string;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: string;
    bible_reference: string | null;
    time_limit_seconds: number;
    points: number;
    order_index: number;
  }>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/admin/question-sets"
          className="flex items-center gap-1.5 text-sm"
          style={{ color: "var(--color-text-muted)" }}
        >
          <ArrowLeft size={15} />
          Sets de preguntas
        </Link>
        <span
          className="px-2 py-0.5 rounded-full text-xs font-medium"
          style={{
            background: s.is_public ? "rgba(74,222,128,0.1)" : "var(--color-surface-elevated)",
            color: s.is_public ? "var(--color-success)" : "var(--color-text-muted)",
          }}
        >
          {s.is_public ? "Público" : "Privado"}
        </span>
      </div>

      <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--color-text)" }}>
        {s.title}
      </h1>
      {s.description && (
        <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
          {s.description}
        </p>
      )}

      <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        {questions.length} pregunta{questions.length !== 1 ? "s" : ""}
      </p>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Questions list */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
            Preguntas
          </h2>

          {questions.length === 0 && (
            <p className="text-sm py-4" style={{ color: "var(--color-text-muted)" }}>
              Sin preguntas aún. Agrega la primera desde el formulario.
            </p>
          )}

          {questions.map((q, idx) => {
            const isEditing = editId === q.id;
            return (
              <div
                key={q.id}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "var(--color-surface)",
                  border: `1px solid ${isEditing ? "rgba(212,160,23,0.4)" : "var(--color-border)"}`,
                }}
              >
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold mb-1" style={{ color: "var(--color-primary)" }}>
                        #{idx + 1}
                      </p>
                      <p className="text-sm" style={{ color: "var(--color-text)" }}>
                        {q.question_text}
                      </p>
                      <p className="text-xs mt-1.5 flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
                        <span>Correcta: <strong style={{ color: "var(--color-success)" }}>{q.correct_option.toUpperCase()}</strong></span>
                        <span>·</span>
                        <span>{q.time_limit_seconds}s</span>
                        <span>·</span>
                        <span>{q.points}pts</span>
                        {q.bible_reference && (
                          <>
                            <span>·</span>
                            <span style={{ color: "var(--color-primary)" }}>{q.bible_reference}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {idx > 0 && (
                        <form action={moveQuestion}>
                          <input type="hidden" name="questionId" value={q.id} />
                          <input type="hidden" name="setId" value={id} />
                          <input type="hidden" name="direction" value="up" />
                          <input type="hidden" name="currentIndex" value={q.order_index} />
                          <button
                            type="submit"
                            className="w-7 h-7 rounded-lg text-xs flex items-center justify-center"
                            style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-muted)" }}
                          >
                            ↑
                          </button>
                        </form>
                      )}
                      {idx < questions.length - 1 && (
                        <form action={moveQuestion}>
                          <input type="hidden" name="questionId" value={q.id} />
                          <input type="hidden" name="setId" value={id} />
                          <input type="hidden" name="direction" value="down" />
                          <input type="hidden" name="currentIndex" value={q.order_index} />
                          <button
                            type="submit"
                            className="w-7 h-7 rounded-lg text-xs flex items-center justify-center"
                            style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-muted)" }}
                          >
                            ↓
                          </button>
                        </form>
                      )}
                      <Link
                        href={`/admin/question-sets/${id}?edit=${q.id}`}
                        className="w-7 h-7 rounded-lg text-xs flex items-center justify-center"
                        style={{ background: "rgba(212,160,23,0.1)", color: "var(--color-primary)" }}
                      >
                        ✎
                      </Link>
                      <form action={deleteQuestion} onSubmit={(e) => !confirm("¿Eliminar pregunta?") && e.preventDefault()}>
                        <input type="hidden" name="questionId" value={q.id} />
                        <input type="hidden" name="setId" value={id} />
                        <button
                          type="submit"
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: "rgba(248,113,113,0.1)", color: "var(--color-destructive)" }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add / Edit question form */}
        <div className="lg:sticky lg:top-8">
          <QuestionForm
            setId={id}
            nextOrderIndex={questions.length}
            editQuestion={editId ? questions.find((q) => q.id === editId) : undefined}
            addAction={addQuestion}
            updateAction={updateQuestion}
          />
        </div>
      </div>
    </div>
  );
}

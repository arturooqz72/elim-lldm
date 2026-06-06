import { createServiceClient, getProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Nuevo set — Admin" };

async function createQuestionSet(formData: FormData) {
  "use server";
  const profile = await getProfile();
  if (!profile) return;

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("question_sets")
    .insert({
      title: (formData.get("title") as string).trim(),
      description: (formData.get("description") as string).trim() || null,
      created_by: profile.id,
      is_public: formData.get("is_public") === "on",
    })
    .select("id")
    .single();

  if (error || !data) return;
  redirect(`/admin/question-sets/${(data as { id: string }).id}`);
}

export default function NuevoSetPage() {
  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/admin/question-sets"
          className="flex items-center gap-1.5 text-sm"
          style={{ color: "var(--color-text-muted)" }}
        >
          <ArrowLeft size={15} />
          Sets de preguntas
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--color-text)" }}>
        Nuevo set de preguntas
      </h1>

      <form action={createQuestionSet} className="flex flex-col gap-5">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            Título <span style={{ color: "var(--color-live)" }}>*</span>
          </label>
          <input
            type="text"
            name="title"
            required
            maxLength={120}
            placeholder="Ej: Profecías del Antiguo Testamento"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            Descripción
          </label>
          <textarea
            name="description"
            rows={3}
            maxLength={300}
            placeholder="Descripción del set (opcional)"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input type="checkbox" name="is_public" defaultChecked className="peer sr-only" />
            <div
              className="w-10 h-5 rounded-full transition-colors peer-checked:bg-[#D4A017]"
              style={{ background: "var(--color-border)" }}
            />
            <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
          </div>
          <span className="text-sm" style={{ color: "var(--color-text)" }}>
            Visible para todos los anfitriones
          </span>
        </label>

        <div className="flex gap-3 pt-2">
          <Link
            href="/admin/question-sets"
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-center"
            style={{
              background: "var(--color-surface-elevated)",
              color: "var(--color-text-muted)",
              border: "1px solid var(--color-border)",
            }}
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            Crear y agregar preguntas
          </button>
        </div>
      </form>
    </div>
  );
}

import { createClient, createServiceClient, getProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { generateJoinCode } from "@/lib/utils";
import { TRIVIA_CATEGORIES, TRIVIA_DIFFICULTY_LABEL } from "@/types";
import type { TriviaDifficulty } from "@/types";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nueva sala de Trivia — Elim LLDM" };

const DIFFICULTIES: TriviaDifficulty[] = ["facil", "medio", "dificil"];

async function createRoom(formData: FormData) {
  "use server";
  const profile = await getProfile();
  if (!profile) redirect("/login?returnUrl=/trivia/nueva");
  if (
    (profile.role !== "admin" && profile.role !== "anfitrion") ||
    !profile.verified_lldm
  ) {
    redirect("/trivia");
  }

  const name = (formData.get("name") as string).trim();
  const category = (formData.get("category") as string).trim();
  const difficulty = formData.get("difficulty") as string;
  const question_set_id = formData.get("question_set_id") as string;

  if (
    !name ||
    !category ||
    !TRIVIA_CATEGORIES.includes(category as (typeof TRIVIA_CATEGORIES)[number]) ||
    !DIFFICULTIES.includes(difficulty as TriviaDifficulty) ||
    !question_set_id
  ) {
    return;
  }

  const supabase = await createServiceClient();

  const { data: room, error } = await supabase
    .from("trivia_rooms")
    .insert({
      name,
      category,
      difficulty,
      host_id: profile.id,
      question_set_id,
      status: "lobby",
      join_code: generateJoinCode(),
    })
    .select("id")
    .single();

  if (error || !room) return;

  redirect(`/trivia/${(room as { id: string }).id}`);
}

export default async function NuevaSalaTriviaPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?returnUrl=/trivia/nueva");
  if (
    (profile.role !== "admin" && profile.role !== "anfitrion") ||
    !profile.verified_lldm
  ) {
    redirect("/trivia");
  }

  const supabase = await createClient();
  const { data: questionSets } = await supabase
    .from("question_sets")
    .select("id, title, questions(count)")
    .eq("is_public", true)
    .order("title");

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/trivia"
            className="flex items-center gap-1.5 text-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            <ArrowLeft size={15} />
            Trivia en Vivo
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--color-text)" }}>
          Nueva sala de trivia
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
          Configura tu sala, comparte el código en pantalla y deja que tu audiencia se una.
        </p>

        <form action={createRoom} className="flex flex-col gap-6">
          {/* Name */}
          <Field label="Nombre de la sala" required>
            <input
              type="text"
              name="name"
              required
              maxLength={80}
              placeholder="Ej: Trivia de Profecías — Vivo del jueves"
              className="trivia-input w-full rounded-xl px-4 py-3 text-sm outline-none"
            />
          </Field>

          {/* Category */}
          <Field label="Categoría" required>
            <select name="category" required defaultValue="" className="trivia-input w-full rounded-xl px-4 py-3 text-sm outline-none">
              <option value="" disabled>
                Seleccionar categoría...
              </option>
              {TRIVIA_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          {/* Difficulty */}
          <Field label="Nivel de dificultad" required>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((d, i) => (
                <label key={d} className="trivia-radio relative">
                  <input
                    type="radio"
                    name="difficulty"
                    value={d}
                    defaultChecked={i === 1}
                    className="peer sr-only"
                  />
                  <span
                    className="flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-150 peer-checked:[--active:1]"
                    style={{
                      background: "var(--color-surface-elevated)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {TRIVIA_DIFFICULTY_LABEL[d]}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs mt-1.5" style={{ color: "var(--color-text-muted)" }}>
              Se mostrará como referencia en el lobby para tus jugadores.
            </p>
          </Field>

          {/* Question set */}
          <Field label="Set de preguntas" required>
            {!questionSets || questionSets.length === 0 ? (
              <div
                className="rounded-xl px-4 py-3 text-sm"
                style={{
                  background: "rgba(248,113,113,0.08)",
                  border: "1px solid rgba(248,113,113,0.2)",
                  color: "var(--color-destructive)",
                }}
              >
                No hay sets de preguntas disponibles.{" "}
                <Link href="/admin/question-sets/nueva" style={{ textDecoration: "underline" }}>
                  Crea uno primero.
                </Link>
              </div>
            ) : (
              <select name="question_set_id" required defaultValue="" className="trivia-input w-full rounded-xl px-4 py-3 text-sm outline-none">
                <option value="" disabled>
                  Seleccionar set...
                </option>
                {(questionSets as unknown as Array<{ id: string; title: string; questions: unknown[] }>).map(
                  (s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  )
                )}
              </select>
            )}
          </Field>

          <div className="flex gap-3 pt-2">
            <Link
              href="/trivia"
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
              style={{ background: "var(--trivia-gold)", color: "#1a1500" }}
            >
              Crear y abrir sala
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .trivia-input {
          background: var(--color-surface-elevated);
          border: 1px solid var(--color-border);
          color: var(--color-text);
        }
        .trivia-input:focus {
          border-color: var(--trivia-gold);
        }
        .trivia-radio input:checked + span {
          background: rgba(245,200,66,0.14) !important;
          border-color: var(--trivia-gold) !important;
          color: var(--trivia-gold) !important;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
        {label} {required && <span style={{ color: "var(--color-live)" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Plus, Save, Loader2 } from "lucide-react";

interface Question {
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
}

interface QuestionFormProps {
  setId: string;
  nextOrderIndex: number;
  editQuestion?: Question;
}

export function QuestionForm({ setId, nextOrderIndex, editQuestion }: QuestionFormProps) {
  const isEditing = !!editQuestion;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);

    const body = {
      question_text: formData.get("question_text"),
      option_a: formData.get("option_a"),
      option_b: formData.get("option_b"),
      option_c: formData.get("option_c"),
      option_d: formData.get("option_d"),
      correct_option: formData.get("correct_option"),
      bible_reference: formData.get("bible_reference") || null,
      time_limit_seconds: parseInt(formData.get("time_limit_seconds") as string, 10),
      points: parseInt(formData.get("points") as string, 10),
    };

    const url = isEditing
      ? `/api/admin/questions/${editQuestion.id}`
      : `/api/admin/question-sets/${setId}/questions`;

    const res = await fetch(url, {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isEditing ? body : { ...body, order_index: nextOrderIndex }
      ),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al guardar");
      return;
    }

    // Reload to show updated list
    window.location.href = `/admin/question-sets/${setId}`;
  }

  const q = editQuestion;

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>
        {isEditing ? "Editar pregunta" : "Agregar pregunta"}
      </h3>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => handleSubmit(new FormData(e.currentTarget)));
        }}
        className="flex flex-col gap-4"
      >
        <Field label="Pregunta" required>
          <textarea
            name="question_text"
            defaultValue={q?.question_text}
            required
            rows={3}
            maxLength={300}
            placeholder="Escribe la pregunta bíblica..."
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </Field>

        {(["a", "b", "c", "d"] as const).map((opt) => (
          <Field key={opt} label={`Opción ${opt.toUpperCase()}`} required>
            <input
              type="text"
              name={`option_${opt}`}
              defaultValue={q?.[`option_${opt}` as keyof Question] as string}
              required
              maxLength={200}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{
                background: "var(--color-surface-elevated)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </Field>
        ))}

        <Field label="Opción correcta" required>
          <select
            name="correct_option"
            defaultValue={q?.correct_option ?? "a"}
            required
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            <option value="a">A</option>
            <option value="b">B</option>
            <option value="c">C</option>
            <option value="d">D</option>
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tiempo (seg)">
            <input
              type="number"
              name="time_limit_seconds"
              defaultValue={q?.time_limit_seconds ?? 30}
              min={10}
              max={120}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{
                background: "var(--color-surface-elevated)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </Field>
          <Field label="Puntos">
            <input
              type="number"
              name="points"
              defaultValue={q?.points ?? 100}
              min={10}
              max={1000}
              step={10}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{
                background: "var(--color-surface-elevated)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </Field>
        </div>

        <Field label="Referencia bíblica">
          <input
            type="text"
            name="bible_reference"
            defaultValue={q?.bible_reference ?? ""}
            maxLength={60}
            placeholder="Ej: Juan 3:16"
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </Field>

        {error && (
          <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          {isEditing && (
            <a
              href={`/admin/question-sets/${setId}`}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-center"
              style={{
                background: "var(--color-surface-elevated)",
                color: "var(--color-text-muted)",
              }}
            >
              Cancelar
            </a>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            {isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isEditing ? (
              <Save size={14} />
            ) : (
              <Plus size={14} />
            )}
            {isEditing ? "Guardar cambios" : "Agregar pregunta"}
          </button>
        </div>
      </form>
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
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>
        {label}
        {required && <span style={{ color: "var(--color-live)" }}> *</span>}
      </label>
      {children}
    </div>
  );
}

"use client";

import { Trash2 } from "lucide-react";

export function DeleteQuestionForm({
  action,
  questionId,
  setId,
}: {
  action: (formData: FormData) => Promise<void>;
  questionId: string;
  setId: string;
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm("¿Eliminar pregunta?")) {
      e.preventDefault();
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit}>
      <input type="hidden" name="questionId" value={questionId} />
      <input type="hidden" name="setId" value={setId} />
      <button
        type="submit"
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: "rgba(248,113,113,0.1)", color: "var(--color-destructive)" }}
      >
        <Trash2 size={12} />
      </button>
    </form>
  );
}

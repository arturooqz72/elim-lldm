"use client";

import { Trash2 } from "lucide-react";

export function DeleteProgramaForm({
  action,
  id,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (
      !confirm(
        "¿Eliminar este programa? Sus audios e intros se borran con él. Si tiene transmisiones (pláticas) vinculadas, no se podrá eliminar."
      )
    ) {
      e.preventDefault();
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "rgba(248,113,113,0.1)", color: "var(--color-destructive)" }}
        aria-label="Eliminar programa"
      >
        <Trash2 size={12} />
      </button>
    </form>
  );
}

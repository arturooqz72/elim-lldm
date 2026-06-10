"use client";

import { Eye, EyeOff, Trash2 } from "lucide-react";

interface TrackRowActionsProps {
  id: string;
  title: string;
  isActive: boolean;
  toggleAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
}

export function TrackRowActions({ id, title, isActive, toggleAction, deleteAction }: TrackRowActionsProps) {
  return (
    <>
      <form action={toggleAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="next" value={(!isActive).toString()} />
        <button
          type="submit"
          className="p-1.5 rounded-lg"
          style={{ color: "var(--color-text-muted)" }}
          title={isActive ? "Desactivar" : "Activar"}
        >
          {isActive ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
      </form>

      <form
        action={deleteAction}
        onSubmit={(e) => {
          if (!confirm(`¿Eliminar "${title}"? Esta acción no se puede deshacer.`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          className="p-1.5 rounded-lg"
          style={{ color: "var(--color-destructive)" }}
          title="Eliminar"
        >
          <Trash2 size={13} />
        </button>
      </form>
    </>
  );
}

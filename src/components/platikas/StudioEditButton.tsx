"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Loader2 } from "lucide-react";

interface StudioEditButtonProps {
  platikaId: string;
  initialTitle: string;
  initialDescription: string | null;
  onTitleChange: (title: string) => void;
}

// Botón "Editar" junto al título en la barra superior — mismo lugar
// que el lápiz "Edit" de StreamYard (aunque ahí abre destinos,
// miniatura y privacidad; aquí solo título/descripción, lo único que
// ya soportaba PATCH /api/platikas/[id]).
export function StudioEditButton({
  platikaId,
  initialTitle,
  initialDescription,
  onTitleChange,
}: StudioEditButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("El título es requerido");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/platikas/${platikaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed, description: description.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo guardar");
        return;
      }
      onTitleChange(trimmed);
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Editar sesión"
        title="Editar sesión"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
        style={{ color: "var(--color-text-muted)" }}
      >
        <Pencil size={14} />
        <span className="hidden sm:inline">Editar</span>
      </button>

      {open && (
        <div
          className="absolute top-11 right-0 w-72 p-4 rounded-xl flex flex-col gap-3 z-20"
          style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              Editar sesión
            </p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar">
              <X size={16} style={{ color: "var(--color-text-muted)" }} />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              className="w-full rounded-lg px-2.5 py-1.5 text-sm outline-none"
              style={{ background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
              Descripción (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              rows={3}
              className="w-full rounded-lg px-2.5 py-1.5 text-sm outline-none resize-none"
              style={{ background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
            />
          </div>

          {error && (
            <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Guardar"}
          </button>
        </div>
      )}
    </div>
  );
}

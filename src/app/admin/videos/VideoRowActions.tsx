"use client";

import { useState } from "react";
import { Check, X, Trash2, Save } from "lucide-react";
import type { VideoStatus } from "@/types";

interface VideoRowActionsProps {
  id: string;
  title: string;
  status: VideoStatus;
  categoryId: string | null;
  categories: Array<{ id: string; name: string }>;
  approveAction: (formData: FormData) => void;
  rejectAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
}

const selectStyle = {
  background: "var(--color-surface-elevated)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
} as const;

export function VideoRowActions({
  id,
  title,
  status,
  categoryId,
  categories,
  approveAction,
  rejectAction,
  deleteAction,
}: VideoRowActionsProps) {
  const [selectedCategory, setSelectedCategory] = useState(categoryId ?? "");
  const [showRejectForm, setShowRejectForm] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="rounded-lg px-2.5 py-1.5 text-xs outline-none"
          style={selectStyle}
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {status === "approved" ? (
          <form action={approveAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="category_id" value={selectedCategory} />
            <button
              type="submit"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "var(--color-surface-elevated)", color: "var(--color-text)" }}
              title="Guardar categoría"
            >
              <Save size={12} />
              Guardar
            </button>
          </form>
        ) : (
          <form action={approveAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="category_id" value={selectedCategory} />
            <button
              type="submit"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "var(--color-success)", color: "#000" }}
              title="Aprobar"
            >
              <Check size={12} />
              Aprobar
            </button>
          </form>
        )}

        {status !== "rejected" && (
          <button
            type="button"
            onClick={() => setShowRejectForm((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: "var(--color-surface-elevated)", color: "var(--color-destructive)" }}
            title="Rechazar"
          >
            <X size={12} />
            Rechazar
          </button>
        )}

        <form
          action={deleteAction}
          onSubmit={(e) => {
            if (!confirm(`¿Eliminar el video "${title}"? Esta acción no se puede deshacer.`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            className="p-1.5 rounded-lg"
            style={{ color: "var(--color-text-muted)" }}
            title="Eliminar"
          >
            <Trash2 size={13} />
          </button>
        </form>
      </div>

      {showRejectForm && (
        <form action={rejectAction} className="flex items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <input
            type="text"
            name="rejection_reason"
            placeholder="Motivo del rechazo (opcional)"
            maxLength={300}
            className="flex-1 rounded-lg px-3 py-1.5 text-xs outline-none"
            style={selectStyle}
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
            style={{ background: "var(--color-destructive)", color: "#000" }}
          >
            Confirmar rechazo
          </button>
        </form>
      )}
    </div>
  );
}

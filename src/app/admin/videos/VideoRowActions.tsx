"use client";

import { useEffect, useState } from "react";
import { Check, X, Trash2, Save } from "lucide-react";
import type { VideoStatus } from "@/types";

interface VideoRowActionsProps {
  id: string;
  title: string;
  status: VideoStatus;
  categoryId: string | null;
  categories: Array<{ id: string; name: string }>;
  approveAction: (formData: FormData) => void;
  saveCategoryAction: (formData: FormData) => void;
  rejectAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
}

const selectStyle = {
  background: "var(--color-surface-elevated)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
} as const;

const NUEVA = "__nueva__";

export function VideoRowActions({
  id,
  title,
  status,
  categoryId,
  categories,
  approveAction,
  saveCategoryAction,
  rejectAction,
  deleteAction,
}: VideoRowActionsProps) {
  const [selectedCategory, setSelectedCategory] = useState(categoryId ?? "");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Al guardar, el servidor manda la categoría nueva (o la recién creada):
  // el menú se pone en esa y se limpia el nombre escrito.
  useEffect(() => {
    setSelectedCategory(categoryId ?? "");
    setNewCategoryName("");
  }, [categoryId]);
  const creandoCategoria = selectedCategory === NUEVA;
  // Con "+ Nueva categoría…" no se guarda nada hasta escribir el nombre.
  const faltaNombre = creandoCategoria && !newCategoryName.trim();
  const sinCambios = !creandoCategoria && selectedCategory === (categoryId ?? "");

  const camposCategoria = (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="category_id" value={selectedCategory} />
      <input type="hidden" name="new_category_name" value={newCategoryName} />
    </>
  );

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
          <option value={NUEVA}>+ Nueva categoría…</option>
        </select>

        {creandoCategoria && (
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Nombre de la categoría"
            maxLength={60}
            autoFocus
            className="rounded-lg px-2.5 py-1.5 text-xs outline-none w-44"
            style={selectStyle}
          />
        )}

        <form action={saveCategoryAction}>
          {camposCategoria}
          <button
            type="submit"
            disabled={faltaNombre || sinCambios}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
            style={{ background: "var(--color-surface-elevated)", color: "var(--color-text)" }}
            title="Cambiar solo la categoría, sin aprobar ni rechazar"
          >
            <Save size={12} />
            Guardar categoría
          </button>
        </form>

        {status !== "approved" && (
          <form action={approveAction}>
            {camposCategoria}
            <button
              type="submit"
              disabled={faltaNombre}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
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

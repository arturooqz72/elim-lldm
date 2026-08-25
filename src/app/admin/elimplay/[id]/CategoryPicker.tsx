"use client";

import { useState } from "react";
import { CATEGORY_NEW } from "./newEntitySentinels";

const inputStyle = {
  background: "var(--color-surface-elevated)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
} as const;

export function CategoryPicker({
  categories,
  defaultCategoryId,
}: {
  categories: Array<{ id: string; name: string }>;
  defaultCategoryId: string;
}) {
  const [selected, setSelected] = useState(defaultCategoryId);

  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
          Categoría
        </label>
        <select
          name="category_id"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={inputStyle}
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={CATEGORY_NEW}>+ Nueva categoría...</option>
        </select>
      </div>

      {selected === CATEGORY_NEW && (
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            Nombre de la nueva categoría <span style={{ color: "var(--color-live)" }}>*</span>
          </label>
          <input
            type="text"
            name="new_category_name"
            maxLength={60}
            placeholder="Ej: Testimonios"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={inputStyle}
          />
        </div>
      )}
    </>
  );
}

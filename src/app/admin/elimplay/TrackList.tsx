"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, Pencil, Loader2, CheckSquare, Square, X } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { TrackRowActions } from "./TrackRowActions";
import { bulkUpdateTracks } from "./actions";

const NEW_VALUE = "__new__";
const CLEAR_VALUE = "__clear__";
const SKIP_VALUE = "";

interface Track {
  id: string;
  title: string;
  is_published: boolean;
  play_count: number;
  created_at: string;
  audio_categories: { name: string } | null;
  artists: { name: string } | null;
}

interface TrackListProps {
  items: Track[];
  categories: Array<{ id: string; name: string }>;
  artists: Array<{ id: string; name: string }>;
  toggleAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
}

const inputStyle = {
  background: "var(--color-surface-elevated)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
} as const;

export function TrackList({ items, categories, artists, toggleAction, deleteAction }: TrackListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [localCategories, setLocalCategories] = useState(categories);
  const [localArtists, setLocalArtists] = useState(artists);
  const [categoryChoice, setCategoryChoice] = useState(SKIP_VALUE);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [artistChoice, setArtistChoice] = useState(SKIP_VALUE);
  const [newArtistName, setNewArtistName] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const allSelected = items.length > 0 && selected.size === items.length;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  }

  function clearSelection() {
    setSelected(new Set());
    setCategoryChoice(SKIP_VALUE);
    setNewCategoryName("");
    setArtistChoice(SKIP_VALUE);
    setNewArtistName("");
    setApplyError(null);
  }

  const nothingToApply = useMemo(
    () => categoryChoice === SKIP_VALUE && artistChoice === SKIP_VALUE,
    [categoryChoice, artistChoice]
  );

  async function applyBulkChanges() {
    if (selected.size === 0 || nothingToApply || applying) return;
    setApplying(true);
    setApplyError(null);

    const category =
      categoryChoice === SKIP_VALUE
        ? ({ mode: "skip" } as const)
        : categoryChoice === CLEAR_VALUE
          ? ({ mode: "clear" } as const)
          : categoryChoice === NEW_VALUE
            ? ({ mode: "new", name: newCategoryName.trim() } as const)
            : ({ mode: "existing", id: categoryChoice } as const);

    const artist =
      artistChoice === SKIP_VALUE
        ? ({ mode: "skip" } as const)
        : artistChoice === CLEAR_VALUE
          ? ({ mode: "clear" } as const)
          : artistChoice === NEW_VALUE
            ? ({ mode: "new", name: newArtistName.trim() } as const)
            : ({ mode: "existing", id: artistChoice } as const);

    if (category.mode === "new" && !category.name) {
      setApplyError("Escribe el nombre de la nueva categoría.");
      setApplying(false);
      return;
    }
    if (artist.mode === "new" && !artist.name) {
      setApplyError("Escribe el nombre del nuevo artista.");
      setApplying(false);
      return;
    }

    const result = await bulkUpdateTracks({ ids: Array.from(selected), category, artist });

    if (result.error) {
      setApplyError(result.error);
      setApplying(false);
      return;
    }

    if (result.createdCategory) {
      setLocalCategories((prev) => [...prev, result.createdCategory!]);
    }
    if (result.createdArtist) {
      setLocalArtists((prev) => [...prev, result.createdArtist!]);
    }

    clearSelection();
    setApplying(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length > 1 && (
        <button
          type="button"
          onClick={toggleAll}
          className="flex items-center gap-2 text-xs self-start px-1"
          style={{ color: "var(--color-text-muted)" }}
        >
          {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
          {allSelected ? "Deseleccionar todos" : "Seleccionar todos"}
        </button>
      )}

      {selected.size > 0 && (
        <div
          className="flex flex-col gap-3 p-4 rounded-2xl sticky top-2 z-10"
          style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-primary)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              {selected.size} audio{selected.size === 1 ? "" : "s"} seleccionado{selected.size === 1 ? "" : "s"}
            </p>
            <button type="button" onClick={clearSelection} style={{ color: "var(--color-text-muted)" }}>
              <X size={16} />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Categoría
              </label>
              <select
                value={categoryChoice}
                onChange={(e) => setCategoryChoice(e.target.value)}
                disabled={applying}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              >
                <option value={SKIP_VALUE}>No cambiar</option>
                <option value={CLEAR_VALUE}>Sin categoría</option>
                {localCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value={NEW_VALUE}>+ Nueva categoría...</option>
              </select>
              {categoryChoice === NEW_VALUE && (
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  disabled={applying}
                  maxLength={60}
                  placeholder="Nombre de la nueva categoría"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mt-2"
                  style={inputStyle}
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Artista / Intérprete
              </label>
              <select
                value={artistChoice}
                onChange={(e) => setArtistChoice(e.target.value)}
                disabled={applying}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              >
                <option value={SKIP_VALUE}>No cambiar</option>
                <option value={CLEAR_VALUE}>Sin intérprete</option>
                {localArtists.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
                <option value={NEW_VALUE}>+ Nuevo artista...</option>
              </select>
              {artistChoice === NEW_VALUE && (
                <input
                  type="text"
                  value={newArtistName}
                  onChange={(e) => setNewArtistName(e.target.value)}
                  disabled={applying}
                  maxLength={120}
                  placeholder="Nombre del nuevo artista"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mt-2"
                  style={inputStyle}
                />
              )}
            </div>
          </div>

          {applyError && (
            <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
              {applyError}
            </p>
          )}

          <button
            type="button"
            onClick={applyBulkChanges}
            disabled={applying || nothingToApply}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 self-start px-6"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            {applying && <Loader2 size={14} className="animate-spin" />}
            {applying
              ? "Aplicando..."
              : `Aplicar a ${selected.size} audio${selected.size === 1 ? "" : "s"}`}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between px-5 py-4 rounded-2xl"
            style={{
              background: "var(--color-surface)",
              border: `1px solid ${selected.has(item.id) ? "var(--color-primary)" : "var(--color-border)"}`,
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => toggleOne(item.id)}
                className="shrink-0"
                style={{ color: selected.has(item.id) ? "var(--color-primary)" : "var(--color-text-muted)" }}
              >
                {selected.has(item.id) ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
              {item.is_published ? (
                <Eye size={15} style={{ color: "var(--color-success)" }} />
              ) : (
                <EyeOff size={15} style={{ color: "var(--color-text-muted)" }} />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                  {item.title}
                  {item.artists?.name && (
                    <span className="font-normal" style={{ color: "var(--color-text-muted)" }}>
                      {" "}— {item.artists.name}
                    </span>
                  )}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {item.audio_categories?.name ?? "Sin categoría"} · {item.play_count} reproducciones ·{" "}
                  {formatDate(item.created_at).split(",")[0]}
                </p>
              </div>
            </div>
            <div className="ml-3 flex items-center gap-2 shrink-0">
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  background: item.is_published ? "rgba(74,222,128,0.1)" : "var(--color-surface-elevated)",
                  color: item.is_published ? "var(--color-success)" : "var(--color-text-muted)",
                }}
              >
                {item.is_published ? "Activo" : "Inactivo"}
              </span>
              <TrackRowActions
                id={item.id}
                title={item.title}
                isActive={item.is_published}
                toggleAction={toggleAction}
                deleteAction={deleteAction}
              />
              <Link
                href={`/admin/elimplay/${item.id}`}
                className="p-1.5 rounded-lg"
                style={{ color: "var(--color-text-muted)" }}
                title="Editar"
              >
                <Pencil size={13} />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

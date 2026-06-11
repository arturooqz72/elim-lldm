"use client";

import { useState } from "react";
import type { Artist } from "@/types";

export const ARTIST_NEW = "__new__";

const inputStyle = {
  background: "var(--color-surface-elevated)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
} as const;

export function ArtistPicker({
  artists,
  defaultArtistId,
}: {
  artists: Pick<Artist, "id" | "name" | "photo_url">[];
  defaultArtistId: string;
}) {
  const [selected, setSelected] = useState(defaultArtistId);
  const selectedArtist = artists.find((a) => a.id === selected);

  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
          Artista / Intérprete
        </label>
        <select
          name="artist_id"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={inputStyle}
        >
          <option value="">Sin intérprete</option>
          {artists.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
          <option value={ARTIST_NEW}>+ Nuevo artista...</option>
        </select>
      </div>

      {selected === ARTIST_NEW && (
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            Nombre del nuevo artista <span style={{ color: "var(--color-live)" }}>*</span>
          </label>
          <input
            type="text"
            name="new_artist_name"
            maxLength={120}
            placeholder="Ej: Ana Cubillo"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={inputStyle}
          />
        </div>
      )}

      {selected !== "" && (
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            Foto del artista {selectedArtist?.photo_url ? "(reemplazar)" : "(opcional)"}
          </label>
          {selectedArtist?.photo_url && (
            <img
              src={selectedArtist.photo_url}
              alt={selectedArtist.name}
              className="w-16 h-16 rounded-full object-cover mb-2"
            />
          )}
          <input
            type="file"
            name="artist_photo"
            accept="image/*"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none file:mr-2 file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-semibold"
            style={inputStyle}
          />
        </div>
      )}
    </>
  );
}

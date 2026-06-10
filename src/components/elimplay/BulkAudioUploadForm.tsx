"use client";

import { useState } from "react";
import { Upload, Loader2, CheckCircle, XCircle, X, Music } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface BulkAudioUploadFormProps {
  categories: Array<{ id: string; name: string }>;
}

type FileStatus = "pending" | "uploading" | "done" | "error";

interface FileItem {
  file: File;
  title: string;
  status: FileStatus;
  error?: string;
}

function titleFromFilename(name: string): string {
  const base = name.replace(/\.[^/.]+$/, "");
  const cleaned = base.replace(/^[\s\d]+[-_.\s]*/, "").replace(/[_-]+/g, " ").trim();
  const result = cleaned || base;
  return result
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src);
      resolve(Math.round(audio.duration) || 0);
    };
    audio.onerror = () => resolve(0);
    audio.src = URL.createObjectURL(file);
  });
}

const inputStyle = {
  background: "var(--color-surface-elevated)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
} as const;

export function BulkAudioUploadForm({ categories }: BulkAudioUploadFormProps) {
  const router = useRouter();
  const [items, setItems] = useState<FileItem[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [artist, setArtist] = useState("");
  const [tags, setTags] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [done, setDone] = useState(false);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const newItems: FileItem[] = Array.from(fileList).map((file) => ({
      file,
      title: titleFromFilename(file.name),
      status: "pending" as const,
    }));
    setItems((prev) => [...prev, ...newItems]);
  }

  function updateTitle(index: number, title: string) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, title } : it)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0 || isUploading) return;
    setIsUploading(true);

    const supabase = createClient();
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);

    for (let i = 0; i < items.length; i++) {
      setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: "uploading" } : it)));
      const item = items[i];

      try {
        const duration_seconds = await getAudioDuration(item.file);
        const path = `tracks/${Date.now()}-${item.file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("audio-tracks")
          .upload(path, item.file, { cacheControl: "3600" });
        if (uploadErr) throw new Error(uploadErr.message);

        const { data: urlData } = supabase.storage.from("audio-tracks").getPublicUrl(path);

        const { error: insertErr } = await supabase.from("audio_tracks").insert({
          title: item.title.trim() || item.file.name,
          artist: artist.trim() || null,
          description: null,
          audio_url: urlData.publicUrl,
          cover_url: null,
          duration_seconds: duration_seconds || null,
          category_id: categoryId || null,
          tags: tagList,
          is_published: isPublished,
          published_at: isPublished ? new Date().toISOString() : null,
        });
        if (insertErr) throw new Error(insertErr.message);

        setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: "done" } : it)));
      } catch (err) {
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: "error", error: err instanceof Error ? err.message : "Error desconocido" } : it
          )
        );
      }
    }

    setIsUploading(false);
    setDone(true);
  }

  if (done) {
    const successCount = items.filter((it) => it.status === "done").length;
    const errorCount = items.filter((it) => it.status === "error").length;
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-12 rounded-2xl"
        style={{
          background: "var(--color-surface)",
          border: `1px solid ${errorCount > 0 ? "rgba(248,113,113,0.3)" : "rgba(74,222,128,0.3)"}`,
        }}
      >
        <CheckCircle size={32} style={{ color: "var(--color-success)" }} />
        <p className="font-semibold text-center" style={{ color: "var(--color-text)" }}>
          {successCount} audio{successCount === 1 ? "" : "s"} subido{successCount === 1 ? "" : "s"} exitosamente
          {errorCount > 0 && `, ${errorCount} con error`}
        </p>
        <button
          type="button"
          onClick={() => router.push("/admin/elimplay")}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold mt-2"
          style={{ background: "var(--color-primary)", color: "#000" }}
        >
          Volver a ElimPlay
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label
          className="flex flex-col items-center justify-center gap-2 w-full py-8 rounded-xl cursor-pointer transition-colors"
          style={{
            background: "var(--color-surface-elevated)",
            border: `2px dashed ${items.length > 0 ? "rgba(212,160,23,0.5)" : "var(--color-border)"}`,
          }}
        >
          <Upload size={20} style={{ color: items.length > 0 ? "var(--color-primary)" : "var(--color-text-muted)" }} />
          <span className="text-sm" style={{ color: items.length > 0 ? "var(--color-primary)" : "var(--color-text-muted)" }}>
            {items.length > 0 ? `${items.length} archivo(s) seleccionado(s)` : "Seleccionar varios audios (MP3, WAV, etc.)"}
          </span>
          <input
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            disabled={isUploading}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
            >
              <Music size={16} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
              <input
                type="text"
                value={item.title}
                onChange={(e) => updateTitle(i, e.target.value)}
                disabled={isUploading}
                className="flex-1 min-w-0 bg-transparent text-sm outline-none"
                style={{ color: "var(--color-text)" }}
              />
              {item.status === "pending" && !isUploading && (
                <button type="button" onClick={() => removeItem(i)} style={{ color: "var(--color-text-muted)" }}>
                  <X size={15} />
                </button>
              )}
              {item.status === "uploading" && <Loader2 size={15} className="animate-spin" style={{ color: "var(--color-primary)" }} />}
              {item.status === "done" && <CheckCircle size={15} style={{ color: "var(--color-success)" }} />}
              {item.status === "error" && (
                <span title={item.error}>
                  <XCircle size={15} style={{ color: "var(--color-destructive)" }} />
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            Categoría (para todos)
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={isUploading}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={inputStyle}
          >
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            Artista / Intérprete (para todos)
          </label>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            disabled={isUploading}
            maxLength={120}
            placeholder="Opcional"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
          Etiquetas (para todos)
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          disabled={isUploading}
          maxLength={200}
          placeholder="Ej: alabanza, coro juvenil, 2026 (separadas por coma)"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={inputStyle}
        />
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <div className="relative">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            disabled={isUploading}
            className="peer sr-only"
          />
          <div
            className="w-10 h-5 rounded-full transition-colors peer-checked:bg-[#D4A017]"
            style={{ background: "var(--color-border)" }}
          />
          <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
        </div>
        <span className="text-sm" style={{ color: "var(--color-text)" }}>
          Publicar inmediatamente
        </span>
      </label>

      <button
        type="submit"
        disabled={isUploading || items.length === 0}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: "var(--color-primary)", color: "#000" }}
      >
        {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {isUploading ? "Subiendo..." : `Subir ${items.length || ""} audio${items.length === 1 ? "" : "s"}`.trim()}
      </button>
    </form>
  );
}

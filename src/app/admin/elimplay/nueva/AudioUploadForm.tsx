"use client";

import { useState, useTransition } from "react";
import { Upload, Loader2, CheckCircle, Music } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface AudioUploadFormProps {
  categories: Array<{ id: string; name: string }>;
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

export function AudioUploadForm({ categories }: AudioUploadFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!audioFile) { setError("Selecciona un archivo de audio"); return; }
    setError(null);

    startTransition(async () => {
      const supabase = createClient();
      const form = e.currentTarget;
      const data = new FormData(form);

      // Duration
      setUploadProgress("Leyendo duración...");
      const duration_seconds = await getAudioDuration(audioFile);

      // Upload audio
      setUploadProgress("Subiendo audio...");
      const audioPath = `tracks/${Date.now()}-${audioFile.name}`;
      const { error: audioErr } = await supabase.storage
        .from("audio-tracks")
        .upload(audioPath, audioFile, { cacheControl: "3600" });
      if (audioErr) { setError(audioErr.message); setUploadProgress(null); return; }

      const { data: audioUrlData } = supabase.storage
        .from("audio-tracks")
        .getPublicUrl(audioPath);
      const audio_url = audioUrlData.publicUrl;

      // Upload cover if provided
      let cover_url: string | null = null;
      if (coverFile) {
        setUploadProgress("Subiendo portada...");
        const coverPath = `covers/${Date.now()}-${coverFile.name}`;
        const { error: coverErr } = await supabase.storage
          .from("audio-tracks")
          .upload(coverPath, coverFile, { cacheControl: "3600" });
        if (!coverErr) {
          const { data: coverUrlData } = supabase.storage.from("audio-tracks").getPublicUrl(coverPath);
          cover_url = coverUrlData.publicUrl;
        }
      }

      setUploadProgress("Guardando registro...");

      const tags = ((data.get("tags") as string) ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const isPublished = data.get("is_published") === "on";

      const { error: insertErr } = await supabase.from("audio_tracks").insert({
        title: (data.get("title") as string).trim(),
        artist: ((data.get("artist") as string) ?? "").trim() || null,
        description: ((data.get("description") as string) ?? "").trim() || null,
        audio_url,
        cover_url,
        duration_seconds: duration_seconds || null,
        category_id: (data.get("category_id") as string) || null,
        tags,
        is_published: isPublished,
        published_at: isPublished ? new Date().toISOString() : null,
      });

      setUploadProgress(null);
      if (insertErr) { setError(insertErr.message); return; }

      setDone(true);
      setTimeout(() => router.push("/admin/elimplay"), 1500);
    });
  }

  if (done) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 rounded-2xl"
        style={{ background: "var(--color-surface)", border: "1px solid rgba(74,222,128,0.3)" }}
      >
        <CheckCircle size={32} className="mb-3" style={{ color: "var(--color-success)" }} />
        <p className="font-semibold" style={{ color: "var(--color-success)" }}>
          Audio subido exitosamente
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field label="Título" required>
        <input
          type="text"
          name="title"
          required
          maxLength={120}
          placeholder="Título del audio"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={inputStyle}
        />
      </Field>

      <Field label="Artista / Intérprete">
        <input
          type="text"
          name="artist"
          maxLength={120}
          placeholder="Nombre del artista o coro (opcional)"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={inputStyle}
        />
      </Field>

      <Field label="Descripción">
        <textarea
          name="description"
          rows={3}
          maxLength={500}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
          style={inputStyle}
        />
      </Field>

      <Field label="Archivo de audio" required>
        <label
          className="flex flex-col items-center justify-center gap-2 w-full py-8 rounded-xl cursor-pointer transition-colors"
          style={{
            background: "var(--color-surface-elevated)",
            border: `2px dashed ${audioFile ? "rgba(212,160,23,0.5)" : "var(--color-border)"}`,
          }}
        >
          <Upload size={20} style={{ color: audioFile ? "var(--color-primary)" : "var(--color-text-muted)" }} />
          <span className="text-sm" style={{ color: audioFile ? "var(--color-primary)" : "var(--color-text-muted)" }}>
            {audioFile ? audioFile.name : "Seleccionar audio (MP3, WAV, etc.)"}
          </span>
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </Field>

      <Field label="Portada">
        <label
          className="flex flex-col items-center justify-center gap-2 w-full py-5 rounded-xl cursor-pointer"
          style={{
            background: "var(--color-surface-elevated)",
            border: `2px dashed ${coverFile ? "rgba(212,160,23,0.5)" : "var(--color-border)"}`,
          }}
        >
          {coverFile ? (
            <span className="text-sm" style={{ color: "var(--color-primary)" }}>{coverFile.name}</span>
          ) : (
            <>
              <Music size={18} style={{ color: "var(--color-text-muted)" }} />
              <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Imagen de portada (opcional)
              </span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </Field>

      <Field label="Categoría">
        <select
          name="category_id"
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
      </Field>

      <Field label="Etiquetas">
        <input
          type="text"
          name="tags"
          maxLength={200}
          placeholder="Ej: alabanza, coro juvenil, 2026 (separadas por coma)"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={inputStyle}
        />
      </Field>

      <label className="flex items-center gap-3 cursor-pointer">
        <div className="relative">
          <input type="checkbox" name="is_published" defaultChecked className="peer sr-only" />
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

      {error && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}

      {uploadProgress && (
        <p className="text-xs flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
          <Loader2 size={12} className="animate-spin" />
          {uploadProgress}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !audioFile}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: "var(--color-primary)", color: "#000" }}
      >
        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        Subir audio
      </button>
    </form>
  );
}

const inputStyle = {
  background: "var(--color-surface-elevated)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
} as const;

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
        {label}
        {required && <span style={{ color: "var(--color-live)" }}> *</span>}
      </label>
      {children}
    </div>
  );
}

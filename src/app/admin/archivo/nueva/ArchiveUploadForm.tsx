"use client";

import { useState, useTransition } from "react";
import { Upload, Loader2, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface ArchiveUploadFormProps {
  categories: Array<{ id: string; name: string }>;
  platikas: Array<{ id: string; title: string }>;
}

export function ArchiveUploadForm({ categories, platikas }: ArchiveUploadFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!videoFile) { setError("Selecciona un archivo de video"); return; }
    setError(null);

    startTransition(async () => {
      const supabase = createClient();
      const form = e.currentTarget;
      const data = new FormData(form);

      // Upload video
      setUploadProgress("Subiendo video...");
      const videoPath = `recordings/${Date.now()}-${videoFile.name}`;
      const { error: videoErr } = await supabase.storage
        .from("recordings")
        .upload(videoPath, videoFile, { cacheControl: "3600" });
      if (videoErr) { setError(videoErr.message); setUploadProgress(null); return; }

      const { data: videoUrlData } = supabase.storage
        .from("recordings")
        .getPublicUrl(videoPath);
      const recording_url = videoUrlData.publicUrl;

      // Upload thumbnail if provided
      let thumbnail_url: string | null = null;
      if (thumbFile) {
        setUploadProgress("Subiendo miniatura...");
        const thumbPath = `thumbnails/${Date.now()}-${thumbFile.name}`;
        const { error: thumbErr } = await supabase.storage
          .from("recordings")
          .upload(thumbPath, thumbFile, { cacheControl: "3600" });
        if (!thumbErr) {
          const { data: thumbUrl } = supabase.storage.from("recordings").getPublicUrl(thumbPath);
          thumbnail_url = thumbUrl.publicUrl;
        }
      }

      setUploadProgress("Guardando registro...");

      const tags = (data.get("tags") as string)
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const { error: insertErr } = await supabase.from("archive").insert({
        title: (data.get("title") as string).trim(),
        description: (data.get("description") as string).trim() || null,
        recording_url,
        thumbnail_url,
        category_id: (data.get("category_id") as string) || null,
        platikas_id: (data.get("platikas_id") as string) || null,
        tags,
        is_published: data.get("is_published") === "on",
      });

      setUploadProgress(null);
      if (insertErr) { setError(insertErr.message); return; }

      setDone(true);
      setTimeout(() => router.push("/admin/archivo"), 1500);
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
          Grabación subida exitosamente
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
          placeholder="Título de la grabación"
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

      <Field label="Archivo de video" required>
        <label
          className="flex flex-col items-center justify-center gap-2 w-full py-8 rounded-xl cursor-pointer transition-colors"
          style={{
            background: "var(--color-surface-elevated)",
            border: `2px dashed ${videoFile ? "rgba(212,160,23,0.5)" : "var(--color-border)"}`,
          }}
        >
          <Upload size={20} style={{ color: videoFile ? "var(--color-primary)" : "var(--color-text-muted)" }} />
          <span className="text-sm" style={{ color: videoFile ? "var(--color-primary)" : "var(--color-text-muted)" }}>
            {videoFile ? videoFile.name : "Seleccionar video (MP4, MOV, etc.)"}
          </span>
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </Field>

      <Field label="Miniatura (thumbnail)">
        <label
          className="flex flex-col items-center justify-center gap-2 w-full py-5 rounded-xl cursor-pointer"
          style={{
            background: "var(--color-surface-elevated)",
            border: `2px dashed ${thumbFile ? "rgba(212,160,23,0.5)" : "var(--color-border)"}`,
          }}
        >
          <span className="text-sm" style={{ color: thumbFile ? "var(--color-primary)" : "var(--color-text-muted)" }}>
            {thumbFile ? thumbFile.name : "Imagen de portada (opcional)"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setThumbFile(e.target.files?.[0] ?? null)}
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

      <Field label="Plática original (opcional)">
        <select
          name="platikas_id"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={inputStyle}
        >
          <option value="">Ninguna</option>
          {platikas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Etiquetas">
        <input
          type="text"
          name="tags"
          maxLength={200}
          placeholder="Ej: doctrina, 2026, culto, evangelismo (separadas por coma)"
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
        disabled={isPending || !videoFile}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: "var(--color-primary)", color: "#000" }}
      >
        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        Subir grabación
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

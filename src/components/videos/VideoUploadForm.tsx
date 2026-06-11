"use client";

import { useState } from "react";
import { Upload, Loader2, CheckCircle, Film, ImageIcon } from "lucide-react";
import { createFreshClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface VideoUploadFormProps {
  categories: Array<{ id: string; name: string }>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(Math.round(video.duration) || 0);
    };
    video.onerror = () => resolve(0);
    video.src = URL.createObjectURL(file);
  });
}

async function sha1Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tiempo de espera agotado en: ${label} (${ms}ms)`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function uploadToB2WithProgress(
  uploadUrl: string,
  authorizationToken: string,
  file: File,
  fileName: string,
  sha1: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    xhr.setRequestHeader("Authorization", authorizationToken);
    xhr.setRequestHeader("X-Bz-File-Name", encodeURIComponent(fileName));
    xhr.setRequestHeader("Content-Type", file.type || "b2/x-auto");
    xhr.setRequestHeader("X-Bz-Content-Sha1", sha1);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Error ${xhr.status} al subir el video a Backblaze`));
    };
    xhr.onerror = () => reject(new Error("Error de red al subir el video"));
    xhr.send(file);
  });
}

const inputStyle = {
  background: "var(--color-surface-elevated)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
} as const;

export function VideoUploadForm({ categories }: VideoUploadFormProps) {
  const router = useRouter();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState("");
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [debugLines, setDebugLines] = useState<string[]>([]);

  function log(msg: string) {
    const line = `${new Date().toLocaleTimeString()} — ${msg}`;
    console.log("[VideoUpload]", line);
    setDebugLines((prev) => [...prev, line]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!videoFile || isUploading) return;
    setError(null);
    setIsUploading(true);
    setProgress(0);
    setDebugLines([]);

    try {
      log("Iniciando subida");
      const supabase = createFreshClient();
      log("Verificando sesión...");
      const {
        data: { session },
      } = await withTimeout(supabase.auth.getSession(), 10000, "verificar sesión");
      const user = session?.user;
      if (!user) throw new Error("Sesión inválida. Inicia sesión de nuevo.");
      log(`Sesión OK (user=${user.id})`);

      setStatusText("Preparando subida...");
      log("Llamando a /api/videos/b2-upload...");
      const initRes = await withTimeout(
        fetch("/api/videos/b2-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: videoFile.name }),
        }),
        15000,
        "preparar subida (b2-upload)"
      );
      log(`/api/videos/b2-upload respondió con status ${initRes.status}`);
      const initData = (await initRes.json()) as {
        uploadUrl?: string;
        authorizationToken?: string;
        fileName?: string;
        publicUrl?: string;
        error?: string;
      };
      if (
        !initRes.ok ||
        !initData.uploadUrl ||
        !initData.authorizationToken ||
        !initData.fileName ||
        !initData.publicUrl
      ) {
        throw new Error(initData.error || "No se pudo iniciar la subida del video.");
      }
      log(`uploadUrl recibido: ${initData.uploadUrl}`);

      setStatusText("Calculando huella del archivo...");
      log("Calculando SHA-1 del archivo...");
      const sha1 = await sha1Hex(videoFile);
      log(`SHA-1 listo: ${sha1}`);
      log("Calculando duración del video...");
      const duration_seconds = await withTimeout(getVideoDuration(videoFile), 15000, "calcular duración del video");
      log(`Duración: ${duration_seconds}s`);

      setStatusText("Subiendo video...");
      log(`Subiendo a Backblaze (${formatFileSize(videoFile.size)})...`);
      await uploadToB2WithProgress(
        initData.uploadUrl,
        initData.authorizationToken,
        videoFile,
        initData.fileName,
        sha1,
        (pct) => {
          setProgress(pct);
          if (pct === 0 || pct === 100 || pct % 20 === 0) log(`Progreso subida: ${pct}%`);
        }
      );
      log("Subida a Backblaze completada");

      let thumbnail_url: string | null = null;
      if (thumbFile) {
        setStatusText("Subiendo miniatura...");
        log("Subiendo miniatura...");
        const thumbPath = `thumbnails/${user.id}/${Date.now()}-${thumbFile.name}`;
        const { error: thumbErr } = await supabase.storage
          .from("video-thumbnails")
          .upload(thumbPath, thumbFile, { cacheControl: "3600" });
        if (!thumbErr) {
          thumbnail_url = supabase.storage.from("video-thumbnails").getPublicUrl(thumbPath).data.publicUrl;
          log("Miniatura subida");
        } else {
          log(`Error subiendo miniatura (se ignora): ${thumbErr.message}`);
        }
      }

      setStatusText("Guardando registro...");
      log("Guardando registro en la base de datos...");
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);

      const { error: insertErr } = await supabase.from("videos").insert({
        title: title.trim(),
        description: description.trim() || null,
        video_url: initData.publicUrl,
        thumbnail_url,
        duration_seconds: duration_seconds || null,
        category_id: categoryId || null,
        tags: tagList,
        status: "pending",
        created_by: user.id,
      });
      if (insertErr) throw new Error(insertErr.message);
      log("Registro guardado. ¡Listo!");

      setDone(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido al subir el video";
      log(`ERROR: ${message}`);
      setError(message);
    } finally {
      setIsUploading(false);
      setStatusText(null);
    }
  }

  if (done) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center rounded-2xl"
        style={{ background: "var(--color-surface)", border: "1px solid rgba(74,222,128,0.3)" }}
      >
        <CheckCircle size={32} style={{ color: "var(--color-success)" }} />
        <p className="font-semibold" style={{ color: "var(--color-text)" }}>
          ¡Video subido!
        </p>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Tu video quedó pendiente de aprobación por un administrador. Te avisaremos cuando esté publicado.
        </p>
        <button
          type="button"
          onClick={() => router.push("/videos")}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold mt-2"
          style={{ background: "var(--color-primary)", color: "#000" }}
        >
          Volver a Videos
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field label="Título" required>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={120}
          disabled={isUploading}
          placeholder="Título del video"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={inputStyle}
        />
      </Field>

      <Field label="Descripción">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
          disabled={isUploading}
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
          <Film size={20} style={{ color: videoFile ? "var(--color-primary)" : "var(--color-text-muted)" }} />
          <span
            className="text-sm text-center px-4"
            style={{ color: videoFile ? "var(--color-primary)" : "var(--color-text-muted)" }}
          >
            {videoFile ? `${videoFile.name} · ${formatFileSize(videoFile.size)}` : "Seleccionar video (MP4, MOV, etc.)"}
          </span>
          <input
            type="file"
            accept="video/*"
            className="hidden"
            disabled={isUploading}
            onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </Field>

      <Field label="Miniatura (opcional)">
        <label
          className="flex flex-col items-center justify-center gap-2 w-full py-5 rounded-xl cursor-pointer"
          style={{
            background: "var(--color-surface-elevated)",
            border: `2px dashed ${thumbFile ? "rgba(212,160,23,0.5)" : "var(--color-border)"}`,
          }}
        >
          <ImageIcon size={18} style={{ color: thumbFile ? "var(--color-primary)" : "var(--color-text-muted)" }} />
          <span className="text-sm" style={{ color: thumbFile ? "var(--color-primary)" : "var(--color-text-muted)" }}>
            {thumbFile ? thumbFile.name : "Imagen de portada (opcional)"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={isUploading}
            onChange={(e) => setThumbFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoría">
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
        </Field>

        <Field label="Etiquetas">
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            disabled={isUploading}
            maxLength={200}
            placeholder="Separadas por coma"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={inputStyle}
          />
        </Field>
      </div>

      {isUploading && (
        <div className="flex flex-col gap-2">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: "var(--color-primary)" }}
            />
          </div>
          <p className="text-xs flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
            <Loader2 size={12} className="animate-spin" />
            {statusText} {progress > 0 && progress < 100 ? `(${progress}%)` : ""}
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}

      {debugLines.length > 0 && (
        <pre
          className="text-[10px] leading-relaxed p-3 rounded-xl overflow-x-auto whitespace-pre-wrap break-all"
          style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
        >
          {debugLines.join("\n")}
        </pre>
      )}

      <button
        type="submit"
        disabled={isUploading || !videoFile || !title.trim()}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: "var(--color-primary)", color: "#000" }}
      >
        {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {isUploading ? "Subiendo..." : "Subir video"}
      </button>
    </form>
  );
}

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

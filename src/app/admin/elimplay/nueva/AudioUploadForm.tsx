"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Loader2, CheckCircle, XCircle, X, Music, FileAudio } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface AudioUploadFormProps {
  categories: Array<{ id: string; name: string }>;
  artists: Array<{ id: string; name: string; photo_url: string | null }>;
}

const ARTIST_NEW = "__new__";
const CATEGORY_NEW = "__new__";

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type FileStatus = "pending" | "uploading" | "done" | "error";

interface FileItem {
  id: string;
  file: File;
  title: string;
  status: FileStatus;
  progress: number;
  error?: string;
}

const ACCEPTED_EXTENSIONS = [".mp3", ".m4a", ".wav", ".ogg", ".aac", ".flac", ".opus"];
const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(",");
const MAX_CONCURRENT_UPLOADS = 3;
const MAX_FILE_SIZE_MB = 500;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function isAudioFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    let settled = false;
    const audio = document.createElement("audio");
    const objectUrl = URL.createObjectURL(file);
    const finish = (value: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
      resolve(value);
    };
    const timer = setTimeout(() => finish(0), 15000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => finish(Math.round(audio.duration) || 0);
    audio.onerror = () => finish(0);
    audio.src = objectUrl;
  });
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

async function sha1Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
      else reject(new Error(`Error ${xhr.status} al subir el archivo a Backblaze`));
    };
    xhr.onerror = () => reject(new Error("Error de red al subir el archivo"));
    xhr.send(file);
  });
}

const inputStyle = {
  background: "var(--color-surface-elevated)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
} as const;

export function AudioUploadForm({ categories, artists }: AudioUploadFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<FileItem[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [localCategories, setLocalCategories] = useState(categories);
  const [artistId, setArtistId] = useState("");
  const [newArtistName, setNewArtistName] = useState("");
  const [artistPhoto, setArtistPhoto] = useState<File | null>(null);
  const [tags, setTags] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [debugLines, setDebugLines] = useState<string[]>([]);

  function log(msg: string) {
    const line = `${new Date().toLocaleTimeString()} — ${msg}`;
    console.log("[AudioUpload]", line);
    setDebugLines((prev) => [...prev, line]);
  }

  // Manejo de drag & drop a nivel documento (fase de captura): por defecto el
  // navegador abre el archivo soltado en una pestaña nueva. Capturamos el
  // evento antes de que React/el navegador lo procesen, para garantizar que
  // preventDefault surta efecto y para detectar el drop sobre el dropzone
  // sin depender de los handlers sintéticos de React en el div.
  useEffect(() => {
    function isOverDropzone(e: DragEvent) {
      return dropzoneRef.current?.contains(e.target as Node) ?? false;
    }
    function handleDragOver(e: DragEvent) {
      if (!isOverDropzone(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      if (!isUploading) setIsDragging(true);
    }
    function handleDragLeave(e: DragEvent) {
      if (!dropzoneRef.current?.contains(e.relatedTarget as Node)) {
        setIsDragging(false);
      }
    }
    function handleDrop(e: DragEvent) {
      if (!isOverDropzone(e)) return;
      e.preventDefault();
      setIsDragging(false);
      if (isUploading) return;
      if (!e.dataTransfer || e.dataTransfer.files.length === 0) {
        setFormError(
          "No se detectaron archivos. Arrastra los archivos desde el Explorador de Windows, no desde otra pestaña o ventana del navegador."
        );
        return;
      }
      addFiles(e.dataTransfer.files);
    }
    document.addEventListener("dragover", handleDragOver, true);
    document.addEventListener("dragleave", handleDragLeave, true);
    document.addEventListener("drop", handleDrop, true);
    return () => {
      document.removeEventListener("dragover", handleDragOver, true);
      document.removeEventListener("dragleave", handleDragLeave, true);
      document.removeEventListener("drop", handleDrop, true);
    };
  }, [isUploading]);

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList);
    const wrongFormat = incoming.filter((f) => !isAudioFile(f)).length;
    const tooLarge = incoming.filter((f) => isAudioFile(f) && f.size > MAX_FILE_SIZE_BYTES).length;
    const accepted = incoming.filter((f) => isAudioFile(f) && f.size <= MAX_FILE_SIZE_BYTES);

    if (accepted.length > 0) {
      const newItems: FileItem[] = accepted.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        title: titleFromFilename(file.name),
        status: "pending",
        progress: 0,
      }));
      setItems((prev) => [...prev, ...newItems]);
    }

    const problems: string[] = [];
    if (wrongFormat > 0) {
      problems.push(
        `${wrongFormat} archivo${wrongFormat === 1 ? "" : "s"} con formato no permitido. Formatos aceptados: ${ACCEPTED_EXTENSIONS.join(", ")}`
      );
    }
    if (tooLarge > 0) {
      problems.push(`${tooLarge} archivo${tooLarge === 1 ? "" : "s"} supera el máximo de ${MAX_FILE_SIZE_MB} MB`);
    }
    setFormError(problems.length > 0 ? `Se ignoraron algunos archivos: ${problems.join("; ")}` : null);
  }

  function updateTitle(id: string, title: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, title } : it)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function patchItem(id: string, patch: Partial<FileItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function resolveArtistId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
    if (!artistId) return null;
    if (artistId !== ARTIST_NEW) return artistId;

    const name = newArtistName.trim();
    if (!name) return null;

    const { data: existing } = await supabase
      .from("artists")
      .select("id, photo_url")
      .ilike("name", name)
      .maybeSingle();

    let resolvedId: string;
    let existingPhoto: string | null = null;
    if (existing) {
      resolvedId = existing.id;
      existingPhoto = existing.photo_url;
    } else {
      const { data: created, error } = await supabase
        .from("artists")
        .insert({ name })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      resolvedId = created.id;
    }

    if (artistPhoto && !existingPhoto) {
      const photoPath = `artists/${Date.now()}-${artistPhoto.name}`;
      const { error: photoErr } = await supabase.storage
        .from("audio-tracks")
        .upload(photoPath, artistPhoto, { cacheControl: "3600" });
      if (!photoErr) {
        const photoUrl = supabase.storage.from("audio-tracks").getPublicUrl(photoPath).data.publicUrl;
        await supabase.from("artists").update({ photo_url: photoUrl }).eq("id", resolvedId);
      }
    }

    return resolvedId;
  }

  async function resolveCategoryId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
    if (!categoryId) return null;
    if (categoryId !== CATEGORY_NEW) return categoryId;

    const name = newCategoryName.trim();
    if (!name) return null;

    const { data: existing } = await supabase
      .from("audio_categories")
      .select("id")
      .ilike("name", name)
      .maybeSingle();
    if (existing) return existing.id;

    const baseSlug = slugify(name) || "categoria";
    let slug = baseSlug;
    let suffix = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: slugMatch } = await supabase
        .from("audio_categories")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!slugMatch) break;
      suffix++;
      slug = `${baseSlug}-${suffix}`;
    }

    const { data: created, error } = await supabase
      .from("audio_categories")
      .insert({ name, slug, order_index: localCategories.length })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);

    setLocalCategories((prev) => [...prev, { id: created.id, name: created.name }]);
    return created.id;
  }

  async function uploadOne(
    item: FileItem,
    ctx: {
      singleFile: boolean;
      artistId: string | null;
      categoryId: string | null;
    }
  ) {
    patchItem(item.id, { status: "uploading", progress: 0, error: undefined });
    try {
      log(`[${item.file.name}] Calculando duración...`);
      const duration_seconds = await getAudioDuration(item.file);
      log(`[${item.file.name}] Duración: ${duration_seconds}s`);

      log(`[${item.file.name}] Preparando subida (b2-upload)...`);
      const initRes = await withTimeout(
        fetch("/api/elimplay/b2-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: item.file.name }),
        }),
        15000,
        "preparar subida (b2-upload)"
      );
      log(`[${item.file.name}] b2-upload respondió con status ${initRes.status}`);
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
        throw new Error(initData.error || "No se pudo iniciar la subida del audio.");
      }

      log(`[${item.file.name}] Calculando SHA-1 (${formatFileSize(item.file.size)})...`);
      const sha1 = await sha1Hex(item.file);
      log(`[${item.file.name}] SHA-1 listo`);

      log(`[${item.file.name}] Subiendo a Backblaze...`);
      await uploadToB2WithProgress(
        initData.uploadUrl,
        initData.authorizationToken,
        item.file,
        initData.fileName,
        sha1,
        (pct) => {
          patchItem(item.id, { progress: pct });
          if (pct === 0 || pct === 100 || pct % 20 === 0) log(`[${item.file.name}] Progreso: ${pct}%`);
        }
      );
      log(`[${item.file.name}] Subida a Backblaze completada`);

      const audioUrl = initData.publicUrl;

      const supabase = createClient();

      let cover_url: string | null = null;
      if (ctx.singleFile && coverFile) {
        const coverPath = `covers/${Date.now()}-${coverFile.name}`;
        const { error: coverErr } = await supabase.storage
          .from("audio-tracks")
          .upload(coverPath, coverFile, { cacheControl: "3600" });
        if (!coverErr) {
          cover_url = supabase.storage.from("audio-tracks").getPublicUrl(coverPath).data.publicUrl;
        }
      }

      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);

      log(`[${item.file.name}] Guardando registro en la base de datos...`);
      const { error: insertErr } = await supabase.from("audio_tracks").insert({
        title: item.title.trim() || item.file.name,
        artist_id: ctx.artistId,
        description: null,
        audio_url: audioUrl,
        cover_url,
        duration_seconds: duration_seconds || null,
        category_id: ctx.categoryId,
        tags: tagList,
        is_published: isPublished,
        published_at: isPublished ? new Date().toISOString() : null,
      });
      if (insertErr) throw new Error(insertErr.message);
      log(`[${item.file.name}] Listo`);

      patchItem(item.id, { status: "done", progress: 100 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      log(`[${item.file.name}] ERROR: ${message}`);
      patchItem(item.id, { status: "error", error: message });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0 || isUploading) return;
    setFormError(null);
    setIsUploading(true);
    setDebugLines([]);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setFormError("No se pudo iniciar la subida: sesión inválida.");
      setIsUploading(false);
      return;
    }

    let resolvedArtistId: string | null = null;
    let resolvedCategoryId: string | null = null;
    try {
      resolvedArtistId = await resolveArtistId(supabase);
      resolvedCategoryId = await resolveCategoryId(supabase);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar el artista o la categoría");
      setIsUploading(false);
      return;
    }

    const ctx = {
      singleFile: items.length === 1,
      artistId: resolvedArtistId,
      categoryId: resolvedCategoryId,
    };
    const queue = [...items];
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < queue.length) {
        const current = queue[nextIndex];
        nextIndex++;
        await uploadOne(current, ctx);
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(MAX_CONCURRENT_UPLOADS, queue.length) }, () => worker())
    );

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

  const finishedCount = items.filter((it) => it.status === "done" || it.status === "error").length;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div
        ref={dropzoneRef}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 w-full py-10 rounded-xl cursor-pointer transition-colors"
        style={{
          background: "var(--color-surface-elevated)",
          border: `2px dashed ${
            isDragging ? "var(--color-primary)" : items.length > 0 ? "rgba(212,160,23,0.5)" : "var(--color-border)"
          }`,
        }}
      >
        <Upload size={22} style={{ color: items.length > 0 ? "var(--color-primary)" : "var(--color-text-muted)" }} />
        <span
          className="text-sm text-center px-4"
          style={{ color: items.length > 0 ? "var(--color-primary)" : "var(--color-text-muted)" }}
        >
          {items.length > 0
            ? `${items.length} archivo${items.length === 1 ? "" : "s"} seleccionado${items.length === 1 ? "" : "s"} — arrastra más o haz clic para agregar`
            : "Arrastra audios aquí o haz clic para seleccionar (varios a la vez)"}
        </span>
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Formatos: {ACCEPTED_EXTENSIONS.join(", ")} · máximo {MAX_FILE_SIZE_MB} MB
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          className="hidden"
          disabled={isUploading}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
            >
              <div className="flex items-center gap-3">
                <FileAudio size={16} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
                <div className="flex-1 min-w-0 flex flex-col">
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateTitle(item.id, e.target.value)}
                    disabled={isUploading}
                    className="w-full bg-transparent text-sm outline-none disabled:opacity-70"
                    style={{ color: "var(--color-text)" }}
                  />
                  <span className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                    {item.file.name} · {formatFileSize(item.file.size)}
                  </span>
                </div>
                {item.status === "pending" && !isUploading && (
                  <button type="button" onClick={() => removeItem(item.id)} style={{ color: "var(--color-text-muted)" }}>
                    <X size={15} />
                  </button>
                )}
                {item.status === "uploading" && (
                  <span className="text-xs shrink-0" style={{ color: "var(--color-primary)" }}>
                    {item.progress}%
                  </span>
                )}
                {item.status === "done" && <CheckCircle size={15} className="shrink-0" style={{ color: "var(--color-success)" }} />}
                {item.status === "error" && (
                  <span title={item.error}>
                    <XCircle size={15} className="shrink-0" style={{ color: "var(--color-destructive)" }} />
                  </span>
                )}
              </div>
              {(item.status === "uploading" || item.status === "done") && (
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${item.progress}%`,
                      background: item.status === "done" ? "var(--color-success)" : "var(--color-primary)",
                    }}
                  />
                </div>
              )}
              {item.status === "error" && item.error && (
                <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
                  {item.error}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {items.length === 1 && (
        <Field label="Portada (opcional)">
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
              disabled={isUploading}
              onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </Field>
      )}

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
            {localCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value={CATEGORY_NEW}>+ Nueva categoría...</option>
          </select>
        </Field>

        <Field label="Artista / Intérprete">
          <select
            value={artistId}
            onChange={(e) => setArtistId(e.target.value)}
            disabled={isUploading}
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
        </Field>
      </div>

      {categoryId === CATEGORY_NEW && (
        <Field label="Nombre de la nueva categoría" required>
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            disabled={isUploading}
            maxLength={60}
            placeholder="Ej: Testimonios"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={inputStyle}
          />
        </Field>
      )}

      {artistId === ARTIST_NEW && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre del nuevo artista" required>
            <input
              type="text"
              value={newArtistName}
              onChange={(e) => setNewArtistName(e.target.value)}
              disabled={isUploading}
              maxLength={120}
              placeholder="Ej: Ana Cubillo"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={inputStyle}
            />
          </Field>
          <Field label="Foto del artista (opcional)">
            <input
              type="file"
              accept="image/*"
              disabled={isUploading}
              onChange={(e) => setArtistPhoto(e.target.files?.[0] ?? null)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none file:mr-2 file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-semibold"
              style={inputStyle}
            />
          </Field>
        </div>
      )}

      <Field label="Etiquetas">
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
      </Field>

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

      {formError && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
          {formError}
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
        disabled={isUploading || items.length === 0}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: "var(--color-primary)", color: "#000" }}
      >
        {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {isUploading
          ? `Subiendo ${finishedCount}/${items.length}...`
          : `Subir ${items.length || ""} audio${items.length === 1 ? "" : "s"}`.trim()}
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

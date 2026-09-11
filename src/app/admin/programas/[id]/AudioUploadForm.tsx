"use client";

import { useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { createFreshClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface AudioUploadFormProps {
  programaId: string;
  nextOrden: number;
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

export function AudioUploadForm({ programaId, nextOrden }: AudioUploadFormProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !titulo.trim() || uploading) return;

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const initRes = await withTimeout(
        fetch("/api/programas/b2-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name }),
        }),
        15000,
        "preparar subida"
      );
      const initData = (await initRes.json()) as {
        uploadUrl?: string;
        authorizationToken?: string;
        fileName?: string;
        publicUrl?: string;
        error?: string;
      };
      if (!initRes.ok || !initData.uploadUrl || !initData.authorizationToken || !initData.fileName || !initData.publicUrl) {
        throw new Error(initData.error || "No se pudo iniciar la subida del audio.");
      }

      const sha1 = await sha1Hex(file);

      await uploadToB2WithProgress(
        initData.uploadUrl,
        initData.authorizationToken,
        file,
        initData.fileName,
        sha1,
        setProgress
      );

      const supabase = createFreshClient();
      const { error: insertErr } = await withTimeout(
        Promise.resolve(
          supabase.from("programa_audios").insert({
            programa_id: programaId,
            titulo: titulo.trim(),
            audio_url: initData.publicUrl,
            orden: nextOrden,
          })
        ),
        15000,
        "guardar registro del audio"
      );
      if (insertErr) throw new Error(insertErr.message);

      setFile(null);
      setTitulo("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido al subir el audio.");
    } finally {
      setUploading(false);
    }
  }

  const inputStyle = {
    background: "var(--color-surface-elevated)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
  } as const;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 p-5 rounded-2xl"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
        Subir audio
      </h2>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
          Título
        </label>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          required
          placeholder="Ej: Intro 1"
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          style={inputStyle}
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
          Archivo de audio
        </label>
        <input
          type="file"
          accept=".mp3,.m4a,.wav,.ogg,.aac"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
          className="w-full text-sm"
          style={{ color: "var(--color-text)" }}
        />
      </div>

      {uploading && (
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-surface-elevated)" }}>
          <div className="h-full transition-all" style={{ width: `${progress}%`, background: "var(--color-primary)" }} />
        </div>
      )}

      {error && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={uploading || !file || !titulo.trim()}
        className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
        style={{ background: "var(--color-primary)", color: "#000", opacity: uploading ? 0.7 : 1 }}
      >
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {uploading ? `Subiendo… ${progress}%` : "Subir"}
      </button>
    </form>
  );
}

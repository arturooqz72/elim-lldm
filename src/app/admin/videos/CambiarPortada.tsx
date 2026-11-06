"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Loader2, Save, X } from "lucide-react";
import { createFreshClient } from "@/lib/supabase/client";
import { EscenaPortadaPicker } from "@/components/videos/EscenaPortadaPicker";
import { PortadaPreview } from "@/components/videos/PortadaPreview";
import { formatTime } from "@/lib/audio-recording";

// Los mismos límites que el bucket video-thumbnails (0081).
const THUMB_MAX_BYTES = 5 * 1024 * 1024;
const THUMB_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface CambiarPortadaProps {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  saveAction: (id: string, thumbnailUrl: string) => Promise<{ error: string | null }>;
}

export function CambiarPortada({ id, videoUrl, thumbnailUrl, saveAction }: CambiarPortadaProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [escenaSegundos, setEscenaSegundos] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imagenSubida = thumbFile !== null && escenaSegundos === null;

  function close() {
    setOpen(false);
    setThumbFile(null);
    setEscenaSegundos(null);
    setError(null);
  }

  async function guardar() {
    if (!thumbFile || saving) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createFreshClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error("Sesión inválida. Inicia sesión de nuevo.");

      const safeName = thumbFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `thumbnails/${user.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("video-thumbnails")
        .upload(path, thumbFile, { cacheControl: "3600", contentType: thumbFile.type });
      if (upErr) throw new Error(upErr.message);

      const url = supabase.storage.from("video-thumbnails").getPublicUrl(path).data.publicUrl;
      const result = await saveAction(id, url);
      if (result.error) throw new Error(result.error);

      close();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la portada.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg text-xs font-medium"
        style={{
          background: "var(--color-surface-elevated)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
        }}
      >
        <ImageIcon size={14} />
        {thumbnailUrl ? "Cambiar portada" : "Poner portada"}
      </button>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-xl"
      style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Portada del video
        </span>
        <button type="button" onClick={close} aria-label="Cerrar" style={{ color: "var(--color-text-muted)" }}>
          <X size={16} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt="Portada actual"
            className="w-28 aspect-video object-cover rounded-lg"
            style={{ border: "1px solid var(--color-border)" }}
          />
        ) : (
          <div
            className="w-28 aspect-video rounded-lg flex items-center justify-center text-xs"
            style={{ border: "1px dashed var(--color-border)", color: "var(--color-text-muted)" }}
          >
            Sin portada
          </div>
        )}
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Portada actual
        </span>
      </div>

      <EscenaPortadaPicker
        source={videoUrl}
        disabled={saving}
        onPick={(file, seconds) => {
          setError(null);
          setThumbFile(file);
          setEscenaSegundos(seconds);
        }}
      />

      <label
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl cursor-pointer text-sm"
        style={{
          border: `2px dashed ${imagenSubida ? "rgba(212,160,23,0.5)" : "var(--color-border)"}`,
          color: imagenSubida ? "var(--color-primary)" : "var(--color-text-muted)",
        }}
      >
        <ImageIcon size={16} />
        {imagenSubida && thumbFile ? thumbFile.name : "Subir una imagen como portada"}
        <input
          type="file"
          accept={THUMB_TYPES.join(",")}
          className="hidden"
          disabled={saving}
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = "";
            setEscenaSegundos(null);
            if (file && !THUMB_TYPES.includes(file.type)) {
              setError("La portada debe ser JPG, PNG, WebP o GIF");
              setThumbFile(null);
            } else if (file && file.size > THUMB_MAX_BYTES) {
              setError("La portada debe pesar menos de 5 MB");
              setThumbFile(null);
            } else {
              setError(null);
              setThumbFile(file);
            }
          }}
        />
      </label>

      <PortadaPreview
        file={thumbFile}
        label={escenaSegundos !== null ? `nueva, escena en ${formatTime(escenaSegundos)}` : `nueva, ${thumbFile?.name ?? ""}`}
      />

      {error && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={!thumbFile || saving}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: "var(--color-primary)", color: "#000" }}
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? "Guardando…" : "Guardar portada"}
      </button>
    </div>
  );
}

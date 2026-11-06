# Escena del video como portada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al subir un video (público y Archivo admin), poder escoger una escena del propio video como portada, además de subir una imagen.

**Architecture:** Un componente cliente `EscenaPortadaPicker` previsualiza el video local (`URL.createObjectURL`), deja recorrerlo con una barra y captura el fotograma en un `<canvas>` → JPEG `File`. Los formularios siguen con su único estado `thumbFile`; el picker lo llena. Un componente `PortadaPreview` muestra la portada activa. La subida de la portada no cambia.

**Tech Stack:** Next.js 15 App Router, React 19 client components, TypeScript strict, lucide-react. Sin dependencias nuevas.

Spec: `docs/superpowers/specs/2026-11-05-escena-como-portada-design.md`

**Pruebas:** el repo no tiene runner de tests (solo `next build`). La verificación es `npx tsc --noEmit`, `npm run build` y prueba manual en navegador (Task 4).

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/components/videos/EscenaPortadaPicker.tsx` | Crear | Vista previa + barra + captura de escena → `File` JPEG |
| `src/components/videos/PortadaPreview.tsx` | Crear | Miniatura de la portada activa (imagen o escena) |
| `src/components/videos/VideoUploadForm.tsx` | Modificar | Usar picker + preview; etiqueta "Escena en mm:ss" |
| `src/app/admin/archivo/nueva/ArchiveUploadForm.tsx` | Modificar | Igual; además `contentType` en la subida de la miniatura |

`formatTime(seconds)` ya existe en `src/lib/audio-recording.ts` (devuelve `mm:ss`); se reutiliza.

---

### Task 1: Componentes `PortadaPreview` y `EscenaPortadaPicker`

**Files:**
- Create: `src/components/videos/PortadaPreview.tsx`
- Create: `src/components/videos/EscenaPortadaPicker.tsx`

- [ ] **Step 1: Crear `PortadaPreview.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

interface PortadaPreviewProps {
  file: File | null;
  label: string;
}

export function PortadaPreview({ file, label }: PortadaPreviewProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return null;

  return (
    <div className="flex items-center gap-3 mt-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Portada elegida"
        className="w-28 aspect-video object-cover rounded-lg"
        style={{ border: "1px solid var(--color-border)" }}
      />
      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        Portada: {label}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Crear `EscenaPortadaPicker.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { formatTime } from "@/lib/audio-recording";

const MAX_WIDTH = 1280;
const JPEG_QUALITY = 0.85;

interface EscenaPortadaPickerProps {
  videoFile: File | null;
  onPick: (file: File, seconds: number) => void;
  disabled?: boolean;
}

export function EscenaPortadaPicker({ videoFile, onPick, disabled }: EscenaPortadaPickerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [unsupported, setUnsupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUnsupported(false);
    setError(null);
    setDuration(0);
    setTime(0);
    if (!videoFile) {
      setSrc(null);
      return;
    }
    const objectUrl = URL.createObjectURL(videoFile);
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [videoFile]);

  if (!videoFile || !src) return null;

  if (unsupported) {
    return (
      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        Este formato no se puede previsualizar aquí; puedes subir una imagen como portada.
      </p>
    );
  }

  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (!video) return;
    const d = Number.isFinite(video.duration) ? video.duration : 0;
    setDuration(d);
    // iOS/Safari no pinta el primer fotograma hasta hacer seek.
    video.currentTime = Math.min(0.1, d);
  }

  function handleSlider(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = value;
    setTime(value);
  }

  function capture() {
    const video = videoRef.current;
    setError(null);
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("No se pudo capturar la escena, intenta otra vez.");
      return;
    }
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("No se pudo capturar la escena, intenta otra vez.");
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const seconds = video.currentTime;
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("No se pudo capturar la escena, intenta otra vez.");
          return;
        }
        const file = new File([blob], `escena-${Math.floor(seconds)}s.jpg`, { type: "image/jpeg" });
        onPick(file, seconds);
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <video
        ref={videoRef}
        src={src}
        controls
        muted
        playsInline
        preload="metadata"
        className="w-full rounded-xl bg-black max-h-72"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onError={() => setUnsupported(true)}
      />
      {duration > 0 && (
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={time}
            disabled={disabled}
            onChange={(e) => handleSlider(Number(e.target.value))}
            className="flex-1 accent-[#D4A017]"
            aria-label="Elegir escena del video"
          />
          <span className="text-xs tabular-nums" style={{ color: "var(--color-text-muted)" }}>
            {formatTime(time)} / {formatTime(duration)}
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={capture}
        disabled={disabled || duration === 0}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-primary)", color: "var(--color-primary)" }}
      >
        <Camera size={16} />
        Usar esta escena como portada
      </button>
      {error && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/videos/PortadaPreview.tsx src/components/videos/EscenaPortadaPicker.tsx
git commit -m "Componentes para escoger una escena del video como portada"
```

---

### Task 2: Integrar en `VideoUploadForm`

**Files:**
- Modify: `src/components/videos/VideoUploadForm.tsx`

- [ ] **Step 1: Imports y estado**

Agregar a los imports:

```tsx
import { EscenaPortadaPicker } from "@/components/videos/EscenaPortadaPicker";
import { PortadaPreview } from "@/components/videos/PortadaPreview";
import { formatTime } from "@/lib/audio-recording";
```

Debajo de `const [thumbFile, setThumbFile] = useState<File | null>(null);` agregar:

```tsx
  // Segundo del video usado como portada; null si la portada es una imagen subida.
  const [escenaSegundos, setEscenaSegundos] = useState<number | null>(null);
```

- [ ] **Step 2: Al cambiar de video, descartar la escena del video anterior**

Reemplazar en el input de video:

```tsx
            onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
```

por:

```tsx
            onChange={(e) => {
              setVideoFile(e.target.files?.[0] ?? null);
              if (escenaSegundos !== null) {
                setThumbFile(null);
                setEscenaSegundos(null);
              }
            }}
```

- [ ] **Step 3: Picker + preview en el campo de miniatura**

Reemplazar `<Field label="Miniatura (opcional)">` por `<Field label="Portada (opcional)">` y, justo después de esa apertura, insertar:

```tsx
        <EscenaPortadaPicker
          videoFile={videoFile}
          disabled={isUploading}
          onPick={(file, seconds) => {
            setError(null);
            setThumbFile(file);
            setEscenaSegundos(seconds);
          }}
        />
```

Cambiar el texto del recuadro de imagen:

```tsx
            {thumbFile ? thumbFile.name : "Imagen de portada (opcional)"}
```

por:

```tsx
            {thumbFile && escenaSegundos === null ? thumbFile.name : "Subir una imagen como portada"}
```

En el `onChange` del input de imagen, en cada rama donde se llama `setThumbFile(...)` agregar `setEscenaSegundos(null);` (las tres ramas).

Justo antes del cierre `</Field>` de ese campo, agregar:

```tsx
        <PortadaPreview
          file={thumbFile}
          label={escenaSegundos !== null ? `escena en ${formatTime(escenaSegundos)}` : thumbFile?.name ?? ""}
        />
```

Nota: `Field` acepta varios hijos pero no les da espacio; envolver todo el contenido del campo Portada (picker, recuadro de imagen y preview) en `<div className="flex flex-col gap-3">…</div>`. Hacer lo mismo en Task 3.

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/components/videos/VideoUploadForm.tsx
git commit -m "Subir video: escoger una escena como portada"
```

---

### Task 3: Integrar en `ArchiveUploadForm`

**Files:**
- Modify: `src/app/admin/archivo/nueva/ArchiveUploadForm.tsx`

- [ ] **Step 1: Imports y estado**

```tsx
import { EscenaPortadaPicker } from "@/components/videos/EscenaPortadaPicker";
import { PortadaPreview } from "@/components/videos/PortadaPreview";
import { formatTime } from "@/lib/audio-recording";
```

Debajo de `const [thumbFile, setThumbFile] = useState<File | null>(null);`:

```tsx
  const [escenaSegundos, setEscenaSegundos] = useState<number | null>(null);
```

- [ ] **Step 2: Cambio de video descarta la escena**

Reemplazar `onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}` por:

```tsx
            onChange={(e) => {
              setVideoFile(e.target.files?.[0] ?? null);
              if (escenaSegundos !== null) {
                setThumbFile(null);
                setEscenaSegundos(null);
              }
            }}
```

- [ ] **Step 3: Picker, texto, imagen y preview**

Reemplazar `<Field label="Miniatura (thumbnail)">` por `<Field label="Portada">` e insertar después:

```tsx
        <EscenaPortadaPicker
          videoFile={videoFile}
          disabled={isPending}
          onPick={(file, seconds) => {
            setThumbFile(file);
            setEscenaSegundos(seconds);
          }}
        />
```

Texto del recuadro: `{thumbFile && escenaSegundos === null ? thumbFile.name : "Subir una imagen como portada"}`.

Input de imagen: `onChange={(e) => { setThumbFile(e.target.files?.[0] ?? null); setEscenaSegundos(null); }}`.

Antes del `</Field>`:

```tsx
        <PortadaPreview
          file={thumbFile}
          label={escenaSegundos !== null ? `escena en ${formatTime(escenaSegundos)}` : thumbFile?.name ?? ""}
        />
```

- [ ] **Step 4: `contentType` en la subida de la miniatura**

Reemplazar:

```tsx
          .upload(thumbPath, thumbFile, { cacheControl: "3600" });
```

por:

```tsx
          .upload(thumbPath, thumbFile, { cacheControl: "3600", contentType: thumbFile.type });
```

- [ ] **Step 5: Verificar tipos y commit**

Run: `npx tsc --noEmit` → sin errores.

```bash
git add src/app/admin/archivo/nueva/ArchiveUploadForm.tsx
git commit -m "Archivo: escoger una escena del video como portada"
```

---

### Task 4: Verificación

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: build completo sin errores de tipos ni de lint.

- [ ] **Step 2: Prueba manual (`npm run dev`, escritorio y 375 px de ancho)**

En `/videos/subir` y en `/admin/archivo/nueva`:
1. Elegir un `.mp4` → aparece la vista previa y la barra con `00:00 / mm:ss`.
2. Mover la barra → el video muestra esa escena.
3. "Usar esta escena como portada" → aparece la miniatura con "Portada: escena en mm:ss".
4. Mover a otra escena y capturar → la miniatura cambia.
5. Subir una imagen → la miniatura muestra la imagen y su nombre; capturar escena de nuevo → vuelve a la escena.
6. Cambiar de video → la portada de escena se borra.
7. Subir (con un video corto) → la tarjeta del video muestra la escena como portada.
8. Elegir un video que el navegador no reproduce → aparece el aviso y la subida sigue funcionando.

- [ ] **Step 3: Push (solo con aprobación del usuario)**

```bash
git push origin master
```

# Saludo en audio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any visitor record a short audio greeting from their browser at `/saludo` and send it, so the admin can review, listen, and download each one from `/admin/saludos` to upload to the radio.

**Architecture:** A public page (`/saludo`) hosts a client component that records audio via `MediaRecorder`, uploads the blob straight to a private Supabase Storage bucket with the anon key, and inserts a metadata row (insert-only RLS, no client-side read — same pattern as the existing `sugerencias`/Contáctanos feature). A new admin page reads the table with the service-role client (bypasses RLS) and generates short-lived signed URLs to play/download each audio.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Tailwind (inline `var(--color-*)` tokens, no new deps), `@supabase/supabase-js` browser client, Supabase Storage, native `MediaRecorder`/`getUserMedia` Web APIs, `lucide-react` icons.

---

## Spec

Full design: `docs/superpowers/specs/2026-08-10-saludo-audio-design.md`. Key decisions already locked in there — don't relitigate them here:
- Dedicated page `/saludo` (not inside `/contacto`).
- Only field collected: `nombre`.
- Hard cap: 60 seconds, auto-stop.
- Native browser format (WebM/OGG/MP4 — whatever `MediaRecorder` produces), no server-side conversion.
- Admin review page `/admin/saludos`, same pattern as `/admin/archivo`.
- Storage bucket is **private**; admin access only via signed URLs generated server-side.

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/0012_saludos.sql` (create) | `saludos` table, RLS, private Storage bucket + insert policy |
| `src/types/index.ts` (modify) | `Saludo` domain type |
| `src/components/saludo/SaludoRecorder.tsx` (create) | Client component: nombre input, record/stop, preview, upload+insert, all UI states |
| `src/app/(public)/saludo/page.tsx` (create) | Public page shell (metadata, hero, wraps `SaludoRecorder`) |
| `src/components/layout/PublicHeader.tsx` (modify) | Add "Saludo en audio" nav link |
| `src/components/layout/PublicFooter.tsx` (modify) | Add "Saludo en audio" footer link |
| `src/app/admin/saludos/page.tsx` (create) | Admin listing: service-role read + signed URLs + player/download |
| `src/components/layout/AdminSidebar.tsx` (modify) | Add "Saludos" admin nav item |

**Note on testing:** this codebase has no automated test suite (no `pnpm test` script, no test files anywhere — see `ContactForm.tsx` for the precedent). Each task's "test" step is `pnpm exec tsc --noEmit` (the project's actual quality gate, confirmed working in `C:\Users\arturooq\elim-lldm`) plus a manual browser verification at the end, matching how the Contáctanos feature was built and verified in this same session.

---

### Task 1: Database migration — `saludos` table + private Storage bucket

**Files:**
- Create: `supabase/migrations/0012_saludos.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- ============================================================
-- Elim LLDM — Saludos en audio (grabación pública en /saludo)
-- Ejecutar manualmente en Supabase SQL Editor
--
-- Tabla + bucket de Storage para que cualquier visitante grabe un
-- saludo desde el navegador y lo envíe. Igual que `sugerencias`:
-- solo INSERT público, sin policy de SELECT para anon/authenticated
-- — el admin lee todo desde /admin/saludos con el service role
-- client (bypassea RLS) y genera URLs firmadas temporales para
-- escuchar/descargar cada audio.
-- ============================================================

CREATE TABLE saludos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL CHECK (char_length(trim(nombre)) BETWEEN 1 AND 120),
  audio_path TEXT NOT NULL,
  duration_seconds INT NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saludos_created_at ON saludos(created_at DESC);

ALTER TABLE saludos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saludos_insert_public" ON saludos FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

GRANT INSERT ON saludos TO anon, authenticated;

-- Bucket privado para los archivos de audio
INSERT INTO storage.buckets (id, name, public)
VALUES ('saludos', 'saludos', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Solo INSERT público en el bucket — sin SELECT para anon/authenticated.
-- storage.objects ya tiene RLS habilitado por defecto en Supabase.
CREATE POLICY "saludos_storage_insert_public" ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'saludos');
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0012_saludos.sql
git commit -m "Add saludos table and private storage bucket migration"
```

**Do not run this migration yet** — it gets executed against the live Supabase project in Task 9, together with (or right before) the manual verification pass, the same way `0011_sugerencias.sql` was applied earlier in this session.

---

### Task 2: `Saludo` domain type

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add the type**

Find the `Sugerencia` interface (added earlier in this session) and add `Saludo` right after it:

```typescript
export interface Sugerencia {
  id: string;
  nombre: string;
  correo: string;
  mensaje: string;
  created_at: string;
}

export interface Saludo {
  id: string;
  nombre: string;
  audio_path: string;
  duration_seconds: number;
  created_at: string;
}

```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "Add Saludo domain type"
```

---

### Task 3: `SaludoRecorder` client component

**Files:**
- Create: `src/components/saludo/SaludoRecorder.tsx`

This is the core of the feature. States: `idle → recording → recorded → submitting → success`, with `errorMsg` shown independently of state whenever non-empty (so a failed upload can show an error while staying in `recorded` state, letting the user retry without re-recording).

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Send, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const NOMBRE_MAX = 120;
const MAX_SECONDS = 60;

type Status = "idle" | "recording" | "recorded" | "submitting" | "success";

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm", "audio/ogg", "audio/mp4"];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "m4a";
  return "webm";
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function SaludoRecorder() {
  const [nombre, setNombre] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [touched, setTouched] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeTypeRef = useRef<string>("");

  const nombreOk = nombre.trim().length > 0 && nombre.trim().length <= NOMBRE_MAX;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function startRecording() {
    setTouched(true);
    if (!nombreOk) {
      setErrorMsg("Escribe tu nombre antes de grabar.");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErrorMsg("Tu navegador no soporta grabación de audio. Prueba con Chrome, Edge o Firefox actualizados.");
      return;
    }

    setErrorMsg("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorMsg("No pudimos acceder a tu micrófono. Revisa los permisos del navegador para este sitio y vuelve a intentar.");
      return;
    }

    const mimeType = pickMimeType();
    mimeTypeRef.current = mimeType;
    streamRef.current = stream;
    chunksRef.current = [];

    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" });
      audioBlobRef.current = blob;
      setAudioUrl(URL.createObjectURL(blob));
      setStatus("recorded");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    recorder.start();
    setElapsed(0);
    setStatus("recording");

    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= MAX_SECONDS) stopRecording();
        return next;
      });
    }, 1000);
  }

  function stopRecording() {
    stopTimer();
    mediaRecorderRef.current?.stop();
  }

  function discardRecording() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioBlobRef.current = null;
    setAudioUrl(null);
    setElapsed(0);
    setErrorMsg("");
    setStatus("idle");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const blob = audioBlobRef.current;
    if (!blob) return;

    setStatus("submitting");
    setErrorMsg("");

    const ext = extensionForMimeType(mimeTypeRef.current);
    const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage.from("saludos").upload(path, blob, {
      contentType: mimeTypeRef.current || "audio/webm",
    });

    if (uploadError) {
      setStatus("recorded");
      setErrorMsg("No pudimos subir tu audio. Intenta de nuevo en unos minutos.");
      return;
    }

    const { error: insertError } = await supabase.from("saludos").insert({
      nombre: nombre.trim(),
      audio_path: path,
      duration_seconds: elapsed,
    });

    if (insertError) {
      setStatus("recorded");
      setErrorMsg("No pudimos guardar tu saludo. Intenta de nuevo en unos minutos.");
      return;
    }

    setStatus("success");
  }

  function recordAnother() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioBlobRef.current = null;
    setAudioUrl(null);
    setElapsed(0);
    setNombre("");
    setTouched(false);
    setErrorMsg("");
    setStatus("idle");
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--color-surface-elevated)",
    border: `1px solid ${touched && !nombreOk ? "var(--color-destructive)" : "var(--color-border)"}`,
    color: "var(--color-text)",
  };

  if (status === "success") {
    return (
      <div
        className="rounded-2xl p-8 flex flex-col items-center text-center gap-3"
        style={{
          background: "var(--color-surface)",
          border: "1px solid rgba(74,222,128,0.3)",
        }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: "rgba(74,222,128,0.12)" }}
        >
          <CheckCircle2 size={24} style={{ color: "var(--color-success)" }} />
        </div>
        <p className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
          ¡Gracias por tu saludo!
        </p>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Lo recibimos y podría sonar pronto en la radio.
        </p>
        <button
          onClick={recordAnother}
          className="mt-2 text-sm font-medium"
          style={{ color: "var(--color-primary)" }}
        >
          Grabar otro saludo
        </button>
      </div>
    );
  }

  const recording = status === "recording";
  const submitting = status === "submitting";
  const hasRecording = status === "recorded" || submitting;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
          Nombre
          <span style={{ color: "var(--color-live)" }}> *</span>
        </label>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          disabled={recording || hasRecording}
          maxLength={NOMBRE_MAX}
          placeholder="Tu nombre"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
          style={inputStyle}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-primary)"; }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = touched && !nombreOk ? "var(--color-destructive)" : "var(--color-border)";
          }}
        />
      </div>

      <div
        className="flex flex-col items-center gap-4 py-8 rounded-2xl"
        style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
      >
        {status === "idle" && (
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            <Mic size={18} />
            Grabar saludo
          </button>
        )}

        {recording && (
          <>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: "var(--color-live)" }} />
              <span className="text-2xl font-mono" style={{ color: "var(--color-text)" }}>
                {formatTime(elapsed)} / {formatTime(MAX_SECONDS)}
              </span>
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "var(--color-destructive)", color: "#000" }}
            >
              <Square size={16} />
              Detener
            </button>
          </>
        )}

        {hasRecording && audioUrl && (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={audioUrl} className="w-full" />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={discardRecording}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-muted)",
                }}
              >
                <RotateCcw size={15} />
                Grabar de nuevo
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--color-primary)", color: "#000" }}
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {submitting ? "Enviando…" : "Enviar saludo"}
              </button>
            </div>
          </>
        )}
      </div>

      {errorMsg && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
          style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.3)",
            color: "var(--color-destructive)",
          }}
        >
          <AlertCircle size={16} className="shrink-0" />
          {errorMsg}
        </div>
      )}
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/saludo/SaludoRecorder.tsx
git commit -m "Add SaludoRecorder client component"
```

---

### Task 4: `/saludo` page shell

**Files:**
- Create: `src/app/(public)/saludo/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { AudioLines } from "lucide-react";
import type { Metadata } from "next";
import { SaludoRecorder } from "@/components/saludo/SaludoRecorder";

export const metadata: Metadata = {
  title: "Deja tu saludo — Elim LLDM",
  description: "Graba un saludo en audio desde tu navegador para que lo escuchemos en Elim LLDM Radio.",
};

export default function SaludoPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
            style={{
              background: "rgba(212,160,23,0.1)",
              border: "1px solid rgba(212,160,23,0.2)",
            }}
          >
            <AudioLines size={24} style={{ color: "var(--color-primary)" }} />
          </div>
          <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--color-text)" }}>
            Deja tu saludo
          </h1>
          <p className="text-base" style={{ color: "var(--color-text-muted)" }}>
            Graba un saludo en audio (hasta 60 segundos) y podría sonar en Elim LLDM Radio.
          </p>
        </div>

        <div
          className="rounded-2xl p-6 sm:p-8"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <SaludoRecorder />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(public)/saludo/page.tsx"
git commit -m "Add /saludo public page"
```

---

### Task 5: Nav + footer links

**Files:**
- Modify: `src/components/layout/PublicHeader.tsx`
- Modify: `src/components/layout/PublicFooter.tsx`

- [ ] **Step 1: Add the icon import and nav entry in `PublicHeader.tsx`**

Change the icon import line:

```typescript
import { Menu, X, Radio, Mic, Gamepad2, Archive, Sparkles, Music, Video, Bot, LogIn, LogOut, ChevronDown, UserCircle, ShieldCheck, Trophy, Mail, AudioLines } from "lucide-react";
```

Change the `NAV_LINKS` array (add the new entry after Contáctanos):

```typescript
const NAV_LINKS = [
  { href: "/radio", label: "Radio", icon: Radio },
  { href: "/platikas", label: "Estudio en Vivo", icon: Mic },
  { href: "/juegos", label: "Juegos", icon: Gamepad2 },
  { href: "/trivia", label: "Trivia en vivo", icon: Sparkles },
  { href: "/arena", label: "Elim Arena", icon: Trophy },
  { href: "/archivo", label: "Archivo", icon: Archive },
  { href: "/elimplay", label: "ElimPlay", icon: Music },
  { href: "/videos", label: "Videos", icon: Video },
  { href: "/elim-ia", label: "Elim IA", icon: Bot },
  { href: "/contacto", label: "Contáctanos", icon: Mail },
  { href: "/saludo", label: "Saludo en audio", icon: AudioLines },
];
```

- [ ] **Step 2: Add the footer link in `PublicFooter.tsx`**

```tsx
        <nav className="flex items-center gap-6">
          {[
            { href: "/radio", label: "Radio" },
            { href: "/platikas", label: "Estudio en Vivo" },
            { href: "/juegos", label: "Juegos" },
            { href: "/archivo", label: "Archivo" },
            { href: "/contacto", label: "Contáctanos" },
            { href: "/saludo", label: "Saludo en audio" },
          ].map(({ href, label }) => (
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/PublicHeader.tsx src/components/layout/PublicFooter.tsx
git commit -m "Add Saludo en audio link to public nav and footer"
```

---

### Task 6: `/admin/saludos` page

**Files:**
- Create: `src/app/admin/saludos/page.tsx`

Cross-origin note: Supabase signed Storage URLs live on a different origin than the app, so the HTML `download` attribute on the `<a>` tag is not guaranteed to force a file download in every browser (browsers only guarantee that behavior for same-origin links). It's kept anyway since Chrome/Edge honor it in practice for Supabase Storage URLs; `target="_blank"` is added as a fallback so if a browser ignores `download`, the audio opens in a new tab instead of navigating away from the admin panel, and the admin can still save it from there.

- [ ] **Step 1: Write the page**

```tsx
import { createServiceClient, getProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Mic, Download } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Profile, Saludo } from "@/types";

export const metadata = { title: "Saludos — Admin" };

const SIGNED_URL_TTL_SECONDS = 3600;

export default async function AdminSaludosPage() {
  const profile = (await getProfile()) as Profile | null;
  if (!profile || profile.role !== "admin") redirect("/");

  const service = await createServiceClient();
  const { data: saludos } = await service
    .from("saludos")
    .select("id, nombre, audio_path, duration_seconds, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const items = (saludos ?? []) as Saludo[];

  const withUrls = await Promise.all(
    items.map(async (item) => {
      const { data } = await service.storage
        .from("saludos")
        .createSignedUrl(item.audio_path, SIGNED_URL_TTL_SECONDS);
      return { ...item, signedUrl: data?.signedUrl ?? null };
    })
  );

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8" style={{ color: "var(--color-text)" }}>
        Saludos
      </h1>

      {withUrls.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-2xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Mic size={36} className="mb-3" style={{ color: "var(--color-text-muted)" }} />
          <p style={{ color: "var(--color-text-muted)" }}>Todavía no hay saludos.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {withUrls.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 rounded-2xl"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div className="min-w-0 sm:w-48 shrink-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                  {item.nombre}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {formatDate(item.created_at).split(",")[0]} · {item.duration_seconds}s
                </p>
              </div>

              {item.signedUrl ? (
                <>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls src={item.signedUrl} className="flex-1 min-w-0 h-9" />
                  <a
                    href={item.signedUrl}
                    download={`saludo-${item.nombre}.${item.audio_path.split(".").pop()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shrink-0"
                    style={{ background: "var(--color-primary)", color: "#000" }}
                  >
                    <Download size={13} />
                    Descargar
                  </a>
                </>
              ) : (
                <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
                  No se pudo generar el link de audio.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/saludos/page.tsx
git commit -m "Add /admin/saludos review page"
```

---

### Task 7: Admin sidebar link

**Files:**
- Modify: `src/components/layout/AdminSidebar.tsx`

- [ ] **Step 1: Add the icon import**

```typescript
import {
  LayoutDashboard,
  Users,
  Mic,
  BookOpen,
  Gamepad2,
  Sparkles,
  Archive,
  Folder,
  Music,
  Video,
  Bot,
  AudioLines,
  ChevronRight,
  LogOut,
} from "lucide-react";
```

- [ ] **Step 2: Add the nav entry**

```typescript
const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/platikas", label: "Estudio en Vivo", icon: Mic },
  { href: "/admin/question-sets", label: "Banco de preguntas", icon: BookOpen },
  { href: "/admin/juegos", label: "Juegos", icon: Gamepad2 },
  { href: "/admin/trivia", label: "Salas de Trivia", icon: Sparkles },
  { href: "/admin/archivo", label: "Archivo", icon: Archive },
  { href: "/admin/categorias", label: "Categorías", icon: Folder },
  { href: "/admin/elimplay", label: "ElimPlay", icon: Music },
  { href: "/admin/videos", label: "Videos", icon: Video },
  { href: "/admin/elim-ia", label: "Elim IA", icon: Bot },
  { href: "/admin/saludos", label: "Saludos", icon: AudioLines },
];
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/AdminSidebar.tsx
git commit -m "Add Saludos link to admin sidebar"
```

---

### Task 8: Full project typecheck + manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0. (Confirms nothing in earlier tasks broke another file.)

- [ ] **Step 2: Confirm dev server is running**

The dev server from earlier in this session should still be up at `http://localhost:3000`. If not:

Run: `pnpm dev` (background)
Expected: `✓ Ready in <N>s` with `Local: http://localhost:3000`.

- [ ] **Step 3: Manual verification via claude-in-chrome — `/saludo`**

Navigate to `http://localhost:3000/saludo` and verify:
- Page renders with the same header/footer as the rest of the site, "Saludo en audio" highlighted in the nav.
- Clicking "Grabar saludo" with an empty nombre shows the inline error "Escribe tu nombre antes de grabar." and does **not** request microphone access.
- With a nombre filled in, clicking "Grabar saludo": since the automation browser has no real microphone available, this should surface the "No pudimos acceder a tu micrófono…" error path — confirms the `catch` branch renders correctly without crashing the page. This exercises the realistic error path for any visitor without a mic or who denies permission.
- If the environment does grant a fake mic device, additionally verify: the timer counts up, "Detener" stops it, the `<audio controls>` preview appears with playback, "Grabar de nuevo" discards and returns to idle, and "Enviar saludo" attempts the upload (expected to fail gracefully with "No pudimos subir tu audio…" since `.env.local` has blank Supabase credentials in this environment — same behavior already confirmed for `ContactForm.tsx`).

- [ ] **Step 4: Manual verification via claude-in-chrome — `/admin/saludos`**

Navigate to `http://localhost:3000/admin/saludos` while logged out (or as a non-admin) and confirm it redirects to `/` (per the existing `admin/layout.tsx` guard). Logging in as an actual admin user isn't available in this environment (no seeded admin account) — the layout-level redirect check is sufficient evidence the page is protected the same way as every other `/admin/*` page.

- [ ] **Step 5: Fix any issues found**

If any verification step fails, fix the relevant file, re-run `pnpm exec tsc --noEmit -p tsconfig.json`, and commit the fix with a message describing what was wrong (matching how the `ContactForm.tsx` `noValidate` bug was fixed earlier in this session).

---

### Task 9: Apply the migration and do a final live check

**Files:** none (this runs SQL against the live Supabase project — do not run without the user's go-ahead, same as `0011_sugerencias.sql` earlier in this session)

- [ ] **Step 1: Execute `supabase/migrations/0012_saludos.sql`**

Same procedure as `0011_sugerencias.sql`: open the Supabase SQL Editor for the linked project (`rdejlzuqtiigjjtclnpn`), paste the migration as a single line (avoid embedded newlines — Monaco's autocomplete previously corrupted a multi-line paste when Enter got intercepted by a suggestion popup), and run it.

- [ ] **Step 2: Verify in the SQL Editor**

```sql
SELECT relrowsecurity FROM pg_class WHERE relname = 'saludos';
```
Expected: `true`

```sql
SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'saludos';
```
Expected: one row — `saludos_insert_public`, `INSERT`, `{anon,authenticated}`

```sql
SELECT id, public FROM storage.buckets WHERE id = 'saludos';
```
Expected: one row — `saludos`, `false`

- [ ] **Step 3: Report back to the user**

Confirm the migration applied successfully before considering the feature ready to push to Vercel (pushing to `master`/deploying is a separate, explicit step the user must approve — do not push as part of this plan).

---

## Self-Review Notes

- **Spec coverage:** page location (Task 4), nombre-only field (Task 3), 60s cap (Task 3 `MAX_SECONDS`), native format/no conversion (Task 3 `pickMimeType`/`extensionForMimeType`), admin page pattern (Task 6), private bucket + signed URLs (Tasks 1 & 6), error handling table from the spec (mic denied / empty nombre / auto-stop / upload failure — all implemented in Task 3), nav+footer+sidebar links (Tasks 5 & 7), out-of-scope items (MP3 conversion, notifications, pagination, delete UI, rate limiting) — none implemented, matching the spec.
- **Placeholder scan:** no TBD/TODO; every step has complete, runnable code.
- **Type consistency:** `Saludo` (Task 2) fields — `id, nombre, audio_path, duration_seconds, created_at` — match the migration columns (Task 1) and the admin page's `.select(...)` list and destructuring (Task 6) exactly.
- **Scope:** single feature, one plan. No decomposition needed.

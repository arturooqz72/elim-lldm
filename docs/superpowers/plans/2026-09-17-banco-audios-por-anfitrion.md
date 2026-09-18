# Banco de Audios por Anfitrión Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada Conductor habitual de un Programa puede tener sus propios clips de audio personales (intros, outros, etc.); en el panel "Salida a radio" del Estudio en Vivo, un selector opcional "Anfitrión" filtra el banco de audios para mostrar los clips de esa persona junto con los generales del programa.

**Architecture:** Se agrega una columna nullable `host_id` a `programa_audios` (NULL = general, como hoy). El formulario de subida gana un selector para asignar el dueño. La nueva prop `programaHosts` se enhebra por la misma cadena de 5 componentes que ya usa `programaAudios` (`page.tsx` → `StudioShell` → `LiveKitRoom` → `HostControls` → `RadioBroadcastPanel`). Dentro de `RadioBroadcastPanel`, un estado local `selectedHostId` filtra qué clips se muestran, sin tocar la base de datos ni persistir la elección.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (Postgres + RLS), React (Client Components).

**Rama de trabajo:** este repo no usa git worktrees para estos planes — el ejecutor debe crear y trabajar sobre una rama nueva (`feat/banco-audios-por-anfitrion`) en el mismo checkout, y fusionarla a `master` al final (Task 10), igual que se hizo en `docs/superpowers/plans/2026-09-15-saludo-directo.md`.

**Sin suite de tests automatizados en este repo** (confirmado en el plan de Saludo Directo) — cada tarea se verifica con `npx tsc --noEmit`, y la Task 10 incluye verificación manual en vivo.

---

## File Structure

- **Create:** `supabase/migrations/0052_programa_audios_host.sql` — columna `host_id` + índice.
- **Modify:** `src/types/index.ts` — `ProgramaAudio` gana `host_id`.
- **Modify:** `src/app/admin/programas/[id]/AudioUploadForm.tsx` — selector "¿Para quién es este audio?".
- **Modify:** `src/app/admin/programas/[id]/page.tsx` — pasa `hosts` al form nuevo; etiqueta de dueño en la lista de audios.
- **Modify:** `src/app/(estudio)/platikas/[id]/page.tsx` — consulta `programa_hosts` y pasa `programaHosts` a `StudioShell`.
- **Modify:** `src/components/platikas/StudioShell.tsx` — enhebra `programaHosts` a `LiveKitRoom`.
- **Modify:** `src/components/platikas/LiveKitRoom.tsx` — enhebra `programaHosts` a `HostControls`.
- **Modify:** `src/components/platikas/HostControls.tsx` — enhebra `programaHosts` a `RadioBroadcastPanel`.
- **Modify:** `src/components/platikas/RadioBroadcastPanel.tsx` — selector "Anfitrión" + filtro del banco de audios.

---

### Task 1: Migración — columna `host_id`

**Files:**
- Create: `supabase/migrations/0052_programa_audios_host.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Elim LLDM — Banco de audios personal por anfitrión
--
-- Cada Conductor habitual de un programa puede tener sus propios
-- intros/outros/clips, además de los generales que ya existían.
-- host_id NULL = clip general del programa (todo lo que ya existe
-- hoy queda como general automáticamente). ON DELETE SET NULL en vez
-- de CASCADE: si se quita al conductor de programa_hosts o se borra
-- su cuenta, sus clips no desaparecen, solo vuelven a ser generales.
-- ============================================================

ALTER TABLE programa_audios
  ADD COLUMN host_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_programa_audios_host ON programa_audios(programa_id, host_id);
```

Sin cambios de RLS: la policy `programa_audios_staff` de `0038_programas.sql` (`admin`/`super_moderador`, lectura y escritura) ya cubre la columna nueva.

- [ ] **Step 2: Verify the file is well-formed SQL**

Run: `node -e "require('fs').readFileSync('supabase/migrations/0052_programa_audios_host.sql','utf8')"`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0052_programa_audios_host.sql
git commit -m "feat: add host_id column to programa_audios"
```

---

### Task 2: Tipo `ProgramaAudio`

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add the field**

En `src/types/index.ts`, la interfaz actual:

```typescript
export interface ProgramaAudio {
  id: string;
  programa_id: string;
  titulo: string;
  audio_url: string;
  orden: number;
  created_at: string;
}
```

Se convierte en:

```typescript
export interface ProgramaAudio {
  id: string;
  programa_id: string;
  titulo: string;
  audio_url: string;
  orden: number;
  host_id: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: puede que aparezcan errores nuevos en los sitios que construyen un `ProgramaAudio` sin `host_id` (por ejemplo un `insert` que no lo incluya) — eso es intencional y se resuelve en las tareas siguientes, que sí lo agregan. Si el error apunta a un archivo que este plan no toca, repórtalo como `DONE_WITH_CONCERNS` en vez de arreglarlo por tu cuenta.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add host_id to ProgramaAudio type"
```

---

### Task 3: Selector de dueño al subir un audio

**Files:**
- Modify: `src/app/admin/programas/[id]/AudioUploadForm.tsx`

- [ ] **Step 1: Add the `hosts` prop and the selector**

El archivo actual empieza:

```tsx
"use client";

import { useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { createFreshClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface AudioUploadFormProps {
  programaId: string;
  nextOrden: number;
}
```

Cámbialo a (agrega el import de tipo y el campo `hosts` a la interfaz):

```tsx
"use client";

import { useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { createFreshClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { ProgramaHost } from "@/types";

interface AudioUploadFormProps {
  programaId: string;
  nextOrden: number;
  hosts: ProgramaHost[];
}
```

La firma del componente:

```tsx
export function AudioUploadForm({ programaId, nextOrden }: AudioUploadFormProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
```

Se convierte en (agrega `hosts` a la desestructuración y el estado `hostId`):

```tsx
export function AudioUploadForm({ programaId, nextOrden, hosts }: AudioUploadFormProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [hostId, setHostId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
```

El insert final, hoy:

```tsx
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
```

Se convierte en (agrega `host_id` al insert y resetea `hostId` al terminar):

```tsx
      const supabase = createFreshClient();
      const { error: insertErr } = await withTimeout(
        Promise.resolve(
          supabase.from("programa_audios").insert({
            programa_id: programaId,
            titulo: titulo.trim(),
            audio_url: initData.publicUrl,
            orden: nextOrden,
            host_id: hostId || null,
          })
        ),
        15000,
        "guardar registro del audio"
      );
      if (insertErr) throw new Error(insertErr.message);

      setFile(null);
      setTitulo("");
      setHostId("");
      router.refresh();
```

Por último, el JSX del formulario — entre el bloque del campo "Título" y el bloque del campo "Archivo de audio", que hoy son:

```tsx
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
```

Se le inserta un nuevo bloque en medio, quedando:

```tsx
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
          ¿Para quién es este audio?
        </label>
        <select
          value={hostId}
          onChange={(e) => setHostId(e.target.value)}
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          style={inputStyle}
        >
          <option value="">General (para todos)</option>
          {hosts.map((host) => (
            <option key={host.id} value={host.user_id}>
              {host.profiles?.display_name ?? "Sin nombre"}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
          Archivo de audio
        </label>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos causados por este archivo (el componente que lo usa, `page.tsx`, todavía no pasa `hosts` — eso se arregla en la Task 4; si `tsc` se queja de esa llamada específica, es esperado hasta esa tarea).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/programas/\[id\]/AudioUploadForm.tsx
git commit -m "feat: add host selector to audio upload form"
```

---

### Task 4: Pasar `hosts` al formulario + etiqueta de dueño en la lista

**Files:**
- Modify: `src/app/admin/programas/[id]/page.tsx`

- [ ] **Step 1: Pass `hosts` to `AudioUploadForm`**

Al final del archivo, hoy:

```tsx
        <div className="lg:sticky lg:top-8">
          <AudioUploadForm programaId={id} nextOrden={audios.length} />
        </div>
```

Se convierte en:

```tsx
        <div className="lg:sticky lg:top-8">
          <AudioUploadForm programaId={id} nextOrden={audios.length} hosts={hosts} />
        </div>
```

(`hosts` ya existe en este archivo — se calcula unas líneas arriba con `const hosts = (hostsData ?? []) as ProgramaHost[];`, antes de este punto en el JSX.)

- [ ] **Step 2: Add an owner badge to each audio row**

El bloque que renderiza cada fila del "Banco de audios", hoy:

```tsx
              {audios.map((audio) => (
                <div
                  key={audio.id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                >
                  <audio controls src={audio.audio_url} className="h-8 flex-1 min-w-0" />
                  <span className="text-sm font-medium shrink-0" style={{ color: "var(--color-text)" }}>
                    {audio.titulo}
                  </span>
                  <form action={deleteAudio}>
                    <input type="hidden" name="id" value={audio.id} />
                    <input type="hidden" name="programa_id" value={id} />
                    <button type="submit" style={{ color: "var(--color-destructive)" }} aria-label="Borrar">
                      <Trash2 size={16} />
                    </button>
                  </form>
                </div>
              ))}
```

Se convierte en (agrega una etiqueta con el nombre del dueño o "General" antes del título):

```tsx
              {audios.map((audio) => {
                const owner = hosts.find((h) => h.user_id === audio.host_id);
                return (
                  <div
                    key={audio.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                  >
                    <audio controls src={audio.audio_url} className="h-8 flex-1 min-w-0" />
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider shrink-0 px-2 py-0.5 rounded-full"
                      style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-muted)" }}
                    >
                      {owner?.profiles?.display_name ?? "General"}
                    </span>
                    <span className="text-sm font-medium shrink-0" style={{ color: "var(--color-text)" }}>
                      {audio.titulo}
                    </span>
                    <form action={deleteAudio}>
                      <input type="hidden" name="id" value={audio.id} />
                      <input type="hidden" name="programa_id" value={id} />
                      <button type="submit" style={{ color: "var(--color-destructive)" }} aria-label="Borrar">
                        <Trash2 size={16} />
                      </button>
                    </form>
                  </div>
                );
              })}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/programas/\[id\]/page.tsx
git commit -m "feat: pass hosts to upload form and show owner badge per audio"
```

---

### Task 5: Consultar `programa_hosts` en la página del estudio

**Files:**
- Modify: `src/app/(estudio)/platikas/[id]/page.tsx`

- [ ] **Step 1: Add `ProgramaHost` to the type import**

Línea 10 hoy:

```tsx
import type { ProgramaAudio } from "@/types";
```

Se convierte en:

```tsx
import type { ProgramaAudio, ProgramaHost } from "@/types";
```

- [ ] **Step 2: Fetch `programa_hosts` alongside `programa_audios`**

El bloque actual (líneas ~62-76):

```tsx
  // getProfile() y la consulta de programa_audios no dependen una de la otra
  // (esta última solo depende de p.programa_id, ya disponible), así que corren
  // en paralelo con Promise.all en vez de secuencialmente.
  const [profile, audiosResult] = await Promise.all([
    getProfile(),
    p.programa_id
      ? supabase
          .from("programa_audios")
          .select("*")
          .eq("programa_id", p.programa_id)
          .order("orden", { ascending: true })
      : Promise.resolve({ data: null as ProgramaAudio[] | null }),
  ]);
  const currentUserId = profile?.id ?? null;
  const programaAudios: ProgramaAudio[] = audiosResult.data ?? [];
```

Se convierte en (agrega la consulta de `programa_hosts` al mismo `Promise.all`, mismo patrón de paralelismo):

```tsx
  // getProfile() y las consultas de programa_audios/programa_hosts no
  // dependen una de la otra (ambas solo dependen de p.programa_id, ya
  // disponible), así que corren en paralelo con Promise.all en vez de
  // secuencialmente.
  const [profile, audiosResult, hostsResult] = await Promise.all([
    getProfile(),
    p.programa_id
      ? supabase
          .from("programa_audios")
          .select("*")
          .eq("programa_id", p.programa_id)
          .order("orden", { ascending: true })
      : Promise.resolve({ data: null as ProgramaAudio[] | null }),
    p.programa_id
      ? supabase
          .from("programa_hosts")
          .select("*, profiles(display_name, avatar_url)")
          .eq("programa_id", p.programa_id)
      : Promise.resolve({ data: null as ProgramaHost[] | null }),
  ]);
  const currentUserId = profile?.id ?? null;
  const programaAudios: ProgramaAudio[] = audiosResult.data ?? [];
  const programaHosts: ProgramaHost[] = hostsResult.data ?? [];
```

- [ ] **Step 3: Pass `programaHosts` to `StudioShell`**

Más abajo, la llamada a `StudioShell` hoy:

```tsx
        <StudioShell
          platikaId={id}
          roomName={p.livekit_room_name!}
          title={p.title}
          isHost={isHost}
          isSpeaker={isSpeaker}
          currentUserId={currentUserId}
          canModerateChat={canModerateChat}
          programaAudios={programaAudios}
          initialIsLive={isLive}
          radioActive={p.radio_output_active}
        />
```

Se convierte en:

```tsx
        <StudioShell
          platikaId={id}
          roomName={p.livekit_room_name!}
          title={p.title}
          isHost={isHost}
          isSpeaker={isSpeaker}
          currentUserId={currentUserId}
          canModerateChat={canModerateChat}
          programaAudios={programaAudios}
          programaHosts={programaHosts}
          initialIsLive={isLive}
          radioActive={p.radio_output_active}
        />
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: puede quejarse de que `StudioShell` no acepta la prop `programaHosts` todavía — se resuelve en la Task 6. Si el único error nuevo es ese, repórtalo como `DONE_WITH_CONCERNS`, no lo arregles aquí.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(estudio)/platikas/[id]/page.tsx"
git commit -m "feat: fetch programa_hosts in studio page"
```

---

### Task 6: Enhebrar `programaHosts` por `StudioShell.tsx`

**Files:**
- Modify: `src/components/platikas/StudioShell.tsx`

- [ ] **Step 1: Add the prop and pass it through**

El import de tipos, hoy:

```tsx
import type { ProgramaAudio } from "@/types";
```

Se convierte en:

```tsx
import type { ProgramaAudio, ProgramaHost } from "@/types";
```

La interfaz de props, hoy:

```tsx
interface StudioShellProps {
  platikaId: string;
  roomName: string;
  title: string;
  isHost: boolean;
  isSpeaker: boolean;
  currentUserId: string | null;
  canModerateChat: boolean;
  programaAudios?: ProgramaAudio[];
  initialIsLive: boolean;
  radioActive: boolean;
}
```

Se convierte en:

```tsx
interface StudioShellProps {
  platikaId: string;
  roomName: string;
  title: string;
  isHost: boolean;
  isSpeaker: boolean;
  currentUserId: string | null;
  canModerateChat: boolean;
  programaAudios?: ProgramaAudio[];
  programaHosts?: ProgramaHost[];
  initialIsLive: boolean;
  radioActive: boolean;
}
```

La desestructuración de props en la firma del componente, hoy:

```tsx
export function StudioShell({
  platikaId,
  roomName,
  title,
  isHost,
  isSpeaker,
  currentUserId,
  canModerateChat,
  programaAudios,
  initialIsLive,
  radioActive,
}: StudioShellProps) {
```

Se convierte en:

```tsx
export function StudioShell({
  platikaId,
  roomName,
  title,
  isHost,
  isSpeaker,
  currentUserId,
  canModerateChat,
  programaAudios,
  programaHosts,
  initialIsLive,
  radioActive,
}: StudioShellProps) {
```

La llamada a `LiveKitRoom`, hoy:

```tsx
        <LiveKitRoom
          platikaId={platikaId}
          roomName={roomName}
          isHost={isHost}
          isSpeaker={isSpeaker}
          currentUserId={currentUserId}
          canModerateChat={canModerateChat}
          programaAudios={programaAudios}
          isLive={isLive}
        />
```

Se convierte en:

```tsx
        <LiveKitRoom
          platikaId={platikaId}
          roomName={roomName}
          isHost={isHost}
          isSpeaker={isSpeaker}
          currentUserId={currentUserId}
          canModerateChat={canModerateChat}
          programaAudios={programaAudios}
          programaHosts={programaHosts}
          isLive={isLive}
        />
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: puede quejarse de que `LiveKitRoom` no acepta `programaHosts` todavía — se resuelve en la Task 7.

- [ ] **Step 3: Commit**

```bash
git add src/components/platikas/StudioShell.tsx
git commit -m "feat: thread programaHosts through StudioShell"
```

---

### Task 7: Enhebrar `programaHosts` por `LiveKitRoom.tsx`

**Files:**
- Modify: `src/components/platikas/LiveKitRoom.tsx`

- [ ] **Step 1: Add the prop and pass it through**

El import de tipos, hoy:

```tsx
import type { ProgramaAudio } from "@/types";
```

Se convierte en:

```tsx
import type { ProgramaAudio, ProgramaHost } from "@/types";
```

En la interfaz `LiveKitRoomProps`, la línea:

```tsx
  programaAudios?: ProgramaAudio[];
```

Se convierte en:

```tsx
  programaAudios?: ProgramaAudio[];
  programaHosts?: ProgramaHost[];
```

En la desestructuración de la firma del componente:

```tsx
export function LiveKitRoom({
  platikaId,
  roomName,
  isHost,
  isSpeaker,
  currentUserId,
  canModerateChat,
  programaAudios,
  isLive,
}: LiveKitRoomProps) {
```

Se convierte en:

```tsx
export function LiveKitRoom({
  platikaId,
  roomName,
  isHost,
  isSpeaker,
  currentUserId,
  canModerateChat,
  programaAudios,
  programaHosts,
  isLive,
}: LiveKitRoomProps) {
```

La llamada a `HostControls`, hoy:

```tsx
        <HostControls
          platikaId={platikaId}
          isLive={isLive}
          onSpeakerApproved={handleSpeakerApproved}
          programaAudios={programaAudios}
        />
```

Se convierte en:

```tsx
        <HostControls
          platikaId={platikaId}
          isLive={isLive}
          onSpeakerApproved={handleSpeakerApproved}
          programaAudios={programaAudios}
          programaHosts={programaHosts}
        />
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: puede quejarse de que `HostControls` no acepta `programaHosts` todavía — se resuelve en la Task 8.

- [ ] **Step 3: Commit**

```bash
git add src/components/platikas/LiveKitRoom.tsx
git commit -m "feat: thread programaHosts through LiveKitRoom"
```

---

### Task 8: Enhebrar `programaHosts` por `HostControls.tsx`

**Files:**
- Modify: `src/components/platikas/HostControls.tsx`

- [ ] **Step 1: Add the prop and pass it through**

El import de tipos, hoy:

```tsx
import type { ProgramaAudio } from "@/types";
```

Se convierte en:

```tsx
import type { ProgramaAudio, ProgramaHost } from "@/types";
```

La interfaz `HostControlsProps`, hoy:

```tsx
interface HostControlsProps {
  platikaId: string;
  isLive: boolean;
  onSpeakerApproved?: (token: string, wsUrl: string) => void;
  programaAudios?: ProgramaAudio[];
}
```

Se convierte en:

```tsx
interface HostControlsProps {
  platikaId: string;
  isLive: boolean;
  onSpeakerApproved?: (token: string, wsUrl: string) => void;
  programaAudios?: ProgramaAudio[];
  programaHosts?: ProgramaHost[];
}
```

La desestructuración de la firma del componente, hoy:

```tsx
export function HostControls({
  platikaId,
  isLive,
  onSpeakerApproved,
  programaAudios,
}: HostControlsProps) {
```

Se convierte en:

```tsx
export function HostControls({
  platikaId,
  isLive,
  onSpeakerApproved,
  programaAudios,
  programaHosts,
}: HostControlsProps) {
```

La llamada a `RadioBroadcastPanel`, hoy:

```tsx
          <RadioBroadcastPanel platikaId={platikaId} programaAudios={programaAudios} />
```

Se convierte en:

```tsx
          <RadioBroadcastPanel platikaId={platikaId} programaAudios={programaAudios} programaHosts={programaHosts} />
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: puede quejarse de que `RadioBroadcastPanel` no acepta `programaHosts` todavía — se resuelve en la Task 9. Si a partir de esta tarea `tsc` ya no reporta NINGÚN error (ni siquiera ese), algo salió mal en una tarea anterior — repórtalo como `BLOCKED`, no lo ignores.

- [ ] **Step 3: Commit**

```bash
git add src/components/platikas/HostControls.tsx
git commit -m "feat: thread programaHosts through HostControls"
```

---

### Task 9: Selector "Anfitrión" y filtro en `RadioBroadcastPanel.tsx`

**Files:**
- Modify: `src/components/platikas/RadioBroadcastPanel.tsx`

- [ ] **Step 1: Import `ProgramaHost` and add the prop**

El import de tipos, hoy:

```tsx
import type { ProgramaAudio, Saludo } from "@/types";
```

Se convierte en:

```tsx
import type { ProgramaAudio, ProgramaHost, Saludo } from "@/types";
```

La interfaz de props, hoy:

```tsx
interface RadioBroadcastPanelProps {
  platikaId: string;
  programaAudios?: ProgramaAudio[];
}
```

Se convierte en:

```tsx
interface RadioBroadcastPanelProps {
  platikaId: string;
  programaAudios?: ProgramaAudio[];
  programaHosts?: ProgramaHost[];
}
```

El componente wrapper (el que decide si monta el real), hoy:

```tsx
export function RadioBroadcastPanel({ platikaId, programaAudios }: RadioBroadcastPanelProps) {
  const room = useMaybeRoomContext();
  if (!room) return null;
  return <ConnectedRadioBroadcastPanel platikaId={platikaId} programaAudios={programaAudios} />;
}
```

Se convierte en:

```tsx
export function RadioBroadcastPanel({ platikaId, programaAudios, programaHosts }: RadioBroadcastPanelProps) {
  const room = useMaybeRoomContext();
  if (!room) return null;
  return (
    <ConnectedRadioBroadcastPanel
      platikaId={platikaId}
      programaAudios={programaAudios}
      programaHosts={programaHosts}
    />
  );
}
```

- [ ] **Step 2: Add `selectedHostId` state and the filtered list**

La firma del componente real y sus primeras líneas, hoy:

```tsx
function ConnectedRadioBroadcastPanel({ platikaId, programaAudios }: RadioBroadcastPanelProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [roomOn, setRoomOn] = useState(false);
  const [micVolume, setMicVolume] = useState(1);
  const [pcOn, setPcOn] = useState(false);
  const [pcLoading, setPcLoading] = useState(false);
  const [pcVolume, setPcVolume] = useState(1);

  const audios = programaAudios ?? [];
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(audios[0]?.id ?? null);
```

Se convierte en (agrega `programaHosts` a la desestructuración, los `hosts`/`selectedHostId`/`audiosVisibles` derivados, y un handler para cambiar de anfitrión):

```tsx
function ConnectedRadioBroadcastPanel({ platikaId, programaAudios, programaHosts }: RadioBroadcastPanelProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [roomOn, setRoomOn] = useState(false);
  const [micVolume, setMicVolume] = useState(1);
  const [pcOn, setPcOn] = useState(false);
  const [pcLoading, setPcLoading] = useState(false);
  const [pcVolume, setPcVolume] = useState(1);

  const audios = programaAudios ?? [];
  const hosts = programaHosts ?? [];
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(audios[0]?.id ?? null);

  // El anfitrión elegido en este panel es solo un filtro de qué clips
  // mostrar — nunca se guarda en la base de datos ni afecta permisos,
  // así que basta con estado local. NULL/"" = sin elegir, se ve todo
  // mezclado igual que antes de esta función.
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null);
  const audiosVisibles = audios.filter(
    (a) => !selectedHostId || !a.host_id || a.host_id === selectedHostId
  );

  function handleHostChange(hostId: string | null) {
    setSelectedHostId(hostId);
    // Evita dejar seleccionado (aunque invisible) el intro de otro
    // anfitrión al cambiar el filtro.
    setSelectedAudioId(null);
  }
```

- [ ] **Step 3: Use `audiosVisibles` in the two audio-bank lists**

En la sección "Elige tu intro" (estado idle/connecting), la línea hoy:

```tsx
        {audios.map((audio) => (
```

Se convierte en:

```tsx
        {audiosVisibles.map((audio) => (
```

En la sección "Banco de audios" (estado live), la línea hoy:

```tsx
          {audios.map((audio) => {
```

Se convierte en:

```tsx
          {audiosVisibles.map((audio) => {
```

**No cambies ninguna otra aparición de `audios`** en el archivo (la de "Música de fondo", la de `entrarALaRadioConIntro`, la de `toggleBgMusic`, ni los dos `audios.length === 0` / `audios.length > 0` que deciden si la sección se muestra o no) — quedan usando la lista completa sin filtrar, a propósito (ver spec §3: "Música de fondo... no se toca").

- [ ] **Step 4: Render the "Anfitrión" selector in both branches**

Justo antes de `<p>Elige tu intro</p>` en la rama idle/connecting (dentro del segundo `return`, el que tiene `audios.length > 0`), agrega:

```tsx
        <HostSelector hosts={hosts} selectedHostId={selectedHostId} onChange={handleHostChange} />
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          Elige tu intro
        </p>
```

(reemplaza el `<p>Elige tu intro</p>` existente por ese bloque de dos líneas).

En la rama "live" (el `return` final del componente), justo después del bloque `{!micOn && !roomOn && !pcOn && !liveClipPlaying && !bgMusicPlaying && (...)}"` y antes de `{audios.length > 0 && (` (el de "Música de fondo"), agrega:

```tsx
      <HostSelector hosts={hosts} selectedHostId={selectedHostId} onChange={handleHostChange} />

      {audios.length > 0 && (
```

(esto reemplaza la línea `{audios.length > 0 && (` original por las tres líneas de arriba — solo se agrega el selector antes, la condición de "Música de fondo" no cambia).

- [ ] **Step 5: Define the `HostSelector` component**

Al final del archivo, después de la función `SourceToggle` (la última función del archivo), agrega:

```tsx

function HostSelector({
  hosts,
  selectedHostId,
  onChange,
}: {
  hosts: ProgramaHost[];
  selectedHostId: string | null;
  onChange: (hostId: string | null) => void;
}) {
  // Con 0 o 1 conductor no hay nada que filtrar — el panel se comporta
  // exactamente igual que antes de esta función.
  if (hosts.length < 2) return null;

  return (
    <div className="flex flex-col gap-1">
      <label
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        Anfitrión
      </label>
      <select
        value={selectedHostId ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="rounded-lg px-2 py-1.5 text-xs outline-none"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
        }}
      >
        <option value="">Sin elegir</option>
        {hosts.map((host) => (
          <option key={host.id} value={host.user_id}>
            {host.profiles?.display_name ?? "Sin nombre"}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: sin errores. Esto confirma que las 8 tareas anteriores de enhebrado de props ya no dejan ningún cabo suelto.

- [ ] **Step 7: Commit**

```bash
git add src/components/platikas/RadioBroadcastPanel.tsx
git commit -m "feat: add Anfitrión selector that filters the audio bank"
```

---

### Task 10: Desplegar, aplicar migración y verificar en vivo

Este es el único paso con efectos reales y difíciles de revertir (escribir en la base de datos de producción, desplegar código real) — si algo en el diff se ve inesperado, confírmalo con el usuario antes de los sub-pasos de push/deploy.

**Files:** ninguno (solo infra/deploy).

- [ ] **Step 1: Fusionar y subir**

```bash
git checkout master
git pull origin master
git merge feat/banco-audios-por-anfitrion --no-edit
npx tsc --noEmit
npm run build
```

Si `tsc` o `build` fallan sobre el resultado fusionado, NO sigas al push — hay un cabo suelto entre tareas que hay que arreglar primero.

```bash
git push origin master
git branch -d feat/banco-audios-por-anfitrion
```

Vercel despliega solo al detectar el push a `master` (mismo flujo que las veces anteriores este mes).

- [ ] **Step 2: Aplicar la migración a producción**

No es posible correr comandos que escriban en la base de datos de producción directamente desde este agente — el clasificador de auto-mode de Claude Code lo bloquea incluso con confirmación explícita en el chat (ver `docs/superpowers/plans/2026-09-15-saludo-directo.md`, Task 9, y la memoria `feedback_supabase_sql_editor_workflow.md`). Dos caminos, cualquiera sirve:

- Pedirle al usuario que corra `!npx supabase db push` él mismo desde su clon local de elim-lldm (el que tiene `SUPABASE_ACCESS_TOKEN` en `.env.local`).
- O, con autorización explícita del usuario en el chat ("entra tú"), usar `mcp__claude-in-chrome__*` para entrar a `https://supabase.com/dashboard/project/rdejlzuqtiigjjtclnpn/sql/new` con la sesión ya logueada del usuario, escribir el contenido de `supabase/migrations/0052_programa_audios_host.sql` en el editor vía `window.monaco.editor.getModels()[0].setValue(sql)` (evita bugs de auto-cierre de paréntesis de escribir carácter por carácter), y darle clic a "Run".

- [ ] **Step 3: Verificar la migración de forma independiente**

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/programa_audios?select=host_id&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

Expected: `HTTP 200` (aunque el array venga vacío por RLS) — un `400`/`42703` significaría que la columna no se creó. O, si se usó el SQL Editor del navegador, correr ahí mismo `SELECT column_name FROM information_schema.columns WHERE table_name = 'programa_audios' AND column_name = 'host_id';` y confirmar 1 fila.

- [ ] **Step 4: Verificación manual en vivo**

Con el usuario (o con su autorización explícita usando su sesión de navegador ya logueada):

1. Ir a `/admin/programas/[id]` de un programa con **2 o más** Conductores habituales (si no existe ninguno así, crear uno de prueba agregando 2 nombres en "Conductor(es) habitual(es)").
2. Subir un audio general (sin elegir a nadie en "¿Para quién es este audio?") y un audio personal para cada uno de los 2 conductores.
3. Confirmar que la lista de la izquierda muestra la etiqueta correcta ("General" o el nombre) en cada fila.
4. Entrar al Estudio en Vivo de una plática de ese programa (backstage o en vivo) y confirmar:
   - Aparece el selector "Anfitrión" con los 2 nombres + "Sin elegir".
   - Sin elegir nadie, "Elige tu intro" y "Banco de audios" muestran los 3 clips (el general + los 2 personales).
   - Al elegir al Conductor A, solo se ven su clip personal + el general (no el del Conductor B).
5. Repetir con un programa de **1 solo** Conductor (o ninguno) y confirmar que el selector "Anfitrión" NO aparece, y que "Elige tu intro"/"Banco de audios" se comportan exactamente igual que antes de este cambio.

- [ ] **Step 5: Reportar**

Resume al usuario qué se verificó (y cualquier cosa que no haya funcionado) — esta tarea no tiene commit propio, es la verificación de todo lo confirmado en las Tasks 1-9.

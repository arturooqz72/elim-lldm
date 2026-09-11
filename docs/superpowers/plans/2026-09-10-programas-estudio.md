# Programas para el Estudio en Vivo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Programas" (recurring radio shows, e.g. "Conversando con Fernando") to the Estudio en Vivo (`platikas`), each with a conductor-managed soundboard of audio clips, a new `super_moderador` role that can run any programa, and a site-wide "en vivo" indicator that names the programa.

**Architecture:** Additive layer over the existing `platikas` infrastructure — no rename of tables/routes, only of user-facing labels (already mostly done). New tables `programas`, `programa_hosts`, `programa_audios`; a nullable `platikas.programa_id`; a new `super_moderador` role that is a superset of `moderador` plus full access to any programa. The existing `RadioBroadcastPanel` (mic/sala/PC mixer already wired to the AzuraCast bridge) gets extended with a soundboard UI, not replaced.

**Tech Stack:** Same as the rest of the repo — Next.js App Router, TypeScript, Supabase (Postgres + RLS), LiveKit, Backblaze B2 for audio storage. No new dependencies.

**Design spec:** `docs/superpowers/specs/2026-09-10-programas-estudio-design.md` — read it for the decisions behind this plan. Recording is explicitly out of scope (separate future spec).

**Files this plan reads but does not modify (reference patterns):**
- `src/app/admin/ahorcado/page.tsx` — inline Server Action + form pattern reused for `/admin/programas`.
- `src/app/admin/elimplay/nueva/AudioUploadForm.tsx` — B2 direct-upload-with-progress pattern (`sha1Hex`, `withTimeout`, `uploadToB2WithProgress`), duplicated (not shared) per this repo's existing convention (`VideoUploadForm.tsx` also duplicates it).
- `supabase/migrations/0030_moderador_role.sql` — exact pattern for adding a role to the `profiles.role` CHECK constraint without knowing its auto-generated name.
- `src/app/api/platikas/create-live/route.ts` — existing endpoint that creates a platika row + LiveKit room and flips it live in one call; Task 5 extends this instead of writing a new endpoint.

---

### Task 1: Migration — programas, programa_hosts, programa_audios

**Files:**
- Create: `supabase/migrations/0038_programas.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Elim LLDM — Programas del Estudio en Vivo
--
-- Un "programa" es un show recurrente (ej. "Conversando con Fernando"),
-- distinto de una transmisión puntual (una fila de `platikas`). Una
-- transmisión puede opcionalmente pertenecer a un programa vía
-- platikas.programa_id — NULL sigue siendo una transmisión libre, tal
-- cual funciona hoy.
-- ============================================================

CREATE TABLE programas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  horario_texto TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conductor(es) habitual(es) — informativo (se muestra públicamente
-- como "conducido por X"). El permiso real para operar un programa es
-- el rol super_moderador/admin, no estar en esta tabla — ver
-- 0039_super_moderador_role.sql.
CREATE TABLE programa_hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id UUID NOT NULL REFERENCES programas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (programa_id, user_id)
);

-- Banco de audios de cada programa — abierto: título libre (el
-- conductor los nombra "Intro 1", "Salida", etc.), sin ningún campo de
-- "tipo" — él decide cuál usar en cada momento desde el panel en vivo.
CREATE TABLE programa_audios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id UUID NOT NULL REFERENCES programas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_programa_hosts_programa ON programa_hosts(programa_id);
CREATE INDEX idx_programa_audios_programa ON programa_audios(programa_id, orden);

ALTER TABLE platikas ADD COLUMN programa_id UUID REFERENCES programas(id);
CREATE INDEX idx_platikas_programa ON platikas(programa_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE programas ENABLE ROW LEVEL SECURITY;
ALTER TABLE programa_hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE programa_audios ENABLE ROW LEVEL SECURITY;

-- programas y programa_hosts: público puede ver (nombre, horario,
-- quién lo conduce es información pública del sitio). Solo admin
-- puede crear/editar/borrar — la gestión de super_moderador sobre
-- programas es a través del panel en vivo (platikas), no de estas
-- fichas administrativas.
CREATE POLICY "programas_select" ON programas FOR SELECT USING (TRUE);
CREATE POLICY "programas_admin_write" ON programas FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "programa_hosts_select" ON programa_hosts FOR SELECT USING (TRUE);
CREATE POLICY "programa_hosts_admin_write" ON programa_hosts FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- programa_audios: herramienta de producción interna, no contenido
-- público — solo admin/super_moderador pueden leer y escribir (el
-- público solo lo escucha cuando sale por la radio).
CREATE POLICY "programa_audios_staff" ON programa_audios FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_moderador')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_moderador')));

-- GRANTs explícitos — sin esto, ni siquiera un usuario autenticado que
-- pasa la policy puede ejecutar la consulta (gotcha ya documentado
-- varias veces en este proyecto, ver 0019_jugadores_en_linea_grants.sql).
GRANT SELECT ON programas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON programas TO authenticated;
GRANT SELECT ON programa_hosts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON programa_hosts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON programa_audios TO authenticated;
```

- [ ] **Step 2: Apply it to production**

Ask the human operator to explicitly confirm before running this (production database write):

```bash
supabase db push --linked
```

Verify:

```bash
supabase migration list --linked
```

Expected: `0038` appears in both Local and Remote columns.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0038_programas.sql
git commit -m "Add programas, programa_hosts, and programa_audios tables"
```

---

### Task 2: Migration — super_moderador role

**Files:**
- Create: `supabase/migrations/0039_super_moderador_role.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Elim LLDM — Rol "super_moderador"
--
-- Superset de 'moderador' (mismos poderes: borrar comentarios en
-- Opinión/Videos, moderar el chat en vivo de cualquier plática) más:
-- puede abrir el panel de CUALQUIER programa (no solo el que tiene
-- asignado en programa_hosts, para poder cubrir a quien falte),
-- gestionar el banco de audios de cualquier programa, y crear/operar
-- transmisiones (platikas) en nombre de cualquier programa.
--
-- Sin acceso a /admin, igual que 'moderador' — layout admin sigue
-- exigiendo role = 'admin' exacto.
-- ============================================================

-- Mismo patrón que 0030_moderador_role.sql: el CHECK de profiles.role
-- no tiene nombre fijo, se ubica dinámicamente para no dejar el
-- constraint viejo bloqueando el valor nuevo en silencio.
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%IN%'
  LOOP
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'anfitrion', 'participante', 'moderador', 'super_moderador'));

-- Chat en vivo: mismo permiso de UPDATE (marcar is_moderated=true) que
-- ya tienen admin/anfitrion/moderador.
DROP POLICY IF EXISTS "messages_update_admin" ON platikas_messages;
CREATE POLICY "messages_update_admin" ON platikas_messages
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'anfitrion', 'moderador', 'super_moderador'))
  );

-- Crear transmisiones (platikas): super_moderador se agrega junto a
-- admin/anfitrion. Se mantiene el requisito verified_lldm = TRUE por
-- consistencia con anfitrion — el admin lo marca al asignar el rol.
DROP POLICY IF EXISTS "platikas_insert_host" ON platikas;
CREATE POLICY "platikas_insert_host" ON platikas
  FOR INSERT WITH CHECK (
    auth.uid() = host_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'anfitrion', 'super_moderador') AND verified_lldm = TRUE
    )
  );

-- Nota: el borrado en Opinión y Sugerencias, y en comentarios de
-- Video, NO pasan por RLS — van por rutas API con el service role
-- (ver Task 3), que es donde se agrega 'super_moderador' de verdad.
```

- [ ] **Step 2: Apply it to production**

Ask the human operator to explicitly confirm, then:

```bash
supabase db push --linked
```

Verify with `supabase migration list --linked` (expect `0039` in both columns).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0039_super_moderador_role.sql
git commit -m "Add super_moderador role"
```

---

### Task 3: Update every code-level role check for super_moderador

**Files:**
- Modify: `src/types/index.ts:1`
- Modify: `src/types/database.ts` (3 occurrences)
- Modify: `src/app/(public)/opiniones/page.tsx:57`
- Modify: `src/app/(public)/videos/[id]/page.tsx:276`
- Modify: `src/app/(public)/platikas/[id]/page.tsx:66`
- Modify: `src/app/api/admin/opiniones/[id]/route.ts:18`
- Modify: `src/app/api/admin/video-comments/[id]/route.ts:18`
- Modify: `src/components/admin/RoleSelect.tsx:44-47`
- Modify: `src/app/admin/usuarios/page.tsx:100-104`

These are every place `'moderador'`/`"moderador"` appears in application code (confirmed by grepping the whole `src/` tree) — `super_moderador` must be added next to each one, or a `moderador`-only user won't gain the new powers and a `super_moderador`-only user won't get the old ones back.

- [ ] **Step 1: Update the `Role` type**

In `src/types/index.ts`, line 1, change:

```ts
export type Role = "admin" | "anfitrion" | "participante" | "moderador";
```

to:

```ts
export type Role = "admin" | "anfitrion" | "participante" | "moderador" | "super_moderador";
```

- [ ] **Step 2: Update the generated database types**

In `src/types/database.ts`, there are 3 occurrences of the literal union `"admin" | "anfitrion" | "participante" | "moderador"` (in the `Row`, `Insert`, and `Update` shapes of `profiles`). Change each to:

```ts
"admin" | "anfitrion" | "participante" | "moderador" | "super_moderador"
```

- [ ] **Step 3: Update the Opiniones moderation check**

In `src/app/(public)/opiniones/page.tsx:57`, change:

```tsx
canModerate={profile?.role === "admin" || profile?.role === "moderador"}
```

to:

```tsx
canModerate={
  profile?.role === "admin" || profile?.role === "moderador" || profile?.role === "super_moderador"
}
```

- [ ] **Step 4: Update the Video comments moderation check**

In `src/app/(public)/videos/[id]/page.tsx:276`, apply the same change:

```tsx
canModerate={
  profile?.role === "admin" || profile?.role === "moderador" || profile?.role === "super_moderador"
}
```

- [ ] **Step 5: Update the Estudio en Vivo chat moderation check**

In `src/app/(public)/platikas/[id]/page.tsx`, lines 65-66, change:

```ts
const canModerateChat =
  isHost || profile?.role === "admin" || profile?.role === "moderador";
```

to:

```ts
const canModerateChat =
  isHost ||
  profile?.role === "admin" ||
  profile?.role === "moderador" ||
  profile?.role === "super_moderador";
```

- [ ] **Step 6: Update the Opiniones delete API route**

In `src/app/api/admin/opiniones/[id]/route.ts:18`, change:

```ts
if (role !== "admin" && role !== "moderador") return null;
```

to:

```ts
if (role !== "admin" && role !== "moderador" && role !== "super_moderador") return null;
```

- [ ] **Step 7: Update the Video comments delete API route**

In `src/app/api/admin/video-comments/[id]/route.ts:18`, apply the same change:

```ts
if (role !== "admin" && role !== "moderador" && role !== "super_moderador") return null;
```

- [ ] **Step 8: Add the new role to the admin role-picker dropdown**

In `src/components/admin/RoleSelect.tsx`, lines 44-47, change:

```tsx
<option value="participante">Participante</option>
<option value="anfitrion">Anfitrión</option>
<option value="moderador">Moderador</option>
<option value="admin">Admin</option>
```

to:

```tsx
<option value="participante">Participante</option>
<option value="anfitrion">Anfitrión</option>
<option value="moderador">Moderador</option>
<option value="super_moderador">Super Moderador</option>
<option value="admin">Admin</option>
```

- [ ] **Step 9: Add the new role to the Usuarios filter dropdown**

In `src/app/admin/usuarios/page.tsx`, lines 100-104, change:

```tsx
<option value="">Todos los roles</option>
<option value="admin">Admin</option>
<option value="moderador">Moderador</option>
<option value="anfitrion">Anfitrión</option>
<option value="participante">Participante</option>
```

to:

```tsx
<option value="">Todos los roles</option>
<option value="admin">Admin</option>
<option value="super_moderador">Super Moderador</option>
<option value="moderador">Moderador</option>
<option value="anfitrion">Anfitrión</option>
<option value="participante">Participante</option>
```

- [ ] **Step 10: Type-check**

```bash
./node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add src/types/index.ts src/types/database.ts "src/app/(public)/opiniones/page.tsx" "src/app/(public)/videos/[id]/page.tsx" "src/app/(public)/platikas/[id]/page.tsx" "src/app/api/admin/opiniones/[id]/route.ts" "src/app/api/admin/video-comments/[id]/route.ts" src/components/admin/RoleSelect.tsx src/app/admin/usuarios/page.tsx
git commit -m "Wire super_moderador into every existing moderador check"
```

---

### Task 4: Domain types for Programas

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add the types**

Append to the end of `src/types/index.ts`:

```ts

export interface Programa {
  id: string;
  nombre: string;
  descripcion: string | null;
  horario_texto: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProgramaHost {
  id: string;
  programa_id: string;
  user_id: string;
  created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
}

export interface ProgramaAudio {
  id: string;
  programa_id: string;
  titulo: string;
  audio_url: string;
  orden: number;
  created_at: string;
}
```

- [ ] **Step 2: Type-check and commit**

```bash
./node_modules/.bin/tsc --noEmit
git add src/types/index.ts
git commit -m "Add Programa, ProgramaHost, and ProgramaAudio types"
```

---

### Task 5: Extend create-live to accept a programa

**Files:**
- Modify: `src/app/api/platikas/create-live/route.ts`

- [ ] **Step 1: Allow super_moderador and accept programa_id**

In `src/app/api/platikas/create-live/route.ts`, line 34, change:

```ts
  if (!profile || !["admin", "anfitrion"].includes(profile.role)) {
```

to:

```ts
  if (!profile || !["admin", "anfitrion", "super_moderador"].includes(profile.role)) {
```

Then change the body-parsing block (lines 41-55) from:

```ts
  let body: { title?: string };
  try {
    body = await request.json();
  } catch (err) {
    console.error(`${LOG_TAG} failed to parse request JSON body:`, err);
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const title = body.title?.trim();
  console.log(`${LOG_TAG} parsed body`, { title });

  if (!title) {
    console.error(`${LOG_TAG} missing title — bad request`);
    return NextResponse.json({ error: "El título es requerido" }, { status: 400 });
  }
```

to:

```ts
  let body: { title?: string; programa_id?: string };
  try {
    body = await request.json();
  } catch (err) {
    console.error(`${LOG_TAG} failed to parse request JSON body:`, err);
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const title = body.title?.trim();
  const programaId = body.programa_id?.trim() || null;
  console.log(`${LOG_TAG} parsed body`, { title, programaId });

  if (!title) {
    console.error(`${LOG_TAG} missing title — bad request`);
    return NextResponse.json({ error: "El título es requerido" }, { status: 400 });
  }
```

Then change the insert (lines 57-66) from:

```ts
  const { data: platika, error } = await supabase
    .from("platikas")
    .insert({
      title,
      host_id: user.id,
      status: "scheduled",
    })
    .select("id")
    .single();
```

to:

```ts
  const { data: platika, error } = await supabase
    .from("platikas")
    .insert({
      title,
      host_id: user.id,
      status: "scheduled",
      programa_id: programaId,
    })
    .select("id")
    .single();
```

- [ ] **Step 2: Type-check and commit**

```bash
./node_modules/.bin/tsc --noEmit
git add src/app/api/platikas/create-live/route.ts
git commit -m "Let create-live accept a programa_id and allow super_moderador"
```

---

### Task 6: B2 upload endpoint for program audio clips

**Files:**
- Create: `src/app/api/programas/b2-upload/route.ts`

Copies the exact pattern of `src/app/api/elimplay/b2-upload/route.ts` (already reviewed) with two differences: the allowed role and the storage folder prefix.

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface B2AuthResponse {
  apiUrl: string;
  authorizationToken: string;
  accountId: string;
  message?: string;
  code?: string;
}

interface B2Bucket {
  bucketId: string;
  bucketName: string;
}

interface B2ListBucketsResponse {
  buckets?: B2Bucket[];
  message?: string;
  code?: string;
}

interface B2UploadUrlResponse {
  uploadUrl: string;
  authorizationToken: string;
  message?: string;
  code?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "admin" && role !== "super_moderador") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const keyId = process.env.B2_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;
  const bucketName = process.env.B2_BUCKET_NAME;
  const endpoint = process.env.B2_ENDPOINT;
  const publicBaseUrl = process.env.B2_PUBLIC_BASE_URL;

  if (!keyId || !applicationKey || !bucketName) {
    return NextResponse.json(
      { error: "Faltan variables de entorno de Backblaze en Vercel." },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    fileName?: string;
  };
  const { fileName } = body;

  if (!fileName || typeof fileName !== "string") {
    return NextResponse.json({ error: "Falta fileName válido." }, { status: 400 });
  }

  const cleanFileName = fileName.trim().replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-");

  if (!cleanFileName) {
    return NextResponse.json({ error: "fileName no es válido." }, { status: 400 });
  }

  const finalFileName = `programa-audios/${user.id}/${Date.now()}-${cleanFileName}`;

  const authString = Buffer.from(`${keyId}:${applicationKey}`).toString("base64");

  try {
    const authResponse = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
      method: "GET",
      headers: { Authorization: `Basic ${authString}` },
    });

    const authData = (await authResponse.json()) as B2AuthResponse;

    if (!authResponse.ok) {
      return NextResponse.json(
        { error: authData?.message || authData?.code || "No se pudo autorizar con Backblaze." },
        { status: 500 }
      );
    }

    const listBucketsResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_list_buckets`, {
      method: "POST",
      headers: {
        Authorization: authData.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accountId: authData.accountId, bucketName }),
    });

    const listBucketsData = (await listBucketsResponse.json()) as B2ListBucketsResponse;

    if (!listBucketsResponse.ok) {
      return NextResponse.json(
        { error: listBucketsData?.message || listBucketsData?.code || "No se pudo obtener el bucket." },
        { status: 500 }
      );
    }

    const bucket = listBucketsData?.buckets?.find((b) => b.bucketName === bucketName);

    if (!bucket?.bucketId) {
      return NextResponse.json({ error: `No se encontró el bucket ${bucketName}.` }, { status: 500 });
    }

    const uploadUrlResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_get_upload_url`, {
      method: "POST",
      headers: {
        Authorization: authData.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bucketId: bucket.bucketId }),
    });

    const uploadUrlData = (await uploadUrlResponse.json()) as B2UploadUrlResponse;

    if (!uploadUrlResponse.ok) {
      return NextResponse.json(
        { error: uploadUrlData?.message || uploadUrlData?.code || "No se pudo obtener upload URL." },
        { status: 500 }
      );
    }

    let publicUrl: string | null = null;

    if (publicBaseUrl) {
      publicUrl = `${publicBaseUrl.replace(/\/+$/, "")}/${finalFileName}`;
    } else if (endpoint) {
      publicUrl = `${endpoint.replace(/\/+$/, "")}/file/${bucketName}/${finalFileName}`;
    }

    return NextResponse.json({
      uploadUrl: uploadUrlData.uploadUrl,
      authorizationToken: uploadUrlData.authorizationToken,
      fileName: finalFileName,
      publicUrl,
    });
  } catch (error) {
    console.error("B2 upload init error (programa-audios):", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno preparando subida a Backblaze." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Type-check and commit**

```bash
./node_modules/.bin/tsc --noEmit
git add src/app/api/programas/b2-upload/route.ts
git commit -m "Add B2 upload endpoint for programa audio clips"
```

---

### Task 7: AudioMixer.playClip()

**Files:**
- Modify: `src/lib/radio-broadcast.ts`

- [ ] **Step 1: Add the method**

In `src/lib/radio-broadcast.ts`, inside the `AudioMixer` class, add a new method right after `close()`:

```ts
  /**
   * Reproduce un clip de audio (ej. intro/salida de un programa) hacia
   * la mezcla que sale a la radio — no hacia las bocinas locales, igual
   * que el resto de las fuentes de este mixer. Resuelve cuando el clip
   * termina de sonar, para poder encadenar acciones (ej. desconectar
   * después de la salida).
   */
  async playClip(url: string): Promise<void> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

    return new Promise((resolve) => {
      const source = this.context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.destination);
      source.onended = () => resolve();
      source.start();
    });
  }
```

- [ ] **Step 2: Type-check and commit**

```bash
./node_modules/.bin/tsc --noEmit
git add src/lib/radio-broadcast.ts
git commit -m "Add AudioMixer.playClip for program soundboard clips"
```

---

### Task 8: Admin — manage Programas (list, create, edit)

**Files:**
- Create: `src/app/admin/programas/page.tsx`

Follows the exact inline-Server-Action pattern of `src/app/admin/ahorcado/page.tsx`.

- [ ] **Step 1: Write the page**

```tsx
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Radio } from "lucide-react";
import type { Programa } from "@/types";

export const metadata = { title: "Programas — Admin" };

interface Props {
  searchParams: Promise<{ edit?: string }>;
}

async function addPrograma(formData: FormData) {
  "use server";
  const supabase = await createServiceClient();
  await supabase.from("programas").insert({
    nombre: (formData.get("nombre") as string).trim(),
    descripcion: ((formData.get("descripcion") as string) || "").trim() || null,
    horario_texto: ((formData.get("horario_texto") as string) || "").trim() || null,
  });
  revalidatePath("/admin/programas");
}

async function updatePrograma(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const supabase = await createServiceClient();
  await supabase
    .from("programas")
    .update({
      nombre: (formData.get("nombre") as string).trim(),
      descripcion: ((formData.get("descripcion") as string) || "").trim() || null,
      horario_texto: ((formData.get("horario_texto") as string) || "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/admin/programas");
}

async function toggleActivo(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const activo = formData.get("activo") === "true";
  const supabase = await createServiceClient();
  await supabase.from("programas").update({ activo }).eq("id", id);
  revalidatePath("/admin/programas");
}

export default async function ProgramasAdminPage({ searchParams }: Props) {
  const { edit: editId } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase.from("programas").select("*").order("nombre", { ascending: true });

  const programas = (data ?? []) as Programa[];
  const editando = editId ? programas.find((p) => p.id === editId) : undefined;

  const inputStyle = {
    background: "var(--color-surface-elevated)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
  } as const;

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Radio size={22} style={{ color: "var(--color-primary)" }} />
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          Programas
        </h1>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          {programas.length === 0 && (
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Aún no hay programas.
            </p>
          )}
          {programas.map((programa) => (
            <div
              key={programa.id}
              className="flex items-center gap-3 p-4 rounded-2xl"
              style={{
                background: "var(--color-surface)",
                border: `1px solid ${editando?.id === programa.id ? "var(--color-primary)" : "var(--color-border)"}`,
                opacity: programa.activo ? 1 : 0.6,
              }}
            >
              <form action={toggleActivo}>
                <input type="hidden" name="id" value={programa.id} />
                <input type="hidden" name="activo" value={(!programa.activo).toString()} />
                <button
                  type="submit"
                  className="w-5 h-5 rounded shrink-0"
                  style={{
                    background: programa.activo ? "var(--color-primary)" : "var(--color-surface-elevated)",
                    border: "1px solid var(--color-border)",
                  }}
                  aria-label={programa.activo ? "Desactivar" : "Activar"}
                />
              </form>

              <div className="flex-1 min-w-0">
                <p className="font-semibold" style={{ color: "var(--color-text)" }}>
                  {programa.nombre}
                </p>
                {programa.horario_texto && (
                  <p className="text-xs" style={{ color: "var(--color-primary)" }}>
                    {programa.horario_texto}
                  </p>
                )}
              </div>

              <Link
                href={`/admin/programas?edit=${programa.id}`}
                className="w-7 h-7 rounded-lg text-xs flex items-center justify-center shrink-0"
                style={{ background: "rgba(212,160,23,0.1)", color: "var(--color-primary)" }}
              >
                ✎
              </Link>
              <Link
                href={`/admin/programas/${programa.id}`}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
                style={{ background: "var(--color-primary)", color: "#000" }}
              >
                Audios
              </Link>
            </div>
          ))}
        </div>

        <div className="lg:sticky lg:top-8">
          <form
            action={editando ? updatePrograma : addPrograma}
            className="flex flex-col gap-4 p-5 rounded-2xl"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <h2
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)" }}
            >
              {editando ? "Editar programa" : "Nuevo programa"}
            </h2>

            {editando && <input type="hidden" name="id" value={editando.id} />}

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Nombre
              </label>
              <input
                type="text"
                name="nombre"
                required
                defaultValue={editando?.nombre ?? ""}
                placeholder="Ej: Conversando con Fernando"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Descripción
              </label>
              <textarea
                name="descripcion"
                rows={2}
                defaultValue={editando?.descripcion ?? ""}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Horario (solo informativo)
              </label>
              <input
                type="text"
                name="horario_texto"
                defaultValue={editando?.horario_texto ?? ""}
                placeholder="Ej: Martes y jueves 6:00 PM"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </div>

            <div className="flex gap-2 pt-1">
              {editando && (
                <Link
                  href="/admin/programas"
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-center"
                  style={{
                    background: "var(--color-surface-elevated)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  Cancelar
                </Link>
              )}
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--color-primary)", color: "#000" }}
              >
                {editando ? "Guardar cambios" : "Crear programa"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and commit**

```bash
./node_modules/.bin/tsc --noEmit
git add src/app/admin/programas/page.tsx
git commit -m "Add /admin/programas — create, edit, activate programs"
```

---

### Task 9: Admin — manage a programa's audio bank

**Files:**
- Create: `src/app/admin/programas/[id]/page.tsx`
- Create: `src/app/admin/programas/[id]/AudioUploadForm.tsx`

- [ ] **Step 1: Write the server page (list + delete + host assignment)**

```tsx
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { Programa, ProgramaAudio, ProgramaHost } from "@/types";
import { AudioUploadForm } from "./AudioUploadForm";

interface Props {
  params: Promise<{ id: string }>;
}

async function deleteAudio(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const programaId = formData.get("programa_id") as string;
  const supabase = await createServiceClient();
  await supabase.from("programa_audios").delete().eq("id", id);
  revalidatePath(`/admin/programas/${programaId}`);
}

async function addHost(formData: FormData) {
  "use server";
  const programaId = formData.get("programa_id") as string;
  const nombre = (formData.get("nombre") as string).trim();
  const supabase = await createServiceClient();

  const { data: user } = await supabase
    .from("profiles")
    .select("id")
    .ilike("display_name", nombre)
    .maybeSingle();

  if (user) {
    await supabase
      .from("programa_hosts")
      .insert({ programa_id: programaId, user_id: (user as { id: string }).id })
      .select()
      .single();
  }
  revalidatePath(`/admin/programas/${programaId}`);
}

async function removeHost(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const programaId = formData.get("programa_id") as string;
  const supabase = await createServiceClient();
  await supabase.from("programa_hosts").delete().eq("id", id);
  revalidatePath(`/admin/programas/${programaId}`);
}

export default async function ProgramaAudiosPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: programaData } = await supabase.from("programas").select("*").eq("id", id).single();
  if (!programaData) notFound();
  const programa = programaData as Programa;

  const { data: audiosData } = await supabase
    .from("programa_audios")
    .select("*")
    .eq("programa_id", id)
    .order("orden", { ascending: true });
  const audios = (audiosData ?? []) as ProgramaAudio[];

  const { data: hostsData } = await supabase
    .from("programa_hosts")
    .select("*, profiles(display_name, avatar_url)")
    .eq("programa_id", id);
  const hosts = (hostsData ?? []) as ProgramaHost[];

  const inputStyle = {
    background: "var(--color-surface-elevated)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
  } as const;

  return (
    <div>
      <Link
        href="/admin/programas"
        className="inline-flex items-center gap-1.5 text-xs mb-4"
        style={{ color: "var(--color-text-muted)" }}
      >
        <ArrowLeft size={14} /> Programas
      </Link>

      <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--color-text)" }}>
        {programa.nombre}
      </h1>
      {programa.horario_texto && (
        <p className="text-sm mb-8" style={{ color: "var(--color-primary)" }}>
          {programa.horario_texto}
        </p>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-6">
          <div>
            <h2
              className="text-sm font-semibold uppercase tracking-wider mb-3"
              style={{ color: "var(--color-text-muted)" }}
            >
              Banco de audios ({audios.length})
            </h2>
            <div className="flex flex-col gap-2">
              {audios.length === 0 && (
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Aún no hay audios. Sube el primero a la derecha.
                </p>
              )}
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
            </div>
          </div>

          <div>
            <h2
              className="text-sm font-semibold uppercase tracking-wider mb-3"
              style={{ color: "var(--color-text-muted)" }}
            >
              Conductor(es) habitual(es)
            </h2>
            <div className="flex flex-col gap-2 mb-3">
              {hosts.map((host) => (
                <div
                  key={host.id}
                  className="flex items-center justify-between p-2.5 rounded-xl text-sm"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                >
                  <span style={{ color: "var(--color-text)" }}>{host.profiles?.display_name}</span>
                  <form action={removeHost}>
                    <input type="hidden" name="id" value={host.id} />
                    <input type="hidden" name="programa_id" value={id} />
                    <button type="submit" style={{ color: "var(--color-destructive)" }} aria-label="Quitar">
                      <Trash2 size={14} />
                    </button>
                  </form>
                </div>
              ))}
              {hosts.length === 0 && (
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Sin conductor asignado todavía. Esto es solo informativo — cualquier Super Moderador puede
                  operar este programa.
                </p>
              )}
            </div>
            <form action={addHost} className="flex gap-2">
              <input type="hidden" name="programa_id" value={id} />
              <input
                type="text"
                name="nombre"
                required
                placeholder="Nombre exacto del usuario (display_name)"
                className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                style={inputStyle}
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "var(--color-primary)", color: "#000" }}
              >
                Agregar
              </button>
            </form>
          </div>
        </div>

        <div className="lg:sticky lg:top-8">
          <AudioUploadForm programaId={id} nextOrden={audios.length} />
        </div>
      </div>
    </div>
  );
}
```

**Nota sobre `addHost`:** busca por `display_name` exacto vía `ilike` (no hay búsqueda por correo en `profiles` desde el admin hoy — mismo dato que ya se ve en la lista de Usuarios). Si el proyecto necesita una búsqueda mejor luego, es un cambio aislado a esta función.

- [ ] **Step 2: Write the upload form (client component)**

Duplicates the `sha1Hex`/`withTimeout`/`uploadToB2WithProgress` helpers from `AudioUploadForm.tsx` (ElimPlay), per this repo's existing convention of not sharing them across upload forms.

```tsx
"use client";

import { useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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

      const supabase = createClient();
      const { error: insertErr } = await supabase.from("programa_audios").insert({
        programa_id: programaId,
        titulo: titulo.trim(),
        audio_url: initData.publicUrl,
        orden: nextOrden,
      });
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
```

- [ ] **Step 3: Type-check and commit**

```bash
./node_modules/.bin/tsc --noEmit
git add "src/app/admin/programas/[id]/page.tsx" "src/app/admin/programas/[id]/AudioUploadForm.tsx"
git commit -m "Add per-programa audio bank management to admin"
```

---

### Task 10: Admin sidebar link

**Files:**
- Modify: `src/components/layout/AdminSidebar.tsx`

- [ ] **Step 1: Add the icon import and nav entry**

Change the `lucide-react` import to add `Radio`:

```ts
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
  Zap,
  Disc3,
  Puzzle,
  Radio,
  ChevronRight,
  LogOut,
} from "lucide-react";
```

Add a new entry to `NAV`, right after `/admin/platikas`:

```ts
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/platikas", label: "Estudio en Vivo", icon: Mic },
  { href: "/admin/programas", label: "Programas", icon: Radio },
  { href: "/admin/question-sets", label: "Banco de preguntas", icon: BookOpen },
```

(leave every other existing entry as-is)

- [ ] **Step 2: Type-check and commit**

```bash
./node_modules/.bin/tsc --noEmit
git add src/components/layout/AdminSidebar.tsx
git commit -m "Add Programas link to admin sidebar"
```

---

### Task 11: RadioBroadcastPanel — the soundboard

**Files:**
- Modify: `src/components/platikas/RadioBroadcastPanel.tsx`

Extends the existing component (already read in full) rather than replacing it — mic/sala/PC controls are untouched.

- [ ] **Step 1: Accept the new props and add soundboard state**

Change the import line to add the type and `Play`/`LogOut` icons:

```tsx
import { Radio, Mic, Users, MonitorSpeaker, Loader2, AlertCircle, Square, Play, LogOut } from "lucide-react";
```

Change the props interfaces from:

```tsx
interface RadioBroadcastPanelProps {
  platikaId: string;
}
```

to:

```tsx
interface RadioBroadcastPanelProps {
  platikaId: string;
  programaAudios?: ProgramaAudio[];
}
```

Add the type import right after the existing `AudioLevelMeter` import:

```tsx
import { AudioLevelMeter } from "./AudioLevelMeter";
import type { ProgramaAudio } from "@/types";
```

Update both the exported wrapper and the inner component to pass the prop through:

```tsx
export function RadioBroadcastPanel({ platikaId, programaAudios }: RadioBroadcastPanelProps) {
  const room = useMaybeRoomContext();
  if (!room) return null;
  return <ConnectedRadioBroadcastPanel platikaId={platikaId} programaAudios={programaAudios} />;
}

function ConnectedRadioBroadcastPanel({ platikaId, programaAudios }: RadioBroadcastPanelProps) {
```

Inside `ConnectedRadioBroadcastPanel`, right after the existing `const [pcLoading, setPcLoading] = useState(false);` line, add:

```tsx
  const audios = programaAudios ?? [];
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(audios[0]?.id ?? null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
```

- [ ] **Step 2: Add the clip-playing actions**

Right after the existing `async function togglePc() { ... }` function (before `if (status === "idle" ...`), add:

```tsx
  function previewClip(audio: ProgramaAudio) {
    if (previewingId === audio.id) {
      previewRef.current?.pause();
      setPreviewingId(null);
      return;
    }
    if (!previewRef.current) previewRef.current = new Audio();
    previewRef.current.src = audio.audio_url;
    previewRef.current.onended = () => setPreviewingId(null);
    void previewRef.current.play();
    setPreviewingId(audio.id);
  }

  async function entrarALaRadioConIntro() {
    await startBroadcast();
    const clip = audios.find((a) => a.id === selectedAudioId);
    if (!clip) return;
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await mixerRef.current?.playClip(clip.audio_url);
  }

  function dispararAudioEnVivo(audio: ProgramaAudio) {
    void mixerRef.current?.playClip(audio.audio_url);
  }

  async function dispararSalidaYDesconectar(audio: ProgramaAudio) {
    await mixerRef.current?.playClip(audio.audio_url);
    stopBroadcast();
  }
```

- [ ] **Step 3: Render the soundboard when idle (before connecting)**

Find the `if (status === "idle" || status === "connecting") {` block. Replace its `return` statement — change:

```tsx
  if (status === "idle" || status === "connecting") {
    return (
      <button
        type="button"
        onClick={startBroadcast}
        disabled={status === "connecting"}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all"
        style={{
          background: "var(--color-surface-elevated)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text-muted)",
        }}
      >
        {status === "connecting" ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} />}
        {status === "connecting" ? "Conectando…" : "Salida a radio"}
      </button>
    );
  }
```

to:

```tsx
  if (status === "idle" || status === "connecting") {
    if (audios.length === 0) {
      return (
        <button
          type="button"
          onClick={startBroadcast}
          disabled={status === "connecting"}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          {status === "connecting" ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} />}
          {status === "connecting" ? "Conectando…" : "Salida a radio"}
        </button>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          Elige tu intro
        </p>
        {audios.map((audio) => (
          <div key={audio.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedAudioId(audio.id)}
              className="flex-1 flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-left"
              style={{
                background: selectedAudioId === audio.id ? "rgba(212,160,23,0.15)" : "var(--color-surface)",
                border: `1px solid ${selectedAudioId === audio.id ? "rgba(212,160,23,0.4)" : "var(--color-border)"}`,
                color: selectedAudioId === audio.id ? "var(--color-primary)" : "var(--color-text)",
              }}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{
                  border: "1.5px solid currentColor",
                  background: selectedAudioId === audio.id ? "currentColor" : "transparent",
                }}
              />
              {audio.titulo}
            </button>
            <button
              type="button"
              onClick={() => previewClip(audio)}
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
              aria-label="Escuchar"
            >
              <Play size={12} style={{ color: previewingId === audio.id ? "var(--color-primary)" : "var(--color-text-muted)" }} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={entrarALaRadioConIntro}
          disabled={status === "connecting" || !selectedAudioId}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all mt-1"
          style={{ background: "var(--color-primary)", color: "#000", opacity: !selectedAudioId ? 0.6 : 1 }}
        >
          {status === "connecting" ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} />}
          {status === "connecting" ? "Conectando…" : "Entrar a la radio"}
        </button>
      </div>
    );
  }
```

- [ ] **Step 4: Render the soundboard while live**

Find the final `return (` block (the "En vivo en la radio" panel). Right after the closing `</div>` of the three `SourceToggle` components and before `{errorMsg && (`, add:

```tsx
      {audios.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1" style={{ borderTop: "1px solid rgba(212,160,23,0.2)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider pt-1" style={{ color: "var(--color-text-muted)" }}>
            Banco de audios
          </p>
          {audios.map((audio) => (
            <div key={audio.id} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => dispararAudioEnVivo(audio)}
                className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                <Play size={11} />
                {audio.titulo}
              </button>
              <button
                type="button"
                onClick={() => void dispararSalidaYDesconectar(audio)}
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)" }}
                aria-label="Usar como salida y desconectar"
                title="Usar como salida y desconectar"
              >
                <LogOut size={11} style={{ color: "var(--color-destructive)" }} />
              </button>
            </div>
          ))}
        </div>
      )}

```

- [ ] **Step 5: Type-check**

```bash
./node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/platikas/RadioBroadcastPanel.tsx
git commit -m "Add program soundboard to RadioBroadcastPanel"
```

---

### Task 12: Wire programa_id and its audios down to RadioBroadcastPanel

**Files:**
- Modify: `src/app/(public)/platikas/[id]/page.tsx`
- Modify: `src/components/platikas/LiveKitRoom.tsx`
- Modify: `src/components/platikas/HostControls.tsx`

- [ ] **Step 1: Fetch the program's audios in the page**

In `src/app/(public)/platikas/[id]/page.tsx`, right after the `p.host_id` block that defines `isHost`/`canModerateChat` (after line 66), add:

```ts
  let programaAudios: { id: string; programa_id: string; titulo: string; audio_url: string; orden: number; created_at: string }[] = [];
  if (p.programa_id) {
    const { data: audiosData } = await supabase
      .from("programa_audios")
      .select("*")
      .eq("programa_id", p.programa_id)
      .order("orden", { ascending: true });
    programaAudios = audiosData ?? [];
  }
```

Also add `programa_id` to the local type `p` — change:

```ts
  const p = platica as {
    id: string;
    title: string;
    description: string | null;
    status: string;
    host_id: string;
    livekit_room_name: string | null;
    radio_output_active: boolean;
    scheduled_at: string | null;
    started_at: string | null;
    thumbnail_url: string | null;
    recording_url: string | null;
    profiles: { display_name: string; avatar_url: string | null; role: string } | null;
  };
```

to:

```ts
  const p = platica as {
    id: string;
    title: string;
    description: string | null;
    status: string;
    host_id: string;
    livekit_room_name: string | null;
    radio_output_active: boolean;
    scheduled_at: string | null;
    started_at: string | null;
    thumbnail_url: string | null;
    recording_url: string | null;
    programa_id: string | null;
    profiles: { display_name: string; avatar_url: string | null; role: string } | null;
  };
```

Find where `<LiveKitRoom` is rendered further down in the file and add the new prop `programaAudios={programaAudios}` to it.

- [ ] **Step 2: Thread the prop through LiveKitRoom**

In `src/components/platikas/LiveKitRoom.tsx`, add the import and prop:

```ts
import type { ProgramaAudio } from "@/types";
```

Change the props interface from:

```ts
interface LiveKitRoomProps {
  platikaId: string;
  roomName: string;
  isHost: boolean;
  isSpeaker: boolean;
  currentUserId: string | null;
  // Separado de isHost a propósito: isHost controla el rol LiveKit (mic,
  // cámara, "host" del token) de ESTA plática puntual; canModerateChat es
  // un permiso más amplio (también admin/moderador globales) que solo
  // debe afectar el botón de moderar del chat, no los controles de sala.
  canModerateChat: boolean;
}
```

to:

```ts
interface LiveKitRoomProps {
  platikaId: string;
  roomName: string;
  isHost: boolean;
  isSpeaker: boolean;
  currentUserId: string | null;
  // Separado de isHost a propósito: isHost controla el rol LiveKit (mic,
  // cámara, "host" del token) de ESTA plática puntual; canModerateChat es
  // un permiso más amplio (también admin/moderador globales) que solo
  // debe afectar el botón de moderar del chat, no los controles de sala.
  canModerateChat: boolean;
  programaAudios?: ProgramaAudio[];
}
```

Update the function signature:

```ts
export function LiveKitRoom({
  platikaId,
  roomName,
  isHost,
  isSpeaker,
  currentUserId,
  canModerateChat,
  programaAudios,
}: LiveKitRoomProps) {
```

Change the `<HostControls` usage from:

```tsx
      {isHost && (
        <HostControls
          platikaId={platikaId}
          isLive={isLive}
          onGoLive={() => setIsLive(true)}
          onEnd={() => setIsLive(false)}
          onSpeakerApproved={handleSpeakerApproved}
        />
      )}
```

to:

```tsx
      {isHost && (
        <HostControls
          platikaId={platikaId}
          isLive={isLive}
          onGoLive={() => setIsLive(true)}
          onEnd={() => setIsLive(false)}
          onSpeakerApproved={handleSpeakerApproved}
          programaAudios={programaAudios}
        />
      )}
```

- [ ] **Step 3: Thread the prop through HostControls**

In `src/components/platikas/HostControls.tsx`, add the import:

```ts
import type { ProgramaAudio } from "@/types";
```

Change the props interface from:

```ts
interface HostControlsProps {
  platikaId: string;
  isLive: boolean;
  onGoLive?: () => void;
  onEnd?: () => void;
  onSpeakerApproved?: (token: string, wsUrl: string) => void;
}
```

to:

```ts
interface HostControlsProps {
  platikaId: string;
  isLive: boolean;
  onGoLive?: () => void;
  onEnd?: () => void;
  onSpeakerApproved?: (token: string, wsUrl: string) => void;
  programaAudios?: ProgramaAudio[];
}
```

Update the function signature:

```ts
export function HostControls({
  platikaId,
  isLive,
  onGoLive,
  onEnd,
  onSpeakerApproved,
  programaAudios,
}: HostControlsProps) {
```

Change `{isLive && <RadioBroadcastPanel platikaId={platikaId} />}` to:

```tsx
          {isLive && <RadioBroadcastPanel platikaId={platikaId} programaAudios={programaAudios} />}
```

- [ ] **Step 4: Type-check and commit**

```bash
./node_modules/.bin/tsc --noEmit
git add "src/app/(public)/platikas/[id]/page.tsx" src/components/platikas/LiveKitRoom.tsx src/components/platikas/HostControls.tsx
git commit -m "Thread programa audios down to RadioBroadcastPanel"
```

---

### Task 13: Entry page — "Ir en vivo" per programa

**Files:**
- Create: `src/app/(public)/platikas/programas/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { redirect } from "next/navigation";
import { getProfile, createClient } from "@/lib/supabase/server";
import { GoLiveProgramaButton } from "@/components/platikas/GoLiveProgramaButton";
import type { Programa } from "@/types";

export const metadata = { title: "Programas — Estudio en Vivo" };

export default async function ProgramasEnVivoPage() {
  const profile = await getProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_moderador")) {
    redirect("/platikas");
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("programas")
    .select("*")
    .eq("activo", true)
    .order("nombre", { ascending: true });
  const programas = (data ?? []) as Programa[];

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-4">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--color-text)" }}>
          Programas
        </h1>

        {programas.length === 0 && (
          <p style={{ color: "var(--color-text-muted)" }}>
            No hay programas activos todavía.
          </p>
        )}

        {programas.map((programa) => (
          <div
            key={programa.id}
            className="flex items-center justify-between gap-4 p-5 rounded-2xl"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <div>
              <p className="font-semibold" style={{ color: "var(--color-text)" }}>
                {programa.nombre}
              </p>
              {programa.horario_texto && (
                <p className="text-xs" style={{ color: "var(--color-primary)" }}>
                  {programa.horario_texto}
                </p>
              )}
            </div>
            <GoLiveProgramaButton programaId={programa.id} nombre={programa.nombre} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the "Ir en vivo" button**

**Files:**
- Create: `src/components/platikas/GoLiveProgramaButton.tsx`

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radio, Loader2 } from "lucide-react";

interface GoLiveProgramaButtonProps {
  programaId: string;
  nombre: string;
}

export function GoLiveProgramaButton({ programaId, nombre }: GoLiveProgramaButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function irEnVivo() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platikas/create-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nombre, programa_id: programaId }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) throw new Error(data.error ?? "No se pudo iniciar el programa");
      router.push(`/platikas/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar el programa");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <button
        type="button"
        onClick={irEnVivo}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
        style={{ background: "var(--color-primary)", color: "#000", opacity: loading ? 0.7 : 1 }}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} />}
        Ir en vivo
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

- [ ] **Step 3: Type-check and commit**

```bash
./node_modules/.bin/tsc --noEmit
git add "src/app/(public)/platikas/programas/page.tsx" src/components/platikas/GoLiveProgramaButton.tsx
git commit -m "Add /platikas/programas entry page with Ir en vivo"
```

---

### Task 14: Site-wide live indicator names the programa

**Files:**
- Modify: `src/lib/hooks/useLivePlatika.ts`
- Modify: `src/components/layout/LiveBadge.tsx`

- [ ] **Step 1: Extend the hook to include the programa name**

In `src/lib/hooks/useLivePlatika.ts`, change the interface from:

```ts
export interface LivePlatika {
  id: string;
  title: string;
}
```

to:

```ts
export interface LivePlatika {
  id: string;
  title: string;
  programa_nombre: string | null;
}
```

Change the query from:

```ts
      const { data } = await supabase
        .from("platikas")
        .select("id, title")
        .eq("status", "live")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setLive((data as LivePlatika | null) ?? null);
```

to:

```ts
      const { data } = await supabase
        .from("platikas")
        .select("id, title, programas(nombre)")
        .eq("status", "live")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const row = data as { id: string; title: string; programas: { nombre: string } | null } | null;
      setLive(row ? { id: row.id, title: row.title, programa_nombre: row.programas?.nombre ?? null } : null);
```

- [ ] **Step 2: Show the programa name in the badge**

In `src/components/layout/LiveBadge.tsx`, change:

```tsx
      <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
      EN VIVO
```

to:

```tsx
      <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
      {live.programa_nombre ?? "EN VIVO"}
```

- [ ] **Step 3: Type-check and commit**

```bash
./node_modules/.bin/tsc --noEmit
git add src/lib/hooks/useLivePlatika.ts src/components/layout/LiveBadge.tsx
git commit -m "Show the programa name in the site-wide live badge"
```

---

### Task 15: Manual end-to-end verification

Not a subagent task — the controlling session does this itself once every task above is committed and the migrations from Tasks 1-2 are applied to production.

1. Run `./node_modules/.bin/tsc --noEmit` — must be clean. Then `pnpm build` to catch anything the type-checker alone wouldn't.
2. As admin, go to `/admin/usuarios` and confirm the role dropdown now offers "Super Moderador"; set a test account to that role.
3. Go to `/admin/programas`, create a test programa ("Prueba"), confirm it appears in the list, edit its horario, confirm the change persists.
4. Open `/admin/programas/<id>`, upload two short audio clips (e.g. "Intro 1", "Salida 1"), confirm both appear with a working `<audio>` preview, confirm deleting one works.
5. As the test Super Moderador account, visit `/platikas/programas` — confirm "Prueba" is listed with an "Ir en vivo" button, and that a `participante`-role account gets redirected away from this page.
6. Click "Ir en vivo" — confirm it lands on `/platikas/<new-id>` already live, and the sidebar shows "Elige tu intro" with both clips and a working "Escuchar" preview (audible only locally, confirm by checking `radio.elimlldm.net` is NOT interrupted yet).
7. Select "Intro 1", click "Entrar a la radio" — confirm (via `radio.elimlldm.net`'s now-playing or the AzuraCast admin) that the station is interrupted, wait through the 5-second delay, and confirm "Intro 1" is audible on the live radio stream.
8. While live, click "Salida 1" in the "Banco de audios" section — confirm it plays on the radio and then the panel returns to disconnected/idle state.
9. Confirm the header's "🔴 [Prueba] — En vivo" indicator appears on an unrelated page (e.g. `/radio`) while step 7-8's session is live, and disappears once it ends.
10. Confirm the existing behaviors are unaffected: mic/sala/PC toggles inside a live programa session, chat, stage requests, and YouTube/Facebook/TikTok streaming all still work exactly as before (spot-check at least chat + one platform toggle).
11. Confirm a plain (non-programa) "Ir en Vivo" plática still works exactly as before — no programa audios shown, plain "Salida a radio" button present.

If any step fails, fix the specific file involved and re-run `./node_modules/.bin/tsc --noEmit` before retrying — don't move on with a known-broken step.

---

## Self-Review Notes

- **Spec coverage:** naming (already done pre-existing in this codebase, confirmed via grep — no task needed) · data model → Task 1 · super_moderador role & every call site → Tasks 2-3 · admin CRUD for programas → Task 8 · audio bank management → Task 9 · host panel flow (preview, select, 5s delay + autoplay, live triggers, salida disconnects) → Task 11 · entry point ("Ir en vivo") → Tasks 5, 13 · site-wide live indicator with programa name → Task 14 · error handling (connection failure retry, missing clip) → already covered by existing `RadioBroadcastPanel` error branch (Task 11 doesn't touch it) and by `playClip`'s plain `fetch`/`decodeAudioData` (a rejected promise there surfaces the same as any other broadcast error, no special-casing needed since nothing currently swallows it silently). Recording is explicitly out of scope per the spec.
- **Type consistency check:** `ProgramaAudio` (Task 4) is used identically in Task 9's admin page, Task 11's `RadioBroadcastPanelProps`, and Task 12's prop threading — same field names throughout (`id, programa_id, titulo, audio_url, orden, created_at`). `mixerRef.current?.playClip` (Task 11) matches the exact method name and signature added in Task 7. `startBroadcast`/`stopBroadcast` (Task 11's new functions call these) are the pre-existing function names in `RadioBroadcastPanel.tsx` — verified against the file read at plan-writing time, not guessed.
- **Placeholder scan:** none — every step has complete code, including the full B2 upload route duplicated correctly for the new folder path, and the full set of 9 call-site edits in Task 3 (no "repeat similarly" shortcuts).

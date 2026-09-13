# Destinos Múltiples Implementation Plan

> **Contexto:** proyecto sin tests automatizados. Cada tarea usa `./node_modules/.bin/tsc --noEmit` para verificar tipos y, en la tarea final, `pnpm run build` + verificación manual en producción — mismo patrón que `2026-09-12-backstage.md`.

**Goal:** Reemplazar las 3 plataformas fijas de streaming (YouTube/Facebook/TikTok, una cuenta cada una) por un catálogo de "Destinos" guardados y reutilizables, con toggle independiente por sesión y soporte para varios destinos simultáneos (incluyendo varios de la misma plataforma).

**Architecture:** Nueva tabla `destinos` (catálogo compartido, stream key cifrado con AES-256-GCM) + `platikas_stream_egresos` (historial de qué destino se transmitió en qué plática, reemplaza las columnas fijas `*_egress_id`). Cada destino activo es su propio `RoomCompositeEgress` de LiveKit — mismo mecanismo que ya funciona hoy, solo generalizado de 3 columnas fijas a N filas.

**Tech Stack:** Next.js API Routes, Supabase (Postgres + RLS), `livekit-server-sdk` (EgressClient), Node `crypto` (AES-256-GCM).

---

### Task 1: Migración de base de datos + variable de cifrado

**Files:**
- Create: `supabase/migrations/0042_destinos_multiples.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- ============================================================
-- Elim LLDM — Destinos múltiples de transmisión
--
-- Reemplaza las 3 columnas fijas youtube/facebook/tiktok_egress_id en
-- platikas por un catálogo reutilizable de destinos (nombre + RTMP +
-- stream key cifrado) y un historial de egresos por plática — permite
-- transmitir a varios destinos simultáneos, incluyendo varios de la
-- misma plataforma. Ver
-- docs/superpowers/specs/2026-09-13-destinos-multiples-design.md.
-- ============================================================

CREATE TABLE destinos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  plataforma TEXT NOT NULL CHECK (plataforma IN ('youtube', 'facebook', 'tiktok', 'otro')),
  rtmp_url TEXT NOT NULL,
  stream_key_cifrado TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE platikas_stream_egresos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platika_id UUID NOT NULL REFERENCES platikas(id) ON DELETE CASCADE,
  destino_id UUID NOT NULL REFERENCES destinos(id),
  egress_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stopped_at TIMESTAMPTZ
);

CREATE INDEX idx_stream_egresos_platika ON platikas_stream_egresos(platika_id);
CREATE INDEX idx_stream_egresos_activos ON platikas_stream_egresos(destino_id) WHERE stopped_at IS NULL;

ALTER TABLE platikas
  DROP COLUMN IF EXISTS youtube_egress_id,
  DROP COLUMN IF EXISTS facebook_egress_id,
  DROP COLUMN IF EXISTS tiktok_egress_id;

-- ============================================================
-- RLS — mismo patrón que programa_audios (0038_programas.sql):
-- herramienta interna, solo admin/super_moderador.
-- ============================================================

ALTER TABLE destinos ENABLE ROW LEVEL SECURITY;
ALTER TABLE platikas_stream_egresos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "destinos_staff" ON destinos FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_moderador')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_moderador')));

CREATE POLICY "platikas_stream_egresos_staff" ON platikas_stream_egresos FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_moderador')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_moderador')));

-- GRANTs explícitos — sin esto, ni un usuario autenticado que pasa la
-- policy puede ejecutar la consulta (gotcha ya documentado varias
-- veces en este proyecto).
GRANT SELECT, INSERT, UPDATE, DELETE ON destinos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON platikas_stream_egresos TO authenticated;
```

- [ ] **Step 2: Aplicar la migración**

Run: `supabase db push`
Expected: `Finished supabase db push.` sin errores.

- [ ] **Step 3: Generar y configurar `DESTINOS_ENCRYPTION_KEY`**

Run: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

Copiar el valor generado. Agregarlo a `.env.local`:

```
DESTINOS_ENCRYPTION_KEY=<valor generado>
```

Agregar también a Vercel (pedir confirmación antes de correr este comando, ya que modifica configuración de producción):

Run: `vercel env add DESTINOS_ENCRYPTION_KEY production`
(pegar el mismo valor cuando lo pida)

- [ ] **Step 4: Documentar en `.env.example`**

Agregar al final del archivo `.env.example`:

```
# Cifrado de stream keys de Destinos — generar con:
# node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
DESTINOS_ENCRYPTION_KEY=
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0042_destinos_multiples.sql .env.example
git commit -m "feat: tablas destinos y platikas_stream_egresos"
```

(`.env.local` nunca se commitea — está en `.gitignore`.)

---

### Task 2: Helper de cifrado

**Files:**
- Create: `src/lib/crypto/destinos.ts`

- [ ] **Step 1: Escribir el helper**

```typescript
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.DESTINOS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("DESTINOS_ENCRYPTION_KEY no está configurada");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("DESTINOS_ENCRYPTION_KEY debe decodificar a 32 bytes (AES-256)");
  }
  return key;
}

// Formato del texto cifrado: "iv.authTag.ciphertext", cada parte en
// base64 — así no se necesita una columna aparte para el IV/tag.
export function encryptStreamKey(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decryptStreamKey(payload: string): string {
  const [ivB64, authTagB64, ciphertextB64] = payload.split(".");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Formato de stream key cifrado inválido");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
```

- [ ] **Step 2: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/crypto/destinos.ts
git commit -m "feat: helper de cifrado AES-256-GCM para stream keys"
```

---

### Task 3: Tipos de dominio

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Agregar los tipos al final del archivo**

```typescript

// ── Destinos múltiples de transmisión ──────────────────────────────────────────

export type DestinoPlataforma = "youtube" | "facebook" | "tiktok" | "otro";

export interface Destino {
  id: string;
  nombre: string;
  plataforma: DestinoPlataforma;
  rtmp_url: string;
  activo: boolean;
  created_at: string;
}

export interface DestinoConEstado {
  id: string;
  nombre: string;
  plataforma: DestinoPlataforma;
  rtmp_url: string;
  isActive: boolean;
  egresoId: string | null;
}
```

- [ ] **Step 2: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: tipos Destino y DestinoConEstado"
```

---

### Task 4: API del catálogo — `/api/destinos`

**Files:**
- Create: `src/app/api/destinos/route.ts`

- [ ] **Step 1: Escribir la ruta**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptStreamKey } from "@/lib/crypto/destinos";

const PLATAFORMAS = ["youtube", "facebook", "tiktok", "otro"];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_moderador"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("destinos")
    .select("id, nombre, plataforma, rtmp_url, activo, created_at")
    .eq("activo", true)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ destinos: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_moderador"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { nombre, plataforma, rtmp_url, stream_key } = body as {
    nombre?: string;
    plataforma?: string;
    rtmp_url?: string;
    stream_key?: string;
  };

  if (!nombre?.trim() || !plataforma || !rtmp_url?.trim() || !stream_key?.trim()) {
    return NextResponse.json(
      { error: "nombre, plataforma, rtmp_url y stream_key son requeridos" },
      { status: 400 }
    );
  }
  if (!PLATAFORMAS.includes(plataforma)) {
    return NextResponse.json({ error: "Plataforma inválida" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("destinos")
    .insert({
      nombre: nombre.trim(),
      plataforma,
      rtmp_url: rtmp_url.trim(),
      stream_key_cifrado: encryptStreamKey(stream_key.trim()),
      created_by: user.id,
    })
    .select("id, nombre, plataforma, rtmp_url, activo, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ destino: data });
}
```

- [ ] **Step 2: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/destinos/route.ts
git commit -m "feat: API para listar y crear destinos"
```

---

### Task 5: API de edición/borrado — `/api/destinos/[id]`

**Files:**
- Create: `src/app/api/destinos/[id]/route.ts`

- [ ] **Step 1: Escribir la ruta**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptStreamKey } from "@/lib/crypto/destinos";

const PLATAFORMAS = ["youtube", "facebook", "tiktok", "otro"];

async function tieneEgresoActivo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  destinoId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("platikas_stream_egresos")
    .select("id")
    .eq("destino_id", destinoId)
    .is("stopped_at", null)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_moderador"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (await tieneEgresoActivo(supabase, id)) {
    return NextResponse.json(
      { error: "No se puede editar un destino mientras está transmitiendo" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { nombre, plataforma, rtmp_url, stream_key } = body as {
    nombre?: string;
    plataforma?: string;
    rtmp_url?: string;
    stream_key?: string;
  };

  if (plataforma && !PLATAFORMAS.includes(plataforma)) {
    return NextResponse.json({ error: "Plataforma inválida" }, { status: 400 });
  }

  const update: Record<string, string> = { updated_at: new Date().toISOString() };
  if (nombre?.trim()) update.nombre = nombre.trim();
  if (plataforma) update.plataforma = plataforma;
  if (rtmp_url?.trim()) update.rtmp_url = rtmp_url.trim();
  if (stream_key?.trim()) update.stream_key_cifrado = encryptStreamKey(stream_key.trim());

  const { data, error } = await supabase
    .from("destinos")
    .update(update)
    .eq("id", id)
    .select("id, nombre, plataforma, rtmp_url, activo, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ destino: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_moderador"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (await tieneEgresoActivo(supabase, id)) {
    return NextResponse.json(
      { error: "No se puede borrar un destino mientras está transmitiendo" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("destinos")
    .update({ activo: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/destinos/[id]/route.ts"
git commit -m "feat: API para editar y borrar destinos"
```

---

### Task 6: API de estado por plática — `/api/platikas/[id]/destinos`

**Files:**
- Create: `src/app/api/platikas/[id]/destinos/route.ts`

- [ ] **Step 1: Escribir la ruta**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DestinoConEstado } from "@/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_moderador"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: destinos, error: destinosError } = await supabase
    .from("destinos")
    .select("id, nombre, plataforma, rtmp_url")
    .eq("activo", true)
    .order("created_at", { ascending: true });

  if (destinosError) return NextResponse.json({ error: destinosError.message }, { status: 500 });

  const { data: egresosActivos, error: egresosError } = await supabase
    .from("platikas_stream_egresos")
    .select("id, destino_id")
    .eq("platika_id", id)
    .is("stopped_at", null);

  if (egresosError) return NextResponse.json({ error: egresosError.message }, { status: 500 });

  const activosPorDestino = new Map(
    (egresosActivos ?? []).map((e: { id: string; destino_id: string }) => [e.destino_id, e.id])
  );

  const resultado: DestinoConEstado[] = (destinos ?? []).map((d) => ({
    id: d.id,
    nombre: d.nombre,
    plataforma: d.plataforma,
    rtmp_url: d.rtmp_url,
    isActive: activosPorDestino.has(d.id),
    egresoId: activosPorDestino.get(d.id) ?? null,
  }));

  return NextResponse.json({ destinos: resultado });
}
```

- [ ] **Step 2: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/platikas/[id]/destinos/route.ts"
git commit -m "feat: API de estado de destinos por platica"
```

---

### Task 7: API de toggle — reemplaza `stream-toggle`

**Files:**
- Create: `src/app/api/platikas/[id]/destinos/[destinoId]/toggle/route.ts`
- Delete: `src/app/api/platikas/[id]/stream-toggle/route.ts`

- [ ] **Step 1: Escribir la nueva ruta**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EgressClient, StreamOutput, StreamProtocol } from "livekit-server-sdk";
import { decryptStreamKey } from "@/lib/crypto/destinos";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; destinoId: string }> }
) {
  const { id, destinoId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: pláticas } = await supabase
    .from("platikas")
    .select("*")
    .eq("id", id)
    .single();

  if (!pláticas) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pláticas.status !== "live") {
    return NextResponse.json({ error: "Pláticas not live" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isHost = pláticas.host_id === user.id;
  const isAdmin = profile?.role === "admin";
  if (!isHost && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { action } = body as { action?: "start" | "stop" };
  if (action !== "start" && action !== "stop") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const egressClient = new EgressClient(
    process.env.LIVEKIT_URL!,
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!
  );

  if (action === "stop") {
    const { data: egreso } = await supabase
      .from("platikas_stream_egresos")
      .select("id, egress_id")
      .eq("platika_id", id)
      .eq("destino_id", destinoId)
      .is("stopped_at", null)
      .single();

    if (!egreso) {
      return NextResponse.json(
        { error: "No hay una transmisión activa para este destino" },
        { status: 400 }
      );
    }

    try {
      await egressClient.stopEgress(egreso.egress_id);
    } catch {
      // El egress puede haber terminado ya por su cuenta
    }

    await supabase
      .from("platikas_stream_egresos")
      .update({ stopped_at: new Date().toISOString() })
      .eq("id", egreso.id);

    return NextResponse.json({ isActive: false });
  }

  // action === "start"
  const { data: existingActive } = await supabase
    .from("platikas_stream_egresos")
    .select("id")
    .eq("platika_id", id)
    .eq("destino_id", destinoId)
    .is("stopped_at", null)
    .limit(1);

  if ((existingActive?.length ?? 0) > 0) {
    return NextResponse.json(
      { error: "Ya hay una transmisión activa para este destino" },
      { status: 400 }
    );
  }
  if (!pláticas.livekit_room_name) {
    return NextResponse.json({ error: "No hay sala LiveKit activa" }, { status: 400 });
  }

  const { data: destino } = await supabase
    .from("destinos")
    .select("rtmp_url, stream_key_cifrado")
    .eq("id", destinoId)
    .eq("activo", true)
    .single();

  if (!destino) return NextResponse.json({ error: "Destino no encontrado" }, { status: 404 });

  const streamKey = decryptStreamKey(destino.stream_key_cifrado);
  const separator = destino.rtmp_url.endsWith("/") ? "" : "/";
  const streamUrl = `${destino.rtmp_url}${separator}${streamKey}`;

  try {
    const egressInfo = await egressClient.startRoomCompositeEgress(
      pláticas.livekit_room_name,
      new StreamOutput({
        protocol: StreamProtocol.RTMP,
        urls: [streamUrl],
      }),
      { layout: "speaker" }
    );

    await supabase.from("platikas_stream_egresos").insert({
      platika_id: id,
      destino_id: destinoId,
      egress_id: egressInfo.egressId,
    });

    return NextResponse.json({ isActive: true, egresoId: egressInfo.egressId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al iniciar la transmisión" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Borrar la ruta vieja**

Run: `rm "src/app/api/platikas/[id]/stream-toggle/route.ts"`
(en PowerShell: `Remove-Item "src/app/api/platikas/[id]/stream-toggle/route.ts"`)

- [ ] **Step 3: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/platikas/[id]/destinos/[destinoId]/toggle/route.ts"
git rm "src/app/api/platikas/[id]/stream-toggle/route.ts"
git commit -m "feat: toggle de destinos por platica, reemplaza stream-toggle"
```

---

### Task 8: Estilos compartidos por plataforma

**Files:**
- Create: `src/lib/platikas/destino-estilos.ts`

- [ ] **Step 1: Escribir el archivo**

```typescript
import { PlaySquare, Globe, Music2, Link2 } from "lucide-react";
import type { DestinoPlataforma } from "@/types";

export const DESTINO_ESTILOS: Record<
  DestinoPlataforma,
  {
    label: string;
    icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
    accentColor: string;
  }
> = {
  youtube: { label: "YouTube", icon: PlaySquare, accentColor: "#FF0000" },
  facebook: { label: "Facebook", icon: Globe, accentColor: "#1877F2" },
  tiktok: { label: "TikTok", icon: Music2, accentColor: "#69C9D0" },
  otro: { label: "Otro", icon: Link2, accentColor: "#D4A017" },
};
```

- [ ] **Step 2: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/platikas/destino-estilos.ts
git commit -m "feat: mapa de estilos por plataforma de destino"
```

---

### Task 9: Componente `DestinoCard`

**Files:**
- Create: `src/components/platikas/DestinoCard.tsx`

- [ ] **Step 1: Escribir el componente**

```tsx
"use client";

import { Loader2, Pencil, Trash2 } from "lucide-react";
import { DESTINO_ESTILOS } from "@/lib/platikas/destino-estilos";
import type { DestinoConEstado } from "@/types";

interface DestinoCardProps {
  destino: DestinoConEstado;
  loading: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function DestinoCard({ destino, loading, onToggle, onEdit, onDelete }: DestinoCardProps) {
  const estilo = DESTINO_ESTILOS[destino.plataforma];
  const Icon = estilo.icon;

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2.5"
      style={{
        background: "var(--color-surface-elevated)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${estilo.accentColor}1A` }}
        >
          <Icon size={14} style={{ color: estilo.accentColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
            {destino.nombre}
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {estilo.label}
          </p>
        </div>
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${destino.isActive ? "animate-pulse" : ""}`}
          style={{ background: destino.isActive ? "var(--color-success)" : "var(--color-border)" }}
          title={destino.isActive ? "Transmitiendo" : "Inactivo"}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all"
          style={
            destino.isActive
              ? {
                  background: "rgba(248,113,113,0.15)",
                  border: "1px solid rgba(248,113,113,0.3)",
                  color: "var(--color-destructive)",
                }
              : { background: "var(--color-primary)", color: "#000" }
          }
        >
          {loading && <Loader2 size={13} className="animate-spin" />}
          {destino.isActive ? "Detener" : "Iniciar transmisión"}
        </button>
        <button
          onClick={onEdit}
          disabled={destino.isActive}
          className="p-2 rounded-lg disabled:opacity-30"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          title="Editar destino"
        >
          <Pencil size={13} style={{ color: "var(--color-text-muted)" }} />
        </button>
        <button
          onClick={onDelete}
          disabled={destino.isActive}
          className="p-2 rounded-lg disabled:opacity-30"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          title="Borrar destino"
        >
          <Trash2 size={13} style={{ color: "var(--color-destructive)" }} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/platikas/DestinoCard.tsx
git commit -m "feat: componente DestinoCard"
```

---

### Task 10: Componente `DestinoFormModal`

**Files:**
- Create: `src/components/platikas/DestinoFormModal.tsx`

- [ ] **Step 1: Escribir el componente**

```tsx
"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, X } from "lucide-react";
import { DESTINO_ESTILOS } from "@/lib/platikas/destino-estilos";
import type { DestinoConEstado, DestinoPlataforma } from "@/types";

interface DestinoFormModalProps {
  destino: DestinoConEstado | null; // null = crear nuevo
  onClose: () => void;
  onSaved: () => void;
}

const PLATAFORMAS: DestinoPlataforma[] = ["youtube", "facebook", "tiktok", "otro"];

export function DestinoFormModal({ destino, onClose, onSaved }: DestinoFormModalProps) {
  const [nombre, setNombre] = useState(destino?.nombre ?? "");
  const [plataforma, setPlataforma] = useState<DestinoPlataforma>(destino?.plataforma ?? "youtube");
  const [rtmpUrl, setRtmpUrl] = useState(destino?.rtmp_url ?? "");
  const [streamKey, setStreamKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!destino;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !rtmpUrl.trim() || (!isEditing && !streamKey.trim())) {
      setError("Nombre, URL RTMP y stream key son requeridos");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const url = isEditing ? `/api/destinos/${destino!.id}` : "/api/destinos";
      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          plataforma,
          rtmp_url: rtmpUrl.trim(),
          ...(streamKey.trim() ? { stream_key: streamKey.trim() } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Error al guardar el destino");
        return;
      }

      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
            {isEditing ? "Editar destino" : "Agregar destino"}
          </h3>
          <button onClick={onClose} style={{ color: "var(--color-text-muted)" }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
              Nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder='Ej: &quot;YouTube Iglesia Central&quot;'
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
              Plataforma
            </label>
            <select
              value={plataforma}
              onChange={(e) => setPlataforma(e.target.value as DestinoPlataforma)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              {PLATAFORMAS.map((p) => (
                <option key={p} value={p}>
                  {DESTINO_ESTILOS[p].label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
              URL RTMP
            </label>
            <input
              type="text"
              value={rtmpUrl}
              onChange={(e) => setRtmpUrl(e.target.value)}
              placeholder="rtmp://a.rtmp.youtube.com/live2"
              className="w-full px-3 py-2 rounded-lg text-xs"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
              Stream key {isEditing && "(déjalo vacío para no cambiarlo)"}
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={streamKey}
                onChange={(e) => setStreamKey(e.target.value)}
                placeholder={isEditing ? "••••••••" : "Stream key"}
                className="w-full px-3 py-2 pr-9 rounded-lg text-xs"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ color: "var(--color-text-muted)" }}
                tabIndex={-1}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm transition-all"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {isEditing ? "Guardar cambios" : "Agregar destino"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/platikas/DestinoFormModal.tsx
git commit -m "feat: componente DestinoFormModal"
```

---

### Task 11: Componente `DestinationsPanel`

**Files:**
- Create: `src/components/platikas/DestinationsPanel.tsx`

- [ ] **Step 1: Escribir el componente**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { DestinoCard } from "./DestinoCard";
import { DestinoFormModal } from "./DestinoFormModal";
import type { DestinoConEstado } from "@/types";

interface DestinationsPanelProps {
  platikaId: string;
}

export function DestinationsPanel({ platikaId }: DestinationsPanelProps) {
  const [destinos, setDestinos] = useState<DestinoConEstado[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [modalDestino, setModalDestino] = useState<DestinoConEstado | null | "new">(null);

  async function loadDestinos() {
    const res = await fetch(`/api/platikas/${platikaId}/destinos`);
    if (res.ok) {
      const data = await res.json();
      setDestinos(data.destinos);
    }
  }

  useEffect(() => {
    loadDestinos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platikaId]);

  async function toggleDestino(destino: DestinoConEstado) {
    setLoadingId(destino.id);
    try {
      const res = await fetch(`/api/platikas/${platikaId}/destinos/${destino.id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: destino.isActive ? "stop" : "start" }),
      });
      if (res.ok) await loadDestinos();
    } finally {
      setLoadingId(null);
    }
  }

  async function deleteDestino(destino: DestinoConEstado) {
    if (!confirm(`¿Borrar el destino "${destino.nombre}"?`)) return;
    await fetch(`/api/destinos/${destino.id}`, { method: "DELETE" });
    await loadDestinos();
  }

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          Transmisión a plataformas
        </p>
        <button
          onClick={() => setModalDestino("new")}
          className="flex items-center gap-1 text-xs font-semibold"
          style={{ color: "var(--color-primary)" }}
        >
          <Plus size={14} />
          Agregar destino
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {destinos.length === 0 && (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            No hay destinos guardados todavía.
          </p>
        )}
        {destinos.map((destino) => (
          <DestinoCard
            key={destino.id}
            destino={destino}
            loading={loadingId === destino.id}
            onToggle={() => toggleDestino(destino)}
            onEdit={() => setModalDestino(destino)}
            onDelete={() => deleteDestino(destino)}
          />
        ))}
      </div>

      {modalDestino && (
        <DestinoFormModal
          destino={modalDestino === "new" ? null : modalDestino}
          onClose={() => setModalDestino(null)}
          onSaved={() => {
            setModalDestino(null);
            loadDestinos();
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/platikas/DestinationsPanel.tsx
git commit -m "feat: componente DestinationsPanel"
```

---

### Task 12: Integrar en `HostControls` y borrar código viejo

**Files:**
- Modify: `src/components/platikas/HostControls.tsx` (reescritura completa)
- Delete: `src/components/platikas/PlatformStreamCard.tsx`

- [ ] **Step 1: Reescribir `HostControls.tsx` completo**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StopCircle, Mic, Loader2 } from "lucide-react";
import { RequestQueue } from "./RequestQueue";
import { DestinationsPanel } from "./DestinationsPanel";
import { RadioBroadcastPanel } from "./RadioBroadcastPanel";
import { SpeakerControls } from "./SpeakerControls";
import type { ProgramaAudio } from "@/types";

interface HostControlsProps {
  platikaId: string;
  isLive: boolean;
  onGoLive?: () => void;
  onEnd?: () => void;
  onSpeakerApproved?: (token: string, wsUrl: string) => void;
  programaAudios?: ProgramaAudio[];
}

export function HostControls({
  platikaId,
  isLive,
  onGoLive,
  onEnd,
  onSpeakerApproved,
  programaAudios,
}: HostControlsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function goLive() {
    setLoading("live");
    try {
      const res = await fetch(`/api/platikas/${platikaId}/go-live`, { method: "POST" });
      if (res.ok) {
        onGoLive?.();
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  async function endPlatica() {
    if (!confirm("¿Terminar la plática? No podrá reanudarse.")) return;
    setLoading("end");
    try {
      await fetch(`/api/platikas/${platikaId}/end`, { method: "POST" });
      onEnd?.();
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Live / End controls */}
      <div
        className="rounded-2xl p-4 flex flex-col gap-3"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          Controles del anfitrión
        </p>

        <div className="flex flex-col gap-2">
          {!isLive ? (
            <>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Estás en backstage: prueba tu mic y cámara. Nadie más te ve ni te escucha todavía.
              </p>
              <button
                onClick={goLive}
                disabled={loading === "live"}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all"
                style={{ background: "var(--color-primary)", color: "#000" }}
                onMouseEnter={(e) => {
                  if (loading !== "live") (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(212,160,23,0.4)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                {loading === "live" ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
                Salir al aire
              </button>
            </>
          ) : (
            <button
              onClick={endPlatica}
              disabled={loading === "end"}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: "rgba(248,113,113,0.15)",
                border: "1px solid rgba(248,113,113,0.3)",
                color: "var(--color-destructive)",
              }}
            >
              {loading === "end" ? <Loader2 size={16} className="animate-spin" /> : <StopCircle size={16} />}
              Terminar plática
            </button>
          )}

          {isLive && <RadioBroadcastPanel platikaId={platikaId} programaAudios={programaAudios} />}
        </div>
      </div>

      {/* Destinos de streaming — solo visible en vivo */}
      {isLive && <DestinationsPanel platikaId={platikaId} />}

      {/* Speakers on stage — mute/remove guests — only visible when live */}
      {isLive && <SpeakerControls platikaId={platikaId} />}

      {/* Request queue — only visible when live */}
      {isLive && (
        <RequestQueue
          platikaId={platikaId}
          onApprove={onSpeakerApproved}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Borrar el componente viejo**

Run: `rm src/components/platikas/PlatformStreamCard.tsx`
(en PowerShell: `Remove-Item src/components/platikas/PlatformStreamCard.tsx`)

- [ ] **Step 3: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/platikas/HostControls.tsx
git rm src/components/platikas/PlatformStreamCard.tsx
git commit -m "feat: HostControls usa DestinationsPanel, elimina plataformas fijas"
```

---

### Task 13: Build, deploy y verificación manual

- [ ] **Step 1: Build completo**

Run: `pnpm run build`
Expected: build exitoso, sin errores de tipos ni de compilación.

- [ ] **Step 2: Push**

```bash
git push origin master
```

- [ ] **Step 3: Esperar deploy de Vercel**

Run: `vercel ls` hasta ver el nuevo deployment en estado `Ready`.

- [ ] **Step 4: Verificación manual en producción**

1. Confirmar que `DESTINOS_ENCRYPTION_KEY` esté configurada en Vercel (Task 1, Step 3) — si falta, cualquier intento de iniciar transmisión falla con 500.
2. Crear una sesión de prueba (backstage) y salir al aire.
3. En el panel "Transmisión a plataformas", agregar un destino de prueba (nombre + plataforma + URL RTMP + stream key — puede ser un valor inventado, no hace falta que sea válido para verificar el flujo de guardado/cifrado).
4. Confirmar en la base de datos (vía REST con la service role key) que `destinos.stream_key_cifrado` NO es el texto plano ingresado.
5. Editar el destino (cambiar el nombre) sin tocar el stream key — confirmar que se actualiza el nombre y el cifrado no cambia.
6. Confirmar que el botón "Iniciar transmisión" y "editar/borrar" respetan el estado activo (no se puede editar/borrar mientras transmite) — esto puede verificarse leyendo el código y probando el toggle con una URL RTMP inválida para ver el error 500 controlado sin romper la UI.
7. Borrar el destino de prueba.
8. Terminar la sesión de prueba limpiamente (vía DB directa, igual que en el plan de backstage, para evitar el diálogo `confirm()` nativo del navegador durante pruebas automatizadas).

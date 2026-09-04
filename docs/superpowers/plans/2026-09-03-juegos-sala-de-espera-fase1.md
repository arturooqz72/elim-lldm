# Sala de Espera — Fase 1 (Arena Abierta) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Arena Abierta into the first real "puerta" of the new `/juegos` vestíbulo — cuenta obligatoria para jugar, número de jugadores elegible con opción de arrancar antes, y un `/juegos` que muestra su estado en vivo (ocupado/disponible) en vez de una tarjeta estática. Elim Arena y Trivia en Vivo se ocultan del menú (su código sigue vivo, solo dejan de anunciarse) — se retiran de verdad en una fase posterior, una vez que Ruleta también esté convertida.

**Architecture:** Todo lo nuevo vive dentro de `src/lib/arena-publica/` (ya existente) y los archivos de Arena Abierta construidos en esta misma sesión. No se toca el esquema de Ruleta ni de Elim Arena en esta fase — solo se les quita visibilidad del menú. El mecanismo de "cuántos jugadores" se resuelve con una nueva columna `jugadores_deseados` en `arena_publica_salas`, decidida por quien termina creando la sala (irrelevante para quien se une a una que ya existe), y una función compartida `tryStartCounting()` que reemplaza la lógica duplicada de disparo de cuenta regresiva que hoy vive en dos lugares distintos.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Supabase (Postgres + Realtime), mismo stack ya usado por Arena Abierta.

**No incluido en esta fase (planes aparte, después de que esto esté en producción):**
- Migrar Ruleta en línea al mismo patrón sin código (requiere leer a fondo `src/lib/ruleta/`, `src/app/api/ruleta/**` antes de poder escribir un plan con código real — no se puede hacer con honestidad todavía).
- Borrar de verdad el código de Elim Arena y Trivia en Vivo (en esta fase solo se ocultan del menú — su código y sus rutas siguen funcionando por si alguien tenía un link directo).
- Agregar un tercer juego.

---

## Task 1: Migración — columnas `jugadores_deseados` y `user_id`

**Files:**
- Create: `supabase/migrations/0023_arena_publica_jugadores_deseados.sql`

- [ ] **Paso 1: Escribir la migración**

```sql
-- "¿Cuántos van a jugar?" — quien termina creando la sala (ver
-- getOrCreateOpenRoom()) elige un número entre MIN_JUGADORES_PARA_INICIAR y
-- MAX_JUGADORES_POR_SALA; la sala espera a llegar a ese número antes de
-- arrancar sola, pero cualquier jugador ya adentro puede forzar el arranque
-- antes vía /api/arena-publica/force-start una vez alcanzado el mínimo.
ALTER TABLE arena_publica_salas
  ADD COLUMN jugadores_deseados INT NOT NULL DEFAULT 2
    CHECK (jugadores_deseados BETWEEN 2 AND 6);

-- Ya no se acepta jugar sin cuenta — se guarda quién es cada jugador. Queda
-- NULLABLE a nivel de columna porque las salas ya jugadas antes de este
-- cambio no tienen este dato y no hay forma honesta de rellenarlo; el
-- API (/api/arena-publica/join) es quien exige que todo jugador NUEVO sí
-- lo traiga.
ALTER TABLE arena_publica_jugadores
  ADD COLUMN user_id UUID REFERENCES profiles(id);

-- Evita que la misma cuenta ocupe dos lugares en la misma sala (dos
-- pestañas abiertas a la vez, por ejemplo).
CREATE UNIQUE INDEX idx_arena_publica_jugadores_sala_user
  ON arena_publica_jugadores (sala_id, user_id) WHERE user_id IS NOT NULL;
```

- [ ] **Paso 2: Aplicar en el SQL Editor de Supabase de producción**

Pegar el SQL completo de arriba (vía `window.monaco.editor.getEditors()[0].setValue(sql)` si el tipeo directo falla, como en migraciones anteriores de esta sesión), dar Run, confirmar el modal de "potentially destructive" si aparece (agregar columnas no es destructivo pero Supabase igual lo marca), y verificar con:

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name in ('arena_publica_salas','arena_publica_jugadores')
  and column_name in ('jugadores_deseados','user_id');
```

Expected: 2 filas — `jugadores_deseados` (integer, NO, 2) y `user_id` (uuid, YES, null).

- [ ] **Paso 3: Commit**

```bash
git add supabase/migrations/0023_arena_publica_jugadores_deseados.sql
git commit -m "Add jugadores_deseados and user_id columns to Arena Abierta"
```

---

## Task 2: Actualizar tipos compartidos

**Files:**
- Modify: `src/types/index.ts:276-283` (`ArenaJugador`)
- Modify: `src/lib/arena-publica/room.server.ts:6-14` (`SalaActual`)

- [ ] **Paso 1: Agregar `user_id` a `ArenaJugador`**

En `src/types/index.ts`, reemplazar:

```typescript
export interface ArenaJugador {
  id: string;
  sala_id: string;
  nombre: string;
  puntos: number;
  ultimo_respondido_at: string | null;
  created_at: string;
}
```

por:

```typescript
export interface ArenaJugador {
  id: string;
  sala_id: string;
  nombre: string;
  puntos: number;
  ultimo_respondido_at: string | null;
  created_at: string;
  user_id: string | null;
}
```

- [ ] **Paso 2: Agregar `jugadores_deseados` a `SalaActual`**

En `src/lib/arena-publica/room.server.ts`, reemplazar:

```typescript
export interface SalaActual {
  id: string;
  status: "lobby" | "counting" | "playing" | "reveal" | "finished";
  pregunta_actual: number;
  cuenta_termina_en: string | null;
  pregunta_termina_en: string | null;
  reveal_termina_en: string | null;
  created_at: string;
}
```

por:

```typescript
export interface SalaActual {
  id: string;
  status: "lobby" | "counting" | "playing" | "reveal" | "finished";
  pregunta_actual: number;
  jugadores_deseados: number;
  cuenta_termina_en: string | null;
  pregunta_termina_en: string | null;
  reveal_termina_en: string | null;
  created_at: string;
}
```

(Ambas tablas ya se leen con `select("*")` en todo el código existente, así que las columnas nuevas llegan solas — este paso solo le informa a TypeScript que existen.)

- [ ] **Paso 3: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores nuevos (van a aparecer errores en los archivos que todavía no se han tocado — se resuelven en los tasks siguientes).

---

## Task 3: `jugadoresDeseados` al crear sala + `tryStartCounting()` compartido

**Files:**
- Modify: `src/lib/arena-publica/room.server.ts`
- Modify: `src/lib/arena-publica/advance.server.ts`
- Modify: `src/lib/arena-publica/config.ts`

- [ ] **Paso 1: Agregar el máximo a la config**

En `src/lib/arena-publica/config.ts`, agregar después de `MIN_JUGADORES_PARA_INICIAR`:

```typescript
export const MIN_JUGADORES_PARA_INICIAR = 2;
export const MAX_JUGADORES_POR_SALA = 6;
```

- [ ] **Paso 2: `getOrCreateOpenRoom()` acepta el número deseado**

En `src/lib/arena-publica/room.server.ts`, cambiar la firma y el insert de la sala. Reemplazar:

```typescript
export async function getOrCreateOpenRoom(): Promise<{
  sala: SalaActual | null;
  error: string | null;
}> {
```

por:

```typescript
export async function getOrCreateOpenRoom(jugadoresDeseados = 2): Promise<{
  sala: SalaActual | null;
  error: string | null;
}> {
```

Y reemplazar:

```typescript
  const { data: nuevaSala, error: salaError } = await service
    .from("arena_publica_salas")
    .insert({ status: "lobby" })
    .select("*")
    .single();
```

por:

```typescript
  const { data: nuevaSala, error: salaError } = await service
    .from("arena_publica_salas")
    .insert({ status: "lobby", jugadores_deseados: jugadoresDeseados })
    .select("*")
    .single();
```

(El valor solo se usa si esta llamada es la que efectivamente crea la sala. Si ya existía una en 'lobby'/'counting', se devuelve tal cual — su `jugadores_deseados` ya quedó fijo por quien la creó primero. Esto es intencional: no tiene sentido que el segundo en llegar cambie la meta del primero.)

- [ ] **Paso 3: Extraer `tryStartCounting()` en `advance.server.ts`**

En `src/lib/arena-publica/advance.server.ts`, agregar esta función nueva (antes de `advanceRoomOnce`, después de `broadcast`):

```typescript
/**
 * Intenta pasar la sala de 'lobby' a 'counting'. La llaman tres caminos
 * distintos con el mismo resultado esperado — el propio join al llegar al
 * umbral, la auto-sanación de una sala 'lobby' atascada, y el botón
 * "empezar con los que hay" — así que vive en un solo lugar en vez de
 * triplicarse.
 *
 * requireTarget=true exige llegar a jugadores_deseados (el camino normal).
 * requireTarget=false solo exige el piso absoluto MIN_JUGADORES_PARA_INICIAR
 * — es el atajo que usa el botón de "empezar antes".
 */
export async function tryStartCounting(
  salaId: string,
  requireTarget: boolean
): Promise<{ applied: boolean; error?: string }> {
  const service = await createServiceClient();

  const { data: sala, error: salaError } = await service
    .from("arena_publica_salas")
    .select("status, jugadores_deseados")
    .eq("id", salaId)
    .maybeSingle();

  if (salaError) return { applied: false, error: salaError.message };
  if (!sala || sala.status !== "lobby") return { applied: false };

  const { count, error: countError } = await service
    .from("arena_publica_jugadores")
    .select("id", { count: "exact", head: true })
    .eq("sala_id", salaId);

  if (countError) return { applied: false, error: countError.message };

  const umbral = requireTarget ? sala.jugadores_deseados : MIN_JUGADORES_PARA_INICIAR;
  if ((count ?? 0) < umbral) return { applied: false };

  const cuentaTerminaEn = Date.now() + COUNTDOWN_SECONDS * 1000;
  const { data: updated, error: updateError } = await service
    .from("arena_publica_salas")
    .update({ status: "counting", cuenta_termina_en: new Date(cuentaTerminaEn).toISOString() })
    .eq("id", salaId)
    .eq("status", "lobby")
    .select("id");

  if (updateError) return { applied: false, error: updateError.message };

  if (updated && updated.length > 0) {
    await broadcast(salaId, "COUNTDOWN_START", { cuentaTerminaEn });
    return { applied: true };
  }

  return { applied: false };
}
```

- [ ] **Paso 4: `advanceRoomOnce()` usa `tryStartCounting()` en vez de su propia copia**

En el mismo archivo, reemplazar todo el bloque de la Transición 0 (desde `if (sala.status === "lobby") {` hasta su `}` de cierre, justo antes de `// Transición 1:`) por:

```typescript
  if (sala.status === "lobby") {
    return tryStartCounting(salaId, true);
  }
```

- [ ] **Paso 5: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores en `advance.server.ts` ni `room.server.ts`. Van a seguir apareciendo errores en `join/route.ts` hasta el Task 5.

- [ ] **Paso 6: Commit**

```bash
git add src/lib/arena-publica/
git commit -m "Extract tryStartCounting() and add jugadores_deseados support"
```

---

## Task 4: Ruta para "empezar con los que hay"

**Files:**
- Create: `src/app/api/arena-publica/force-start/route.ts`

- [ ] **Paso 1: Escribir la ruta**

```typescript
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { tryStartCounting } from "@/lib/arena-publica/advance.server";

export async function POST(request: Request) {
  let body: { sala_id?: string; jugador_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const { sala_id, jugador_id } = body;
  if (!sala_id || !jugador_id) {
    return NextResponse.json({ error: "sala_id y jugador_id requeridos" }, { status: 400 });
  }

  const service = await createServiceClient();

  const { data: jugador } = await service
    .from("arena_publica_jugadores")
    .select("id")
    .eq("id", jugador_id)
    .eq("sala_id", sala_id)
    .maybeSingle();

  if (!jugador) {
    return NextResponse.json({ error: "No eres jugador de esta sala" }, { status: 403 });
  }

  const { applied, error } = await tryStartCounting(sala_id, false);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ applied });
}
```

- [ ] **Paso 2: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores.

- [ ] **Paso 3: Commit**

```bash
git add src/app/api/arena-publica/force-start/
git commit -m "Add force-start endpoint for Arena Abierta lobbies"
```

---

## Task 5: Cuenta obligatoria para unirse

**Files:**
- Modify: `src/app/api/arena-publica/join/route.ts`

- [ ] **Paso 1: Reescribir la ruta completa**

Reemplazar todo el archivo por:

```typescript
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getOrCreateOpenRoom } from "@/lib/arena-publica/room.server";
import { tryStartCounting } from "@/lib/arena-publica/advance.server";
import { MIN_JUGADORES_PARA_INICIAR, MAX_JUGADORES_POR_SALA } from "@/lib/arena-publica/config";

export async function POST(request: Request) {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para jugar" }, { status: 401 });
  }

  let body: { jugadores_deseados?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const jugadoresDeseados = Math.max(
    MIN_JUGADORES_PARA_INICIAR,
    Math.min(MAX_JUGADORES_POR_SALA, Math.round(body.jugadores_deseados ?? MIN_JUGADORES_PARA_INICIAR))
  );

  const { data: profile } = await authClient
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  const nombre = (profile?.display_name ?? "Jugador").slice(0, 20);

  const { sala, error: salaError } = await getOrCreateOpenRoom(jugadoresDeseados);
  if (salaError || !sala) {
    return NextResponse.json({ error: salaError ?? "No hay sala disponible" }, { status: 500 });
  }

  if (sala.status !== "lobby" && sala.status !== "counting") {
    return NextResponse.json(
      { error: "La partida actual ya empezó — espera a que termine para unirte a la siguiente." },
      { status: 400 }
    );
  }

  const service = await createServiceClient();

  // Re-verifica el estado justo antes de insertar: si la sala pasó a
  // 'playing' en la ventana entre el getOrCreateOpenRoom() de arriba y este
  // punto, evitamos insertar un jugador "fantasma" en una partida que ya
  // arrancó y que nunca podrá jugar.
  const { data: salaFresca, error: salaFrescaError } = await service
    .from("arena_publica_salas")
    .select("status")
    .eq("id", sala.id)
    .single();

  if (salaFrescaError || !salaFresca) {
    return NextResponse.json(
      { error: salaFrescaError?.message ?? "No hay sala disponible" },
      { status: 500 }
    );
  }

  if (salaFresca.status !== "lobby" && salaFresca.status !== "counting") {
    return NextResponse.json(
      { error: "La partida actual ya empezó — espera a que termine para unirte a la siguiente." },
      { status: 400 }
    );
  }

  const { data: existente } = await service
    .from("arena_publica_jugadores")
    .select("id")
    .eq("sala_id", sala.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existente) {
    return NextResponse.json({ jugador_id: existente.id, sala_id: sala.id });
  }

  const { data: jugador, error: insertError } = await service
    .from("arena_publica_jugadores")
    .insert({ sala_id: sala.id, nombre, puntos: 0, user_id: user.id })
    .select("id")
    .single();

  if (insertError || !jugador) {
    return NextResponse.json({ error: insertError?.message ?? "Error al unirse" }, { status: 500 });
  }

  await tryStartCounting(sala.id, true);

  return NextResponse.json({ jugador_id: jugador.id, sala_id: sala.id });
}
```

Cambios clave respecto a la versión anterior:
- Exige sesión al principio (401 si no hay).
- Ya no recibe `nombre` del cliente — usa `profiles.display_name`.
- Recibe `jugadores_deseados` opcional y lo pasa a `getOrCreateOpenRoom()`.
- Si la cuenta ya tiene un jugador en esa sala (recarga de página, doble clic), devuelve el mismo `jugador_id` en vez de fallar por el índice único `idx_arena_publica_jugadores_sala_user`.
- El disparo de cuenta regresiva ahora es una sola línea (`tryStartCounting`) en vez del bloque duplicado que había antes.

- [ ] **Paso 2: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores.

- [ ] **Paso 3: Commit**

```bash
git add src/app/api/arena-publica/join/route.ts
git commit -m "Require login to join Arena Abierta, drop free-text nombre"
```

---

## Task 6: Página de Arena Abierta exige sesión

**Files:**
- Modify: `src/app/(public)/arena-abierta/page.tsx`

- [ ] **Paso 1: Agregar el redirect**

Reemplazar:

```typescript
import { createClient } from "@/lib/supabase/server";
import { getOrCreateOpenRoom } from "@/lib/arena-publica/room.server";
import { ArenaPublicaRoom } from "@/components/arena-publica/ArenaPublicaRoom";
import type { ArenaJugador } from "@/types";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Arena Abierta — Elim LLDM" };

function toMs(iso: string | null): number | null {
  return iso === null ? null : new Date(iso).getTime();
}

export default async function ArenaAbiertaPage() {
  const { sala, error } = await getOrCreateOpenRoom();
```

por:

```typescript
import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { getOrCreateOpenRoom } from "@/lib/arena-publica/room.server";
import { ArenaPublicaRoom } from "@/components/arena-publica/ArenaPublicaRoom";
import type { ArenaJugador } from "@/types";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Arena Abierta — Elim LLDM" };

function toMs(iso: string | null): number | null {
  return iso === null ? null : new Date(iso).getTime();
}

export default async function ArenaAbiertaPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?returnUrl=/arena-abierta");

  const { sala, error } = await getOrCreateOpenRoom();
```

(No se le pasa un `jugadoresDeseados` aquí — este `getOrCreateOpenRoom()` de la carga de página es de solo-lectura de la sala existente para pintar la pantalla; el número elegido se manda desde el join, ver Task 7.)

- [ ] **Paso 2: Pasar el perfil al componente cliente**

Reemplazar el `return` final:

```typescript
  return (
    <ArenaPublicaRoom
      salaId={sala.id}
      status={sala.status}
      preguntaActual={sala.pregunta_actual}
      cuentaTerminaEn={toMs(sala.cuenta_termina_en)}
      preguntaTerminaEn={toMs(sala.pregunta_termina_en)}
      revealTerminaEn={toMs(sala.reveal_termina_en)}
      preguntas={preguntasRaw ?? []}
      jugadoresIniciales={(jugadoresRaw ?? []) as ArenaJugador[]}
    />
  );
```

por:

```typescript
  return (
    <ArenaPublicaRoom
      salaId={sala.id}
      status={sala.status}
      preguntaActual={sala.pregunta_actual}
      jugadoresDeseados={sala.jugadores_deseados}
      cuentaTerminaEn={toMs(sala.cuenta_termina_en)}
      preguntaTerminaEn={toMs(sala.pregunta_termina_en)}
      revealTerminaEn={toMs(sala.reveal_termina_en)}
      preguntas={preguntasRaw ?? []}
      jugadoresIniciales={(jugadoresRaw ?? []) as ArenaJugador[]}
    />
  );
```

- [ ] **Paso 3: Commit**

```bash
git add "src/app/(public)/arena-abierta/page.tsx"
git commit -m "Require login to view Arena Abierta"
```

---

## Task 7: `ArenaPublicaRoom` — sin nombre, con selector de jugadores y botón de arranque anticipado

**Files:**
- Modify: `src/components/arena-publica/ArenaPublicaRoom.tsx`
- Replace: `src/components/arena-publica/JoinPublicaForm.tsx` (se convierte en `EntrarForm.tsx`)
- Delete: `src/components/arena-publica/JoinPublicaForm.tsx` (renombrado — ver paso 1)

- [ ] **Paso 1: Reemplazar `JoinPublicaForm.tsx` por `EntrarForm.tsx`**

Borrar `src/components/arena-publica/JoinPublicaForm.tsx` y crear `src/components/arena-publica/EntrarForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { MIN_JUGADORES_PARA_INICIAR, MAX_JUGADORES_POR_SALA } from "@/lib/arena-publica/config";

interface EntrarFormProps {
  onEntrado: (jugadorId: string, salaId: string) => void;
}

export function EntrarForm({ onEntrado }: EntrarFormProps) {
  const [jugadoresDeseados, setJugadoresDeseados] = useState(MIN_JUGADORES_PARA_INICIAR);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opciones = Array.from(
    { length: MAX_JUGADORES_POR_SALA - MIN_JUGADORES_PARA_INICIAR + 1 },
    (_, i) => MIN_JUGADORES_PARA_INICIAR + i
  );

  async function handleEntrar() {
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/arena-publica/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jugadores_deseados: jugadoresDeseados }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo unir a la sala");
      setSubmitting(false);
      return;
    }

    const data = await res.json();
    onEntrado(data.jugador_id, data.sala_id);
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-10">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}
      >
        <Sparkles size={32} style={{ color: "var(--color-primary)" }} />
      </div>

      <div className="text-center flex flex-col gap-2">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          ¿Cuántos van a jugar?
        </h1>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Si al final no llegan todos, puedes empezar antes.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-center">
        {opciones.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setJugadoresDeseados(n)}
            className="w-11 h-11 rounded-xl font-mono font-semibold text-base transition-colors"
            style={{
              background: n === jugadoresDeseados ? "rgba(212,160,23,0.14)" : "var(--color-surface-elevated)",
              border: `1px solid ${n === jugadoresDeseados ? "var(--color-primary)" : "var(--color-border)"}`,
              color: n === jugadoresDeseados ? "var(--color-primary-light)" : "var(--color-text-muted)",
            }}
          >
            {n}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-center" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleEntrar}
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-lg font-bold transition-all duration-200"
        style={{
          background: !submitting ? "var(--color-primary)" : "var(--color-surface-elevated)",
          color: !submitting ? "#000" : "var(--color-text-muted)",
        }}
      >
        {submitting ? <Loader2 size={20} className="animate-spin" /> : <>Entrar a jugar <ArrowRight size={20} /></>}
      </button>
    </div>
  );
}
```

- [ ] **Paso 2: Actualizar `ArenaPublicaRoom.tsx`**

Cambiar el import (línea 10):

```typescript
import { JoinPublicaForm } from "./JoinPublicaForm";
```

por:

```typescript
import { EntrarForm } from "./EntrarForm";
```

Agregar `jugadoresDeseados` a las props (después de `preguntaActual: number;` en la interfaz `ArenaPublicaRoomProps`):

```typescript
interface ArenaPublicaRoomProps {
  salaId: string;
  status: ArenaPublicaPhase;
  preguntaActual: number;
  jugadoresDeseados: number;
  cuentaTerminaEn: number | null;
  preguntaTerminaEn: number | null;
  revealTerminaEn: number | null;
  preguntas: PreguntaPublica[];
  jugadoresIniciales: ArenaJugador[];
}
```

Y en la firma del componente:

```typescript
export function ArenaPublicaRoom({
  salaId,
  status,
  preguntaActual,
  jugadoresDeseados,
  cuentaTerminaEn,
  preguntaTerminaEn,
  revealTerminaEn,
  preguntas,
  jugadoresIniciales,
}: ArenaPublicaRoomProps) {
```

Reemplazar `handleJoined` completo (nombre de función y cuerpo — ya no recibe `nombre`, y guarda con la misma clave de localStorage que ya usaba):

```typescript
  function handleEntrado(id: string, sid: string) {
    if (sid !== salaId) {
      try {
        localStorage.setItem(`arena_publica_jugador_${sid}`, JSON.stringify({ id }));
      } catch {
        // localStorage no disponible
      }
      window.location.href = "/arena-abierta";
      return;
    }

    setJugadorId(id);
    try {
      localStorage.setItem(`arena_publica_jugador_${salaId}`, JSON.stringify({ id }));
    } catch {
      // localStorage no disponible
    }
  }
```

Reemplazar el uso de `JoinPublicaForm` en el JSX:

```tsx
        {!jugadorId ? (
          <JoinPublicaForm onJoined={handleJoined} />
```

por:

```tsx
        {!jugadorId ? (
          <EntrarForm onEntrado={handleEntrado} />
```

Agregar el botón "Empezar con los que hay" en el bloque de `phase === "lobby"` — reemplazar:

```tsx
        ) : phase === "lobby" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <Clock size={36} style={{ color: "var(--color-primary)" }} />
            <p className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>
              esperando más jugadores...
            </p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {jugadores.length} {jugadores.length === 1 ? "jugador" : "jugadores"} en la sala
            </p>
          </div>
        ) : phase === "counting" ? (
```

por:

```tsx
        ) : phase === "lobby" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <Clock size={36} style={{ color: "var(--color-primary)" }} />
            <p className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>
              esperando más jugadores...
            </p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {jugadores.length} de {jugadoresDeseados} {jugadoresDeseados === 1 ? "jugador" : "jugadores"}
            </p>
            {jugadores.length >= MIN_JUGADORES_PARA_INICIAR && jugadores.length < jugadoresDeseados && (
              <button
                type="button"
                onClick={handleForceStart}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
              >
                Empezar con {jugadores.length}
              </button>
            )}
          </div>
        ) : phase === "counting" ? (
```

Agregar el import de `MIN_JUGADORES_PARA_INICIAR` (línea 12, junto a los otros imports de config):

```typescript
import { COUNTDOWN_SECONDS, ROUND_SECONDS, REVEAL_SECONDS, MIN_JUGADORES_PARA_INICIAR } from "@/lib/arena-publica/config";
```

Agregar `handleForceStart` — colocarlo justo después de `handleAdvance` (que ya existe):

```typescript
  const handleForceStart = useCallback(() => {
    if (!jugadorId) return;
    fetch("/api/arena-publica/force-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sala_id: salaId, jugador_id: jugadorId }),
    }).catch(() => {
      // best-effort: cualquier otro jugador puede volver a intentarlo
    });
  }, [salaId, jugadorId]);
```

- [ ] **Paso 3: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores. Si aparece un error de "jugadoresDeseados no usado" en algún lado revisar que efectivamente se usó en el JSX del paso 2.

- [ ] **Paso 4: Commit**

```bash
git add src/components/arena-publica/
git commit -m "Replace name entry with player-count picker and add force-start button"
```

---

## Task 8: `/juegos` — Arena Abierta se vuelve una puerta en vivo

**Files:**
- Modify: `src/app/(public)/juegos/page.tsx`
- Create: `src/lib/arena-publica/estado-puerta.server.ts`
- Create: `src/components/juegos/PuertaArenaAbierta.tsx`

- [ ] **Paso 1: Query del estado de la puerta**

Crear `src/lib/arena-publica/estado-puerta.server.ts`:

```typescript
// src/lib/arena-publica/estado-puerta.server.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface EstadoPuerta {
  disponible: boolean;
  jugandoAhora: number;
}

/**
 * Estado de la puerta de Arena Abierta para el vestíbulo de /juegos. No usa
 * getOrCreateOpenRoom() a propósito — esto es de solo lectura para pintar
 * una tarjeta, no debe crear una sala nueva solo porque alguien pasó por
 * /juegos sin intención de entrar.
 */
export async function getEstadoPuertaArenaAbierta(): Promise<EstadoPuerta> {
  const supabase = await createClient();

  const { data: salas } = await supabase
    .from("arena_publica_salas")
    .select("status")
    .in("status", ["lobby", "counting", "playing", "reveal"]);

  const hayUnaAbierta = (salas ?? []).some((s) => s.status === "lobby" || s.status === "counting");
  const jugandoAhora = (salas ?? []).filter((s) => s.status === "playing" || s.status === "reveal").length;

  return { disponible: hayUnaAbierta || jugandoAhora === 0, jugandoAhora };
}
```

(`disponible` es prácticamente siempre `true` — el multi-sala de hoy garantiza entrada instantánea. `jugandoAhora` es la señal roja/verde: si hay alguien en partida Y no hay ninguna sala en lobby esperando, la tarjeta se pinta roja pero el botón "Entrar" sigue funcionando — al entrar se abre una sala propia.)

- [ ] **Paso 2: Componente de la puerta**

Crear `src/components/juegos/PuertaArenaAbierta.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Sparkles, Share2 } from "lucide-react";

interface PuertaArenaAbiertaProps {
  disponible: boolean;
  jugandoAhora: number;
}

export function PuertaArenaAbierta({ disponible, jugandoAhora }: PuertaArenaAbiertaProps) {
  const rojo = jugandoAhora > 0 && !disponible;

  async function handleInvitar(e: React.MouseEvent) {
    e.preventDefault();
    const url = `${window.location.origin}/arena-abierta`;
    const shareData = { title: "Arena Abierta — Elim LLDM", text: "Únete a jugar trivia bíblica conmigo", url };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // canceló el share — no hacer nada más
      }
    }

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard no disponible
    }
  }

  return (
    <div
      className="flex flex-col gap-4 p-6 rounded-2xl"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.3)" }}
          >
            ⚡
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
              Arena Abierta
            </h2>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Trivia bíblica en vivo
            </p>
          </div>
        </div>

        <span
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide"
          style={{
            color: rojo ? "var(--color-live)" : "var(--color-success)",
            background: rojo ? "rgba(255,68,68,0.1)" : "rgba(74,222,128,0.1)",
            border: `1px solid ${rojo ? "rgba(255,68,68,0.3)" : "rgba(74,222,128,0.32)"}`,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "currentColor" }}
          />
          {rojo ? "Ocupado" : "Disponible"}
        </span>
      </div>

      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        {jugandoAhora > 0
          ? `${jugandoAhora} ${jugandoAhora === 1 ? "partida jugándose" : "partidas jugándose"} ahora — al entrar se abre una sala para ti`
          : "Nadie jugando — sé el primero"}
      </p>

      <div className="flex items-center gap-2">
        <Link
          href="/arena-abierta"
          className="flex-1 text-center px-4 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: "var(--color-primary)", color: "#000" }}
        >
          Entrar
        </Link>
        <button
          type="button"
          onClick={handleInvitar}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "rgba(37,211,102,0.1)", color: "#25D366", border: "1px solid rgba(37,211,102,0.25)" }}
        >
          <Share2 size={14} />
          Invitar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Paso 3: Reescribir `/juegos`**

Reemplazar todo `src/app/(public)/juegos/page.tsx` por:

```tsx
import { Gamepad2, RotateCw, Users, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { getEstadoPuertaArenaAbierta } from "@/lib/arena-publica/estado-puerta.server";
import { PuertaArenaAbierta } from "@/components/juegos/PuertaArenaAbierta";

export const metadata: Metadata = {
  title: "Juegos en línea — Elim LLDM",
  description: "Entra directo a jugar con otros miembros — sin códigos, sin esperar a nadie que organice.",
};

export default async function JuegosHubPage() {
  const estadoArenaAbierta = await getEstadoPuertaArenaAbierta();

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div
        className="py-12 px-4"
        style={{
          background: "linear-gradient(to bottom, rgba(212,160,23,0.05) 0%, transparent 100%)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div className="max-w-4xl mx-auto flex flex-col items-center text-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}
          >
            <Gamepad2 size={32} style={{ color: "var(--color-primary)" }} />
          </div>
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{ color: "var(--color-text)" }}>
              Juegos en línea
            </h1>
            <p style={{ color: "var(--color-text-muted)" }}>
              Elige una puerta y entra directo — sin códigos
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-4">
        <PuertaArenaAbierta
          disponible={estadoArenaAbierta.disponible}
          jugandoAhora={estadoArenaAbierta.jugandoAhora}
        />

        <Link
          href="/ruleta"
          className="flex items-center gap-4 p-6 rounded-2xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.3)" }}
          >
            <Users size={20} style={{ color: "#3B82F6" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
              Ruleta en línea
            </h2>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Crea una sala y comparte el código con hasta 6 amigos
            </p>
          </div>
          <ChevronRight size={18} style={{ color: "var(--color-text-muted)" }} />
        </Link>

        <a
          href="/juegos/ruleta-elimlldm.html"
          className="flex items-center gap-4 p-6 rounded-2xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: "rgba(29,158,117,0.08)", border: "1px solid rgba(29,158,117,0.3)" }}
          >
            <RotateCw size={20} style={{ color: "#1D9E75" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
              Ruleta de retos
            </h2>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Gira solo y descubre tu reto
            </p>
          </div>
          <ChevronRight size={18} style={{ color: "var(--color-text-muted)" }} />
        </a>
      </div>
    </div>
  );
}
```

Nota: esto asume la respuesta de la Pregunta abierta #1 más abajo (se retiran "Elim Arena", "Trivia en Vivo" y "Jugadores en línea" del hub; se conserva la ruleta decorativa por ahora). Si la respuesta es distinta, este archivo cambia en consecuencia — es el único paso del plan que depende de esa decisión.

- [ ] **Paso 4: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores.

- [ ] **Paso 5: Commit**

```bash
git add "src/app/(public)/juegos/page.tsx" src/lib/arena-publica/estado-puerta.server.ts src/components/juegos/PuertaArenaAbierta.tsx
git commit -m "Redesign /juegos hub: live door status for Arena Abierta"
```

---

## Task 9: Ocultar Elim Arena y Trivia en Vivo del menú principal

**Files:**
- Modify: `src/components/layout/PublicHeader.tsx:14-18`

- [ ] **Paso 1: Quitar los dos links**

Reemplazar:

```typescript
  { href: "/platikas", label: "Estudio en Vivo", icon: Mic },
  { href: "/juegos", label: "Juegos", icon: Gamepad2 },
  { href: "/trivia", label: "Trivia en vivo", icon: Sparkles },
  { href: "/arena", label: "Elim Arena", icon: Trophy },
  { href: "/archivo", label: "Archivo", icon: Archive },
```

por:

```typescript
  { href: "/platikas", label: "Estudio en Vivo", icon: Mic },
  { href: "/juegos", label: "Juegos en línea", icon: Gamepad2 },
  { href: "/archivo", label: "Archivo", icon: Archive },
```

Si `Sparkles` y/o `Trophy` quedan sin ningún otro uso en el archivo (revisar con grep antes de borrar el import), quitarlos del import de `lucide-react` en la línea 1 — de lo contrario dejar el import como está.

- [ ] **Paso 2: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores (ni imports sin usar, si ESLint corre en el build).

- [ ] **Paso 3: Commit**

```bash
git add src/components/layout/PublicHeader.tsx
git commit -m "Hide Elim Arena and Trivia en Vivo from the main nav"
```

Nota: las rutas `/arena/*` y `/trivia/*` siguen existiendo y funcionando — solo dejan de anunciarse. Se borran de verdad en una fase posterior.

---

## Task 10: Verificación en vivo

- [ ] Aplicar la migración del Task 1 en producción (con confirmación del usuario antes, como en migraciones anteriores).
- [ ] `pnpm build` o `next dev --webpack` local para confirmar que compila.
- [ ] Probar en el navegador, con una cuenta real:
  1. Entrar a `/juegos` sin sesión — debe verse la puerta de Arena Abierta con su estado, y el botón "Entrar" debe mandar a `/login?returnUrl=/arena-abierta` en vez de a la sala.
  2. Iniciar sesión, volver a `/arena-abierta` — debe aparecer el selector "¿Cuántos van a jugar?" (no un campo de nombre).
  3. Elegir 3, entrar — debe verse "esperando más jugadores... 1 de 3" y, apenas haya 2, el botón "Empezar con 2".
  4. Con una segunda cuenta (otra pestaña/perfil), unirse a la misma sala — confirmar que aparece como jugador 2 de 3, y que el botón "Empezar con 2" funciona y arranca la cuenta regresiva sin esperar al tercero.
  5. Volver a `/juegos` durante la partida — la puerta debe verse roja "Ocupado" con el detalle de partidas en curso, y el botón "Entrar" debe seguir funcionando (abre una sala nueva).
- [ ] Confirmar que `/trivia` y `/arena` ya no aparecen en la barra superior, pero que las URLs directas todavía cargan.
- [ ] Push a `master` una vez confirmado.

---

## Pregunta abierta antes de ejecutar

**#1 — Qué hacer con "Jugadores en línea" y la ruleta decorativa en el hub.** El Task 8 asume (según lo que ya aprobaste en la propuesta visual) que "Jugadores en línea" desaparece del hub porque el botón "Invitar" de cada puerta ya cubre esa necesidad, y que la ruleta decorativa de un jugador se queda tal cual porque no es un juego multijugador que deba pasar por el rediseño. Si prefieres algo distinto para cualquiera de las dos, aviso antes de que un implementador toque el Task 8.

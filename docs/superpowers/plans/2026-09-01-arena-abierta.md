# Arena Abierta (sala pública de trivia) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second, always-open trivia game ("Arena Abierta") where anyone can join instantly with just a name — no room code, no "create a room" step, no host. As soon as 2 people are present it counts down and starts on its own; when it ends, a fresh round is ready immediately for whoever's still around.

**Architecture:** New tables (`arena_publica_*`) parallel to the existing `elim_arena_*` schema, reusing the exact same shapes so the existing generic UI pieces (`AnswerButtons`, `Leaderboard`, `CountdownCircle`) can be imported unmodified. There is no "host who clicks next" — the game advances itself: every phase transition (lobby→counting→playing→reveal→next question→finished) is driven by a deadline timestamp on the room row, and **any connected client** whose local countdown hits zero calls a single `/advance` endpoint that performs the transition under an optimistic-concurrency guard (same `.eq(id).eq(<original status/timestamp>)` pattern already proven in `src/app/api/ruleta/[codigo]/timeout/route.ts`). This means the game can never get permanently stuck waiting on one specific person's browser, and there is no scheduled job — a new match's questions are drawn lazily, server-side, the next time anyone loads the page after the previous match finished.

**Tech Stack:** Same as the rest of the repo — Next.js App Router, Supabase (Postgres + Realtime broadcast/postgres_changes), no new dependencies.

> **Amendment (post Task 1/2 review, commit `746e5d3`):** code review caught two real bugs in the original Task 1/2 code below, both now fixed in a follow-up commit. **Any task from here on that touches `respuesta_correcta` or calls `getOrCreateOpenRoom()` must read the ACTUAL current contents of `supabase/migrations/0021_arena_publica.sql` and `src/lib/arena-publica/room.server.ts` on disk — not the original code blocks in Task 1/2 below, which are superseded.** Summary of what changed, for context:
> 1. **Correct answers were publicly readable.** `respuesta_correcta` moved out of `arena_publica_preguntas` (still publicly readable for `pregunta`/`opcion_a-d`/`orden`) into a new table `arena_publica_respuestas_correctas` (`pregunta_id PK → FK`, `respuesta_correcta`) with RLS enabled and **zero** policies/grants for `anon`/`authenticated` — same pattern as `ruleta_rondas` in `0016_ruleta_online.sql`. Any code that needs the correct answer for a question (the `/advance` route's reveal step, the `/answer` route's scoring) must query this new table, joined/filtered by `pregunta_id`, using the service-role client.
> 2. **`getOrCreateOpenRoom()` had a room-creation race.** Two concurrent callers with no existing open room could each create a separate "current" room, permanently orphaning whoever landed on the losing one. Fixed with a partial unique index (`idx_arena_publica_salas_una_abierta ON arena_publica_salas ((1)) WHERE status <> 'finished'`) plus a `23505`-unique-violation catch in `room.server.ts` that re-queries and returns the winning room instead of erroring. Also: `getOrCreateOpenRoom`'s return type is now `{ sala: SalaActual | null; error: string | null }` (was a lying non-null cast before) — every caller must null-check `sala`, not just `error`.

**Existing code this reuses (read, do not modify unless a task says so):**
- `src/components/arena/AnswerButtons.tsx` — `{opciones, selected, correct, disabled, loading, onAnswer}` → same import used unmodified.
- `src/components/arena/Leaderboard.tsx` — `{jugadores: ArenaJugador[], meId?, limit?}` → same import used unmodified. Requires jugador rows shaped `{id, sala_id, nombre, puntos, ...}` — this is why the new `arena_publica_jugadores` table intentionally uses the exact same column names.
- `src/components/arena/CountdownCircle.tsx` — `{endsAt: number, totalSeconds: number, onExpire?: () => void}` → reused for the pre-start countdown, the question timer, and the reveal timer.
- `src/types/index.ts` — `AnswerOption`, `ArenaJugador` — reused as-is for the public room's jugador rows (its shape matches exactly).

---

### Task 1: Migration — `arena_publica_*` tables

**Files:**
- Create: `supabase/migrations/0021_arena_publica.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Arena Abierta — sala pública de trivia, siempre abierta
--
-- A diferencia de elim_arena_* (que requiere que un admin/anfitrión cree
-- una sala y comparta un código), esta es UNA sola sala "actual" en todo
-- momento: cualquiera entra a /arena-abierta, pone su nombre, y cuando
-- hay 2+ jugadores arranca sola. No hay host — el servidor genera las
-- preguntas (sorteadas del banco público de question_sets) y el juego
-- avanza de fase solo, por temporizador, sin que nadie tenga que darle
-- a "Siguiente". Cuando termina, la próxima visita a la página crea una
-- sala nueva lista para jugar — no hace falta ningún cron job.
--
-- Sin GRANTs de INSERT/UPDATE para anon/authenticated a propósito: como
-- no hay un usuario "dueño" de la sala (nadie la crea), toda escritura
-- pasa por rutas API con el service role client.
-- ============================================================

CREATE TABLE arena_publica_salas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby', 'counting', 'playing', 'reveal', 'finished')),
  pregunta_actual INT NOT NULL DEFAULT 0,
  cuenta_termina_en TIMESTAMPTZ,
  pregunta_termina_en TIMESTAMPTZ,
  reveal_termina_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE arena_publica_preguntas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id UUID NOT NULL REFERENCES arena_publica_salas(id) ON DELETE CASCADE,
  pregunta TEXT NOT NULL,
  opcion_a TEXT NOT NULL,
  opcion_b TEXT NOT NULL,
  opcion_c TEXT NOT NULL,
  opcion_d TEXT NOT NULL,
  respuesta_correcta TEXT NOT NULL CHECK (respuesta_correcta IN ('a','b','c','d')),
  orden INT NOT NULL,
  UNIQUE (sala_id, orden)
);

CREATE TABLE arena_publica_jugadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id UUID NOT NULL REFERENCES arena_publica_salas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  puntos INT NOT NULL DEFAULT 0,
  ultimo_respondido_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE arena_publica_respuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id UUID NOT NULL REFERENCES arena_publica_salas(id) ON DELETE CASCADE,
  jugador_id UUID NOT NULL REFERENCES arena_publica_jugadores(id) ON DELETE CASCADE,
  pregunta_id UUID NOT NULL REFERENCES arena_publica_preguntas(id) ON DELETE CASCADE,
  respuesta TEXT NOT NULL CHECK (respuesta IN ('a','b','c','d')),
  es_correcta BOOLEAN NOT NULL,
  tiempo_ms INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pregunta_id, jugador_id)
);

CREATE INDEX idx_arena_publica_salas_status ON arena_publica_salas(status);
CREATE INDEX idx_arena_publica_preguntas_sala ON arena_publica_preguntas(sala_id, orden);
CREATE INDEX idx_arena_publica_jugadores_sala ON arena_publica_jugadores(sala_id);
CREATE INDEX idx_arena_publica_respuestas_sala ON arena_publica_respuestas(sala_id, pregunta_id);

ALTER TABLE arena_publica_salas ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_publica_preguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_publica_jugadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_publica_respuestas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arena_publica_salas_select_all" ON arena_publica_salas FOR SELECT USING (TRUE);
CREATE POLICY "arena_publica_preguntas_select_all" ON arena_publica_preguntas FOR SELECT USING (TRUE);
CREATE POLICY "arena_publica_jugadores_select_all" ON arena_publica_jugadores FOR SELECT USING (TRUE);
CREATE POLICY "arena_publica_respuestas_select_all" ON arena_publica_respuestas FOR SELECT USING (TRUE);

GRANT SELECT ON arena_publica_salas TO anon, authenticated;
GRANT SELECT ON arena_publica_preguntas TO anon, authenticated;
GRANT SELECT ON arena_publica_jugadores TO anon, authenticated;
GRANT SELECT ON arena_publica_respuestas TO anon, authenticated;
-- Sin GRANT de INSERT/UPDATE — todo escribe con el service role client.

ALTER PUBLICATION supabase_realtime ADD TABLE arena_publica_salas;
ALTER PUBLICATION supabase_realtime ADD TABLE arena_publica_jugadores;
```

- [ ] **Step 2: Apply it to production**

This project applies migrations by hand via the Supabase SQL Editor (there is no local Supabase instance in this repo — see every prior migration in `supabase/migrations/`). Do not attempt `supabase db push` or similar. Ask the human operator to run this file's SQL in the Supabase SQL Editor for project `rdejlzuqtiigjjtclnpn`, or — if you have browser automation available and the operator has already approved applying migrations this way earlier in the session — apply it yourself the same way prior migrations in this repo were applied, then verify with a `select column_name from information_schema.columns where table_name = 'arena_publica_salas'` query.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0021_arena_publica.sql
git commit -m "Add arena_publica_* tables for the always-open trivia room"
```

---

### Task 2: Shared config and question-pool helper

**Files:**
- Create: `src/lib/arena-publica/config.ts`
- Create: `src/lib/arena-publica/room.server.ts`

- [ ] **Step 1: Write the config constants**

```typescript
// src/lib/arena-publica/config.ts

export const COUNTDOWN_SECONDS = 8; // cuenta regresiva antes de arrancar, una vez hay 2+ jugadores
export const ROUND_SECONDS = 15; // tiempo por pregunta
export const REVEAL_SECONDS = 5; // cuánto se muestra la respuesta correcta antes de pasar a la siguiente
export const MIN_JUGADORES_PARA_INICIAR = 2;
export const PREGUNTAS_POR_PARTIDA = 10;
export const MIN_PREGUNTAS_DISPONIBLES = 5; // si el banco público tiene menos que esto, no se puede armar una partida
```

- [ ] **Step 2: Write the room lookup/creation helper**

```typescript
// src/lib/arena-publica/room.server.ts
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { MIN_PREGUNTAS_DISPONIBLES, PREGUNTAS_POR_PARTIDA } from "./config";

export interface SalaActual {
  id: string;
  status: "lobby" | "counting" | "playing" | "reveal" | "finished";
  pregunta_actual: number;
  cuenta_termina_en: string | null;
  pregunta_termina_en: string | null;
  reveal_termina_en: string | null;
  created_at: string;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Devuelve la sala "actual" (la más reciente que no esté 'finished'). Si no
 * existe ninguna — primera visita de siempre, o la anterior ya terminó —
 * crea una nueva en 'lobby' con un set de preguntas sorteado del banco
 * público (todas las questions de question_sets con is_public = true).
 * No hay cron job: esta función se llama desde la página en cada visita,
 * así que la próxima persona que entre después de que termine una partida
 * es quien, sin darse cuenta, prepara la siguiente.
 */
export async function getOrCreateOpenRoom(): Promise<{
  sala: SalaActual;
  error: string | null;
}> {
  const service = await createServiceClient();

  const { data: existente } = await service
    .from("arena_publica_salas")
    .select("*")
    .neq("status", "finished")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existente) return { sala: existente as SalaActual, error: null };

  // Dos consultas simples en vez de un filtro anidado sobre la tabla
  // embebida (question_sets.is_public) — más fácil de verificar que
  // realmente filtra bien, y evita depender de sintaxis de PostgREST menos
  // común para algo que se ejecuta cada vez que arranca una partida nueva.
  const { data: setsPublicos, error: setsError } = await service
    .from("question_sets")
    .select("id")
    .eq("is_public", true);

  if (setsError) {
    return { sala: null as unknown as SalaActual, error: setsError.message };
  }
  const setIds = (setsPublicos ?? []).map((s) => s.id as string);
  if (setIds.length === 0) {
    return {
      sala: null as unknown as SalaActual,
      error: `Todavía no hay suficientes preguntas públicas (se necesitan al menos ${MIN_PREGUNTAS_DISPONIBLES}).`,
    };
  }

  const { data: preguntasDisponibles, error: preguntasError } = await service
    .from("questions")
    .select("question_text, option_a, option_b, option_c, option_d, correct_option")
    .in("question_set_id", setIds);

  if (preguntasError) {
    return { sala: null as unknown as SalaActual, error: preguntasError.message };
  }
  if (!preguntasDisponibles || preguntasDisponibles.length < MIN_PREGUNTAS_DISPONIBLES) {
    return {
      sala: null as unknown as SalaActual,
      error: `Todavía no hay suficientes preguntas públicas (se necesitan al menos ${MIN_PREGUNTAS_DISPONIBLES}).`,
    };
  }

  const elegidas = shuffle(preguntasDisponibles).slice(0, PREGUNTAS_POR_PARTIDA);

  const { data: nuevaSala, error: salaError } = await service
    .from("arena_publica_salas")
    .insert({ status: "lobby" })
    .select("*")
    .single();

  if (salaError || !nuevaSala) {
    return { sala: null as unknown as SalaActual, error: salaError?.message ?? "No se pudo crear la sala" };
  }

  const { error: insertPreguntasError } = await service.from("arena_publica_preguntas").insert(
    elegidas.map((q, i) => ({
      sala_id: nuevaSala.id,
      pregunta: q.question_text,
      opcion_a: q.option_a,
      opcion_b: q.option_b,
      opcion_c: q.option_c,
      opcion_d: q.option_d,
      respuesta_correcta: q.correct_option,
      orden: i + 1,
    }))
  );

  if (insertPreguntasError) {
    await service.from("arena_publica_salas").delete().eq("id", nuevaSala.id);
    return { sala: null as unknown as SalaActual, error: insertPreguntasError.message };
  }

  return { sala: nuevaSala as SalaActual, error: null };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/arena-publica/config.ts src/lib/arena-publica/room.server.ts
git commit -m "Add Arena Abierta config and open-room lookup/creation helper"
```

---

### Task 3: `/api/arena-publica/join` route

**Files:**
- Create: `src/app/api/arena-publica/join/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getOrCreateOpenRoom } from "@/lib/arena-publica/room.server";
import { COUNTDOWN_SECONDS, MIN_JUGADORES_PARA_INICIAR } from "@/lib/arena-publica/config";

export async function POST(request: Request) {
  let body: { nombre?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const nombre = body.nombre?.trim().slice(0, 20);
  if (!nombre) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });

  const { sala, error: salaError } = await getOrCreateOpenRoom();
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

  const { data: jugador, error: insertError } = await service
    .from("arena_publica_jugadores")
    .insert({ sala_id: sala.id, nombre, puntos: 0 })
    .select("id")
    .single();

  if (insertError || !jugador) {
    return NextResponse.json({ error: insertError?.message ?? "Error al unirse" }, { status: 500 });
  }

  // Si acabamos de llegar a 2 jugadores y la sala seguía en 'lobby', arranca
  // la cuenta regresiva — con guardia CAS para que, si dos joins llegan a la
  // vez, solo uno dispare la cuenta.
  const { count } = await service
    .from("arena_publica_jugadores")
    .select("id", { count: "exact", head: true })
    .eq("sala_id", sala.id);

  if ((count ?? 0) >= MIN_JUGADORES_PARA_INICIAR && sala.status === "lobby") {
    const cuentaTerminaEn = Date.now() + COUNTDOWN_SECONDS * 1000;
    const { data: updated } = await service
      .from("arena_publica_salas")
      .update({ status: "counting", cuenta_termina_en: new Date(cuentaTerminaEn).toISOString() })
      .eq("id", sala.id)
      .eq("status", "lobby")
      .select("id");

    if (updated && updated.length > 0) {
      const supabase = await createClient();
      const channel = supabase.channel(`arena-publica:${sala.id}`);
      await channel.send({
        type: "broadcast",
        event: "COUNTDOWN_START",
        payload: { cuentaTerminaEn },
      });
    }
  }

  return NextResponse.json({ jugador_id: jugador.id, sala_id: sala.id });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/arena-publica/join/route.ts
git commit -m "Add join route for Arena Abierta"
```

---

### Task 4: `/api/arena-publica/advance` route (the self-driving state machine)

**Files:**
- Create: `src/app/api/arena-publica/advance/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { NextResponse } from "next/server";
import { createServiceClient, createClient } from "@/lib/supabase/server";
import { ROUND_SECONDS, REVEAL_SECONDS } from "@/lib/arena-publica/config";

export async function POST(request: Request) {
  let body: { sala_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  if (!body.sala_id) return NextResponse.json({ error: "sala_id requerido" }, { status: 400 });

  const service = await createServiceClient();
  const { data: sala } = await service
    .from("arena_publica_salas")
    .select("*")
    .eq("id", body.sala_id)
    .single();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });

  const supabase = await createClient();
  const channel = supabase.channel(`arena-publica:${sala.id}`);
  const now = Date.now();

  // counting -> playing (primera pregunta)
  if (sala.status === "counting" && sala.cuenta_termina_en && new Date(sala.cuenta_termina_en).getTime() <= now) {
    const { data: pregunta } = await service
      .from("arena_publica_preguntas")
      .select("id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, orden")
      .eq("sala_id", sala.id)
      .eq("orden", 1)
      .single();

    if (!pregunta) return NextResponse.json({ applied: false });

    const { count } = await service
      .from("arena_publica_preguntas")
      .select("id", { count: "exact", head: true })
      .eq("sala_id", sala.id);

    const preguntaTerminaEn = now + ROUND_SECONDS * 1000;
    const { data: updated } = await service
      .from("arena_publica_salas")
      .update({
        status: "playing",
        pregunta_actual: 1,
        pregunta_termina_en: new Date(preguntaTerminaEn).toISOString(),
      })
      .eq("id", sala.id)
      .eq("status", "counting")
      .eq("cuenta_termina_en", sala.cuenta_termina_en)
      .select("id");

    if (!updated || updated.length === 0) return NextResponse.json({ applied: false });

    await channel.send({
      type: "broadcast",
      event: "QUESTION_START",
      payload: {
        pregunta_id: pregunta.id,
        pregunta: pregunta.pregunta,
        opciones: { a: pregunta.opcion_a, b: pregunta.opcion_b, c: pregunta.opcion_c, d: pregunta.opcion_d },
        orden: pregunta.orden,
        total: count ?? 0,
        endsAt: preguntaTerminaEn,
      },
    });
    return NextResponse.json({ applied: true });
  }

  // playing -> reveal
  if (sala.status === "playing" && sala.pregunta_termina_en && new Date(sala.pregunta_termina_en).getTime() <= now) {
    const { data: pregunta } = await service
      .from("arena_publica_preguntas")
      .select("id, respuesta_correcta")
      .eq("sala_id", sala.id)
      .eq("orden", sala.pregunta_actual)
      .single();

    if (!pregunta) return NextResponse.json({ applied: false });

    const revealTerminaEn = now + REVEAL_SECONDS * 1000;
    const { data: updated } = await service
      .from("arena_publica_salas")
      .update({ status: "reveal", reveal_termina_en: new Date(revealTerminaEn).toISOString() })
      .eq("id", sala.id)
      .eq("status", "playing")
      .eq("pregunta_termina_en", sala.pregunta_termina_en)
      .select("id");

    if (!updated || updated.length === 0) return NextResponse.json({ applied: false });

    await channel.send({
      type: "broadcast",
      event: "REVEAL_START",
      payload: { pregunta_id: pregunta.id, respuesta_correcta: pregunta.respuesta_correcta, revealTerminaEn },
    });
    return NextResponse.json({ applied: true });
  }

  // reveal -> siguiente pregunta, o finished si ya no hay más
  if (sala.status === "reveal" && sala.reveal_termina_en && new Date(sala.reveal_termina_en).getTime() <= now) {
    const { count } = await service
      .from("arena_publica_preguntas")
      .select("id", { count: "exact", head: true })
      .eq("sala_id", sala.id);

    const total = count ?? 0;
    const siguienteOrden = sala.pregunta_actual + 1;

    if (siguienteOrden > total) {
      const { data: updated } = await service
        .from("arena_publica_salas")
        .update({ status: "finished" })
        .eq("id", sala.id)
        .eq("status", "reveal")
        .eq("reveal_termina_en", sala.reveal_termina_en)
        .select("id");

      if (!updated || updated.length === 0) return NextResponse.json({ applied: false });

      await channel.send({ type: "broadcast", event: "GAME_FINISHED", payload: {} });
      return NextResponse.json({ applied: true });
    }

    const { data: pregunta } = await service
      .from("arena_publica_preguntas")
      .select("id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, orden")
      .eq("sala_id", sala.id)
      .eq("orden", siguienteOrden)
      .single();

    if (!pregunta) return NextResponse.json({ applied: false });

    const preguntaTerminaEn = now + ROUND_SECONDS * 1000;
    const { data: updated } = await service
      .from("arena_publica_salas")
      .update({
        status: "playing",
        pregunta_actual: siguienteOrden,
        pregunta_termina_en: new Date(preguntaTerminaEn).toISOString(),
      })
      .eq("id", sala.id)
      .eq("status", "reveal")
      .eq("reveal_termina_en", sala.reveal_termina_en)
      .select("id");

    if (!updated || updated.length === 0) return NextResponse.json({ applied: false });

    await channel.send({
      type: "broadcast",
      event: "QUESTION_START",
      payload: {
        pregunta_id: pregunta.id,
        pregunta: pregunta.pregunta,
        opciones: { a: pregunta.opcion_a, b: pregunta.opcion_b, c: pregunta.opcion_c, d: pregunta.opcion_d },
        orden: pregunta.orden,
        total,
        endsAt: preguntaTerminaEn,
      },
    });
    return NextResponse.json({ applied: true });
  }

  return NextResponse.json({ applied: false });
}
```

**Why CAS on the exact timestamp column, not just status:** two clients whose local countdown hits zero within the same tick both call this route at once. Guarding the update with `.eq("cuenta_termina_en", sala.cuenta_termina_en)` (or the matching column for that phase) means only the first write actually changes anything — the loser's `UPDATE` matches zero rows and returns `{applied: false}`, so the question never gets double-advanced. This is the same pattern already proven in `src/app/api/ruleta/[codigo]/timeout/route.ts` and every `spin`/`guess-*` route in that same feature.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/arena-publica/advance/route.ts
git commit -m "Add self-driving phase-advance route for Arena Abierta"
```

---

### Task 5: `/api/arena-publica/answer` route

**Files:**
- Create: `src/app/api/arena-publica/answer/route.ts`

- [ ] **Step 1: Write the route**

Same scoring rule as `src/app/api/arena/[codigo]/answer/route.ts` (faster correct answers score more, floor of 100), adapted to the public tables and to look the room up by id instead of by codigo.

```typescript
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ROUND_SECONDS } from "@/lib/arena-publica/config";
import type { AnswerOption } from "@/types";

const ANSWER_OPTIONS: AnswerOption[] = ["a", "b", "c", "d"];

export async function POST(request: Request) {
  const supabase = await createServiceClient();

  let body: {
    sala_id?: string;
    jugador_id?: string;
    pregunta_id?: string;
    respuesta?: AnswerOption;
    tiempo_ms?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const { sala_id, jugador_id, pregunta_id, respuesta, tiempo_ms } = body;

  if (
    !sala_id ||
    !jugador_id ||
    !pregunta_id ||
    !respuesta ||
    !ANSWER_OPTIONS.includes(respuesta) ||
    typeof tiempo_ms !== "number"
  ) {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const { data: sala } = await supabase
    .from("arena_publica_salas")
    .select("id, status, pregunta_actual")
    .eq("id", sala_id)
    .maybeSingle();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  if (sala.status !== "playing") {
    return NextResponse.json({ error: "No se puede responder en este momento" }, { status: 400 });
  }

  const { data: pregunta } = await supabase
    .from("arena_publica_preguntas")
    .select("id, sala_id, orden, respuesta_correcta")
    .eq("id", pregunta_id)
    .maybeSingle();

  if (!pregunta || pregunta.sala_id !== sala.id) {
    return NextResponse.json({ error: "Pregunta no encontrada" }, { status: 404 });
  }
  if (pregunta.orden !== sala.pregunta_actual) {
    return NextResponse.json({ error: "Esta pregunta ya no está activa" }, { status: 400 });
  }

  const esCorrecta = respuesta === pregunta.respuesta_correcta;
  const ROUND_MS = ROUND_SECONDS * 1000;
  const tiempoClamped = Math.max(0, Math.min(tiempo_ms, ROUND_MS));
  const puntos = esCorrecta ? Math.max(100, Math.round(1000 * (1 - tiempoClamped / ROUND_MS))) : 0;

  const { error: insertError } = await supabase.from("arena_publica_respuestas").insert({
    sala_id: sala.id,
    jugador_id,
    pregunta_id,
    respuesta,
    es_correcta: esCorrecta,
    tiempo_ms: tiempoClamped,
  });

  if (insertError) {
    return NextResponse.json({ error: "Ya respondiste esta pregunta" }, { status: 409 });
  }

  const { data: jugador } = await supabase
    .from("arena_publica_jugadores")
    .select("puntos")
    .eq("id", jugador_id)
    .single();

  await supabase
    .from("arena_publica_jugadores")
    .update({ puntos: (jugador?.puntos ?? 0) + puntos, ultimo_respondido_at: new Date().toISOString() })
    .eq("id", jugador_id);

  return NextResponse.json({ es_correcta: esCorrecta, puntos_obtenidos: puntos });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/arena-publica/answer/route.ts
git commit -m "Add answer route for Arena Abierta"
```

---

### Task 6: Join form component

**Files:**
- Create: `src/components/arena-publica/JoinPublicaForm.tsx`

- [ ] **Step 1: Write the component**

Adapted from `src/components/arena/JoinForm.tsx` — no `codigo`/`titulo` props (there's nothing to display, it's always the same room), posts to the new route, and the parent needs both the jugador id AND the sala id back (the sala id isn't otherwise known client-side until this call resolves the "current open room" server-side).

```tsx
"use client";

import { useState } from "react";
import { ArrowRight, Loader2, UserRound } from "lucide-react";

interface JoinPublicaFormProps {
  onJoined: (jugadorId: string, salaId: string, nombre: string) => void;
}

export function JoinPublicaForm({ onJoined }: JoinPublicaFormProps) {
  const [nombre, setNombre] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/arena-publica/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre.trim() }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo unir a la sala");
      setSubmitting(false);
      return;
    }

    const data = await res.json();
    onJoined(data.jugador_id, data.sala_id, nombre.trim());
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-10">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}
      >
        <UserRound size={32} style={{ color: "var(--color-primary)" }} />
      </div>

      <div className="text-center flex flex-col gap-2">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          Arena Abierta
        </h1>
        <p className="text-base" style={{ color: "var(--color-text-muted)" }}>
          ¿Cuál es tu nombre?
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value.slice(0, 20))}
          placeholder="Tu nombre"
          maxLength={20}
          autoFocus
          className="w-full rounded-2xl px-5 py-4 text-xl font-semibold text-center outline-none transition-colors"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        />

        {error && (
          <p className="text-sm text-center" style={{ color: "var(--color-destructive)" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!nombre.trim() || submitting}
          className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-lg font-bold transition-all duration-200"
          style={{
            background: nombre.trim() && !submitting ? "var(--color-primary)" : "var(--color-surface-elevated)",
            color: nombre.trim() && !submitting ? "#000" : "var(--color-text-muted)",
          }}
        >
          {submitting ? <Loader2 size={20} className="animate-spin" /> : <>Entrar a jugar <ArrowRight size={20} /></>}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/arena-publica/JoinPublicaForm.tsx
git commit -m "Add name-only join form for Arena Abierta"
```

---

### Task 7: `ArenaPublicaRoom.tsx` — the orchestrator

**Files:**
- Create: `src/components/arena-publica/ArenaPublicaRoom.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { Sparkles, Users, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ArenaJugador, AnswerOption } from "@/types";
import { JoinPublicaForm } from "./JoinPublicaForm";
import { AnswerButtons } from "@/components/arena/AnswerButtons";
import { Leaderboard } from "@/components/arena/Leaderboard";
import { CountdownCircle } from "@/components/arena/CountdownCircle";
import { COUNTDOWN_SECONDS, ROUND_SECONDS, REVEAL_SECONDS } from "@/lib/arena-publica/config";

type Phase = "lobby" | "counting" | "playing" | "reveal" | "finished";

interface PreguntaPublica {
  id: string;
  pregunta: string;
  opcion_a: string;
  opcion_b: string;
  opcion_c: string;
  opcion_d: string;
  orden: number;
}

interface QuestionPayload {
  pregunta_id: string;
  pregunta: string;
  opciones: { a: string; b: string; c: string; d: string };
  orden: number;
  total: number;
  endsAt: number;
}

interface ArenaPublicaRoomProps {
  salaId: string;
  status: Phase;
  preguntaActual: number;
  cuentaTerminaEn: number | null;
  preguntaTerminaEn: number | null;
  revealTerminaEn: number | null;
  preguntas: PreguntaPublica[];
  jugadoresIniciales: ArenaJugador[];
}

export function ArenaPublicaRoom({
  salaId,
  status,
  preguntaActual,
  cuentaTerminaEn,
  preguntaTerminaEn,
  revealTerminaEn,
  preguntas,
  jugadoresIniciales,
}: ArenaPublicaRoomProps) {
  const [phase, setPhase] = useState<Phase>(status);
  const [jugadores, setJugadores] = useState<ArenaJugador[]>(jugadoresIniciales);
  const [jugadorId, setJugadorId] = useState<string | null>(null);
  const [countdownEndsAt, setCountdownEndsAt] = useState<number | null>(cuentaTerminaEn);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionPayload | null>(() => {
    if (status !== "playing" && status !== "reveal") return null;
    const p = preguntas.find((pr) => pr.orden === preguntaActual);
    if (!p) return null;
    return {
      pregunta_id: p.id,
      pregunta: p.pregunta,
      opciones: { a: p.opcion_a, b: p.opcion_b, c: p.opcion_c, d: p.opcion_d },
      orden: p.orden,
      total: preguntas.length,
      endsAt: preguntaTerminaEn ?? Date.now() + ROUND_SECONDS * 1000,
    };
  });
  const [revealEndsAt, setRevealEndsAt] = useState<number | null>(revealTerminaEn);
  const [selected, setSelected] = useState<AnswerOption | null>(null);
  const [correct, setCorrect] = useState<AnswerOption | null>(null);
  const [answering, setAnswering] = useState(false);
  const answerSentRef = useRef(false);
  const confettiFiredRef = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`arena_publica_jugador_${salaId}`);
      if (stored) setJugadorId((JSON.parse(stored) as { id: string }).id);
    } catch {
      // localStorage no disponible
    }
  }, [salaId]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`arena-publica:${salaId}`)
      .on("broadcast", { event: "*" }, (msg) => {
        const { event, payload } = msg as unknown as { event: string; payload: Record<string, unknown> };

        if (event === "COUNTDOWN_START") {
          const p = payload as unknown as { cuentaTerminaEn: number };
          setCountdownEndsAt(p.cuentaTerminaEn);
          setPhase("counting");
        }

        if (event === "QUESTION_START") {
          const p = payload as unknown as QuestionPayload;
          setCurrentQuestion(p);
          setSelected(null);
          setCorrect(null);
          setPhase("playing");
          answerSentRef.current = false;
        }

        if (event === "REVEAL_START") {
          const p = payload as unknown as { respuesta_correcta: AnswerOption; revealTerminaEn: number };
          setCorrect(p.respuesta_correcta);
          setRevealEndsAt(p.revealTerminaEn);
          setPhase("reveal");
        }

        if (event === "GAME_FINISHED") setPhase("finished");
      });

    const jugadoresChannel = supabase
      .channel(`arena-publica-jugadores:${salaId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "arena_publica_jugadores", filter: `sala_id=eq.${salaId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const nuevo = payload.new as ArenaJugador;
            setJugadores((prev) => (prev.some((j) => j.id === nuevo.id) ? prev : [...prev, nuevo]));
          } else if (payload.eventType === "UPDATE") {
            const actualizado = payload.new as ArenaJugador;
            setJugadores((prev) => prev.map((j) => (j.id === actualizado.id ? actualizado : j)));
          }
        }
      )
      .subscribe();

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(jugadoresChannel);
    };
  }, [salaId]);

  const handleAdvance = useCallback(async () => {
    await fetch("/api/arena-publica/advance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sala_id: salaId }),
    });
  }, [salaId]);

  // Autocorrección: si esta pestaña carga y el plazo de la fase actual ya
  // pasó (nadie más lo disparó a tiempo — pestañas en segundo plano, etc.),
  // lo intenta de inmediato en vez de esperar a que el usuario haga algo.
  useEffect(() => {
    const deadline = phase === "counting" ? countdownEndsAt : phase === "playing" ? currentQuestion?.endsAt : phase === "reveal" ? revealEndsAt : null;
    if (deadline && deadline <= Date.now()) void handleAdvance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleJoined(id: string, sala: string, nombre: string) {
    setJugadorId(id);
    try {
      localStorage.setItem(`arena_publica_jugador_${sala}`, JSON.stringify({ id, nombre }));
    } catch {
      // localStorage no disponible
    }
  }

  async function handleAnswer(option: AnswerOption) {
    if (!jugadorId || !currentQuestion || answerSentRef.current) return;
    answerSentRef.current = true;
    setAnswering(true);
    setSelected(option);

    const tiempoMs = Math.max(0, Date.now() - (currentQuestion.endsAt - ROUND_SECONDS * 1000));

    await fetch("/api/arena-publica/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sala_id: salaId,
        jugador_id: jugadorId,
        pregunta_id: currentQuestion.pregunta_id,
        respuesta: option,
        tiempo_ms: tiempoMs,
      }),
    });

    setAnswering(false);
  }

  useEffect(() => {
    if (phase !== "finished" || confettiFiredRef.current) return;
    confettiFiredRef.current = true;
    const duration = 2000;
    const end = Date.now() + duration;
    const colors = ["#D4A017", "#EDB84A", "#FFFFFF"];
    let frameId: number;
    function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors });
      if (Date.now() < end) frameId = requestAnimationFrame(frame);
    }
    frame();
    return () => cancelAnimationFrame(frameId);
  }, [phase]);

  const sorted = [...jugadores].sort((a, b) => b.puntos - a.puntos);
  const ganador = sorted[0];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-[430px] mx-auto flex-1 flex flex-col px-4 py-5 gap-4">
        <header className="flex items-center justify-between">
          <Link href="/juegos" className="text-lg font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--color-primary)" }}>
            Arena Abierta
          </Link>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.25)", color: "var(--color-primary)" }}>
            <Users size={13} />
            {jugadores.length}
          </div>
        </header>

        {!jugadorId ? (
          <JoinPublicaForm onJoined={handleJoined} />
        ) : phase === "lobby" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <Sparkles size={36} style={{ color: "var(--color-primary)" }} />
            <p className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>
              Esperando más jugadores...
            </p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Arranca solo en cuanto se una alguien más. {jugadores.length} en la sala.
            </p>
          </div>
        ) : phase === "counting" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <p className="text-sm font-semibold" style={{ color: "var(--color-text-muted)" }}>
              ¡Ya somos {jugadores.length}! Arrancando...
            </p>
            <CountdownCircle endsAt={countdownEndsAt ?? Date.now() + COUNTDOWN_SECONDS * 1000} totalSeconds={COUNTDOWN_SECONDS} onExpire={handleAdvance} />
          </div>
        ) : phase === "finished" ? (
          <div className="flex-1 flex flex-col items-center gap-6 py-8">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}>
              <Trophy size={40} style={{ color: "var(--color-primary)" }} />
            </div>
            <div className="text-center flex flex-col gap-2">
              <p className="text-sm font-semibold uppercase" style={{ color: "var(--color-text-muted)", letterSpacing: "0.1em" }}>
                ¡Partida terminada!
              </p>
              {ganador && (
                <h1 className="text-3xl font-extrabold" style={{ color: "var(--color-primary)" }}>
                  {ganador.nombre}
                </h1>
              )}
            </div>
            <div className="w-full">
              <Leaderboard jugadores={jugadores} meId={jugadorId} />
            </div>
            <a
              href="/arena-abierta"
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "var(--color-primary)", color: "#000" }}
            >
              Jugar otra ronda
            </a>
          </div>
        ) : currentQuestion ? (
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
                Pregunta {currentQuestion.orden} de {currentQuestion.total}
              </p>
              {phase === "playing" && (
                <CountdownCircle endsAt={currentQuestion.endsAt} totalSeconds={ROUND_SECONDS} onExpire={handleAdvance} />
              )}
              {phase === "reveal" && revealEndsAt && (
                <CountdownCircle endsAt={revealEndsAt} totalSeconds={REVEAL_SECONDS} onExpire={handleAdvance} />
              )}
              <h2 className="text-2xl font-bold leading-snug" style={{ color: "var(--color-text)" }}>
                {currentQuestion.pregunta}
              </h2>
            </div>
            <AnswerButtons
              opciones={currentQuestion.opciones}
              selected={selected}
              correct={correct}
              disabled={phase === "reveal"}
              loading={answering}
              onAnswer={handleAnswer}
            />
            {phase === "reveal" && <Leaderboard jugadores={jugadores} meId={jugadorId} />}
          </div>
        ) : null}
      </div>
    </div>
  );
}
```

**Notes for the implementer:**
- `answerSentRef`/`confettiFiredRef` are refs, not state, on purpose — mirrors the existing pattern in `ArenaRoom.tsx`/`RuletaRoom.tsx` for "fire once per question/game" flags that shouldn't trigger re-renders.
- The self-correction `useEffect` (empty dependency array, deliberately using the values captured at mount) only needs to run once on mount — its whole purpose is "was the deadline already in the past when I loaded this page," not to re-run on every state change. Leave the eslint-disable comment; do not add the missing deps.

- [ ] **Step 2: Commit**

```bash
git add src/components/arena-publica/ArenaPublicaRoom.tsx
git commit -m "Add Arena Abierta room orchestrator component"
```

---

### Task 8: The page

**Files:**
- Create: `src/app/(public)/arena-abierta/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { createClient } from "@/lib/supabase/server";
import { getOrCreateOpenRoom } from "@/lib/arena-publica/room.server";
import { ArenaPublicaRoom } from "@/components/arena-publica/ArenaPublicaRoom";
import type { ArenaJugador } from "@/types";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Arena Abierta — Elim LLDM" };

export default async function ArenaAbiertaPage() {
  const { sala, error } = await getOrCreateOpenRoom();

  if (!sala) {
    return (
      <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
        <div className="w-full max-w-[430px] mx-auto px-4 py-16 flex flex-col items-center gap-6 text-center">
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
            Arena Abierta
          </h1>
          <p style={{ color: "var(--color-text-muted)" }}>{error}</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: preguntasRaw }, { data: jugadoresRaw }] = await Promise.all([
    supabase
      .from("arena_publica_preguntas")
      .select("id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, orden")
      .eq("sala_id", sala.id)
      .order("orden"),
    supabase
      .from("arena_publica_jugadores")
      .select("*")
      .eq("sala_id", sala.id)
      .order("created_at"),
  ]);

  return (
    <ArenaPublicaRoom
      salaId={sala.id}
      status={sala.status}
      preguntaActual={sala.pregunta_actual}
      cuentaTerminaEn={sala.cuenta_termina_en ? new Date(sala.cuenta_termina_en).getTime() : null}
      preguntaTerminaEn={sala.pregunta_termina_en ? new Date(sala.pregunta_termina_en).getTime() : null}
      revealTerminaEn={sala.reveal_termina_en ? new Date(sala.reveal_termina_en).getTime() : null}
      preguntas={preguntasRaw ?? []}
      jugadoresIniciales={(jugadoresRaw ?? []) as ArenaJugador[]}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(public)/arena-abierta/page.tsx"
git commit -m "Add Arena Abierta page"
```

---

### Task 9: Link it from `/juegos`

**Files:**
- Modify: `src/app/(public)/juegos/page.tsx:1` (import line), `:10-59` (the `GAMES` array), `:72-75` (hover CSS rules)

- [ ] **Step 1: Add the `Sparkles` icon to the existing lucide-react import**

Change:
```typescript
import { Gamepad2, RotateCw, Trophy, ChevronRight, Users, UsersRound } from "lucide-react";
```
to:
```typescript
import { Gamepad2, RotateCw, Trophy, ChevronRight, Users, UsersRound, Sparkles } from "lucide-react";
```

- [ ] **Step 2: Add a new entry to the `GAMES` array**

Insert this object right after the `"Elim Arena"` entry (after the closing `},` on the line with `accentColor: "#D4A017",` and before the `"Jugadores en línea"` entry) so it reads, in full:

```typescript
const GAMES = [
  {
    href: "/juegos/ruleta-elimlldm.html",
    external: true,
    className: "card-ruleta",
    emoji: "🎡",
    icon: RotateCw,
    title: "Ruleta",
    desc: "Gira y descubre tu reto",
    accentBg: "rgba(29,158,117,0.08)",
    accentBorder: "rgba(29,158,117,0.3)",
    accentColor: "#1D9E75",
  },
  {
    href: "/ruleta",
    external: false,
    className: "card-ruleta-online",
    emoji: "📱",
    icon: Users,
    title: "La Ruleta en línea",
    desc: "Juega con hasta 6 amigos, cada quien desde su celular",
    accentBg: "rgba(59,130,246,0.08)",
    accentBorder: "rgba(59,130,246,0.3)",
    accentColor: "#3B82F6",
  },
  {
    href: "/arena",
    external: false,
    className: "card-arena",
    emoji: "🏟️",
    icon: Trophy,
    title: "Elim Arena",
    desc: "Trivia bíblica multijugador en tiempo real",
    accentBg: "rgba(212,160,23,0.08)",
    accentBorder: "rgba(212,160,23,0.3)",
    accentColor: "#D4A017",
  },
  {
    href: "/arena-abierta",
    external: false,
    className: "card-arena-abierta",
    emoji: "⚡",
    icon: Sparkles,
    title: "Arena Abierta",
    desc: "Trivia bíblica al instante, sin crear sala — solo pon tu nombre y juega",
    accentBg: "rgba(168,85,247,0.08)",
    accentBorder: "rgba(168,85,247,0.3)",
    accentColor: "#A855F7",
  },
  {
    href: "/juegos/jugadores",
    external: false,
    className: "card-jugadores",
    emoji: "📋",
    icon: UsersRound,
    title: "Jugadores en línea",
    desc: "Anótate para que te inviten, o invita a otros por WhatsApp",
    accentBg: "rgba(37,211,102,0.08)",
    accentBorder: "rgba(37,211,102,0.3)",
    accentColor: "#25D366",
  },
] as const;
```

(Purple `#A855F7` chosen because it's visually distinct from every other card's accent color — green, blue, gold, green again — so the two Arena variants don't look like the same card at a glance.)

- [ ] **Step 3: Add the matching hover rule**

Change:
```css
.card-ruleta:hover  { border-color: rgba(29,158,117,.45) !important; }
.card-ruleta-online:hover { border-color: rgba(59,130,246,.45) !important; }
.card-arena:hover   { border-color: rgba(212,160,23,.45) !important; }
.card-jugadores:hover { border-color: rgba(37,211,102,.45) !important; }
```
to:
```css
.card-ruleta:hover  { border-color: rgba(29,158,117,.45) !important; }
.card-ruleta-online:hover { border-color: rgba(59,130,246,.45) !important; }
.card-arena:hover   { border-color: rgba(212,160,23,.45) !important; }
.card-arena-abierta:hover { border-color: rgba(168,85,247,.45) !important; }
.card-jugadores:hover { border-color: rgba(37,211,102,.45) !important; }
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/(public)/juegos/page.tsx"
git commit -m "Add Arena Abierta card to the juegos hub"
```

---

### Task 10: Manual end-to-end verification

Not a subagent task — the controlling session should do this itself (via browser automation) after all above tasks are reviewed and merged, the same way Ruleta en línea and the Elim Arena question-set change were verified live in this session:

1. Visit `/arena-abierta` logged out or logged in, in two separate browser contexts (or one tab + one incognito) — confirm both see the name-join screen.
2. Join as "Jugador 1" — confirm the lobby shows "esperando más jugadores" and does NOT start.
3. Join as "Jugador 2" from the second context — confirm BOTH tabs transition to the countdown within ~1s of each other.
4. Let the countdown expire — confirm both tabs show question 1 at the same time.
5. Answer correctly in one tab, incorrectly (or let it expire) in the other — confirm the reveal phase shows the right answer and updates both leaderboards.
6. Let it cycle through all questions — confirm it reaches the finished/confetti screen with a correct winner.
7. Reload `/arena-abierta` after finishing — confirm a **brand new** empty lobby appears (this is the "no cron job needed" lazy-creation path — verify it actually works, not just that it's plausible from reading the code).
8. Background one tab for ~20s mid-question, bring it back — confirm it doesn't get stuck (the mount-time self-correction effect in Task 7 should catch it).

If any step fails, fix the specific route/component involved and re-run `./node_modules/.bin/tsc --noEmit` before retrying — don't move on with a known-broken step.

---

## Self-Review Notes

- **Spec coverage:** no room creation step / instant join by name → Task 6 (`JoinPublicaForm`, no codigo prop); auto-starts at 2 players → Task 3 (`join` route's count-check + CAS-guarded transition to `counting`); game advances without a host → Task 4 (`advance` route, self-triggered by any client's expiring `CountdownCircle` in Task 7); always has a next match ready with no cron → Task 2 (`getOrCreateOpenRoom` lazy-creation) + Task 8 (page calls it on every visit); separate from existing Elim Arena → all new files/tables, zero modifications to any `elim_arena_*` or `arena/` file.
- **Type consistency check:** `arena_publica_jugadores` columns (`id, sala_id, nombre, puntos, ultimo_respondido_at, created_at`) match `ArenaJugador` from `src/types/index.ts` exactly, on purpose, so `Leaderboard`/the confetti-winner block need no new types. `QuestionPayload`/`QuestionStartPayload` shape (`pregunta_id, pregunta, opciones, orden, total, endsAt`) is identical to the existing `elim_arena` broadcast payload shape, reused verbatim across Tasks 3, 4, 7. `AnswerOption` reused from `@/types` throughout Tasks 5 and 7 — never redefined.
- **Placeholder scan:** none — every step has complete, real code, including Task 9 (re-read `src/app/(public)/juegos/page.tsx` in full before writing this plan, so the new `GAMES` entry and hover-rule diff are shown against its actual current contents, not guessed).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-01-arena-abierta.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

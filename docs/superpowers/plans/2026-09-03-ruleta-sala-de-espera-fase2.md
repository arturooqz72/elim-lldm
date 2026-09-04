# Sala de Espera — Fase 2 (Ruleta en línea) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mudar "La Ruleta en línea" del modelo "anfitrión crea sala + comparte código de 4 letras" al mismo patrón sin código, con cuenta obligatoria, auto-avance y auto-sanación que ya tiene Arena Abierta desde la Fase 1 — para que se convierta en la segunda puerta real del vestíbulo `/juegos`, con panel admin propio (hoy no tiene ninguno).

**Architecture:** Se replica exactamente la forma que ya probamos en Arena Abierta: `src/lib/ruleta/room.server.ts` (encontrar-o-crear sala, sin sembrar contenido — a diferencia de Arena Abierta, Ruleta no necesita preguntas precargadas, la frase se elige recién en `/start`) y `src/lib/ruleta/advance.server.ts` (transiciones de fase auto-disparables + sanación de salas abandonadas). El mecanismo de turnos (quién gira, quién adivina) es específico de Ruleta y NO cambia — sigue siendo por turnos, un jugador a la vez, con `turno_jugador_id`/`turno_termina_en`. Lo que cambia es todo lo que hoy depende de "el anfitrión": crear sala, arrancar la partida, y avanzar de ronda pasan de ser clics manuales del anfitrión a disparos automáticos, igual que en Arena Abierta.

**A diferencia de Arena Abierta, esta fase NO agrega una fase "counting" (cuenta regresiva visible antes de arrancar)** — Ruleta ya no tenía eso antes (el anfitrión apretaba "Iniciar" cuando quería), así que aquí "arrancar" pasa directo de `lobby` a `playing` en cuanto se alcanza el número de jugadores deseado (o se fuerza antes). Agregar una cuenta regresiva visible sería una mejora cosmética más, no algo que se pidió explícitamente — se puede sumar después si se quiere, sin tocar nada de esta fase.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Supabase (Postgres + Realtime), mismo stack que Arena Abierta.

**Lo que NO cambia en esta fase** (verificado leyendo el código real antes de escribir este plan): `src/lib/ruleta/game.server.ts` (lógica de tablero/frase), `src/lib/ruleta/puzzles.server.ts` (banco de frases), `src/components/ruleta/Wheel.tsx`, `Board.tsx`, `Letters.tsx`, `Scoreboard.tsx`, `MatchEndScreen.tsx`, `sound.client.ts` — todos puramente mecánicos, sin ninguna referencia a `isHost`/`created_by`/código. Tampoco cambia `spin/route.ts` (ya es 100% jugador-a-jugador, sin gate de anfitrión) ni `voice-token/route.ts` (ya exige cuenta y valida contra `ruleta_jugadores.user_id` — con cuenta obligatoria para todos, se vuelve más consistente todavía, sin tocar una línea).

---

## Task 1: Migración — matchmaking + reparar el hueco de auto-avance de ronda

**Files:**
- Create: `supabase/migrations/0025_ruleta_matchmaking.sql`

- [ ] **Paso 1: Escribir la migración**

```sql
-- Ya no hay "el anfitrión" — las salas se auto-asignan (ver
-- getOrCreateOpenRoom() en room.server.ts), así que created_by deja de ser
-- obligatorio. Las filas históricas conservan su valor; las salas nuevas
-- simplemente no lo llenan.
ALTER TABLE ruleta_salas ALTER COLUMN created_by DROP NOT NULL;

-- "¿Cuántos van a jugar?" — mismo mecanismo que Arena Abierta: quien
-- termina creando la sala elige un número entre MIN_PLAYERS y MAX_PLAYERS
-- (2-6, ver src/lib/ruleta/wheel.ts); la sala espera a llegar a ese número
-- antes de arrancar sola, con opción de forzar el arranque antes.
ALTER TABLE ruleta_salas
  ADD COLUMN jugadores_deseados INT NOT NULL DEFAULT 2
    CHECK (jugadores_deseados BETWEEN 2 AND 6);

-- Hueco real que existía desde antes de esta fase: cuando una ronda
-- terminaba (alguien resolvió el panel, o se acabaron las letras),
-- turno_termina_en se ponía en NULL y la sala se quedaba en 'ronda_fin'
-- esperando a que el anfitrión diera clic en "Siguiente ronda" — sin
-- ningún timer, sin ninguna forma de que avanzara sola. Esta columna le da
-- a esa fase el mismo tipo de deadline que ya tienen las demás.
ALTER TABLE ruleta_salas ADD COLUMN ronda_fin_termina_en TIMESTAMPTZ;

-- El índice de user_id ya existía (migración 0020) pero no era único —
-- ahora que TODOS los jugadores van a tener cuenta, lo volvemos único para
-- poder hacer inserts idempotentes (recarga de página, doble clic) igual
-- que en Arena Abierta.
DROP INDEX IF EXISTS idx_ruleta_jugadores_user;
CREATE UNIQUE INDEX idx_ruleta_jugadores_sala_user
  ON ruleta_jugadores (sala_id, user_id) WHERE user_id IS NOT NULL;

-- Igual que Arena Abierta: a lo sumo una sala en 'lobby' a la vez, para que
-- dos requests concurrentes no creen dos salas de espera duplicadas. Salas
-- en 'playing'/'ronda_fin' pueden coexistir libremente con una sala nueva
-- en 'lobby' — así varias partidas de Ruleta corren en paralelo.
CREATE UNIQUE INDEX idx_ruleta_salas_una_lobby
  ON ruleta_salas ((1)) WHERE status = 'lobby';
```

- [ ] **Paso 2: Aplicar en el SQL Editor de Supabase de producción**

Pegar el SQL vía `window.monaco.editor.getEditors()[0].setValue(sql)`, dar Run, confirmar el modal de "potentially destructive" (el `DROP INDEX` lo dispara), y verificar:

```sql
select column_name, is_nullable, column_default
from information_schema.columns
where table_name = 'ruleta_salas'
  and column_name in ('created_by', 'jugadores_deseados', 'ronda_fin_termina_en');

select indexname, indexdef from pg_indexes
where tablename in ('ruleta_salas', 'ruleta_jugadores')
  and indexname in ('idx_ruleta_jugadores_sala_user', 'idx_ruleta_salas_una_lobby');
```

Expected: `created_by` con `is_nullable = YES`; `jugadores_deseados` con default `2`; `ronda_fin_termina_en` nullable sin default; los dos índices nuevos presentes.

- [ ] **Paso 3: Commit**

```bash
git add supabase/migrations/0025_ruleta_matchmaking.sql
git commit -m "Add Ruleta matchmaking columns and fix missing ronda_fin timer"
```

---

## Task 2: Actualizar tipos y constantes

**Files:**
- Modify: `src/types/index.ts:302-321` (`RuletaSala`)
- Modify: `src/lib/ruleta/wheel.ts:38-45`

- [ ] **Paso 1: Actualizar `RuletaSala`**

En `src/types/index.ts`, reemplazar:

```typescript
export interface RuletaSala {
  id: string;
  codigo: string;
  status: RuletaStatus;
  rondas_totales: number;
  ronda_actual: number;
  turno_jugador_id: string | null;
  turno_termina_en: string | null;
  giro_usado: boolean;
  puede_consonante: boolean;
  valor_giro_actual: number | null;
  frases_usadas: string[];
  ultima_categoria: string | null;
  created_by: string;
  created_at: string;
}
```

por:

```typescript
export interface RuletaSala {
  id: string;
  codigo: string;
  status: RuletaStatus;
  rondas_totales: number;
  ronda_actual: number;
  jugadores_deseados: number;
  turno_jugador_id: string | null;
  turno_termina_en: string | null;
  ronda_fin_termina_en: string | null;
  giro_usado: boolean;
  puede_consonante: boolean;
  valor_giro_actual: number | null;
  frases_usadas: string[];
  ultima_categoria: string | null;
  created_by: string | null;
  created_at: string;
}
```

- [ ] **Paso 2: Agregar la constante de duración de "ronda terminada"**

En `src/lib/ruleta/wheel.ts`, reemplazar:

```typescript
export const VOWEL_COST = 700;
export const TURN_SECONDS = 15;
export const RESOLVE_BONUS = 500;
```

por:

```typescript
export const VOWEL_COST = 700;
export const TURN_SECONDS = 15;
export const RESOLVE_BONUS = 500;
export const RONDA_FIN_SECONDS = 8; // cuánto se muestra la frase/ganador antes de pasar solo a la siguiente ronda
```

- [ ] **Paso 3: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: van a aparecer errores en archivos que todavía no se tocan (todo lo que lee `sala.created_by` como `string` no-nullable, o inserta en `ruleta_salas` sin `jugadores_deseados`) — se resuelven en tasks siguientes. No corregir nada todavía, solo confirmar que los únicos errores son de ese tipo (referencias a `created_by`/`jugadores_deseados`), no otra cosa inesperada.

- [ ] **Paso 4: Commit**

```bash
git add src/types/index.ts src/lib/ruleta/wheel.ts
git commit -m "Add jugadores_deseados/ronda_fin_termina_en to RuletaSala type"
```

---

## Task 3: `src/lib/ruleta/room.server.ts` — encontrar-o-crear sala

**Files:**
- Create: `src/lib/ruleta/room.server.ts`

- [ ] **Paso 1: Escribir el archivo**

```typescript
// src/lib/ruleta/room.server.ts
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { MIN_PLAYERS } from "./wheel";
import { healStaleRuletaRooms } from "./advance.server";

const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function generateCode() {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/**
 * Devuelve la sala "abierta a unirse" (la más reciente en 'lobby'). Si no
 * existe ninguna, crea una nueva — a diferencia de Arena Abierta, aquí no
 * hay contenido que sembrar de una vez (la frase se elige recién al
 * arrancar, en tryStartMatch()), así que crear una sala de Ruleta es más
 * simple: solo la fila de ruleta_salas.
 *
 * jugadoresDeseados solo se usa si esta llamada es la que efectivamente
 * crea la sala — si ya existía una en 'lobby', se devuelve tal cual, con
 * el número que fijó quien la creó primero.
 *
 * También dispara healStaleRuletaRooms() de paso — cualquier visita a
 * /ruleta ayuda a sanar salas abandonadas, igual que en Arena Abierta.
 */
export async function getOrCreateOpenRoom(jugadoresDeseados = MIN_PLAYERS): Promise<{
  sala: { id: string; codigo: string } | null;
  error: string | null;
}> {
  const service = await createServiceClient();

  await healStaleRuletaRooms().catch((err) => {
    console.error("[ruleta/room] Error inesperado en healStaleRuletaRooms:", err);
  });

  const buscarSalaAbierta = () =>
    service
      .from("ruleta_salas")
      .select("id, codigo")
      .eq("status", "lobby")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  const { data: existente } = await buscarSalaAbierta();
  if (existente) return { sala: existente, error: null };

  let codigo = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateCode();
    const { data: enUso } = await service
      .from("ruleta_salas")
      .select("id")
      .eq("codigo", candidate)
      .maybeSingle();
    if (!enUso) {
      codigo = candidate;
      break;
    }
  }

  if (!codigo) {
    return { sala: null, error: "No se pudo generar un código único" };
  }

  const { data: nuevaSala, error } = await service
    .from("ruleta_salas")
    .insert({ codigo, jugadores_deseados: jugadoresDeseados })
    .select("id, codigo")
    .single();

  if (error || !nuevaSala) {
    // 23505 = violación de idx_ruleta_salas_una_lobby: otra request
    // concurrente ganó la carrera. No es un error real — esa sala ya
    // existe, así que la buscamos y la devolvemos en vez de fallar.
    if (error?.code === "23505") {
      const { data: salaGanadora } = await buscarSalaAbierta();
      if (salaGanadora) return { sala: salaGanadora, error: null };
    }
    return { sala: null, error: error?.message ?? "No se pudo crear la sala" };
  }

  return { sala: nuevaSala, error: null };
}
```

- [ ] **Paso 2: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: error en el import de `healStaleRuletaRooms` desde `./advance.server` — ese archivo no existe todavía, se crea en el Task 4. Confirmar que ese es el único error nuevo introducido por este archivo.

- [ ] **Paso 3: Commit**

```bash
git add src/lib/ruleta/room.server.ts
git commit -m "Add Ruleta matchmaking room finder/creator"
```

---

## Task 4: `src/lib/ruleta/advance.server.ts` — transiciones compartidas + auto-sanación

**Files:**
- Create: `src/lib/ruleta/advance.server.ts`

Este archivo extrae la lógica que hoy vive completa dentro de `start/route.ts`, `next-round/route.ts` y `timeout/route.ts` (leídos en su totalidad antes de escribir este plan) a funciones reutilizables, para que tanto las rutas (llamadas por un jugador) como la auto-sanación (llamada por cualquier visita a la página) disparen exactamente la misma transición.

- [ ] **Paso 1: Escribir el archivo**

```typescript
// src/lib/ruleta/advance.server.ts
import "server-only";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TURN_SECONDS, RONDA_FIN_SECONDS, MIN_PLAYERS } from "./wheel";
import { buildBoardShape } from "./game.server";
import { pickPuzzle } from "./puzzles.server";
import { nextJugadorId } from "./game.server";

async function broadcast(codigo: string, event: string, payload: object) {
  const supabase = await createClient();
  const channel = supabase.channel(`ruleta:${codigo}`);
  await channel.send({ type: "broadcast", event, payload });
}

/**
 * Intenta pasar la sala de 'lobby' a 'playing' — arranca la primera ronda.
 * Misma lógica que tenía start/route.ts, ahora reutilizable desde: la
 * propia ruta /start (llamada por cualquier jugador, no solo un
 * "anfitrión"), la auto-sanación de una sala 'lobby' atascada, y
 * /force-start (que pasa requireTarget=false para saltarse la meta y
 * arrancar con el piso mínimo).
 */
export async function tryStartMatch(
  salaId: string,
  requireTarget: boolean
): Promise<{ applied: boolean; error?: string }> {
  const service = await createServiceClient();

  const { data: sala, error: salaError } = await service
    .from("ruleta_salas")
    .select("*")
    .eq("id", salaId)
    .maybeSingle();

  if (salaError) return { applied: false, error: salaError.message };
  if (!sala || sala.status !== "lobby") return { applied: false };

  const { data: jugadores, error: jugadoresError } = await service
    .from("ruleta_jugadores")
    .select("id, orden")
    .eq("sala_id", salaId)
    .order("orden");

  if (jugadoresError) return { applied: false, error: jugadoresError.message };

  const umbral = requireTarget ? sala.jugadores_deseados : MIN_PLAYERS;
  if (!jugadores || jugadores.length < umbral) return { applied: false };

  const { puzzle, usedKeys } = pickPuzzle(sala.frases_usadas as string[], sala.ultima_categoria);
  const frase = puzzle.phrase.toUpperCase();
  const primerJugador = jugadores[0];
  const endsAt = Date.now() + TURN_SECONDS * 1000;

  const { data: updated, error: updateError } = await service
    .from("ruleta_salas")
    .update({
      status: "playing",
      ronda_actual: 1,
      turno_jugador_id: primerJugador.id,
      turno_termina_en: new Date(endsAt).toISOString(),
      giro_usado: false,
      puede_consonante: false,
      valor_giro_actual: null,
      frases_usadas: usedKeys,
      ultima_categoria: puzzle.category,
    })
    .eq("id", salaId)
    .eq("status", "lobby")
    .select("id");

  if (updateError) return { applied: false, error: updateError.message };
  if (!updated || updated.length === 0) return { applied: false };

  const { error: rondaError } = await service.from("ruleta_rondas").upsert(
    { sala_id: salaId, ronda_numero: 1, categoria: puzzle.category, frase, letras_adivinadas: [] },
    { onConflict: "sala_id,ronda_numero" }
  );
  if (rondaError) return { applied: false, error: rondaError.message };

  await broadcast(sala.codigo, "ROUND_START", {
    ronda: 1,
    totalRondas: sala.rondas_totales,
    categoria: puzzle.category,
    board: buildBoardShape(frase, []),
    letrasProbadas: [],
    turnoJugadorId: primerJugador.id,
    turnoTerminaEn: endsAt,
  });

  return { applied: true };
}

/**
 * Intenta avanzar el turno cuando venció (o, con bypassDeadline=true, sin
 * esperar a que venza) — mismo comportamiento que tenía timeout/route.ts.
 * bypassDeadline reemplaza al viejo "force" exclusivo del anfitrión: ahora
 * lo puede pedir cualquier jugador de la sala (ver /timeout, que valida
 * pertenencia antes de pasar bypassDeadline=true) o la auto-sanación.
 */
export async function tryAdvanceTurn(
  salaId: string,
  bypassDeadline: boolean
): Promise<{ applied: boolean; error?: string }> {
  const service = await createServiceClient();

  const { data: sala, error: salaError } = await service
    .from("ruleta_salas")
    .select("*")
    .eq("id", salaId)
    .maybeSingle();

  if (salaError) return { applied: false, error: salaError.message };
  if (!sala || sala.status !== "playing" || sala.turno_termina_en === null) {
    return { applied: false };
  }
  if (!bypassDeadline && new Date(sala.turno_termina_en).getTime() > Date.now()) {
    return { applied: false };
  }
  if (sala.turno_jugador_id === null) return { applied: false };

  const { data: jugadores, error: jugadoresError } = await service
    .from("ruleta_jugadores")
    .select("id, orden")
    .eq("sala_id", salaId);

  if (jugadoresError) return { applied: false, error: jugadoresError.message };
  if (!jugadores) return { applied: false };

  const nextId = nextJugadorId(jugadores, sala.turno_jugador_id);
  const endsAt = Date.now() + TURN_SECONDS * 1000;

  const { data: updated, error: updateError } = await service
    .from("ruleta_salas")
    .update({
      puede_consonante: false,
      giro_usado: false,
      turno_jugador_id: nextId,
      turno_termina_en: new Date(endsAt).toISOString(),
    })
    .eq("id", salaId)
    .eq("turno_termina_en", sala.turno_termina_en)
    .select("id");

  if (updateError) return { applied: false, error: updateError.message };
  if (!updated || updated.length === 0) return { applied: false };

  await broadcast(sala.codigo, "TURN_TIMEOUT", {
    turnoJugadorId: nextId,
    turnoTerminaEn: endsAt,
    mensaje: "Se acabó el tiempo.",
  });

  return { applied: true };
}

/**
 * Intenta pasar la sala de 'ronda_fin' a la siguiente ronda (o a
 * 'finished' si ya no quedan más) — mismo comportamiento que tenía
 * next-round/route.ts, ahora auto-disparable: solo aplica una vez que
 * ronda_fin_termina_en ya venció (a diferencia del viejo botón manual del
 * anfitrión, que no esperaba nada).
 */
export async function tryAdvanceRound(salaId: string): Promise<{ applied: boolean; error?: string }> {
  const service = await createServiceClient();

  const { data: sala, error: salaError } = await service
    .from("ruleta_salas")
    .select("*")
    .eq("id", salaId)
    .maybeSingle();

  if (salaError) return { applied: false, error: salaError.message };
  if (
    !sala ||
    sala.status !== "ronda_fin" ||
    !sala.ronda_fin_termina_en ||
    new Date(sala.ronda_fin_termina_en).getTime() > Date.now()
  ) {
    return { applied: false };
  }

  if (sala.ronda_actual >= sala.rondas_totales) {
    const { data: updated, error: updateError } = await service
      .from("ruleta_salas")
      .update({ status: "finished" })
      .eq("id", salaId)
      .eq("status", "ronda_fin")
      .eq("ronda_fin_termina_en", sala.ronda_fin_termina_en)
      .select("id");

    if (updateError) return { applied: false, error: updateError.message };
    if (!updated || updated.length === 0) return { applied: false };

    await broadcast(sala.codigo, "GAME_FINISHED", {});
    return { applied: true };
  }

  const { puzzle, usedKeys } = pickPuzzle(sala.frases_usadas as string[], sala.ultima_categoria);
  const frase = puzzle.phrase.toUpperCase();
  const nuevaRonda = sala.ronda_actual + 1;
  const endsAt = Date.now() + TURN_SECONDS * 1000;

  const { data: updated, error: updateError } = await service
    .from("ruleta_salas")
    .update({
      status: "playing",
      ronda_actual: nuevaRonda,
      turno_termina_en: new Date(endsAt).toISOString(),
      ronda_fin_termina_en: null,
      giro_usado: false,
      puede_consonante: false,
      valor_giro_actual: null,
      frases_usadas: usedKeys,
      ultima_categoria: puzzle.category,
    })
    .eq("id", salaId)
    .eq("status", "ronda_fin")
    .eq("ronda_fin_termina_en", sala.ronda_fin_termina_en)
    .select("id");

  if (updateError) return { applied: false, error: updateError.message };
  if (!updated || updated.length === 0) return { applied: false };

  const { error: rondaError } = await service.from("ruleta_rondas").upsert(
    { sala_id: salaId, ronda_numero: nuevaRonda, categoria: puzzle.category, frase, letras_adivinadas: [] },
    { onConflict: "sala_id,ronda_numero" }
  );
  if (rondaError) return { applied: false, error: rondaError.message };

  await broadcast(sala.codigo, "ROUND_START", {
    ronda: nuevaRonda,
    totalRondas: sala.rondas_totales,
    categoria: puzzle.category,
    board: buildBoardShape(frase, []),
    letrasProbadas: [],
    turnoJugadorId: sala.turno_jugador_id,
    turnoTerminaEn: endsAt,
  });

  return { applied: true };
}

const STALE_GRACE_MS = 15_000;

/**
 * Red de seguridad para salas abandonadas — mismo espíritu que
 * healStaleRooms() de Arena Abierta. Se llama desde
 * getOrCreateOpenRoom() en cada visita a /ruleta:
 *  - 'lobby' con suficientes jugadores pero que nunca arrancó (el propio
 *    /join falló en silencio al intentarlo) → tryStartMatch.
 *  - 'playing' cuyo turno venció hace rato y nadie lo reportó (todos
 *    cerraron la pestaña) → tryAdvanceTurn con bypassDeadline.
 *  - 'ronda_fin' cuyo ronda_fin_termina_en venció hace rato → tryAdvanceRound.
 */
export async function healStaleRuletaRooms(): Promise<void> {
  const service = await createServiceClient();
  const now = Date.now();

  const { data: salas, error } = await service
    .from("ruleta_salas")
    .select("id, status, turno_termina_en, ronda_fin_termina_en")
    .in("status", ["lobby", "playing", "ronda_fin"]);

  if (error) {
    console.error("[ruleta/heal] Error al buscar salas activas:", error);
    return;
  }
  if (!salas || salas.length === 0) return;

  for (const sala of salas) {
    if (sala.status === "lobby") {
      const { error: startError } = await tryStartMatch(sala.id, true);
      if (startError) console.error(`[ruleta/heal] Error al intentar arrancar sala ${sala.id}:`, startError);
      continue;
    }

    if (sala.status === "playing") {
      if (!sala.turno_termina_en) continue;
      if (now - new Date(sala.turno_termina_en).getTime() < STALE_GRACE_MS) continue;
      const { error: turnoError } = await tryAdvanceTurn(sala.id, true);
      if (turnoError) console.error(`[ruleta/heal] Error al sanar turno de sala ${sala.id}:`, turnoError);
      continue;
    }

    if (sala.status === "ronda_fin") {
      if (!sala.ronda_fin_termina_en) continue;
      if (now - new Date(sala.ronda_fin_termina_en).getTime() < STALE_GRACE_MS) continue;
      const { error: rondaError } = await tryAdvanceRound(sala.id);
      if (rondaError) console.error(`[ruleta/heal] Error al sanar ronda de sala ${sala.id}:`, rondaError);
    }
  }
}
```

- [ ] **Paso 2: Verificar que `nextJugadorId` y `buildBoardShape` existen tal cual en `game.server.ts`, y que `pickPuzzle` existe tal cual en `puzzles.server.ts`**

Estas tres funciones ya existían y se usaban con esta misma firma en `start/route.ts`, `next-round/route.ts` y `timeout/route.ts` antes de esta fase — este paso es solo confirmar que sus nombres/firmas no cambiaron desde que se leyó el código para este plan.

- [ ] **Paso 3: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: el error del Task 3 (import de `healStaleRuletaRooms`) desaparece. Pueden seguir apareciendo errores en las rutas todavía no tocadas (`start`, `next-round`, `timeout` siguen con su lógica vieja duplicada — eso es esperado, se resuelve en el Task 5).

- [ ] **Paso 4: Commit**

```bash
git add src/lib/ruleta/advance.server.ts
git commit -m "Extract Ruleta phase transitions into shared, self-healable functions"
```

---

## Task 5: Las rutas se vuelven envoltorios delgados — sin anfitrión

**Files:**
- Modify: `src/app/api/ruleta/[codigo]/start/route.ts`
- Modify: `src/app/api/ruleta/[codigo]/next-round/route.ts`
- Modify: `src/app/api/ruleta/[codigo]/timeout/route.ts`
- Delete: `src/app/api/ruleta/create/route.ts` (y su carpeta si queda vacía)

- [ ] **Paso 1: `start/route.ts` — reemplazar todo el archivo**

```typescript
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { tryStartMatch } from "@/lib/ruleta/advance.server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const service = await createServiceClient();

  const { data: sala } = await service
    .from("ruleta_salas")
    .select("id")
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });

  const { applied, error } = await tryStartMatch(sala.id, true);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ success: applied });
}
```

- [ ] **Paso 2: `next-round/route.ts` — reemplazar todo el archivo**

```typescript
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { tryAdvanceRound } from "@/lib/ruleta/advance.server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const service = await createServiceClient();

  const { data: sala } = await service
    .from("ruleta_salas")
    .select("id")
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });

  const { applied, error } = await tryAdvanceRound(sala.id);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ success: applied });
}
```

- [ ] **Paso 3: `timeout/route.ts` — reemplazar todo el archivo**

El `force` ya no valida contra `sala.created_by` (no existe más "el anfitrión") — ahora cualquier jugador de la sala puede pedirlo, verificado por pertenencia igual que `/force-start` de Arena Abierta.

```typescript
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { tryAdvanceTurn } from "@/lib/ruleta/advance.server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const service = await createServiceClient();

  let body: { force?: boolean; jugador_id?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Cuerpo vacío es válido — el disparo automático no manda body.
  }

  const { data: sala } = await service
    .from("ruleta_salas")
    .select("id")
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });

  let bypassDeadline = false;
  if (body.force === true) {
    if (!body.jugador_id) {
      return NextResponse.json({ error: "jugador_id requerido para forzar" }, { status: 400 });
    }
    const { data: jugador } = await service
      .from("ruleta_jugadores")
      .select("id")
      .eq("id", body.jugador_id)
      .eq("sala_id", sala.id)
      .maybeSingle();
    if (!jugador) return NextResponse.json({ error: "No eres jugador de esta sala" }, { status: 403 });
    bypassDeadline = true;
  }

  const { applied, error } = await tryAdvanceTurn(sala.id, bypassDeadline);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ applied });
}
```

- [ ] **Paso 4: Borrar la ruta de creación**

```bash
rm src/app/api/ruleta/create/route.ts
rmdir src/app/api/ruleta/create 2>/dev/null || true
```

Ya no hace falta — crear una sala ahora lo hace `getOrCreateOpenRoom()` desde el propio Server Component de la página (Task 12), no una llamada del cliente.

- [ ] **Paso 5: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin nuevos errores relacionados a estos tres archivos (van a seguir los errores esperados en archivos aún no tocados: `RuletaRoom.tsx`, `[codigo]/page.tsx`, etc. — no corregirlos aquí).

- [ ] **Paso 6: Commit**

```bash
git add -A src/app/api/ruleta/create src/app/api/ruleta/[codigo]/start/route.ts "src/app/api/ruleta/[codigo]/next-round/route.ts" "src/app/api/ruleta/[codigo]/timeout/route.ts"
git commit -m "Make Ruleta start/next-round/timeout self-triggering, drop host gate"
```

---

## Task 6: Ronda-fin necesita un deadline en sus tres puntos de entrada

**Files:**
- Modify: `src/app/api/ruleta/[codigo]/resolve/route.ts`
- Modify: `src/app/api/ruleta/[codigo]/guess-consonant/route.ts`
- Modify: `src/app/api/ruleta/[codigo]/guess-vowel/route.ts`

Hay exactamente tres lugares en el código donde una sala entra a `status: "ronda_fin"` — los tres deben fijar también `ronda_fin_termina_en`, si no, `tryAdvanceRound()` (Task 4) nunca va a tener un deadline que revisar y la ronda se queda trabada para siempre, igual que antes de esta fase (solo que ahora sin ni siquiera el botón manual del anfitrión).

- [ ] **Paso 1: `resolve/route.ts`**

Localizar (dentro del bloque `if (acierto) { ... }`):

```typescript
    const { data: updated, error: updateError } = await service
      .from("ruleta_salas")
      .update({ status: "ronda_fin", turno_termina_en: null })
      .eq("id", sala.id)
      .eq("turno_termina_en", sala.turno_termina_en)
      .select("id");
```

Reemplazar por:

```typescript
    const ronda_fin_termina_en = Date.now() + RONDA_FIN_SECONDS * 1000;
    const { data: updated, error: updateError } = await service
      .from("ruleta_salas")
      .update({
        status: "ronda_fin",
        turno_termina_en: null,
        ronda_fin_termina_en: new Date(ronda_fin_termina_en).toISOString(),
      })
      .eq("id", sala.id)
      .eq("turno_termina_en", sala.turno_termina_en)
      .select("id");
```

Agregar `RONDA_FIN_SECONDS` al import existente de `@/lib/ruleta/wheel` (la línea actual importa `TURN_SECONDS, RESOLVE_BONUS` — agregarlo a esa misma lista).

- [ ] **Paso 2: `guess-consonant/route.ts`**

Localizar (dentro de la rama `count > 0`, el `.update(resuelto ? {...} : {...})`):

```typescript
      .update(
        resuelto
          ? { status: "ronda_fin", puede_consonante: false, giro_usado: false, turno_termina_en: null }
          : { puede_consonante: false, giro_usado: false, turno_termina_en: new Date(endsAt).toISOString() }
      )
```

Reemplazar por:

```typescript
      .update(
        resuelto
          ? {
              status: "ronda_fin",
              puede_consonante: false,
              giro_usado: false,
              turno_termina_en: null,
              ronda_fin_termina_en: new Date(Date.now() + RONDA_FIN_SECONDS * 1000).toISOString(),
            }
          : { puede_consonante: false, giro_usado: false, turno_termina_en: new Date(endsAt).toISOString() }
      )
```

Agregar `RONDA_FIN_SECONDS` al import existente de `@/lib/ruleta/wheel` (la línea actual importa `ALPHABET, VOWELS, TURN_SECONDS`).

- [ ] **Paso 3: `guess-vowel/route.ts`**

Este archivo no se leyó completo para este plan, pero se confirmó (grep) que su bloque análogo es:

```typescript
      .update(
        resuelto
          ? { status: "ronda_fin", turno_termina_en: null }
          : { turno_termina_en: new Date(endsAt).toISOString() }
      )
```

Aplicar el mismo cambio que en el Paso 2: agregar `ronda_fin_termina_en: new Date(Date.now() + RONDA_FIN_SECONDS * 1000).toISOString()` dentro de la rama `resuelto ? {...}`, y agregar `RONDA_FIN_SECONDS` al import de `@/lib/ruleta/wheel` de este archivo. Leer el archivo completo primero para confirmar el nombre exacto de las variables en su scope (`endsAt` u otro nombre) antes de aplicar el cambio.

- [ ] **Paso 4: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores en estos tres archivos.

- [ ] **Paso 5: Commit**

```bash
git add "src/app/api/ruleta/[codigo]/resolve/route.ts" "src/app/api/ruleta/[codigo]/guess-consonant/route.ts" "src/app/api/ruleta/[codigo]/guess-vowel/route.ts"
git commit -m "Set ronda_fin_termina_en at all three round-end entry points"
```

---

## Task 7: Cuenta obligatoria para unirse + arranque automático

**Files:**
- Modify: `src/app/api/ruleta/[codigo]/join/route.ts`

- [ ] **Paso 1: Reescribir la ruta completa**

```typescript
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { tryStartMatch } from "@/lib/ruleta/advance.server";
import { MIN_PLAYERS, MAX_PLAYERS } from "@/lib/ruleta/wheel";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;

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
    MIN_PLAYERS,
    Math.min(MAX_PLAYERS, Math.round(body.jugadores_deseados ?? MIN_PLAYERS))
  );

  const { data: profile } = await authClient
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  const nombre = (profile?.display_name ?? "Jugador").slice(0, 20);

  const service = await createServiceClient();

  const { data: sala } = await service
    .from("ruleta_salas")
    .select("id, status")
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  if (sala.status !== "lobby") {
    return NextResponse.json({ error: "El juego ya comenzó" }, { status: 400 });
  }

  const { data: existente } = await service
    .from("ruleta_jugadores")
    .select("id")
    .eq("sala_id", sala.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existente) return NextResponse.json({ jugador_id: existente.id });

  const { count } = await service
    .from("ruleta_jugadores")
    .select("id", { count: "exact", head: true })
    .eq("sala_id", sala.id);

  if ((count ?? 0) >= MAX_PLAYERS) {
    return NextResponse.json({ error: "La sala está llena" }, { status: 400 });
  }

  const { data: jugador, error } = await service
    .from("ruleta_jugadores")
    .insert({ sala_id: sala.id, nombre, orden: count ?? 0, puntos: 0, user_id: user.id })
    .select("id")
    .single();

  if (error) {
    // 23505 = otra request concurrente de la MISMA cuenta ganó la carrera
    // entre el check de "existente" de arriba y este insert (doble clic,
    // doble pestaña) — no es un error real, buscamos y devolvemos esa fila.
    if (error.code === "23505") {
      const { data: jugadorGanador } = await service
        .from("ruleta_jugadores")
        .select("id")
        .eq("sala_id", sala.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (jugadorGanador) return NextResponse.json({ jugador_id: jugadorGanador.id });
    }
    return NextResponse.json({ error: error.message ?? "Error al unirse" }, { status: 500 });
  }
  if (!jugador) {
    return NextResponse.json({ error: "Error al unirse" }, { status: 500 });
  }

  const { error: startError } = await tryStartMatch(sala.id, true);
  if (startError) {
    console.error(`[ruleta/join] tryStartMatch falló para sala ${sala.id}:`, startError);
  }

  return NextResponse.json({ jugador_id: jugador.id });
}
```

Cambios clave respecto a la versión anterior: exige sesión (ya no hay rama "unirse sin cuenta"); ya no acepta `nombre` del cliente, usa `profiles.display_name`; recibe `jugadores_deseados` opcional (irrelevante si la sala ya existía); el índice único `(sala_id, user_id)` del Task 1 se aprovecha con manejo de `23505` desde el primer insert (aplicando de una vez la lección de la Fase 1 — Arena Abierta tuvo que corregir esto en una vuelta de revisión aparte); dispara `tryStartMatch` al final igual que el join de Arena Abierta dispara `tryStartCounting`, con el error logueado en vez de descartado en silencio.

- [ ] **Paso 2: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores.

- [ ] **Paso 3: Commit**

```bash
git add "src/app/api/ruleta/[codigo]/join/route.ts"
git commit -m "Require login to join Ruleta, drop free-text nombre, auto-start"
```

---

## Task 8: Ruta para "empezar con los que hay"

**Files:**
- Create: `src/app/api/ruleta/[codigo]/force-start/route.ts`

- [ ] **Paso 1: Escribir la ruta**

```typescript
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { tryStartMatch } from "@/lib/ruleta/advance.server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;

  let body: { jugador_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.jugador_id) {
    return NextResponse.json({ error: "jugador_id requerido" }, { status: 400 });
  }

  const service = await createServiceClient();

  const { data: sala } = await service
    .from("ruleta_salas")
    .select("id")
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });

  const { data: jugador } = await service
    .from("ruleta_jugadores")
    .select("id")
    .eq("id", body.jugador_id)
    .eq("sala_id", sala.id)
    .maybeSingle();

  if (!jugador) {
    return NextResponse.json({ error: "No eres jugador de esta sala" }, { status: 403 });
  }

  const { applied, error } = await tryStartMatch(sala.id, false);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ applied });
}
```

- [ ] **Paso 2: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores.

- [ ] **Paso 3: Commit**

```bash
git add "src/app/api/ruleta/[codigo]/force-start/"
git commit -m "Add force-start endpoint for Ruleta lobbies"
```

---

## Task 9: `EntrarForm` — reemplaza `JoinForm`, `HostLobby`, `RuletaCreateForm`, `RuletaJoinCodeForm`

**Files:**
- Create: `src/components/ruleta/EntrarForm.tsx`
- Delete: `src/components/ruleta/JoinForm.tsx`
- Delete: `src/components/ruleta/HostLobby.tsx`
- Delete: `src/components/ruleta/RuletaCreateForm.tsx`
- Delete: `src/components/ruleta/RuletaJoinCodeForm.tsx`

- [ ] **Paso 1: Crear `EntrarForm.tsx`**

Mismo patrón exacto que `src/components/arena-publica/EntrarForm.tsx` (Fase 1, ya revisado y probado en producción) — selector de cuántos van a jugar, sin campo de nombre, apuntando al endpoint de Ruleta:

```tsx
"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Disc3 } from "lucide-react";
import { MIN_PLAYERS, MAX_PLAYERS } from "@/lib/ruleta/wheel";

interface EntrarFormProps {
  codigo: string;
  onEntrado: (jugadorId: string) => void;
}

export function EntrarForm({ codigo, onEntrado }: EntrarFormProps) {
  const [jugadoresDeseados, setJugadoresDeseados] = useState(MIN_PLAYERS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opciones = Array.from(
    { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
    (_, i) => MIN_PLAYERS + i
  );

  async function handleEntrar() {
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/ruleta/${codigo}/join`, {
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
    onEntrado(data.jugador_id);
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-10">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}
      >
        <Disc3 size={32} style={{ color: "var(--color-primary)" }} />
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

- [ ] **Paso 2: Borrar los cuatro componentes retirados**

```bash
rm src/components/ruleta/JoinForm.tsx
rm src/components/ruleta/HostLobby.tsx
rm src/components/ruleta/RuletaCreateForm.tsx
rm src/components/ruleta/RuletaJoinCodeForm.tsx
```

No arreglar todavía los archivos que los importaban (`RuletaRoom.tsx`, las páginas viejas) — eso es el Task 10 y el Task 12. `tsc` va a marcar esos imports rotos hasta entonces; es esperado.

- [ ] **Paso 3: Commit**

```bash
git add -A src/components/ruleta/EntrarForm.tsx src/components/ruleta/JoinForm.tsx src/components/ruleta/HostLobby.tsx src/components/ruleta/RuletaCreateForm.tsx src/components/ruleta/RuletaJoinCodeForm.tsx
git commit -m "Add Ruleta EntrarForm, remove host/code-based join components"
```

---

## Task 10: `RoundBanner` — cuenta regresiva en vez de botón del anfitrión

**Files:**
- Modify: `src/components/ruleta/RoundBanner.tsx`

- [ ] **Paso 1: Reemplazar todo el archivo**

```tsx
"use client";

import { Trophy } from "lucide-react";
import type { RuletaJugador } from "@/types";
import { TurnTimer } from "./TurnTimer";

interface RoundBannerProps {
  frase: string;
  ganador: RuletaJugador | null;
  terminaEn: number | null;
  onExpire: () => void;
}

export function RoundBanner({ frase, ganador, terminaEn, onExpire }: RoundBannerProps) {
  return (
    <div
      className="flex flex-col items-center gap-4 text-center rounded-2xl p-6"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-primary)" }}
    >
      <Trophy size={32} style={{ color: "var(--color-primary)" }} />
      <p className="text-sm font-semibold" style={{ color: "var(--color-text-muted)" }}>
        {ganador ? `${ganador.nombre} ganó la ronda` : "Ronda terminada"}
      </p>
      <p className="text-xl font-bold" style={{ color: "var(--color-text)" }}>{frase}</p>
      <TurnTimer endsAt={terminaEn} onExpire={onExpire} />
    </div>
  );
}
```

`TurnTimer` ya es genérico (`endsAt`/`onExpire`, sin nada específico de turnos en su implementación) — se reutiliza tal cual, sin tocarlo.

- [ ] **Paso 2: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: van a seguir los errores esperados en `RuletaRoom.tsx` (todavía no actualizado para pasar las props nuevas) — se resuelve en el Task 11.

- [ ] **Paso 3: Commit**

```bash
git add src/components/ruleta/RoundBanner.tsx
git commit -m "Replace RoundBanner's host button with an auto-advance countdown"
```

---

## Task 11: `RuletaRoom.tsx` — sin anfitrión, con sala de espera y arranque anticipado

**Files:**
- Modify: `src/components/ruleta/RuletaRoom.tsx`

Este es el archivo más grande que cambia (476 líneas hoy). Leer el archivo completo primero — el código de referencia abajo está tomado de su contenido real al momento de escribir este plan; si algo cambió mientras tanto, confirmar antes de aplicar ciegamente.

- [ ] **Paso 1: Quitar `isHost`, `hostWantsToPlay`, `viewerUserId` de las props**

Reemplazar la interfaz:

```typescript
interface RuletaRoomProps {
  sala: RuletaSala;
  jugadoresIniciales: RuletaJugador[];
  isHost: boolean;
  initialRound?: RoundState | null;
  initialJugadorId?: string | null;
  viewerUserId?: string | null;
}
```

por:

```typescript
interface RuletaRoomProps {
  sala: RuletaSala;
  jugadoresIniciales: RuletaJugador[];
  initialRound?: RoundState | null;
  initialJugadorId?: string | null;
}
```

Y en la firma de la función, quitar `isHost`, `hostWantsToPlay` (con su `useState`) y `viewerUserId` de la desestructuración/cuerpo. `RuletaVoiceChat` deja de depender de `viewerUserId` — con cuenta obligatoria para jugar, `jugadorId` ya implica sesión iniciada, así que la condición pasa de `viewerUserId && jugadorId && phase !== "finished"` a `jugadorId && phase !== "finished"`.

- [ ] **Paso 2: `handleJoined` → `handleEntrado`, sin nombre**

Reemplazar:

```typescript
  function handleJoined(id: string, nombre: string) {
    setJugadorId(id);
    try {
      localStorage.setItem(`ruleta_jugador_${sala.codigo}`, JSON.stringify({ id, nombre }));
    } catch {
      // localStorage no disponible
    }
  }
```

por:

```typescript
  function handleEntrado(id: string) {
    setJugadorId(id);
    try {
      localStorage.setItem(`ruleta_jugador_${sala.codigo}`, JSON.stringify({ id }));
    } catch {
      // localStorage no disponible
    }
  }
```

- [ ] **Paso 3: Quitar `handleStart`, agregar `handleForceStart`**

Borrar la función `handleStart` completa (ya no hace falta un botón que la dispare — el arranque es automático vía `tryStartMatch` desde el propio `/join`, o forzado por cualquier jugador).

Agregar, en su lugar, siguiendo el mismo patrón ya probado en `ArenaPublicaRoom.tsx` (con feedback de error/carga, no fire-and-forget silencioso):

```typescript
  const [forceStarting, setForceStarting] = useState(false);
  const [forceStartError, setForceStartError] = useState<string | null>(null);

  async function handleForceStart() {
    if (!jugadorId) return;
    setForceStarting(true);
    setForceStartError(null);
    try {
      const res = await fetch(`/api/ruleta/${sala.codigo}/force-start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jugador_id: jugadorId }),
      });
      if (!res.ok) setForceStartError("No se pudo empezar — intenta de nuevo");
    } catch {
      setForceStartError("No se pudo empezar — intenta de nuevo");
    } finally {
      setForceStarting(false);
    }
  }
```

- [ ] **Paso 4: `handleForceSkip` deja de estar atado a `isHost`, pasa `jugador_id`**

Reemplazar:

```typescript
  const [forcingSkip, setForcingSkip] = useState(false);
  async function handleForceSkip() {
    setForcingSkip(true);
    await fetch(`/api/ruleta/${sala.codigo}/timeout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    setForcingSkip(false);
  }
```

por:

```typescript
  const [forcingSkip, setForcingSkip] = useState(false);
  async function handleForceSkip() {
    if (!jugadorId) return;
    setForcingSkip(true);
    await fetch(`/api/ruleta/${sala.codigo}/timeout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true, jugador_id: jugadorId }),
    });
    setForcingSkip(false);
  }
```

(El endpoint ya exige `jugador_id` cuando `force: true`, ver Task 5 Paso 3 — sin este cambio, forzar el salto de turno rompería con un 400.)

- [ ] **Paso 5: Agregar `handleNextRoundExpire` como el `onExpire` de `RoundBanner`**

`handleNextRound` ya existe y llama a `/next-round` — se reutiliza tal cual como el `onExpire` que ahora le pasa `RoundBanner` a `TurnTimer` (Task 10), no hace falta ninguna función nueva aquí — solo actualizar cómo se le pasa en el JSX (Paso 7).

- [ ] **Paso 6: Reescribir el bloque de renderizado condicional principal**

Reemplazar todo el bloque desde `{phase === "finished" ? (` hasta el `) : null}` de cierre (el gran condicional que hoy tiene las ramas `isHost && hostWantsToPlay`, `isHost && phase === "lobby"`, `!isHost && !jugadorId`, `phase === "lobby"` con "Esperando que el anfitrión inicie...") por:

```tsx
        {phase === "finished" ? (
          <MatchEndScreen jugadores={jugadores} meId={jugadorId} />
        ) : !jugadorId ? (
          <EntrarForm codigo={sala.codigo} onEntrado={handleEntrado} />
        ) : phase === "lobby" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-primary)" }} />
            <p className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
              esperando más jugadores...
            </p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {jugadores.length} de {sala.jugadores_deseados} {sala.jugadores_deseados === 1 ? "jugador" : "jugadores"}
            </p>
            {jugadores.length >= MIN_PLAYERS && jugadores.length < sala.jugadores_deseados && (
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={handleForceStart}
                  disabled={forceStarting}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
                >
                  {forceStarting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Empezando…
                    </>
                  ) : (
                    `Empezar con ${jugadores.length}`
                  )}
                </button>
                {forceStartError && (
                  <p className="text-xs" style={{ color: "var(--color-destructive)" }}>{forceStartError}</p>
                )}
              </div>
            )}
          </div>
        ) : round && (phase === "playing" || phase === "ronda_fin") ? (
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
                Ronda {round.ronda} de {round.totalRondas} — {round.categoria}
              </p>
              <TurnTimer endsAt={phase === "playing" ? round.turnoTerminaEn : null} onExpire={handleTimeout} />
            </div>

            {phase === "playing" && (
              <button
                type="button"
                onClick={handleForceSkip}
                disabled={forcingSkip}
                className="self-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
              >
                <SkipForward size={13} />
                {forcingSkip ? "Forzando..." : "Forzar siguiente turno"}
              </button>
            )}

            <p className="text-sm text-center" style={{ color: "var(--color-text)" }}>{round.mensaje}</p>

            {phase === "ronda_fin" ? (
              <RoundBanner
                frase={round.frase ?? ""}
                ganador={jugadores.find((j) => j.id === round.turnoJugadorId) ?? null}
                terminaEn={round.rondaFinTerminaEn}
                onExpire={handleNextRound}
              />
            ) : (
              <>
                <Wheel
                  spinToSegment={round.spinToSegment}
                  spinToken={spinToken}
                  onSpinClick={handleSpin}
                  canSpin={misTurno && !round.giroUsado}
                />
                <Board tiles={round.board} />
                <Letters
                  letrasProbadas={round.letrasProbadas}
                  canGuessConsonant={misTurno && round.puedeConsonante}
                  canAffordVowel={misTurno && miPuntaje >= VOWEL_COST}
                  disabled={!misTurno}
                  onGuess={handleGuess}
                />
                {misTurno && (
                  <form onSubmit={handleResolve} className="flex gap-2">
                    <input
                      value={resolveText}
                      onChange={(e) => setResolveText(e.target.value)}
                      placeholder="Resolver panel: escribe la frase completa"
                      className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                    />
                    <button
                      type="submit"
                      disabled={!resolveText.trim()}
                      className="px-4 py-2 rounded-xl text-sm font-bold"
                      style={{ background: "var(--color-primary)", color: "#000" }}
                    >
                      Resolver
                    </button>
                  </form>
                )}
              </>
            )}

            <Scoreboard jugadores={jugadores} turnoJugadorId={round.turnoJugadorId} />
          </div>
        ) : null}
```

Notar `round.rondaFinTerminaEn` — este campo nuevo se agrega al tipo `RoundState` y a su cálculo en el Paso 8 y en la página (Task 12), siguiendo el mismo patrón que `turnoTerminaEn`.

- [ ] **Paso 7: Actualizar `RoundState` con el nuevo campo**

Reemplazar:

```typescript
export interface RoundState {
  ronda: number;
  totalRondas: number;
  categoria: string;
  board: RuletaBoardTile[];
  letrasProbadas: string[];
  turnoJugadorId: string | null;
  turnoTerminaEn: number | null;
  puedeConsonante: boolean;
  giroUsado: boolean;
  mensaje: string;
  frase?: string;
  spinToSegment: number | null;
}
```

por:

```typescript
export interface RoundState {
  ronda: number;
  totalRondas: number;
  categoria: string;
  board: RuletaBoardTile[];
  letrasProbadas: string[];
  turnoJugadorId: string | null;
  turnoTerminaEn: number | null;
  rondaFinTerminaEn: number | null;
  puedeConsonante: boolean;
  giroUsado: boolean;
  mensaje: string;
  frase?: string;
  spinToSegment: number | null;
}
```

Luego, en el `useEffect` de suscripciones realtime, dentro del handler de `LETTER_RESULT`/`RESOLVE_RESULT` (busca el bloque que hace `setRound((prev) => prev && ({...}))` para ese evento), agregar el nuevo campo al payload esperado y al objeto que arma: el broadcast que manda `advance.server.ts` (Task 4) y las rutas `resolve`/`guess-consonant`/`guess-vowel` (Task 6) NO agregan `rondaFinTerminaEn` al payload del broadcast de `LETTER_RESULT`/`RESOLVE_RESULT` — ese valor llega después, en el siguiente broadcast (`ROUND_START`, que si trae `turnoTerminaEn` para la ronda que arranca). En vez de intentar propagarlo por el broadcast de resultado, más simple: cuando `p.resuelto` es `true` en ese handler, fijar `rondaFinTerminaEn: Date.now() + RONDA_FIN_SECONDS * 1000` directamente en el cliente (aproximación razonable — el servidor fijó ese mismo deadline apenas antes; una diferencia de red de unos cuantos ms es aceptable, mismo criterio que ya se usa para otros timers en este componente). Import `RONDA_FIN_SECONDS` desde `@/lib/ruleta/wheel`.

Concretamente, dentro del handler de `LETTER_RESULT`/`RESOLVE_RESULT`, cambiar:

```typescript
          setRound((prev) => prev && ({
            ...prev,
            board: p.board ?? prev.board,
            letrasProbadas: p.letrasProbadas ?? prev.letrasProbadas,
            turnoJugadorId: p.turnoJugadorId,
            turnoTerminaEn: p.turnoTerminaEn,
            puedeConsonante: preserveConsonante ? prev.puedeConsonante : false,
            mensaje: p.mensaje,
            frase: p.frase ?? prev.frase,
            spinToSegment: prev.spinToSegment,
          }));
```

por:

```typescript
          setRound((prev) => prev && ({
            ...prev,
            board: p.board ?? prev.board,
            letrasProbadas: p.letrasProbadas ?? prev.letrasProbadas,
            turnoJugadorId: p.turnoJugadorId,
            turnoTerminaEn: p.turnoTerminaEn,
            rondaFinTerminaEn: p.resuelto ? Date.now() + RONDA_FIN_SECONDS * 1000 : null,
            puedeConsonante: preserveConsonante ? prev.puedeConsonante : false,
            mensaje: p.mensaje,
            frase: p.frase ?? prev.frase,
            spinToSegment: prev.spinToSegment,
          }));
```

Y en el handler de `ROUND_START`, agregar `rondaFinTerminaEn: null` al objeto que arma (una ronda que recién arranca no está en `ronda_fin`).

- [ ] **Paso 8: Actualizar imports**

Quitar el import de `HostLobby` y `JoinForm`; agregar `import { EntrarForm } from "./EntrarForm";` y `import { MIN_PLAYERS, RONDA_FIN_SECONDS } from "@/lib/ruleta/wheel";` (junto al `VOWEL_COST` que ya se importa de ese mismo archivo — puede combinarse en una sola línea de import).

- [ ] **Paso 9: Header — quitar el código visible**

El header hoy muestra el código de 4 letras en una píldora (`<Hash size={13} />{sala.codigo}`). Ya no tiene sentido mostrarlo — nadie lo necesita para entrar. Reemplazar esa píldora por el mismo indicador "en vivo" que ya usa `ArenaPublicaRoom.tsx`:

```tsx
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-sm font-bold"
            style={{
              background: "rgba(212,160,23,0.1)",
              border: "1px solid rgba(212,160,23,0.25)",
              color: "var(--color-primary)",
            }}
          >
            <Sparkles size={13} />
            en vivo
          </div>
```

(Cambiar el import de `Hash` a `Sparkles` en la línea de `lucide-react` si `Hash` no se usa en ningún otro lugar del archivo tras este cambio — confirmar con grep antes de quitarlo.)

- [ ] **Paso 10: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores en `RuletaRoom.tsx`, `RoundBanner.tsx`, `EntrarForm.tsx`. Van a seguir los errores esperados en las páginas (`[codigo]/page.tsx`, `nueva/page.tsx`, `page.tsx`) — se resuelven en el Task 12.

- [ ] **Paso 11: Commit**

```bash
git add src/components/ruleta/RuletaRoom.tsx
git commit -m "Remove host branching from RuletaRoom, add lobby/force-start UI"
```

---

## Task 12: Una sola página de entrada — sin código en la URL

**Files:**
- Modify: `src/app/(public)/ruleta/page.tsx` (reescritura completa — pasa de ser el hub de crear/unirse a ser la sala misma)
- Delete: `src/app/(public)/ruleta/[codigo]/` (carpeta completa)
- Delete: `src/app/(public)/ruleta/nueva/` (carpeta completa)

- [ ] **Paso 1: Borrar las dos carpetas retiradas**

```bash
rm -rf "src/app/(public)/ruleta/[codigo]"
rm -rf "src/app/(public)/ruleta/nueva"
```

- [ ] **Paso 2: Reescribir `src/app/(public)/ruleta/page.tsx`**

Mismo patrón que `arena-abierta/page.tsx` de la Fase 1: exige sesión, resuelve-o-crea la sala server-side, arma el estado inicial de ronda si ya está en curso (esta parte, `initialRound`, se toma del `[codigo]/page.tsx` que se acaba de borrar — su lógica de reconstrucción de estado sigue siendo necesaria, solo que ahora vive aquí en vez de en una ruta dinámica).

```tsx
import { redirect } from "next/navigation";
import { createClient, createServiceClient, getProfile } from "@/lib/supabase/server";
import { getOrCreateOpenRoom } from "@/lib/ruleta/room.server";
import { RuletaRoom, type RoundState } from "@/components/ruleta/RuletaRoom";
import { buildBoardShape } from "@/lib/ruleta/game.server";
import type { RuletaJugador, RuletaSala } from "@/types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "La Ruleta en línea — Elim LLDM",
  description: "Juega La Ruleta con otros miembros — sin códigos, entra directo.",
};

export default async function RuletaPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?returnUrl=/ruleta");

  const { sala: salaBase, error } = await getOrCreateOpenRoom();

  if (!salaBase) {
    return (
      <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
        <div className="w-full max-w-[480px] mx-auto px-4 py-16 flex flex-col items-center gap-6 text-center">
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>La Ruleta</h1>
          <p style={{ color: "var(--color-text-muted)" }}>{error ?? "No se pudo cargar la sala."}</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const [{ data: sala }, { data: jugadoresRaw }] = await Promise.all([
    supabase.from("ruleta_salas").select("*").eq("id", salaBase.id).single(),
    supabase.from("ruleta_jugadores").select("*").eq("sala_id", salaBase.id).order("orden"),
  ]);

  if (!sala) {
    return (
      <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
        <div className="w-full max-w-[480px] mx-auto px-4 py-16 flex flex-col items-center gap-6 text-center">
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>La Ruleta</h1>
          <p style={{ color: "var(--color-text-muted)" }}>No se pudo cargar la sala.</p>
        </div>
      </div>
    );
  }

  const initialJugadorId =
    (jugadoresRaw ?? []).find((j) => j.user_id === profile.id)?.id ?? null;

  // Si alguien carga/recarga la página después de que la ronda ya empezó,
  // nunca va a recibir el broadcast ROUND_START (ya se disparó antes de que
  // se conectara) — hay que reconstruir el estado actual desde la DB.
  let initialRound: RoundState | null = null;
  if (sala.status === "playing" || sala.status === "ronda_fin") {
    const service = await createServiceClient();
    const { data: ronda } = await service
      .from("ruleta_rondas")
      .select("categoria, frase, letras_adivinadas")
      .eq("sala_id", sala.id)
      .eq("ronda_numero", sala.ronda_actual)
      .maybeSingle();

    if (ronda) {
      const letrasProbadas = ronda.letras_adivinadas as string[];
      initialRound = {
        ronda: sala.ronda_actual,
        totalRondas: sala.rondas_totales,
        categoria: ronda.categoria,
        board: buildBoardShape(ronda.frase, letrasProbadas),
        letrasProbadas,
        turnoJugadorId: sala.turno_jugador_id,
        turnoTerminaEn: sala.turno_termina_en ? new Date(sala.turno_termina_en).getTime() : null,
        rondaFinTerminaEn: sala.ronda_fin_termina_en ? new Date(sala.ronda_fin_termina_en).getTime() : null,
        puedeConsonante: sala.puede_consonante,
        giroUsado: sala.giro_usado,
        mensaje: sala.status === "ronda_fin" ? "Ronda terminada." : "Partida en curso.",
        frase: sala.status === "ronda_fin" ? ronda.frase : undefined,
        spinToSegment: null,
      };
    }
  }

  return (
    <RuletaRoom
      sala={sala as RuletaSala}
      jugadoresIniciales={(jugadoresRaw ?? []) as RuletaJugador[]}
      initialRound={initialRound}
      initialJugadorId={initialJugadorId}
    />
  );
}
```

Nota: a diferencia de `arena-abierta/page.tsx`, aquí sí hace falta reconstruir `initialRound` (Arena Abierta también lo hace, en su propio `page.tsx` — mismo patrón, solo que con los campos de Ruleta).

- [ ] **Paso 3: `handleLeaveRoom` en `RuletaRoom.tsx` — revisar el destino**

`RuletaRoom.tsx` tiene un botón "Salir" que hace `router.push("/ruleta")` — con la reescritura de este task, `/ruleta` sigue siendo una ruta válida (ahora es la sala misma, no un hub), así que salir y volver a entrar simplemente te vuelve a poner en la cola de matchmaking. No hace falta cambiar nada en `handleLeaveRoom` — se deja tal cual, el comportamiento ya es el correcto por construcción.

- [ ] **Paso 4: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores en ningún archivo de `src/app/(public)/ruleta/` ni `src/components/ruleta/`. Si queda algún error, es momento de resolverlo — este es el último task que toca páginas/componentes de Ruleta.

- [ ] **Paso 5: Commit**

```bash
git add -A "src/app/(public)/ruleta"
git commit -m "Collapse Ruleta into a single no-code entry page"
```

---

## Task 13: Panel admin para Ruleta

**Files:**
- Create: `src/app/admin/ruleta/page.tsx`
- Create: `src/app/api/admin/ruleta/[id]/end/route.ts`
- Modify: `src/components/layout/AdminSidebar.tsx`

Mismo patrón exacto que `/admin/arena-abierta` (Fase 1) — Ruleta hoy no tiene ningún panel de administración, así que esto es net-new, no una migración de algo existente.

- [ ] **Paso 1: Ruta para terminar una sala a mano**

Crear `src/app/api/admin/ruleta/[id]/end/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || (profile as { role: string }).role !== "admin") return null;
  return user;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const service = await createServiceClient();

  const { data: updated, error } = await service
    .from("ruleta_salas")
    .update({ status: "finished" })
    .eq("id", id)
    .neq("status", "finished")
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, ended: (updated?.length ?? 0) > 0 });
}
```

Nota: a diferencia del `end` de Arena Abierta, este no manda un broadcast — Ruleta no tiene un evento `GAME_FINISHED` disparado desde afuera del flujo normal de partida en su diseño actual (`GAME_FINISHED` solo lo dispara `tryAdvanceRound` al llegar a la última ronda). Los jugadores conectados van a ver la sala terminada en su próxima interacción (cualquier fetch a una ruta de juego va a fallar con "sala no encontrada"/`status !== "playing"`) — aceptable para un botón de administración de emergencia, mismo criterio que "no es necesario un broadcast dedicado para el caso de pánico".

- [ ] **Paso 2: Página del panel**

Crear `src/app/admin/ruleta/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { Disc3 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ArenaAbiertaEndButton } from "@/components/admin/ArenaAbiertaEndButton";

export const metadata = { title: "Ruleta en línea — Admin" };

type SalaStatus = "lobby" | "playing" | "ronda_fin" | "finished";

const STATUS_LABEL: Record<SalaStatus, string> = {
  lobby: "Esperando jugadores",
  playing: "Jugando",
  ronda_fin: "Entre rondas",
  finished: "Terminada",
};

const STATUS_COLOR: Record<SalaStatus, { bg: string; text: string }> = {
  lobby: { bg: "rgba(212,160,23,0.12)", text: "var(--color-primary)" },
  playing: { bg: "rgba(74,222,128,0.1)", text: "var(--color-success)" },
  ronda_fin: { bg: "rgba(96,165,250,0.12)", text: "var(--color-info)" },
  finished: { bg: "var(--color-surface-elevated)", text: "var(--color-text-muted)" },
};

interface SalaRow {
  id: string;
  status: SalaStatus;
  ronda_actual: number;
  rondas_totales: number;
  created_at: string;
  jugadores: { count: number }[];
}

export default async function AdminRuletaPage() {
  const supabase = await createClient();

  const { data: salas } = await supabase
    .from("ruleta_salas")
    .select("id, status, ronda_actual, rondas_totales, created_at, jugadores:ruleta_jugadores(count)")
    .order("created_at", { ascending: false })
    .limit(30);

  const rows = (salas ?? []) as unknown as SalaRow[];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>
            La Ruleta en línea
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            Salas públicas de Ruleta — cualquier sala en curso se puede terminar a mano si se
            queda atascada.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-2xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Disc3 size={36} className="mb-3" style={{ color: "var(--color-text-muted)" }} />
          <p style={{ color: "var(--color-text-muted)" }}>Todavía no se ha creado ninguna sala.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((sala) => {
            const jugadores = sala.jugadores?.[0]?.count ?? 0;
            const colors = STATUS_COLOR[sala.status];

            return (
              <div
                key={sala.id}
                className="flex items-center justify-between px-5 py-4 rounded-2xl"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Disc3 size={15} style={{ color: "var(--color-primary)" }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                      {jugadores} {jugadores === 1 ? "jugador" : "jugadores"}
                      {sala.status !== "lobby" &&
                        sala.status !== "finished" &&
                        ` · ronda ${sala.ronda_actual} de ${sala.rondas_totales}`}
                    </p>
                    <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                      {sala.id.slice(0, 8)} · {formatDate(sala.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: colors.bg, color: colors.text }}
                  >
                    {STATUS_LABEL[sala.status]}
                  </span>
                  {sala.status !== "finished" && (
                    <ArenaAbiertaEndButton salaId={sala.id} endpoint={`/api/admin/ruleta/${sala.id}/end`} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Paso 3: Generalizar `ArenaAbiertaEndButton` para aceptar un endpoint distinto**

Este componente (`src/components/admin/ArenaAbiertaEndButton.tsx`, de la Fase 1) hoy tiene la URL `/api/admin/arena-abierta/${salaId}/end` fija adentro. Leer el archivo actual primero. Agregar un prop opcional `endpoint` que, si se pasa, reemplaza esa URL fija — sin romper el uso existente en `/admin/arena-abierta/page.tsx` (que sigue sin pasar `endpoint`, y por lo tanto sigue usando la URL de Arena Abierta por default):

Cambiar la firma de:

```typescript
export function ArenaAbiertaEndButton({ salaId }: { salaId: string }) {
```

a:

```typescript
export function ArenaAbiertaEndButton({ salaId, endpoint }: { salaId: string; endpoint?: string }) {
```

Y donde arma la URL del fetch (`/api/admin/arena-abierta/${salaId}/end`), cambiar a `endpoint ?? \`/api/admin/arena-abierta/${salaId}/end\``.

- [ ] **Paso 4: Agregar el link al sidebar admin**

En `src/components/layout/AdminSidebar.tsx`, agregar una entrada junto a la de "Arena Abierta" (agregada en la Fase 1):

```typescript
  { href: "/admin/arena-abierta", label: "Arena Abierta", icon: Zap },
  { href: "/admin/ruleta", label: "La Ruleta", icon: Disc3 },
```

Agregar `Disc3` al import de `lucide-react` en ese archivo si no está ya.

- [ ] **Paso 5: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores.

- [ ] **Paso 6: Commit**

```bash
git add src/app/admin/ruleta src/app/api/admin/ruleta src/components/admin/ArenaAbiertaEndButton.tsx src/components/layout/AdminSidebar.tsx
git commit -m "Add admin panel for Ruleta rooms"
```

---

## Task 14: Puerta en vivo de Ruleta en `/juegos`

**Files:**
- Create: `src/lib/ruleta/estado-puerta.server.ts`
- Create: `src/components/juegos/PuertaRuleta.tsx`
- Modify: `src/app/(public)/juegos/page.tsx`

- [ ] **Paso 1: Query del estado de la puerta**

Crear `src/lib/ruleta/estado-puerta.server.ts` — mismo patrón que `src/lib/arena-publica/estado-puerta.server.ts` de la Fase 1:

```typescript
// src/lib/ruleta/estado-puerta.server.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface EstadoPuerta {
  disponible: boolean;
  jugandoAhora: number;
}

/**
 * Estado de la puerta de Ruleta para el vestíbulo de /juegos. No usa
 * getOrCreateOpenRoom() a propósito — de solo lectura para pintar una
 * tarjeta, no debe crear una sala nueva solo porque alguien pasó por
 * /juegos sin intención de entrar.
 *
 * Tradeoff conocido (igual que en Arena Abierta): al no llamar a
 * healStaleRuletaRooms() aquí, una sala atascada en playing/ronda_fin tras
 * su deadline seguirá mostrando "Ocupado" hasta que alguien visite /ruleta
 * y dispare la sanación ahí.
 */
export async function getEstadoPuertaRuleta(): Promise<EstadoPuerta> {
  const supabase = await createClient();

  const { data: salas } = await supabase
    .from("ruleta_salas")
    .select("status")
    .in("status", ["lobby", "playing", "ronda_fin"]);

  const hayUnaAbierta = (salas ?? []).some((s) => s.status === "lobby");
  const jugandoAhora = (salas ?? []).filter((s) => s.status === "playing" || s.status === "ronda_fin").length;

  return { disponible: hayUnaAbierta || jugandoAhora === 0, jugandoAhora };
}
```

- [ ] **Paso 2: Componente de la puerta**

Crear `src/components/juegos/PuertaRuleta.tsx` — mismo patrón que `PuertaArenaAbierta.tsx`, adaptado:

```tsx
"use client";

import Link from "next/link";
import { Users, Share2 } from "lucide-react";

interface PuertaRuletaProps {
  disponible: boolean;
  jugandoAhora: number;
}

export function PuertaRuleta({ disponible, jugandoAhora }: PuertaRuletaProps) {
  const ocupado = !disponible;

  async function handleInvitar(e: React.MouseEvent) {
    e.preventDefault();
    const url = `${window.location.origin}/ruleta`;
    const shareData = { title: "La Ruleta — Elim LLDM", text: "Únete a jugar La Ruleta conmigo", url };

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
            style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.3)" }}
          >
            <Users size={22} style={{ color: "#3B82F6" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
              La Ruleta en línea
            </h2>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              De 2 a 6 jugadores, por turnos
            </p>
          </div>
        </div>

        <span
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide"
          style={{
            color: ocupado ? "var(--color-live)" : "var(--color-success)",
            background: ocupado ? "rgba(255,68,68,0.1)" : "rgba(74,222,128,0.1)",
            border: `1px solid ${ocupado ? "rgba(255,68,68,0.3)" : "rgba(74,222,128,0.32)"}`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
          {ocupado ? "Ocupado" : "Disponible"}
        </span>
      </div>

      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        {jugandoAhora > 0
          ? `${jugandoAhora} ${jugandoAhora === 1 ? "partida jugándose" : "partidas jugándose"} ahora — al entrar se abre una sala para ti`
          : "Nadie jugando — sé el primero"}
      </p>

      <div className="flex items-center gap-2">
        <Link
          href="/ruleta"
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

- [ ] **Paso 3: Reemplazar la tarjeta estática de Ruleta en `/juegos`**

Leer el archivo actual (`src/app/(public)/juegos/page.tsx`, tal como quedó tras la Fase 1). Reemplazar el bloque `<Link href="/ruleta" ...>` (la tarjeta plana de "Ruleta en línea") por:

```tsx
        <PuertaRuleta disponible={estadoRuleta.disponible} jugandoAhora={estadoRuleta.jugandoAhora} />
```

Y agregar, junto al `import { getEstadoPuertaArenaAbierta } ...` existente:

```typescript
import { getEstadoPuertaRuleta } from "@/lib/ruleta/estado-puerta.server";
import { PuertaRuleta } from "@/components/juegos/PuertaRuleta";
```

Y en el cuerpo de la función, junto a `const estadoArenaAbierta = await getEstadoPuertaArenaAbierta();`:

```typescript
  const estadoRuleta = await getEstadoPuertaRuleta();
```

Quitar `Users` del import de `lucide-react` en este archivo — era el ícono de la tarjeta estática que se acaba de quitar y no se usa en ningún otro lugar del archivo. `ChevronRight` se queda: lo sigue usando la tarjeta de "Ruleta de retos" que no cambia en este task.

- [ ] **Paso 4: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: sin errores.

- [ ] **Paso 5: Commit**

```bash
git add "src/app/(public)/juegos/page.tsx" src/lib/ruleta/estado-puerta.server.ts src/components/juegos/PuertaRuleta.tsx
git commit -m "Add live door for Ruleta on /juegos hub"
```

---

## Task 15: Verificación en vivo

- [ ] Aplicar la migración del Task 1 en producción (con confirmación del usuario antes).
- [ ] `./node_modules/.bin/tsc --noEmit` limpio en todo el repo.
- [ ] Probar en el navegador con dos cuentas reales:
  1. `/juegos` — la puerta de Ruleta debe verse igual que la de Arena Abierta (verde/roja, con detalle de actividad e Invitar).
  2. Entrar a `/ruleta` sin sesión → debe mandar a `/login?returnUrl=/ruleta`.
  3. Con sesión, entrar — debe verse el selector "¿Cuántos van a jugar?" (no un campo de nombre ni una pantalla de "crear sala").
  4. Elegir 2, entrar — con una segunda cuenta, unirse — la partida debe arrancar sola en cuanto se une el segundo jugador (sin que nadie dé clic en "Iniciar").
  5. Jugar una ronda completa (girar, adivinar, resolver) y confirmar que al terminar la ronda aparece el cartel con cuenta regresiva (`RoundBanner` + `TurnTimer`) y que la siguiente ronda arranca sola sin que nadie dé clic en "Siguiente ronda".
  6. Probar "Forzar siguiente turno" con cualquiera de las dos cuentas (ya no debe estar limitado a un "anfitrión").
  7. Verificar `/admin/ruleta` — debe listar las salas con su estado, y "Terminar partida" debe funcionar.
  8. Confirmar que `/ruleta/nueva` y cualquier URL vieja con código (`/ruleta/ABCD`) ya no existen (404 esperado — a diferencia de Arena Abierta, aquí si se decide que vale la pena, se podría agregar un redirect desde una URL con código vieja hacia `/ruleta`, pero no es parte de este plan).
- [ ] Push a `master` una vez confirmado.

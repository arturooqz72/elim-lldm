# La Ruleta en línea — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn La Ruleta (currently a single-device, `localStorage`-only static HTML game at `public/juegos/ruleta-elimlldm.html`) into a real multiplayer game where 2–6 players join a room from their own devices with a share code, and play the same wheel/board/letters game synced in real time.

**Architecture:** Reuse the exact pattern already proven by Elim Arena (`src/components/arena/*`, `src/app/api/arena/*`, `supabase/migrations/0010_elim_arena.sql`): a host (any logged-in user) creates a room and gets a 4-letter code; players join anonymously with just a name; all game-state mutations go through Next.js API routes using the Supabase **service role** client (bypassing RLS, server-validated); a Supabase Realtime **broadcast** channel (`ruleta:{codigo}`) pushes instant game events (spin result, letter guesses, round/match end) to every connected client, while `postgres_changes` on `ruleta_jugadores` keeps the player list/scoreboard live. One deliberate improvement over Arena: the secret data (the phrase to guess) lives in a table with **no public grants at all** — only the service-role API routes can read it — so no client can ever see the answer by inspecting network traffic before the round ends. The wheel's spin result and the puzzle selection are always decided server-side so no client can spoof its own random result.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, `@supabase/supabase-js` (service role) + `@supabase/ssr` (session), Supabase Realtime (`broadcast` + `postgres_changes`), Tailwind v4 + the app's existing CSS-variable design system, `canvas-confetti` (already a dependency), Web Audio API for the join chime (no audio asset files needed).

---

## Scope (locked in during brainstorming — don't relitigate)

- **Access:** room code, no account needed to join — matches Elim Arena. The **host** (room creator) must be logged in (any authenticated profile — not restricted to `admin`/`anfitrion` like Arena, since this is a casual game any member should be able to host).
- **Players:** 2–6 per room, waiting lobby while people join.
- **Join sound:** a short chime plays for everyone already in the lobby when a new player joins.
- **Start:** the host decides when to start (button), not automatic.
- **Turn control:** the active player spins and guesses from their own device; everyone else watches in real time, read-only, until it's their turn.
- **Visual style:** matches the app's existing dark/gold design system (same convention as `src/components/arena/*`) rather than literally porting the static HTML's bespoke CSS (nebula background, light bulbs, shimmer animations). The wheel keeps the **fixed label-centering math and gold divider lines** from the recent static-HTML fix (labels don't overflow the rim), ported into a React component. The elaborate casino flourishes can be a follow-up visual pass later — this plan ships a correct, synced, on-brand game first.
- **Puzzle content:** reuses a real subset of the existing Bible-phrase puzzle set (already in `DEFAULT_DATA.puzzles` in the static HTML) and the same 16-segment wheel (same values/labels/colors), so the game feels identical to the one people already know. No per-room puzzle authoring in this version (matches the static game's fixed puzzle bank).

## Game rules being ported (read from `public/juegos/ruleta-elimlldm.html`, functions `spinWheel`/`onWheelResult`/`guessConsonant`/`guessVowel`/`resolveBtn` handler/`nextTurn`/`checkIfSolved`, lines ~1334–1660)

- A turn window opens for the active player with a 15s timer (`TURN_SECONDS`).
- They may **spin once** per turn window. Landing on `bancarrota` zeroes their score and passes the turn; landing on `pierde_turno` just passes the turn; landing on points sets `valor_giro_actual` and lets them guess **one consonant**.
- A **correct** consonant reveals all its occurrences, awards `count * valor_giro_actual` points, and opens a new 15s window where they may buy/guess a vowel (but not another consonant — consonant-guessing is one-shot per spin).
- A **wrong** consonant or vowel guess ends their turn immediately (passes to the next player in join order).
- A **vowel** guess costs `VOWEL_COST` (700) points, deducted whether right or wrong, and is allowed any time during an active turn window regardless of whether they've spun yet (this is a real quirk of the original code — preserved faithfully).
- "Resolver panel" (guess the whole phrase) is always available. Correct = round won, +500 bonus, phrase revealed to everyone. Wrong = turn passes.
- When the phrase is fully revealed (by letters or by resolving), the round ends; the round's winner keeps holding the turn into the next round (matches the original: `currentPlayerIndex` is never reset between puzzles).
- Running out of time passes the turn, same as a wrong guess.
- After the configured number of rounds, the match ends and shows a podium.

**Note on testing:** this repo has no automated test suite (no Jest/Vitest configured, no `*.test.*` files anywhere, no `lint`/`test` script in `package.json`) — established convention across prior plans in this directory. Each code task's "test" step is `pnpm exec tsc --noEmit` (or `pnpm build` for the final pass), plus a manual browser verification step with exact actions. The two-browser-tab end-to-end check is Task 21.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/0016_ruleta_online.sql` (create) | `ruleta_salas`, `ruleta_jugadores` (public-readable, service-role-written), `ruleta_rondas` (service-role-only, holds the secret phrase), RLS, grants, realtime publication |
| `src/lib/ruleta/wheel.ts` (create) | Shared, public-safe wheel config: 16 segments, colors, game constants (`VOWEL_COST`, `TURN_SECONDS`, `RESOLVE_BONUS`, `MIN_PLAYERS`, `MAX_PLAYERS`), `pickWheelSegmentIndex()` |
| `src/lib/ruleta/game.server.ts` (create) | Server-only pure helpers: board-shape building, letter counting, solved-check, next-turn-in-order, normalize/deaccent |
| `src/lib/ruleta/puzzles.server.ts` (create) | Server-only puzzle catalog (real Bible phrases) + `pickPuzzle()` (avoid-repeat + prefer-new-category, ported from `pickPuzzleIndex()`) |
| `src/lib/ruleta/sound.client.ts` (create) | `playJoinChime()` — Web Audio two-note chime, no asset file |
| `src/types/index.ts` (modify) | Add `RuletaSala`, `RuletaJugador`, `RuletaStatus`, `RuletaBoardTile` types |
| `src/app/api/ruleta/create/route.ts` (create) | Host creates a room (auth required) |
| `src/app/api/ruleta/[codigo]/join/route.ts` (create) | Player joins with just a name |
| `src/app/api/ruleta/[codigo]/start/route.ts` (create) | Host starts the match (picks first puzzle, sets first turn) |
| `src/app/api/ruleta/[codigo]/spin/route.ts` (create) | Active player spins the wheel |
| `src/app/api/ruleta/[codigo]/guess-consonant/route.ts` (create) | Active player guesses a consonant |
| `src/app/api/ruleta/[codigo]/guess-vowel/route.ts` (create) | Active player buys/guesses a vowel |
| `src/app/api/ruleta/[codigo]/resolve/route.ts` (create) | Active player attempts the full phrase |
| `src/app/api/ruleta/[codigo]/timeout/route.ts` (create) | Any client reports the turn clock ran out |
| `src/app/api/ruleta/[codigo]/next-round/route.ts` (create) | Host advances to the next round or finishes the match |
| `src/app/(public)/ruleta/page.tsx` (create) | Landing: join-by-code + "crear sala" link |
| `src/app/(public)/ruleta/nueva/page.tsx` (create) | Host creates a room (auth-gated) |
| `src/app/(public)/ruleta/[codigo]/page.tsx` (create) | Server loader for a room, passes initial state to `RuletaRoom` |
| `src/components/ruleta/RuletaJoinCodeForm.tsx` (create) | 4-letter code entry → `/ruleta/{code}` |
| `src/components/ruleta/RuletaCreateForm.tsx` (create) | Rounds picker (1–15) → `POST /api/ruleta/create` |
| `src/components/ruleta/JoinForm.tsx` (create) | Name entry → `POST /api/ruleta/[codigo]/join` |
| `src/components/ruleta/HostLobby.tsx` (create) | Code display, live player list, join chime, start button |
| `src/components/ruleta/Wheel.tsx` (create) | The wheel: fixed label math + dividers, spin animation driven by a server-given segment index |
| `src/components/ruleta/Board.tsx` (create) | Phrase tiles |
| `src/components/ruleta/Letters.tsx` (create) | A–Z buttons (consonant/vowel gating) |
| `src/components/ruleta/Scoreboard.tsx` (create) | Player score cards, active-turn highlight |
| `src/components/ruleta/TurnTimer.tsx` (create) | Countdown ring from `turnoTerminaEn`, calls the timeout route on expiry |
| `src/components/ruleta/RoundBanner.tsx` (create) | Round-end overlay: reveals phrase, host's "siguiente ronda" button |
| `src/components/ruleta/MatchEndScreen.tsx` (create) | Podium + confetti (reuses `canvas-confetti`, same pattern as `WinnerScreen.tsx`) |
| `src/components/ruleta/RuletaRoom.tsx` (create) | Orchestrator: realtime subscriptions, phase state machine, wires every component above |
| `src/app/(public)/juegos/page.tsx` (modify) | Add a "Ruleta en línea" card linking to `/ruleta`, alongside the existing static-HTML card |

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/0016_ruleta_online.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Elim LLDM — La Ruleta en línea (multijugador con código de sala)
-- Ejecutar manualmente en Supabase SQL Editor
--
-- Namespace nuevo y aislado /ruleta — no modifica games/trivia_* ni
-- elim_arena_* existentes. Jugadores entran SOLO con su nombre (sin
-- cuenta); el anfitrión (created_by) debe tener sesión. Todas las
-- escrituras (join, spin, guess, next-round...) se hacen desde API
-- routes con el service role client — por eso ruleta_salas y
-- ruleta_jugadores no tienen policies de UPDATE para anon/authenticated,
-- y ruleta_rondas no tiene NINGUNA policy pública: guarda la frase
-- secreta y solo el service role puede leerla, para que ningún cliente
-- pueda ver la respuesta inspeccionando la red antes de que termine la
-- ronda.
-- ============================================================

-- RULETA SALAS
CREATE TABLE ruleta_salas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby', 'playing', 'ronda_fin', 'finished')),
  rondas_totales INT NOT NULL DEFAULT 5,
  ronda_actual INT NOT NULL DEFAULT 0,
  turno_jugador_id UUID,
  turno_termina_en TIMESTAMPTZ,
  giro_usado BOOLEAN NOT NULL DEFAULT FALSE,
  puede_consonante BOOLEAN NOT NULL DEFAULT FALSE,
  valor_giro_actual INT,
  frases_usadas JSONB NOT NULL DEFAULT '[]'::jsonb,
  ultima_categoria TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RULETA JUGADORES
CREATE TABLE ruleta_jugadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id UUID NOT NULL REFERENCES ruleta_salas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  orden INT NOT NULL,
  puntos INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ahora que ruleta_jugadores existe, agrega la FK diferida desde ruleta_salas
ALTER TABLE ruleta_salas
  ADD CONSTRAINT ruleta_salas_turno_jugador_fk
  FOREIGN KEY (turno_jugador_id) REFERENCES ruleta_jugadores(id);

-- RULETA RONDAS — tabla privada: guarda la frase secreta de cada ronda.
-- Sin policies públicas ni grants para anon/authenticated a propósito.
CREATE TABLE ruleta_rondas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id UUID NOT NULL REFERENCES ruleta_salas(id) ON DELETE CASCADE,
  ronda_numero INT NOT NULL,
  categoria TEXT NOT NULL,
  frase TEXT NOT NULL,
  letras_adivinadas JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sala_id, ronda_numero)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_ruleta_salas_codigo ON ruleta_salas(codigo);
CREATE INDEX idx_ruleta_salas_status ON ruleta_salas(status);
CREATE INDEX idx_ruleta_jugadores_sala ON ruleta_jugadores(sala_id);
CREATE INDEX idx_ruleta_rondas_sala ON ruleta_rondas(sala_id, ronda_numero);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE ruleta_salas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ruleta_jugadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ruleta_rondas ENABLE ROW LEVEL SECURITY;

-- Lectura pública de salas/jugadores (jugadores sin cuenta deben poder
-- ver el estado de su sala en tiempo real)
CREATE POLICY "ruleta_salas_select_all" ON ruleta_salas FOR SELECT USING (TRUE);
CREATE POLICY "ruleta_jugadores_select_all" ON ruleta_jugadores FOR SELECT USING (TRUE);

-- Crear sala: cualquier usuario autenticado (no restringido a admin/anfitrion,
-- a diferencia de elim_arena — este es un juego casual para cualquier
-- miembro de la plataforma)
CREATE POLICY "ruleta_salas_insert_auth" ON ruleta_salas
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- ruleta_rondas: RLS habilitado, CERO policies para anon/authenticated
-- (default deny). Solo el service role (que ignora RLS) puede leer/escribir.

-- ============================================================
-- GRANTS
-- ============================================================
GRANT SELECT ON ruleta_salas TO anon, authenticated;
GRANT SELECT ON ruleta_jugadores TO anon, authenticated;
GRANT INSERT ON ruleta_salas TO authenticated;
-- Nota: sin GRANT de UPDATE en ruleta_salas/ruleta_jugadores para
-- anon/authenticated — toda mutación de estado de juego pasa por rutas
-- API con el service role client (validado ahí, no aquí).
-- Sin ningún GRANT en ruleta_rondas para anon/authenticated.

-- ============================================================
-- REALTIME (ruleta_rondas NO se agrega — nunca debe llegar a los clientes)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE ruleta_salas;
ALTER PUBLICATION supabase_realtime ADD TABLE ruleta_jugadores;
```

- [ ] **Step 2: Run it in Supabase**

Open the Supabase SQL Editor for this project and run the file above (per this repo's convention — migrations here are applied manually, not via `supabase db push`; see `[[feedback_supabase_studio_hang]]` if the editor UI hangs — fall back to the REST API with the service role key from `.env.local`).

- [ ] **Step 3: Verify**

In the SQL Editor:
```sql
select table_name from information_schema.tables
where table_name like 'ruleta_%';
```
Expected: `ruleta_salas`, `ruleta_jugadores`, `ruleta_rondas`.

```sql
select grantee, table_name, privilege_type from information_schema.role_table_grants
where table_name = 'ruleta_rondas';
```
Expected: only rows for the table owner/`postgres`/`service_role` — no `anon` or `authenticated` rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0016_ruleta_online.sql
git commit -m "Add ruleta_salas/ruleta_jugadores/ruleta_rondas schema for online Ruleta"
```

---

### Task 2: Shared wheel config + types

**Files:**
- Create: `src/lib/ruleta/wheel.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Write `wheel.ts`**

```ts
// Public-safe game config — shared by server (API routes) and client
// (Wheel component). Mirrors DATA.wheel from the original single-device
// public/juegos/ruleta-elimlldm.html so the online version feels identical.

export type WheelSegmentType = "puntos" | "bancarrota" | "pierde_turno";

export interface WheelSegment {
  type: WheelSegmentType;
  value: number;
  label: string;
}

export const WHEEL_SEGMENTS: WheelSegment[] = [
  { type: "puntos", value: 300, label: "300" },
  { type: "puntos", value: 500, label: "500" },
  { type: "puntos", value: 600, label: "600" },
  { type: "puntos", value: 800, label: "800" },
  { type: "bancarrota", value: 0, label: "BANCARROTA" },
  { type: "puntos", value: 400, label: "400" },
  { type: "puntos", value: 700, label: "700" },
  { type: "puntos", value: 250, label: "250" },
  { type: "pierde_turno", value: 0, label: "PIERDE TURNO" },
  { type: "puntos", value: 900, label: "900" },
  { type: "puntos", value: 350, label: "350" },
  { type: "puntos", value: 650, label: "650" },
  { type: "puntos", value: 500, label: "500" },
  { type: "puntos", value: 450, label: "450" },
  { type: "puntos", value: 800, label: "800" },
  { type: "puntos", value: 300, label: "300" },
];

export const SEG_COLORS = [
  "#ff3d3d", "#ffd23f", "#3ddc84", "#3ec6ff", "#161616", "#ff8c1a",
  "#c651ff", "#1de9d0", "#ff3d9a", "#ff3d3d", "#ffd23f", "#3ddc84",
  "#3ec6ff", "#ff8c1a", "#c651ff", "#1de9d0",
];

export const VOWEL_COST = 700;
export const TURN_SECONDS = 15;
export const RESOLVE_BONUS = 500;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const ROUNDS_MIN = 1;
export const ROUNDS_MAX = 15;
export const ROUNDS_DEFAULT = 5;

export function pickWheelSegmentIndex(): number {
  return Math.floor(Math.random() * WHEEL_SEGMENTS.length);
}
```

- [ ] **Step 2: Add types to `src/types/index.ts`**

Append at the end of the file (same section style as the `Elim Arena` block already there):

```ts
// ── La Ruleta en línea (multijugador con código de sala) ───────────────────────

export type RuletaStatus = "lobby" | "playing" | "ronda_fin" | "finished";

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

export interface RuletaJugador {
  id: string;
  sala_id: string;
  nombre: string;
  orden: number;
  puntos: number;
  created_at: string;
}

export interface RuletaBoardTile {
  type: "letter" | "space";
  char: string | null;
}
```

- [ ] **Step 3: Verify**

```bash
pnpm exec tsc --noEmit
```
Expected: no new errors referencing `src/lib/ruleta/wheel.ts` or `src/types/index.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ruleta/wheel.ts src/types/index.ts
git commit -m "Add shared wheel config and Ruleta types"
```

---

### Task 3: Server-only game helpers + puzzle catalog

**Files:**
- Create: `src/lib/ruleta/game.server.ts`
- Create: `src/lib/ruleta/puzzles.server.ts`

These two files are only ever imported from `src/app/api/ruleta/**` route files — never from a `"use client"` component — so the puzzle phrases never ship in the client JS bundle.

- [ ] **Step 1: Write `game.server.ts`**

```ts
import type { RuletaBoardTile } from "@/types";

export const ALPHABET = [
  "A","B","C","D","E","F","G","H","I","J","K","L","M","N","Ñ","O",
  "P","Q","R","S","T","U","V","W","X","Y","Z",
];
export const VOWELS = ["A", "E", "I", "O", "U"];

const ACCENT_MAP: Record<string, string> = {
  "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U", "Ü": "U",
};

export function deaccent(ch: string): string {
  return ACCENT_MAP[ch] || ch;
}

export function normalize(str: string): string {
  return str.toUpperCase();
}

const LETTER_RE = /[A-ZÑÁÉÍÓÚÜ]/;

export function buildBoardShape(frase: string, letrasProbadas: string[]): RuletaBoardTile[] {
  const tiles: RuletaBoardTile[] = [];
  for (const ch of frase) {
    if (!LETTER_RE.test(ch)) {
      tiles.push({ type: "space", char: ch });
      continue;
    }
    tiles.push({
      type: "letter",
      char: letrasProbadas.includes(deaccent(ch)) ? ch : null,
    });
  }
  return tiles;
}

export function countLetterInPhrase(frase: string, letra: string): number {
  let count = 0;
  for (const ch of frase) if (deaccent(ch) === letra) count++;
  return count;
}

export function isPhraseSolved(frase: string, letrasProbadas: string[]): boolean {
  for (const ch of frase) {
    if (LETTER_RE.test(ch) && !letrasProbadas.includes(deaccent(ch))) return false;
  }
  return true;
}

/** Every distinct letter actually in the phrase — used to reveal it fully on "resolver panel". */
export function allLettersInPhrase(frase: string): string[] {
  const set = new Set<string>();
  for (const ch of frase) if (LETTER_RE.test(ch)) set.add(deaccent(ch));
  return [...set];
}

export interface JugadorOrden {
  id: string;
  orden: number;
}

export function nextJugadorId(jugadores: JugadorOrden[], currentId: string): string {
  const sorted = [...jugadores].sort((a, b) => a.orden - b.orden);
  const idx = sorted.findIndex((j) => j.id === currentId);
  const next = sorted[(idx + 1) % sorted.length];
  return next.id;
}
```

- [ ] **Step 2: Write `puzzles.server.ts`**

```ts
export interface Puzzle {
  category: string;
  phrase: string;
}

// Real subset of the puzzle bank already used by the single-device game
// (public/juegos/ruleta-elimlldm.html, DEFAULT_DATA.puzzles).
export const PUZZLES: Puzzle[] = [
  { category: "Saludo Cristiano", phrase: "LA PAZ DE CRISTO SEA CON USTEDES" },
  { category: "Saludo Cristiano", phrase: "LA GRACIA DE DIOS SEA CON TODOS" },
  { category: "Saludo Cristiano", phrase: "BENDICIONES PARA TODA LA FAMILIA" },
  { category: "Saludo Cristiano", phrase: "QUE DIOS TE BENDIGA HOY Y SIEMPRE" },
  { category: "Versiculo Biblico", phrase: "DIOS ES AMOR" },
  { category: "Versiculo Biblico", phrase: "EL SEÑOR ES MI PASTOR NADA ME FALTARA" },
  { category: "Versiculo Biblico", phrase: "DE TAL MANERA AMO DIOS AL MUNDO" },
  { category: "Versiculo Biblico", phrase: "BUSCAD PRIMERAMENTE EL REINO DE DIOS" },
  { category: "Mandamiento", phrase: "AMARAS A TU PROJIMO COMO A TI MISMO" },
  { category: "Mandamiento", phrase: "HONRA A TU PADRE Y A TU MADRE" },
  { category: "Mandamiento", phrase: "NO TOMARAS EL NOMBRE DE DIOS EN VANO" },
  { category: "Mandamiento", phrase: "NO HURTARAS" },
  { category: "Fruto del Espiritu", phrase: "AMOR GOZO PAZ PACIENCIA" },
  { category: "Fruto del Espiritu", phrase: "GOZO Y PAZ EN EL ESPIRITU" },
  { category: "Fruto del Espiritu", phrase: "TEMPLANZA Y DOMINIO PROPIO" },
  { category: "Personaje Biblico", phrase: "MOISES LIBERTADOR DE ISRAEL" },
  { category: "Personaje Biblico", phrase: "DAVID EL REY PASTOR" },
  { category: "Personaje Biblico", phrase: "NOE Y EL DILUVIO" },
  { category: "Personaje Biblico", phrase: "DANIEL EN EL FOSO DE LOS LEONES" },
  { category: "Libro de la Biblia", phrase: "EL LIBRO DE LOS SALMOS" },
  { category: "Libro de la Biblia", phrase: "EL APOCALIPSIS DE JUAN" },
  { category: "Libro de la Biblia", phrase: "EL GENESIS PRINCIPIO DE TODO" },
  { category: "Enseñanza de Jesus", phrase: "BIENAVENTURADOS LOS MANSOS" },
  { category: "Enseñanza de Jesus", phrase: "YO SOY EL CAMINO LA VERDAD Y LA VIDA" },
  { category: "Enseñanza de Jesus", phrase: "VELAD Y ORAD" },
  { category: "Historia Biblica", phrase: "EL ARCA DE NOE" },
  { category: "Historia Biblica", phrase: "DAVID Y GOLIAT" },
  { category: "Historia Biblica", phrase: "LA CREACION DEL MUNDO" },
  { category: "Historia Biblica", phrase: "LA CAIDA DE JERICO" },
  { category: "Frase de Fe", phrase: "TODO LO PUEDO EN CRISTO QUE ME FORTALECE" },
  { category: "Frase de Fe", phrase: "CON DIOS TODO ES POSIBLE" },
  { category: "Nombre de Dios", phrase: "EL BUEN PASTOR" },
  { category: "Nombre de Dios", phrase: "EL REY DE REYES" },
];

export function phraseKey(p: Puzzle): string {
  return p.category + "||" + p.phrase;
}

/**
 * Picks a phrase that hasn't been used since the pool last fully cycled,
 * preferring a different category than the last one — ported from
 * pickPuzzleIndex() in the static HTML. Returns the chosen puzzle and the
 * updated used-keys list to persist on the sala row.
 */
export function pickPuzzle(
  usedKeys: string[],
  lastCategory: string | null
): { puzzle: Puzzle; usedKeys: string[] } {
  let available = PUZZLES.filter((p) => !usedKeys.includes(phraseKey(p)));
  let baseUsed = usedKeys;
  if (available.length === 0) {
    available = PUZZLES;
    baseUsed = [];
  }

  const preferred = available.filter((p) => p.category !== lastCategory);
  const pool = preferred.length > 0 ? preferred : available;
  const choice = pool[Math.floor(Math.random() * pool.length)];

  return { puzzle: choice, usedKeys: [...baseUsed, phraseKey(choice)] };
}
```

- [ ] **Step 3: Verify**

```bash
pnpm exec tsc --noEmit
```
Expected: no errors in either new file.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ruleta/game.server.ts src/lib/ruleta/puzzles.server.ts
git commit -m "Add server-only Ruleta game helpers and puzzle catalog"
```

---

### Task 4: API route — create room

**Files:**
- Create: `src/app/api/ruleta/create/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ROUNDS_MIN, ROUNDS_MAX, ROUNDS_DEFAULT } from "@/lib/ruleta/wheel";

const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function generateCode() {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { rondas?: number };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const rondas = Math.max(
    ROUNDS_MIN,
    Math.min(ROUNDS_MAX, Math.round(body.rondas ?? ROUNDS_DEFAULT))
  );

  const service = await createServiceClient();

  let codigo = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateCode();
    const { data: existing } = await service
      .from("ruleta_salas")
      .select("id")
      .eq("codigo", candidate)
      .maybeSingle();
    if (!existing) {
      codigo = candidate;
      break;
    }
  }

  if (!codigo) {
    return NextResponse.json({ error: "No se pudo generar un código único" }, { status: 500 });
  }

  const { data: sala, error } = await service
    .from("ruleta_salas")
    .insert({ codigo, rondas_totales: rondas, created_by: user.id })
    .select("codigo")
    .single();

  if (error || !sala) {
    return NextResponse.json({ error: error?.message ?? "Error al crear la sala" }, { status: 500 });
  }

  return NextResponse.json({ codigo: sala.codigo });
}
```

- [ ] **Step 2: Verify**

```bash
pnpm exec tsc --noEmit
```
Expected: no errors.

Manual check (after Task 15's server loader page exists you can hit this end to end; for now, confirm it compiles and, once the dev server is up, that an unauthenticated `curl -X POST http://localhost:3000/api/ruleta/create` returns `401`):

```bash
pnpm dev &
sleep 3
curl -s -X POST http://localhost:3000/api/ruleta/create
```
Expected: `{"error":"Unauthorized"}`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ruleta/create/route.ts
git commit -m "Add Ruleta create-room API route"
```

---

### Task 5: API route — join room

**Files:**
- Create: `src/app/api/ruleta/[codigo]/join/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { MAX_PLAYERS } from "@/lib/ruleta/wheel";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const supabase = await createServiceClient();

  let body: { nombre?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const nombre = body.nombre?.trim().slice(0, 20);
  if (!nombre) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });

  const { data: sala } = await supabase
    .from("ruleta_salas")
    .select("id, status")
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  if (sala.status !== "lobby") {
    return NextResponse.json({ error: "El juego ya comenzó" }, { status: 400 });
  }

  const { count } = await supabase
    .from("ruleta_jugadores")
    .select("id", { count: "exact", head: true })
    .eq("sala_id", sala.id);

  if ((count ?? 0) >= MAX_PLAYERS) {
    return NextResponse.json({ error: "La sala está llena" }, { status: 400 });
  }

  const { data: jugador, error } = await supabase
    .from("ruleta_jugadores")
    .insert({ sala_id: sala.id, nombre, orden: count ?? 0, puntos: 0 })
    .select("id")
    .single();

  if (error || !jugador) {
    return NextResponse.json({ error: error?.message ?? "Error al unirse" }, { status: 500 });
  }

  return NextResponse.json({ jugador_id: jugador.id });
}
```

- [ ] **Step 2: Verify**

```bash
pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/ruleta/[codigo]/join/route.ts"
git commit -m "Add Ruleta join-room API route"
```

---

### Task 6: API route — start game

**Files:**
- Create: `src/app/api/ruleta/[codigo]/start/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TURN_SECONDS, MIN_PLAYERS } from "@/lib/ruleta/wheel";
import { buildBoardShape } from "@/lib/ruleta/game.server";
import { pickPuzzle } from "@/lib/ruleta/puzzles.server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: sala } = await supabase
    .from("ruleta_salas")
    .select("*")
    .eq("codigo", codigo.toUpperCase())
    .single();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  if (sala.created_by !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (sala.status !== "lobby") return NextResponse.json({ error: "El juego ya comenzó" }, { status: 400 });

  const { data: jugadores } = await supabase
    .from("ruleta_jugadores")
    .select("id, orden")
    .eq("sala_id", sala.id)
    .order("orden");

  if (!jugadores || jugadores.length < MIN_PLAYERS) {
    return NextResponse.json({ error: `Se necesitan al menos ${MIN_PLAYERS} jugadores` }, { status: 400 });
  }

  const { puzzle, usedKeys } = pickPuzzle(sala.frases_usadas as string[], sala.ultima_categoria);
  const frase = puzzle.phrase.toUpperCase();
  const primerJugador = jugadores[0];
  const endsAt = Date.now() + TURN_SECONDS * 1000;

  const service = await createServiceClient();

  const { error: rondaError } = await service.from("ruleta_rondas").insert({
    sala_id: sala.id,
    ronda_numero: 1,
    categoria: puzzle.category,
    frase,
    letras_adivinadas: [],
  });
  if (rondaError) {
    return NextResponse.json({ error: rondaError.message }, { status: 500 });
  }

  await service.from("ruleta_salas").update({
    status: "playing",
    ronda_actual: 1,
    turno_jugador_id: primerJugador.id,
    turno_termina_en: new Date(endsAt).toISOString(),
    giro_usado: false,
    puede_consonante: false,
    valor_giro_actual: null,
    frases_usadas: usedKeys,
    ultima_categoria: puzzle.category,
  }).eq("id", sala.id);

  const channel = supabase.channel(`ruleta:${codigo.toUpperCase()}`);
  await channel.send({
    type: "broadcast",
    event: "ROUND_START",
    payload: {
      ronda: 1,
      totalRondas: sala.rondas_totales,
      categoria: puzzle.category,
      board: buildBoardShape(frase, []),
      letrasProbadas: [],
      turnoJugadorId: primerJugador.id,
      turnoTerminaEn: endsAt,
    },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verify**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/ruleta/[codigo]/start/route.ts"
git commit -m "Add Ruleta start-game API route"
```

---

### Task 7: API route — spin

**Files:**
- Create: `src/app/api/ruleta/[codigo]/spin/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { WHEEL_SEGMENTS, TURN_SECONDS, pickWheelSegmentIndex } from "@/lib/ruleta/wheel";
import { nextJugadorId } from "@/lib/ruleta/game.server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const supabase = await createClient();
  const service = await createServiceClient();

  let body: { jugador_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  if (!body.jugador_id) return NextResponse.json({ error: "jugador_id requerido" }, { status: 400 });

  const { data: sala } = await service
    .from("ruleta_salas")
    .select("*")
    .eq("codigo", codigo.toUpperCase())
    .single();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  if (sala.status !== "playing") return NextResponse.json({ error: "No se puede girar ahora" }, { status: 400 });
  if (sala.turno_jugador_id !== body.jugador_id) {
    return NextResponse.json({ error: "No es tu turno" }, { status: 403 });
  }
  if (sala.giro_usado) return NextResponse.json({ error: "Ya giraste en este turno" }, { status: 400 });

  const { data: jugadores } = await service
    .from("ruleta_jugadores")
    .select("id, orden")
    .eq("sala_id", sala.id);

  const segmentIndex = pickWheelSegmentIndex();
  const seg = WHEEL_SEGMENTS[segmentIndex];
  const channel = supabase.channel(`ruleta:${codigo.toUpperCase()}`);

  if (seg.type === "puntos") {
    const endsAt = Date.now() + TURN_SECONDS * 1000;
    await service.from("ruleta_salas").update({
      giro_usado: true,
      puede_consonante: true,
      valor_giro_actual: seg.value,
      turno_termina_en: new Date(endsAt).toISOString(),
    }).eq("id", sala.id);

    await channel.send({
      type: "broadcast",
      event: "SPIN_RESULT",
      payload: {
        segmentIndex,
        tipo: "puntos",
        valor: seg.value,
        turnoJugadorId: body.jugador_id,
        turnoTerminaEn: endsAt,
        mensaje: `Elige una consonante (${seg.value} pts c/u).`,
      },
    });
    return NextResponse.json({ success: true });
  }

  // bancarrota o pierde_turno: se resuelve de inmediato y pasa el turno
  if (seg.type === "bancarrota" && jugadores) {
    const jugador = jugadores.find((j) => j.id === body.jugador_id);
    if (jugador) {
      await service.from("ruleta_jugadores").update({ puntos: 0 }).eq("id", jugador.id);
    }
  }

  const nextId = jugadores ? nextJugadorId(jugadores, body.jugador_id) : body.jugador_id;
  const endsAt = Date.now() + TURN_SECONDS * 1000;

  await service.from("ruleta_salas").update({
    giro_usado: false,
    puede_consonante: false,
    valor_giro_actual: null,
    turno_jugador_id: nextId,
    turno_termina_en: new Date(endsAt).toISOString(),
  }).eq("id", sala.id);

  await channel.send({
    type: "broadcast",
    event: "SPIN_RESULT",
    payload: {
      segmentIndex,
      tipo: seg.type,
      turnoJugadorId: nextId,
      turnoTerminaEn: endsAt,
      mensaje: seg.type === "bancarrota" ? "¡BANCARROTA! Pierde todos sus puntos." : "¡Pierde turno!",
    },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verify**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/ruleta/[codigo]/spin/route.ts"
git commit -m "Add Ruleta spin API route"
```

---

### Task 8: API route — guess consonant

**Files:**
- Create: `src/app/api/ruleta/[codigo]/guess-consonant/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TURN_SECONDS, VOWELS } from "@/lib/ruleta/wheel";
import {
  ALPHABET, buildBoardShape, countLetterInPhrase, isPhraseSolved, nextJugadorId,
} from "@/lib/ruleta/game.server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const supabase = await createClient();
  const service = await createServiceClient();

  let body: { jugador_id?: string; letra?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  const letra = body.letra?.toUpperCase();
  if (!body.jugador_id || !letra || !ALPHABET.includes(letra) || VOWELS.includes(letra)) {
    return NextResponse.json({ error: "Consonante inválida" }, { status: 400 });
  }

  const { data: sala } = await service
    .from("ruleta_salas")
    .select("*")
    .eq("codigo", codigo.toUpperCase())
    .single();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  if (sala.status !== "playing") return NextResponse.json({ error: "No se puede jugar ahora" }, { status: 400 });
  if (sala.turno_jugador_id !== body.jugador_id) {
    return NextResponse.json({ error: "No es tu turno" }, { status: 403 });
  }
  if (!sala.puede_consonante) {
    return NextResponse.json({ error: "No puedes adivinar una consonante ahora" }, { status: 400 });
  }

  const { data: ronda } = await service
    .from("ruleta_rondas")
    .select("id, frase, letras_adivinadas")
    .eq("sala_id", sala.id)
    .eq("ronda_numero", sala.ronda_actual)
    .single();
  if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 500 });

  const letrasProbadas: string[] = ronda.letras_adivinadas as string[];
  if (letrasProbadas.includes(letra)) {
    return NextResponse.json({ error: "Ya intentaste esa letra" }, { status: 400 });
  }

  const count = countLetterInPhrase(ronda.frase, letra);
  const nuevasLetras = [...letrasProbadas, letra];
  await service.from("ruleta_rondas").update({ letras_adivinadas: nuevasLetras }).eq("id", ronda.id);

  const channel = supabase.channel(`ruleta:${codigo.toUpperCase()}`);
  const board = buildBoardShape(ronda.frase, nuevasLetras);

  if (count > 0) {
    const puntosGanados = count * (sala.valor_giro_actual ?? 0);
    const { data: jugador } = await service
      .from("ruleta_jugadores").select("puntos").eq("id", body.jugador_id).single();
    await service.from("ruleta_jugadores")
      .update({ puntos: (jugador?.puntos ?? 0) + puntosGanados })
      .eq("id", body.jugador_id);

    const resuelto = isPhraseSolved(ronda.frase, nuevasLetras);

    if (resuelto) {
      await service.from("ruleta_salas").update({
        status: "ronda_fin", puede_consonante: false, turno_termina_en: null,
      }).eq("id", sala.id);
    } else {
      const endsAt = Date.now() + TURN_SECONDS * 1000;
      await service.from("ruleta_salas").update({
        puede_consonante: false, turno_termina_en: new Date(endsAt).toISOString(),
      }).eq("id", sala.id);
    }

    await channel.send({
      type: "broadcast",
      event: "LETTER_RESULT",
      payload: {
        letra, esVocal: false, acierto: true, apariciones: count, puntosGanados,
        board, letrasProbadas: nuevasLetras,
        turnoJugadorId: body.jugador_id,
        turnoTerminaEn: resuelto ? null : Date.now() + TURN_SECONDS * 1000,
        resuelto,
        frase: resuelto ? ronda.frase : undefined,
        jugadorGanadorId: resuelto ? body.jugador_id : undefined,
        mensaje: `La letra ${letra} aparece ${count} vez(es). +${puntosGanados} puntos.`,
      },
    });
    return NextResponse.json({ success: true });
  }

  // Letra equivocada: pasa el turno
  const { data: jugadores } = await service
    .from("ruleta_jugadores").select("id, orden").eq("sala_id", sala.id);
  const nextId = jugadores ? nextJugadorId(jugadores, body.jugador_id) : body.jugador_id;
  const endsAt = Date.now() + TURN_SECONDS * 1000;

  await service.from("ruleta_salas").update({
    puede_consonante: false, giro_usado: false,
    turno_jugador_id: nextId, turno_termina_en: new Date(endsAt).toISOString(),
  }).eq("id", sala.id);

  await channel.send({
    type: "broadcast",
    event: "LETTER_RESULT",
    payload: {
      letra, esVocal: false, acierto: false, apariciones: 0, puntosGanados: 0,
      board, letrasProbadas: nuevasLetras,
      turnoJugadorId: nextId, turnoTerminaEn: endsAt, resuelto: false,
      mensaje: `La letra ${letra} no está en la frase.`,
    },
  });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verify**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/ruleta/[codigo]/guess-consonant/route.ts"
git commit -m "Add Ruleta guess-consonant API route"
```

---

### Task 9: API route — guess vowel

**Files:**
- Create: `src/app/api/ruleta/[codigo]/guess-vowel/route.ts`

- [ ] **Step 1: Write the route**

This mirrors Task 8 with two differences from the original `guessVowel()`: it doesn't require `puede_consonante` (vowels are buyable any time during an active turn), it costs `VOWEL_COST` deducted unconditionally, and a correct guess awards no points (only reveals letters).

```ts
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TURN_SECONDS, VOWEL_COST, VOWELS } from "@/lib/ruleta/wheel";
import { buildBoardShape, countLetterInPhrase, isPhraseSolved, nextJugadorId } from "@/lib/ruleta/game.server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const supabase = await createClient();
  const service = await createServiceClient();

  let body: { jugador_id?: string; letra?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  const letra = body.letra?.toUpperCase();
  if (!body.jugador_id || !letra || !VOWELS.includes(letra)) {
    return NextResponse.json({ error: "Vocal inválida" }, { status: 400 });
  }

  const { data: sala } = await service
    .from("ruleta_salas").select("*").eq("codigo", codigo.toUpperCase()).single();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  if (sala.status !== "playing") return NextResponse.json({ error: "No se puede jugar ahora" }, { status: 400 });
  if (sala.turno_jugador_id !== body.jugador_id) {
    return NextResponse.json({ error: "No es tu turno" }, { status: 403 });
  }

  const { data: jugador } = await service
    .from("ruleta_jugadores").select("puntos").eq("id", body.jugador_id).single();
  if (!jugador || jugador.puntos < VOWEL_COST) {
    return NextResponse.json({ error: "No tienes suficientes puntos" }, { status: 400 });
  }

  const { data: ronda } = await service
    .from("ruleta_rondas").select("id, frase, letras_adivinadas")
    .eq("sala_id", sala.id).eq("ronda_numero", sala.ronda_actual).single();
  if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 500 });

  const letrasProbadas: string[] = ronda.letras_adivinadas as string[];
  if (letrasProbadas.includes(letra)) {
    return NextResponse.json({ error: "Ya intentaste esa letra" }, { status: 400 });
  }

  // El costo se descuenta siempre, acierte o no (igual que el juego original)
  await service.from("ruleta_jugadores")
    .update({ puntos: jugador.puntos - VOWEL_COST }).eq("id", body.jugador_id);

  const count = countLetterInPhrase(ronda.frase, letra);
  const nuevasLetras = [...letrasProbadas, letra];
  await service.from("ruleta_rondas").update({ letras_adivinadas: nuevasLetras }).eq("id", ronda.id);

  const channel = supabase.channel(`ruleta:${codigo.toUpperCase()}`);
  const board = buildBoardShape(ronda.frase, nuevasLetras);

  if (count > 0) {
    const resuelto = isPhraseSolved(ronda.frase, nuevasLetras);
    const endsAt = Date.now() + TURN_SECONDS * 1000;

    await service.from("ruleta_salas").update(
      resuelto
        ? { status: "ronda_fin", turno_termina_en: null }
        : { turno_termina_en: new Date(endsAt).toISOString() }
    ).eq("id", sala.id);

    await channel.send({
      type: "broadcast",
      event: "LETTER_RESULT",
      payload: {
        letra, esVocal: true, acierto: true, apariciones: count, puntosGanados: 0,
        board, letrasProbadas: nuevasLetras,
        turnoJugadorId: body.jugador_id,
        turnoTerminaEn: resuelto ? null : endsAt,
        resuelto,
        frase: resuelto ? ronda.frase : undefined,
        jugadorGanadorId: resuelto ? body.jugador_id : undefined,
        mensaje: `La vocal ${letra} aparece ${count} vez(es).`,
      },
    });
    return NextResponse.json({ success: true });
  }

  const { data: jugadores } = await service
    .from("ruleta_jugadores").select("id, orden").eq("sala_id", sala.id);
  const nextId = jugadores ? nextJugadorId(jugadores, body.jugador_id) : body.jugador_id;
  const endsAt = Date.now() + TURN_SECONDS * 1000;

  await service.from("ruleta_salas").update({
    puede_consonante: false, giro_usado: false,
    turno_jugador_id: nextId, turno_termina_en: new Date(endsAt).toISOString(),
  }).eq("id", sala.id);

  await channel.send({
    type: "broadcast",
    event: "LETTER_RESULT",
    payload: {
      letra, esVocal: true, acierto: false, apariciones: 0, puntosGanados: 0,
      board, letrasProbadas: nuevasLetras,
      turnoJugadorId: nextId, turnoTerminaEn: endsAt, resuelto: false,
      mensaje: `La vocal ${letra} no está en la frase.`,
    },
  });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verify**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/ruleta/[codigo]/guess-vowel/route.ts"
git commit -m "Add Ruleta guess-vowel API route"
```

---

### Task 10: API route — resolve panel

**Files:**
- Create: `src/app/api/ruleta/[codigo]/resolve/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TURN_SECONDS, RESOLVE_BONUS } from "@/lib/ruleta/wheel";
import { allLettersInPhrase, buildBoardShape, nextJugadorId, normalize } from "@/lib/ruleta/game.server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const supabase = await createClient();
  const service = await createServiceClient();

  let body: { jugador_id?: string; respuesta?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  if (!body.jugador_id || !body.respuesta?.trim()) {
    return NextResponse.json({ error: "Respuesta requerida" }, { status: 400 });
  }

  const { data: sala } = await service
    .from("ruleta_salas").select("*").eq("codigo", codigo.toUpperCase()).single();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  if (sala.status !== "playing") return NextResponse.json({ error: "No se puede jugar ahora" }, { status: 400 });
  if (sala.turno_jugador_id !== body.jugador_id) {
    return NextResponse.json({ error: "No es tu turno" }, { status: 403 });
  }

  const { data: ronda } = await service
    .from("ruleta_rondas").select("id, frase")
    .eq("sala_id", sala.id).eq("ronda_numero", sala.ronda_actual).single();
  if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 500 });

  const channel = supabase.channel(`ruleta:${codigo.toUpperCase()}`);
  const acierto = normalize(body.respuesta.trim()) === ronda.frase;

  if (acierto) {
    const todasLasLetras = allLettersInPhrase(ronda.frase);
    await service.from("ruleta_rondas").update({ letras_adivinadas: todasLasLetras }).eq("id", ronda.id);

    const { data: jugador } = await service
      .from("ruleta_jugadores").select("puntos").eq("id", body.jugador_id).single();
    await service.from("ruleta_jugadores")
      .update({ puntos: (jugador?.puntos ?? 0) + RESOLVE_BONUS }).eq("id", body.jugador_id);

    await service.from("ruleta_salas").update({
      status: "ronda_fin", turno_termina_en: null,
    }).eq("id", sala.id);

    await channel.send({
      type: "broadcast",
      event: "RESOLVE_RESULT",
      payload: {
        acierto: true,
        frase: ronda.frase,
        board: buildBoardShape(ronda.frase, todasLasLetras),
        letrasProbadas: todasLasLetras,
        turnoJugadorId: body.jugador_id,
        turnoTerminaEn: null,
        resuelto: true,
        jugadorGanadorId: body.jugador_id,
        puntosGanados: RESOLVE_BONUS,
        mensaje: "¡Resolvió el panel!",
      },
    });
    return NextResponse.json({ success: true });
  }

  const { data: jugadores } = await service
    .from("ruleta_jugadores").select("id, orden").eq("sala_id", sala.id);
  const nextId = jugadores ? nextJugadorId(jugadores, body.jugador_id) : body.jugador_id;
  const endsAt = Date.now() + TURN_SECONDS * 1000;

  await service.from("ruleta_salas").update({
    puede_consonante: false, giro_usado: false,
    turno_jugador_id: nextId, turno_termina_en: new Date(endsAt).toISOString(),
  }).eq("id", sala.id);

  await channel.send({
    type: "broadcast",
    event: "RESOLVE_RESULT",
    payload: {
      acierto: false, turnoJugadorId: nextId, turnoTerminaEn: endsAt, resuelto: false,
      mensaje: "Respuesta incorrecta.",
    },
  });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verify**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/ruleta/[codigo]/resolve/route.ts"
git commit -m "Add Ruleta resolve-panel API route"
```

---

### Task 11: API route — turn timeout

**Files:**
- Create: `src/app/api/ruleta/[codigo]/timeout/route.ts`

Any connected client calls this once its local countdown (derived from `turno_termina_en`) reaches zero — not just the active player's device, so the game still advances if that player's tab dies. Guarded against double-application with an optimistic-concurrency update (`.eq("turno_jugador_id", sala.turno_jugador_id)`): if another call already advanced the turn, this update matches zero rows and is a no-op.

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TURN_SECONDS } from "@/lib/ruleta/wheel";
import { nextJugadorId } from "@/lib/ruleta/game.server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const supabase = await createClient();
  const service = await createServiceClient();

  const { data: sala } = await service
    .from("ruleta_salas").select("*").eq("codigo", codigo.toUpperCase()).single();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  if (sala.status !== "playing" || !sala.turno_termina_en) {
    return NextResponse.json({ applied: false });
  }
  if (new Date(sala.turno_termina_en).getTime() > Date.now()) {
    return NextResponse.json({ applied: false });
  }

  const { data: jugadores } = await service
    .from("ruleta_jugadores").select("id, orden").eq("sala_id", sala.id);
  if (!jugadores) return NextResponse.json({ applied: false });

  const nextId = nextJugadorId(jugadores, sala.turno_jugador_id!);
  const endsAt = Date.now() + TURN_SECONDS * 1000;

  const { data: updated } = await service
    .from("ruleta_salas")
    .update({
      puede_consonante: false, giro_usado: false,
      turno_jugador_id: nextId, turno_termina_en: new Date(endsAt).toISOString(),
    })
    .eq("id", sala.id)
    .eq("turno_jugador_id", sala.turno_jugador_id!) // no-op if another call already advanced it
    .select("id");

  if (!updated || updated.length === 0) {
    return NextResponse.json({ applied: false });
  }

  const channel = supabase.channel(`ruleta:${codigo.toUpperCase()}`);
  await channel.send({
    type: "broadcast",
    event: "TURN_TIMEOUT",
    payload: { turnoJugadorId: nextId, turnoTerminaEn: endsAt, mensaje: "Se acabó el tiempo." },
  });

  return NextResponse.json({ applied: true });
}
```

- [ ] **Step 2: Verify**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/ruleta/[codigo]/timeout/route.ts"
git commit -m "Add Ruleta turn-timeout API route"
```

---

### Task 12: API route — next round

**Files:**
- Create: `src/app/api/ruleta/[codigo]/next-round/route.ts`

Host-only, mirrors `elim_arena`'s `/next` route. The new round's starting turn stays with whoever holds `turno_jugador_id` right now — the round's winner — matching the original `loadNextPuzzle()` never resetting `currentPlayerIndex`.

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TURN_SECONDS } from "@/lib/ruleta/wheel";
import { buildBoardShape } from "@/lib/ruleta/game.server";
import { pickPuzzle } from "@/lib/ruleta/puzzles.server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: sala } = await supabase
    .from("ruleta_salas").select("*").eq("codigo", codigo.toUpperCase()).single();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  if (sala.created_by !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (sala.status !== "ronda_fin") {
    return NextResponse.json({ error: "La ronda actual no ha terminado" }, { status: 400 });
  }

  const service = await createServiceClient();
  const channel = supabase.channel(`ruleta:${codigo.toUpperCase()}`);

  if (sala.ronda_actual >= sala.rondas_totales) {
    await service.from("ruleta_salas").update({ status: "finished" }).eq("id", sala.id);
    await channel.send({ type: "broadcast", event: "GAME_FINISHED", payload: {} });
    return NextResponse.json({ success: true, finished: true });
  }

  const { puzzle, usedKeys } = pickPuzzle(sala.frases_usadas as string[], sala.ultima_categoria);
  const frase = puzzle.phrase.toUpperCase();
  const nuevaRonda = sala.ronda_actual + 1;
  const endsAt = Date.now() + TURN_SECONDS * 1000;

  const { error: rondaError } = await service.from("ruleta_rondas").insert({
    sala_id: sala.id, ronda_numero: nuevaRonda, categoria: puzzle.category,
    frase, letras_adivinadas: [],
  });
  if (rondaError) return NextResponse.json({ error: rondaError.message }, { status: 500 });

  await service.from("ruleta_salas").update({
    status: "playing",
    ronda_actual: nuevaRonda,
    turno_termina_en: new Date(endsAt).toISOString(),
    giro_usado: false,
    puede_consonante: false,
    valor_giro_actual: null,
    frases_usadas: usedKeys,
    ultima_categoria: puzzle.category,
  }).eq("id", sala.id);

  await channel.send({
    type: "broadcast",
    event: "ROUND_START",
    payload: {
      ronda: nuevaRonda,
      totalRondas: sala.rondas_totales,
      categoria: puzzle.category,
      board: buildBoardShape(frase, []),
      letrasProbadas: [],
      turnoJugadorId: sala.turno_jugador_id,
      turnoTerminaEn: endsAt,
    },
  });

  return NextResponse.json({ success: true, finished: false });
}
```

- [ ] **Step 2: Verify**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/ruleta/[codigo]/next-round/route.ts"
git commit -m "Add Ruleta next-round API route"
```

---

### Task 13: Landing page + join-by-code

**Files:**
- Create: `src/components/ruleta/RuletaJoinCodeForm.tsx`
- Create: `src/app/(public)/ruleta/page.tsx`

- [ ] **Step 1: Write `RuletaJoinCodeForm.tsx`** (same pattern as `src/components/arena/JoinCodeForm.tsx`, pointed at `/ruleta/{code}`)

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

interface RuletaJoinCodeFormProps {
  notFound?: boolean;
}

export function RuletaJoinCodeForm({ notFound }: RuletaJoinCodeFormProps) {
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 4) return;
    startTransition(() => {
      router.push(`/ruleta/${code}`);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={code}
          onChange={handleChange}
          placeholder="ELIM"
          maxLength={4}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 rounded-xl px-4 py-4 text-2xl font-mono font-bold uppercase text-center outline-none transition-colors"
          style={{
            background: "var(--color-surface-elevated)",
            border: `1px solid ${notFound ? "var(--color-destructive)" : "var(--color-border)"}`,
            color: "var(--color-text)",
            letterSpacing: "0.3em",
          }}
        />
        <button
          type="submit"
          disabled={code.length !== 4 || isPending}
          className="flex items-center justify-center gap-2 px-5 rounded-xl text-base font-semibold transition-all duration-200"
          style={{
            background: code.length === 4 && !isPending ? "var(--color-primary)" : "var(--color-surface-elevated)",
            color: code.length === 4 && !isPending ? "#000" : "var(--color-text-muted)",
            cursor: code.length === 4 && !isPending ? "pointer" : "not-allowed",
          }}
        >
          {isPending ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
        </button>
      </form>
      {notFound && (
        <p className="text-sm text-center" style={{ color: "var(--color-destructive)" }}>
          Sala no encontrada. Verifica el código e intenta de nuevo.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `src/app/(public)/ruleta/page.tsx`**

```tsx
import { getProfile } from "@/lib/supabase/server";
import { RuletaJoinCodeForm } from "@/components/ruleta/RuletaJoinCodeForm";
import { Disc3, Hash, Users, Sparkles } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "La Ruleta en línea — Elim LLDM",
  description: "Juega La Ruleta con tus amigos desde sus propios celulares, en tiempo real.",
};

export default async function RuletaPage() {
  const profile = await getProfile();

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
            <Disc3 size={32} style={{ color: "var(--color-primary)" }} />
          </div>
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{ color: "var(--color-text)" }}>
              La Ruleta en línea
            </h1>
            <p style={{ color: "var(--color-text-muted)" }}>
              De 2 a 6 jugadores, cada quien desde su propio celular
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-10 flex flex-col gap-8">
        <div
          className="rounded-2xl p-6"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Hash size={15} style={{ color: "var(--color-primary)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              Unirse con código
            </h2>
          </div>
          <RuletaJoinCodeForm />
        </div>

        {profile ? (
          <Link
            href="/ruleta/nueva"
            className="flex items-center gap-3 px-5 py-4 rounded-2xl transition-colors"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            <Sparkles size={20} />
            <div className="flex-1">
              <p className="text-base font-bold">Crear una nueva sala</p>
              <p className="text-xs opacity-80">Comparte el código con hasta 5 amigos más</p>
            </div>
          </Link>
        ) : (
          <Link
            href="/login?returnUrl=/ruleta/nueva"
            className="flex items-center gap-3 px-5 py-4 rounded-2xl transition-colors"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          >
            <Users size={20} style={{ color: "var(--color-primary)" }} />
            <div className="flex-1">
              <p className="text-base font-bold">Inicia sesión para crear una sala</p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Unirse a una sala no requiere cuenta</p>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ruleta/RuletaJoinCodeForm.tsx "src/app/(public)/ruleta/page.tsx"
git commit -m "Add Ruleta landing page with join-by-code"
```

---

### Task 14: Create-room page + form

**Files:**
- Create: `src/components/ruleta/RuletaCreateForm.tsx`
- Create: `src/app/(public)/ruleta/nueva/page.tsx`

- [ ] **Step 1: Write `RuletaCreateForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { ROUNDS_MIN, ROUNDS_MAX, ROUNDS_DEFAULT } from "@/lib/ruleta/wheel";

export function RuletaCreateForm() {
  const [rondas, setRondas] = useState(ROUNDS_DEFAULT);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/ruleta/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rondas }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo crear la sala");
      setSubmitting(false);
      return;
    }

    const data = await res.json();
    router.push(`/ruleta/${data.codigo}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className="text-sm font-semibold block mb-2" style={{ color: "var(--color-text)" }}>
          Número de rondas
        </label>
        <input
          type="number"
          min={ROUNDS_MIN}
          max={ROUNDS_MAX}
          value={rondas}
          onChange={(e) => setRondas(Math.max(ROUNDS_MIN, Math.min(ROUNDS_MAX, Number(e.target.value) || ROUNDS_DEFAULT)))}
          className="w-full rounded-xl px-4 py-3 text-lg font-semibold outline-none"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        />
      </div>

      {error && (
        <p className="text-sm text-center" style={{ color: "var(--color-destructive)" }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-lg font-bold transition-all duration-200"
        style={{
          background: submitting ? "var(--color-surface-elevated)" : "var(--color-primary)",
          color: submitting ? "var(--color-text-muted)" : "#000",
        }}
      >
        {submitting ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
        Crear sala
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Write `src/app/(public)/ruleta/nueva/page.tsx`**

```tsx
import { getProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { RuletaCreateForm } from "@/components/ruleta/RuletaCreateForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nueva sala — La Ruleta" };

export default async function NuevaSalaRuletaPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?returnUrl=/ruleta/nueva");

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/ruleta" className="flex items-center gap-1.5 text-sm" style={{ color: "var(--color-text-muted)" }}>
            <ArrowLeft size={15} />
            La Ruleta
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--color-text)" }}>
          Nueva sala de La Ruleta
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
          Elige cuántas rondas dura la partida. Podrás compartir el código en el siguiente paso.
        </p>

        <RuletaCreateForm />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ruleta/RuletaCreateForm.tsx "src/app/(public)/ruleta/nueva/page.tsx"
git commit -m "Add Ruleta create-room page and form"
```

---

### Task 15: Room server loader

**Files:**
- Create: `src/app/(public)/ruleta/[codigo]/page.tsx`

This is a thin server component (mirrors `src/app/(public)/arena/[codigo]/page.tsx`) that loads the sala + jugadores and hands them to `RuletaRoom` (built in Task 20). It compiles once `RuletaRoom` exists — for now it will fail typecheck with "Cannot find module" until Task 20 lands; that's expected and the plan says so, don't stop and debug it.

- [ ] **Step 1: Write the page**

```tsx
import { createClient, getProfile } from "@/lib/supabase/server";
import { RuletaRoom } from "@/components/ruleta/RuletaRoom";
import { RuletaJoinCodeForm } from "@/components/ruleta/RuletaJoinCodeForm";
import type { RuletaJugador, RuletaSala } from "@/types";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ codigo: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codigo } = await params;
  return { title: `Sala ${codigo.toUpperCase()} — La Ruleta` };
}

export default async function RuletaSalaPage({ params }: Props) {
  const { codigo } = await params;
  const codigoUpper = codigo.toUpperCase();
  const supabase = await createClient();

  const { data: sala } = await supabase
    .from("ruleta_salas")
    .select("*")
    .eq("codigo", codigoUpper)
    .maybeSingle();

  if (!sala) {
    return (
      <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
        <div className="w-full max-w-[430px] mx-auto px-4 py-16 flex flex-col items-center gap-6 text-center">
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>La Ruleta</h1>
          <p style={{ color: "var(--color-text-muted)" }}>
            La sala <span className="font-mono font-bold">{codigoUpper}</span> no existe o ya terminó.
          </p>
          <div className="w-full">
            <RuletaJoinCodeForm notFound />
          </div>
        </div>
      </div>
    );
  }

  const [{ data: jugadoresRaw }, profile] = await Promise.all([
    supabase.from("ruleta_jugadores").select("*").eq("sala_id", sala.id).order("orden"),
    getProfile(),
  ]);

  const isHost = profile?.id === sala.created_by;

  return (
    <RuletaRoom
      sala={sala as RuletaSala}
      jugadoresIniciales={(jugadoresRaw ?? []) as RuletaJugador[]}
      isHost={isHost}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(public)/ruleta/[codigo]/page.tsx"
git commit -m "Add Ruleta room server loader"
```

(No `tsc --noEmit` here yet — it will fail until Task 20 adds `RuletaRoom`. That's fine, keep going.)

---

### Task 16: Join sound + lobby components

**Files:**
- Create: `src/lib/ruleta/sound.client.ts`
- Create: `src/components/ruleta/JoinForm.tsx`
- Create: `src/components/ruleta/HostLobby.tsx`

- [ ] **Step 1: Write `sound.client.ts`**

```ts
"use client";

// Two-note chime for "a player joined the lobby" — synthesized with the Web
// Audio API so there's no audio asset file to ship/host.
export function playJoinChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [880, 1174.66].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.09);
      gain.gain.linearRampToValueAtTime(0.18, now + i * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.4);
    });
    setTimeout(() => ctx.close(), 600);
  } catch {
    // Web Audio no disponible en este navegador
  }
}
```

- [ ] **Step 2: Write `JoinForm.tsx`** (same shape as `src/components/arena/JoinForm.tsx`, pointed at `/api/ruleta/[codigo]/join`)

```tsx
"use client";

import { useState } from "react";
import { ArrowRight, Loader2, UserRound } from "lucide-react";

interface JoinFormProps {
  codigo: string;
  onJoined: (jugadorId: string, nombre: string) => void;
}

export function JoinForm({ codigo, onJoined }: JoinFormProps) {
  const [nombre, setNombre] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/ruleta/${codigo}/join`, {
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
    onJoined(data.jugador_id, nombre.trim());
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
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>La Ruleta</h1>
        <p className="text-base" style={{ color: "var(--color-text-muted)" }}>¿Cuál es tu nombre?</p>
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
          style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
        />
        {error && <p className="text-sm text-center" style={{ color: "var(--color-destructive)" }}>{error}</p>}
        <button
          type="submit"
          disabled={!nombre.trim() || submitting}
          className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-lg font-bold transition-all duration-200"
          style={{
            background: nombre.trim() && !submitting ? "var(--color-primary)" : "var(--color-surface-elevated)",
            color: nombre.trim() && !submitting ? "#000" : "var(--color-text-muted)",
          }}
        >
          {submitting ? <Loader2 size={20} className="animate-spin" /> : <>Entrar al juego <ArrowRight size={20} /></>}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Write `HostLobby.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Users, Play, Loader2, Copy, Check } from "lucide-react";
import type { RuletaJugador } from "@/types";
import { MIN_PLAYERS, MAX_PLAYERS } from "@/lib/ruleta/wheel";

interface HostLobbyProps {
  codigo: string;
  jugadores: RuletaJugador[];
  onStart: () => void;
  starting: boolean;
  error: string | null;
}

export function HostLobby({ codigo, jugadores, onStart, starting, error }: HostLobbyProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard no disponible
    }
  }

  const canStart = jugadores.length >= MIN_PLAYERS && jugadores.length <= MAX_PLAYERS && !starting;

  return (
    <div className="flex-1 flex flex-col gap-5 py-4">
      <div className="text-center flex flex-col gap-1">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>La Ruleta</h1>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Comparte este código para que se unan (máx. {MAX_PLAYERS})</p>
      </div>

      <button
        onClick={handleCopy}
        className="flex items-center justify-center gap-3 py-6 rounded-2xl transition-colors"
        style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
      >
        <span className="text-5xl font-extrabold font-mono" style={{ color: "var(--color-primary)", letterSpacing: "0.3em" }}>
          {codigo}
        </span>
        {copied ? <Check size={22} style={{ color: "var(--color-success)" }} /> : <Copy size={22} style={{ color: "var(--color-text-muted)" }} />}
      </button>

      <div className="rounded-2xl p-4 flex-1 flex flex-col gap-3" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        <div className="flex items-center gap-2">
          <Users size={16} style={{ color: "var(--color-primary)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {jugadores.length} {jugadores.length === 1 ? "jugador" : "jugadores"}
          </span>
        </div>
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {jugadores.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: "var(--color-text-muted)" }}>Esperando jugadores...</p>
          ) : (
            jugadores.map((j) => (
              <div key={j.id} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: "var(--color-surface-elevated)" }}>
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: "rgba(212,160,23,0.15)", color: "var(--color-primary)" }}>
                  {j.nombre[0]?.toUpperCase() ?? "?"}
                </span>
                <span className="text-base font-medium truncate" style={{ color: "var(--color-text)" }}>{j.nombre}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {jugadores.length === 1 && (
        <p className="text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
          Se necesita al menos {MIN_PLAYERS} jugadores para empezar.
        </p>
      )}
      {error && <p className="text-sm text-center" style={{ color: "var(--color-destructive)" }}>{error}</p>}

      <button
        onClick={onStart}
        disabled={!canStart}
        className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-lg font-bold transition-all duration-200"
        style={{
          background: canStart ? "var(--color-primary)" : "var(--color-surface-elevated)",
          color: canStart ? "#000" : "var(--color-text-muted)",
        }}
      >
        {starting ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} />}
        Iniciar juego
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

```bash
pnpm exec tsc --noEmit
```
Expected: no errors in these three files (unrelated pre-existing "Cannot find module '@/components/ruleta/RuletaRoom'" from Task 15 is expected until Task 20).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ruleta/sound.client.ts src/components/ruleta/JoinForm.tsx src/components/ruleta/HostLobby.tsx
git commit -m "Add Ruleta join sound, join form, and host lobby"
```

---

### Task 17: Wheel component

**Files:**
- Create: `src/components/ruleta/Wheel.tsx`

Ports the fixed label-centering math and gold divider lines from the recent static-HTML fix (`public/juegos/ruleta-elimlldm.html:1253-1333`) into a React component. The server always decides the winning `segmentIndex` (Task 7) — this component's job is purely to animate every viewer's wheel to visually land on that same index.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { WHEEL_SEGMENTS, SEG_COLORS } from "@/lib/ruleta/wheel";

interface WheelProps {
  size?: number;
  spinToSegment: number | null; // set by the parent when a SPIN_RESULT arrives
  onSpinClick: () => void;
  canSpin: boolean;
}

const SEG_ANGLE = 360 / WHEEL_SEGMENTS.length;

export function Wheel({ size = 260, spinToSegment, onSpinClick, canSpin }: WheelProps) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const rotationRef = useRef(0);
  const lastAppliedIndex = useRef<number | null>(null);

  useEffect(() => {
    if (spinToSegment === null || spinToSegment === lastAppliedIndex.current) return;
    lastAppliedIndex.current = spinToSegment;

    const effectiveAngle = spinToSegment * SEG_ANGLE + SEG_ANGLE / 2;
    const finalMod = (360 - effectiveAngle + 360) % 360;
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const total = rotationRef.current + extraSpins * 360 + finalMod;
    rotationRef.current = total;

    setSpinning(true);
    setRotation(total);
    const t = setTimeout(() => setSpinning(false), 4000);
    return () => clearTimeout(t);
  }, [spinToSegment]);

  const gradient = useMemo(() => {
    const parts = WHEEL_SEGMENTS.map((_, i) => {
      const color = SEG_COLORS[i % SEG_COLORS.length];
      return `${color} ${i * SEG_ANGLE}deg ${(i + 1) * SEG_ANGLE}deg`;
    });
    return `conic-gradient(${parts.join(",")})`;
  }, []);

  const dividers = useMemo(() => {
    return WHEEL_SEGMENTS.map((_, i) => {
      const angle = (i * SEG_ANGLE - 90) * (Math.PI / 180);
      const x2 = 50 + 49 * Math.cos(angle);
      const y2 = 50 + 49 * Math.sin(angle);
      return { x1: 50, y1: 50, x2, y2 };
    });
  }, []);

  const R = size / 2;
  const centerRadius = R * 0.6;

  return (
    <div className="flex flex-col items-center gap-4">
      <div style={{ position: "relative", width: size, height: size }}>
        <div
          style={{
            position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)",
            width: 0, height: 0, borderLeft: "14px solid transparent", borderRight: "14px solid transparent",
            borderTop: "24px solid var(--color-primary)", zIndex: 6,
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,.6))",
          }}
        />
        <div
          style={{
            width: size, height: size, borderRadius: "50%",
            border: "6px solid var(--color-primary-dark, #A07810)",
            boxShadow: "0 0 0 3px #2a1505, 0 10px 30px rgba(0,0,0,.6)",
            position: "relative",
            background: gradient,
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? "transform 4s cubic-bezier(0.15,0.7,0.25,1)" : "none",
          }}
        >
          <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
            {dividers.map((d, i) => (
              <line key={i} x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke="rgba(255,230,170,.6)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          {WHEEL_SEGMENTS.map((seg, i) => {
            const mid = i * SEG_ANGLE + SEG_ANGLE / 2;
            const isBankrupt = seg.type === "bancarrota";
            const isLoseTurn = seg.type === "pierde_turno";
            const width = isBankrupt || isLoseTurn ? size * 0.15 : size * 0.19;
            const fontSize = isBankrupt ? size * 0.1 : isLoseTurn ? size * 0.088 : Math.max(9, size * 0.05);
            const tx = centerRadius - width / 2;
            return (
              <div
                key={i}
                style={{
                  position: "absolute", left: "50%", top: "50%", transformOrigin: "0 0",
                  width, fontSize, textAlign: "center", fontWeight: 700, color: "#fff",
                  textShadow: "0 1px 3px rgba(0,0,0,.8)", lineHeight: 1,
                  transform: `rotate(${mid}deg) translate(${tx}px, ${-fontSize * 0.42}px)`,
                }}
              >
                {isBankrupt ? "💀" : isLoseTurn ? "😴" : seg.label}
              </div>
            );
          })}
        </div>
        <div
          style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            width: 34, height: 34, borderRadius: "50%",
            background: "radial-gradient(circle at 35% 35%, #fff8dc, var(--color-primary) 55%, #A07810)",
            border: "2px solid #2a1505", zIndex: 4,
          }}
        />
      </div>
      <button
        onClick={onSpinClick}
        disabled={!canSpin || spinning}
        className="w-full rounded-2xl py-4 text-lg font-bold transition-all duration-200"
        style={{
          background: canSpin && !spinning ? "var(--color-primary)" : "var(--color-surface-elevated)",
          color: canSpin && !spinning ? "#000" : "var(--color-text-muted)",
        }}
      >
        Girar la ruleta
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm exec tsc --noEmit
```
Expected: no new errors in `Wheel.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ruleta/Wheel.tsx
git commit -m "Add Ruleta Wheel component"
```

---

### Task 18: Board, Letters, Scoreboard, TurnTimer

**Files:**
- Create: `src/components/ruleta/Board.tsx`
- Create: `src/components/ruleta/Letters.tsx`
- Create: `src/components/ruleta/Scoreboard.tsx`
- Create: `src/components/ruleta/TurnTimer.tsx`

- [ ] **Step 1: Write `Board.tsx`**

```tsx
import type { RuletaBoardTile } from "@/types";

export function Board({ tiles }: { tiles: RuletaBoardTile[] }) {
  return (
    <div
      className="flex flex-wrap gap-1.5 justify-center rounded-xl p-4"
      style={{ background: "radial-gradient(ellipse at 50% 0%, #0f6b34, #072d18 85%)", border: "3px solid #A07810" }}
    >
      {tiles.map((tile, i) =>
        tile.type === "space" ? (
          <div key={i} style={{ width: 12 }} />
        ) : (
          <div
            key={i}
            className="flex items-center justify-center rounded font-bold"
            style={{
              width: 28, height: 34,
              background: tile.char ? "linear-gradient(160deg,#123a63,#081527)" : "linear-gradient(160deg,#0e2c4c,#081527)",
              border: "2px solid #0a1626",
              color: "#fff",
              fontSize: "1rem",
            }}
          >
            {tile.char ?? ""}
          </div>
        )
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `Letters.tsx`**

```tsx
import { ALPHABET, VOWELS } from "@/lib/ruleta/game.server";
// game.server.ts is server-only by convention (imported from API routes),
// but ALPHABET/VOWELS are plain string-array constants with no secret data
// and no server-only APIs, so importing just those two here is safe and
// avoids duplicating the list in a client file.

interface LettersProps {
  letrasProbadas: string[];
  canGuessConsonant: boolean;
  canAffordVowel: boolean;
  disabled: boolean;
  onGuess: (letra: string) => void;
}

export function Letters({ letrasProbadas, canGuessConsonant, canAffordVowel, disabled, onGuess }: LettersProps) {
  return (
    <div className="flex flex-wrap gap-1.5 justify-center">
      {ALPHABET.map((letter) => {
        const isVowel = VOWELS.includes(letter);
        const tried = letrasProbadas.includes(letter);
        const enabled = !disabled && !tried && (isVowel ? canAffordVowel : canGuessConsonant);
        return (
          <button
            key={letter}
            onClick={() => onGuess(letter)}
            disabled={!enabled}
            className="rounded-full font-bold transition-transform"
            style={{
              width: 34, height: 34,
              background: !enabled
                ? "linear-gradient(160deg,#333,#161616)"
                : isVowel
                ? "linear-gradient(160deg,var(--color-primary-light),#A07810)"
                : "linear-gradient(160deg,#e2f0ff,#9fc4ea)",
              color: !enabled ? "#666" : isVowel ? "#2a1505" : "#0f2a4a",
              border: "1px solid rgba(0,0,0,.25)",
            }}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Write `Scoreboard.tsx`**

```tsx
import type { RuletaJugador } from "@/types";

export function Scoreboard({ jugadores, turnoJugadorId }: { jugadores: RuletaJugador[]; turnoJugadorId: string | null }) {
  return (
    <div className="flex gap-2 flex-wrap justify-center">
      {jugadores.map((j) => {
        const active = j.id === turnoJugadorId;
        return (
          <div
            key={j.id}
            className="flex-1 min-w-[80px] rounded-xl p-2 text-center transition-all"
            style={{
              background: "linear-gradient(160deg, rgba(255,255,255,.05), rgba(0,0,0,.4))",
              border: active ? "2px solid var(--color-primary)" : "2px solid rgba(212,160,23,.2)",
              boxShadow: active ? "0 0 16px rgba(212,160,23,.5)" : "none",
              transform: active ? "translateY(-2px)" : "none",
            }}
          >
            <div className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>{j.nombre}</div>
            <div className="text-lg font-bold" style={{ color: "var(--color-primary)" }}>{j.puntos}</div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Write `TurnTimer.tsx`** (same `endsAt`-driven pattern as `src/components/arena/CountdownCircle.tsx`)

```tsx
"use client";

import { useEffect, useState } from "react";
import { TURN_SECONDS } from "@/lib/ruleta/wheel";

interface TurnTimerProps {
  endsAt: number | null;
  onExpire: () => void;
}

export function TurnTimer({ endsAt, onExpire }: TurnTimerProps) {
  const [timeLeft, setTimeLeft] = useState(() =>
    endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : TURN_SECONDS
  );

  useEffect(() => {
    if (!endsAt) return;
    setTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        onExpire();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [endsAt, onExpire]);

  if (!endsAt) return null;
  const urgent = timeLeft <= 3;

  return (
    <div
      className="font-mono font-extrabold rounded-lg px-3 py-1.5 text-center"
      style={{
        fontSize: "1.2rem",
        color: urgent ? "var(--color-live)" : "#ffdd66",
        background: "#050505",
        border: `2px solid ${urgent ? "var(--color-live)" : "#A07810"}`,
      }}
    >
      ⏱ {timeLeft}
    </div>
  );
}
```

- [ ] **Step 5: Verify**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ruleta/Board.tsx src/components/ruleta/Letters.tsx src/components/ruleta/Scoreboard.tsx src/components/ruleta/TurnTimer.tsx
git commit -m "Add Ruleta board, letters, scoreboard, and turn timer components"
```

---

### Task 19: Round-end banner + match-end screen

**Files:**
- Create: `src/components/ruleta/RoundBanner.tsx`
- Create: `src/components/ruleta/MatchEndScreen.tsx`

- [ ] **Step 1: Write `RoundBanner.tsx`**

```tsx
"use client";

import { Loader2, ArrowRight, Trophy } from "lucide-react";
import type { RuletaJugador } from "@/types";

interface RoundBannerProps {
  frase: string;
  ganador: RuletaJugador | null;
  isHost: boolean;
  isLastRound: boolean;
  onNext: () => void;
  advancing: boolean;
}

export function RoundBanner({ frase, ganador, isHost, isLastRound, onNext, advancing }: RoundBannerProps) {
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

      {isHost ? (
        <button
          onClick={onNext}
          disabled={advancing}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-base font-bold"
          style={{ background: advancing ? "var(--color-surface-elevated)" : "var(--color-primary)", color: advancing ? "var(--color-text-muted)" : "#000" }}
        >
          {advancing ? <Loader2 size={18} className="animate-spin" /> : <>{isLastRound ? "Ver resultado final" : "Siguiente ronda"} <ArrowRight size={18} /></>}
        </button>
      ) : (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Esperando al anfitrión...</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `MatchEndScreen.tsx`** (reuses `canvas-confetti` the same way `src/components/arena/WinnerScreen.tsx` does)

```tsx
"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Trophy } from "lucide-react";
import Link from "next/link";
import type { RuletaJugador } from "@/types";

export function MatchEndScreen({ jugadores }: { jugadores: RuletaJugador[] }) {
  const sorted = [...jugadores].sort((a, b) => b.puntos - a.puntos);
  const winner = sorted[0];

  useEffect(() => {
    const end = Date.now() + 2500;
    const colors = ["#D4A017", "#EDB84A", "#FFFFFF"];
    let frameId: number;
    function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors });
      if (Date.now() < end) frameId = requestAnimationFrame(frame);
    }
    frame();
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center gap-6 py-8">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}>
        <Trophy size={40} style={{ color: "var(--color-primary)" }} />
      </div>
      <div className="text-center flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase" style={{ color: "var(--color-text-muted)", letterSpacing: "0.1em" }}>¡Partida terminada!</p>
        {winner ? (
          <h1 className="text-3xl font-extrabold" style={{ color: "var(--color-primary)" }}>{winner.nombre}</h1>
        ) : (
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>Sin jugadores</h1>
        )}
        {winner && (
          <p className="text-base" style={{ color: "var(--color-text-muted)" }}>
            con <span className="font-bold" style={{ color: "var(--color-text)" }}>{winner.puntos.toLocaleString()} pts</span>
          </p>
        )}
      </div>
      <div className="w-full flex flex-col gap-2">
        {sorted.map((j, i) => (
          <div key={j.id} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <span className="text-sm font-bold w-5" style={{ color: "var(--color-text-muted)" }}>{i + 1}</span>
            <span className="flex-1 font-medium" style={{ color: "var(--color-text)" }}>{j.nombre}</span>
            <span className="font-bold" style={{ color: "var(--color-primary)" }}>{j.puntos}</span>
          </div>
        ))}
      </div>
      <Link href="/ruleta" className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}>
        Volver a La Ruleta
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ruleta/RoundBanner.tsx src/components/ruleta/MatchEndScreen.tsx
git commit -m "Add Ruleta round-end banner and match-end screen"
```

---

### Task 20: RuletaRoom orchestrator

**Files:**
- Create: `src/components/ruleta/RuletaRoom.tsx`

This is the biggest file: it holds the phase state machine, subscribes to the `ruleta:{codigo}` broadcast channel plus `postgres_changes` on `ruleta_jugadores`, plays the join chime, and renders whichever screen matches the current phase. It mirrors `src/components/arena/ArenaRoom.tsx`'s structure closely.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Hash, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { RuletaBoardTile, RuletaJugador, RuletaSala } from "@/types";
import { playJoinChime } from "@/lib/ruleta/sound.client";
import { VOWEL_COST } from "@/lib/ruleta/wheel";
import { JoinForm } from "./JoinForm";
import { HostLobby } from "./HostLobby";
import { Wheel } from "./Wheel";
import { Board } from "./Board";
import { Letters } from "./Letters";
import { Scoreboard } from "./Scoreboard";
import { TurnTimer } from "./TurnTimer";
import { RoundBanner } from "./RoundBanner";
import { MatchEndScreen } from "./MatchEndScreen";

type Phase = "lobby" | "playing" | "ronda_fin" | "finished";

interface RoundState {
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

interface RuletaRoomProps {
  sala: RuletaSala;
  jugadoresIniciales: RuletaJugador[];
  isHost: boolean;
}

function phaseFromStatus(status: RuletaSala["status"]): Phase {
  if (status === "finished") return "finished";
  if (status === "ronda_fin") return "ronda_fin";
  if (status === "playing") return "playing";
  return "lobby";
}

export function RuletaRoom({ sala, jugadoresIniciales, isHost }: RuletaRoomProps) {
  const [phase, setPhase] = useState<Phase>(() => phaseFromStatus(sala.status));
  const [jugadores, setJugadores] = useState<RuletaJugador[]>(jugadoresIniciales);
  const [jugadorId, setJugadorId] = useState<string | null>(null);
  const [round, setRound] = useState<RoundState | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveText, setResolveText] = useState("");
  const jugadorCountRef = useRef(jugadoresIniciales.length);
  const isFirstJugadoresLoad = useRef(true);

  // Restaurar identidad del jugador (sin cuenta) desde localStorage
  useEffect(() => {
    if (isHost) return;
    try {
      const stored = localStorage.getItem(`ruleta_jugador_${sala.codigo}`);
      if (stored) setJugadorId((JSON.parse(stored) as { id: string }).id);
    } catch {
      // localStorage no disponible
    }
  }, [isHost, sala.codigo]);

  // Suscripciones realtime
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`ruleta:${sala.codigo}`)
      .on("broadcast", { event: "*" }, (msg) => {
        const { event, payload } = msg as unknown as { event: string; payload: Record<string, unknown> };

        if (event === "ROUND_START") {
          const p = payload as unknown as Omit<RoundState, "spinToSegment" | "mensaje" | "puedeConsonante" | "giroUsado">;
          setRound({
            ...p, spinToSegment: null, mensaje: "Nueva frase cargada.",
            puedeConsonante: false, giroUsado: false,
          });
          setPhase("playing");
          setResolveOpen(false);
        }

        if (event === "SPIN_RESULT") {
          const p = payload as unknown as {
            segmentIndex: number; tipo: string; valor?: number;
            turnoJugadorId: string; turnoTerminaEn: number; mensaje: string;
          };
          setRound((prev) => prev && ({
            ...prev,
            spinToSegment: p.segmentIndex,
            turnoJugadorId: p.turnoJugadorId,
            turnoTerminaEn: p.turnoTerminaEn,
            puedeConsonante: p.tipo === "puntos",
            giroUsado: p.tipo === "puntos",
            mensaje: p.mensaje,
          }));
        }

        if (event === "LETTER_RESULT" || event === "RESOLVE_RESULT") {
          const p = payload as unknown as {
            board?: RuletaBoardTile[]; letrasProbadas?: string[];
            turnoJugadorId: string; turnoTerminaEn: number | null;
            resuelto: boolean; frase?: string; mensaje: string;
          };
          setRound((prev) => prev && ({
            ...prev,
            board: p.board ?? prev.board,
            letrasProbadas: p.letrasProbadas ?? prev.letrasProbadas,
            turnoJugadorId: p.turnoJugadorId,
            turnoTerminaEn: p.turnoTerminaEn,
            puedeConsonante: false,
            mensaje: p.mensaje,
            frase: p.frase ?? prev.frase,
            spinToSegment: prev.spinToSegment,
          }));
          if (p.resuelto) setPhase("ronda_fin");
          setResolveOpen(false);
        }

        if (event === "TURN_TIMEOUT") {
          const p = payload as unknown as { turnoJugadorId: string; turnoTerminaEn: number; mensaje: string };
          setRound((prev) => prev && ({
            ...prev, turnoJugadorId: p.turnoJugadorId, turnoTerminaEn: p.turnoTerminaEn,
            puedeConsonante: false, giroUsado: false, mensaje: p.mensaje,
          }));
        }

        if (event === "GAME_FINISHED") setPhase("finished");
      });

    const jugadoresChannel = supabase
      .channel(`ruleta-jugadores:${sala.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ruleta_jugadores", filter: `sala_id=eq.${sala.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const nuevo = payload.new as RuletaJugador;
            setJugadores((prev) => (prev.some((j) => j.id === nuevo.id) ? prev : [...prev, nuevo].sort((a, b) => a.orden - b.orden)));
          } else if (payload.eventType === "UPDATE") {
            const actualizado = payload.new as RuletaJugador;
            setJugadores((prev) => prev.map((j) => (j.id === actualizado.id ? actualizado : j)));
          } else if (payload.eventType === "DELETE") {
            const eliminado = payload.old as { id: string };
            setJugadores((prev) => prev.filter((j) => j.id !== eliminado.id));
          }
        }
      )
      .subscribe();

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(jugadoresChannel);
    };
  }, [sala.codigo, sala.id]);

  // Aviso sonoro cuando alguien se une, mientras seguimos en el lobby
  useEffect(() => {
    if (isFirstJugadoresLoad.current) {
      isFirstJugadoresLoad.current = false;
      jugadorCountRef.current = jugadores.length;
      return;
    }
    if (phase === "lobby" && jugadores.length > jugadorCountRef.current) playJoinChime();
    jugadorCountRef.current = jugadores.length;
  }, [jugadores, phase]);

  function handleJoined(id: string, nombre: string) {
    setJugadorId(id);
    try {
      localStorage.setItem(`ruleta_jugador_${sala.codigo}`, JSON.stringify({ id, nombre }));
    } catch {
      // localStorage no disponible
    }
  }

  async function handleStart() {
    setStarting(true);
    setStartError(null);
    const res = await fetch(`/api/ruleta/${sala.codigo}/start`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStartError(data.error ?? "No se pudo iniciar");
    }
    setStarting(false);
  }

  async function handleSpin() {
    if (!jugadorId) return;
    await fetch(`/api/ruleta/${sala.codigo}/spin`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jugador_id: jugadorId }),
    });
  }

  async function handleGuess(letra: string) {
    if (!jugadorId) return;
    const isVowel = "AEIOU".includes(letra);
    await fetch(`/api/ruleta/${sala.codigo}/${isVowel ? "guess-vowel" : "guess-consonant"}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jugador_id: jugadorId, letra }),
    });
  }

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!jugadorId || !resolveText.trim()) return;
    await fetch(`/api/ruleta/${sala.codigo}/resolve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jugador_id: jugadorId, respuesta: resolveText.trim() }),
    });
    setResolveText("");
  }

  async function handleTimeout() {
    await fetch(`/api/ruleta/${sala.codigo}/timeout`, { method: "POST" });
  }

  async function handleNextRound() {
    setAdvancing(true);
    await fetch(`/api/ruleta/${sala.codigo}/next-round`, { method: "POST" });
    setAdvancing(false);
  }

  const misTurno = jugadorId !== null && round?.turnoJugadorId === jugadorId;
  const miPuntaje = jugadores.find((j) => j.id === jugadorId)?.puntos ?? 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-[480px] mx-auto flex-1 flex flex-col px-4 py-5 gap-4">
        <header className="flex items-center justify-between">
          <Link href="/ruleta" className="text-lg font-bold" style={{ color: "var(--color-primary)" }}>La Ruleta</Link>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-sm font-bold"
            style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.25)", color: "var(--color-primary)" }}
          >
            <Hash size={13} />
            {sala.codigo}
          </div>
        </header>

        {phase === "finished" ? (
          <MatchEndScreen jugadores={jugadores} />
        ) : isHost && phase === "lobby" ? (
          <HostLobby codigo={sala.codigo} jugadores={jugadores} onStart={handleStart} starting={starting} error={startError} />
        ) : !isHost && !jugadorId ? (
          <JoinForm codigo={sala.codigo} onJoined={handleJoined} />
        ) : phase === "lobby" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-primary)" }} />
            <p className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>Esperando que el anfitrión inicie...</p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{jugadores.length} jugadores en la sala</p>
          </div>
        ) : round && (phase === "playing" || phase === "ronda_fin") ? (
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
                Ronda {round.ronda} de {round.totalRondas} — {round.categoria}
              </p>
              <TurnTimer endsAt={phase === "playing" ? round.turnoTerminaEn : null} onExpire={handleTimeout} />
            </div>

            <p className="text-sm text-center" style={{ color: "var(--color-text)" }}>{round.mensaje}</p>

            {phase === "ronda_fin" ? (
              <RoundBanner
                frase={round.frase ?? ""}
                ganador={jugadores.find((j) => j.id === round.turnoJugadorId) ?? null}
                isHost={isHost}
                isLastRound={round.ronda >= round.totalRondas}
                onNext={handleNextRound}
                advancing={advancing}
              />
            ) : (
              <>
                <Wheel
                  spinToSegment={round.spinToSegment}
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
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm exec tsc --noEmit
```
Expected: no errors anywhere in `src/components/ruleta/` or `src/app/**/ruleta/**` (this is also when Task 15's page finally typechecks clean).

- [ ] **Step 3: Commit**

```bash
git add src/components/ruleta/RuletaRoom.tsx
git commit -m "Add RuletaRoom realtime orchestrator"
```

---

### Task 21: Entry point + full verification

**Files:**
- Modify: `src/app/(public)/juegos/page.tsx`

- [ ] **Step 1: Read the current juegos list**

```bash
grep -n "ruleta\|href:" "src/app/(public)/juegos/page.tsx"
```

Find the existing static-HTML ruleta card entry (from the earlier session: `href: "/juegos/ruleta-elimlldm.html"`) and add a new card right after it pointing at `/ruleta`, following whatever data-shape that file already uses for its cards (an array of `{ title, description, href, className }` objects rendered by a shared `<GameCard>`-style block — read enough of the file to match the existing entry's exact shape before adding a new one; do not guess field names).

- [ ] **Step 2: Add the new card**

Add an object to that same array (mirroring the existing ruleta entry's fields) with:
- title: `"La Ruleta en línea"`
- description: something like `"Juega con hasta 6 amigos, cada quien desde su celular"`
- href: `"/ruleta"`
- (keep whatever other fields — icon, className, etc. — the existing entries use, copying the pattern rather than inventing new ones)

- [ ] **Step 3: Verify**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/(public)/juegos/page.tsx"
git commit -m "Link online Ruleta from the juegos page"
```

- [ ] **Step 5: Full build**

```bash
pnpm build
```
Expected: build succeeds with no type errors and no missing-module errors across every file this plan touched.

- [ ] **Step 6: Manual end-to-end verification (two browser tabs/profiles)**

1. Run the migration from Task 1 against the real Supabase project if not already done.
2. `pnpm dev`, log in as yourself in Tab A, go to `/ruleta/nueva`, create a room with 2 rounds (fast to test), land on `/ruleta/{codigo}` as host — confirm the code and empty lobby show.
3. Open Tab B in a private/incognito window (no session), go to `/ruleta`, enter the code, join with a name — confirm Tab A's lobby updates to show the new player **and plays the join chime** (listen for it, or check `getJugadorCount` visually going from 0→1).
4. Open Tab C the same way, join with a second name — confirm 2 players show in Tab A.
5. In Tab A (host), click "Iniciar juego" — confirm all three tabs transition to the game screen with the same category and an empty board.
6. In whichever tab is the active player (per the scoreboard's highlighted card), click "Girar la ruleta" — confirm **all three tabs'** wheels animate and land on the same segment/value, and the message bar agrees across tabs.
7. If it landed on points: guess a consonant that's in the phrase — confirm the board reveals it and the score updates identically in all three tabs, and the turn stays with the same player (new 15s timer visible).
8. Guess a consonant that's **not** in the phrase — confirm the turn passes to the next player (by join order) in all three tabs, and that tab's controls become interactive while the other two go read-only.
9. Let a turn's timer run out without acting — confirm the turn passes automatically within ~1s of hitting 0 (any tab may have triggered it; check the network tab if unsure).
10. From the new active player, buy a vowel that's in the phrase — confirm points deducted, no round-shift, and the previously-used-but-still-false `puede_consonante` correctly keeps consonant buttons disabled for that player if they'd already guessed a consonant this turn.
11. Use "Resolver panel" with the correct phrase from the active player — confirm the round-end banner appears in all three tabs with the revealed phrase and +500 to that player, and that only the host tab shows a "Siguiente ronda" button.
12. Click "Siguiente ronda" as host — confirm a new category/empty board loads in all tabs and the turn stayed with the round's winner.
13. Repeat until the configured round count is reached — confirm all tabs show the match-end podium with confetti, sorted by score.
14. Re-open Tab B/C's URL fresh (simulating a refresh) — confirm `localStorage`-restored `jugador_id` still lets them act on their next turn without re-joining.

If any step fails, fix the specific route/component involved and re-run `pnpm exec tsc --noEmit` before retrying the manual flow — don't move on with a known-broken step.

---

## Self-Review Notes

- **Spec coverage:** access (room code, no account to join) → Tasks 5, 13, 16; host-only auth to create → Tasks 4, 14; 2–6 players → `MIN_PLAYERS`/`MAX_PLAYERS` enforced in Tasks 5, 6, 16; join sound → Task 16 (`sound.client.ts`) wired in Task 20; host manually starts → Task 6 + `HostLobby`; each player spins/guesses on their own turn, others read-only → `misTurno` gating throughout `RuletaRoom.tsx` (Task 20) and every API route's `turno_jugador_id` check (Tasks 7–11); wheel label fix + dividers ported → Task 17; secret phrase never sent to clients before round end → `ruleta_rondas` has no public grants (Task 1) and every broadcast payload sends only `board`/`letrasProbadas`, never `frase`, until `resuelto: true` (Tasks 6–12).
- **Type consistency check:** `jugador_id`/`letra`/`respuesta` request bodies match across Tasks 7–11; `RoundState` fields in `RuletaRoom.tsx` (Task 20) match the broadcast payload shapes emitted by Tasks 6–12 (`board`, `letrasProbadas`, `turnoJugadorId`, `turnoTerminaEn`, `resuelto`, `frase`, `mensaje`); `nextJugadorId`/`buildBoardShape`/`countLetterInPhrase`/`isPhraseSolved`/`allLettersInPhrase` signatures from Task 3 are used identically in Tasks 7–12.
- **Placeholder scan:** none — every step has real, complete code; the puzzle catalog in Task 3 is a real subset of existing content, not filler.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-26-ruleta-online.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

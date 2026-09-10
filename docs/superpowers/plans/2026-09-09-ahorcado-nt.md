# Ahorcado del Nuevo Testamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new individual (single-player) game to `/juegos`: a Hangman ("Ahorcado") whose word bank is limited to the New Testament — characters, places, key concepts, and books — with an admin-editable word bank and a shared, reusable ranking table for future single-player games.

**Architecture:** Two new tables. `ahorcado_palabras` holds the word bank and is deliberately **not** publicly readable (no `SELECT` policy for `anon`/`authenticated`) — only `admin` (via RLS) and the game's own API route (via the service-role client) can read it, so the full bank can never be scraped in one REST call. `juego_individual_rankings` is a generic `game_key`-keyed table (same shape as `game_rankings` in the sibling `tdv-llm` project) so future single-player games reuse it instead of getting their own table. The game itself is a client component that fetches one word at a time from a server route, plays out standard Hangman rules (6 lives), and posts the result to a ranking route that upserts only when the score improves. Everything else — page, hub card, admin CRUD — follows patterns already established in this repo (`/ruleta`, `/admin/question-sets`, `TablaPosiciones`).

**Tech Stack:** Same as the rest of the repo — Next.js App Router, TypeScript, Supabase (Postgres + RLS), no new dependencies. No test runner is configured in this project (confirmed: no `vitest`/`*.test.ts` anywhere) — verification is `./node_modules/.bin/tsc --noEmit` plus a final manual/browser end-to-end pass, matching how every prior game feature in this repo (Arena Abierta, Ruleta, etc.) was verified.

**Design spec:** `docs/superpowers/specs/2026-09-09-ahorcado-nt-design.md` — read it for the decisions behind this plan.

**Existing code this reuses (read, do not modify unless a task says so):**
- `src/lib/supabase/server.ts` — `createClient()` (cookie-bound, respects RLS), `createServiceClient()` (service role, bypasses RLS — comment in the file explains why cookies must never be passed to it), `getProfile()`.
- `src/components/juegos/TablaPosiciones.tsx` — reused (with two new optional props added in Task 3) for the Ahorcado top-5, exactly like it's already reused for Arena Abierta/Ruleta.
- `src/types/index.ts` — `FilaPosicion` reused as-is (Task 3 only *adds* new types, doesn't change this one).
- `src/components/admin/RoleSelect.tsx` — the auto-submit-on-change pattern this plan copies for the `activo` checkbox in Task 10 (and the exact bug it was written to avoid: a separate "apply" button nobody notices).
- `src/app/admin/question-sets/[id]/page.tsx` / `QuestionForm.tsx` — the inline Server Action + form pattern this plan copies for `/admin/ahorcado`.

---

### Task 1: Migration — schema

**Files:**
- Create: `supabase/migrations/0034_ahorcado_nt.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Elim LLDM — Ahorcado del Nuevo Testamento
--
-- Primer juego individual (un jugador, sin sala) del hub /juegos. Dos
-- tablas nuevas:
--
-- 1. ahorcado_palabras — el banco de palabras. A diferencia de casi
--    cualquier otra tabla del proyecto, NO tiene ninguna policy de SELECT
--    para anon/authenticated: nadie puede leer el banco completo por REST.
--    Solo admin (gestión desde /admin/ahorcado) y el service role (la
--    ruta de juego, que entrega una palabra a la vez) pueden leerla.
--
-- 2. juego_individual_rankings — genérica, con game_key, para no crear
--    una tabla nueva cada vez que se agregue otro juego de un jugador.
--    Mismo rol que game_rankings en el proyecto hermano tdv-llm.
-- ============================================================

CREATE TABLE ahorcado_palabras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  palabra TEXT NOT NULL CHECK (palabra ~ '^[A-ZÑ ]+$'),
  categoria TEXT NOT NULL CHECK (categoria IN ('personaje', 'lugar', 'concepto', 'libro')),
  pista TEXT NOT NULL,
  referencia_biblica TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ahorcado_palabras_activo ON ahorcado_palabras (activo) WHERE activo = TRUE;

ALTER TABLE ahorcado_palabras ENABLE ROW LEVEL SECURITY;

-- Sin policy de SELECT para anon/authenticated a propósito (ver comentario
-- arriba). Solo admin tiene acceso total, para que /admin/ahorcado
-- funcione con el cliente normal de sesión (createClient()).
CREATE POLICY "ahorcado_palabras_admin_all" ON ahorcado_palabras FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- GRANT a `authenticated` (no a `anon`): la policy de arriba ya filtra a
-- solo admin, pero sin este GRANT ni siquiera un admin autenticado podría
-- ejecutar la consulta — el gotcha de tablas nuevas ya documentado en este
-- proyecto (ver 0019_jugadores_en_linea_grants.sql). El juego en sí (no
-- admin) nunca toca esta tabla con este cliente — lee con el service role
-- desde /api/juegos/ahorcado/palabra-aleatoria, que bypasa RLS y GRANTs.
GRANT SELECT, INSERT, UPDATE ON ahorcado_palabras TO authenticated;


CREATE TABLE juego_individual_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_key TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_key, user_id)
);

CREATE INDEX idx_juego_individual_rankings_ranking
  ON juego_individual_rankings (game_key, score DESC);

ALTER TABLE juego_individual_rankings ENABLE ROW LEVEL SECURITY;

-- Lectura pública: /juegos es una página pública y el ranking es parte del
-- gancho para que un visitante se anime a crear cuenta (mismo motivo que
-- tabla_posiciones en 0029_tabla_posiciones.sql).
CREATE POLICY "juego_individual_rankings_select" ON juego_individual_rankings
  FOR SELECT USING (TRUE);

-- Cada quien solo puede escribir su propia fila — RLS ya alcanza para esto,
-- así que la ruta que guarda el ranking usa el cliente normal de sesión
-- (createClient()), no el service role.
CREATE POLICY "juego_individual_rankings_insert_own" ON juego_individual_rankings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "juego_individual_rankings_update_own" ON juego_individual_rankings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT ON juego_individual_rankings TO anon, authenticated;
GRANT INSERT, UPDATE ON juego_individual_rankings TO authenticated;
```

- [ ] **Step 2: Apply it to production**

This project's CLI is linked to the Supabase project (`supabase/.temp/project-ref` exists) and `supabase db push` has been confirmed in this repo (2026-09-09 session) to work for applying migrations — prefer it over hand-pasting into the SQL Editor. It is a production-database write, so **ask the human operator to explicitly confirm before running it** (a plain "continue" is not enough — get an explicit yes for this specific action, same bar as any other sensitive/production change):

```bash
supabase db push --linked
```

After it succeeds, verify both tables exist with:

```bash
supabase db diff --linked
```

Expected: no diff (the pushed migration matches the linked project's schema).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0034_ahorcado_nt.sql
git commit -m "Add ahorcado_palabras and juego_individual_rankings tables"
```

---

### Task 2: Migration — seed word bank

**Files:**
- Create: `supabase/migrations/0035_ahorcado_nt_seed.sql`

This is its own task, separate from Task 1's schema, so the word bank itself is independently reviewable — and because every later task (the game route, the components) depends on there being real rows to play with, this must land before Tasks 4-9.

- [ ] **Step 1: Write the seed migration**

```sql
-- ============================================================
-- Elim LLDM — Ahorcado del Nuevo Testamento: banco de palabras inicial
--
-- 72 palabras en los cuatro tipos acordados con el usuario: personajes,
-- lugares, conceptos/palabras clave, y libros del Nuevo Testamento. Todas
-- en mayúsculas sin acentos (para que coincidan letra por letra con el
-- teclado A-Z+Ñ del juego); la referencia bíblica sí puede llevar acentos
-- — es solo texto descriptivo que nunca se compara letra por letra.
-- ============================================================

-- PERSONAJES
INSERT INTO ahorcado_palabras (palabra, categoria, pista, referencia_biblica) VALUES
  ('JESUS', 'personaje', 'El Salvador, Hijo de Dios hecho hombre', 'Mateo 1:21'),
  ('PEDRO', 'personaje', 'Apóstol a quien Jesús llamó "la roca"', 'Mateo 16:18'),
  ('PABLO', 'personaje', 'Apóstol de los gentiles, antes llamado Saulo', 'Hechos 13:9'),
  ('JUAN', 'personaje', 'El discípulo amado, autor del cuarto evangelio', 'Juan 21:20'),
  ('MATEO', 'personaje', 'Recaudador de impuestos llamado a seguir a Jesús', 'Mateo 9:9'),
  ('MARIA', 'personaje', 'Madre de Jesús', 'Lucas 1:31'),
  ('MARTA', 'personaje', 'Hermana de Lázaro, se afanaba sirviendo', 'Lucas 10:40'),
  ('LAZARO', 'personaje', 'Amigo de Jesús a quien resucitó de entre los muertos', 'Juan 11:43'),
  ('JUDAS', 'personaje', 'El discípulo que traicionó a Jesús por treinta monedas de plata', 'Mateo 26:15'),
  ('TOMAS', 'personaje', 'El discípulo que dudó hasta ver las llagas de Jesús', 'Juan 20:27'),
  ('ESTEBAN', 'personaje', 'Primer mártir cristiano, apedreado por su fe', 'Hechos 7:59'),
  ('BARNABAS', 'personaje', 'Compañero de misión de Pablo, llamado hijo de consolación', 'Hechos 4:36'),
  ('TIMOTEO', 'personaje', 'Joven discípulo de Pablo, destinatario de dos epístolas', '1 Timoteo 1:2'),
  ('HERODES', 'personaje', 'Rey que mandó matar a los niños de Belén', 'Mateo 2:16'),
  ('ZAQUEO', 'personaje', 'Jefe de publicanos que subió a un árbol para ver a Jesús', 'Lucas 19:4'),
  ('NICODEMO', 'personaje', 'Fariseo que visitó a Jesús de noche', 'Juan 3:2'),
  ('ANDRES', 'personaje', 'Hermano de Simón Pedro, de los primeros en seguir a Jesús', 'Juan 1:40'),
  ('FELIPE', 'personaje', 'Discípulo que llevó a Natanael a conocer a Jesús', 'Juan 1:45'),
  ('MAGDALENA', 'personaje', 'Apellido de la María que fue la primera en ver a Jesús resucitado', 'Juan 20:16');

-- LUGARES
INSERT INTO ahorcado_palabras (palabra, categoria, pista, referencia_biblica) VALUES
  ('BELEN', 'lugar', 'Ciudad donde nació Jesús', 'Mateo 2:1'),
  ('NAZARET', 'lugar', 'Pueblo donde Jesús creció', 'Lucas 2:39'),
  ('GALILEA', 'lugar', 'Región donde Jesús inició su ministerio', 'Mateo 4:12'),
  ('JERUSALEN', 'lugar', 'Ciudad santa, sede del templo judío', 'Lucas 2:22'),
  ('JORDAN', 'lugar', 'Río donde Juan bautizó a Jesús', 'Mateo 3:13'),
  ('CAFARNAUM', 'lugar', 'Ciudad junto al mar de Galilea donde Jesús vivió', 'Mateo 4:13'),
  ('SAMARIA', 'lugar', 'Región donde Jesús habló con una mujer junto a un pozo', 'Juan 4:7'),
  ('CORINTO', 'lugar', 'Ciudad griega a la que Pablo escribió dos epístolas', '1 Corintios 1:2'),
  ('EFESO', 'lugar', 'Ciudad donde Pablo predicó por tres años', 'Hechos 20:31'),
  ('ANTIOQUIA', 'lugar', 'Ciudad donde los discípulos fueron llamados cristianos por primera vez', 'Hechos 11:26'),
  ('DAMASCO', 'lugar', 'Camino donde Saulo se convirtió al ver una luz del cielo', 'Hechos 9:3'),
  ('GETSEMANI', 'lugar', 'Huerto donde Jesús oró antes de ser arrestado', 'Mateo 26:36'),
  ('GOLGOTA', 'lugar', 'Lugar de la calavera donde Jesús fue crucificado', 'Juan 19:17'),
  ('PATMOS', 'lugar', 'Isla donde el apóstol Juan recibió la revelación', 'Apocalipsis 1:9'),
  ('EMAUS', 'lugar', 'Pueblo donde dos discípulos reconocieron a Jesús resucitado al partir el pan', 'Lucas 24:13'),
  ('CANA', 'lugar', 'Pueblo donde Jesús convirtió el agua en vino, su primer milagro', 'Juan 2:1');

-- CONCEPTOS / PALABRAS CLAVE
INSERT INTO ahorcado_palabras (palabra, categoria, pista, referencia_biblica) VALUES
  ('FE', 'concepto', 'Certeza de lo que se espera, convicción de lo que no se ve', 'Hebreos 11:1'),
  ('GRACIA', 'concepto', 'Favor inmerecido de Dios hacia el hombre', 'Efesios 2:8'),
  ('AMOR', 'concepto', 'El mayor de los dones, según Pablo', '1 Corintios 13:13'),
  ('SALVACION', 'concepto', 'Liberación del pecado por medio de Jesucristo', 'Hechos 4:12'),
  ('EVANGELIO', 'concepto', 'Las buenas nuevas de Jesucristo', 'Marcos 1:1'),
  ('RESURRECCION', 'concepto', 'Volver a la vida después de la muerte, como Jesús al tercer día', '1 Corintios 15:20'),
  ('BAUTISMO', 'concepto', 'Rito en el nombre del Padre, el Hijo y el Espíritu Santo', 'Mateo 28:19'),
  ('PERDON', 'concepto', 'Dejar libre de culpa a quien nos ofende', 'Mateo 6:14'),
  ('ARREPENTIMIENTO', 'concepto', 'Cambio de mente y de corazón hacia Dios', 'Hechos 3:19'),
  ('DISCIPULO', 'concepto', 'Seguidor y aprendiz de Jesús', 'Juan 8:31'),
  ('PARABOLA', 'concepto', 'Historia sencilla con un significado espiritual profundo', 'Mateo 13:3'),
  ('MILAGRO', 'concepto', 'Hecho sobrenatural que revela el poder de Dios', 'Juan 2:11'),
  ('CRUZ', 'concepto', 'Instrumento de tortura romano donde murió Jesús', 'Filipenses 2:8'),
  ('PENTECOSTES', 'concepto', 'Día en que el Espíritu Santo descendió sobre los apóstoles', 'Hechos 2:1'),
  ('IGLESIA', 'concepto', 'Comunidad de creyentes, cuerpo de Cristo', 'Efesios 1:22'),
  ('ORACION', 'concepto', 'Hablar con Dios', '1 Tesalonicenses 5:17'),
  ('ANGEL', 'concepto', 'Mensajero de Dios', 'Lucas 1:26'),
  ('TEMPLO', 'concepto', 'Casa de oración', 'Mateo 21:13'),
  ('PROFECIA', 'concepto', 'Palabra inspirada por Dios que anuncia lo por venir', '2 Pedro 1:21');

-- LIBROS DEL NUEVO TESTAMENTO
INSERT INTO ahorcado_palabras (palabra, categoria, pista, referencia_biblica) VALUES
  ('MATEO', 'libro', 'Primer evangelio, escrito pensando en el pueblo judío', 'Mateo 5:3'),
  ('MARCOS', 'libro', 'El evangelio más corto, de acción rápida', 'Marcos 16:15'),
  ('LUCAS', 'libro', 'Evangelio escrito por un médico, dirigido a Teófilo', 'Lucas 1:3'),
  ('JUAN', 'libro', 'Evangelio que llama a Jesús "el Verbo hecho carne"', 'Juan 1:14'),
  ('HECHOS', 'libro', 'Narra el nacimiento de la iglesia y los viajes de Pablo', 'Hechos 1:8'),
  ('ROMANOS', 'libro', 'Epístola de Pablo sobre la justificación por la fe', 'Romanos 1:17'),
  ('CORINTIOS', 'libro', 'Epístolas de Pablo a una iglesia dividida por disputas', '1 Corintios 1:10'),
  ('GALATAS', 'libro', 'Epístola sobre la libertad en Cristo, no bajo la ley', 'Gálatas 5:1'),
  ('EFESIOS', 'libro', 'Epístola sobre la unidad de la iglesia como cuerpo de Cristo', 'Efesios 4:4'),
  ('FILIPENSES', 'libro', 'Epístola del gozo, escrita desde la prisión', 'Filipenses 4:4'),
  ('COLOSENSES', 'libro', 'Epístola que exalta la supremacía de Cristo', 'Colosenses 1:15'),
  ('TESALONICENSES', 'libro', 'Epístolas sobre la segunda venida de Cristo', '1 Tesalonicenses 4:16'),
  ('TIMOTEO', 'libro', 'Epístolas pastorales de Pablo a un joven líder de la iglesia', '1 Timoteo 4:12'),
  ('TITO', 'libro', 'Epístola pastoral sobre el orden en la iglesia de Creta', 'Tito 1:5'),
  ('FILEMON', 'libro', 'Carta personal de Pablo pidiendo perdón para un esclavo fugitivo', 'Filemón 1:10'),
  ('HEBREOS', 'libro', 'Epístola que compara a Cristo con el sacerdocio antiguo', 'Hebreos 4:14'),
  ('SANTIAGO', 'libro', 'Epístola práctica: "la fe sin obras es muerta"', 'Santiago 2:26'),
  ('APOCALIPSIS', 'libro', 'Último libro de la Biblia, revelación dada a Juan en Patmos', 'Apocalipsis 1:1');
```

(`JUAN` and `TIMOTEO` each appear twice — once as a person, once as the book named after them. This is intentional, not a duplicate bug: the `categoria` and `pista` differ, and it's a small, real teaching point about how the NT is structured. No `UNIQUE` constraint on `palabra` exists, so this is allowed by design.)

- [ ] **Step 2: Apply it to production**

Same as Task 1 — ask the human operator to explicitly confirm, then:

```bash
supabase db push --linked
```

Verify with:

```bash
supabase db diff --linked
```

Expected: no diff. Then spot-check the row count:

```bash
supabase db query --linked "SELECT categoria, count(*) FROM ahorcado_palabras GROUP BY categoria ORDER BY categoria;"
```

Expected: 4 rows — `concepto` 19, `libro` 18, `lugar` 16, `personaje` 19 (72 total).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0035_ahorcado_nt_seed.sql
git commit -m "Seed the New Testament Hangman word bank (72 words)"
```

---

### Task 3: Types, ranking helper, and `TablaPosiciones` extension

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/components/juegos/TablaPosiciones.tsx`
- Create: `src/lib/juegos/ranking-individual.server.ts`

- [ ] **Step 1: Add the new types**

Append to the end of `src/types/index.ts` (current file ends at line 358 with the `FilaPosicion` interface — leave that untouched, add after it):

```ts

export type AhorcadoCategoria = "personaje" | "lugar" | "concepto" | "libro";

export interface AhorcadoPalabra {
  id: string;
  palabra: string;
  categoria: AhorcadoCategoria;
  pista: string;
  referencia_biblica: string | null;
  activo: boolean;
  created_at: string;
}
```

- [ ] **Step 2: Add optional unit-label props to `TablaPosiciones`**

`TablaPosiciones` currently hardcodes the word "partida"/"partidas" for the second line of each row (fine for Arena Abierta/Ruleta, wrong for Ahorcado, where the count is "palabras ganadas" not "partidas"). Edit `src/components/juegos/TablaPosiciones.tsx`:

Change the props interface from:

```ts
interface TablaPosicionesProps {
  titulo: string;
  filas: FilaPosicion[];
  /** Miembro que está viendo la página, para resaltar su propia fila. null si no inició sesión. */
  currentUserId?: string | null;
  /** Texto cuando todavía no hay ninguna partida terminada de este juego. */
  vacio?: string;
}
```

to:

```ts
interface TablaPosicionesProps {
  titulo: string;
  filas: FilaPosicion[];
  /** Miembro que está viendo la página, para resaltar su propia fila. null si no inició sesión. */
  currentUserId?: string | null;
  /** Texto cuando todavía no hay ninguna partida terminada de este juego. */
  vacio?: string;
  /** Para juegos donde "partida" no aplica (ej. Ahorcado: "palabra"/"palabras"). */
  unidadSingular?: string;
  unidadPlural?: string;
}
```

Change the function signature from:

```ts
export function TablaPosiciones({
  titulo,
  filas,
  currentUserId,
  vacio = "Aún no hay partidas terminadas. ¡Sé el primero en aparecer aquí!",
}: TablaPosicionesProps) {
```

to:

```ts
export function TablaPosiciones({
  titulo,
  filas,
  currentUserId,
  vacio = "Aún no hay partidas terminadas. ¡Sé el primero en aparecer aquí!",
  unidadSingular = "partida",
  unidadPlural = "partidas",
}: TablaPosicionesProps) {
```

And change the rendering line from:

```tsx
                  <span className="text-[10px] leading-tight" style={{ color: "var(--color-text-muted)" }}>
                    {fila.partidas} {fila.partidas === 1 ? "partida" : "partidas"}
                  </span>
```

to:

```tsx
                  <span className="text-[10px] leading-tight" style={{ color: "var(--color-text-muted)" }}>
                    {fila.partidas} {fila.partidas === 1 ? unidadSingular : unidadPlural}
                  </span>
```

Every existing caller (`/juegos/page.tsx`, calling it twice for Arena Abierta and Ruleta) keeps working unchanged since the two new props have defaults.

- [ ] **Step 3: Write the ranking helper**

```ts
// src/lib/juegos/ranking-individual.server.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FilaPosicion } from "@/types";

/**
 * Top N de un juego individual (un jugador, sin sala), leído de
 * juego_individual_rankings (0034_ahorcado_nt.sql) — la contraparte de
 * getTablaPosiciones() para juegos de sala en vivo (tabla_posiciones).
 *
 * Usa el cliente anónimo a propósito: la tabla tiene SELECT público (ver
 * migración), así que un visitante sin cuenta también ve el ranking.
 *
 * `partidas` en el resultado en realidad es "palabras ganadas" (o lo que
 * cada juego individual futuro decida guardar en metadata) — el llamador
 * rotula la unidad correcta vía las props unidadSingular/unidadPlural de
 * TablaPosiciones (ver Task 3, Step 2).
 */
export async function getRankingIndividual(
  gameKey: string,
  limite = 5
): Promise<FilaPosicion[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("juego_individual_rankings")
    .select("user_id, score, metadata, profiles(display_name, avatar_url)")
    .eq("game_key", gameKey)
    .order("score", { ascending: false })
    .order("updated_at", { ascending: true })
    .limit(limite);

  // Falla en silencio a lista vacía: esto pinta una tarjeta secundaria del
  // hub de /juegos — no debe tirar la página entera si el ranking no se
  // pudo leer (mismo criterio que getTablaPosiciones).
  if (error) {
    console.error("[ranking-individual] no se pudo leer el ranking:", error.message);
    return [];
  }

  return (
    (data ?? []) as unknown as Array<{
      user_id: string;
      score: number;
      metadata: { palabras_ganadas?: number } | null;
      profiles: { display_name: string; avatar_url: string | null } | null;
    }>
  ).map((fila) => ({
    user_id: fila.user_id,
    nombre: fila.profiles?.display_name ?? "Jugador",
    avatar_url: fila.profiles?.avatar_url ?? null,
    puntos_totales: fila.score,
    partidas: fila.metadata?.palabras_ganadas ?? 0,
  }));
}
```

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/components/juegos/TablaPosiciones.tsx src/lib/juegos/ranking-individual.server.ts
git commit -m "Add ranking-individual helper and generalize TablaPosiciones unit labels"
```

---

### Task 4: API route — random word

**Files:**
- Create: `src/app/api/juegos/ahorcado/palabra-aleatoria/route.ts`

- [ ] **Step 1: Write the route**

```ts
// src/app/api/juegos/ahorcado/palabra-aleatoria/route.ts
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { AhorcadoPalabra } from "@/types";

// Usa el service role a propósito: ahorcado_palabras no tiene ninguna
// policy de SELECT pública (ver 0034_ahorcado_nt.sql), así que un cliente
// normal de sesión no podría leer ni una fila aquí. La ruta sí exige sesión
// (ver chequeo abajo) para no dejar que un visitante sin cuenta raspe el
// banco pidiendo esta ruta en bucle.
export async function GET() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para jugar" }, { status: 401 });
  }

  const service = await createServiceClient();
  const { data, error } = await service
    .from("ahorcado_palabras")
    .select("id, palabra, categoria, pista, referencia_biblica")
    .eq("activo", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const palabras = (data ?? []) as Pick<
    AhorcadoPalabra,
    "id" | "palabra" | "categoria" | "pista" | "referencia_biblica"
  >[];

  if (palabras.length === 0) {
    return NextResponse.json({ error: "No hay palabras activas en el banco" }, { status: 500 });
  }

  const elegida = palabras[Math.floor(Math.random() * palabras.length)];
  return NextResponse.json(elegida);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/juegos/ahorcado/palabra-aleatoria/route.ts
git commit -m "Add the random-word API route for Ahorcado"
```

---

### Task 5: API route — save ranking

**Files:**
- Create: `src/app/api/juegos/ahorcado/ranking/route.ts`

- [ ] **Step 1: Write the route**

```ts
// src/app/api/juegos/ahorcado/ranking/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GAME_KEY = "ahorcado";

// Usa el cliente normal de sesión (no service role): la RLS de
// juego_individual_rankings ya restringe cada quien a su propia fila
// (auth.uid() = user_id), que es exactamente la regla que necesitamos —
// no hace falta bypasarla.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para guardar tu puntaje" }, { status: 401 });
  }

  let body: { score?: number; palabras_ganadas?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const score = Math.round(body.score ?? NaN);
  const palabrasGanadas = Math.round(body.palabras_ganadas ?? NaN);

  if (!Number.isFinite(score) || score < 0 || !Number.isFinite(palabrasGanadas) || palabrasGanadas < 0) {
    return NextResponse.json(
      { error: "score y palabras_ganadas deben ser números válidos" },
      { status: 400 }
    );
  }

  const { data: existente, error: errorConsulta } = await supabase
    .from("juego_individual_rankings")
    .select("id, score")
    .eq("game_key", GAME_KEY)
    .eq("user_id", user.id)
    .maybeSingle();

  if (errorConsulta) {
    return NextResponse.json({ error: errorConsulta.message }, { status: 500 });
  }

  if (!existente) {
    const { error } = await supabase.from("juego_individual_rankings").insert({
      game_key: GAME_KEY,
      user_id: user.id,
      score,
      metadata: { palabras_ganadas: palabrasGanadas },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ guardado: true, mejorado: true });
  }

  if (score <= existente.score) {
    return NextResponse.json({ guardado: false, mejorado: false });
  }

  const { error } = await supabase
    .from("juego_individual_rankings")
    .update({
      score,
      metadata: { palabras_ganadas: palabrasGanadas },
      updated_at: new Date().toISOString(),
    })
    .eq("id", existente.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ guardado: true, mejorado: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/juegos/ahorcado/ranking/route.ts
git commit -m "Add the ranking-save API route for Ahorcado"
```

---

### Task 6: Game subcomponents (drawing, keyboard, clue)

**Files:**
- Create: `src/components/juegos/ahorcado/AhorcadoDibujo.tsx`
- Create: `src/components/juegos/ahorcado/AhorcadoTeclado.tsx`
- Create: `src/components/juegos/ahorcado/AhorcadoPista.tsx`

Split into three small files (instead of one big component) to respect this repo's "one component per file, max 300 lines" rule (`CLAUDE.md` § Reglas No Negociables #4) once Task 7's orchestrator is added on top.

- [ ] **Step 1: Write `AhorcadoDibujo.tsx`**

```tsx
// src/components/juegos/ahorcado/AhorcadoDibujo.tsx
interface AhorcadoDibujoProps {
  errores: number;
}

// Colores literales (no var(--color-*)) a propósito: no hay precedente en
// este repo de CSS custom properties dentro de atributos SVG (stroke/fill),
// así que se usa el hex directo del design system para no depender de un
// comportamiento de navegador sin verificar aquí.
const PARTES = [
  <circle key="cabeza" cx="140" cy="60" r="20" stroke="#F8F8FF" strokeWidth="3" fill="none" />,
  <line key="cuerpo" x1="140" y1="80" x2="140" y2="130" stroke="#F8F8FF" strokeWidth="3" />,
  <line key="brazo-izq" x1="140" y1="90" x2="120" y2="110" stroke="#F8F8FF" strokeWidth="3" />,
  <line key="brazo-der" x1="140" y1="90" x2="160" y2="110" stroke="#F8F8FF" strokeWidth="3" />,
  <line key="pierna-izq" x1="140" y1="130" x2="120" y2="160" stroke="#F8F8FF" strokeWidth="3" />,
  <line key="pierna-der" x1="140" y1="130" x2="160" y2="160" stroke="#F8F8FF" strokeWidth="3" />,
];

/** El muñeco se dibuja pieza por pieza, una por cada error — 6 errores = ahorcado completo. */
export function AhorcadoDibujo({ errores }: AhorcadoDibujoProps) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
    >
      <svg viewBox="0 0 200 200" className="w-full h-56">
        <line x1="20" y1="180" x2="100" y2="180" stroke="#D4A017" strokeWidth="3" />
        <line x1="40" y1="180" x2="40" y2="20" stroke="#D4A017" strokeWidth="3" />
        <line x1="40" y1="20" x2="140" y2="20" stroke="#D4A017" strokeWidth="3" />
        <line x1="140" y1="20" x2="140" y2="40" stroke="#D4A017" strokeWidth="3" />
        {PARTES.slice(0, errores)}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Write `AhorcadoTeclado.tsx`**

```tsx
// src/components/juegos/ahorcado/AhorcadoTeclado.tsx
const LETRAS = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");

interface AhorcadoTecladoProps {
  palabra: string;
  letrasAdivinadas: string[];
  disabled: boolean;
  onLetra: (letra: string) => void;
}

export function AhorcadoTeclado({ palabra, letrasAdivinadas, disabled, onLetra }: AhorcadoTecladoProps) {
  return (
    <div className="grid grid-cols-7 sm:grid-cols-9 gap-2">
      {LETRAS.map((letra) => {
        const yaUsada = letrasAdivinadas.includes(letra);
        const esCorrecta = palabra.includes(letra);

        return (
          <button
            key={letra}
            type="button"
            onClick={() => onLetra(letra)}
            disabled={yaUsada || disabled}
            className="h-11 rounded-xl text-sm font-bold"
            style={{
              background: yaUsada
                ? esCorrecta
                  ? "rgba(74,222,128,0.15)"
                  : "rgba(248,113,113,0.15)"
                : "var(--color-surface-elevated)",
              border: `1px solid ${
                yaUsada
                  ? esCorrecta
                    ? "rgba(74,222,128,0.4)"
                    : "rgba(248,113,113,0.4)"
                  : "var(--color-border)"
              }`,
              color: yaUsada
                ? esCorrecta
                  ? "var(--color-success)"
                  : "var(--color-destructive)"
                : "var(--color-text)",
              opacity: yaUsada || disabled ? 0.7 : 1,
            }}
          >
            {letra}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Write `AhorcadoPista.tsx`**

```tsx
// src/components/juegos/ahorcado/AhorcadoPista.tsx
import { Lightbulb } from "lucide-react";
import type { AhorcadoCategoria } from "@/types";

const ETIQUETAS_CATEGORIA: Record<AhorcadoCategoria, string> = {
  personaje: "Personaje bíblico",
  lugar: "Lugar",
  concepto: "Palabra clave",
  libro: "Libro del Nuevo Testamento",
};

interface AhorcadoPistaProps {
  palabra: string;
  categoria: AhorcadoCategoria;
  pista: string;
  referenciaBiblica: string | null;
  letrasAdivinadas: string[];
}

export function AhorcadoPista({
  palabra,
  categoria,
  pista,
  referenciaBiblica,
  letrasAdivinadas,
}: AhorcadoPistaProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div
          className="rounded-2xl p-2 shrink-0"
          style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}
        >
          <Lightbulb size={18} style={{ color: "var(--color-primary)" }} />
        </div>
        <div>
          <span
            className="inline-block text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mb-1.5"
            style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-muted)" }}
          >
            {ETIQUETAS_CATEGORIA[categoria]}
          </span>
          <p className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
            {pista}
          </p>
          {referenciaBiblica && (
            <p className="text-xs mt-1" style={{ color: "var(--color-primary)" }}>
              {referenciaBiblica}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {palabra.split("").map((letra, index) =>
          letra === " " ? (
            <div key={index} className="w-4" />
          ) : (
            <div
              key={index}
              className="w-10 h-14 flex items-center justify-center rounded-xl"
              style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
            >
              <span className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
                {letrasAdivinadas.includes(letra) ? letra : "_"}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/juegos/ahorcado/AhorcadoDibujo.tsx src/components/juegos/ahorcado/AhorcadoTeclado.tsx src/components/juegos/ahorcado/AhorcadoPista.tsx
git commit -m "Add Ahorcado's drawing, keyboard, and clue subcomponents"
```

---

### Task 7: `AhorcadoGame.tsx` — the orchestrator

**Files:**
- Create: `src/components/juegos/ahorcado/AhorcadoGame.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/juegos/ahorcado/AhorcadoGame.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Trophy, Heart, RotateCcw } from "lucide-react";
import { AhorcadoDibujo } from "./AhorcadoDibujo";
import { AhorcadoTeclado } from "./AhorcadoTeclado";
import { AhorcadoPista } from "./AhorcadoPista";
import type { AhorcadoCategoria } from "@/types";

const VIDAS_INICIALES = 6;

interface Palabra {
  id: string;
  palabra: string;
  categoria: AhorcadoCategoria;
  pista: string;
  referencia_biblica: string | null;
}

export function AhorcadoGame() {
  const [palabraActual, setPalabraActual] = useState<Palabra | null>(null);
  const [letrasAdivinadas, setLetrasAdivinadas] = useState<string[]>([]);
  const [intentosRestantes, setIntentosRestantes] = useState(VIDAS_INICIALES);
  const [puntuacion, setPuntuacion] = useState(0);
  const [palabrasGanadas, setPalabrasGanadas] = useState(0);
  const [juegoTerminado, setJuegoTerminado] = useState(false);
  const [ganado, setGanado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensajeRanking, setMensajeRanking] = useState("");

  const pedirPalabra = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/juegos/ahorcado/palabra-aleatoria");
      if (!res.ok) throw new Error("No se pudo cargar una palabra nueva.");
      const data = (await res.json()) as Palabra;
      setPalabraActual(data);
      setLetrasAdivinadas([]);
      setIntentosRestantes(VIDAS_INICIALES);
      setJuegoTerminado(false);
      setGanado(false);
      setMensajeRanking("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar una palabra nueva.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    pedirPalabra();
  }, [pedirPalabra]);

  async function guardarRanking(score: number, ganadas: number) {
    try {
      const res = await fetch("/api/juegos/ahorcado/ranking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, palabras_ganadas: ganadas }),
      });
      if (!res.ok) throw new Error("No se pudo guardar el ranking.");
      const data = (await res.json()) as { mejorado: boolean };
      setMensajeRanking(
        data.mejorado ? "¡Nuevo récord guardado!" : "Tu récord anterior sigue siendo mayor."
      );
    } catch (err) {
      setMensajeRanking(err instanceof Error ? err.message : "No se pudo guardar el ranking.");
    }
  }

  function manejarLetra(letra: string) {
    if (!palabraActual || juegoTerminado || letrasAdivinadas.includes(letra)) return;

    const nuevasLetras = [...letrasAdivinadas, letra];
    setLetrasAdivinadas(nuevasLetras);

    if (!palabraActual.palabra.includes(letra)) {
      const restantes = intentosRestantes - 1;
      setIntentosRestantes(restantes);
      if (restantes === 0) {
        setJuegoTerminado(true);
        setGanado(false);
      }
      return;
    }

    const completa = palabraActual.palabra
      .split("")
      .every((l) => l === " " || nuevasLetras.includes(l));

    if (completa) {
      const puntosGanados = intentosRestantes * 10;
      const nuevoScore = puntuacion + puntosGanados;
      const nuevasGanadas = palabrasGanadas + 1;

      setJuegoTerminado(true);
      setGanado(true);
      setPuntuacion(nuevoScore);
      setPalabrasGanadas(nuevasGanadas);
      guardarRanking(nuevoScore, nuevasGanadas);
    }
  }

  function reiniciar() {
    setPuntuacion(0);
    setPalabrasGanadas(0);
    pedirPalabra();
  }

  if (cargando && !palabraActual) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <p style={{ color: "var(--color-text-muted)" }}>Cargando...</p>
      </div>
    );
  }

  if (error && !palabraActual) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <p style={{ color: "var(--color-destructive)" }}>{error}</p>
      </div>
    );
  }

  if (!palabraActual) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-center gap-3 flex-wrap">
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Trophy size={16} style={{ color: "var(--color-primary)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {puntuacion} puntos
          </span>
        </div>
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Heart size={16} style={{ color: "var(--color-live)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {intentosRestantes} vidas
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <AhorcadoDibujo errores={VIDAS_INICIALES - intentosRestantes} />

        <div
          className="rounded-2xl p-5 flex flex-col gap-5"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <AhorcadoPista
            palabra={palabraActual.palabra}
            categoria={palabraActual.categoria}
            pista={palabraActual.pista}
            referenciaBiblica={palabraActual.referencia_biblica}
            letrasAdivinadas={letrasAdivinadas}
          />

          {juegoTerminado && (
            <div
              className="p-4 rounded-2xl text-center"
              style={{
                background: ganado ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
                border: `1px solid ${ganado ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}`,
              }}
            >
              {ganado ? (
                <>
                  <p className="font-bold text-lg mb-1" style={{ color: "var(--color-success)" }}>
                    ¡Ganaste!
                  </p>
                  <p className="text-sm" style={{ color: "var(--color-text)" }}>
                    +{intentosRestantes * 10} puntos
                  </p>
                  {mensajeRanking && (
                    <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
                      {mensajeRanking}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="font-bold text-lg mb-1" style={{ color: "var(--color-destructive)" }}>
                    Perdiste
                  </p>
                  <p className="text-sm" style={{ color: "var(--color-text)" }}>
                    La palabra era: <strong>{palabraActual.palabra}</strong>
                  </p>
                </>
              )}
              <button
                type="button"
                onClick={pedirPalabra}
                className="mt-3 px-4 py-2 rounded-xl text-sm font-bold"
                style={{ background: "var(--color-primary)", color: "#000" }}
              >
                Siguiente palabra
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        className="rounded-2xl p-5"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <AhorcadoTeclado
          palabra={palabraActual.palabra}
          letrasAdivinadas={letrasAdivinadas}
          disabled={juegoTerminado}
          onLetra={manejarLetra}
        />
      </div>

      <div className="text-center">
        <button
          type="button"
          onClick={reiniciar}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          <RotateCcw size={14} />
          Reiniciar juego
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/juegos/ahorcado/AhorcadoGame.tsx
git commit -m "Add the Ahorcado game orchestrator component"
```

---

### Task 8: The page

**Files:**
- Create: `src/app/(public)/juegos/ahorcado/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// src/app/(public)/juegos/ahorcado/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Puzzle } from "lucide-react";
import { getProfile } from "@/lib/supabase/server";
import { getRankingIndividual } from "@/lib/juegos/ranking-individual.server";
import { TablaPosiciones } from "@/components/juegos/TablaPosiciones";
import { AhorcadoGame } from "@/components/juegos/ahorcado/AhorcadoGame";

export const metadata: Metadata = {
  title: "Ahorcado del Nuevo Testamento — Elim LLDM",
  description:
    "Adivina personajes, lugares, palabras clave y libros del Nuevo Testamento, letra por letra.",
};

export default async function AhorcadoPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?returnUrl=/juegos/ahorcado");

  const ranking = await getRankingIndividual("ahorcado");

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div
        className="py-10 px-4"
        style={{
          background: "linear-gradient(to bottom, rgba(212,160,23,0.05) 0%, transparent 100%)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div className="max-w-4xl mx-auto flex flex-col items-center text-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}
          >
            <Puzzle size={28} style={{ color: "var(--color-primary)" }} />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--color-text)" }}>
              Ahorcado del Nuevo Testamento
            </h1>
            <p style={{ color: "var(--color-text-muted)" }}>Adivina la palabra letra por letra</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
        <AhorcadoGame />
        <TablaPosiciones
          titulo="Tabla de posiciones — Ahorcado del Nuevo Testamento"
          filas={ranking}
          currentUserId={profile.id}
          unidadSingular="palabra"
          unidadPlural="palabras"
          vacio="Aún nadie ha ganado una palabra. ¡Sé el primero!"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(public)/juegos/ahorcado/page.tsx"
git commit -m "Add the /juegos/ahorcado page"
```

---

### Task 9: Link it from the `/juegos` hub

**Files:**
- Modify: `src/app/(public)/juegos/page.tsx`

Re-read the actual current file before editing — it's reproduced here in full below (last touched for the presence-indicator feature, commit `1a794c4`) so the diff below is against real content, not a guess.

**Current content (126 lines):**

```tsx
import { Gamepad2, RotateCw, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { getEstadoPuertaArenaAbierta } from "@/lib/arena-publica/estado-puerta.server";
import { PuertaArenaAbierta } from "@/components/juegos/PuertaArenaAbierta";
import { getEstadoPuertaRuleta } from "@/lib/ruleta/estado-puerta.server";
import { PuertaRuleta } from "@/components/juegos/PuertaRuleta";
import { getTablaPosiciones } from "@/lib/juegos/tabla-posiciones.server";
import { TablaPosiciones } from "@/components/juegos/TablaPosiciones";
import { JuegosPresence } from "@/components/juegos/JuegosPresence";
import { getProfile, createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Juegos en línea — Elim LLDM",
  description: "Entra directo a jugar con otros miembros — sin códigos, sin esperar a nadie que organice.",
};

async function getGameKeysConNotificacion(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const supabase = await createClient();
  const { data } = await supabase
    .from("game_notify_subscriptions")
    .select("game_key")
    .eq("user_id", userId);
  return new Set((data ?? []).map((r) => (r as { game_key: string }).game_key));
}

export default async function JuegosHubPage() {
  // El perfil va primero porque la consulta de campanas activas necesita
  // su id — el resto sigue en paralelo detrás.
  const profile = await getProfile();

  const [estadoArenaAbierta, estadoRuleta, posicionesArena, posicionesRuleta, notificacionesActivas] =
    await Promise.all([
      getEstadoPuertaArenaAbierta(),
      getEstadoPuertaRuleta(),
      getTablaPosiciones("arena_abierta"),
      getTablaPosiciones("ruleta"),
      getGameKeysConNotificacion(profile?.id ?? null),
    ]);

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
        <JuegosPresence
          currentUser={profile ? { id: profile.id, nombre: profile.display_name } : null}
        />

        <div className="flex flex-col gap-3">
          <PuertaArenaAbierta
            disponible={estadoArenaAbierta.disponible}
            jugandoAhora={estadoArenaAbierta.jugandoAhora}
            esperando={estadoArenaAbierta.esperando}
            notificacionesActivas={notificacionesActivas.has("arena_abierta")}
          />
          <TablaPosiciones
            titulo="Tabla de posiciones — Trivia en línea"
            filas={posicionesArena}
            currentUserId={profile?.id ?? null}
          />
        </div>

        <div className="flex flex-col gap-3">
          <PuertaRuleta
            disponible={estadoRuleta.disponible}
            jugandoAhora={estadoRuleta.jugandoAhora}
            esperando={estadoRuleta.esperando}
            notificacionesActivas={notificacionesActivas.has("ruleta")}
          />
          <TablaPosiciones
            titulo="Tabla de posiciones — La Ruleta en línea"
            filas={posicionesRuleta}
            currentUserId={profile?.id ?? null}
          />
        </div>

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

If the file on disk differs from the above when you get to this task (another change landed in between), re-derive the same edits against the real current content instead of blindly applying this diff.

- [ ] **Step 1: Replace the whole file**

```tsx
import { Gamepad2, Puzzle, RotateCw, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getEstadoPuertaArenaAbierta } from "@/lib/arena-publica/estado-puerta.server";
import { PuertaArenaAbierta } from "@/components/juegos/PuertaArenaAbierta";
import { getEstadoPuertaRuleta } from "@/lib/ruleta/estado-puerta.server";
import { PuertaRuleta } from "@/components/juegos/PuertaRuleta";
import { getTablaPosiciones } from "@/lib/juegos/tabla-posiciones.server";
import { getRankingIndividual } from "@/lib/juegos/ranking-individual.server";
import { TablaPosiciones } from "@/components/juegos/TablaPosiciones";
import { JuegosPresence } from "@/components/juegos/JuegosPresence";
import { getProfile, createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Juegos en línea — Elim LLDM",
  description: "Entra directo a jugar con otros miembros — sin códigos, sin esperar a nadie que organice.",
};

async function getGameKeysConNotificacion(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const supabase = await createClient();
  const { data } = await supabase
    .from("game_notify_subscriptions")
    .select("game_key")
    .eq("user_id", userId);
  return new Set((data ?? []).map((r) => (r as { game_key: string }).game_key));
}

export default async function JuegosHubPage() {
  // El perfil va primero porque la consulta de campanas activas necesita
  // su id — el resto sigue en paralelo detrás.
  const profile = await getProfile();

  const [
    estadoArenaAbierta,
    estadoRuleta,
    posicionesArena,
    posicionesRuleta,
    posicionesAhorcado,
    notificacionesActivas,
  ] = await Promise.all([
    getEstadoPuertaArenaAbierta(),
    getEstadoPuertaRuleta(),
    getTablaPosiciones("arena_abierta"),
    getTablaPosiciones("ruleta"),
    getRankingIndividual("ahorcado"),
    getGameKeysConNotificacion(profile?.id ?? null),
  ]);

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

      <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-8">
        <JuegosPresence
          currentUser={profile ? { id: profile.id, nombre: profile.display_name } : null}
        />

        <div className="flex flex-col gap-4">
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            Juegos en vivo
          </p>

          <div className="flex flex-col gap-3">
            <PuertaArenaAbierta
              disponible={estadoArenaAbierta.disponible}
              jugandoAhora={estadoArenaAbierta.jugandoAhora}
              esperando={estadoArenaAbierta.esperando}
              notificacionesActivas={notificacionesActivas.has("arena_abierta")}
            />
            <TablaPosiciones
              titulo="Tabla de posiciones — Trivia en línea"
              filas={posicionesArena}
              currentUserId={profile?.id ?? null}
            />
          </div>

          <div className="flex flex-col gap-3">
            <PuertaRuleta
              disponible={estadoRuleta.disponible}
              jugandoAhora={estadoRuleta.jugandoAhora}
              esperando={estadoRuleta.esperando}
              notificacionesActivas={notificacionesActivas.has("ruleta")}
            />
            <TablaPosiciones
              titulo="Tabla de posiciones — La Ruleta en línea"
              filas={posicionesRuleta}
              currentUserId={profile?.id ?? null}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            Juegos individuales
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href="/juegos/ahorcado"
              className="flex items-center gap-4 p-6 rounded-2xl"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.3)" }}
              >
                <Puzzle size={20} style={{ color: "#A78BFA" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
                  Ahorcado del Nuevo Testamento
                </h2>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Personajes, lugares, palabras clave y libros — de un jugador
                </p>
              </div>
              <ChevronRight size={18} style={{ color: "var(--color-text-muted)" }} />
            </Link>
            <TablaPosiciones
              titulo="Tabla de posiciones — Ahorcado del Nuevo Testamento"
              filas={posicionesAhorcado}
              currentUserId={profile?.id ?? null}
              unidadSingular="palabra"
              unidadPlural="palabras"
              vacio="Aún nadie ha ganado una palabra. ¡Sé el primero!"
            />
          </div>

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
    </div>
  );
}
```

Note the `href="/juegos/ruleta-elimlldm.html"` link deliberately stays a plain `<a>`, not `<Link>` — that's intentional pre-existing behavior (it's a static HTML file outside the Next.js app, and a full navigation is needed to load it, per the comment already in `[[project_elim_lldm]]` memory about this exact link). Only the new `/juegos/ahorcado` link uses `<Link>`, because that's a real Next.js route.

- [ ] **Step 2: Commit**

```bash
git add "src/app/(public)/juegos/page.tsx"
git commit -m "Add Ahorcado card and split the hub into live/individual sections"
```

---

### Task 10: Admin panel `/admin/ahorcado`

**Files:**
- Create: `src/components/admin/AhorcadoActivoToggle.tsx`
- Create: `src/app/admin/ahorcado/page.tsx`
- Modify: `src/components/layout/AdminSidebar.tsx`

- [ ] **Step 1: Write the auto-submit `activo` toggle**

```tsx
// src/components/admin/AhorcadoActivoToggle.tsx
"use client";

import { useTransition } from "react";

interface AhorcadoActivoToggleProps {
  defaultChecked: boolean;
}

/**
 * Checkbox de "activo" que aplica el cambio solo con marcar/desmarcar —
 * mismo patrón (y misma lección aprendida) que RoleSelect.tsx en
 * /admin/usuarios: nunca un botón "Guardar" aparte que se puede pasar por
 * alto. Cuando el checkbox no está marcado, el navegador simplemente no
 * manda el campo "activo" en el FormData — el server action (Task 10,
 * Step 2) trata esa ausencia como `false`.
 */
export function AhorcadoActivoToggle({ defaultChecked }: AhorcadoActivoToggleProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      name="activo"
      value="true"
      defaultChecked={defaultChecked}
      disabled={isPending}
      onChange={(e) => {
        const form = e.currentTarget.form;
        startTransition(() => {
          form?.requestSubmit();
        });
      }}
      className="w-4 h-4 accent-yellow-500 shrink-0"
    />
  );
}
```

- [ ] **Step 2: Write the admin page**

```tsx
// src/app/admin/ahorcado/page.tsx
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Puzzle } from "lucide-react";
import type { AhorcadoCategoria, AhorcadoPalabra } from "@/types";
import { AhorcadoActivoToggle } from "@/components/admin/AhorcadoActivoToggle";

export const metadata = { title: "Ahorcado del Nuevo Testamento — Admin" };

interface Props {
  searchParams: Promise<{ edit?: string }>;
}

const CATEGORIAS: { value: AhorcadoCategoria; label: string }[] = [
  { value: "personaje", label: "Personaje" },
  { value: "lugar", label: "Lugar" },
  { value: "concepto", label: "Concepto" },
  { value: "libro", label: "Libro" },
];

async function addPalabra(formData: FormData) {
  "use server";
  const supabase = await createServiceClient();
  await supabase.from("ahorcado_palabras").insert({
    palabra: (formData.get("palabra") as string).trim().toUpperCase(),
    categoria: formData.get("categoria") as string,
    pista: (formData.get("pista") as string).trim(),
    referencia_biblica: ((formData.get("referencia_biblica") as string) || "").trim() || null,
  });
  revalidatePath("/admin/ahorcado");
}

async function updatePalabra(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const supabase = await createServiceClient();
  await supabase
    .from("ahorcado_palabras")
    .update({
      palabra: (formData.get("palabra") as string).trim().toUpperCase(),
      categoria: formData.get("categoria") as string,
      pista: (formData.get("pista") as string).trim(),
      referencia_biblica: ((formData.get("referencia_biblica") as string) || "").trim() || null,
    })
    .eq("id", id);
  revalidatePath("/admin/ahorcado");
}

async function toggleActivo(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const activo = formData.get("activo") === "true";
  const supabase = await createServiceClient();
  await supabase.from("ahorcado_palabras").update({ activo }).eq("id", id);
  revalidatePath("/admin/ahorcado");
}

export default async function AhorcadoAdminPage({ searchParams }: Props) {
  const { edit: editId } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("ahorcado_palabras")
    .select("id, palabra, categoria, pista, referencia_biblica, activo, created_at")
    .order("categoria", { ascending: true })
    .order("palabra", { ascending: true });

  const palabras = (data ?? []) as AhorcadoPalabra[];
  const editando = editId ? palabras.find((p) => p.id === editId) : undefined;

  const inputStyle = {
    background: "var(--color-surface-elevated)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
  } as const;

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Puzzle size={22} style={{ color: "var(--color-primary)" }} />
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          Ahorcado del Nuevo Testamento
        </h1>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            Banco de palabras ({palabras.length})
          </h2>

          {palabras.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: "var(--color-surface)",
                border: `1px solid ${editId === p.id ? "rgba(212,160,23,0.4)" : "var(--color-border)"}`,
                opacity: p.activo ? 1 : 0.55,
              }}
            >
              <form action={toggleActivo}>
                <input type="hidden" name="id" value={p.id} />
                <AhorcadoActivoToggle defaultChecked={p.activo} />
              </form>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
                  {p.palabra}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                  {CATEGORIAS.find((c) => c.value === p.categoria)?.label} · {p.pista}
                </p>
              </div>

              <a
                href={`/admin/ahorcado?edit=${p.id}`}
                className="w-7 h-7 rounded-lg text-xs flex items-center justify-center shrink-0"
                style={{ background: "rgba(212,160,23,0.1)", color: "var(--color-primary)" }}
              >
                ✎
              </a>
            </div>
          ))}
        </div>

        <div className="lg:sticky lg:top-8">
          <form
            action={editando ? updatePalabra : addPalabra}
            className="flex flex-col gap-4 p-5 rounded-2xl"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <h2
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)" }}
            >
              {editando ? "Editar palabra" : "Agregar palabra"}
            </h2>

            {editando && <input type="hidden" name="id" value={editando.id} />}

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Palabra
              </label>
              <input
                type="text"
                name="palabra"
                required
                pattern="[A-Za-zÑñ ]+"
                title="Solo letras y espacios, sin acentos"
                defaultValue={editando?.palabra ?? ""}
                placeholder="Ej: GALILEA"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none uppercase"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Categoría
              </label>
              <select
                name="categoria"
                required
                defaultValue={editando?.categoria ?? "personaje"}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Pista
              </label>
              <textarea
                name="pista"
                required
                rows={2}
                maxLength={200}
                defaultValue={editando?.pista ?? ""}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Referencia bíblica
              </label>
              <input
                type="text"
                name="referencia_biblica"
                maxLength={60}
                defaultValue={editando?.referencia_biblica ?? ""}
                placeholder="Ej: Juan 3:16"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </div>

            <div className="flex gap-2 pt-1">
              {editando && (
                <a
                  href="/admin/ahorcado"
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-center"
                  style={{
                    background: "var(--color-surface-elevated)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  Cancelar
                </a>
              )}
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--color-primary)", color: "#000" }}
              >
                {editando ? "Guardar cambios" : "Agregar palabra"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add the sidebar entry**

In `src/components/layout/AdminSidebar.tsx`, add `Puzzle` to the existing lucide-react import (currently `LayoutDashboard, Users, Mic, BookOpen, Gamepad2, Sparkles, Archive, Folder, Music, Video, Bot, AudioLines, Zap, Disc3, ChevronRight, LogOut`):

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
  ChevronRight,
  LogOut,
} from "lucide-react";
```

And add a new entry to the `NAV` array, right after the `"/admin/ruleta"` entry:

```ts
const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/platikas", label: "Estudio en Vivo", icon: Mic },
  { href: "/admin/question-sets", label: "Banco de preguntas", icon: BookOpen },
  { href: "/admin/juegos", label: "Juegos", icon: Gamepad2 },
  { href: "/admin/trivia", label: "Salas de Trivia", icon: Sparkles },
  { href: "/admin/arena-abierta", label: "Arena Abierta", icon: Zap },
  { href: "/admin/ruleta", label: "La Ruleta", icon: Disc3 },
  { href: "/admin/ahorcado", label: "Ahorcado", icon: Puzzle },
  { href: "/admin/archivo", label: "Archivo", icon: Archive },
  { href: "/admin/categorias", label: "Categorías", icon: Folder },
  { href: "/admin/elimplay", label: "ElimPlay", icon: Music },
  { href: "/admin/videos", label: "Videos", icon: Video },
  { href: "/admin/elim-ia", label: "Elim IA", icon: Bot },
  { href: "/admin/saludos", label: "Saludos", icon: AudioLines },
];
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AhorcadoActivoToggle.tsx "src/app/admin/ahorcado/page.tsx" src/components/layout/AdminSidebar.tsx
git commit -m "Add the /admin/ahorcado word bank management panel"
```

---

### Task 11: Manual end-to-end verification

Not a subagent task — the controlling session should do this itself after all above tasks are reviewed, merged, and the migrations from Tasks 1-2 are applied to production.

1. Run `./node_modules/.bin/tsc --noEmit` — must be clean before doing anything live. Then `pnpm build` to catch anything the type-checker alone wouldn't (e.g. a bad `lucide-react` icon import — `Puzzle` is assumed to exist in the pinned `lucide-react` version; if the build fails on that import specifically, swap it for a different icon that does exist, e.g. `Type`).
2. Log out (or use an incognito context) and visit `/juegos/ahorcado` directly — confirm it redirects to `/login?returnUrl=/juegos/ahorcado`.
3. Log in and visit `/juegos` — confirm the page now shows two labeled sections ("Juegos en vivo" with Arena Abierta/Ruleta as before, "Juegos individuales" with the new Ahorcado card above the pre-existing "Ruleta de retos" card) and that nothing about Arena Abierta/Ruleta visually broke.
4. Click into `/juegos/ahorcado` — confirm a word loads (drawing, blanked-out tiles, clue with category badge, Bible reference, on-screen keyboard).
5. Play a full game and **win**: guess all correct letters — confirm the win panel shows the point total, "Siguiente palabra" appears, and a ranking message ("¡Nuevo récord guardado!" the first time) appears.
6. Reload `/juegos/ahorcado` — confirm the top-5 table now shows this account with the score just earned, labeled "palabra"/"palabras" (not "partida").
7. Play a full game and **lose**: guess 6 wrong letters — confirm the gallows fully draws, the loss panel reveals the correct word, and no ranking-save message appears (score wasn't beaten, or this is expected only if the win score stands higher — confirm the earlier win score in the ranking table is preserved, not overwritten by a lower loss-round score of 0).
8. Log in as an admin account, visit `/admin/ahorcado` — confirm the sidebar link works, the list shows all 72 seeded words grouped by category order, and the "activo" checkbox toggles instantly (list re-renders with the row dimmed) with no separate save button.
9. From `/admin/ahorcado`, add a new word (e.g. a short test word), confirm it appears in the list; edit an existing word's clue, confirm the change persists; click the checkbox off on the word you just added, then go play a few rounds of Ahorcado and confirm that word never appears (deactivated words are excluded from `palabra-aleatoria`).
10. Confirm `/juegos/ahorcado` and `/admin/ahorcado` both look correct at 375px width (mobile) — no horizontal scroll, keyboard grid wraps cleanly, admin form is usable.

If any step fails, fix the specific file involved and re-run `./node_modules/.bin/tsc --noEmit` before retrying — don't move on with a known-broken step.

---

## Self-Review Notes

- **Spec coverage:** every decision in `docs/superpowers/specs/2026-09-09-ahorcado-nt-design.md` maps to a task — hub placement/section split → Task 9; account required to play → Task 8's `redirect`; all four word categories with Bible references → Task 2's seed data; admin-editable bank, no public read → Task 1's RLS + Task 10's admin CRUD; 6 lives, simple random → Task 7; generic reusable ranking table → Task 1 (`juego_individual_rankings`) + Task 3 (`getRankingIndividual`, written so a second individual game only needs its own `game_key` and `notifyGameWaiting`-style wiring — no new table); visible top-5 → Task 3's `TablaPosiciones` extension + Tasks 8/9.
- **Type consistency check:** `Palabra` in `AhorcadoGame.tsx` (Task 7) and the `Pick<AhorcadoPalabra, ...>` response shape in the `palabra-aleatoria` route (Task 4) have identical fields (`id, palabra, categoria, pista, referencia_biblica`) — checked field-by-field. `AhorcadoCategoria` is defined once (Task 3) and imported everywhere it's used (Tasks 6, 7, 10) rather than re-declared. `FilaPosicion` (existing type) is produced by `getRankingIndividual` (Task 3) with the exact same field names (`user_id, nombre, avatar_url, puntos_totales, partidas`) `TablaPosiciones` already expects — no shape mismatch.
- **Placeholder scan:** none — every step has complete, real code, including the full 72-word seed list (Task 2) and the full current-vs-new content of `/juegos/page.tsx` (Task 9, re-read from the actual file before writing this plan).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-09-ahorcado-nt.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

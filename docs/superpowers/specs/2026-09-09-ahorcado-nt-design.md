# Ahorcado del Nuevo Testamento — Diseño

## Contexto

El hub `/juegos` de Elim LLDM hoy solo tiene "puertas" de sala en vivo (Ruleta, Arena Abierta) con matchmaking, estado ocupado/disponible y campana de aviso — ver [[project_elim_lldm]] sección "Rediseño Sala de Espera". El usuario quiere agregar un juego nuevo, muy distinto en naturaleza: **Ahorcado**, de un solo jugador, sin sala ni matchmaking, con banco de palabras limitado al Nuevo Testamento.

Existe un Ahorcado de referencia en el proyecto hermano `tdv-llm` (`src/pages/Ahorcado.jsx`, game_key `ahorcado`): banco de `{palabra, pista}` fijo en código, 6 vidas, SVG del muñeco que se dibuja por error, teclado A-Z, puntaje = vidas_restantes × 10 por palabra, guardado en una tabla `game_rankings` genérica por `user_id` + `game_key`. Elim LLDM no tiene ningún juego individual con ranking todavía — el único ranking que existe (`tabla_posiciones`, migración 0029) es una vista que suma partidas de sala en vivo, y no aplica a un juego solitario de rachas.

## Decisiones tomadas con el usuario

- **Ubicación:** nueva sección "Juegos individuales" en `/juegos`, separada visualmente de las puertas en vivo. Una tarjeta con título/ícono/botón "Jugar" → `/juegos/ahorcado`. Sin estado ocupado/disponible ni campana (no aplica a un juego de un jugador).
- **Cuenta obligatoria para jugar** (no solo para guardar ranking) — consistente con Ruleta/Arena Abierta tras la Fase 1/2. Sin sesión, redirect a `/login?returnUrl=/juegos/ahorcado`.
- **Contenido del banco:** los cuatro tipos — personajes, lugares, conceptos/palabras clave, y libros del Nuevo Testamento.
- **Pistas con referencia bíblica exacta** (ej. "Juan 3:16") cuando aplique, mismo estilo que `bible_reference` en las preguntas de Trivia.
- **Almacenamiento del banco:** tabla en Supabase con panel admin (no un arreglo fijo en código) — se puede agregar/editar/desactivar palabras sin redeploy.
- **Dificultad:** 6 vidas, palabra siguiente aleatoria simple sobre todo el banco activo (igual que tdv-llm, sin lógica de "no repetir").
- **Ranking:** tabla **genérica** `juego_individual_rankings` (game_key + user_id + score), reutilizable si se agregan más juegos individuales después — mismo patrón que `game_rankings` de tdv-llm. game_key = `'ahorcado'`.
- **Ranking visible:** top 5 junto al juego (nombre + avatar del perfil), mismo gancho competitivo que `tabla_posiciones` en el hub.
- **Banco de palabras inicial:** lo genera Claude como parte del plan de implementación (dato semilla de la migración), no lo escribe el usuario a mano.

## Arquitectura

```
src/app/(public)/juegos/ahorcado/page.tsx        # Server Component: getProfile()+redirect, fetch top 5, pasa a client
src/components/juegos/ahorcado/AhorcadoGame.tsx  # Client Component: juego completo
src/components/juegos/ahorcado/AhorcadoRanking.tsx # Top 5, recibe datos ya cargados por el server component

src/app/api/juegos/ahorcado/palabra-aleatoria/route.ts  # GET — server route, service role, elige palabra activa al azar
src/app/api/juegos/ahorcado/ranking/route.ts             # POST — verifica sesión, upsert en juego_individual_rankings

src/app/admin/ahorcado/page.tsx                  # Lista + CRUD del banco (patrón /admin/question-sets)

supabase/migrations/0034_ahorcado_nt.sql         # ahorcado_palabras + juego_individual_rankings
```

`/juegos/ahorcado` es una ruta estática y no choca con la ruta dinámica existente `/juegos/[id]` (Next.js prioriza rutas estáticas).

## Modelo de datos

### `ahorcado_palabras`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `palabra` | TEXT NOT NULL | Mayúsculas, sin acentos. `CHECK (palabra ~ '^[A-ZÑ ]+$')` |
| `categoria` | TEXT NOT NULL | `CHECK IN ('personaje','lugar','concepto','libro')` |
| `pista` | TEXT NOT NULL | |
| `referencia_biblica` | TEXT | Nullable — no todas las palabras (ej. algunos conceptos) tienen una cita única obvia |
| `activo` | BOOLEAN NOT NULL DEFAULT TRUE | Desactivar en vez de borrar, para no romper `metadata` de rankings ya guardados que la referencien |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

**RLS: sin policy de SELECT pública.** A diferencia de la mayoría de tablas del proyecto, nadie (ni `anon` ni `authenticated`) puede leer el banco completo por REST — evita que se pueda listar todo el banco de una sola consulta. Policy `ALL` solo para `role = 'admin'` (vía `profiles`), para que el panel admin funcione con el cliente normal. El juego en sí lee **una** palabra a la vez a través de la API route, con el cliente de service role (que bypassa RLS).

Nota de riesgo aceptado: la palabra en juego sí llega al navegador en la respuesta de esa API route (necesario para pintar el tablero), así que es inspeccionable por Network tab durante esa partida — mismo nivel de exposición que el Ahorcado de tdv-llm (banco completo visible en el bundle JS). No se cifra ni se esconde con sesión firmada: sería sobre-ingeniería para un juego solitario sin apuestas entre jugadores.

### `juego_individual_rankings`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `game_key` | TEXT NOT NULL | `'ahorcado'` por ahora; reutilizable por futuros juegos individuales |
| `user_id` | UUID NOT NULL FK → profiles | |
| `score` | INT NOT NULL | |
| `metadata` | JSONB | `{ palabras_ganadas: n }` |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |
| | | `UNIQUE (game_key, user_id)` |

RLS: `SELECT` pública (`anon`, `authenticated`) para poder mostrar el top 5 sin sesión. `INSERT`/`UPDATE` solo en la fila propia (`auth.uid() = user_id`). Con sus GRANTs explícitos a `authenticated`/`anon` — el gotcha de tablas nuevas ya documentado en este proyecto (ver [[project_elim_lldm]]).

## Flujo de juego

1. `AhorcadoGame.tsx` monta y pide `GET /api/juegos/ahorcado/palabra-aleatoria` → recibe `{id, palabra, categoria, pista, referencia_biblica}`.
2. Reglas idénticas al Ahorcado de tdv-llm: 6 vidas, teclado A-Z + Ñ, letra correcta se revela en todas sus posiciones, letra incorrecta resta una vida. Palabras con espacio (ej. "JUAN EL BAUTISTA") auto-revelan el espacio.
3. SVG del ahorcado dibujado progresivamente por cada error (mismo patrón de partes por `errores = 6 - intentosRestantes`).
4. Se muestra la categoría de la palabra actual como etiqueta (ej. "Personaje bíblico", "Lugar", "Palabra clave", "Libro del Nuevo Testamento") junto a la pista y la referencia.
5. Al ganar: puntos = `intentosRestantes * 10`, acumulados en la sesión (`puntuacion`, `palabrasJugadas` en estado del componente, igual que tdv-llm) → `POST /api/juegos/ahorcado/ranking` con `{score, palabras_ganadas}`. La API verifica la sesión server-side y hace upsert en `juego_individual_rankings` solo si `score` mejora el existente.
6. Botón "Siguiente palabra" pide una nueva palabra aleatoria sin reiniciar el puntaje acumulado; botón aparte "Reiniciar juego" pone el puntaje en cero.
7. Estilo visual: paleta oro/fondo oscuro ("santuario oscuro") del design system de Elim LLDM — no el cyan/blanco de tdv-llm. Reusa `Card`/`Button` de shadcn/ui ya instalados.

## Panel admin (`/admin/ahorcado`)

Mismo patrón de formulario inline que `/admin/question-sets`: tabla con columnas palabra/categoría/pista/referencia/activo, formulario para crear, edición inline, y un toggle de `activo` (auto-submit, aprendiendo del bug de UX corregido en `RoleSelect.tsx` — nunca un botón "✓" aparte fácil de pasar por alto).

## Banco de palabras inicial

Se genera como parte del plan de implementación (INSERT de datos semilla en la migración), cubriendo los cuatro tipos: personajes (Jesús, Pedro, Pablo, María, Lázaro, Zaqueo, Nicodemo...), lugares (Belén, Nazaret, Getsemaní, Gólgota, Éfeso...), conceptos (fe, gracia, evangelio, resurrección, Pentecostés...) y libros (Mateo, Romanos, Apocalipsis, Filemón...) — aproximadamente 60-70 palabras en total para que el juego no se sienta repetitivo desde el día uno.

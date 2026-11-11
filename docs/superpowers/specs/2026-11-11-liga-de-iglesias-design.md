# Liga de Iglesias — Diseño

Fecha: 2026-11-11 · Estado: aprobado por el usuario; actualizado el mismo día con la regla general de participación (§8), que reemplaza la casilla de permiso

## Objetivo

Cada jugador pertenece a la iglesia de su ciudad. Los puntos que gana en los juegos de /juegos suman para su iglesia y cada semana hay una iglesia campeona. El fin es que la gente invite a sus hermanos y regrese a jugar.

**Lenguaje:** en toda la interfaz se dice "Iglesia de [Ciudad]" (ej. "Iglesia de Las Vegas"). Nunca se usa la palabra "congregación".

## Lo que existe hoy (revisado antes de diseñar)

| Juego | Identificación | Dónde valida el servidor | Sin sesión |
|---|---|---|---|
| Palabra del Día (`/juegos/palabra`) | `profiles.id` | `/api/juegos/palabra/intento` (service role, `palabra_partidas`) | Se juega en modo `local`; no cuenta para puntos |
| Trivia en línea (`/arena-abierta`) | `profiles.id` en `arena_publica_jugadores.user_id` | `/api/arena-publica/answer` evalúa cada respuesta | Exige sesión |
| La Ruleta en línea (`/ruleta`) | `profiles.id` en `ruleta_jugadores.user_id` | `/api/ruleta/[codigo]/guess-consonant`, `guess-vowel`, `resolve` | Exige sesión |
| Ahorcado (`/juegos/ahorcado`) | `profiles.id` | `/api/juegos/ahorcado/letra` (escribe `ahorcado_resultados`) | Exige sesión |

- Elim Arena y Trivia en Vivo se retiraron el 2026-10-24 (tablas borradas en 0084). No entran a la Liga.
- `profiles.iglesia` (0054) es texto libre "iglesia o ciudad" que pide Palabra del Día. Solo 6 personas lo llenaron. Se reemplaza por la tabla `iglesias`; la columna vieja se deja sin borrar.
- `profiles.tiktok_permiso` (0078) es la casilla de permiso para salir con nombre y foto en los videos. **Se deja de usar** (la columna no se borra): la reemplaza la regla general de participación (§8).
- Registro de cuentas (`/login`): correo y contraseña (modo "registro"), Google y otros proveedores (OAuth), y entrar con código por correo (`EntrarConCodigo`, de Elim English). Con OAuth y con código no hay un formulario de registro propio: la cuenta se crea al volver del proveedor.
- El nombre para mostrar es `profiles.display_name` (2 a 60 letras), que ya se edita en /perfil. Al crear la cuenta lo llena `handle_new_user()` (0001) con `full_name` del proveedor, o con la parte del correo antes de la @.

## 1. Iglesias

### Tabla `iglesias`

| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| ciudad | TEXT NOT NULL | Como la escribió (máx. 60) |
| estado | TEXT NOT NULL | Estado/provincia (máx. 60) |
| pais | TEXT NOT NULL | (máx. 60) |
| clave | TEXT NOT NULL UNIQUE | `normalizar(ciudad)|normalizar(estado)|normalizar(pais)`: minúsculas, sin acentos, espacios colapsados |
| aprobada | BOOLEAN NOT NULL DEFAULT FALSE | |
| creada_por | UUID FK profiles NULL | Quién la propuso |
| creada_en | TIMESTAMPTZ DEFAULT NOW() | |

- **Nombre que se muestra:** "Iglesia de " + ciudad. Si hay otra iglesia **aprobada** con la misma ciudad normalizada, se agrega el estado ("Iglesia de Victoria, Texas"). Si también coincide el estado, se agrega el país. Lo calcula una sola función en `src/lib/liga/nombre.ts`.
- **RLS:** lectura pública solo de las aprobadas, más las pendientes que creó el propio usuario. Sin INSERT/UPDATE/DELETE para anon/authenticated; todo pasa por API routes con service role.

### Columnas nuevas en `profiles`

- `iglesia_id UUID NULL REFERENCES iglesias(id)`
- `iglesia_cambiada_en TIMESTAMPTZ NULL`: límite de un cambio cada 30 días.
- `iglesia_preguntada BOOLEAN NOT NULL DEFAULT FALSE`: el aviso ya se mostró y lo cerró con "Ahora no". Así no se le vuelve a mostrar en cada juego; puede elegir después en /perfil o en /juegos/liga.

Siguiendo 0076, estas columnas no se agregan al GRANT de SELECT por columnas: las lee y las escribe el servidor.

### Iglesias que ya existen (texto libre)

Se crean como aprobadas y se asignan a sus 4 jugadores en la migración:

| Texto actual | Iglesia |
|---|---|
| Riverside | Riverside, California, Estados Unidos |
| Guadalajara | Guadalajara, Jalisco, México |
| Santa Lucia, Campeche | Santa Lucía, Campeche, México |
| Cdmx, Magdalena | Ciudad de México, CDMX, México |

"Nevada" y "Costa Rica" no son ciudades: quedan sin iglesia y les aparece el aviso.

## 2. Elegir iglesia

- **Aviso:** la primera vez que un usuario con sesión, sin `iglesia_id` y con `iglesia_preguntada = false`, entra a cualquiera de los 4 juegos, aparece un modal: "¿De qué ciudad es tu iglesia? Tus puntos sumarán para tu iglesia". Botones: elegir / "Ahora no".
- **Buscador:** escribe la ciudad y se muestran iglesias aprobadas que coinciden (búsqueda normalizada, sin acentos). Sale una lista con el nombre completo (ciudad, estado, país).
- **Agregar:** si no aparece, llena ciudad, estado y país. Antes de crearla, el servidor busca iglesias con clave igual o parecida y, si hay, se las muestra: "¿Es alguna de estas?". Si la clave ya existe (aprobada o pendiente), se usa esa y no se crea otra. La nueva queda **pendiente** y el jugador queda asignado a ella.
- **Cambiar:** desde /perfil y /juegos/liga. El servidor rechaza el cambio si no han pasado 30 días desde `iglesia_cambiada_en` y le dice cuándo podrá cambiar. La primera elección no cuenta como cambio.
- **API:** `GET /api/liga/iglesias?q=` (buscar), `POST /api/liga/mi-iglesia` (elegir o agregar), `POST /api/liga/no-preguntar`.

## 3. Puntos

### Tabla `liga_puntos`

| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| jugador | UUID FK profiles NOT NULL | |
| iglesia_id | UUID FK iglesias NULL | La del jugador en el momento; NULL si no tenía |
| juego | TEXT NOT NULL | `palabra` \| `trivia` \| `ruleta` \| `ahorcado` |
| puntos | INT NOT NULL CHECK (puntos > 0) | |
| partida_ref | TEXT NOT NULL | Partida o sala (fecha en Palabra, `sala_id` en Trivia/Ruleta, id del resultado en Ahorcado) |
| evento_ref | TEXT NOT NULL | Evento único dentro de la partida (pregunta, ronda+letra, palabra). UNIQUE (jugador, juego, evento_ref) evita contar dos veces por un doble envío |
| semana | DATE NOT NULL | Lunes de la semana en `America/Los_Angeles` |
| dia | DATE NOT NULL | Fecha en `America/Los_Angeles`, para el tope diario |
| creado_en | TIMESTAMPTZ DEFAULT NOW() | |

- **RLS:** activada, sin ninguna policy para anon/authenticated y `REVOKE ALL`. Nadie la lee ni la escribe desde el navegador. Los totales salen por funciones SECURITY DEFINER que solo devuelven agregados (iglesia, puntos, jugadores) y nombres según el permiso.

### Registro: `registrarPuntosLiga()`

`src/lib/liga/registrar.server.ts`, usado solo en el servidor (service role). Recibe `{ jugador, juego, puntos, partidaRef, eventoRef }` y:

1. Lee `iglesia_id` del jugador.
2. Calcula `semana` y `dia` en hora del Pacífico.
3. Aplica topes: lo que ya lleva en esa partida (máximo por partida del juego) y lo que lleva ese día en ese juego (máximo 40). Si no queda margen, no inserta nada.
4. Inserta la fila recortada al margen. Un conflicto en (jugador, juego, evento_ref) se ignora.

Para que dos peticiones al mismo tiempo no se pasen del tope, el cálculo y el insert van en una función SQL (`liga_registrar_puntos`) que bloquea por jugador con `pg_advisory_xact_lock`.

Está envuelta en try/catch y solo registra el error en la consola: **un fallo de la Liga nunca rompe ni retrasa la respuesta del juego.**

### Reglas en `src/lib/liga/config.ts` (fácil de cambiar)

| Juego | Dónde se llama | Puntos | Máx. por partida |
|---|---|---|---|
| Palabra del Día | `/api/juegos/palabra/intento`, al resolver, solo `origen = 'servidor'` | 10 + 2 por cada intento que sobró (de 6) | 22 |
| Trivia en línea | `/api/arena-publica/answer`, si `esCorrecta` | 1 por respuesta correcta | 20 |
| La Ruleta en línea | `guess-consonant` y `guess-vowel` si la letra está; `resolve` si acierta | 1 por letra acertada, 5 por resolver | 20 |
| Ahorcado | `/api/juegos/ahorcado/letra`, al ganar una palabra | 2 por palabra ganada | — |
| Todos | — | Tope: 40 por jugador, por juego, por día | — |

Los admins no compiten (igual que en las tablas actuales): no se les registran puntos.

### Qué cuenta para cada iglesia

- Los puntos van a la iglesia que tenía el jugador cuando los ganó. Si se cambia, lo anterior se queda con la iglesia anterior.
- **Iglesia pendiente:** los puntos se guardan con su `iglesia_id` y empiezan a aparecer en la tabla en cuanto se aprueba (las consultas solo suman iglesias aprobadas).
- **Sin iglesia:** se guardan con `iglesia_id NULL`. Cuando elige iglesia por primera vez, las filas NULL de **la semana actual** se le asignan.
- **Rechazar una iglesia:** sus jugadores quedan sin iglesia (vuelve a salirles el aviso) y sus puntos no cuentan.
- **Juntar duplicadas** (admin): jugadores y puntos pasan a la iglesia que se conserva y la duplicada se borra.

### Semana

Lunes 00:00 a domingo 23:59, `America/Los_Angeles`. En SQL: `date_trunc('week', (now() AT TIME ZONE 'America/Los_Angeles'))::date`. Cada semana se cuenta aparte, así que la tabla "empieza en cero" sola.

## 4. Jugadores sin sesión

Al terminar una partida sin sesión (hoy solo Palabra del Día en modo `local`), aparece un aviso amable que no bloquea el juego: "¿Quieres que tus puntos sumen para la Iglesia de tu ciudad? Entra a tu cuenta", con botón para iniciar sesión (que regresa al juego). Es un componente reutilizable (`InvitacionLiga`) para usarlo en cualquier juego que después permita jugar sin cuenta. Las pantallas de Trivia, Ruleta y Ahorcado ya piden iniciar sesión para entrar y no cambian.

## 5. Página /juegos/liga

Diseño vertical, celular primero, con el estilo actual del sitio (santuario oscuro, dorado).

1. **Título:** "Liga de Iglesias" y la semana ("Semana del 9 al 15 de noviembre").
2. **Mi iglesia (destacado):** "La Iglesia de [Ciudad] va en el lugar #X" y "¡Les faltan N puntos para pasar a la Iglesia de ___! Invita a tus hermanos". Si va primero: "¡Van en primer lugar! Invita a tus hermanos para no perderlo". Si su iglesia está pendiente: "Tu iglesia está esperando aprobación; tus puntos ya se están guardando". Sin iglesia, botón para elegirla. Sin sesión, invitación a entrar.
3. **Botón "Invitar a mis hermanos":** usa `navigator.share` y, si no está disponible, abre WhatsApp (`wa.me/?text=`). Texto: "Ayuda a la Iglesia de [Ciudad] a ganar la Liga de Elim LLDM 🏆 juega aquí: https://www.elimlldm.net/juegos/liga".
4. **Top 10 de la semana:** lugar, "Iglesia de [Ciudad]", 🏆 si fue la campeona de la semana anterior, puntos, jugadores activos (jugadores distintos con puntos esa semana) y barra de progreso relativa al primer lugar. Se actualiza cada 30 segundos con `GET /api/liga/tabla`. No se usa Realtime para no tener que hacer legible la tabla de puntos.
5. **Mejores jugadores de mi iglesia esta semana:** top 10 con su nombre para mostrar y su foto de perfil (si no tiene foto, la inicial en un círculo). Quien todavía no acepta las reglas (§8) sale como "Hermano/a participante", sin foto.
6. **Historial:** campeonas de semanas anteriores (semana, iglesia, puntos, jugadores).

En /juegos se agrega una tarjeta "Liga de Iglesias" arriba de las puertas, que lleva a /juegos/liga y muestra el lugar de la iglesia del jugador.

## 6. Cierre semanal

- **Vercel Cron:** `/api/cron/liga-cierre` con `schedule` `5 7 * * 1` y `5 8 * * 1`, para cubrir 00:05 del Pacífico en horario de verano (PDT) e invierno (PST). Protegido con `CRON_SECRET`, igual que los crons existentes.
- **Lógica:** toma la semana anterior a la actual en hora del Pacífico. Si ya existe en `liga_campeonas`, no hace nada (idempotente, porque corre dos veces). Si no, guarda la iglesia aprobada con más puntos. Empate: más jugadores y luego quien llegó primero a ese total. Si nadie jugó, no guarda nada.
- **Tabla `liga_campeonas`:** semana (DATE PK), iglesia_id, puntos, jugadores, creado_en. Lectura pública.
- **Insignia 🏆:** la iglesia de la semana anterior la muestra junto a su nombre durante la semana actual, en /juegos/liga y en la tarjeta de /juegos.

## 7. Admin: /admin/liga

- **Iglesias pendientes:** ciudad, estado, país, quién la propuso, cuántos jugadores y puntos tiene, e iglesias parecidas. Acciones: Aprobar, Rechazar y "Juntar con…" (elige la iglesia que se conserva). Solo rol `admin`, verificado en el servidor con `adminId()`.
- **Iglesias aprobadas:** lista con jugadores; se puede corregir ciudad, estado o país (recalcula la clave y evita chocar con otra).
- **"Generar tarjeta de la Liga":** imagen vertical 1080x1920 en canvas del navegador, con el mismo enfoque que la tarjeta de `/admin/juegos/tiktok`:
  - Título "Liga de Iglesias · Semana del __".
  - Las 3 primeras iglesias con sus puntos.
  - El mejor jugador de la semana con su nombre para mostrar y su foto (o la inicial). Si no ha aceptado las reglas, esa sección no aparece.
  - Botón para descargar PNG. Se puede elegir la semana (la actual o una cerrada).
- **Enlace en el menú de admin.**

## 8. Regla general de participación (reemplaza la casilla de permiso)

**Texto de la regla** (versión `2026-11-11`, en `src/lib/reglas.ts` junto con `REGLAS_VERSION`):

> "Al participar en los juegos de Elim LLDM aceptas que tu nombre para mostrar y tu foto de perfil puedan aparecer en la Liga, en las tablas de resultados y en los videos de Elim LLDM en redes sociales."

**Columnas nuevas en `profiles`:** `acepto_reglas_en TIMESTAMPTZ NULL` y `acepto_reglas_version TEXT NULL`. Solo las escribe el servidor (están en el mismo trigger de protección que las de la Liga). Alguien "aceptó" cuando `acepto_reglas_version = REGLAS_VERSION`. Si en el futuro cambia el texto, se sube la versión y se vuelve a pedir una vez.

### 8.1 Al registrarse

- **Con correo y contraseña** (`/login`, modo registro): dos campos nuevos.
  - "Nombre para mostrar", con la nota "Este es el nombre que verán los demás y que puede salir en los videos".
  - La regla con una casilla "Acepto" **sin marcar**. Sin marcarla no se puede crear la cuenta.
  - El nombre y la versión aceptada viajan en los metadatos de `signUp`. `handle_new_user()` se actualiza para guardar `display_name` con ese nombre, y `acepto_reglas_en = NOW()` y `acepto_reglas_version` cuando vienen en los metadatos.
- **Con Google, otro proveedor o código por correo:** no hay formulario antes de crear la cuenta. Estas cuentas nuevas ven la pantalla de §8.2 la primera vez que entran a un juego o a la Liga, igual que las cuentas que ya existen.

### 8.2 Cuentas que todavía no aceptan

- **Pantalla de aceptación:** al entrar a cualquiera de los 4 juegos, a /juegos/liga o a /juegos (el vestíbulo), un usuario con sesión que no ha aceptado la versión actual ve una sola vez una pantalla encima de la página. Contiene:
  - la regla;
  - el campo "Nombre para mostrar", ya lleno con su nombre actual y con la nota de arriba;
  - el botón **"Acepto"**, que guarda nombre, fecha y versión con `POST /api/cuenta/reglas`;
  - "Ahora no, solo quiero ver".
- **Hasta que acepte, puede ver pero no jugar:**
  - Las páginas se ven normal y queda una barra fija abajo: "Para jugar, acepta las reglas de los juegos", con un botón que vuelve a abrir la pantalla.
  - El servidor rechaza con 403 (`{ error: "Acepta las reglas de los juegos para jugar", codigo: "reglas" }`) en las rutas donde se empieza o se juega una partida:
    - `/api/juegos/palabra/intento`, solo con sesión (sin sesión se sigue jugando en modo local, que no muestra nombres);
    - `/api/arena-publica/join` y `/api/ruleta/join`;
    - las rutas de Ahorcado que empiezan una palabra (`/api/juegos/ahorcado/palabra` y `/palabra-aleatoria`);
    - `/api/liga/mi-iglesia`.
  - Las partidas que ya están en curso no se cortan.
  - La revisión está en un solo helper: `aceptoReglas(userId)` en `src/lib/reglas.server.ts`.
- **Orden de las pantallas:** primero la de las reglas y, ya aceptadas, la de "¿De qué ciudad es tu iglesia?" (§2).
- **Admins:** también la ven, pero no compiten.

### 8.3 Nombre para mostrar

- **En /perfil:** el campo de nombre (`ProfileForm`) se titula "Nombre para mostrar" y lleva la nota "Este es el nombre que verán los demás y que puede salir en los videos". Puede ser su nombre o un apodo (ej. "Hermano Juan GDL"). Se mantiene el límite actual de 2 a 60 letras.
- **Dónde se usa:** ese nombre, tal cual, es el que sale en la Liga, en las tablas de resultados y en las tarjetas y videos. Se deja de usar `nombreCorto()` (nombre e inicial del apellido) en los videos.

### 8.4 Se quita la casilla de permiso

- **Se quitan de la interfaz:**
  - `CasillaPermisoJuego` y `PermisoVideosProvider` de /juegos;
  - la pregunta de TikTok al terminar una partida (`PreguntaTikTok`, `PreguntaTikTokJuego` y `PermisoTikTok` en Palabra, Ahorcado, Trivia y Ruleta);
  - la sección "Videos de TikTok, Instagram y YouTube" de /perfil.
- **Archivos que quedan sin uso:** `/api/cuenta/tiktok`, `PermisoVideosJuegos.tsx`, `PermisoTikTok.tsx`, `PreguntaTikTok.tsx` y `PreguntaTikTokJuego.tsx`. **No se borran** (regla del usuario: nunca `rm`).
- **Tarjetas y videos de campeones** (`/admin/juegos/tiktok`, `/admin/palabra/tiktok`, imagen para historias y tarjeta de la Liga):
  - Usan siempre el nombre para mostrar y la foto de perfil; si no tiene foto, la inicial en un círculo.
  - El criterio "con permiso" pasa de `tiktok_permiso = true` a "aceptó las reglas".
  - Quien nunca aceptó y tiene resultados de antes sale como "Hermano/a participante", sin foto, como hoy.

### 8.5 Página /reglas

Una página pública con todas las reglas de los juegos y la Liga, en lenguaje sencillo:
- **La regla de participación** (nombre para mostrar y foto).
- **Cómo se ganan puntos en la Liga:** las mismas cifras de `src/lib/liga/config.ts`, leídas de ahí para que no se desfasen.
- **Topes:** máximo por partida y 40 por juego por día.
- **La semana:** de lunes a domingo, hora del Pacífico, y la campeona del lunes.
- **Elegir y cambiar de iglesia:** una vez cada 30 días, y qué pasa con las iglesias pendientes.
- **Las partidas sin sesión** no suman puntos.
- **Juego limpio:** no usar varias cuentas ni trampas; el admin puede quitar puntos o iglesias.

Se enlaza desde la pantalla de aceptación, el formulario de registro, /juegos, /juegos/liga y el pie de página.

## 9. Migración

`supabase/migrations/0086_liga_iglesias.sql` (la 0085 está en el repo pero no aplicada; no depende de ella). Incluye:
- Las tablas `iglesias`, `liga_puntos` y `liga_campeonas`.
- Las columnas nuevas de `profiles` (Liga y reglas: `acepto_reglas_en`, `acepto_reglas_version`), protegidas por un trigger para que solo el servidor las cambie.
- `handle_new_user()` actualizada para guardar el nombre para mostrar y la aceptación que vienen del registro con correo.
- RLS, REVOKE y GRANT, los índices `(semana, iglesia_id)`, `(jugador, juego, dia)` y `(jugador, juego, partida_ref)`.
- Las funciones `liga_registrar_puntos`, `liga_tabla_semana`, `liga_jugadores_iglesia` y `liga_cerrar_semana`.
- El alta de las 4 iglesias existentes.

Se aplica en el SQL Editor de Supabase con autorización del usuario.

## 10. Archivos

- Nuevos:
  - `src/lib/liga/`: `config.ts`, `nombre.ts`, `semana.ts`, `registrar.server.ts`, `consultas.server.ts`.
  - `src/app/api/liga/`: `iglesias`, `mi-iglesia`, `no-preguntar`, `tabla`.
  - `src/app/api/cron/liga-cierre/route.ts`.
  - `src/app/(public)/juegos/liga/page.tsx` y sus componentes en `src/components/juegos/liga/`.
  - `src/app/admin/liga/`.
- Cambian:
  - Las 6 rutas de juego donde se llama a `registrarPuntosLiga()` (una línea y el cálculo de puntos).
  - Las páginas de los 4 juegos (montan el aviso de iglesia).
  - `/juegos` (tarjeta), `/perfil` (cambiar iglesia).
  - `/login` (campos del registro), `ProfileForm` (nota del nombre), las pantallas de reglas en juegos y Liga, y la página nueva `/reglas`.
  - Quitar la casilla y la pregunta de TikTok de los juegos y de /perfil (§8.4); `campeones.server.ts` y `palabra/puntos.server.ts` con el criterio "aceptó las reglas" y el nombre para mostrar completo.
  - El menú de admin y `vercel.json` (crons).

## 11. Pruebas

El repo no tiene test runner. La verificación es:
- `npx tsc --noEmit` y `npm run build`.
- La migración aplicada en Supabase y revisada con consultas.
- Una prueba en el navegador con una cuenta real:
  - elegir iglesia y agregar una pendiente;
  - aprobarla en /admin/liga;
  - jugar Palabra del Día y ver los puntos en /juegos/liga;
  - comprobar el tope diario y el aviso sin sesión.
- Revisar que los 4 juegos sigan funcionando igual.
- Probar el cron en local llamando a la ruta con `CRON_SECRET`.

## Fuera de alcance

- Realtime en la tabla (se usa una actualización cada 30 segundos).
- Puntos retroactivos de semanas anteriores a la Liga.
- Juegos retirados (Elim Arena, Trivia en Vivo).

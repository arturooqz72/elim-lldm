# Programas para el Estudio en Vivo — Design

## Contexto y objetivo

Hoy "Pláticas en vivo" es una sala genérica: un anfitrión crea una plática, la gente la ve con video, comenta, puede pedir subir al escenario, y el anfitrión puede transmitir a YouTube/Facebook/TikTok y opcionalmente a la radio (`radio.elimlldm.net`) vía el panel "Salida a radio".

El usuario quiere convertir esto en una radio con programación real: varios "programas" (p. ej. "Conversando con Fernando", "La hora de vida y salud"), cada uno con su propio conductor y su propio banco de audios (intros, salidas, efectos) listos para disparar durante la transmisión — como una cabina de radio profesional, pero conservando **todo** lo que el Estudio ya hace hoy (video, chat, invitar al escenario, multi-plataforma).

**Origen de esta sesión:** se detectó y corrigió un bug real en el camino — el bridge de radio (`elim-live-bridge` en el servidor Hetzner) apuntaba a una cuenta de streamer `estudio_elim` que ya no existía en AzuraCast (solo quedaba `Elimlldm`), causando que Liquidsoap rechazara la conexión con 401 sin avisar claramente por qué. Se recreó la cuenta `estudio_elim` con la contraseña que el bridge ya esperaba. Confirmado funcionando en vivo por el usuario.

## Fuera de alcance de este diseño

- **Grabación automática de las transmisiones** — el usuario la pidió, pero se decidió diseñarla aparte (dónde se guarda, por cuánto tiempo, cuándo se dispara) para no mezclar dos piezas grandes en un mismo plan. Ya se confirmó que usará el mismo storage externo (Backblaze B2, bucket `elim-videos`) que ya usan ElimPlay y Videos.
- Renombrar `platikas` y sus columnas por dentro de la base de datos — se decidió mantenerlo (ver más abajo).
- Restringir el acceso de un conductor a solo su horario asignado — el horario es informativo por ahora.

## 1. Nombres

- Todo lo que el usuario ve y usa pasa a decir **"Estudio en Vivo"**: menú principal, títulos de página, botones, panel admin.
- **No se renombra nada por dentro** — la tabla `platikas`, sus columnas, las rutas (`/platikas/[id]`, `/admin/platikas/...`) y los componentes siguen llamándose igual. Solo cambia el texto visible. Esto evita el riesgo de romper el archivo histórico de transmisiones o cualquier referencia interna, a cambio de nada visible para el usuario.

## 2. Modelo de datos

Todo nuevo, sin tocar las tablas existentes salvo un campo agregado a `platikas`.

```sql
-- La ficha de cada programa (el "show" recurrente, no una transmisión puntual)
CREATE TABLE programas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  horario_texto TEXT,           -- libre, ej. "Martes y jueves 6:00 PM" — solo informativo
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conductor(es) habitual(es) de cada programa — informativo, para mostrar
-- "conducido por Fernando" públicamente. NO es lo que da el permiso real
-- (ver rol super_moderador más abajo).
CREATE TABLE programa_hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id UUID NOT NULL REFERENCES programas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (programa_id, user_id)
);

-- Banco de audios de cada programa — abierto, el conductor sube los que
-- quiera y los nombra como quiera (Intro 1, Intro 2, Salida, Efecto...).
CREATE TABLE programa_audios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id UUID NOT NULL REFERENCES programas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  audio_url TEXT NOT NULL,      -- Backblaze B2, mismo patrón que ElimPlay
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- platikas: vínculo opcional a su programa. NULL = transmisión libre,
-- exactamente como funciona hoy.
ALTER TABLE platikas ADD COLUMN programa_id UUID REFERENCES programas(id);

-- Nuevo rol. El CHECK de profiles.role no tiene nombre fijo (se agregó sin
-- nombre en 0001_init.sql) — igual que hizo 0030_moderador_role.sql, hay que
-- ubicarlo por su definición (pg_constraint + pg_get_constraintdef) antes de
-- reemplazarlo, no adivinar el nombre.
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'anfitrion', 'participante', 'moderador', 'super_moderador'));
-- (más el DROP del constraint viejo, ubicado dinámicamente como en 0030)
```

**RLS:**
- `programas` y `programa_hosts`: `SELECT` público (`USING (TRUE)`) — el nombre y horario de los programas y quién los conduce es información pública, para mostrarla en el sitio. `INSERT`/`UPDATE`/`DELETE` solo `admin`.
- `programa_audios`: `SELECT`/`INSERT`/`UPDATE`/`DELETE` solo para `role IN ('admin', 'super_moderador')` — es una herramienta de producción interna, no contenido público (el público solo lo escucha cuando sale por la radio, no navegando el sitio).
- Como con toda tabla nueva de este proyecto: recordar los `GRANT` explícitos a `authenticated`/`anon` además de las policies (gotcha ya documentado varias veces en este repo).

## 3. El rol `super_moderador`

Es un rol "superior": incluye **todos** los poderes que ya tiene `moderador` (borrar comentarios en Opinión/Videos, moderar el chat en vivo de cualquier plática) **más**:
- Puede abrir el panel de **cualquier** programa (no solo el que tiene asignado en `programa_hosts`) — así puede cubrir a un conductor que falte.
- Puede gestionar el banco de audios de cualquier programa.
- Puede iniciar una transmisión en nombre de cualquier programa.

Dondequiera que hoy se verifique `role IN ('admin', 'moderador')` para moderación, se cambia a `role IN ('admin', 'moderador', 'super_moderador')`. Dondequiera que se necesite acceso a programas, se verifica `role IN ('admin', 'super_moderador')`.

`admin` sigue teniendo acceso total a todo esto sin ninguna restricción adicional — nada de lo anterior le resta permisos a `admin`.

**Sin acceso a `/admin`** — igual que `moderador` hoy, `super_moderador` no obtiene el panel admin general. La gestión de programas (crear/editar la ficha, asignar conductor habitual) vive en `/admin/programas` y sigue siendo exclusiva de `admin`.

## 4. Flujo del conductor

**Entrada:** una página nueva (ej. `/estudio/programas`) lista los programas activos a quien tenga `role IN ('admin', 'super_moderador')`, cada uno con un botón "Ir en vivo". Al presionarlo, se crea automáticamente una fila en `platikas` (título = nombre del programa, `host_id` = el usuario actual, `programa_id` = ese programa) y lo manda directo a la vista de anfitrión de esa transmisión — sin tener que llenar el formulario genérico de "nueva plática" cada vez.

**En el panel del anfitrión**, si la plática tiene `programa_id`, aparece un panel nuevo (junto a los controles de mic/sala/PC que ya existen) con el banco de audios de ese programa:

1. **Preparación, sin tocar la radio:** cada audio tiene un botón "Escuchar" — reproducción **local**, solo para el conductor (un `<audio>` normal en su navegador), para que pueda repasar cuál usar hoy sin que nadie más lo oiga.
2. El conductor **selecciona** (marca/resalta) cuál de sus audios quiere que suene como intro — no hay un tipo especial "intro" en la base de datos, es cualquier clip de la lista, él decide cuál en el momento.
3. **Un solo botón conecta con la radio: "Entrar a la radio".** Es la única acción que interrumpe la programación normal — nada se conecta antes de presionarlo. Esto resuelve el problema del "aire muerto" detectado hoy (hoy, presionar "Salida a radio" conecta y deja silencio hasta que alguien active el micrófono).
4. Al presionarlo: espera 5 segundos, luego reproduce automáticamente el audio seleccionado hacia la radio, y de ahí el conductor sigue hablando normal (mic, sala, PC — igual que hoy).
5. Durante la transmisión, puede disparar cualquier otro audio de su banco en cualquier momento (pausas, efectos, música de transición) sin cortar nada.
6. Al terminar, dispara su audio de salida; ese clip, al terminar de sonar, desconecta solo de la radio.
7. Si el programa no tiene audios cargados (recién creado), sigue disponible el botón clásico "Salida a radio" tal cual existe hoy — nadie queda bloqueado.

**Aislamiento de fallos (ya garantizado, sin cambios):** la transmisión a YouTube/Facebook/TikTok usa LiveKit Egress, un sistema completamente independiente del bridge de radio (WebSocket a AzuraCast). Si "Entrar a la radio" falla o se cae, el conductor puede reintentar sin que eso afecte sus transmisiones a otras plataformas — ya es así hoy, confirmado revisando el código.

## 5. Aviso "🔴 En vivo" en todo el sitio

Mientras cualquier plática esté con `status = 'live'`, aparece en el encabezado de **cualquier página pública** del sitio (no solo dentro del Estudio) un indicador: "🔴 [Nombre del programa] — En vivo" (o "🔴 Estudio — En vivo" si la plática no tiene `programa_id`), con un enlace directo a la transmisión. Se actualiza en tiempo real (Supabase Realtime sobre `platikas`, mismo patrón que otros indicadores en vivo del sitio) sin que nadie tenga que recargar.

## 6. Manejo de errores

- Fallo al conectar con la radio (ej. credenciales, bridge caído): mismo comportamiento que ya tiene "Salida a radio" hoy — mensaje de error visible y botón para reintentar. No bloquea el resto del programa.
- Un audio que no carga (archivo borrado/dañado en B2): no tira la conexión ni el intro — simplemente no suena, y el conductor puede hablar directo o disparar otro clip a mano.

## 7. Qué se reutiliza sin cambios

- `AudioMixer`, `connectRadioBridge`, `captureTabAudio` (`src/lib/radio-broadcast.ts`) — se les agrega un método para reproducir un clip de audio (buffer decodificado) hacia `mixer.destination`, sin tocar lo que ya hacen para mic/sala/PC.
- `RadioBroadcastPanel.tsx` y el resto de `HostControls` — se extiende, no se reescribe.
- Subida de audio a B2 — mismo patrón que `AudioUploadForm.tsx` de ElimPlay.
- Multi-plataforma (YouTube/Facebook/TikTok), chat, escenario, solicitudes — sin cambios.

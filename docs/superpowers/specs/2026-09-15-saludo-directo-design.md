# Saludo Directo — diseño

## Contexto

Elim LLDM ya tiene un sistema de saludos **grabados**: cualquier visitante graba
un audio corto en `/saludo`, queda pendiente de revisión, y el admin (o el
anfitrión de una plática, desde `RadioBroadcastPanel.tsx`) lo reproduce al
aire cuando quiere.

Esta feature es distinta: un **saludo en vivo real**, sin grabación ni
revisión previa — el usuario presiona un botón, su micrófono queda conectado
a la radio pública por exactamente 5 segundos, y se corta solo. Solo puede
usarlo un usuario registrado con una categoría especial ("Oyente Plus"),
igual que hoy existen `moderador` / `super_moderador`.

## Reglas del producto (confirmadas con el usuario)

1. Solo disponible en **tiempo regular** — cuando no hay ninguna plática en
   vivo. Si hay una transmisión activa (Estudio en Vivo), el botón se
   deshabilita.
2. Solo usuarios logueados y con el rol `oyente_plus` (asignado a mano por un
   admin, igual que `moderador`/`super_moderador`) pueden usarlo. El control
   de acceso —no un delay de "bleep"— es la mitigación de riesgo de
   contenido: cualquier abuso se resuelve quitándole el rol al usuario.
3. Duración fija: 5 segundos, sin excepción.

## 1. Control de acceso

### Migración: nuevo rol `oyente_plus`

Nueva migración `supabase/migrations/0050_oyente_plus_role.sql` (la última
migración existente es `0049_saludos_grants.sql`), mismo patrón
que `0030_moderador_role.sql` y `0039_super_moderador_role.sql`: localizar el
CHECK constraint de `profiles.role` dinámicamente por su definición (nunca
tuvo un nombre fijo) y recrearlo agregando `'oyente_plus'`:

```sql
CHECK (role IN ('admin', 'anfitrion', 'participante', 'moderador', 'super_moderador', 'oyente_plus'))
```

Sin cambios de RLS adicionales — `oyente_plus` no necesita ningún permiso de
`moderador`/`super_moderador` sobre chat, pláticas ni archivo. Sus únicos
permisos nuevos son sobre las tablas de esta feature (ver más abajo).

### Asignación del rol

Ninguna UI nueva: agregar `<option value="oyente_plus">Oyente Plus</option>`
a `src/components/admin/RoleSelect.tsx` (el `<select>` que ya aplica el
cambio de rol al elegir la opción) y al filtro de
`src/app/admin/usuarios/page.tsx`.

### Quién puede usar el botón

`role IN ('oyente_plus', 'admin')`. `admin` se incluye para poder probar y
dar soporte sobre la feature sin tener que auto-asignarse `oyente_plus`.
`moderador`/`super_moderador`/`anfitrion` no la ven — es una categoría de
oyente, no de staff.

## 2. Disponibilidad ("tiempo regular")

Se considera "en vivo" si **cualquier** fila de `platikas` tiene
`status = 'live'` — el mismo campo que ya usa `src/app/(public)/page.tsx`
para mostrar el banner de "en vivo ahora". No se toca el esquema de
`programas` (hoy `horario_texto` es texto libre, no estructurado — ver
discusión más abajo en Fuera de alcance).

Este chequeo se hace dos veces:
- En el Server Component de `/saludo-directo`, para decidir qué renderizar.
- Otra vez en `POST /api/saludo-directo/radio-key`, porque nunca hay que
  confiar en el estado que el navegador ya cargó — alguien pudo empezar una
  plática entre que la página cargó y que el usuario dio clic.

## 3. Flujo técnico

### Ruta pública

`src/app/(public)/saludo-directo/page.tsx` — Server Component:

1. `supabase.auth.getUser()` — si no hay sesión, muestra CTA de login.
2. Lee `profiles.role` del usuario — si no es `oyente_plus` ni `admin`,
   muestra un mensaje explicando que es una función exclusiva para Oyentes
   Plus (sin exponer el botón).
3. Consulta si hay alguna `platikas` con `status = 'live'` — si la hay,
   muestra el botón deshabilitado con el motivo.
4. Si todo pasa, renderiza `<SaludoDirectoButton />` (client component).

### Emisión de la clave

`src/app/api/saludo-directo/radio-key/route.ts` — calcado de
`api/platikas/[id]/radio-key/route.ts`:

1. Verifica sesión (401 si no hay).
2. Verifica `profiles.role IN ('oyente_plus', 'admin')` (403 si no).
3. Verifica que ninguna `platikas` esté `status = 'live'` (409 si la hay).
4. Devuelve `{ wsUrl, key }` leyendo `ELIM_RADIO_BRIDGE_WS_URL` /
   `ELIM_RADIO_BRIDGE_KEY` — las mismas env vars que ya usa el Estudio en
   Vivo. No hace falta una cuenta de streamer nueva en AzuraCast: este flujo
   y el de Estudio en Vivo son mutuamente excluyentes en el tiempo (uno
   bloquea al otro por la regla de la sección 2), así que nunca compiten por
   el mismo slot de Icecast.

### Componente cliente

`src/components/saludo-directo/SaludoDirectoButton.tsx`:

1. Al dar clic: `navigator.mediaDevices.getUserMedia({ audio: true })`.
2. `POST /api/saludo-directo/radio-key` → `{ wsUrl, key }`.
3. `connectRadioBridge(wsUrl, key)` (reusa `src/lib/radio-broadcast.ts` tal
   cual — sin cambios en ese archivo).
4. `new AudioMixer()` + `mixer.connect("mic", micStream)` +
   `startStreamingToBridge(mixer.destination.stream, ws)` — se reusa el
   mixer (en vez de mandar el `MediaStream` del mic directo) por consistencia
   con el resto del código y porque ya trae el ruido de piso que evita que
   AzuraCast caiga sola a la programación normal por detectar silencio
   digital puro (ver comentario en `AudioMixer.startKeepAlive()`).
5. UI pasa a estado "AL AIRE" con cuenta regresiva 5 → 0.
6. Insert en `saludos_directos` (ver Data model) apenas la conexión queda
   lista (evento `"ready"` del bridge) — antes de que empiece la cuenta
   regresiva, para que quede registrado incluso si algo falla después.
7. A los 5000ms (temporizador propio del componente, no el `hello` message):
   detiene `MediaRecorder`, `mixer.close()`, detiene el track del mic, cierra
   el WebSocket. Vuelve a estado inicial.
8. Manejo de errores: cualquier falla en pasos 1–3 (permiso de mic denegado,
   bridge no responde, 401/403/409 del backend) muestra el mensaje de error
   correspondiente y no deja ningún estado a medias.

### Constante de duración

`const SALUDO_DIRECTO_DURATION_MS = 5000` exportada desde
`radio-broadcast.ts` o desde el propio componente — un solo lugar para
ajustar la duración si se decide cambiarla más adelante.

## 4. Seguridad del corte a los 5 segundos (defensa en profundidad)

- **Cliente (UX):** el `setTimeout` del paso 7 de arriba. Es lo que el
  usuario ve (la cuenta regresiva) y lo que corta en el caso normal.
- **Servidor (respaldo real — fuera de este repo):** el mensaje `hello` que
  el cliente manda al bridge (`connectRadioBridge` → `ws.send(JSON.stringify({
  type: "hello", key, mode: "saludo_directo" }))`) debe llevar un campo
  `mode` nuevo. Esto requiere un cambio en el código del bridge — que vive en
  `/root/live-bridge-azuracast` en el servidor 46.224.234.223, **un repo/infra
  aparte de elim-lldm** (ver memoria `project_live_bridge.md`) — para que al
  recibir `mode: "saludo_directo"` arranque su propio timer de 5s (con un
  pequeño margen, ej. 5500ms) y fuerce el cierre de la conexión aunque el
  navegador nunca mande la señal de cierre (pestaña congelada, error de JS,
  pérdida de red a medio camino). Sin este respaldo, un fallo del lado del
  navegador podría dejar el micrófono de alguien abierto indefinidamente
  hacia la radio pública.
  - **Esta pieza NO se implementa en el plan de este repo** — queda como
    tarea explícita a coordinar aparte contra el servidor de streaming,
    documentada aquí para que no se pierda. `radio-key/route.ts` y el botón
    se pueden construir y probar sin ella (el timer del cliente ya corta en
    el caso normal), pero no se considera "seguro de verdad" hasta que el
    bridge también la tenga.
- **Caso límite aceptado para v1:** dos oyentes_plus presionando el botón en
  el mismo instante — la segunda conexión probablemente desplace o sea
  rechazada por Icecast/Liquidsoap (un solo slot de streamer). Dado lo
  acotado del público con este rol, no se construye cola/lock para esto.

## 5. Data model

### `saludos_directos` (bitácora)

Migración `supabase/migrations/0051_saludos_directos.sql`:

```sql
CREATE TABLE saludos_directos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saludos_directos_user ON saludos_directos(user_id, created_at DESC);

ALTER TABLE saludos_directos ENABLE ROW LEVEL SECURITY;

-- El propio usuario registra su saludo (vía la API route con su sesión).
CREATE POLICY "saludos_directos_insert_own" ON saludos_directos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Solo admin puede ver la bitácora (para decidir si retirar el rol a alguien).
CREATE POLICY "saludos_directos_select_admin" ON saludos_directos FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

GRANT INSERT, SELECT ON saludos_directos TO authenticated;
```

Sin panel admin dedicado para esta bitácora en v1 — se puede consultar por
SQL Editor cuando haga falta. Si el uso crece, se puede agregar una vista en
`/admin/usuarios` más adelante (fuera de alcance ahora).

## 6. Fuera de alcance (v1)

- **Horario estructurado de `programas`:** el usuario confirmó que el
  bloqueo solo depende de `platikas.status = 'live'`, no de un horario
  programado. Si en el futuro se quiere bloquear también durante la ventana
  de un programa agendado aunque el anfitrión no se haya conectado, hace
  falta agregar columnas de inicio/fin estructuradas a `programas` — eso es
  un proyecto aparte.
- **Rate limiting** (ej. un saludo por usuario por hora/día): no se pidió;
  la mitigación de abuso es el control de acceso por rol, según lo
  confirmado por el usuario. Se puede agregar después leyendo
  `saludos_directos` si hace falta.
- **Delay de seguridad tipo "bleep":** descartado explícitamente a favor del
  enfoque de control de acceso.
- **Panel admin para gestionar la bitácora:** se consulta por SQL Editor por
  ahora.

## 7. Testing

- Manual: con un usuario `oyente_plus` en un navegador real (necesita
  micrófono real, no se puede automatizar con Playwright de forma
  significativa) — verificar que el botón conecta, se escucha en
  `radio.elimlldm.net`, y se corta solo a los 5s.
- Verificar el bloqueo: crear una `platikas` con `status='live'` y confirmar
  que `/saludo-directo` deshabilita el botón y que `radio-key` devuelve 409
  aunque se llame directo con `curl`.
- Verificar el rechazo por rol: usuario `participante` normal no ve el botón
  y `radio-key` devuelve 403 si se llama directo.
- Verificar que la fila en `saludos_directos` se crea correctamente.

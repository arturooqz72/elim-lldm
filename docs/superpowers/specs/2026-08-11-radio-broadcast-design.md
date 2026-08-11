# Salida a radio desde Estudio en Vivo — Diseño

## Contexto

Elim LLDM ya tiene una radio 24/7 en AzuraCast (`radio.elimlldm.net`, servida desde un VPS compartido en `46.224.234.223` junto con la estación de team-desveladoslldm.com) y una funcionalidad de "Estudio en Vivo" (Pláticas) basada en LiveKit donde un anfitrión puede transmitir en vivo, aprobar invitados al escenario, y chatear con la audiencia.

Existe en el código un botón "Salida a radio" en el panel del anfitrión (`HostControls.tsx`) que hoy **no hace nada real**: llama a `/api/platikas/[id]/radio-toggle`, que a su vez intenta invocar un servicio "relay" (LiveKit → AzuraCast vía Railway) que nunca se construyó — la carpeta `relay/` del repo está vacía y las variables de entorno relacionadas (`RELAY_SERVICE_URL`, credenciales de LiveKit Cloud) siguen en placeholder.

Investigación (sesión 2026-08-10/11, acceso SSH de solo lectura al VPS) encontró que **sí existe** un mecanismo probado y funcionando para exactamente este propósito, construido para team-desveladoslldm.com:

- Un servidor Node (`tdv-live-bridge`, puerto 8080 interno) expuesto públicamente vía nginx en `/live/` de cualquier dominio servido por AzuraCast.
- Protocolo: WebSocket → mensaje `{"type":"hello","key":"<BRIDGE_KEY>"}` → responde `{"type":"ready"}` → a partir de ahí cada chunk binario recibido se canaliza a `ffmpeg` (codifica a MP3) → HTTP PUT (protocolo Icecast, Basic Auth) al puerto **DJ** de la estación en AzuraCast, interrumpiendo el AutoDJ.
- Autenticación hacia AzuraCast vía una cuenta "Streamer/DJ" dedicada (tabla `station_streamers`), no las contraseñas generales de la estación.
- **Este bridge está fijo a la estación TDV** (`ICECAST_URL` apunta al puerto DJ de TDV, 8005, con la cuenta `estudio`). La estación Elim LLDM (id 2 en AzuraCast, puerto DJ **8015**) no tiene ninguna cuenta Streamer/DJ creada todavía, así que no se puede reusar la misma instancia sin enviar el audio a la estación equivocada.

## Decisiones tomadas con el usuario

- **Fuente de audio**: tres fuentes independientes, cada una con su propio switch on/off (sin control de volumen):
  1. **Mi micrófono** — el anfitrión.
  2. **Sala completa** — todos los demás participantes en el escenario (invitados aprobados).
  3. **Audio de mi PC/pestaña** — ej. si el anfitrión sintoniza algo en el navegador, que también suene en la radio.
- **Controles**: visibles solo para el anfitrión (o admin), solo mientras la plática está en vivo.
- **Estado inicial al activar**: solo "Mi micrófono" arranca encendido; sala y PC se prenden manualmente.
- **Botón existente**: se reemplaza (no se deja código muerto en paralelo). Se elimina la ruta `/api/platikas/[id]/radio-toggle` y el bloque en `end/route.ts` que intenta detener el relay inexistente.

## Arquitectura

### 1. Infraestructura en el VPS (fuera de este repo — requiere confirmación aparte antes de tocar producción)

- Crear una cuenta Streamer/DJ nueva en AzuraCast para la estación Elim LLDM (tabla `station_streamers`, `station_id=2`), vía el panel admin de AzuraCast (no inserción directa en SQL, para que quede consistente con cómo AzuraCast/Liquidsoap gestiona estas cuentas).
- Nueva instancia de `tdv-live-bridge` (mismo `server.js`, sin modificar su lógica) en un nuevo servicio docker-compose, con:
  - `ICECAST_URL=icecast://<usuario-nuevo>:<password-nueva>@172.19.0.3:8015/`
  - `BRIDGE_KEY=<clave nueva, distinta a la de TDV>`
- Nueva entrada nginx en el conf.d de AzuraCast, ej. `location ^~ /live-elim/ { proxy_pass http://elim-live-bridge:8080/; ... }` (mismo patrón que `live-bridge.conf`, apuntando al contenedor nuevo).

### 2. Backend en elim-lldm

**Nuevo:** `src/app/api/platikas/[id]/radio-key/route.ts`
- `POST`, verifica sesión + que el usuario sea `host_id` de la plática o `role='admin'`, y que `pláticas.status === 'live'`.
- Si pasa, responde `{ wsUrl: "wss://radio.elimlldm.net/live-elim/", key: process.env.ELIM_RADIO_BRIDGE_KEY }`.
- Si no, 401/403/400 según corresponda (mismo patrón que las rutas existentes de `platikas`).
- Nueva variable de entorno server-only: `ELIM_RADIO_BRIDGE_KEY` (nunca `NEXT_PUBLIC_*` — no debe llegar al bundle del cliente en reposo, solo se entrega bajo demanda a un host autenticado).

**Eliminar:**
- `src/app/api/platikas/[id]/radio-toggle/route.ts` (llama al relay inexistente).
- El bloque en `src/app/api/platikas/[id]/end/route.ts` (líneas ~71-84) que intenta hacer `fetch` al `RELAY_SERVICE_URL` para detener un relay que no existe.

### 3. Frontend

**Cambio estructural necesario en `LiveKitRoom.tsx`:** actualmente `<LKRoom>` (de `@livekit/components-react`) envuelve solo el `stage` (`<StagePanel/>`); el `sidebar` (que contiene `HostControls`) se renderiza como hermano, **fuera** del contexto de LiveKit. Esto significa que hoy `HostControls` no tiene forma de acceder a los tracks de audio de los participantes vía los hooks de LiveKit (`useTracks`, `useRoomContext`).

Hay que mover `<LKRoom>` para que envuelva tanto `stage` como `sidebar` (todo el contenido de `RoomLayout`), en vez de solo `stage`. Esto es puramente estructural — no cambia el layout visual (sigue siendo el mismo flex de `RoomLayout`), solo mueve el límite del *provider* de contexto de React para que los hijos del sidebar (incluyendo el nuevo panel) puedan usar los hooks de LiveKit.

**Nuevo componente:** `src/components/platikas/RadioBroadcastPanel.tsx` (reemplaza el botón "Salida a radio" dentro de `HostControls.tsx`, visible solo si `isLive`).

Estados: `idle → connecting → live → error`, con las tres fuentes como switches independientes dentro del estado `live`.

Flujo:
1. Al activar el panel por primera vez: `POST /api/platikas/[id]/radio-key` para obtener `wsUrl` + `key`.
2. Abre el `WebSocket`, manda `{"type":"hello","key":...}`, espera `{"type":"ready"}`.
3. Crea un `AudioContext` + `MediaStreamAudioDestinationNode` (el "mezclador").
4. Usa `useTracks([Track.Source.Microphone])` (hook de `@livekit/components-react`) para obtener los tracks de audio actuales de la sala:
   - Filtra `participant.isLocal` para el track del anfitrión → conectado/desconectado del mezclador según el switch "Mi micrófono".
   - El resto (`!participant.isLocal`) → conectados/desconectados según el switch "Sala completa". Como `useTracks` es reactivo, si un invitado nuevo sube al escenario mientras "Sala completa" está en ON, su track se suma automáticamente al mezclador.
5. Switch "Audio de mi PC/pestaña": al activarlo, `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })` → dispara el picker nativo del navegador. Se descarta el track de video inmediatamente (`track.stop()`) y solo el track de audio se conecta al mezclador. Si el usuario cancela el picker o el navegador no soporta compartir audio, el switch vuelve a OFF con un mensaje inline — no rompe las otras fuentes.
6. El stream de salida del `MediaStreamAudioDestinationNode` se graba con `MediaRecorder` (con `timeslice`, ej. cada 250ms) y cada chunk (`dataavailable`) se manda por el WebSocket como mensaje binario — mismo patrón que usa el bridge de TDV.
7. Al conectar exitosamente (primer `ready`), hace `UPDATE platikas SET radio_output_active = true WHERE id = ...` directo con el cliente de Supabase (ya permitido por RLS existente para el host) — reutiliza el mismo campo que ya alimenta el badge "🔴 en la radio" en `/platikas`, `/platikas/[id]` y el panel admin, sin tocar esas páginas.
8. Al desactivar el panel (o si la plática termina / el componente se desmonta): cierra el `WebSocket`, detiene el `MediaRecorder`, detiene y desconecta todos los tracks/nodos del mezclador (incluyendo detener el track de `getDisplayMedia` si estaba activo), y pone `radio_output_active = false`.

**Cambio en `HostControls.tsx`:** se quita el botón/estado `toggleRadio`/`radioActive` actual y se reemplaza por `<RadioBroadcastPanel platikaId={platikaId} isLive={isLive} />` dentro del mismo bloque "Controles del anfitrión".

## Manejo de errores

| Caso | Comportamiento |
|---|---|
| `radio-key` falla (no es host, o plática no está live) | El panel no se muestra / no se puede activar |
| WebSocket rechaza la conexión o se cae a media transmisión | Estado visual de error, botón "Reintentar" que reabre el WebSocket sin perder qué fuentes estaban activas |
| `getDisplayMedia` cancelado/denegado | Solo ese switch vuelve a OFF con mensaje; mic/sala siguen intactos |
| El anfitrión cierra la pestaña o pierde conexión mientras transmite | La transmisión se corta (limitación inherente del enfoque cliente→bridge, igual que ya tiene TDV hoy — no es una regresión) |
| La plática termina (`end/route.ts`) mientras la radio está activa | `radio_output_active` ya se pone en `false` ahí; el desmontaje de `<LKRoom>` dispara la limpieza del panel (cierre de WebSocket, detener tracks) |

## Testing

- Verificación manual en navegador (Chrome vía `claude-in-chrome`) de: visibilidad del panel solo para host+live, comportamiento de los tres switches (incluyendo que `getDisplayMedia` cancelado no rompe nada), y que `radio-key` responde 403 para un usuario no-host.
- La transmisión real end-to-end (audio llegando de verdad a `radio.elimlldm.net`) requiere la infraestructura del VPS ya desplegada (Paso 1) — se prueba manualmente en producción con el usuario, igual que se hizo con el saludo en audio.
- No se agregan tests automatizados — consistente con el resto del proyecto (sin suite de tests).

## Fuera de alcance (explícito)

- Sliders de volumen por fuente — solo on/off.
- Resiliencia si el anfitrión cierra la pestaña (limitación aceptada, igual que el sistema de TDV existente).
- Grabar/archivar la transmisión de radio (separado del audio que ya se graba de la plática en sí, si aplica).
- Cambiar cómo funciona el streaming a YouTube/Facebook/TikTok (`stream-toggle`, basado en LiveKit Egress) — es un mecanismo distinto y ya funcional, no se toca.
- Automatizar la creación de infraestructura del VPS (paso 1) desde este repo — es trabajo manual/uno-a-uno en el servidor, documentado pero no scriptado como parte de este plan.

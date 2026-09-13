# Backstage (Green Room) — Design Spec

## Why

Hoy, en cuanto el conductor le da "Ir en vivo" a un Programa (`api/platikas/create-live`), la plática nace con `status: 'live'` de inmediato — aparece en la lista pública `/platikas` y cualquiera puede entrar a verlo/escucharlo por el sitio web, aunque el conductor todavía esté probando micrófono, eligiendo el audio de intro, o esperando a que el equipo esté listo.

El usuario (dueño del proyecto, quien también usa StreamYard para otras producciones) pidió explícitamente que el Estudio en Vivo funcione "como StreamYard" en este aspecto: un espacio privado de preparación (**Greenroom/backstage** en términos de StreamYard) antes de salir al aire.

## Referencia: cómo lo resuelve StreamYard

Investigado en streamyard.com/multistreaming y la página principal (sin necesidad de cuenta, vía capturas públicas del producto):

- **Greenroom**: sala privada donde el host prueba cámara/mic y coordina con invitados *antes* de entrar al estudio. Nadie fuera de esa sala ve ni escucha nada todavía.
- El host mueve manualmente a alguien del Greenroom al estudio en vivo (o, para un solo host, simplemente da clic en "Go Live" cuando está listo).
- Separado de esto: el panel de "Destinations" (fuera de alcance de este spec — ver spec de destinos múltiples, fase 2).

## Decisión de diseño para este proyecto

**No se construye desde cero.** Auditando el código se encontró que `HostControls.tsx` ya tiene un botón "Ir en Vivo" y una ruta `api/platikas/[id]/go-live` que transicionan cualquier estado *distinto de* `'live'` hacia `'live'`, creando la sala de LiveKit en ese momento — es exactamente la mecánica de "salir al aire" que hace falta. Quedó huérfana cuando el flujo de Programas empezó a poner `status: 'live'` desde `create-live` directamente (no queda ningún estado intermedio desde el cual darle clic).

El plan es revivir esa ruta como el botón "Salir al aire", y hacer que `create-live` deje la plática en un estado nuevo — `backstage` — en vez de `live`.

### Estados de una plática (`platikas.status`)

| Estado | Quién la ve/escucha | Sala LiveKit | Grabación | Streaming a plataformas |
|---|---|---|---|---|
| `backstage` (nuevo) | Solo el host (`host_id`) | Ya creada — el host prueba mic/cámara | No | No disponible |
| `live` | Público | Activa | Sí (arranca aquí) | Disponible |
| `ended` | Nadie (solo grabación si existe) | Cerrada | Se finaliza | Detenido |

`scheduled` sigue existiendo en el esquema (no se borra) pero ya no lo produce ningún flujo actual — se deja tal cual, sin usarse, para no romper código legado que lo referencie.

### Alcance (YAGNI explícito)

- **Solo el host inicial tiene acceso al backstage.** StreamYard permite invitar a otros al Greenroom antes de salir al aire; este proyecto no lo necesita todavía (los "conductores" de un programa son informativos, no roles de acceso — ver `programa_hosts`). Si se pide después, es una extensión aislada (agregar una tabla de invitados al backstage), no un rework.
- **La grabación se mueve de `create-live` a `go-live`.** No tiene sentido grabar la fase de pruebas privada.
- **El banco de audios / música de fondo / mezcla de mic sigue exactamente igual** — vive en `RadioBroadcastPanel`, que ya solo se muestra cuando `isLive` es `true` (nunca en backstage), porque activar la salida a la radio real (AzuraCast) durante las pruebas sería justo el problema que se quiere evitar.
- **Streaming a YouTube/Facebook** (`HostControls` → `PlatformStreamCard`) también ya está gateado por `isLive` — no requiere cambios para respetar el backstage.

### Riesgo identificado y mitigado

`create-live` YA crea la sala de LiveKit (necesaria para que el host pruebe mic/cámara en backstage). Si `go-live` vuelve a llamar `roomService.createRoom()` sobre una sala que ya existe, puede fallar o duplicar. `go-live` debe ser **idempotente**: si `platikas.livekit_room_name` ya está seteado (por `create-live`), omite la creación de sala y solo transiciona el estado + arranca la grabación.

**Segundo riesgo, introducido por el propio backstage:** antes, un click accidental en "Ir en vivo" desde `/platikas/programas` era visible de inmediato (`status: 'live'`), así que el usuario lo notaba enseguida. Con backstage, una sesión "olvidada" a medio preparar es invisible — es fácil que el conductor vuelva a `/platikas/programas` y le dé clic otra vez al mismo programa, creando una segunda fila de `platikas` y una segunda sala de LiveKit huérfanas. La página de Programas debe detectar si ya existe una sesión `backstage` o `live` para ese programa y ofrecer "Continuar" hacia ella en vez de crear una nueva.

## Fuera de alcance de este spec

- Destinos múltiples de streaming (YouTube/Facebook de Elim + personales del conductor) — spec y plan aparte, fase 2, después de que este backstage esté probado en producción.
- Invitar a otros al backstage antes de salir al aire.
- Escenas/layouts de video (StreamYard "Scenes") — este estudio es primero-audio (radio); no se ha pedido.

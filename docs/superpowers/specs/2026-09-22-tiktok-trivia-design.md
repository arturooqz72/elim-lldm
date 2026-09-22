# Trivia en vivo con participación desde TikTok — spec de diseño

**Fecha:** 2026-09-22
**Estado:** Aprobado por el usuario, pendiente de plan de implementación.

## Contexto y propósito

Elim LLDM ya tiene varios juegos de trivia (Elim Arena, Arena Abierta, Trivia en Vivo) y una Ruleta pensada específicamente para transmitir en vivo en TikTok, pero en todos los casos los participantes tienen que entrar al sitio elimlldm.net. El usuario quiere un juego de trivia donde los espectadores de un TikTok Live **participen directamente comentando en el propio TikTok** (respondiendo A/B/C/D), sin salir de la app de TikTok.

TikTok no ofrece una API pública oficial para leer comentarios de un live en tiempo real de forma sencilla; el camino usado en la práctica por creadores de contenido es la librería no oficial `tiktok-live-connector` (npm), que se conecta al protocolo interno de TikTok Live usando solo el nombre de usuario del streamer, sin necesitar aprobación ni credenciales de TikTok como partner.

## Decisiones de alcance (confirmadas con el usuario)

1. **Una sola cuenta fija:** solo la cuenta oficial de Elim LLDM en TikTok. No hay soporte multi-cuenta/multi-anfitrión en esta primera versión.
2. **Pantalla standalone, no dentro del Estudio en Vivo:** es una página/pantalla aparte que se comparte completa durante la transmisión de TikTok — no se integra en `StudioShell`/`HostControls` de Pláticas.
3. **Reusa el banco de preguntas existente:** mismos `question_sets`/`questions` que ya usan Elim Arena y Trivia en Vivo. No hay un banco de preguntas nuevo y separado.
4. **Ritmo controlado por el anfitrión:** igual que la "compuerta" de la Ruleta — el host decide cuándo se abre cada pregunta y cuándo se revela la respuesta, no hay temporizador automático.
5. **Puntaje: primero en acertar gana el punto.** Es una carrera — el primer comentario que acierte la letra correcta se lleva el punto de esa pregunta; los aciertos posteriores de esa misma pregunta no cuentan. El leaderboard es acumulado dentro de la sesión (no persiste entre lives distintos).
6. **Acceso a la pantalla de control:** requiere sesión iniciada con rol anfitrión o admin — mismo patrón de chequeo de rol que el resto del sitio, no es una URL secreta sin login.
7. **El listener de TikTok corre como servicio en el VPS del usuario** (46.224.234.223), no como script local ni dentro de Vercel — Vercel no soporta conexiones WebSocket persistentes de larga duración, que es justo lo que exige mantener la conexión al live de TikTok.

## Arquitectura

Nuevo subproyecto **`tiktok-trivia-bridge/`** en el VPS, con su propio `package.json`, siguiendo el mismo patrón ya establecido en el repo para servicios auxiliares fuera del Next.js principal (ver `relay/` — "no mezclar el código del relay en el repo Next.js", CLAUDE.md).

```
Página de control (Next.js, sesión anfitrión/admin)
   ⇄ WebSocket ⇄ tiktok-trivia-bridge (proceso Node en el VPS)
                     ⇄ tiktok-live-connector ⇄ TikTok Live (cuenta oficial Elim LLDM)
```

- La página de control abre un WebSocket directo al bridge, autenticado con una clave compartida en variable de entorno (mismo patrón que `ELIM_RADIO_BRIDGE_KEY` del bridge de radio existente; aquí sería `ELIM_TIKTOK_BRIDGE_KEY`).
- El bridge NO se conecta a TikTok hasta que el host lo pide explícitamente (clic en "Conectar a TikTok Live" en la página de control) — evita mantener una conexión abierta 24/7 sin uso.

### Protocolo WebSocket (mensajes principales)

Del cliente (página de control) al bridge:
- `{type: "start_session"}` — conecta al live de la cuenta fija.
- `{type: "open_question", questionId, correctOption}` — empieza a comparar comentarios entrantes contra `correctOption` para esa pregunta.
- `{type: "close_question"}` — deja de aceptar respuestas hasta la siguiente `open_question`.
- `{type: "end_session"}` — desconecta del live de TikTok.

Del bridge a la página de control:
- `{type: "connected"}` / `{type: "error", reason: "not_live"}` — resultado de `start_session`.
- `{type: "winner", tiktokUsername, tiktokDisplayName, answer, ts}` — se emite una sola vez por pregunta, para el primer comentario que acierte.
- `{type: "error", reason: "tiktok_disconnected"}` — el bridge perdió la conexión con TikTok a media sesión (distinto de que el WS entre la página y el bridge se caiga).

### Flujo del juego

1. Host abre la página de control, elige un `question_set` existente, clic en "Conectar a TikTok Live".
2. Si la cuenta no está en vivo en ese momento, el bridge responde con error inmediato (`not_live`) en vez de quedarse esperando indefinidamente.
3. Host clic en "Mostrar pregunta" → `open_question` con la pregunta actual y su letra correcta.
4. El bridge compara cada comentario nuevo (normalizando mayúsculas/espacios) contra la letra correcta; el primero que acierte dispara `winner` y el bridge ignora aciertos posteriores de esa pregunta.
5. Host clic en "Revelar respuesta" → `close_question`; se muestra la respuesta correcta y quién ganó (si alguien ganó).
6. Se repite el ciclo 3–5 por cada pregunta del set.
7. Al terminar el set, pantalla de resultados finales (podio); host clic en "Terminar" → `end_session`, el bridge se desconecta de TikTok.

## Modelo de datos

Dos tablas nuevas en Supabase (proyecto `rdejlzuqtiigjjtclnpn`), con RLS + GRANTs explícitos a `authenticated` restringidos por rol (admin/anfitrión) — sin acceso público, siguiendo el patrón ya usado en el resto del proyecto (gotcha documentado repetidamente: crear una tabla sin sus GRANTs explícitos rompe el acceso aunque la policy esté bien).

**`tiktok_trivia_sesiones`** — una fila por partida en vivo:
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `question_set_id` | uuid FK → `question_sets` | set elegido al conectar |
| `started_by` | uuid FK → `profiles` | quién corrió la sesión |
| `started_at` | timestamptz | |
| `ended_at` | timestamptz nullable | |
| `status` | text | `conectando` / `en_vivo` / `finalizada` |

**`tiktok_trivia_respuestas`** — una fila por pregunta que tuvo ganador (si nadie acierta antes de "Revelar", esa pregunta no genera fila):
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `sesion_id` | uuid FK → `tiktok_trivia_sesiones` | |
| `question_id` | uuid FK → `questions` | |
| `tiktok_username` | text | handle público de TikTok de quien acertó |
| `tiktok_display_name` | text | nombre para mostrar |
| `respondida_en` | timestamptz | |

El leaderboard en pantalla se calcula agrupando `tiktok_trivia_respuestas` por `tiktok_username` dentro de la sesión activa — no hace falta una tabla de puntajes aparte.

## Página de control (Next.js)

Ruta nueva protegida (mismo chequeo de rol server-side que Elim Arena/Estudio: solo anfitrión o admin). Tres pantallas dentro de una sola página:

**Configurar** — selector de `question_sets` existentes + botón "Conectar a TikTok Live" con estado en vivo (conectando / conectado / "la cuenta no está en vivo ahora").

**En vivo** — pensada para compartir pantalla completa durante la transmisión:
- Pregunta actual en grande + las opciones (A/B/C/D).
- Botones "Mostrar pregunta" y "Revelar respuesta".
- Aviso destacado al llegar el evento `winner`: "🏆 @usuario acertó con B".
- Leaderboard acumulado de la sesión, visible a un lado.
- Botón "Siguiente pregunta"; al agotar el set, pasa sola a Resultados finales.

**Resultados finales** — podio con quienes más preguntas ganaron en la sesión (mismo estilo visual que el podio de la Ruleta), botón "Terminar" que dispara `end_session`.

## Manejo de errores

- **Cuenta no está en vivo:** error inmediato del bridge (`not_live`), mensaje claro en la UI en vez de spinner indefinido.
- **Se cae el WebSocket entre la página y el bridge** (VPS reinicia, red se cae): banner "Conexión perdida, reconectando…" con reintento automático — mismo patrón que ya usa `RadioBroadcastPanel` para su propio WS.
- **Se cae la conexión del bridge con TikTok a media sesión:** el bridge lo reporta como `tiktok_disconnected`, distinto del cierre del WS con la página, para mostrar el mensaje correcto.
- **Nadie acertó antes de "Revelar":** se muestra "Nadie acertó esta", no se inserta fila en `tiktok_trivia_respuestas`, el juego sigue normal.
- **Riesgo conocido y aceptado, sin mitigación posible de antemano:** `tiktok-live-connector` es una librería no oficial basada en ingeniería inversa del protocolo interno de TikTok, no una API con contrato — puede dejar de funcionar sin aviso si TikTok cambia algo internamente.

## Testing / verificación

- **Lógica del bridge, offline:** simular el emisor de eventos de `tiktok-live-connector` con un mock en pruebas locales, para validar "primer comentario correcto gana, los siguientes se ignoran" y la normalización de mayúsculas/espacios en las respuestas, sin depender de un live real.
- **Típecheck + build** del lado Next.js (`npx tsc --noEmit`, `npm run build`) antes de dar por buena cualquier tarea del plan de implementación.
- **Verificación en vivo real (única forma de probar extremo a extremo):** un live corto de prueba en la cuenta oficial de Elim LLDM, confirmando: conexión exitosa al live, un comentario correcto dispara el ganador correcto, el leaderboard acumula bien entre preguntas, "Revelar" bloquea respuestas tardías, y "Terminar" corta la conexión al bridge limpiamente. No se puede automatizar desde una sesión de Claude Code — queda como checklist para el usuario (o para correr juntos compartiendo pantalla).

## Fuera de alcance (explícitamente, para esta primera versión)

- Soporte para más de una cuenta de TikTok / multi-anfitrión.
- Integración dentro del Estudio en Vivo de Pláticas.
- Banco de preguntas propio y separado del ya existente.
- Persistencia de puntajes entre distintas transmisiones (el leaderboard es por sesión).
- Cualquier forma de detección de trampas/bots más allá de "un comentario por usuario, el primero cuenta" — no hay verificación de identidad de TikTok posible desde este lado.

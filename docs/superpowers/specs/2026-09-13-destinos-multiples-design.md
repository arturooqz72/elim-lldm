# Destinos Múltiples — Diseño

## Por qué

Hoy el Estudio en Vivo solo puede transmitir a **una** cuenta de YouTube, **una** de Facebook y **una** de TikTok por sesión — el esquema tiene 3 columnas fijas (`youtube_egress_id`, `facebook_egress_id`, `tiktok_egress_id`) en `platikas`, y cada plataforma es una tarjeta hardcodeada en `HostControls.tsx` (`STREAM_PLATFORMS`). Además, la URL RTMP y el stream key se vuelven a escribir a mano cada vez que se sale al aire — no se guardan.

En la práctica esto no alcanza: un programa puede necesitar transmitir a dos canales de YouTube (el propio y el de otra iglesia hermana), o el equipo cambia de página de Facebook según el evento. Y volver a teclear el stream key cada sesión es tedioso y propenso a error (es un dato sensible, largo, que se pega desde otro lugar).

## Referencia: StreamYard

StreamYard resuelve esto con un catálogo de **Destinos** guardados de una sola vez (se conectan por OAuth o se configuran manualmente) que después aparecen como chips/tarjetas dentro del panel de transmisión — cada uno con un switch independiente para activarlo o no en la sesión actual. Se pueden tener varios destinos de la misma plataforma (dos YouTube, por ejemplo) transmitiendo simultáneamente.

Elim LLDM no tiene volumen ni presupuesto para integrar OAuth con YouTube/Facebook/TikTok (eso implica apps registradas, revisión de cada plataforma, tokens que expiran, etc. — completamente fuera de alcance). Lo que sí vale la pena copiar es la mecánica: **destinos guardados, reutilizables, con toggle independiente por sesión**, usando RTMP + stream key manual (que es como ya funciona hoy, solo que sin guardar nada).

## Alcance

**Incluido:**
- Catálogo de "Destinos" compartido por todo el equipo de producción (no por-host — es un equipo chico y de confianza, todos ven y usan los mismos destinos guardados).
- Cada destino: nombre libre (ej. "YouTube Iglesia Central"), plataforma (youtube/facebook/tiktok/otro), URL RTMP, stream key.
- El stream key se guarda **cifrado en reposo** (AES-256-GCM, clave solo en el servidor) — nunca se vuelve a mostrar en texto plano al cliente después de guardarlo, ni siquiera al propio admin. Si hay que cambiarlo, se sobrescribe.
- Múltiples destinos activos simultáneamente en una misma plática, incluyendo varios de la misma plataforma.
- Alta/edición/borrado de destinos desde el mismo panel de "Salir al aire" (no una pantalla de admin aparte).
- Un destino no se puede editar ni borrar mientras está transmitiendo activamente en cualquier plática — hay que detenerlo primero.

**Fuera de alcance (YAGNI):**
- Integración OAuth con las plataformas (conectar cuenta con un clic, refrescar el stream key automáticamente).
- Destinos privados por host — todo el equipo comparte el mismo catálogo.
- Branding/overlays de marca sobre el video (logo, nombre en pantalla) — StreamYard lo tiene, pero es una función de edición de video en vivo, no de destinos.
- Programar qué destinos se activan automáticamente al salir al aire — se activan a mano cada vez, igual que hoy.

## Modelo de datos

```sql
-- Catálogo de destinos, reutilizable entre sesiones y programas.
CREATE TABLE destinos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  plataforma TEXT NOT NULL CHECK (plataforma IN ('youtube', 'facebook', 'tiktok', 'otro')),
  rtmp_url TEXT NOT NULL,
  stream_key_cifrado TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE, -- soft delete: preserva el historial de platikas_stream_egresos
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historial de qué destinos se transmitieron en cada plática — reemplaza
-- las 3 columnas fijas youtube/facebook/tiktok_egress_id.
CREATE TABLE platikas_stream_egresos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platika_id UUID NOT NULL REFERENCES platikas(id) ON DELETE CASCADE,
  destino_id UUID NOT NULL REFERENCES destinos(id),
  egress_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stopped_at TIMESTAMPTZ -- NULL = transmitiendo activamente ahora mismo
);

CREATE INDEX idx_stream_egresos_platika ON platikas_stream_egresos(platika_id);
CREATE INDEX idx_stream_egresos_activos ON platikas_stream_egresos(destino_id) WHERE stopped_at IS NULL;
```

Se eliminan `youtube_egress_id`, `facebook_egress_id`, `tiktok_egress_id` de `platikas` (nada las usa fuera de `stream-toggle/route.ts`, que se reemplaza por completo).

## Cifrado del stream key

`src/lib/crypto/destinos.ts` — AES-256-GCM con una clave de 32 bytes en la variable de entorno `DESTINOS_ENCRYPTION_KEY` (base64), presente solo en el servidor (Vercel + `.env.local`), nunca en `NEXT_PUBLIC_*`. El valor guardado en `stream_key_cifrado` es `iv.tag.ciphertext` (cada parte en base64, separadas por punto). Se descifra únicamente dentro de la API route que arranca el egress, justo antes de construir la URL RTMP completa — nunca se envía al cliente.

## API

- `GET /api/destinos` — lista el catálogo (id, nombre, plataforma, rtmp_url — **sin** el stream key ni cifrado ni en claro). Admin/super_moderador.
- `POST /api/destinos` — crea `{ nombre, plataforma, rtmp_url, stream_key }`, cifra el key antes de insertar.
- `PATCH /api/destinos/[id]` — edita `{ nombre?, plataforma?, rtmp_url?, stream_key? }`; si `stream_key` viene vacío/omitido se conserva el cifrado existente. Rechaza si el destino tiene un egreso activo (`stopped_at IS NULL`) en cualquier plática.
- `DELETE /api/destinos/[id]` — soft delete (`activo = false`); mismo rechazo si está activo.
- `GET /api/platikas/[id]/destinos` — devuelve el catálogo fusionado con el estado de la plática actual: `{ id, nombre, plataforma, rtmp_url, isActive, egresoId }[]`.
- `POST /api/platikas/[id]/destinos/[destinoId]/toggle` — `{ action: 'start' | 'stop' }`. `start` descifra el key, arma la URL RTMP completa, llama `egressClient.startRoomCompositeEgress` (igual mecanismo que hoy, un egress por destino) e inserta una fila en `platikas_stream_egresos`. `stop` busca la fila activa, llama `stopEgress` y le pone `stopped_at`.

Todas las rutas verifican rol `admin`/`super_moderador` server-side, igual que el resto del Estudio en Vivo.

## UI

Dentro de `HostControls.tsx`, la sección fija "Transmisión a plataformas" (con `STREAM_PLATFORMS` y `PlatformStreamCard`) se reemplaza por un nuevo `DestinationsPanel`:

- Lista de tarjetas (`DestinoCard`), una por destino del catálogo: ícono + color según plataforma (mismo mapeo de hoy: YouTube rojo, Facebook azul, TikTok turquesa, "otro" dorado genérico), nombre, punto pulsante cuando está activo, switch para prender/apagar.
- Botón **"+ Agregar destino"** abre `DestinoFormModal` (crear o editar) con campos nombre, plataforma (select), URL RTMP, stream key.
- Cada tarjeta tiene íconos de editar/borrar, deshabilitados mientras ese destino está activo en la plática actual.
- Mismo estilo visual "santuario oscuro" ya establecido (superficie oscura, acentos dorados, `--color-*` variables).

## Riesgos

- **`DESTINOS_ENCRYPTION_KEY` faltante en producción** rompe el arranque de cualquier transmisión — se genera y se configura como parte de la Tarea 1, antes de escribir código que dependa de ella.
- **Límite de egresos concurrentes de LiveKit Cloud**: cada destino activo es un `RoomCompositeEgress` separado (igual que hoy con 3 plataformas); si el equipo activa muchos destinos a la vez podría toparse con el límite del plan de LiveKit Cloud — no se valida en código, es un límite externo a monitorear si se usa mucho.
- **Migración de datos**: no hay sesiones en vivo usando las columnas viejas ahora mismo (verificado), así que se eliminan sin migración de datos.

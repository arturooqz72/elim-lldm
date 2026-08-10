# Saludo en audio — Diseño

## Contexto

El sitio ya tiene una página `/contacto` con un formulario de texto para sugerencias (tabla `sugerencias`, INSERT público vía RLS, sin lectura pública). El usuario quiere agregar una funcionalidad separada: que cualquier visitante pueda **grabar un saludo en audio desde el navegador** y enviarlo, para que el administrador (dueño del sitio) pueda **descargarlo y subirlo a la radio** (AzuraCast).

## Decisiones tomadas con el usuario

- **Ubicación**: página pública nueva y dedicada, `/saludo` (no dentro de `/contacto`).
- **Datos solicitados**: solo **nombre** de quien graba (sin correo).
- **Duración máxima**: **60 segundos**, corte automático.
- **Formato de audio**: el nativo del navegador (WebM/OGG vía `MediaRecorder`) — no se convierte a MP3 en el sitio; el admin lo convierte manualmente si lo necesita antes de subirlo a AzuraCast.
- **Acceso admin**: página nueva `/admin/saludos`, siguiendo el mismo patrón que `/admin/archivo` y `/admin/elimplay` (protegida por `role === 'admin'` vía el layout admin existente), con lista, reproductor por saludo y botón de descarga.
- **Privacidad del storage**: bucket de Supabase Storage **privado**. El admin accede a cada audio vía URL firmada temporal generada server-side; nadie más puede reproducir/descargar un saludo con solo conocer su URL.

## Arquitectura

```
src/app/(public)/saludo/page.tsx        # Server Component: shell + metadata (patrón /contacto)
src/components/saludo/SaludoRecorder.tsx # Client Component: grabación + envío

src/app/admin/saludos/page.tsx          # Server Component: lista + URLs firmadas (patrón /admin/archivo)

supabase/migrations/00XX_saludos.sql    # tabla `saludos` + bucket + RLS + policies de Storage
```

Se agrega el link "Saludo en audio" al `PublicHeader` (nav) y `PublicFooter`, y "Saludos" al `AdminSidebar`, siguiendo exactamente los mismos patrones ya usados para "Contáctanos" y las demás secciones de admin.

## Flujo de grabación (`SaludoRecorder.tsx`)

Estados: `idle → nombre-y-grabando → grabado (preview) → enviando → success | error`.

1. El visitante escribe su nombre (validación inline: no vacío, máx. 120 caracteres — mismo estilo visual que `ContactForm.tsx`).
2. Al pulsar "Grabar", se pide permiso de micrófono con `navigator.mediaDevices.getUserMedia({ audio: true })`.
   - Si el permiso es denegado o el navegador no soporta `MediaRecorder`, se muestra un mensaje de error claro (sin crash), con instrucciones básicas de cómo habilitar el micrófono.
3. Se graba con `MediaRecorder`, mostrando un contador ascendente (mm:ss) y un indicador visual de "grabando". Al llegar a 60s, se detiene automáticamente (igual que si el usuario presionara "Detener").
4. Al detener (manual o automático), se genera un `Blob` y se muestra:
   - Reproductor `<audio controls>` para escuchar el resultado.
   - Botón **"Grabar de nuevo"** (descarta el blob actual y vuelve al paso 2).
   - Botón **"Enviar saludo"**.
5. Al enviar:
   - Sube el `Blob` al bucket `saludos` en una ruta única (ej. `${Date.now()}-${crypto.randomUUID()}.<ext>`, donde `<ext>` se deriva del `mimeType` real que reportó `MediaRecorder` — `audio/webm` → `webm`, `audio/ogg` → `ogg` — para que la extensión del archivo nunca mienta sobre su formato real entre navegadores) usando el cliente browser de Supabase (`createClient()`, anon key) — mismo mecanismo de `supabase.storage.from(bucket).upload()` que usa `AudioUploadForm.tsx`, pero con la key anónima en vez de un token de sesión admin.
   - Inserta una fila en la tabla `saludos` con `nombre`, `audio_path` (la ruta, no una URL pública — el bucket es privado) y `duration_seconds`.
   - Si cualquiera de los dos pasos falla, se muestra un mensaje de error con opción de **reintentar sin perder la grabación** (el blob se mantiene en el estado del componente).
6. Éxito: tarjeta de confirmación igual en estilo a la de `ContactForm.tsx`, con opción de grabar otro saludo.

El campo nombre y el flujo de envío van dentro de un `<form>` con `noValidate`, siguiendo la lección aprendida en `ContactForm.tsx`: no debe depender de validación nativa del navegador para que los mensajes de error personalizados siempre se muestren.

## Datos

### Tabla `saludos`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `nombre` | TEXT NOT NULL | CHECK largo entre 1 y 120 (trim) |
| `audio_path` | TEXT NOT NULL | Ruta dentro del bucket `saludos`, no URL pública |
| `duration_seconds` | INT NOT NULL | CHECK > 0 y <= 60 |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

RLS: igual que `sugerencias` — solo policy de **INSERT** para `anon, authenticated` (`WITH CHECK (TRUE)`), sin policy de SELECT/UPDATE/DELETE para esos roles. Se agrega `GRANT INSERT ON saludos TO anon, authenticated`. El service role ya tiene acceso completo vía el GRANT global de `0003_trivia_grants.sql`.

### Storage bucket `saludos`

- Bucket **privado** (`public = false` al crearlo).
- Policy en `storage.objects` que permite `INSERT` a `anon, authenticated` cuando `bucket_id = 'saludos'`.
- Sin policy de `SELECT` para `anon`/`authenticated` — solo el service role (que bypassea RLS) puede leer, y lo hace exclusivamente desde `/admin/saludos` vía `createServiceClient()` para generar URLs firmadas (`createSignedUrl(path, 3600)`, expiran en 1 hora).

## Página admin `/admin/saludos`

Server Component (sigue el patrón de `/admin/archivo`):
1. Carga todas las filas de `saludos` ordenadas por `created_at DESC` con el service role.
2. Para cada fila, genera una URL firmada de Storage (`createSignedUrl`).
3. Renderiza una lista/tabla: nombre, fecha, duración, `<audio controls src={signedUrl}>` para escuchar, y un link `<a href={signedUrl} download>` para descargar el archivo original.

No requiere paginación en esta primera versión (volumen esperado bajo); se puede agregar después si hace falta.

## Manejo de errores (resumen)

| Caso | Comportamiento |
|---|---|
| Sin permiso de micrófono / navegador no soportado | Mensaje inline claro, no rompe la página |
| Nombre vacío al grabar/enviar | Validación inline, mismo estilo que `ContactForm.tsx` |
| Grabación llega a 60s | Corte automático, sin error — pasa directo a preview |
| Falla de red/Storage/DB al enviar | Mensaje de error, botón de reintentar conserva el audio grabado |

## Testing

- Verificación manual en navegador (Chrome vía `claude-in-chrome`) de: validación de nombre vacío, mensaje de error de permiso de micrófono denegado, y el flujo completo de UI (grabar → preview → enviar → confirmación), simulando el resultado de la grabación donde sea necesario ya que un micrófono real no está disponible en el entorno de automatización.
- Verificación de que la migración SQL se aplica sin errores y que las policies quedan como se espera (mismo método usado para `sugerencias`: consultas a `pg_policies` y `pg_class` desde el SQL Editor).
- No se agregan tests automatizados (unit/E2E) — consistente con el resto del proyecto, que no tiene suite de tests para flujos de UI similares (ver `ContactForm.tsx`, que tampoco los tiene).

## Fuera de alcance (explícito)

- Conversión de audio a MP3 en el servidor o cliente.
- Notificaciones (correo/push) al admin cuando llega un saludo nuevo.
- Paginación, búsqueda o filtros en `/admin/saludos`.
- Borrado de saludos desde la UI (el admin puede borrarlos manualmente desde el Table Editor de Supabase si hace falta).
- Límite de saludos por IP/usuario o rate limiting.

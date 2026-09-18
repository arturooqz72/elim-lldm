# Banco de audios personal por anfitrión — diseño

## Contexto

El "Banco de audios" de un Programa (tabla `programa_audios`, migración `0038_programas.sql`) es hoy un solo bote compartido: cualquiera que suba un clip lo sube al mismo lugar, con un título libre ("Intro 1", "Salida"), y cualquiera que opere ese programa en el panel "Salida a radio" (`RadioBroadcastPanel.tsx`) ve y toca exactamente los mismos clips.

Un programa puede tener varios Conductores habituales (tabla `programa_hosts`, gestionada hoy en `/admin/programas/[id]` bajo "Conductor(es) habitual(es)" — el usuario los llama indistintamente "conductor", "anfitrión" o "locutor", son el mismo concepto). El usuario quiere que cada conductor tenga sus propios intros/outros/audios personales, y que al entrar al estudio se pueda elegir quién está al aire para que el banco de audios se ajuste solo a esa persona.

## Decisiones confirmadas con el usuario

1. **"Locutor" = los mismos usuarios de "Conductor(es) habitual(es)"** (`programa_hosts`) — no se crea ningún rol ni tabla de personas nueva.
2. **El filtro suma, no esconde**: al elegir un anfitrión se ven sus clips personales *más* los generales del programa — nunca se ocultan los generales.
3. **Elegir anfitrión es opcional**: si no se elige nadie (o el programa solo tiene un conductor), el panel se comporta exactamente igual que hoy — todo mezclado, sin selector visible.

## 1. Base de datos

Migración nueva `supabase/migrations/0052_programa_audios_host.sql`:

```sql
ALTER TABLE programa_audios
  ADD COLUMN host_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_programa_audios_host ON programa_audios(programa_id, host_id);
```

`host_id NULL` = audio general del programa (todo lo que ya existe hoy queda como general automáticamente, sin migrar datos). Un valor = clip personal de ese conductor. `ON DELETE SET NULL` en vez de `CASCADE`: si se quita a alguien de `programa_hosts` o se borra su cuenta, sus clips no desaparecen, solo vuelven a ser generales — nadie pierde audio por accidente.

Sin cambios de RLS: la policy existente de `programa_audios` (`admin`/`super_moderador`, ver `0038_programas.sql`) ya cubre lectura y escritura de la columna nueva sin tocarla.

## 2. Subir audios (`/admin/programas/[id]`)

**`src/app/admin/programas/[id]/page.tsx`**: pasa la lista `hosts` (ya se consulta ahí, ver línea ~78-82) como prop nueva `hosts` a `AudioUploadForm`.

**`src/app/admin/programas/[id]/AudioUploadForm.tsx`**: nuevo campo `<select>` "¿Para quién es este audio?" entre "Título" y "Archivo de audio", con `<option value="">General (para todos)</option>` + una `<option>` por cada host recibido (`value={host.user_id}`, texto = `host.profiles?.display_name`). El insert final agrega `host_id: hostId || null`.

En la lista de audios del lado izquierdo de esa misma página (`page.tsx`, el `.map(audios)` que ya existe), cada fila gana una etiqueta chiquita junto al título: el nombre del host si `audio.host_id` coincide con alguno de `hosts`, o "General" si es `null`. Esto es solo lectura — no hay edición de un audio ya subido, mismo patrón que hoy (subir de nuevo + borrar el viejo si hay que corregir algo).

## 3. Panel en vivo (`RadioBroadcastPanel.tsx`)

**Nueva prop `programaHosts?: ProgramaHost[]`**, enhebrada exactamente igual que `programaAudios` hoy, en cascada por los mismos 4 archivos:
`src/app/(estudio)/platikas/[id]/page.tsx` → `StudioShell.tsx` → `LiveKitRoom.tsx` → `RadioBroadcastPanel.tsx`.

En `page.tsx`, la consulta a `programa_hosts` (mismo `select` que ya usa `/admin/programas/[id]/page.tsx`: `*, profiles(display_name, avatar_url)`) se agrega al `Promise.all` ya existente (líneas 65-74), condicionada igual a `p.programa_id` — sigue corriendo en paralelo con `getProfile()` y la consulta de audios, sin secuenciar nada nuevo.

En `RadioBroadcastPanel.tsx`:
- Nuevo estado local `selectedHostId: string | null` (default `null` = nadie elegido).
- Si `programaHosts.length >= 2`, se muestra un selector "Anfitrión" (mismo estilo `<select>` que "Elegir audio…" de Música de fondo) arriba de "Elige tu intro" / del "Banco de audios", con `<option value="">Sin elegir</option>` + una opción por host. Si `programaHosts.length < 2`, el selector no se renderiza — cero cambio visual para programas de un solo conductor.
- Función helper `audiosVisibles = audios.filter(a => !selectedHostId || !a.host_id || a.host_id === selectedHostId)` — sustituye las referencias directas a `audios`/`programaAudios` en "Elige tu intro" (la lista antes de salir al aire) y en la sección "Banco de audios" (mientras está en vivo). El resto del componente (Música de fondo, Saludos en vivo, mic/sala/PC) no se toca — son fuentes independientes del banco de audios.

## 4. Tipos

**`src/types/index.ts`**: `ProgramaAudio` gana `host_id: string | null`. `ProgramaHost` ya tiene todo lo necesario (`user_id`, `profiles.display_name`) — sin cambios ahí.

## 5. Fuera de alcance (v1)

- **Autoservicio**: un conductor no puede subir sus propios audios desde ningún lado — sigue siendo el admin quien sube y asigna, como hoy. Si se pide después, sería una pantalla nueva fuera de `/admin`.
- **Editar el dueño de un audio ya subido**: se resuelve borrando y resubiendo, igual que corregir un título hoy.
- **Selector obligatorio o persistente**: la elección de anfitrión vive solo en el estado del componente durante esa sesión del panel — no se guarda en la base de datos ni se recuerda entre sesiones.

## 6. Testing

Sin suite de tests automatizados en este repo (confirmado en el plan de Saludo Directo) — verificación manual:
1. Programa con 1 solo conductor: el selector "Anfitrión" no aparece, todo se comporta igual que antes del cambio.
2. Programa con 2+ conductores: subir un audio general y uno personal de cada conductor; confirmar que sin elegir anfitrión se ven todos, y que al elegir a uno se ven sus personales + los generales, pero no los personales del otro conductor.
3. Confirmar que "Elige tu intro" (antes de salir al aire) respeta el mismo filtro que el Banco de audios en vivo.

# Escoger una escena del video como portada — Diseño

Fecha: 2026-11-05 · Estado: aprobado por el usuario

## Objetivo

Al subir un video, poder escoger una escena del propio video y usarla como portada (miniatura), además de la opción actual de subir una imagen.

Aplica a los dos formularios que suben video:

- `src/components/videos/VideoUploadForm.tsx` (público, `/videos/subir`)
- `src/app/admin/archivo/nueva/ArchiveUploadForm.tsx` (admin, Archivo → Nueva grabación)

## Experiencia

1. El usuario elige el archivo de video como hoy.
2. Debajo aparece una vista previa del video (reproductor nativo con controles) y una barra deslizante para recorrerlo.
3. Botón **"Usar esta escena como portada"**: captura el fotograma visible.
4. Se muestra la miniatura elegida con el texto "Portada: escena en m:ss". Se puede mover la barra y volver a capturar para cambiarla.
5. La opción actual "Imagen de portada (opcional)" sigue disponible. La portada es una sola: escoger una imagen reemplaza la escena y viceversa; la miniatura muestra cuál está activa.
6. Si no se escoge nada, el video queda sin portada (comportamiento actual, sin cambios).

## Componente nuevo

`src/components/videos/EscenaPortadaPicker.tsx` (client component), reutilizado por ambos formularios.

Props:

- `videoFile: File | null` — el video seleccionado.
- `onPick: (file: File | null) => void` — entrega la portada capturada como `File`.
- `disabled?: boolean` — mientras se sube.

Funcionamiento:

- `URL.createObjectURL(videoFile)` en un `<video controls muted playsInline preload="metadata">`; se revoca al cambiar de archivo o desmontar.
- Al cargar metadatos se posiciona en 0.1 s para que iOS/Safari pinte el primer fotograma.
- Barra `<input type="range">` de 0 a `duration`, paso 0.1 s, sincronizada con `currentTime` en ambos sentidos.
- Captura: se dibuja el fotograma en un `<canvas>` (máximo 1280 px de ancho, proporción original) y `canvas.toBlob(..., "image/jpeg", 0.85)` → `File` llamado `escena-<segundos>s.jpg`, tipo `image/jpeg`. Siempre menor a 5 MB, así que cumple los límites del bucket `video-thumbnails` (0081).
- Todo ocurre en el navegador; no se procesa el video en el servidor ni se agregan dependencias.

## Cambios en los formularios

- Ambos conservan su único estado `thumbFile`; el picker llama a `setThumbFile(file)`. La subida de la portada no cambia (mismo bucket y misma ruta que hoy en cada formulario).
- El texto del recuadro de imagen muestra el nombre del archivo elegido o "Escena en m:ss" cuando la portada viene del video.
- Se muestra una vista previa de la portada activa (imagen o escena) con `URL.createObjectURL`, revocada al cambiar.

## Errores

- Si el navegador no puede reproducir el formato (evento `error` del `<video>`, p. ej. algunos `.mov`/HEVC en Chrome de Windows): se oculta el selector de escena y se muestra "Este formato no se puede previsualizar aquí; puedes subir una imagen como portada." La subida del video sigue funcionando.
- Si `toBlob` devuelve `null`: mensaje "No se pudo capturar la escena, intenta otra vez."

## Fuera de alcance

- Portada automática cuando no se escoge nada.
- Cambiar la portada de videos ya subidos (edición posterior).
- Recortar o editar la imagen capturada.

## Pruebas

- `npm run build` sin errores de tipos.
- Prueba manual en el navegador (escritorio y ancho de teléfono): elegir video, mover la barra, capturar, cambiar de escena, cambiar a imagen y de regreso, subir, y verificar que la portada aparece en la tarjeta del video.
- Probar un formato no reproducible para confirmar el mensaje y que la subida sigue funcionando.

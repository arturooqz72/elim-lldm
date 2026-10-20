-- ============================================================
-- Elim LLDM — Subidas a Storage más cerradas (auditoría, hallazgo 10)
-- Ejecutar manualmente en Supabase SQL Editor
--
-- video-thumbnails: cualquier cuenta podía subir cualquier archivo, de
-- cualquier tamaño y en cualquier carpeta. Ahora solo imágenes de hasta
-- 5 MB y solo en thumbnails/<su propio id>/ (la ruta que ya usa
-- VideoUploadForm).
--
-- camera-off-photos: ya tenía imágenes de hasta 5 MB, pero cualquier
-- cuenta podía subir en cualquier carpeta. Ahora solo en <su propio id>/
-- (la identidad de LiveKit es el id del usuario, StudioControlBar).
--
-- Sin cuenta (anon) ya no se podía subir a ninguno de los dos; las
-- políticas nuevas son TO authenticated para que siga así.
-- Las subidas sin cuenta que quedan (saludos y su bucket, sugerencias,
-- visitas_sitio) son necesarias para /saludo, /contacto y el historial
-- de visitas, y no se tocan aquí.
-- ============================================================

UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif']
WHERE id IN ('video-thumbnails', 'camera-off-photos');

DROP POLICY IF EXISTS "video_thumbnails_storage_insert_auth" ON storage.objects;
CREATE POLICY "video_thumbnails_storage_insert_auth" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'video-thumbnails'
    AND (storage.foldername(name))[1] = 'thumbnails'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "camera_off_photos_insert_authenticated" ON storage.objects;
CREATE POLICY "camera_off_photos_insert_authenticated" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'camera-off-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

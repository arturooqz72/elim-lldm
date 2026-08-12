-- ============================================================
-- Elim LLDM — Imagen de cámara apagada en Estudio en Vivo
-- Ejecutar manualmente en Supabase SQL Editor
--
-- Bucket público para que el anfitrión/invitados en escenario suban
-- una foto o GIF que se muestra en su recuadro cuando apagan la
-- cámara. Público en lectura (se sirve como <img> a cualquier
-- espectador, incluso anónimo); solo usuarios autenticados pueden
-- subir.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('camera-off-photos', 'camera-off-photos', TRUE, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "camera_off_photos_insert_authenticated" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'camera-off-photos');

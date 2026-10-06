-- ============================================================
-- ElimPlay — GRANTs de escritura en audio_categories
--
-- El formulario de subida (AudioUploadForm) crea categorías nuevas
-- desde el navegador con la sesión del admin, pero 0005 solo otorgó
-- SELECT a authenticated → "permission denied for table
-- audio_categories". Las políticas RLS de 0004 ya restringen
-- INSERT/UPDATE/DELETE a role = 'admin'.
-- ============================================================

GRANT INSERT, UPDATE, DELETE ON audio_categories TO authenticated;

-- ============================================================
-- ElimPlay — Permisos base faltantes
--
-- 0004_elimplay.sql creó audio_categories y audio_tracks con RLS,
-- pero (igual que pasó con las tablas de Trivia en 0003) las tablas
-- nuevas no heredan los GRANTs base de anon/authenticated/service_role.
-- Sin estos GRANTs, las políticas RLS nunca se evalúan: Postgres
-- responde "permission denied for table ..." (42501) antes de
-- llegar a RLS.
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

GRANT SELECT ON audio_categories TO anon, authenticated;
GRANT SELECT ON audio_tracks TO anon, authenticated;
GRANT INSERT ON audio_tracks TO authenticated;

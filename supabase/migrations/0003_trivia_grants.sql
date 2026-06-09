-- ============================================================
-- Elim LLDM — Permisos base faltantes
--
-- 1) service_role no tenía SELECT/INSERT/UPDATE/DELETE en NINGUNA
--    tabla del proyecto (solo TRUNCATE/REFERENCES/TRIGGER) — esto
--    rompe cualquier flujo que use createServiceClient(), incluyendo
--    los ya existentes de /admin (crear pláticas, juegos, archivo,
--    verificar usuarios) y la creación de salas de Trivia en Vivo.
--    rolbypassrls solo evita RLS, no sustituye estos GRANTs base.
--
-- 2) Las tablas nuevas de Trivia en Vivo necesitan los mismos GRANTs
--    base que sus equivalentes en /juegos (game_teams, game_players,
--    game_answers) para que anon/authenticated puedan operar a través
--    de las políticas RLS ya definidas en 0002_trivia.sql. La
--    diferencia clave: en Trivia los JUGADORES crean sus equipos
--    directamente desde el cliente (trivia_teams_insert_self), por
--    lo que authenticated necesita INSERT en trivia_teams — algo que
--    game_teams no requiere porque ahí los equipos los crea el host.
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

GRANT SELECT ON trivia_rooms TO anon, authenticated;

GRANT SELECT ON trivia_teams TO anon, authenticated;
GRANT INSERT ON trivia_teams TO authenticated;

GRANT SELECT ON trivia_players TO anon, authenticated;
GRANT INSERT, UPDATE ON trivia_players TO authenticated;

GRANT SELECT ON trivia_answers TO authenticated;
GRANT INSERT ON trivia_answers TO authenticated;

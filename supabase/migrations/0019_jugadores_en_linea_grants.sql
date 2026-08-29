-- jugadores_en_linea (0018) olvidó los GRANTs base para el rol authenticated
-- (mismo patrón que 0003_trivia_grants.sql) — RLS por sí sola no basta,
-- sin GRANT el rol ni siquiera puede intentar la operación (403).
GRANT SELECT, INSERT, UPDATE, DELETE ON jugadores_en_linea TO authenticated;

-- ============================================================
-- Elim LLDM — Quitar lo que quedaba de Saludo Directo
-- Ejecutar manualmente en Supabase SQL Editor DESPUÉS de que a8ed22a
-- (sin /saludo-directo) y el código sin el rol oyente_plus estén en
-- producción.
--
-- 1. oyente_plus solo servía para Saludo Directo: sus usuarios (2 al
--    2026-10-27) pasan a 'participante' y el rol sale del CHECK.
-- 2. Se borra la bitácora saludos_directos (12 filas: quién y cuándo, sin
--    audio). Respaldo de ambas cosas en JSON fuera del repo:
--    C:\Users\arturooq\respaldos-elim\2026-10-27-saludo-directo\.
-- ============================================================

BEGIN;

UPDATE profiles SET role = 'participante' WHERE role = 'oyente_plus';

ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'anfitrion', 'participante', 'moderador', 'super_moderador'));

DROP TABLE saludos_directos;

COMMIT;

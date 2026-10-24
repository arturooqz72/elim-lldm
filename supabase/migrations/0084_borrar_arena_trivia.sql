-- ============================================================
-- Elim LLDM — Borrar las tablas de Elim Arena y Trivia en Vivo
-- Ejecutar manualmente en Supabase SQL Editor DESPUÉS de que la Fase 3
-- (6c281f7, ya sin /arena, /trivia ni /api/arena) esté en producción.
--
-- Al 2026-10-24 Trivia en Vivo no tenía ninguna fila y Elim Arena solo la
-- sala de prueba del 2026-09-01 (6 preguntas). Respaldo en JSON fuera del
-- repo: C:\Users\arturooq\respaldos-elim\2026-10-24-arena-trivia\.
--
-- Se quedan (los usan juegos activos): arena_publica_* (Trivia en línea),
-- trivia_vistas (banco bíblico) y tiktok_trivia_*.
--
-- Sin CASCADE a propósito: si algo que no conocemos depende de estas
-- tablas, el DROP falla y no se borra nada (todo va en una transacción).
-- ============================================================

BEGIN;

-- Elim Arena (hijas primero)
DROP TABLE elim_arena_respuestas_correctas;
DROP TABLE elim_arena_respuestas;
DROP TABLE elim_arena_jugadores;
DROP TABLE elim_arena_preguntas;
DROP TABLE elim_arena_salas;

-- Trivia en Vivo (hijas primero)
DROP TABLE trivia_answers;
DROP TABLE trivia_players;
DROP TABLE trivia_teams;
DROP TABLE trivia_rooms;
DROP FUNCTION increment_trivia_score(UUID, INT);

COMMIT;

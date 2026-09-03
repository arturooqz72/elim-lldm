-- Permite varias salas de Arena Abierta activas a la vez ("auto-escalar"):
-- antes, el índice único forzaba una sola sala no-'finished' en todo el
-- sistema, así que si esa sala ya estaba jugando, cualquier visitante nuevo
-- recibía "la partida actual ya empezó" y no tenía dónde jugar. Ahora el
-- único límite es "a lo sumo una sala en 'lobby' a la vez" (evita que dos
-- requests concurrentes creen dos salas de espera duplicadas); salas en
-- 'counting'/'playing'/'reveal' pueden coexistir libremente con una sala
-- nueva en 'lobby' y entre sí.
DROP INDEX IF EXISTS idx_arena_publica_salas_una_abierta;

CREATE UNIQUE INDEX idx_arena_publica_salas_una_lobby
  ON arena_publica_salas ((1)) WHERE status = 'lobby';

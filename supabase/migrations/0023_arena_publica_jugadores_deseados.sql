-- "¿Cuántos van a jugar?" — quien termina creando la sala (ver
-- getOrCreateOpenRoom()) elige un número entre MIN_JUGADORES_PARA_INICIAR y
-- MAX_JUGADORES_POR_SALA; la sala espera a llegar a ese número antes de
-- arrancar sola, pero cualquier jugador ya adentro puede forzar el arranque
-- antes vía /api/arena-publica/force-start una vez alcanzado el mínimo.
ALTER TABLE arena_publica_salas
  ADD COLUMN jugadores_deseados INT NOT NULL DEFAULT 2
    CHECK (jugadores_deseados BETWEEN 2 AND 6);

-- Ya no se acepta jugar sin cuenta — se guarda quién es cada jugador. Queda
-- NULLABLE a nivel de columna porque las salas ya jugadas antes de este
-- cambio no tienen este dato y no hay forma honesta de rellenarlo; el
-- API (/api/arena-publica/join) es quien exige que todo jugador NUEVO sí
-- lo traiga.
ALTER TABLE arena_publica_jugadores
  ADD COLUMN user_id UUID REFERENCES profiles(id);

-- Evita que la misma cuenta ocupe dos lugares en la misma sala (dos
-- pestañas abiertas a la vez, por ejemplo).
CREATE UNIQUE INDEX idx_arena_publica_jugadores_sala_user
  ON arena_publica_jugadores (sala_id, user_id) WHERE user_id IS NOT NULL;

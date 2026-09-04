-- Ya no hay "el anfitrión" — las salas se auto-asignan (ver
-- getOrCreateOpenRoom() en room.server.ts), así que created_by deja de ser
-- obligatorio. Las filas históricas conservan su valor; las salas nuevas
-- simplemente no lo llenan.
ALTER TABLE ruleta_salas ALTER COLUMN created_by DROP NOT NULL;

-- "¿Cuántos van a jugar?" — mismo mecanismo que Arena Abierta: quien
-- termina creando la sala elige un número entre MIN_PLAYERS y MAX_PLAYERS
-- (2-6, ver src/lib/ruleta/wheel.ts); la sala espera a llegar a ese número
-- antes de arrancar sola, con opción de forzar el arranque antes.
ALTER TABLE ruleta_salas
  ADD COLUMN jugadores_deseados INT NOT NULL DEFAULT 2
    CHECK (jugadores_deseados BETWEEN 2 AND 6);

-- Hueco real que existía desde antes de esta fase: cuando una ronda
-- terminaba (alguien resolvió el panel, o se acabaron las letras),
-- turno_termina_en se ponía en NULL y la sala se quedaba en 'ronda_fin'
-- esperando a que el anfitrión diera clic en "Siguiente ronda" — sin
-- ningún timer, sin ninguna forma de que avanzara sola. Esta columna le da
-- a esa fase el mismo tipo de deadline que ya tienen las demás.
ALTER TABLE ruleta_salas ADD COLUMN ronda_fin_termina_en TIMESTAMPTZ;

-- El índice de user_id ya existía (migración 0020) pero no era único —
-- ahora que TODOS los jugadores van a tener cuenta, lo volvemos único para
-- poder hacer inserts idempotentes (recarga de página, doble clic) igual
-- que en Arena Abierta.
DROP INDEX IF EXISTS idx_ruleta_jugadores_user;
CREATE UNIQUE INDEX idx_ruleta_jugadores_sala_user
  ON ruleta_jugadores (sala_id, user_id) WHERE user_id IS NOT NULL;

-- Igual que Arena Abierta: a lo sumo una sala en 'lobby' a la vez, para que
-- dos requests concurrentes no creen dos salas de espera duplicadas. Salas
-- en 'playing'/'ronda_fin' pueden coexistir libremente con una sala nueva
-- en 'lobby' — así varias partidas de Ruleta corren en paralelo.
CREATE UNIQUE INDEX idx_ruleta_salas_una_lobby
  ON ruleta_salas ((1)) WHERE status = 'lobby';

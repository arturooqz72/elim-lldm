-- Cuenta cuántos turnos seguidos se saltaron por inactividad real (nadie
-- conectado que reportara el vencimiento) vs. por un cliente en vivo. Ver
-- healStaleRuletaRooms() en advance.server.ts: sin este contador, una sala
-- 'playing' abandonada por ambos jugadores queda saltando turnos para
-- siempre, cada vez que cualquier visitante no relacionado entra a
-- /ruleta, sin llegar nunca a 'finished'.
ALTER TABLE ruleta_salas
  ADD COLUMN turnos_saltados_seguidos INT NOT NULL DEFAULT 0;

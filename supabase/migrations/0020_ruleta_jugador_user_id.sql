-- ============================================================
-- La Ruleta en línea — vincular ruleta_jugadores a la cuenta (opcional)
--
-- Antes, la identidad de un jugador solo vivía en localStorage del
-- navegador que se usó para unirse. Eso causaba un bug real: si un
-- usuario logueado (el anfitrión u otro invitado con cuenta) abría el
-- link de la sala desde OTRO dispositivo, no había forma de reconocer
-- que era la misma persona — creaba una segunda fila de jugador
-- separada, que arrancaba en 0 puntos y nunca se sincronizaba con la
-- que sí estaba jugando, dando la impresión de "no me da puntos".
--
-- user_id es NULLABLE a propósito: jugadores sin cuenta (el modo
-- principal del juego) lo dejan en NULL y siguen funcionando igual
-- que antes, identificados solo por localStorage.
-- ============================================================

ALTER TABLE ruleta_jugadores
  ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_ruleta_jugadores_user ON ruleta_jugadores(sala_id, user_id) WHERE user_id IS NOT NULL;

-- ============================================================
-- Elim LLDM — Historial de palabras del Ahorcado
--
-- ahorcado_corridas solo guarda la partida actual de cada jugador (se
-- sobrescribe) y juego_individual_rankings solo su récord: no queda forma
-- de saber cuántos puntos hizo alguien en una semana. Esta tabla guarda
-- una fila por cada palabra terminada (ganada o perdida), para el video de
-- "Campeones de la semana" (/admin/juegos/tiktok).
--
-- Solo la escribe y la lee el servidor (service role), igual que
-- ahorcado_corridas. Empieza vacía: el Ahorcado entra al video a partir
-- de la primera semana completa después de aplicarla.
-- ============================================================

CREATE TABLE ahorcado_resultados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  palabra_id UUID REFERENCES ahorcado_palabras(id) ON DELETE SET NULL,
  ganada BOOLEAN NOT NULL,
  puntos INT NOT NULL DEFAULT 0 CHECK (puntos >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ahorcado_resultados_fecha ON ahorcado_resultados (created_at);
CREATE INDEX idx_ahorcado_resultados_user ON ahorcado_resultados (user_id, created_at);

ALTER TABLE ahorcado_resultados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ahorcado_resultados FROM anon, authenticated;

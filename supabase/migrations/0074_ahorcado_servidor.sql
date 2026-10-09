-- ============================================================
-- Elim LLDM — El Ahorcado y su ranking, solo desde el servidor
--
-- Antes la palabra completa llegaba al navegador y el navegador mandaba su
-- propio puntaje: cualquiera podía poner el número que quisiera en el
-- ranking (por la API o directo en juego_individual_rankings). Ahora:
--   - ahorcado_corridas guarda la partida de cada jugador (palabra actual,
--     letras, vidas, puntos de la racha). El navegador solo ve las letras
--     acertadas; la palabra completa, al terminar.
--   - Cada letra la califica el servidor y él suma los puntos.
--   - juego_individual_rankings solo la escribe el servidor (service role).
-- Además: increment_view_count (contador de vistas del Archivo) solo lo
-- puede llamar el servidor.
-- ============================================================

CREATE TABLE ahorcado_corridas (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  palabra_id UUID REFERENCES ahorcado_palabras(id) ON DELETE SET NULL,
  letras TEXT[] NOT NULL DEFAULT '{}',
  vidas INT NOT NULL DEFAULT 6,
  estado TEXT NOT NULL DEFAULT 'jugando' CHECK (estado IN ('jugando', 'ganada', 'perdida')),
  puntos INT NOT NULL DEFAULT 0,
  ganadas INT NOT NULL DEFAULT 0,
  -- Palabras ya usadas en esta racha, para no repetirlas.
  usadas UUID[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE ahorcado_corridas ENABLE ROW LEVEL SECURITY;
-- Sin políticas ni GRANTs para anon/authenticated a propósito: solo el servidor.
REVOKE ALL ON ahorcado_corridas FROM anon, authenticated;

-- El ranking sigue siendo de lectura pública, pero ya nadie lo escribe
-- desde el navegador.
DROP POLICY IF EXISTS "juego_individual_rankings_insert_own" ON juego_individual_rankings;
DROP POLICY IF EXISTS "juego_individual_rankings_update_own" ON juego_individual_rankings;
REVOKE INSERT, UPDATE, DELETE ON juego_individual_rankings FROM anon, authenticated;

REVOKE ALL ON FUNCTION increment_view_count(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_view_count(UUID) TO service_role;

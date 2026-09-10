-- ============================================================
-- Elim LLDM — Ahorcado del Nuevo Testamento
--
-- Primer juego individual (un jugador, sin sala) del hub /juegos. Dos
-- tablas nuevas:
--
-- 1. ahorcado_palabras — el banco de palabras. A diferencia de casi
--    cualquier otra tabla del proyecto, NO tiene ninguna policy de SELECT
--    para anon/authenticated: nadie puede leer el banco completo por REST.
--    Solo admin (gestión desde /admin/ahorcado) y el service role (la
--    ruta de juego, que entrega una palabra a la vez) pueden leerla.
--
-- 2. juego_individual_rankings — genérica, con game_key, para no crear
--    una tabla nueva cada vez que se agregue otro juego de un jugador.
--    Mismo rol que game_rankings en el proyecto hermano tdv-llm.
-- ============================================================

CREATE TABLE ahorcado_palabras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  palabra TEXT NOT NULL CHECK (palabra ~ '^[A-ZÑ ]+$'),
  categoria TEXT NOT NULL CHECK (categoria IN ('personaje', 'lugar', 'concepto', 'libro')),
  pista TEXT NOT NULL,
  referencia_biblica TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ahorcado_palabras_activo ON ahorcado_palabras (activo) WHERE activo = TRUE;

ALTER TABLE ahorcado_palabras ENABLE ROW LEVEL SECURITY;

-- Sin policy de SELECT para anon/authenticated a propósito (ver comentario
-- arriba). Solo admin tiene acceso total, para que /admin/ahorcado
-- funcione con el cliente normal de sesión (createClient()).
CREATE POLICY "ahorcado_palabras_admin_all" ON ahorcado_palabras FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- GRANT a `authenticated` (no a `anon`): la policy de arriba ya filtra a
-- solo admin, pero sin este GRANT ni siquiera un admin autenticado podría
-- ejecutar la consulta — el gotcha de tablas nuevas ya documentado en este
-- proyecto (ver 0019_jugadores_en_linea_grants.sql). El juego en sí (no
-- admin) nunca toca esta tabla con este cliente — lee con el service role
-- desde /api/juegos/ahorcado/palabra-aleatoria, que bypasa RLS y GRANTs.
GRANT SELECT, INSERT, UPDATE ON ahorcado_palabras TO authenticated;


CREATE TABLE juego_individual_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_key TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_key, user_id)
);

CREATE INDEX idx_juego_individual_rankings_ranking
  ON juego_individual_rankings (game_key, score DESC);

ALTER TABLE juego_individual_rankings ENABLE ROW LEVEL SECURITY;

-- Lectura pública: /juegos es una página pública y el ranking es parte del
-- gancho para que un visitante se anime a crear cuenta (mismo motivo que
-- tabla_posiciones en 0029_tabla_posiciones.sql).
CREATE POLICY "juego_individual_rankings_select" ON juego_individual_rankings
  FOR SELECT USING (TRUE);

-- Cada quien solo puede escribir su propia fila — RLS ya alcanza para esto,
-- así que la ruta que guarda el ranking usa el cliente normal de sesión
-- (createClient()), no el service role.
CREATE POLICY "juego_individual_rankings_insert_own" ON juego_individual_rankings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "juego_individual_rankings_update_own" ON juego_individual_rankings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT ON juego_individual_rankings TO anon, authenticated;
GRANT INSERT, UPDATE ON juego_individual_rankings TO authenticated;

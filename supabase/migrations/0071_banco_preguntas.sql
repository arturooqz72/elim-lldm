-- ============================================================
-- Elim LLDM — Banco de preguntas bíblicas
--
-- 1. questions gana dificultad, categoría, activa/estado (las generadas
--    cada semana entran como 'pendiente' y solo juegan al aprobarlas) y
--    contadores de respuestas para el panel de admin.
-- 2. La respuesta correcta deja de ser legible desde el navegador: la
--    tabla questions solo la lee un admin; los juegos la consultan desde
--    el servidor con el service role.
-- 3. trivia_vistas recuerda qué preguntas vio cada jugador, para no
--    repetírselas nunca.
-- 4. Las salas de Trivia en línea y Elim Arena guardan de qué pregunta del
--    banco salió cada una (estadísticas) y cuántas trae la partida.
-- 5. Las respuestas de los demás jugadores ya no se pueden leer por la API
--    durante la partida (revelaban la correcta), y los puntos de /juegos
--    solo los suma el servidor.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columnas nuevas del banco
-- ------------------------------------------------------------
ALTER TABLE questions
  ADD COLUMN dificultad TEXT CHECK (dificultad IN ('facil', 'normal', 'dificil')),
  ADD COLUMN categoria TEXT CHECK (categoria IN (
    'personajes', 'lugares', 'milagros', 'profetas',
    'evangelios', 'antiguo_testamento', 'nuevo_testamento'
  )),
  ADD COLUMN activa BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN estado TEXT NOT NULL DEFAULT 'aprobada'
    CHECK (estado IN ('aprobada', 'pendiente', 'rechazada')),
  ADD COLUMN origen TEXT NOT NULL DEFAULT 'manual'
    CHECK (origen IN ('manual', 'banco_inicial', 'generada')),
  ADD COLUMN veces_respondida INT NOT NULL DEFAULT 0,
  ADD COLUMN veces_acertada INT NOT NULL DEFAULT 0;

-- Porcentaje de acierto calculado por la base, para poder ordenar por él.
ALTER TABLE questions
  ADD COLUMN porcentaje_acierto NUMERIC GENERATED ALWAYS AS (
    CASE WHEN veces_respondida > 0
      THEN round(100.0 * veces_acertada / veces_respondida, 1)
    END
  ) STORED;

CREATE INDEX idx_questions_banco ON questions (estado, activa, dificultad);

-- Set fijo que agrupa el banco (id conocido por la app: BANCO_SET_ID).
INSERT INTO question_sets (id, title, description, created_by, is_public)
SELECT
  'b1b11000-0000-4000-8000-000000000001',
  'Banco bíblico',
  'Preguntas al azar por nivel y categoría, verificadas con la Reina-Valera 1960.',
  (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1),
  TRUE;

-- El set que ya existía: nombre corregido, la pregunta de Enoc
-- desactivada (estaba mal: Enoc vivió menos que Adán) y las otras cinco
-- clasificadas para que también entren al banco.
UPDATE question_sets SET title = 'Antiguo Testamento'
  WHERE id = '324f58ad-d799-4671-ac07-fed10fdc01ed';
UPDATE questions SET activa = FALSE
  WHERE id = 'eb4e6994-8ddb-4622-97b9-611d44490f0b';
UPDATE questions SET dificultad = 'dificil', categoria = 'personajes'
  WHERE id IN ('8cf87b4f-5784-46de-8626-67334ebb7b12', '761a3d29-5ee7-461c-ab4d-4e86e2336529');
UPDATE questions SET dificultad = 'dificil', categoria = 'profetas'
  WHERE id = '57254b2b-61e9-4b4b-9e87-9a844c4c25cb';
UPDATE questions SET dificultad = 'normal', categoria = 'personajes'
  WHERE id = '3e699d62-df47-4437-8915-2b34c9b2c1e2';
UPDATE questions SET dificultad = 'normal', categoria = 'antiguo_testamento'
  WHERE id = 'd55b9a1d-83c4-4daf-859d-d12ee2387d97';

-- ------------------------------------------------------------
-- 2. La respuesta correcta solo la lee un admin
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "questions_select_all" ON questions;
CREATE POLICY "questions_select_admin" ON questions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ------------------------------------------------------------
-- 3. Preguntas que ya vio cada jugador (solo el servidor)
-- ------------------------------------------------------------
CREATE TABLE trivia_vistas (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  visto_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);
CREATE INDEX idx_trivia_vistas_question ON trivia_vistas (question_id);
CREATE INDEX idx_trivia_vistas_visto_en ON trivia_vistas (visto_en);
ALTER TABLE trivia_vistas ENABLE ROW LEVEL SECURITY;
-- Sin políticas ni GRANTs para anon/authenticated a propósito.
REVOKE ALL ON trivia_vistas FROM anon, authenticated;

-- ------------------------------------------------------------
-- 4. Salas: pregunta de origen y total por partida
-- ------------------------------------------------------------
ALTER TABLE arena_publica_salas
  ADD COLUMN total_preguntas INT NOT NULL DEFAULT 10;
ALTER TABLE arena_publica_preguntas
  ADD COLUMN question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
  ADD COLUMN dificultad TEXT,
  ADD COLUMN categoria TEXT;

ALTER TABLE elim_arena_salas
  ADD COLUMN modo TEXT NOT NULL DEFAULT 'propias' CHECK (modo IN ('propias', 'banco')),
  ADD COLUMN total_preguntas INT;
ALTER TABLE elim_arena_preguntas
  ADD COLUMN question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
  ADD COLUMN dificultad TEXT,
  ADD COLUMN categoria TEXT;
ALTER TABLE elim_arena_jugadores
  ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Las salas que ya existen conservan su número de preguntas.
UPDATE elim_arena_salas s
  SET total_preguntas = (SELECT count(*) FROM elim_arena_preguntas p WHERE p.sala_id = s.id);

-- ------------------------------------------------------------
-- 5. Respuestas ajenas y puntos
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "arena_publica_respuestas_select_all" ON arena_publica_respuestas;
REVOKE SELECT ON arena_publica_respuestas FROM anon, authenticated;
DROP POLICY IF EXISTS "elim_arena_respuestas_select_all" ON elim_arena_respuestas;
REVOKE SELECT ON elim_arena_respuestas FROM anon, authenticated;

-- /juegos: cada quien ve sus respuestas; el anfitrión y los admin, todas.
-- Las inserta solo el servidor (/api/games/[id]/answer), que calcula si
-- acertó.
DROP POLICY IF EXISTS "game_answers_select_all" ON game_answers;
DROP POLICY IF EXISTS "game_answers_insert_self" ON game_answers;
CREATE POLICY "game_answers_select_own_or_host" ON game_answers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM game_players gp WHERE gp.id = game_answers.player_id AND gp.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM games g WHERE g.id = game_answers.game_id AND g.host_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

REVOKE ALL ON FUNCTION increment_player_score(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_player_score(UUID, INT) TO service_role;
REVOKE ALL ON FUNCTION increment_trivia_score(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_trivia_score(UUID, INT) TO service_role;

-- ------------------------------------------------------------
-- Funciones del banco (solo service role)
-- ------------------------------------------------------------

-- Suma una respuesta a las estadísticas de la pregunta.
CREATE OR REPLACE FUNCTION registrar_respuesta_pregunta(p_question_id UUID, p_acerto BOOLEAN)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE questions
  SET veces_respondida = veces_respondida + 1,
      veces_acertada = veces_acertada + CASE WHEN p_acerto THEN 1 ELSE 0 END
  WHERE id = p_question_id;
$$;

-- Elige una pregunta que NINGUNO de los jugadores haya visto.
--   - Si quedan 50 o más sin ver en el nivel pedido, sale de ese nivel.
--   - Si quedan menos de 50, sale de otro nivel (el más cercano primero).
--   - Si en los otros niveles ya no queda nada, usa lo que quede del nivel.
--   - Dentro de eso, evita repetir la categoría de la pregunta anterior.
-- Devuelve cero filas si los jugadores ya vieron todo el banco.
CREATE OR REPLACE FUNCTION elegir_pregunta_banco(
  p_user_ids UUID[],
  p_excluir UUID[],
  p_nivel TEXT,
  p_categoria_evitar TEXT
)
RETURNS TABLE (
  id UUID, question_text TEXT, option_a TEXT, option_b TEXT, option_c TEXT, option_d TEXT,
  correct_option TEXT, bible_reference TEXT, dificultad TEXT, categoria TEXT
)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  WITH candidatas AS (
    SELECT q.*
    FROM questions q
    JOIN question_sets s ON s.id = q.question_set_id AND s.is_public
    WHERE q.estado = 'aprobada'
      AND q.activa
      AND q.dificultad IS NOT NULL
      AND NOT (q.id = ANY (COALESCE(p_excluir, '{}')))
      AND NOT EXISTS (
        SELECT 1 FROM trivia_vistas v
        WHERE v.question_id = q.id AND v.user_id = ANY (COALESCE(p_user_ids, '{}'))
      )
  ),
  en_nivel AS (
    SELECT count(*) AS n FROM candidatas WHERE dificultad = p_nivel
  )
  SELECT c.id, c.question_text, c.option_a, c.option_b, c.option_c, c.option_d,
         c.correct_option, c.bible_reference, c.dificultad, c.categoria
  FROM candidatas c, en_nivel
  ORDER BY
    CASE
      WHEN en_nivel.n >= 50 THEN (c.dificultad <> p_nivel)::INT
      ELSE (c.dificultad = p_nivel)::INT
    END,
    abs(
      (CASE c.dificultad WHEN 'facil' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END)
      - (CASE p_nivel WHEN 'facil' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END)
    ),
    (c.categoria IS NOT DISTINCT FROM p_categoria_evitar)::INT,
    random()
  LIMIT 1;
$$;

-- Para la tarea semanal: cuántas preguntas aprobadas NO ha visto la
-- mayoría de los jugadores activos (los que vieron alguna pregunta en los
-- últimos p_dias días).
CREATE OR REPLACE FUNCTION banco_preguntas_frescas(p_dias INT DEFAULT 30)
RETURNS TABLE (jugadores_activos INT, preguntas_frescas INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH activos AS (
    SELECT DISTINCT user_id FROM trivia_vistas
    WHERE visto_en > NOW() - make_interval(days => p_dias)
  ),
  n AS (SELECT count(*)::INT AS total FROM activos),
  vistas AS (
    SELECT question_id, count(*)::INT AS c
    FROM trivia_vistas
    WHERE user_id IN (SELECT user_id FROM activos)
    GROUP BY question_id
  )
  SELECT
    n.total,
    (
      SELECT count(*)::INT
      FROM questions q
      LEFT JOIN vistas v ON v.question_id = q.id
      WHERE q.estado = 'aprobada' AND q.activa AND q.dificultad IS NOT NULL
        AND COALESCE(v.c, 0) * 2 < GREATEST(n.total, 1)
    )
  FROM n;
$$;

REVOKE ALL ON FUNCTION registrar_respuesta_pregunta(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION elegir_pregunta_banco(UUID[], UUID[], TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION banco_preguntas_frescas(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION registrar_respuesta_pregunta(UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION elegir_pregunta_banco(UUID[], UUID[], TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION banco_preguntas_frescas(INT) TO service_role;

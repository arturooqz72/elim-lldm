-- ============================================================
-- Elim LLDM — Elim Arena (trivia multijugador estilo TikTok)
-- Ejecutar manualmente en Supabase SQL Editor
--
-- Namespace nuevo y aislado /arena — no modifica games/trivia_* existentes.
-- Jugadores entran SOLO con su nombre (sin cuenta). Las escrituras de
-- elim_arena_jugadores y elim_arena_respuestas se hacen desde API routes
-- con el service role client (createServiceClient()), validadas en el
-- servidor — por eso no tienen policies de INSERT/UPDATE para anon/authenticated.
-- ============================================================

-- ELIM ARENA SALAS
CREATE TABLE elim_arena_salas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL DEFAULT 'Elim Arena',
  status TEXT NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby', 'playing', 'reveal', 'finished')),
  pregunta_actual INT NOT NULL DEFAULT 0,
  pregunta_termina_en TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ELIM ARENA PREGUNTAS
CREATE TABLE elim_arena_preguntas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id UUID NOT NULL REFERENCES elim_arena_salas(id) ON DELETE CASCADE,
  pregunta TEXT NOT NULL,
  opcion_a TEXT NOT NULL,
  opcion_b TEXT NOT NULL,
  opcion_c TEXT NOT NULL,
  opcion_d TEXT NOT NULL,
  respuesta_correcta TEXT NOT NULL CHECK (respuesta_correcta IN ('a','b','c','d')),
  orden INT NOT NULL,
  UNIQUE (sala_id, orden)
);

-- ELIM ARENA JUGADORES
CREATE TABLE elim_arena_jugadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id UUID NOT NULL REFERENCES elim_arena_salas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  puntos INT NOT NULL DEFAULT 0,
  ultimo_respondido_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ELIM ARENA RESPUESTAS
CREATE TABLE elim_arena_respuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id UUID NOT NULL REFERENCES elim_arena_salas(id) ON DELETE CASCADE,
  jugador_id UUID NOT NULL REFERENCES elim_arena_jugadores(id) ON DELETE CASCADE,
  pregunta_id UUID NOT NULL REFERENCES elim_arena_preguntas(id) ON DELETE CASCADE,
  respuesta TEXT NOT NULL CHECK (respuesta IN ('a','b','c','d')),
  es_correcta BOOLEAN NOT NULL,
  tiempo_ms INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pregunta_id, jugador_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_elim_arena_salas_codigo ON elim_arena_salas(codigo);
CREATE INDEX idx_elim_arena_salas_status ON elim_arena_salas(status);
CREATE INDEX idx_elim_arena_preguntas_sala ON elim_arena_preguntas(sala_id, orden);
CREATE INDEX idx_elim_arena_jugadores_sala ON elim_arena_jugadores(sala_id);
CREATE INDEX idx_elim_arena_respuestas_sala ON elim_arena_respuestas(sala_id, pregunta_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE elim_arena_salas ENABLE ROW LEVEL SECURITY;
ALTER TABLE elim_arena_preguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE elim_arena_jugadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE elim_arena_respuestas ENABLE ROW LEVEL SECURITY;

-- Lectura pública (jugadores sin cuenta deben poder ver todo lo de su sala)
CREATE POLICY "elim_arena_salas_select_all" ON elim_arena_salas FOR SELECT USING (TRUE);
CREATE POLICY "elim_arena_preguntas_select_all" ON elim_arena_preguntas FOR SELECT USING (TRUE);
CREATE POLICY "elim_arena_jugadores_select_all" ON elim_arena_jugadores FOR SELECT USING (TRUE);
CREATE POLICY "elim_arena_respuestas_select_all" ON elim_arena_respuestas FOR SELECT USING (TRUE);

-- Crear sala: solo admin/anfitrión autenticado
CREATE POLICY "elim_arena_salas_insert_host" ON elim_arena_salas
  FOR INSERT WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'anfitrion')
    )
  );

-- Actualizar sala (status, pregunta_actual, pregunta_termina_en): host o admin
CREATE POLICY "elim_arena_salas_update_host" ON elim_arena_salas
  FOR UPDATE USING (
    auth.uid() = created_by OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Preguntas: solo el host de la sala las inserta (al crearla)
CREATE POLICY "elim_arena_preguntas_insert_host" ON elim_arena_preguntas
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM elim_arena_salas
      WHERE elim_arena_salas.id = elim_arena_preguntas.sala_id
        AND elim_arena_salas.created_by = auth.uid()
    )
  );

-- ============================================================
-- GRANTS (lectura pública vía anon + authenticated)
-- ============================================================
GRANT SELECT ON elim_arena_salas TO anon, authenticated;
GRANT SELECT ON elim_arena_preguntas TO anon, authenticated;
GRANT SELECT ON elim_arena_jugadores TO anon, authenticated;
GRANT SELECT ON elim_arena_respuestas TO anon, authenticated;
GRANT INSERT, UPDATE ON elim_arena_salas TO authenticated;
GRANT INSERT ON elim_arena_preguntas TO authenticated;

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE elim_arena_salas;
ALTER PUBLICATION supabase_realtime ADD TABLE elim_arena_jugadores;
ALTER PUBLICATION supabase_realtime ADD TABLE elim_arena_respuestas;

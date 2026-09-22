-- ============================================================
-- Elim LLDM — Trivia en vivo con participación desde TikTok
--
-- Dos tablas de soporte para /tiktok-trivia: una fila por partida en
-- vivo (qué set de preguntas se usó, quién la corrió) y una fila por
-- cada pregunta que tuvo ganador (el primer comentario de TikTok que
-- acertó). Ver docs/superpowers/specs/2026-09-22-tiktok-trivia-design.md.
-- ============================================================

CREATE TABLE tiktok_trivia_sesiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_set_id UUID NOT NULL REFERENCES question_sets(id),
  started_by UUID NOT NULL REFERENCES profiles(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'conectando'
    CHECK (status IN ('conectando', 'en_vivo', 'finalizada'))
);

CREATE TABLE tiktok_trivia_respuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id UUID NOT NULL REFERENCES tiktok_trivia_sesiones(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id),
  tiktok_username TEXT NOT NULL,
  tiktok_display_name TEXT NOT NULL,
  respondida_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tiktok_trivia_respuestas_sesion ON tiktok_trivia_respuestas(sesion_id);

ALTER TABLE tiktok_trivia_sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok_trivia_respuestas ENABLE ROW LEVEL SECURITY;

-- Sesiones: cualquier anfitrión/admin puede crear la suya y leer todas
-- (historial compartido), pero solo el dueño puede actualizarla.
CREATE POLICY "tiktok_trivia_sesiones_insert" ON tiktok_trivia_sesiones FOR INSERT
  TO authenticated
  WITH CHECK (
    started_by = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'anfitrion'))
  );

CREATE POLICY "tiktok_trivia_sesiones_select" ON tiktok_trivia_sesiones FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'anfitrion')));

CREATE POLICY "tiktok_trivia_sesiones_update_own" ON tiktok_trivia_sesiones FOR UPDATE
  TO authenticated
  USING (started_by = auth.uid());

-- Respuestas: solo se insertan dentro de una sesión propia; lectura igual
-- que sesiones.
CREATE POLICY "tiktok_trivia_respuestas_insert" ON tiktok_trivia_respuestas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tiktok_trivia_sesiones s
      WHERE s.id = sesion_id AND s.started_by = auth.uid()
    )
  );

CREATE POLICY "tiktok_trivia_respuestas_select" ON tiktok_trivia_respuestas FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'anfitrion')));

-- GRANTs explícitos — gotcha ya documentado varias veces en este proyecto
-- (ver 0019_jugadores_en_linea_grants.sql): sin esto, ni siquiera un
-- usuario que pasa la policy puede ejecutar la consulta.
GRANT SELECT, INSERT, UPDATE ON tiktok_trivia_sesiones TO authenticated;
GRANT SELECT, INSERT ON tiktok_trivia_respuestas TO authenticated;

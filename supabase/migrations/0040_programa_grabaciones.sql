-- ============================================================
-- Elim LLDM — Grabaciones de sesiones de Programas
--
-- Cada vez que un Programa sale en vivo (ver 0038_programas.sql), la
-- sesión se graba automáticamente (audio) via LiveKit Egress y se sube
-- a Backblaze B2. Se listan en el panel admin con reproductor y botón
-- de descarga, y se conservan 15 días (expires_at) para que el admin
-- las use como repetición o las suba a YouTube antes de que un cron
-- diario las borre automáticamente (bucket + fila).
-- ============================================================

CREATE TABLE programa_grabaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id UUID NOT NULL REFERENCES programas(id) ON DELETE CASCADE,
  platika_id UUID REFERENCES platikas(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  b2_file_name TEXT NOT NULL,
  duration_seconds INT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_programa_grabaciones_programa ON programa_grabaciones(programa_id, ended_at DESC);
CREATE INDEX idx_programa_grabaciones_expires ON programa_grabaciones(expires_at);

-- El egress de grabación se inicia al ir en vivo y se detiene al
-- terminar (ver api/platikas/create-live y api/platikas/[id]/end) — se
-- guarda el egress_id en la propia platika para poder detenerlo.
ALTER TABLE platikas ADD COLUMN recording_egress_id TEXT;

ALTER TABLE programa_grabaciones ENABLE ROW LEVEL SECURITY;

-- Igual que programa_audios: herramienta de producción interna, no
-- contenido público — solo admin/super_moderador leen y escriben.
CREATE POLICY "programa_grabaciones_staff" ON programa_grabaciones FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_moderador')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_moderador')));

-- GRANTs explícitos — sin esto, ni siquiera un usuario autenticado que
-- pasa la policy puede ejecutar la consulta (gotcha ya documentado
-- varias veces en este proyecto, ver 0019_jugadores_en_linea_grants.sql).
GRANT SELECT, INSERT, UPDATE, DELETE ON programa_grabaciones TO authenticated;

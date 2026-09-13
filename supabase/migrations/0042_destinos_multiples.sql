-- ============================================================
-- Elim LLDM — Destinos múltiples de transmisión
--
-- Reemplaza las 3 columnas fijas youtube/facebook/tiktok_egress_id en
-- platikas por un catálogo reutilizable de destinos (nombre + RTMP +
-- stream key cifrado) y un historial de egresos por plática — permite
-- transmitir a varios destinos simultáneos, incluyendo varios de la
-- misma plataforma. Ver
-- docs/superpowers/specs/2026-09-13-destinos-multiples-design.md.
-- ============================================================

CREATE TABLE destinos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  plataforma TEXT NOT NULL CHECK (plataforma IN ('youtube', 'facebook', 'tiktok', 'otro')),
  rtmp_url TEXT NOT NULL,
  stream_key_cifrado TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE platikas_stream_egresos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platika_id UUID NOT NULL REFERENCES platikas(id) ON DELETE CASCADE,
  destino_id UUID NOT NULL REFERENCES destinos(id),
  egress_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stopped_at TIMESTAMPTZ
);

CREATE INDEX idx_stream_egresos_platika ON platikas_stream_egresos(platika_id);
CREATE INDEX idx_stream_egresos_activos ON platikas_stream_egresos(destino_id) WHERE stopped_at IS NULL;

ALTER TABLE platikas
  DROP COLUMN IF EXISTS youtube_egress_id,
  DROP COLUMN IF EXISTS facebook_egress_id,
  DROP COLUMN IF EXISTS tiktok_egress_id;

-- ============================================================
-- RLS — mismo patrón que programa_audios (0038_programas.sql):
-- herramienta interna, solo admin/super_moderador.
-- ============================================================

ALTER TABLE destinos ENABLE ROW LEVEL SECURITY;
ALTER TABLE platikas_stream_egresos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "destinos_staff" ON destinos FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_moderador')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_moderador')));

CREATE POLICY "platikas_stream_egresos_staff" ON platikas_stream_egresos FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_moderador')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_moderador')));

-- GRANTs explícitos — sin esto, ni un usuario autenticado que pasa la
-- policy puede ejecutar la consulta (gotcha ya documentado varias
-- veces en este proyecto).
GRANT SELECT, INSERT, UPDATE, DELETE ON destinos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON platikas_stream_egresos TO authenticated;

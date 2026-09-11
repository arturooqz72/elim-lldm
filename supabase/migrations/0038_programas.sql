-- ============================================================
-- Elim LLDM — Programas del Estudio en Vivo
--
-- Un "programa" es un show recurrente (ej. "Conversando con Fernando"),
-- distinto de una transmisión puntual (una fila de `platikas`). Una
-- transmisión puede opcionalmente pertenecer a un programa vía
-- platikas.programa_id — NULL sigue siendo una transmisión libre, tal
-- cual funciona hoy.
-- ============================================================

CREATE TABLE programas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  horario_texto TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conductor(es) habitual(es) — informativo (se muestra públicamente
-- como "conducido por X"). El permiso real para operar un programa es
-- el rol super_moderador/admin, no estar en esta tabla — ver
-- 0039_super_moderador_role.sql.
CREATE TABLE programa_hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id UUID NOT NULL REFERENCES programas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (programa_id, user_id)
);

-- Banco de audios de cada programa — abierto: título libre (el
-- conductor los nombra "Intro 1", "Salida", etc.), sin ningún campo de
-- "tipo" — él decide cuál usar en cada momento desde el panel en vivo.
CREATE TABLE programa_audios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id UUID NOT NULL REFERENCES programas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_programa_hosts_programa ON programa_hosts(programa_id);
CREATE INDEX idx_programa_audios_programa ON programa_audios(programa_id, orden);

ALTER TABLE platikas ADD COLUMN programa_id UUID REFERENCES programas(id);
CREATE INDEX idx_platikas_programa ON platikas(programa_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE programas ENABLE ROW LEVEL SECURITY;
ALTER TABLE programa_hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE programa_audios ENABLE ROW LEVEL SECURITY;

-- programas y programa_hosts: público puede ver (nombre, horario,
-- quién lo conduce es información pública del sitio). Solo admin
-- puede crear/editar/borrar — la gestión de super_moderador sobre
-- programas es a través del panel en vivo (platikas), no de estas
-- fichas administrativas.
CREATE POLICY "programas_select" ON programas FOR SELECT USING (TRUE);
CREATE POLICY "programas_admin_write" ON programas FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "programa_hosts_select" ON programa_hosts FOR SELECT USING (TRUE);
CREATE POLICY "programa_hosts_admin_write" ON programa_hosts FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- programa_audios: herramienta de producción interna, no contenido
-- público — solo admin/super_moderador pueden leer y escribir (el
-- público solo lo escucha cuando sale por la radio).
CREATE POLICY "programa_audios_staff" ON programa_audios FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_moderador')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_moderador')));

-- GRANTs explícitos — sin esto, ni siquiera un usuario autenticado que
-- pasa la policy puede ejecutar la consulta (gotcha ya documentado
-- varias veces en este proyecto, ver 0019_jugadores_en_linea_grants.sql).
GRANT SELECT ON programas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON programas TO authenticated;
GRANT SELECT ON programa_hosts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON programa_hosts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON programa_audios TO authenticated;

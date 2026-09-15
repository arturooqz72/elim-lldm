-- ============================================================
-- Elim LLDM — Bitácora de Saludo Directo
--
-- Un registro por cada vez que un oyente_plus/admin usa el botón de
-- /saludo-directo. Sin contenido de audio (no se graba nada) — solo
-- quién y cuándo, para que un admin pueda revisar uso/abuso y decidir
-- si retirar el rol oyente_plus a alguien.
-- ============================================================

CREATE TABLE saludos_directos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saludos_directos_user ON saludos_directos(user_id, created_at DESC);

ALTER TABLE saludos_directos ENABLE ROW LEVEL SECURITY;

-- El propio usuario registra su saludo (vía la API route, con su sesión).
CREATE POLICY "saludos_directos_insert_own" ON saludos_directos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Solo admin puede leer la bitácora.
CREATE POLICY "saludos_directos_select_admin" ON saludos_directos FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- GRANTs explícitos — sin esto, ni siquiera un usuario autenticado que
-- pasa la policy puede ejecutar la consulta (gotcha ya documentado
-- varias veces en este proyecto, ver 0019_jugadores_en_linea_grants.sql).
GRANT INSERT, SELECT ON saludos_directos TO authenticated;

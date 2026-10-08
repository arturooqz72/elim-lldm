-- ============================================================
-- Elim English — aperturas desde la app instalada (PWA)
--
-- Una fila cada vez que alguien abre Elim English desde el ícono de la
-- app instalada (no desde el navegador). La escribe solo el servidor
-- (/api/ingles/app-abierta) y la lee /admin/ingles con service role.
-- - user_id: la cuenta, si había sesión.
-- - visitante_id: id anónimo del navegador (el mismo de visitas_sitio),
--   solo para contar personas distintas cuando no hay sesión.
-- ============================================================

CREATE TABLE english_app_aperturas (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  visitante_id UUID,
  plataforma   TEXT NOT NULL CHECK (plataforma IN ('ios', 'android', 'otro'))
);

CREATE INDEX idx_english_app_aperturas_fecha ON english_app_aperturas (created_at);
CREATE INDEX idx_english_app_aperturas_quien ON english_app_aperturas (user_id, visitante_id, created_at DESC);

-- RLS activo y sin políticas: el navegador no puede leer ni escribir.
ALTER TABLE english_app_aperturas ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON english_app_aperturas TO service_role;

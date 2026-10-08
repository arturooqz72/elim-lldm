-- ============================================================
-- Radio Elim — aperturas desde la app instalada (PWA de /escuchar)
--
-- Una fila cada vez que alguien abre la radio desde el ícono de la app
-- instalada (no desde el navegador). La escribe solo el servidor
-- (/api/radio/app-abierta) y la lee /admin/radio con service role.
-- Igual que english_app_aperturas (0063), pero de la radio.
-- - user_id: la cuenta, si había sesión.
-- - visitante_id: id anónimo del navegador (el mismo de visitas_sitio),
--   para contar personas distintas cuando no hay sesión.
-- ============================================================

CREATE TABLE radio_app_aperturas (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  visitante_id UUID,
  plataforma   TEXT NOT NULL CHECK (plataforma IN ('ios', 'android', 'otro'))
);

CREATE INDEX idx_radio_app_aperturas_fecha ON radio_app_aperturas (created_at);
CREATE INDEX idx_radio_app_aperturas_quien ON radio_app_aperturas (user_id, visitante_id, created_at DESC);

-- RLS activo y sin políticas: el navegador no puede leer ni escribir.
ALTER TABLE radio_app_aperturas ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON radio_app_aperturas TO service_role;

-- ============================================================
-- Elim English — lista de espera mientras las compras están pausadas
--
-- Con ENGLISH_PAYMENTS_ENABLED=false, al llegar al límite diario se ofrece
-- "Avísame cuando haya más mensajes". Una fila por usuario (la PK lo
-- garantiza); la escribe solo el servidor y cada usuario puede ver la suya.
-- ============================================================

CREATE TABLE english_lista_espera (
  user_id    UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE english_lista_espera ENABLE ROW LEVEL SECURITY;

CREATE POLICY "english_lista_espera_select_own" ON english_lista_espera
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

GRANT SELECT ON english_lista_espera TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON english_lista_espera TO service_role;

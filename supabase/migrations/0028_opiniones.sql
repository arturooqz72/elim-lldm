-- ============================================================
-- Elim LLDM — Opinión y Sugerencias (tablero público de miembros)
-- Ejecutar manualmente en Supabase SQL Editor
--
-- A diferencia de `sugerencias` (formulario privado de /contacto, solo
-- el service role puede leerlo), esta es una cartelera pública: cualquiera
-- puede leerla, cualquier cuenta puede publicar, y solo el admin puede
-- borrar — el borrado se hace desde /api/admin/opiniones/[id] con el
-- service role, no hay policy de DELETE para anon/authenticated.
-- ============================================================

CREATE TABLE opiniones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mensaje TEXT NOT NULL CHECK (char_length(trim(mensaje)) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_opiniones_created_at ON opiniones(created_at DESC);

ALTER TABLE opiniones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "opiniones_select_all" ON opiniones FOR SELECT USING (TRUE);

CREATE POLICY "opiniones_insert_auth" ON opiniones
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Sin policy de UPDATE/DELETE para anon/authenticated — solo el service
-- role (admin, vía API route) puede borrar.

GRANT SELECT ON opiniones TO anon, authenticated;
GRANT INSERT ON opiniones TO authenticated;

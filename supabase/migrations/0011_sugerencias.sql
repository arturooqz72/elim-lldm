-- ============================================================
-- Elim LLDM — Sugerencias (formulario de Contáctanos)
-- Ejecutar manualmente en Supabase SQL Editor
--
-- Tabla pública de solo-escritura: cualquier visitante (con o sin
-- cuenta) puede enviar una sugerencia desde /contacto usando el
-- cliente de Supabase en el navegador (createClient(), anon key).
-- No hay policy de SELECT para anon/authenticated — solo se puede
-- leer con el service role client (createServiceClient()) desde el
-- servidor, que ya tiene GRANT SELECT vía 0003_trivia_grants.sql
-- (GRANT ... ON ALL TABLES IN SCHEMA public TO service_role).
-- ============================================================

CREATE TABLE sugerencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL CHECK (char_length(trim(nombre)) BETWEEN 1 AND 120),
  correo TEXT NOT NULL CHECK (correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  mensaje TEXT NOT NULL CHECK (char_length(trim(mensaje)) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sugerencias_created_at ON sugerencias(created_at DESC);

ALTER TABLE sugerencias ENABLE ROW LEVEL SECURITY;

-- Solo INSERT público. Sin policy de SELECT/UPDATE/DELETE para
-- anon/authenticated => el cliente no puede leer ni modificar filas.
CREATE POLICY "sugerencias_insert_public" ON sugerencias FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

GRANT INSERT ON sugerencias TO anon, authenticated;

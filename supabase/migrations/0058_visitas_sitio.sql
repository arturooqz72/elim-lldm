-- ============================================================
-- Historial de visitas del sitio (/admin/historial)
--
-- Una fila por página pública abierta: cuándo, quién y qué ruta.
-- - Con sesión: profile_id se llena SOLO con auth.uid() (DEFAULT +
--   política), así nadie puede registrar visitas a nombre de otro.
-- - Sin sesión: profile_id NULL y visitante_id = uuid aleatorio que el
--   navegador guarda en localStorage (no es un dato personal; solo
--   agrupa las visitas del mismo navegador).
-- - Solo los admins pueden leer. Nadie puede editar ni borrar.
-- - Retención 90 días: no hay pg_cron, así que ~1 de cada 200
--   inserciones barre lo viejo (ver trigger abajo).
-- ============================================================

CREATE TABLE visitas_sitio (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  profile_id   UUID DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  visitante_id UUID,
  ruta         TEXT NOT NULL CHECK (ruta LIKE '/%' AND char_length(ruta) <= 300)
);

CREATE INDEX visitas_sitio_created_at_idx ON visitas_sitio (created_at DESC);
CREATE INDEX visitas_sitio_profile_idx ON visitas_sitio (profile_id, created_at DESC);

ALTER TABLE visitas_sitio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visitas_sitio_insert_propia" ON visitas_sitio
  FOR INSERT TO anon, authenticated
  WITH CHECK (profile_id IS NOT DISTINCT FROM auth.uid());

CREATE POLICY "visitas_sitio_select_admin" ON visitas_sitio
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Igual que 0005/0057: sin GRANT, Postgres rechaza antes de evaluar RLS.
GRANT INSERT ON visitas_sitio TO anon, authenticated;
GRANT SELECT ON visitas_sitio TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON visitas_sitio TO service_role;

CREATE OR REPLACE FUNCTION visitas_sitio_purgar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF random() < 0.005 THEN
    DELETE FROM visitas_sitio WHERE created_at < now() - INTERVAL '90 days';
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER visitas_sitio_purgar_trg
  AFTER INSERT ON visitas_sitio
  FOR EACH STATEMENT EXECUTE FUNCTION visitas_sitio_purgar();

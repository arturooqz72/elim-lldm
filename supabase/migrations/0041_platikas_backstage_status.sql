-- ============================================================
-- Elim LLDM — Estado "backstage" para transmisiones (Estudio en Vivo)
--
-- Antes de salir al aire, el conductor entra a una sala privada donde
-- prueba mic/cámara — nadie más la ve ni la escucha, no se graba, no
-- sale a la radio ni a plataformas. Ver
-- docs/superpowers/specs/2026-09-12-backstage-design.md.
--
-- El constraint de status en platikas no tiene nombre explícito en
-- 0001_init.sql, así que se busca dinámicamente (mismo patrón ya usado
-- en 0030_moderador_role.sql para el constraint de profiles.role).
-- ============================================================

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Postgres reescribe "CHECK (col IN (...))" como "CHECK (col = ANY
  -- (ARRAY[...]))" internamente, así que no se puede buscar "IN" en el
  -- texto — basta con que mencione la columna "status".
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'platikas'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';

  EXECUTE format('ALTER TABLE platikas DROP CONSTRAINT %I', constraint_name);
  EXECUTE $sql$
    ALTER TABLE platikas ADD CONSTRAINT platikas_status_check
      CHECK (status IN ('scheduled', 'backstage', 'live', 'ended'))
  $sql$;
END $$;

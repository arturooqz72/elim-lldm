-- ============================================================
-- Elim LLDM — Rol "oyente_plus"
--
-- Categoría de oyente (no de staff) habilitada para usar el botón de
-- "Saludo Directo" en /saludo-directo — conectar su micrófono en vivo
-- a la radio por 5 segundos exactos, cuando no hay ninguna plática en
-- vivo. Se asigna a mano desde /admin/usuarios, igual que moderador y
-- super_moderador.
-- ============================================================

-- Mismo patrón que 0030_moderador_role.sql y 0039_super_moderador_role.sql:
-- el CHECK de profiles.role nunca tuvo un nombre fijo, se ubica
-- dinámicamente para no dejar el constraint viejo bloqueando el valor
-- nuevo en silencio.
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%IN%'
  LOOP
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'anfitrion', 'participante', 'moderador', 'super_moderador', 'oyente_plus'));

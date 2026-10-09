-- ============================================================
-- Elim LLDM — nadie puede cambiarse su propio rol ni verificación
--
-- La policy "profiles_update_own" (0001) deja que cada usuario edite
-- su fila, pero no limita columnas: desde el navegador alguien podía
-- ponerse role = 'admin' o verified_lldm = true. El usuario sigue
-- pudiendo editar nombre, bio, avatar e iglesia (/perfil, Palabra del
-- Día). role y verified_lldm solo cambian desde el servidor con
-- service role (/admin/usuarios) o desde el SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION profiles_proteger_rol()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role
      OR NEW.verified_lldm IS DISTINCT FROM OLD.verified_lldm
      OR NEW.id IS DISTINCT FROM OLD.id)
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin')
  THEN
    RAISE EXCEPTION 'No se puede cambiar el rol ni la verificación desde aquí'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_proteger_rol_trg ON profiles;
CREATE TRIGGER profiles_proteger_rol_trg
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_proteger_rol();

-- ============================================================
-- Elim LLDM — Rol "super_moderador"
--
-- Superset de 'moderador' (mismos poderes: borrar comentarios en
-- Opinión/Videos, moderar el chat en vivo de cualquier plática) más:
-- puede abrir el panel de CUALQUIER programa (no solo el que tiene
-- asignado en programa_hosts, para poder cubrir a quien falte),
-- gestionar el banco de audios de cualquier programa, y crear/operar
-- transmisiones (platikas) en nombre de cualquier programa.
--
-- Sin acceso a /admin, igual que 'moderador' — layout admin sigue
-- exigiendo role = 'admin' exacto.
-- ============================================================

-- Mismo patrón que 0030_moderador_role.sql: el CHECK de profiles.role
-- no tiene nombre fijo, se ubica dinámicamente para no dejar el
-- constraint viejo bloqueando el valor nuevo en silencio.
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
  CHECK (role IN ('admin', 'anfitrion', 'participante', 'moderador', 'super_moderador'));

-- Chat en vivo: mismo permiso de UPDATE (marcar is_moderated=true) que
-- ya tienen admin/anfitrion/moderador.
DROP POLICY IF EXISTS "messages_update_admin" ON platikas_messages;
CREATE POLICY "messages_update_admin" ON platikas_messages
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'anfitrion', 'moderador', 'super_moderador'))
  );

-- Crear transmisiones (platikas): super_moderador se agrega junto a
-- admin/anfitrion. Se mantiene el requisito verified_lldm = TRUE por
-- consistencia con anfitrion — el admin lo marca al asignar el rol.
DROP POLICY IF EXISTS "platikas_insert_host" ON platikas;
CREATE POLICY "platikas_insert_host" ON platikas
  FOR INSERT WITH CHECK (
    auth.uid() = host_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'anfitrion', 'super_moderador') AND verified_lldm = TRUE
    )
  );

-- Nota: el borrado en Opinión y Sugerencias, y en comentarios de
-- Video, NO pasan por RLS — van por rutas API con el service role
-- (ver Task 3), que es donde se agrega 'super_moderador' de verdad.

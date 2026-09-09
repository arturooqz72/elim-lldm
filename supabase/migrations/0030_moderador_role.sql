-- ============================================================
-- Elim LLDM — Rol "moderador"
-- Ejecutar con `supabase db push` (o a mano en el SQL Editor si hace falta)
--
-- Un moderador puede: borrar mensajes en Opinión y Sugerencias, y
-- silenciar/borrar mensajes del chat en vivo de cualquier plática — a
-- diferencia de 'admin', NO tiene acceso a /admin ni a nada más (crear
-- juegos, publicar en el archivo, gestionar usuarios, etc.).
-- ============================================================

-- El nombre del CHECK constraint original de 0001_init.sql nunca se fijó
-- explícitamente (Postgres le puso el nombre por defecto). En vez de
-- adivinarlo, lo buscamos dinámicamente por su definición para no
-- arriesgar dejar el constraint viejo (de 3 valores) convivientdo con uno
-- nuevo, lo cual seguiría bloqueando 'moderador' en silencio.
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
  CHECK (role IN ('admin', 'anfitrion', 'participante', 'moderador'));

-- Chat en vivo de Pláticas: el moderador necesita el mismo permiso de
-- UPDATE (marcar is_moderated=true) que ya tenían admin/anfitrion —
-- ChatPanel.tsx hace el UPDATE directo desde el cliente con la sesión
-- del usuario, así que sin esto la fila de RLS lo rechazaría aunque el
-- botón de moderar ya se le muestre en la UI.
DROP POLICY IF EXISTS "messages_update_admin" ON platikas_messages;
CREATE POLICY "messages_update_admin" ON platikas_messages
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'anfitrion', 'moderador'))
  );

-- Nota: el borrado en Opinión y Sugerencias NO pasa por RLS — va por
-- /api/admin/opiniones/[id]/route.ts con el service role, y ese archivo
-- de código (no la base de datos) es el que ahora también acepta
-- role = 'moderador', además de 'admin'.

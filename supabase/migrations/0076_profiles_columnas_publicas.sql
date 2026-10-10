-- ============================================================
-- Elim LLDM — de los perfiles ajenos solo se ve nombre, foto y rol
--
-- Antes cualquiera, incluso sin cuenta, podía bajar por la API todos los
-- perfiles con bio, iglesia, verificación LLDM y fechas (registro,
-- última edición, correo de bienvenida). Ahora, para anon y
-- authenticated, la tabla solo deja leer id, display_name, avatar_url y
-- role: lo que usan el chat, los rankings, los comentarios y las
-- insignias de la sala de pláticas.
--
-- El resto lo lee solo el servidor (service role): getProfile() para el
-- perfil propio, /admin/usuarios, estadísticas de admin. La iglesia sigue
-- saliendo en el ranking de Palabra del Día, que se arma con funciones
-- SECURITY DEFINER.
--
-- Las reglas para crear pláticas y salas de trivia pedían
-- verified_lldm = TRUE leyendo profiles con la sesión del usuario; ahora
-- lo revisan con es_anfitrion_verificado(), que corre como su dueño.
-- ============================================================

CREATE OR REPLACE FUNCTION es_anfitrion_verificado(p_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = ANY (p_roles) AND verified_lldm = TRUE
  );
$$;
REVOKE ALL ON FUNCTION es_anfitrion_verificado(TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION es_anfitrion_verificado(TEXT[]) TO authenticated, service_role;

DROP POLICY IF EXISTS "platikas_insert_host" ON platikas;
CREATE POLICY "platikas_insert_host" ON platikas
  FOR INSERT WITH CHECK (
    auth.uid() = host_id
    AND es_anfitrion_verificado(ARRAY['admin', 'anfitrion', 'super_moderador'])
  );

DROP POLICY IF EXISTS "trivia_rooms_insert_host" ON trivia_rooms;
CREATE POLICY "trivia_rooms_insert_host" ON trivia_rooms
  FOR INSERT WITH CHECK (
    auth.uid() = host_id
    AND es_anfitrion_verificado(ARRAY['admin', 'anfitrion'])
  );

REVOKE SELECT ON profiles FROM anon, authenticated;
GRANT SELECT (id, display_name, avatar_url, role) ON profiles TO anon, authenticated;

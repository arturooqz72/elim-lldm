-- ============================================================
-- Elim LLDM — aplicar la visibilidad de las transmisiones
--
-- 0046 agregó platikas.visibilidad ('publico' | 'oculto' | 'privado'),
-- pero la policy "platikas_select_all" (0001) seguía dejando leer
-- TODAS las filas a cualquiera, con o sin cuenta (título, sala de
-- LiveKit, enlace de grabación).
--
-- Desde aquí, por la API:
--   • 'publico'  → todos.
--   • 'oculto' y 'privado' → solo el equipo: admin, super_moderador,
--     moderador, quien la creó (host_id) y los conductores habituales
--     del programa (programa_hosts).
--
-- Una transmisión 'oculta' se sigue pudiendo abrir con el enlace
-- directo: esas páginas la cargan en el servidor con service role
-- (src/lib/platikas/acceso.server.ts), que repite esta misma regla
-- para las privadas.
-- ============================================================

-- SECURITY DEFINER: lee profiles y programa_hosts sin depender de las
-- policies de esas tablas desde dentro de la policy de platikas.
CREATE OR REPLACE FUNCTION platika_es_del_equipo(p_host UUID, p_programa UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    auth.uid() = p_host
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_moderador', 'moderador')
    )
    OR (
      p_programa IS NOT NULL AND EXISTS (
        SELECT 1 FROM programa_hosts
        WHERE programa_id = p_programa AND user_id = auth.uid()
      )
    )
  );
$$;

REVOKE ALL ON FUNCTION platika_es_del_equipo(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platika_es_del_equipo(UUID, UUID) TO anon, authenticated;

DROP POLICY IF EXISTS "platikas_select_all" ON platikas;

CREATE POLICY "platikas_select_visibles" ON platikas
  FOR SELECT USING (
    visibilidad = 'publico'
    OR platika_es_del_equipo(host_id, programa_id)
  );

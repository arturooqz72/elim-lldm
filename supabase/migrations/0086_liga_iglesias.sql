-- ============================================================
-- Elim LLDM — Liga de Iglesias (/juegos/liga) y regla general de
-- participación. Diseño:
-- docs/superpowers/specs/2026-11-11-liga-de-iglesias-design.md
--
-- 1. iglesias: los equipos de la Liga. comunidad = 'lldm' ("Iglesia de
--    [Ciudad]"), 'otra' ("[Denominación] · [Ciudad]") o 'amigos' (una
--    sola fila: "Amigos de Elim"). Lectura pública solo de aprobadas;
--    todo cambio, desde el servidor (service role).
-- 2. profiles: iglesia_id, iglesia_cambiada_en, iglesia_preguntada,
--    acepto_reglas_en y acepto_reglas_version. No entran al GRANT de
--    SELECT por columnas (0076) y un trigger impide cambiarlas desde el
--    navegador (mismo patrón que 0069).
-- 3. liga_puntos: sin permisos para anon/authenticated; solo la escribe
--    liga_registrar_puntos (topes por partida y por día) desde el servidor.
-- 4. liga_campeonas: una fila por semana cerrada (cron del lunes).
-- 5. handle_new_user guarda el nombre para mostrar y la aceptación de la
--    regla que vienen del registro con correo.
--
-- profiles.iglesia (texto libre de 0054) y profiles.tiktok_permiso
-- (0078) se dejan sin borrar; ya no se usan.
-- ============================================================

-- ---------- iglesias ----------
CREATE TABLE iglesias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comunidad TEXT NOT NULL CHECK (comunidad IN ('lldm', 'otra', 'amigos')),
  denominacion TEXT,
  ciudad TEXT CHECK (ciudad IS NULL OR char_length(btrim(ciudad)) BETWEEN 1 AND 60),
  estado TEXT CHECK (estado IS NULL OR char_length(btrim(estado)) BETWEEN 1 AND 60),
  pais TEXT CHECK (pais IS NULL OR char_length(btrim(pais)) BETWEEN 1 AND 60),
  -- comunidad|denominacion|ciudad|estado|pais normalizados (src/lib/liga/nombre.ts).
  clave TEXT NOT NULL UNIQUE,
  aprobada BOOLEAN NOT NULL DEFAULT FALSE,
  creada_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT iglesias_forma CHECK (
    (comunidad = 'amigos' AND denominacion IS NULL AND ciudad IS NULL AND estado IS NULL AND pais IS NULL)
    OR (comunidad = 'lldm' AND denominacion IS NULL AND ciudad IS NOT NULL AND estado IS NOT NULL AND pais IS NOT NULL)
    OR (comunidad = 'otra'
        AND denominacion IN ('Católica', 'Bautista', 'Pentecostal', 'Adventista', 'Evangélica', 'Otra cristiana', 'Otra religión')
        AND ciudad IS NOT NULL AND estado IS NOT NULL AND pais IS NOT NULL)
  )
);

CREATE UNIQUE INDEX iglesias_un_solo_amigos ON iglesias (comunidad) WHERE comunidad = 'amigos';
CREATE INDEX idx_iglesias_pendientes ON iglesias (creada_en) WHERE NOT aprobada;

ALTER TABLE iglesias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iglesias_select_aprobadas" ON iglesias FOR SELECT USING (aprobada);
REVOKE ALL ON iglesias FROM anon, authenticated;
GRANT SELECT ON iglesias TO anon, authenticated;


-- ---------- profiles ----------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS iglesia_id UUID REFERENCES iglesias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS iglesia_cambiada_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS iglesia_preguntada BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS acepto_reglas_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acepto_reglas_version TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_iglesia_id ON profiles (iglesia_id) WHERE iglesia_id IS NOT NULL;

CREATE OR REPLACE FUNCTION profiles_proteger_liga()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.iglesia_id IS DISTINCT FROM OLD.iglesia_id
      OR NEW.iglesia_cambiada_en IS DISTINCT FROM OLD.iglesia_cambiada_en
      OR NEW.iglesia_preguntada IS DISTINCT FROM OLD.iglesia_preguntada
      OR NEW.acepto_reglas_en IS DISTINCT FROM OLD.acepto_reglas_en
      OR NEW.acepto_reglas_version IS DISTINCT FROM OLD.acepto_reglas_version)
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin')
  THEN
    RAISE EXCEPTION 'Esto solo se cambia desde el sitio'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_proteger_liga_trg ON profiles;
CREATE TRIGGER profiles_proteger_liga_trg
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_proteger_liga();


-- ---------- handle_new_user: nombre para mostrar y regla aceptada ----------
-- El registro con correo manda en los metadatos display_name y
-- acepto_reglas_version (solo si marcó "Acepto"). Google y otros
-- proveedores no los mandan: esas cuentas aceptan la regla la primera vez
-- que entran a un juego.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_nombre TEXT := LEFT(btrim(COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    'Usuario'
  )), 60);
  v_version TEXT := NULLIF(btrim(NEW.raw_user_meta_data->>'acepto_reglas_version'), '');
BEGIN
  INSERT INTO profiles (id, display_name, avatar_url, acepto_reglas_en, acepto_reglas_version)
  VALUES (
    NEW.id,
    v_nombre,
    NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN v_version IS NOT NULL THEN NOW() END,
    v_version
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ---------- liga_puntos ----------
CREATE TABLE liga_puntos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jugador UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  iglesia_id UUID REFERENCES iglesias(id) ON DELETE SET NULL,
  juego TEXT NOT NULL CHECK (juego IN ('palabra', 'trivia', 'ruleta', 'ahorcado')),
  puntos INT NOT NULL CHECK (puntos > 0),
  partida_ref TEXT NOT NULL,
  evento_ref TEXT NOT NULL,
  semana DATE NOT NULL,
  dia DATE NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (jugador, juego, evento_ref)
);

CREATE INDEX idx_liga_puntos_semana_iglesia ON liga_puntos (semana, iglesia_id);
CREATE INDEX idx_liga_puntos_jugador_dia ON liga_puntos (jugador, juego, dia);
CREATE INDEX idx_liga_puntos_jugador_partida ON liga_puntos (jugador, juego, partida_ref);

ALTER TABLE liga_puntos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON liga_puntos FROM anon, authenticated;


-- ---------- liga_campeonas ----------
CREATE TABLE liga_campeonas (
  semana DATE PRIMARY KEY,
  iglesia_id UUID REFERENCES iglesias(id) ON DELETE SET NULL,
  puntos INT NOT NULL,
  jugadores INT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE liga_campeonas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "liga_campeonas_select" ON liga_campeonas FOR SELECT USING (TRUE);
REVOKE ALL ON liga_campeonas FROM anon, authenticated;
GRANT SELECT ON liga_campeonas TO anon, authenticated;


-- ---------- funciones (solo service role) ----------
CREATE OR REPLACE FUNCTION liga_semana_actual()
RETURNS DATE
LANGUAGE sql STABLE
AS $$
  SELECT date_trunc('week', (now() AT TIME ZONE 'America/Los_Angeles')::date)::date;
$$;

CREATE OR REPLACE FUNCTION liga_registrar_puntos(
  p_jugador UUID,
  p_juego TEXT,
  p_puntos INT,
  p_partida TEXT,
  p_evento TEXT,
  p_max_partida INT,
  p_tope_dia INT
)
RETURNS INT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_dia DATE := (now() AT TIME ZONE 'America/Los_Angeles')::date;
  v_semana DATE := date_trunc('week', (now() AT TIME ZONE 'America/Los_Angeles')::date)::date;
  v_iglesia UUID;
  v_rol TEXT;
  v_usado INT;
  v_margen INT;
  v_filas INT;
BEGIN
  IF p_puntos IS NULL OR p_puntos <= 0 THEN
    RETURN 0;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('liga:' || p_jugador::text));

  SELECT iglesia_id, role INTO v_iglesia, v_rol FROM profiles WHERE id = p_jugador;
  IF NOT FOUND OR v_rol = 'admin' THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(puntos), 0) INTO v_usado
  FROM liga_puntos WHERE jugador = p_jugador AND juego = p_juego AND dia = v_dia;
  v_margen := LEAST(p_puntos, p_tope_dia - v_usado);

  IF p_max_partida IS NOT NULL THEN
    SELECT COALESCE(SUM(puntos), 0) INTO v_usado
    FROM liga_puntos WHERE jugador = p_jugador AND juego = p_juego AND partida_ref = p_partida;
    v_margen := LEAST(v_margen, p_max_partida - v_usado);
  END IF;

  IF v_margen <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO liga_puntos (jugador, iglesia_id, juego, puntos, partida_ref, evento_ref, semana, dia)
  VALUES (p_jugador, v_iglesia, p_juego, v_margen, p_partida, p_evento, v_semana, v_dia)
  ON CONFLICT (jugador, juego, evento_ref) DO NOTHING;
  GET DIAGNOSTICS v_filas = ROW_COUNT;

  RETURN CASE WHEN v_filas > 0 THEN v_margen ELSE 0 END;
END;
$$;

-- Equipos aprobados con puntos en una semana. Empate: más jugadores y
-- luego quien llegó primero a ese total.
CREATE OR REPLACE FUNCTION liga_tabla_semana(p_semana DATE)
RETURNS TABLE (iglesia_id UUID, puntos INT, jugadores INT, ultimo TIMESTAMPTZ)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT lp.iglesia_id, SUM(lp.puntos)::INT, COUNT(DISTINCT lp.jugador)::INT, MAX(lp.creado_en)
  FROM liga_puntos lp
  JOIN iglesias i ON i.id = lp.iglesia_id AND i.aprobada
  WHERE lp.semana = p_semana
  GROUP BY lp.iglesia_id
  ORDER BY 2 DESC, 3 DESC, 4 ASC;
$$;

CREATE OR REPLACE FUNCTION liga_jugadores_semana(p_semana DATE, p_iglesia UUID, p_limite INT)
RETURNS TABLE (jugador UUID, puntos INT, ultimo TIMESTAMPTZ)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT lp.jugador, SUM(lp.puntos)::INT, MAX(lp.creado_en)
  FROM liga_puntos lp
  WHERE lp.semana = p_semana
    AND (p_iglesia IS NULL OR lp.iglesia_id = p_iglesia)
  GROUP BY lp.jugador
  ORDER BY 2 DESC, 3 ASC
  LIMIT LEAST(GREATEST(p_limite, 1), 50);
$$;

CREATE OR REPLACE FUNCTION liga_cerrar_semana(p_semana DATE)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_filas INT;
BEGIN
  INSERT INTO liga_campeonas (semana, iglesia_id, puntos, jugadores)
  SELECT p_semana, t.iglesia_id, t.puntos, t.jugadores
  FROM liga_tabla_semana(p_semana) t
  LIMIT 1
  ON CONFLICT (semana) DO NOTHING;
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  RETURN v_filas > 0;
END;
$$;

CREATE OR REPLACE FUNCTION liga_asignar_sin_iglesia(p_jugador UUID, p_iglesia UUID)
RETURNS VOID
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE liga_puntos SET iglesia_id = p_iglesia
  WHERE jugador = p_jugador AND iglesia_id IS NULL AND semana = liga_semana_actual();
$$;

CREATE OR REPLACE FUNCTION liga_juntar_iglesias(p_conservar UUID, p_quitar UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_conservar = p_quitar THEN
    RAISE EXCEPTION 'Elige dos equipos distintos';
  END IF;
  IF EXISTS (SELECT 1 FROM iglesias WHERE id IN (p_conservar, p_quitar) AND comunidad = 'amigos') THEN
    RAISE EXCEPTION 'Amigos de Elim no se junta con otro equipo';
  END IF;
  UPDATE liga_puntos SET iglesia_id = p_conservar WHERE iglesia_id = p_quitar;
  UPDATE liga_campeonas SET iglesia_id = p_conservar WHERE iglesia_id = p_quitar;
  UPDATE profiles SET iglesia_id = p_conservar WHERE iglesia_id = p_quitar;
  DELETE FROM iglesias WHERE id = p_quitar;
END;
$$;

REVOKE ALL ON FUNCTION liga_semana_actual() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION liga_registrar_puntos(UUID, TEXT, INT, TEXT, TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION liga_tabla_semana(DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION liga_jugadores_semana(DATE, UUID, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION liga_cerrar_semana(DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION liga_asignar_sin_iglesia(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION liga_juntar_iglesias(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION liga_semana_actual() TO service_role;
GRANT EXECUTE ON FUNCTION liga_registrar_puntos(UUID, TEXT, INT, TEXT, TEXT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION liga_tabla_semana(DATE) TO service_role;
GRANT EXECUTE ON FUNCTION liga_jugadores_semana(DATE, UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION liga_cerrar_semana(DATE) TO service_role;
GRANT EXECUTE ON FUNCTION liga_asignar_sin_iglesia(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION liga_juntar_iglesias(UUID, UUID) TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON iglesias, liga_puntos, liga_campeonas TO service_role;


-- ---------- equipos iniciales ----------
INSERT INTO iglesias (comunidad, clave, aprobada) VALUES ('amigos', 'amigos', TRUE)
ON CONFLICT (clave) DO NOTHING;

-- Los 4 textos libres de Palabra del Día que sí son ciudades (LLDM).
INSERT INTO iglesias (comunidad, ciudad, estado, pais, clave, aprobada) VALUES
  ('lldm', 'Riverside', 'California', 'Estados Unidos', 'lldm||riverside|california|estados unidos', TRUE),
  ('lldm', 'Guadalajara', 'Jalisco', 'México', 'lldm||guadalajara|jalisco|mexico', TRUE),
  ('lldm', 'Santa Lucía', 'Campeche', 'México', 'lldm||santa lucia|campeche|mexico', TRUE),
  ('lldm', 'Ciudad de México', 'CDMX', 'México', 'lldm||ciudad de mexico|cdmx|mexico', TRUE)
ON CONFLICT (clave) DO NOTHING;

UPDATE profiles p
SET iglesia_id = i.id, iglesia_preguntada = TRUE
FROM iglesias i
WHERE (btrim(p.iglesia) = 'Riverside' AND i.clave = 'lldm||riverside|california|estados unidos')
   OR (btrim(p.iglesia) = 'Guadalajara' AND i.clave = 'lldm||guadalajara|jalisco|mexico')
   OR (btrim(p.iglesia) = 'Santa Lucia, Campeche' AND i.clave = 'lldm||santa lucia|campeche|mexico')
   OR (btrim(p.iglesia) = 'Cdmx, Magdalena' AND i.clave = 'lldm||ciudad de mexico|cdmx|mexico');

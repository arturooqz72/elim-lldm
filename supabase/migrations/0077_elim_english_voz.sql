-- ============================================================
-- Elim English — práctica de voz con límite propio + encuestas de precio
--
-- La voz (modo Pronunciación y tarjetas dentro del chat) deja de
-- descontar mensajes escritos y tiene su propio límite diario
-- (ENGLISH_VOICE_FREE_DAILY, 10 por defecto), contado por día del
-- Pacífico igual que los mensajes.
--
-- SOLO AGREGA (el código publicado antes de esta migración sigue igual):
-- - english_voz_diario + english_consumir_voz / english_devolver_voz
-- - english_pron_intentos: columnas origen ('modo' por defecto) y mensaje_id
-- - prueba sin cuenta: voz_usados en english_prueba_visitantes (0 por
--   defecto), tope global english_prueba_voz_dia, registro
--   english_prueba_voz_intentos y sus funciones
-- - english_encuestas: "¿Pagarías…?" de voz y de mensajes escritos
-- No se borra ni se cambia ninguna tabla, columna, restricción ni función
-- existente.
--
-- Igual que la voz de antes: el intento se aparta antes de llamar a Azure
-- (atómico, nadie se pasa del límite con dos pestañas) y se devuelve si
-- Azure falla o no detecta voz. En la práctica solo cuentan los intentos
-- con resultado válido.
-- ============================================================

-- ── Contador de voz por usuario y día ──────────────────────────────────

CREATE TABLE english_voz_diario (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dia     DATE NOT NULL,
  usados  INT NOT NULL DEFAULT 0 CHECK (usados >= 0),
  PRIMARY KEY (user_id, dia)
);

CREATE INDEX idx_english_voz_diario_dia ON english_voz_diario (dia);

ALTER TABLE english_voz_diario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "english_voz_diario_select_own" ON english_voz_diario
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

GRANT SELECT ON english_voz_diario TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON english_voz_diario TO service_role;

-- Aparta un intento de voz de hoy. permitido = false si ya llegó al límite.
CREATE FUNCTION english_consumir_voz(p_user UUID, p_limite INT)
RETURNS TABLE (permitido BOOLEAN, restantes INT, dia_pacifico DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dia DATE := (now() AT TIME ZONE 'America/Los_Angeles')::date;
  v_usados INT;
BEGIN
  INSERT INTO english_voz_diario (user_id, dia)
  VALUES (p_user, v_dia)
  ON CONFLICT (user_id, dia) DO NOTHING;

  UPDATE english_voz_diario v
     SET usados = v.usados + 1
   WHERE v.user_id = p_user AND v.dia = v_dia AND v.usados < p_limite
  RETURNING v.usados INTO v_usados;

  IF v_usados IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, v_dia;
    RETURN;
  END IF;
  RETURN QUERY SELECT TRUE, GREATEST(p_limite - v_usados, 0), v_dia;
END;
$$;

-- Devuelve el intento apartado (Azure falló o no hubo voz).
CREATE FUNCTION english_devolver_voz(p_user UUID, p_dia DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE english_voz_diario v
     SET usados = v.usados - 1
   WHERE v.user_id = p_user AND v.dia = p_dia AND v.usados > 0;
END;
$$;

REVOKE ALL ON FUNCTION english_consumir_voz(UUID, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION english_devolver_voz(UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION english_consumir_voz(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION english_devolver_voz(UUID, DATE) TO service_role;

-- ── De dónde vino cada intento (para las estadísticas) ─────────────────

ALTER TABLE english_pron_intentos
  ADD COLUMN origen TEXT NOT NULL DEFAULT 'modo' CHECK (origen IN ('modo', 'chat'));
ALTER TABLE english_pron_intentos
  ADD COLUMN mensaje_id UUID REFERENCES english_mensajes(id) ON DELETE SET NULL;

CREATE INDEX idx_english_pron_intentos_fecha ON english_pron_intentos (created_at);

-- ── Prueba sin cuenta: 1 intento de voz por visitante ──────────────────

ALTER TABLE english_prueba_visitantes
  ADD COLUMN voz_usados INT NOT NULL DEFAULT 0 CHECK (voz_usados >= 0);

-- Tope de todo el sitio por día (cuida el costo de Azure si alguien borra
-- la cookie una y otra vez).
CREATE TABLE english_prueba_voz_dia (
  dia    DATE PRIMARY KEY,
  usados INT NOT NULL DEFAULT 0 CHECK (usados >= 0)
);

-- Intentos de voz de la prueba (solo para estadísticas y costo de Azure).
CREATE TABLE english_prueba_voz_intentos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id      UUID NOT NULL REFERENCES english_prueba_visitantes(anon_id) ON DELETE CASCADE,
  mensaje_id   UUID REFERENCES english_prueba_mensajes(id) ON DELETE SET NULL,
  texto        TEXT NOT NULL,
  puntaje      NUMERIC(5, 1) NOT NULL CHECK (puntaje BETWEEN 0 AND 100),
  duracion_seg NUMERIC(5, 1),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_english_prueba_voz_intentos_fecha ON english_prueba_voz_intentos (created_at);

-- RLS activo y sin políticas: solo el servidor (service role) entra.
ALTER TABLE english_prueba_voz_dia ENABLE ROW LEVEL SECURITY;
ALTER TABLE english_prueba_voz_intentos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON english_prueba_voz_dia, english_prueba_voz_intentos TO service_role;

-- origen: 'ok' | 'limite' (ya usó su intento o no tiene prueba) |
-- 'reclamado' (su prueba ya pasó a una cuenta) | 'saturado' (tope del sitio).
CREATE FUNCTION english_prueba_consumir_voz(p_anon UUID, p_limite INT, p_limite_global INT)
RETURNS TABLE (origen TEXT, dia_pacifico DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dia DATE := (now() AT TIME ZONE 'America/Los_Angeles')::date;
  v_usados INT;
  v_user UUID;
  v_global INT;
BEGIN
  SELECT v.voz_usados, v.user_id INTO v_usados, v_user
    FROM english_prueba_visitantes v
   WHERE v.anon_id = p_anon
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'limite'::TEXT, v_dia;
    RETURN;
  END IF;
  IF v_user IS NOT NULL THEN
    RETURN QUERY SELECT 'reclamado'::TEXT, v_dia;
    RETURN;
  END IF;
  IF v_usados >= p_limite THEN
    RETURN QUERY SELECT 'limite'::TEXT, v_dia;
    RETURN;
  END IF;

  INSERT INTO english_prueba_voz_dia (dia) VALUES (v_dia)
  ON CONFLICT (dia) DO NOTHING;
  UPDATE english_prueba_voz_dia d
     SET usados = d.usados + 1
   WHERE d.dia = v_dia AND d.usados < p_limite_global
  RETURNING d.usados INTO v_global;
  IF v_global IS NULL THEN
    RETURN QUERY SELECT 'saturado'::TEXT, v_dia;
    RETURN;
  END IF;

  UPDATE english_prueba_visitantes v SET voz_usados = v.voz_usados + 1 WHERE v.anon_id = p_anon;
  RETURN QUERY SELECT 'ok'::TEXT, v_dia;
END;
$$;

CREATE FUNCTION english_prueba_devolver_voz(p_anon UUID, p_dia DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE english_prueba_visitantes v SET voz_usados = v.voz_usados - 1
   WHERE v.anon_id = p_anon AND v.voz_usados > 0;
  UPDATE english_prueba_voz_dia d SET usados = d.usados - 1
   WHERE d.dia = p_dia AND d.usados > 0;
END;
$$;

REVOKE ALL ON FUNCTION english_prueba_consumir_voz(UUID, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION english_prueba_devolver_voz(UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION english_prueba_consumir_voz(UUID, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION english_prueba_devolver_voz(UUID, DATE) TO service_role;

-- ── Encuestas de precio ("¿Pagarías…?") ────────────────────────────────
-- Una respuesta por persona y por tipo; se puede cambiar (updated_at).
-- Es una encuesta: no crea cobros ni compromisos.

CREATE TABLE english_encuestas (
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL CHECK (tipo IN ('voz', 'mensajes')),
  respuesta  TEXT NOT NULL CHECK (respuesta IN ('no', '3', '5', '10')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tipo)
);

ALTER TABLE english_encuestas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "english_encuestas_select_own" ON english_encuestas
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

GRANT SELECT ON english_encuestas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON english_encuestas TO service_role;

-- ============================================================
-- Elim English — modo Pronunciación
--
-- english_pron_frases    frases generadas para cada usuario (se sirven
--                        en orden; el texto de referencia para Azure sale
--                        de aquí, nunca del navegador)
-- english_pron_intentos  cada intento evaluado: puntajes, palabras y
--                        sonidos fallados. El audio NO se guarda.
--
-- english_consumir_mensaje ahora acepta p_cantidad (DEFAULT 1, así el chat
-- sigue igual): descuenta todo o nada, primero de los gratis y el resto de
-- créditos, y devuelve cuánto salió de cada lado para poder devolverlo
-- exacto con english_devolver_mensajes si Azure falla.
-- ============================================================

-- El modo nuevo se guarda en el perfil (los mensajes de chat no lo usan).
ALTER TABLE english_perfiles DROP CONSTRAINT IF EXISTS english_perfiles_modo_check;
ALTER TABLE english_perfiles ADD CONSTRAINT english_perfiles_modo_check
  CHECK (modo IN ('conversacion', 'situaciones', 'gramatica', 'vocabulario', 'pronunciacion'));

CREATE TABLE english_pron_frases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nivel         TEXT NOT NULL CHECK (nivel IN ('principiante', 'intermedio', 'avanzado')),
  texto         TEXT NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 200),
  traduccion    TEXT NOT NULL CHECK (char_length(traduccion) <= 300),
  sonido        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NULL = todavía en la cola; con fecha = ya se le mostró al usuario
  mostrada_at   TIMESTAMPTZ
);

CREATE TABLE english_pron_intentos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  frase_id         UUID REFERENCES english_pron_frases(id) ON DELETE SET NULL,
  texto            TEXT NOT NULL,
  nivel            TEXT NOT NULL,
  puntaje          NUMERIC(5, 1) NOT NULL CHECK (puntaje BETWEEN 0 AND 100),
  precision        NUMERIC(5, 1),
  fluidez          NUMERIC(5, 1),
  completitud      NUMERIC(5, 1),
  -- [{ palabra, puntaje, error, fonemas: [{ fonema, puntaje }] }]
  palabras         JSONB NOT NULL DEFAULT '[]'::jsonb,
  sonidos_fallados TEXT[] NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_english_pron_frases_cola ON english_pron_frases (user_id, mostrada_at, created_at);
CREATE INDEX idx_english_pron_intentos_user ON english_pron_intentos (user_id, created_at DESC);

ALTER TABLE english_pron_frases ENABLE ROW LEVEL SECURITY;
ALTER TABLE english_pron_intentos ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo lee lo suyo; solo el servidor (service role) escribe.
CREATE POLICY "english_pron_frases_select_own" ON english_pron_frases
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "english_pron_intentos_select_own" ON english_pron_intentos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

GRANT SELECT ON english_pron_frases, english_pron_intentos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON english_pron_frases, english_pron_intentos TO service_role;

-- ============================================================
-- RPC: descontar N mensajes (atómico, todo o nada)
--
-- Las filas de uso y de saldo se bloquean con FOR UPDATE antes de decidir,
-- así dos peticiones simultáneas se atienden una tras otra y nunca gastan
-- el mismo saldo. Con p_cantidad = 1 se comporta igual que la versión de
-- 0059 (primero gratis, luego crédito).
-- ============================================================

DROP FUNCTION IF EXISTS english_consumir_mensaje(UUID, INT);

CREATE FUNCTION english_consumir_mensaje(p_user UUID, p_limite_gratis INT, p_cantidad INT DEFAULT 1)
RETURNS TABLE (
  origen TEXT,
  gratis_restantes INT,
  creditos INT,
  gratis_usados INT,
  creditos_usados INT,
  dia DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_dia DATE := (now() AT TIME ZONE 'America/Los_Angeles')::date;
  v_usados INT;
  v_saldo INT;
  v_gratis INT;
  v_credito INT;
BEGIN
  IF p_cantidad IS NULL OR p_cantidad < 1 THEN
    RAISE EXCEPTION 'p_cantidad debe ser >= 1';
  END IF;

  INSERT INTO english_uso_diario (user_id, dia, usados)
  VALUES (p_user, v_dia, 0)
  ON CONFLICT (user_id, dia) DO NOTHING;

  SELECT u.usados INTO v_usados
    FROM english_uso_diario u
   WHERE u.user_id = p_user AND u.dia = v_dia
     FOR UPDATE;

  SELECT c.saldo INTO v_saldo
    FROM english_creditos c
   WHERE c.user_id = p_user
     FOR UPDATE;
  v_saldo := COALESCE(v_saldo, 0);

  v_gratis := LEAST(p_cantidad, GREATEST(p_limite_gratis - v_usados, 0));
  v_credito := p_cantidad - v_gratis;

  IF v_credito > v_saldo THEN
    RETURN QUERY SELECT 'limite_alcanzado'::TEXT,
      GREATEST(p_limite_gratis - v_usados, 0), v_saldo, 0, 0, v_dia;
    RETURN;
  END IF;

  IF v_gratis > 0 THEN
    UPDATE english_uso_diario u SET usados = u.usados + v_gratis
     WHERE u.user_id = p_user AND u.dia = v_dia;
  END IF;

  IF v_credito > 0 THEN
    UPDATE english_creditos c SET saldo = c.saldo - v_credito, updated_at = now()
     WHERE c.user_id = p_user;
  END IF;

  RETURN QUERY SELECT
    CASE WHEN v_credito > 0 THEN 'credito' ELSE 'gratis' END::TEXT,
    GREATEST(p_limite_gratis - v_usados - v_gratis, 0),
    v_saldo - v_credito,
    v_gratis,
    v_credito,
    v_dia;
END;
$$;

-- Devuelve exactamente lo que se descontó (gratis del día indicado y créditos).
CREATE OR REPLACE FUNCTION english_devolver_mensajes(p_user UUID, p_dia DATE, p_gratis INT, p_creditos INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_gratis > 0 THEN
    UPDATE english_uso_diario
       SET usados = GREATEST(usados - p_gratis, 0)
     WHERE user_id = p_user AND dia = p_dia;
  END IF;
  IF p_creditos > 0 THEN
    UPDATE english_creditos
       SET saldo = saldo + p_creditos, updated_at = now()
     WHERE user_id = p_user;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION english_consumir_mensaje(UUID, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION english_devolver_mensajes(UUID, DATE, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION english_consumir_mensaje(UUID, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION english_devolver_mensajes(UUID, DATE, INT, INT) TO service_role;

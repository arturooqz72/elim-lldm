-- ============================================================
-- Elim English — tutor de inglés con IA (/ingles)
--
-- english_perfiles    nivel, modo y situación elegidos por usuario
-- english_mensajes    historial de conversación por usuario y modo
-- english_uso_diario  mensajes gratis usados por día (hora del Pacífico)
-- english_creditos    saldo de mensajes comprados
-- english_compras     compras de Stripe; stripe_event_id UNIQUE hace
--                     idempotente el webhook
--
-- Uso, saldo y compras solo los modifica el servidor (service role) a
-- través de las funciones RPC de abajo: el navegador solo puede leerlos.
-- ============================================================

CREATE TABLE english_perfiles (
  user_id    UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  nivel      TEXT NOT NULL DEFAULT 'principiante'
    CHECK (nivel IN ('principiante', 'intermedio', 'avanzado')),
  modo       TEXT NOT NULL DEFAULT 'conversacion'
    CHECK (modo IN ('conversacion', 'situaciones', 'gramatica', 'vocabulario')),
  situacion  TEXT NOT NULL DEFAULT 'restaurante'
    CHECK (situacion IN ('restaurante', 'entrevista', 'medico', 'aeropuerto')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE english_mensajes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  modo       TEXT NOT NULL
    CHECK (modo IN ('conversacion', 'situaciones', 'gramatica', 'vocabulario')),
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE english_uso_diario (
  user_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dia      DATE NOT NULL,
  usados   INT NOT NULL DEFAULT 0 CHECK (usados >= 0),
  PRIMARY KEY (user_id, dia)
);

CREATE TABLE english_creditos (
  user_id    UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  saldo      INT NOT NULL DEFAULT 0 CHECK (saldo >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sin ON DELETE CASCADE a propósito: el registro de un pago se conserva
-- aunque se borre la cuenta (contabilidad/reembolsos).
CREATE TABLE english_compras (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  paquete           TEXT NOT NULL,
  mensajes          INT NOT NULL CHECK (mensajes > 0),
  monto_centavos    INT NOT NULL CHECK (monto_centavos >= 0),
  moneda            TEXT NOT NULL,
  stripe_session_id TEXT NOT NULL UNIQUE,
  stripe_event_id   TEXT NOT NULL UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_english_mensajes_user ON english_mensajes (user_id, modo, created_at);
CREATE INDEX idx_english_compras_user ON english_compras (user_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE english_perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE english_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE english_uso_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE english_creditos ENABLE ROW LEVEL SECURITY;
ALTER TABLE english_compras ENABLE ROW LEVEL SECURITY;

-- Perfil: el usuario lee y cambia el suyo (nivel/modo no cuestan nada)
CREATE POLICY "english_perfiles_select_own" ON english_perfiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "english_perfiles_insert_own" ON english_perfiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "english_perfiles_update_own" ON english_perfiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Mensajes: el usuario lee y borra los suyos. Los inserta solo el servidor,
-- después de descontar el mensaje, para que no se pueda "fabricar" historial.
CREATE POLICY "english_mensajes_select_own" ON english_mensajes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "english_mensajes_delete_own" ON english_mensajes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Uso, saldo y compras: solo lectura de lo propio
CREATE POLICY "english_uso_select_own" ON english_uso_diario
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "english_creditos_select_own" ON english_creditos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "english_compras_select_own" ON english_compras
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- GRANTS (sin GRANT, Postgres rechaza antes de evaluar RLS — ver 0005)
-- ============================================================

GRANT SELECT, INSERT, UPDATE ON english_perfiles TO authenticated;
GRANT SELECT, DELETE ON english_mensajes TO authenticated;
GRANT SELECT ON english_uso_diario, english_creditos, english_compras TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON english_perfiles, english_mensajes, english_uso_diario, english_creditos, english_compras
  TO service_role;

-- ============================================================
-- RPC: descontar un mensaje (atómico)
--
-- Primero los gratis del día (hora del Pacífico, calculada aquí y no en el
-- navegador); si se acabaron, un crédito. Los UPDATE ... WHERE usados < límite
-- / saldo > 0 toman el bloqueo de fila, así que dos peticiones simultáneas
-- nunca gastan el mismo mensaje.
-- Devuelve origen = 'gratis' | 'credito' | 'limite_alcanzado' y lo que queda.
-- ============================================================

CREATE OR REPLACE FUNCTION english_consumir_mensaje(p_user UUID, p_limite_gratis INT)
RETURNS TABLE (origen TEXT, gratis_restantes INT, creditos INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dia DATE := (now() AT TIME ZONE 'America/Los_Angeles')::date;
  v_usados INT;
  v_saldo INT;
BEGIN
  INSERT INTO english_uso_diario (user_id, dia, usados)
  VALUES (p_user, v_dia, 0)
  ON CONFLICT (user_id, dia) DO NOTHING;

  UPDATE english_uso_diario
     SET usados = usados + 1
   WHERE user_id = p_user AND dia = v_dia AND usados < p_limite_gratis
  RETURNING usados INTO v_usados;

  IF FOUND THEN
    SELECT COALESCE((SELECT saldo FROM english_creditos WHERE user_id = p_user), 0) INTO v_saldo;
    RETURN QUERY SELECT 'gratis'::TEXT, p_limite_gratis - v_usados, v_saldo;
    RETURN;
  END IF;

  UPDATE english_creditos
     SET saldo = saldo - 1, updated_at = now()
   WHERE user_id = p_user AND saldo > 0
  RETURNING saldo INTO v_saldo;

  IF FOUND THEN
    RETURN QUERY SELECT 'credito'::TEXT, 0, v_saldo;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'limite_alcanzado'::TEXT, 0, 0;
END;
$$;

-- Devuelve el mensaje descontado cuando la llamada al modelo falla.
CREATE OR REPLACE FUNCTION english_devolver_mensaje(p_user UUID, p_origen TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_origen = 'gratis' THEN
    UPDATE english_uso_diario
       SET usados = GREATEST(usados - 1, 0)
     WHERE user_id = p_user AND dia = (now() AT TIME ZONE 'America/Los_Angeles')::date;
  ELSIF p_origen = 'credito' THEN
    UPDATE english_creditos SET saldo = saldo + 1, updated_at = now() WHERE user_id = p_user;
  END IF;
END;
$$;

-- Registra la compra y suma los créditos en una sola transacción. Si el
-- evento (o la sesión de pago) ya se procesó, no hace nada y devuelve FALSE:
-- Stripe reintenta webhooks y así nunca se acredita dos veces.
CREATE OR REPLACE FUNCTION english_acreditar_compra(
  p_event_id TEXT,
  p_session_id TEXT,
  p_user UUID,
  p_paquete TEXT,
  p_mensajes INT,
  p_monto_centavos INT,
  p_moneda TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO english_compras
    (user_id, paquete, mensajes, monto_centavos, moneda, stripe_session_id, stripe_event_id)
  VALUES
    (p_user, p_paquete, p_mensajes, p_monto_centavos, p_moneda, p_session_id, p_event_id)
  ON CONFLICT DO NOTHING;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  INSERT INTO english_creditos (user_id, saldo)
  VALUES (p_user, p_mensajes)
  ON CONFLICT (user_id) DO UPDATE
    SET saldo = english_creditos.saldo + EXCLUDED.saldo, updated_at = now();

  RETURN TRUE;
END;
$$;

-- Solo el servidor puede llamar las RPC (por defecto PUBLIC tiene EXECUTE).
REVOKE ALL ON FUNCTION english_consumir_mensaje(UUID, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION english_devolver_mensaje(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION english_acreditar_compra(TEXT, TEXT, UUID, TEXT, INT, INT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION english_consumir_mensaje(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION english_devolver_mensaje(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION english_acreditar_compra(TEXT, TEXT, UUID, TEXT, INT, INT, TEXT) TO service_role;

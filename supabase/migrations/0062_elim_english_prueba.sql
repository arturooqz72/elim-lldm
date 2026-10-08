-- ============================================================
-- Elim English — prueba sin cuenta + datos para estadísticas
--
-- english_prueba_visitantes  un visitante anónimo por cookie (anon_id):
--                            cuántos mensajes de prueba usó y, si después
--                            entró con una cuenta, a cuál pasó su chat
-- english_prueba_mensajes    la conversación de prueba (Conversación libre,
--                            Principiante) hasta que se pasa a una cuenta
-- english_prueba_ips         mensajes de prueba por IP (con hash) y día
-- english_prueba_dia         mensajes de prueba de todo el sitio por día
--                            (tope para que un abuso no dispare el costo)
--
-- Todo esto lo usa solo el servidor (service role): RLS activo y sin
-- políticas, así el navegador no puede leer ni escribir nada.
--
-- Además:
-- - english_mensajes.de_prueba marca los mensajes que llegaron de una
--   prueba, para que las estadísticas no los cuenten dos veces.
-- - english_pron_intentos.duracion_seg guarda cuánto duró el audio, para
--   estimar el costo de Azure.
-- ============================================================

ALTER TABLE english_mensajes ADD COLUMN IF NOT EXISTS de_prueba BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE english_pron_intentos ADD COLUMN IF NOT EXISTS duracion_seg NUMERIC(5, 1);

CREATE TABLE english_prueba_visitantes (
  anon_id      UUID PRIMARY KEY,
  ip_hash      TEXT NOT NULL,
  usados       INT NOT NULL DEFAULT 0 CHECK (usados >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_uso   TIMESTAMPTZ,
  -- Cuenta que recibió la conversación (NULL = todavía anónimo)
  user_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reclamado_at TIMESTAMPTZ
);

CREATE TABLE english_prueba_mensajes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id    UUID NOT NULL REFERENCES english_prueba_visitantes(anon_id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE english_prueba_ips (
  ip_hash TEXT NOT NULL,
  dia     DATE NOT NULL,
  usados  INT NOT NULL DEFAULT 0 CHECK (usados >= 0),
  PRIMARY KEY (ip_hash, dia)
);

CREATE TABLE english_prueba_dia (
  dia    DATE PRIMARY KEY,
  usados INT NOT NULL DEFAULT 0 CHECK (usados >= 0)
);

CREATE INDEX idx_english_prueba_mensajes_anon ON english_prueba_mensajes (anon_id, created_at);
CREATE INDEX idx_english_prueba_mensajes_fecha ON english_prueba_mensajes (created_at);
CREATE INDEX idx_english_prueba_visitantes_fecha ON english_prueba_visitantes (created_at);

ALTER TABLE english_prueba_visitantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE english_prueba_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE english_prueba_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE english_prueba_dia ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON english_prueba_visitantes, english_prueba_mensajes, english_prueba_ips, english_prueba_dia
  TO service_role;

-- ============================================================
-- RPC: apartar un mensaje de prueba (atómico)
--
-- Bloquea con FOR UPDATE, siempre en el mismo orden (visitante, IP, día),
-- así dos peticiones simultáneas se atienden una tras otra. Devuelve:
--   'ok'        se apartó; restantes = lo que le queda al visitante
--   'limite'    ya usó sus mensajes (por cookie o por IP)
--   'reclamado' este navegador ya pasó su prueba a una cuenta
--   'saturado'  se llenó el tope del sitio para hoy
-- y dia_pacifico para devolverlo exacto si falla el modelo.
-- ============================================================

CREATE OR REPLACE FUNCTION english_prueba_consumir(
  p_anon UUID,
  p_ip_hash TEXT,
  p_limite INT,
  p_limite_ip INT,
  p_limite_global INT
)
RETURNS TABLE (origen TEXT, restantes INT, dia_pacifico DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dia DATE := (now() AT TIME ZONE 'America/Los_Angeles')::date;
  v_usados INT;
  v_user UUID;
  v_ip INT;
  v_global INT;
BEGIN
  -- Limpieza ocasional (no hay pg_cron): conversaciones de prueba que nunca
  -- pasaron a una cuenta y contadores viejos.
  IF random() < 0.01 THEN
    DELETE FROM english_prueba_mensajes WHERE created_at < now() - INTERVAL '90 days';
    DELETE FROM english_prueba_ips WHERE dia < v_dia - 7;
  END IF;

  INSERT INTO english_prueba_visitantes (anon_id, ip_hash)
  VALUES (p_anon, p_ip_hash)
  ON CONFLICT (anon_id) DO NOTHING;

  SELECT v.usados, v.user_id INTO v_usados, v_user
    FROM english_prueba_visitantes v
   WHERE v.anon_id = p_anon
     FOR UPDATE;

  IF v_user IS NOT NULL THEN
    RETURN QUERY SELECT 'reclamado'::TEXT, 0, v_dia;
    RETURN;
  END IF;
  IF v_usados >= p_limite THEN
    RETURN QUERY SELECT 'limite'::TEXT, 0, v_dia;
    RETURN;
  END IF;

  INSERT INTO english_prueba_ips (ip_hash, dia) VALUES (p_ip_hash, v_dia)
  ON CONFLICT (ip_hash, dia) DO NOTHING;
  SELECT i.usados INTO v_ip
    FROM english_prueba_ips i
   WHERE i.ip_hash = p_ip_hash AND i.dia = v_dia
     FOR UPDATE;
  IF v_ip >= p_limite_ip THEN
    RETURN QUERY SELECT 'limite'::TEXT, 0, v_dia;
    RETURN;
  END IF;

  INSERT INTO english_prueba_dia (dia) VALUES (v_dia)
  ON CONFLICT (dia) DO NOTHING;
  SELECT d.usados INTO v_global
    FROM english_prueba_dia d
   WHERE d.dia = v_dia
     FOR UPDATE;
  IF v_global >= p_limite_global THEN
    RETURN QUERY SELECT 'saturado'::TEXT, p_limite - v_usados, v_dia;
    RETURN;
  END IF;

  UPDATE english_prueba_visitantes
     SET usados = usados + 1, ultimo_uso = now(), ip_hash = p_ip_hash
   WHERE anon_id = p_anon;
  UPDATE english_prueba_ips SET usados = usados + 1 WHERE ip_hash = p_ip_hash AND dia = v_dia;
  UPDATE english_prueba_dia SET usados = usados + 1 WHERE dia = v_dia;

  RETURN QUERY SELECT 'ok'::TEXT, p_limite - (v_usados + 1), v_dia;
END;
$$;

-- Devuelve el mensaje apartado cuando la llamada al modelo falla.
CREATE OR REPLACE FUNCTION english_prueba_devolver(p_anon UUID, p_ip_hash TEXT, p_dia DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE english_prueba_visitantes SET usados = GREATEST(usados - 1, 0) WHERE anon_id = p_anon;
  UPDATE english_prueba_ips SET usados = GREATEST(usados - 1, 0) WHERE ip_hash = p_ip_hash AND dia = p_dia;
  UPDATE english_prueba_dia SET usados = GREATEST(usados - 1, 0) WHERE dia = p_dia;
END;
$$;

-- Pasa la conversación de prueba a la cuenta (una sola vez por visitante).
-- Los mensajes quedan en Conversación libre con su fecha original y
-- de_prueba = true; la copia anónima se borra. Devuelve cuántos se pasaron.
CREATE OR REPLACE FUNCTION english_prueba_reclamar(p_anon UUID, p_user UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n INT;
BEGIN
  UPDATE english_prueba_visitantes
     SET user_id = p_user, reclamado_at = now()
   WHERE anon_id = p_anon AND user_id IS NULL AND usados > 0;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  INSERT INTO english_mensajes (user_id, modo, role, content, created_at, de_prueba)
  SELECT p_user, 'conversacion', m.role, m.content, m.created_at, true
    FROM english_prueba_mensajes m
   WHERE m.anon_id = p_anon;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  DELETE FROM english_prueba_mensajes WHERE anon_id = p_anon;

  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION english_prueba_consumir(UUID, TEXT, INT, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION english_prueba_devolver(UUID, TEXT, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION english_prueba_reclamar(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION english_prueba_consumir(UUID, TEXT, INT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION english_prueba_devolver(UUID, TEXT, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION english_prueba_reclamar(UUID, UUID) TO service_role;

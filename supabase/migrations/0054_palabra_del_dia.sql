-- ============================================================
-- Elim LLDM — Palabra del Día (/juegos/palabra)
--
-- Reto diario estilo Wordle con palabras bíblicas. Cuatro piezas:
--
-- 1. palabra_diaria — una palabra por fecha. Igual que ahorcado_palabras
--    (0034) y ruleta_rondas: NINGUNA policy de SELECT para anon/
--    authenticated, así que nadie puede leer la palabra de hoy ni las
--    futuras por REST. Solo admin (gestión en /admin/palabra) y el service
--    role (las rutas /api/juegos/palabra/*, que evalúan cada intento en el
--    servidor y solo devuelven colores).
--
-- 2. palabra_partidas — una partida por usuario y fecha. Cada quien solo
--    LEE las suyas. No hay policy de INSERT/UPDATE para el cliente a
--    propósito: si el navegador pudiera escribir su propia fila, podría
--    marcarse "resuelta en 1 intento" sin jugar. Toda escritura pasa por
--    /api/juegos/palabra/intento y /sincronizar, que validan y evalúan en
--    el servidor (service role) y siempre usan el user_id de la sesión.
--
-- 3. palabra_rachas — racha actual/máxima/comodines por usuario, guardada
--    al terminar cada partida (la recalcula el servidor desde el historial
--    completo). Cada quien solo lee la suya.
--
-- 4. Funciones de ranking SECURITY DEFINER que devuelven solo nombre,
--    avatar, iglesia/ciudad y puntos — nunca intentos ni palabras.
--
-- Además: profiles.iglesia (no existía ningún campo de iglesia/ciudad).
-- ============================================================

-- ---------- profiles.iglesia ----------
-- NULL = nunca se le preguntó; '' = se le preguntó y prefirió no decirlo
-- (así se pregunta una sola vez, en cualquier dispositivo). Se edita con la
-- policy existente profiles_update_own (0001); profiles ya es de lectura
-- pública, y la iglesia/ciudad se muestra a propósito en el ranking.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS iglesia TEXT
  CHECK (iglesia IS NULL OR char_length(iglesia) <= 80);


-- ---------- palabra_diaria ----------
CREATE TABLE palabra_diaria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL UNIQUE,
  -- Se guarda como se muestra (JESÚS, SEÑOR); el servidor normaliza
  -- acentos al comparar. Exactamente 5 letras.
  palabra TEXT NOT NULL CHECK (palabra ~ '^[A-ZÁÉÍÓÚÜÑ]{5}$'),
  explicacion TEXT NOT NULL CHECK (char_length(explicacion) BETWEEN 1 AND 200),
  referencia TEXT NOT NULL CHECK (char_length(referencia) BETWEEN 1 AND 60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE palabra_diaria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "palabra_diaria_admin_all" ON palabra_diaria FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Sin GRANT a anon. A authenticated sí (la policy de arriba lo limita a
-- admin) — sin este GRANT ni el admin podría leer en /admin/palabra
-- (gotcha de tablas nuevas, ver 0019_jugadores_en_linea_grants.sql).
GRANT SELECT, INSERT, UPDATE, DELETE ON palabra_diaria TO authenticated;


-- ---------- palabra_partidas ----------
CREATE TABLE palabra_partidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  -- [{ "palabra": "TORRE", "colores": ["absent","present",...] }, ...]
  intentos JSONB NOT NULL DEFAULT '[]'::JSONB,
  -- Siempre = jsonb_array_length(intentos); el servidor lo usa además como
  -- guardia CAS para que un doble envío no agregue dos intentos.
  num_intentos INT NOT NULL DEFAULT 0 CHECK (num_intentos BETWEEN 0 AND 6),
  resuelta BOOLEAN NOT NULL DEFAULT FALSE,
  terminada BOOLEAN NOT NULL DEFAULT FALSE,
  -- 'servidor' = jugada con sesión iniciada (cuenta para el ranking
  -- semanal). 'local' = jugada sin sesión y sincronizada al iniciar sesión
  -- (cuenta para racha y estadísticas, NO para puntos del ranking: el
  -- navegador pudo haberla jugado sabiendo ya la respuesta).
  origen TEXT NOT NULL DEFAULT 'servidor' CHECK (origen IN ('servidor', 'local')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, fecha)
);

CREATE INDEX idx_palabra_partidas_fecha ON palabra_partidas (fecha) WHERE terminada;

ALTER TABLE palabra_partidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "palabra_partidas_select_own" ON palabra_partidas
  FOR SELECT USING (auth.uid() = user_id);

GRANT SELECT ON palabra_partidas TO authenticated;


-- ---------- palabra_rachas ----------
CREATE TABLE palabra_rachas (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  -- Valores al día de ultima_fecha. Si después faltó a más días de los que
  -- cubren sus comodines, la racha "efectiva" es 0 — eso se calcula al
  -- leer (ver palabra_ranking_rachas y rachaEfectiva() en el código).
  actual INT NOT NULL DEFAULT 0,
  maxima INT NOT NULL DEFAULT 0,
  comodines INT NOT NULL DEFAULT 0 CHECK (comodines BETWEEN 0 AND 2),
  ultima_fecha DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE palabra_rachas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "palabra_rachas_select_own" ON palabra_rachas
  FOR SELECT USING (auth.uid() = user_id);

GRANT SELECT ON palabra_rachas TO authenticated;


-- ---------- Rankings (solo datos públicos) ----------
-- SECURITY DEFINER para poder sumar las partidas de todos sin abrir la
-- tabla; search_path fijo por seguridad. Ninguna devuelve intentos,
-- colores ni palabras.

-- Puntos por día: 7 − intentos si la resolvió, 0 si no. Semana = lunes a
-- domingo; p_inicio (el lunes) lo calcula la app en America/Los_Angeles.
CREATE OR REPLACE FUNCTION palabra_ranking_semanal(p_inicio DATE, p_limite INT DEFAULT 10)
RETURNS TABLE (user_id UUID, nombre TEXT, avatar_url TEXT, iglesia TEXT, puntos INT, partidas INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.user_id,
    pr.display_name,
    pr.avatar_url,
    NULLIF(TRIM(pr.iglesia), ''),
    SUM(CASE WHEN p.resuelta THEN 7 - p.num_intentos ELSE 0 END)::INT,
    COUNT(*)::INT
  FROM palabra_partidas p
  JOIN profiles pr ON pr.id = p.user_id
  WHERE p.terminada
    AND p.origen = 'servidor'
    AND p.fecha BETWEEN p_inicio AND p_inicio + 6
  GROUP BY p.user_id, pr.display_name, pr.avatar_url, pr.iglesia
  ORDER BY 5 DESC, 6 DESC, 2 ASC
  LIMIT LEAST(GREATEST(p_limite, 1), 50);
$$;

-- Misma semana, agrupado por iglesia/ciudad (sin distinguir mayúsculas ni
-- espacios). Quien no tiene iglesia no entra a esta tabla.
CREATE OR REPLACE FUNCTION palabra_ranking_iglesias(p_inicio DATE, p_limite INT DEFAULT 10)
RETURNS TABLE (iglesia TEXT, puntos INT, jugadores INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    MIN(TRIM(pr.iglesia)),
    SUM(CASE WHEN p.resuelta THEN 7 - p.num_intentos ELSE 0 END)::INT,
    COUNT(DISTINCT p.user_id)::INT
  FROM palabra_partidas p
  JOIN profiles pr ON pr.id = p.user_id
  WHERE p.terminada
    AND p.origen = 'servidor'
    AND p.fecha BETWEEN p_inicio AND p_inicio + 6
    AND NULLIF(TRIM(pr.iglesia), '') IS NOT NULL
  GROUP BY LOWER(TRIM(pr.iglesia))
  ORDER BY 2 DESC, 3 DESC, 1 ASC
  LIMIT LEAST(GREATEST(p_limite, 1), 50);
$$;

-- Rachas activas más largas a la fecha p_hoy (la app la pasa en
-- America/Los_Angeles). Una racha sigue viva si los días faltados desde
-- ultima_fecha (sin contar hoy, que todavía se puede jugar) caben en los
-- comodines guardados; si no, cuenta como 0 y no aparece.
CREATE OR REPLACE FUNCTION palabra_ranking_rachas(p_hoy DATE, p_limite INT DEFAULT 10)
RETURNS TABLE (user_id UUID, nombre TEXT, avatar_url TEXT, iglesia TEXT, actual INT, maxima INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM (
    SELECT
      r.user_id,
      pr.display_name,
      pr.avatar_url,
      NULLIF(TRIM(pr.iglesia), ''),
      CASE WHEN (p_hoy - r.ultima_fecha) - 1 <= r.comodines THEN r.actual ELSE 0 END AS actual,
      r.maxima
    FROM palabra_rachas r
    JOIN profiles pr ON pr.id = r.user_id
    WHERE r.ultima_fecha IS NOT NULL
  ) t
  WHERE t.actual > 0
  ORDER BY t.actual DESC, t.maxima DESC, t.display_name ASC
  LIMIT LEAST(GREATEST(p_limite, 1), 50);
$$;

GRANT EXECUTE ON FUNCTION palabra_ranking_semanal(DATE, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION palabra_ranking_iglesias(DATE, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION palabra_ranking_rachas(DATE, INT) TO anon, authenticated;

-- ============================================================
-- Elim LLDM — Palabra del Día: botón "Pedir pista"
--
-- La pista (el libro de la Biblia donde aparece la palabra) es opcional y
-- cuesta puntos en el ranking de ese día: 7 − intentos − 2 si la pidió,
-- con mínimo 1 punto si la resolvió. No afecta la racha. El 2 es
-- PALABRA_COSTO_PISTA en src/lib/palabra/config.ts — si cambia, cambiar
-- ambos lugares.
--
-- Igual que el resto de palabra_partidas, solo el servidor (service role)
-- escribe esta columna, desde /api/juegos/palabra/pista.
-- ============================================================

ALTER TABLE palabra_partidas ADD COLUMN IF NOT EXISTS pista_usada BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION palabra_ranking_semanal(p_inicio DATE, p_limite INT DEFAULT 10)
RETURNS TABLE (user_id UUID, nombre TEXT, avatar_url TEXT, iglesia TEXT, puntos INT, partidas INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.user_id,
    pr.display_name,
    pr.avatar_url,
    NULLIF(TRIM(pr.iglesia), ''),
    SUM(CASE WHEN p.resuelta
      THEN GREATEST(7 - p.num_intentos - CASE WHEN p.pista_usada THEN 2 ELSE 0 END, 1)
      ELSE 0 END)::INT,
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

CREATE OR REPLACE FUNCTION palabra_ranking_iglesias(p_inicio DATE, p_limite INT DEFAULT 10)
RETURNS TABLE (iglesia TEXT, puntos INT, jugadores INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    MIN(TRIM(pr.iglesia)),
    SUM(CASE WHEN p.resuelta
      THEN GREATEST(7 - p.num_intentos - CASE WHEN p.pista_usada THEN 2 ELSE 0 END, 1)
      ELSE 0 END)::INT,
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

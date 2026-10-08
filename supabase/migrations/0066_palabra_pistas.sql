-- ============================================================
-- Elim LLDM — Palabra del Día: pistas nuevas (categoría + capítulo)
--
-- Reemplaza el botón "Pedir pista" (solo decía el libro y restaba 2
-- puntos) por dos pistas gratis:
-- 1. categoria — persona, lugar, objeto, acción o concepto; se ve desde el
--    inicio, arriba del tablero.
-- 2. libro + capitulo — "Búscala en Mateo 6"; aparece sola después del
--    2.º intento fallido. Si el libro delata la palabra (MATEO, ESTER,
--    ÉXODO…), la app dice "Es el nombre de un libro del … Testamento".
--
-- Los capítulos de las palabras ya programadas se verificaron contra la
-- Reina-Valera 1960: la palabra aparece tal cual (no solo en plural) en ese
-- capítulo, y el libro no la delata. Por eso algunos difieren de la
-- referencia (el versículo que se muestra al ganar), p. ej. LIRIO → Cantares 2
-- ("lirios" en Mateo 6), MATEO → Marcos 3. Excepciones sin alternativa:
-- ESTER (solo aparece en Ester) y ÉXODO (no aparece en ningún versículo).
--
-- Las pistas ya no restan puntos: los rankings dejan de descontar
-- pista_usada (la columna se queda como historial).
-- ============================================================

ALTER TABLE palabra_diaria
  ADD COLUMN IF NOT EXISTS categoria TEXT
    CHECK (categoria IN ('persona', 'lugar', 'objeto', 'accion', 'concepto')),
  ADD COLUMN IF NOT EXISTS libro TEXT CHECK (char_length(libro) BETWEEN 1 AND 30),
  ADD COLUMN IF NOT EXISTS capitulo INT CHECK (capitulo BETWEEN 1 AND 150);

UPDATE palabra_diaria d
SET categoria = v.categoria, libro = v.libro, capitulo = v.capitulo, updated_at = NOW()
FROM (VALUES
  ('JESÚS', 'persona', 'Mateo', 1),
  ('SALMO', 'concepto', 'Hechos', 13),
  ('MARÍA', 'persona', 'Lucas', 1),
  ('TORRE', 'lugar', 'Génesis', 11),
  ('MONTE', 'lugar', 'Mateo', 5),
  ('REINO', 'concepto', 'Mateo', 6),
  ('ALTAR', 'objeto', 'Génesis', 8),
  ('PALMA', 'objeto', 'Levítico', 14),
  ('ÁNGEL', 'persona', 'Lucas', 1),
  ('LIRIO', 'objeto', 'Cantares', 2),
  ('PEDRO', 'persona', 'Mateo', 16),
  ('PABLO', 'persona', 'Hechos', 13),
  ('MATEO', 'persona', 'Marcos', 3),
  ('JUDAS', 'persona', 'Mateo', 26),
  ('TOMÁS', 'persona', 'Juan', 20),
  ('MARTA', 'persona', 'Lucas', 10),
  ('BELÉN', 'lugar', 'Mateo', 2),
  ('SIMÓN', 'persona', 'Marcos', 15),
  ('JACOB', 'persona', 'Génesis', 28),
  ('ISAAC', 'persona', 'Génesis', 22),
  ('DAVID', 'persona', '1 Samuel', 16),
  ('AARÓN', 'persona', 'Éxodo', 4),
  ('JONÁS', 'persona', '2 Reyes', 14),
  ('NOEMÍ', 'persona', 'Rut', 1),
  ('CALEB', 'persona', 'Números', 14),
  ('ELÍAS', 'persona', '2 Reyes', 2),
  ('NAHÚM', 'persona', 'Lucas', 3),
  ('LUCAS', 'persona', 'Colosenses', 4),
  ('SILAS', 'persona', 'Hechos', 16),
  ('FÉLIX', 'persona', 'Hechos', 24),
  ('ESTER', 'persona', 'Ester', 4),
  ('JAIRO', 'persona', 'Marcos', 5),
  ('SARAÍ', 'persona', 'Génesis', 17),
  ('LABÁN', 'persona', 'Génesis', 29),
  ('JETRO', 'persona', 'Éxodo', 18),
  ('JOSUÉ', 'persona', 'Éxodo', 17),
  ('NATÁN', 'persona', '2 Samuel', 12),
  ('URÍAS', 'persona', '2 Samuel', 11),
  ('ÉFESO', 'lugar', 'Hechos', 19),
  ('SIDÓN', 'lugar', 'Mateo', 15),
  ('SINAÍ', 'lugar', 'Éxodo', 19),
  ('HOREB', 'lugar', 'Éxodo', 3),
  ('BABEL', 'lugar', 'Génesis', 11),
  ('EMAÚS', 'lugar', 'Lucas', 24),
  ('GOSÉN', 'lugar', 'Génesis', 47),
  ('SANTO', 'concepto', 'Isaías', 6),
  ('CIELO', 'lugar', 'Génesis', 6),
  ('PODER', 'concepto', 'Hechos', 1),
  ('VERBO', 'persona', 'Juan', 1),
  ('FRUTO', 'concepto', 'Gálatas', 5),
  ('JUSTO', 'persona', 'Romanos', 1),
  ('MANSO', 'concepto', 'Mateo', 11),
  ('AYUNO', 'accion', 'Isaías', 58),
  ('MUNDO', 'lugar', 'Juan', 3),
  ('FUEGO', 'objeto', 'Hechos', 2),
  ('PANES', 'objeto', 'Juan', 6),
  ('PECES', 'objeto', 'Mateo', 14),
  ('TRIGO', 'objeto', 'Juan', 12),
  ('GRANO', 'objeto', 'Mateo', 13),
  ('LECHE', 'objeto', 'Éxodo', 3),
  ('CETRO', 'objeto', 'Génesis', 49),
  ('TRONO', 'objeto', 'Apocalipsis', 4),
  ('ATRIO', 'lugar', 'Éxodo', 27),
  ('SELLO', 'objeto', 'Apocalipsis', 6),
  ('LIBRO', 'objeto', 'Apocalipsis', 20),
  ('ROLLO', 'objeto', 'Ezequiel', 3),
  ('TABLA', 'objeto', 'Éxodo', 26),
  ('OVEJA', 'objeto', 'Lucas', 15),
  ('REDIL', 'lugar', 'Juan', 10),
  ('LOBOS', 'objeto', 'Mateo', 7),
  ('VIUDA', 'persona', 'Marcos', 12),
  ('NIÑOS', 'persona', 'Marcos', 10),
  ('SEÑOR', 'persona', 'Filipenses', 2),
  ('SUEÑO', 'concepto', 'Génesis', 37),
  ('MAGOS', 'persona', 'Mateo', 2),
  ('MIRRA', 'objeto', 'Mateo', 2),
  ('SABIO', 'persona', 'Proverbios', 9),
  ('NECIO', 'persona', 'Proverbios', 12),
  ('BODAS', 'concepto', 'Juan', 2),
  ('MADRE', 'persona', 'Juan', 19),
  ('PADRE', 'persona', 'Mateo', 6),
  ('TRIBU', 'concepto', 'Apocalipsis', 5),
  ('SIETE', 'concepto', 'Mateo', 18),
  ('NUBES', 'objeto', 'Marcos', 13),
  ('BARCA', 'objeto', 'Mateo', 8),
  ('REDES', 'objeto', 'Lucas', 5),
  ('LLAVE', 'objeto', 'Apocalipsis', 3),
  ('HONDA', 'objeto', '1 Samuel', 17),
  ('LANZA', 'objeto', 'Juan', 19),
  ('YELMO', 'objeto', 'Efesios', 6),
  ('CARNE', 'objeto', 'Juan', 1),
  ('POLVO', 'objeto', 'Génesis', 3),
  ('MANTO', 'objeto', '2 Reyes', 2),
  ('HIGOS', 'objeto', 'Mateo', 7),
  ('OLIVO', 'objeto', 'Romanos', 11),
  ('CEDRO', 'objeto', 'Salmos', 92),
  ('ÁRBOL', 'objeto', 'Génesis', 2),
  ('ARENA', 'objeto', 'Mateo', 7),
  ('VALLE', 'lugar', 'Salmos', 23),
  ('MUROS', 'objeto', 'Hebreos', 11),
  ('TECHO', 'objeto', 'Marcos', 2),
  ('HORNO', 'objeto', 'Daniel', 3),
  ('SEÑAL', 'concepto', 'Isaías', 7),
  ('HIMNO', 'concepto', 'Mateo', 26),
  ('ÉXODO', 'accion', 'Éxodo', 12),
  ('HAGEO', 'persona', 'Esdras', 5),
  ('OSEAS', 'persona', 'Números', 13),
  ('JUDÍO', 'persona', 'Romanos', 1),
  ('OMEGA', 'concepto', 'Apocalipsis', 1),
  ('CIEGO', 'persona', 'Juan', 9),
  ('SORDO', 'persona', 'Marcos', 7),
  ('LEPRA', 'concepto', 'Mateo', 8),
  ('PERLA', 'objeto', 'Mateo', 13),
  ('DEUDA', 'concepto', 'Mateo', 18),
  ('SIEGA', 'accion', 'Juan', 4),
  ('ARADO', 'objeto', 'Lucas', 9),
  ('CARGA', 'objeto', 'Mateo', 11),
  ('OBRAS', 'concepto', 'Santiago', 2),
  ('DONES', 'concepto', '1 Corintios', 12),
  ('NARDO', 'objeto', 'Juan', 12),
  ('SALVO', 'concepto', 'Romanos', 10),
  ('LIBRE', 'concepto', 'Génesis', 24),
  ('AMADO', 'concepto', 'Mateo', 3),
  ('TEMOR', 'concepto', 'Proverbios', 1),
  ('NUEVO', 'concepto', 'Juan', 13),
  ('BUENO', 'concepto', 'Génesis', 1),
  ('AGUAS', 'objeto', 'Génesis', 1),
  ('ROCÍO', 'objeto', 'Génesis', 27),
  ('CAMPO', 'lugar', 'Mateo', 13),
  ('AGUJA', 'objeto', 'Mateo', 19),
  ('BARRO', 'objeto', 'Jeremías', 18),
  ('VELAD', 'accion', 'Mateo', 26),
  ('JUDEA', 'lugar', 'Hechos', 1),
  ('TARSO', 'lugar', 'Hechos', 9),
  ('CRETA', 'lugar', 'Tito', 1),
  ('MALTA', 'lugar', 'Hechos', 28),
  ('SIRIA', 'lugar', 'Lucas', 2),
  ('SALEM', 'lugar', 'Hebreos', 7),
  ('RAHAB', 'persona', 'Josué', 2),
  ('JAFET', 'persona', 'Génesis', 9),
  ('RUBÉN', 'persona', 'Génesis', 37),
  ('LIDIA', 'persona', 'Hechos', 16),
  ('DEMAS', 'persona', '2 Timoteo', 4),
  ('LOIDA', 'persona', '2 Timoteo', 1),
  ('JUANA', 'persona', 'Lucas', 8),
  ('CÉSAR', 'persona', 'Mateo', 22),
  ('MALCO', 'persona', 'Juan', 18),
  ('SAULO', 'persona', 'Hechos', 9),
  ('TADEO', 'persona', 'Mateo', 10)
) AS v(palabra, categoria, libro, capitulo)
WHERE d.palabra = v.palabra;

-- Si alguna palabra programada quedó sin llenar, esto falla y la migración
-- entera se revierte (nada a medias).
ALTER TABLE palabra_diaria
  ALTER COLUMN categoria SET NOT NULL,
  ALTER COLUMN libro SET NOT NULL,
  ALTER COLUMN capitulo SET NOT NULL;

-- Rankings sin descuento por pista (antes: −2 si pista_usada).
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

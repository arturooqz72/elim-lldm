-- ============================================================
-- Elim LLDM — Tabla de posiciones global de los juegos
-- Ejecutar manualmente en Supabase SQL Editor
--
-- No agrega ninguna tabla ni cambia cómo se juega: los puntos YA se
-- guardan por partida en arena_publica_jugadores y ruleta_jugadores, y
-- las salas terminadas nunca se borran (solo pasan a status 'finished').
-- Esta vista simplemente suma ese historial que ya existía y que nadie
-- estaba leyendo.
--
-- Solo Arena Abierta y La Ruleta en línea a propósito: son los dos juegos
-- donde entrar exige cuenta y la fila del jugador guarda user_id (ver
-- 0020 y 0023), así que el mismo miembro se reconoce entre partidas y
-- entre dispositivos. Elim Arena (elim_arena_jugadores) queda fuera
-- porque sus jugadores entran sin cuenta, identificados solo por un
-- nombre escrito a mano: dos personas distintas que escriban "Hermano
-- Juan" se fusionarían en una sola fila del ranking.
-- ============================================================

CREATE OR REPLACE VIEW tabla_posiciones
WITH (security_invoker = true) AS

-- ARENA ABIERTA
SELECT
  'arena_abierta'::TEXT     AS juego,
  j.user_id                 AS user_id,
  p.display_name            AS nombre,
  p.avatar_url              AS avatar_url,
  SUM(j.puntos)::INT        AS puntos_totales,
  COUNT(*)::INT             AS partidas
FROM arena_publica_jugadores j
JOIN arena_publica_salas s ON s.id = j.sala_id
JOIN profiles p            ON p.id = j.user_id
-- Solo partidas terminadas: si contáramos las salas en curso, el total de
-- un jugador cambiaría en vivo mientras juega y la tabla del vestíbulo
-- mostraría puntos de una partida que todavía puede revertirse.
WHERE s.status = 'finished'
  AND j.user_id IS NOT NULL
GROUP BY j.user_id, p.display_name, p.avatar_url

UNION ALL

-- LA RULETA EN LÍNEA
SELECT
  'ruleta'::TEXT            AS juego,
  j.user_id                 AS user_id,
  p.display_name            AS nombre,
  p.avatar_url              AS avatar_url,
  SUM(j.puntos)::INT        AS puntos_totales,
  COUNT(*)::INT             AS partidas
FROM ruleta_jugadores j
JOIN ruleta_salas s ON s.id = j.sala_id
JOIN profiles p     ON p.id = j.user_id
WHERE s.status = 'finished'
  AND j.user_id IS NOT NULL
GROUP BY j.user_id, p.display_name, p.avatar_url;

-- ============================================================
-- PERMISOS
--
-- security_invoker = true: la vista se evalúa con los permisos de quien
-- consulta, no del dueño de la vista. Es seguro y es lo que queremos —
-- las tres tablas de origen ya son públicamente legibles por diseño
-- (arena_publica_jugadores / ruleta_jugadores / profiles tienen policies
-- FOR SELECT USING (TRUE) en 0021, 0016 y 0001). Sin security_invoker la
-- vista saltaría RLS por completo, que es justo lo que hay que evitar.
--
-- anon incluido a propósito: /juegos es una página pública y la tabla de
-- posiciones debe verse sin iniciar sesión (es parte del gancho para que
-- un visitante se anime a crear cuenta y aparecer ahí).
-- ============================================================
GRANT SELECT ON tabla_posiciones TO anon, authenticated;

-- Índices de apoyo para el GROUP BY por usuario. Ruleta ya tiene
-- idx_ruleta_jugadores_user (sala_id, user_id) de 0020 y Arena Abierta
-- idx_arena_publica_jugadores_sala_user de 0023, pero ambos van por
-- sala_id primero; esta vista agrupa por user_id a través de TODAS las
-- salas, así que necesita el user_id al frente.
CREATE INDEX IF NOT EXISTS idx_arena_publica_jugadores_user_puntos
  ON arena_publica_jugadores (user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ruleta_jugadores_user_puntos
  ON ruleta_jugadores (user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_arena_publica_salas_status_finished
  ON arena_publica_salas (id) WHERE status = 'finished';

CREATE INDEX IF NOT EXISTS idx_ruleta_salas_status_finished
  ON ruleta_salas (id) WHERE status = 'finished';

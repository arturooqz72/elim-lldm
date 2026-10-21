-- ============================================================
-- Elim LLDM — Ahorcado: temporada nueva con una tabla por nivel
-- Ejecutar manualmente en Supabase SQL Editor JUSTO DESPUÉS de que el
-- código de feat/ahorcado-dificultad quede en producción (no antes: el
-- código viejo seguiría sumando a las rachas que aquí se reinician).
--
-- 1. Los récords de antes (game_key 'ahorcado') NO se tocan: se muestran
--    como "Récords históricos". Las tablas nuevas son 'ahorcado_facil',
--    'ahorcado_normal' y 'ahorcado_dificil'.
-- 2. Se borran solo las partidas de prueba de la vista previa, hechas con
--    la cuenta admin Elimlldm (9bdee2c2-…) el 2026-10-21: sus filas en las
--    tablas nuevas y sus palabras en el historial. Si alguien más ya jugó
--    entre el despliegue y esta migración, su récord se queda.
-- 3. Las rachas en curso se hicieron con las reglas viejas (pistas y cita
--    a la vista): se dan por terminadas para que nadie lleve esos puntos a
--    las tablas nuevas. Al entrar, cada quien elige dificultad y empieza de
--    cero. Su mejor récord ya está en los históricos.
-- ============================================================

DELETE FROM juego_individual_rankings
WHERE game_key IN ('ahorcado_facil', 'ahorcado_normal', 'ahorcado_dificil')
  AND user_id = '9bdee2c2-1be0-4c27-a638-cb99d6fdc2e6';

DELETE FROM ahorcado_resultados
WHERE user_id = '9bdee2c2-1be0-4c27-a638-cb99d6fdc2e6'
  AND created_at >= '2026-10-21T07:00:00Z';

UPDATE ahorcado_corridas
SET estado = 'perdida',
    puntos = 0,
    ganadas = 0,
    usadas = '{}',
    pistas = 0,
    updated_at = NOW()
WHERE estado <> 'perdida' OR puntos <> 0;
